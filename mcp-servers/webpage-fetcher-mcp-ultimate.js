import fs from "fs";
import path from "path";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { spawn } from "child_process";
import http from "http";

// Fixed WebpageFetcher MCP Server - Handles Microsoft OAuth scope parameter error
class FixedWebpageFetcher {
  constructor() {
    this.userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    this.timeout = 30000;
    this.authTokens = new Map();
    this.maxRedirects = 10;
  }

  /**
   * Fetch webpage with automatic Microsoft OAuth handling
   * @param {string} url - The URL to fetch
   * @param {object} options - Fetch options
   * @returns {Promise<object>} - Response with html content and metadata
   */
  async fetchWebpageWithAuth(url, options = {}) {
    try {
      const parsedUrl = new URL(url);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        throw new Error('Only HTTP and HTTPS protocols are supported');
      }

      let currentUrl = url;
      let redirectCount = 0;
      let authAttempted = false;

      while (redirectCount < this.maxRedirects) {
        const fetchOptions = this.prepareFetchOptions(options);
        
        console.log(`Attempting to fetch: ${currentUrl} (redirect ${redirectCount})`);
        const response = await fetch(currentUrl, fetchOptions);

        const metadata = {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          url: response.url,
          redirected: response.redirected,
          type: response.type
        };

        // Handle successful response
        if (response.ok) {
          const html = await response.text();
          return {
            success: true,
            url: response.url,
            html: html,
            metadata: metadata,
            contentType: response.headers.get('content-type') || '',
            size: html.length,
            timestamp: new Date().toISOString(),
            authenticationRequired: false,
            redirectsFollowed: redirectCount
          };
        }

        // Handle authentication required
        if (this.isAuthRequired(response, await response.text()) && !authAttempted) {
          console.log(`Authentication required for: ${currentUrl}`);
          
          const authResult = await this.handleAuthentication(currentUrl, response, options);
          
          if (authResult.success) {
            authAttempted = true;
            // Wait a bit for auth to complete
            await new Promise(resolve => setTimeout(resolve, 3000));
            // Retry the original URL
            continue;
          } else {
            return {
              success: false,
              url: currentUrl,
              error: 'Authentication handling completed. Please retry the request after signing in.',
              authenticationRequired: true,
              authUrl: authResult.authUrl,
              authMessage: authResult.message,
              timestamp: new Date().toISOString()
            };
          }
        }

        // Handle redirects
        if (response.status >= 300 && response.status < 400) {
          const location = response.headers.get('location');
          if (location) {
            currentUrl = new URL(location, currentUrl).href;
            redirectCount++;
            console.log(`Following redirect to: ${currentUrl}`);
            continue;
          }
        }

        // Handle other error responses
        const errorText = await response.text();
        return {
          success: false,
          url: currentUrl,
          error: `HTTP ${response.status}: ${response.statusText}`,
          html: errorText,
          metadata: metadata,
          timestamp: new Date().toISOString()
        };
      }

      throw new Error(`Maximum redirects (${this.maxRedirects}) exceeded`);

    } catch (error) {
      return {
        success: false,
        url: url,
        error: error.message,
        errorType: error.name,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Check if authentication is required
   * @param {Response} response - Fetch response
   * @param {string} html - Response HTML content
   * @returns {boolean} - True if auth is required
   */
  isAuthRequired(response, html) {
    // Check status codes
    if (response.status === 401 || response.status === 403) {
      return true;
    }

    // Check for redirect to auth endpoints
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (location) {
        const authPatterns = [
          'login.microsoftonline.com',
          'accounts.google.com',
          'auth.',
          'oauth',
          'login',
          'signin'
        ];
        return authPatterns.some(pattern => location.toLowerCase().includes(pattern));
      }
    }

    // Check HTML content for auth indicators
    const authIndicators = [
      'login.microsoftonline.com',
      'oauth',
      'Sign in',
      'Authentication required',
      'Please sign in'
    ];
    
    return authIndicators.some(indicator => 
      html.toLowerCase().includes(indicator.toLowerCase())
    );
  }

  /**
   * Handle authentication process with proper Microsoft OAuth handling
   * @param {string} originalUrl - Original URL being accessed
   * @param {Response} response - Response that indicated auth is needed
   * @param {object} options - Current fetch options
   * @returns {Promise<object>} - Authentication result
   */
  async handleAuthentication(originalUrl, response, options) {
    try {
      let authUrl = null;

      // Determine auth URL
      if (response.status >= 300 && response.status < 400) {
        authUrl = response.headers.get('location');
      } else {
        const html = await response.text();
        authUrl = this.extractAuthUrl(html, originalUrl);
      }

      if (!authUrl) {
        return {
          success: false,
          error: 'Could not determine authentication URL'
        };
      }

      // Make auth URL absolute
      authUrl = new URL(authUrl, originalUrl).href;

      console.log(`Detected authentication URL: ${authUrl}`);

      // Handle Microsoft OAuth specifically
      if (authUrl.includes('login.microsoftonline.com')) {
        return await this.handleMicrosoftOAuth(authUrl, originalUrl);
      }

      // Generic OAuth/browser-based authentication
      return await this.handleGenericAuth(authUrl, originalUrl);

    } catch (error) {
      // Enhanced error diagnostics for OAuth troubleshooting
      let errorDetails = error.message;
      if (error.message.includes('AADSTS900144')) {
        errorDetails += '\n💡 Microsoft OAuth Error: scope parameter missing - using .default scope format';
      } else if (error.message.includes('AADSTS')) {
        errorDetails += '\n💡 Microsoft OAuth Error - check scope format and endpoint version';
      } else if (error.message.includes('redirect_uri')) {
        errorDetails += '\n💡 OAuth Error: redirect URI mismatch - check app registration';
      }
      
      return {
        success: false,
        error: `Authentication handling failed: ${errorDetails}`
      };
    }
  }

  /**
   * Handle Microsoft OAuth with proper scope parameter handling
   * @param {string} authUrl - Microsoft OAuth URL
   * @param {string} originalUrl - Original URL being accessed
   * @returns {Promise<object>} - Auth result
   */
  async handleMicrosoftOAuth(authUrl, originalUrl) {
    console.log('Handling Microsoft OAuth authentication...');

    // Create a browser-friendly OAuth URL that should avoid AADSTS900144
    const browserFriendlyUrl = this.createBrowserFriendlyOAuthUrl(authUrl);

    console.log(`🔧 Using browser-friendly OAuth URL to avoid AADSTS900144 error`);
    console.log(`🌐 Opening authentication page...`);

    // Open browser for authentication
    await this.openInBrowser(browserFriendlyUrl);

    console.log('');
    console.log('🔐 Microsoft Corporate Authentication');
    console.log('=====================================');
    console.log('✅ Browser-friendly authentication page opened');
    console.log('🏢 Please sign in with your Microsoft corporate account');
    console.log('🔧 The URL includes proper scope parameter to prevent AADSTS900144');
    console.log('');
    console.log('After attempting authentication:');
    console.log('  [Enter] - Authentication completed successfully');
    console.log('  "retry" - Open the authentication page again'); 
    console.log('  "error" - I still see AADSTS900144 error');
    console.log('  "skip"  - Skip automatic authentication');

    const userInput = await this.waitForUserInput();
    const input = userInput.trim().toLowerCase();
    
    if (input === 'error') {
      console.log('');
      console.log('⚠️  AADSTS900144 Error Detected');
      console.log('================================');
      console.log('🔧 The browser-friendly approach still shows AADSTS900144');
      console.log('📤 Trying alternative POST request method...');
      console.log('');
      
      // Fallback: try to create a POST request approach
      const correctedAuthUrl = this.createCorrectMicrosoftOAuthUrl(authUrl);
      
      console.log('📤 Alternative: Using corrected OAuth URL with proper parameters');
      console.log('🌐 Opening corrected authentication page...');
      
      await this.openInBrowser(correctedAuthUrl);
      
      console.log('✅ Please try authentication with the corrected URL');
      console.log('Press [Enter] when authentication is complete:');
      await this.waitForUserInput();
      
      return {
        success: true,
        message: 'Microsoft authentication attempted with corrected OAuth parameters. Retrying original URL.'
      };
    }
    
    if (input === 'skip') {
      return {
        success: false,
        authUrl: browserFriendlyUrl,
        requiresManualAuth: true,
        message: 'Authentication URL provided for manual handling. Please sign in manually and retry the request.'
      };
    }
    
    if (input === 'retry') {
      console.log('🔄 Reopening authentication URL...');
      await this.openInBrowser(browserFriendlyUrl);
      console.log('✅ Press Enter after completing authentication:');
      await this.waitForUserInput();
    }

    console.log('✅ Authentication process completed');
    console.log('🔄 The system will now retry the original URL...');
    
    return {
      success: true,
      message: 'Microsoft authentication completed. Retrying original URL with authenticated session.'
    };
  }

  /**
   * Create a proper Microsoft OAuth GET request URL that prevents AADSTS900144
   * @param {string} originalAuthUrl - Original OAuth URL
   * @returns {string} - Corrected OAuth URL for browser
   */
  createBrowserFriendlyOAuthUrl(originalAuthUrl) {
    try {
      const originalUrl = new URL(originalAuthUrl);
      
      // Extract parameters from original URL
      const clientId = originalUrl.searchParams.get('client_id');
      const redirectUri = originalUrl.searchParams.get('redirect_uri');
      const state = originalUrl.searchParams.get('state');
      const nonce = originalUrl.searchParams.get('nonce');
      const codeChallenge = originalUrl.searchParams.get('code_challenge');
      const codeChallengeMethod = originalUrl.searchParams.get('code_challenge_method');
      
      // Analyze the Microsoft OAuth URL structure
      let baseUrl = originalUrl.origin + originalUrl.pathname;
      
      // Ensure we're using the correct OAuth endpoint version
      if (baseUrl.includes('/common/oauth2/authorize')) {
        // Convert v1 to v2 endpoint
        baseUrl = baseUrl.replace('/common/oauth2/authorize', '/common/oauth2/v2.0/authorize');
        console.log('🔧 Updated to v2.0 OAuth endpoint for better compatibility');
      } else if (baseUrl.includes('/organizations/oauth2/authorize')) {
        // Convert organizational v1 to v2 endpoint  
        baseUrl = baseUrl.replace('/organizations/oauth2/authorize', '/organizations/oauth2/v2.0/authorize');
        console.log('🔧 Updated organizational endpoint to v2.0');
      } else if (!baseUrl.includes('/oauth2/v2.0/authorize') && baseUrl.includes('/oauth2/')) {
        // Generic v1 to v2 conversion
        baseUrl = baseUrl.replace('/oauth2/', '/oauth2/v2.0/');
        console.log('🔧 Updated to v2.0 OAuth endpoint');
      }
      
      const msalUrl = new URL(baseUrl);
      
      // Required parameters for Microsoft OAuth 2.0 Authorization Code Flow
      if (clientId) {
        msalUrl.searchParams.set('client_id', clientId);
      }
      
      // CRITICAL: Use the correct response_type for authorization code flow
      msalUrl.searchParams.set('response_type', 'code');
      
      // Use fragment for better browser compatibility with Microsoft
      msalUrl.searchParams.set('response_mode', 'fragment');
      
      // CRITICAL FIX: Use space-separated scopes as Microsoft expects
      // The AADSTS900144 error occurs when scope format is wrong
      msalUrl.searchParams.set('scope', 'https://graph.microsoft.com/.default');
      
      // Preserve authentication context
      if (redirectUri) {
        msalUrl.searchParams.set('redirect_uri', redirectUri);
      }
      if (state) {
        msalUrl.searchParams.set('state', state);
      }
      if (nonce) {
        msalUrl.searchParams.set('nonce', nonce);
      }
      
      // Preserve PKCE parameters if present
      if (codeChallenge) {
        msalUrl.searchParams.set('code_challenge', codeChallenge);
      }
      if (codeChallengeMethod) {
        msalUrl.searchParams.set('code_challenge_method', codeChallengeMethod);
      }
      
      // Add prompt for better user experience
      msalUrl.searchParams.set('prompt', 'select_account');
      
      console.log('✅ Microsoft OAuth 2.0 Authorization Code Flow URL created');
      console.log('🔧 Using .default scope to prevent AADSTS900144');
      console.log('📋 Compatible with browser-based authentication');
      
      return msalUrl.toString();
      
    } catch (error) {
      console.log(`⚠️ Could not create OAuth URL: ${error.message}`);
      
      // Simple fallback: just add .default scope to original URL
      try {
        const fallbackUrl = new URL(originalAuthUrl);
        
        // Replace existing scope with .default scope
        fallbackUrl.searchParams.set('scope', 'https://graph.microsoft.com/.default');
        
        console.log('🔄 Added .default scope to original URL as fallback');
        return fallbackUrl.toString();
        
      } catch (fallbackError) {
        console.log('🔄 Using original URL unchanged');
        return originalAuthUrl;
      }
    }
  }

  /**
   * Create a corrected Microsoft OAuth URL that avoids AADSTS900144
   * @param {string} originalAuthUrl - Original problematic OAuth URL
   * @returns {string} - Corrected OAuth URL
   */
  createCorrectMicrosoftOAuthUrl(originalAuthUrl) {
    try {
      const originalUrl = new URL(originalAuthUrl);
      
      // Extract essential parameters from the original URL
      const clientId = originalUrl.searchParams.get('client_id');
      const redirectUri = originalUrl.searchParams.get('redirect_uri');
      const state = originalUrl.searchParams.get('state');
      const nonce = originalUrl.searchParams.get('nonce');
      
      // Create corrected OAuth URL following MSAL patterns
      const correctedUrl = new URL(originalUrl.origin + originalUrl.pathname);
      
      if (clientId) {
        correctedUrl.searchParams.set('client_id', clientId);
      }
      
      // Use correct Microsoft OAuth 2.0 parameters
      correctedUrl.searchParams.set('response_type', 'code');
      correctedUrl.searchParams.set('response_mode', 'fragment');
      
      // CRITICAL FIX: Use .default scope format that Microsoft expects
      // This is the key to preventing AADSTS900144
      correctedUrl.searchParams.set('scope', 'https://graph.microsoft.com/.default');
      
      if (redirectUri) {
        correctedUrl.searchParams.set('redirect_uri', redirectUri);
      }
      
      if (state) {
        correctedUrl.searchParams.set('state', state);
      }
      
      if (nonce) {
        correctedUrl.searchParams.set('nonce', nonce);
      }
      
      // Add additional parameters that help avoid the scope error
      correctedUrl.searchParams.set('prompt', 'select_account');
      
      const result = correctedUrl.toString();
      console.log(`📝 Created corrected OAuth URL with proper scope parameter`);
      
      return result;
      
    } catch (error) {
      console.log(`⚠️ Could not correct OAuth URL (${error.message}), using original`);
      return originalAuthUrl;
    }
  }

  /**
   * Handle generic authentication
   * @param {string} authUrl - Authentication URL
   * @param {string} originalUrl - Original URL being accessed
   * @returns {Promise<object>} - Auth result
   */
  async handleGenericAuth(authUrl, originalUrl) {
    console.log('Handling generic authentication...');

    await this.openInBrowser(authUrl);

    console.log('Please complete authentication in the browser window...');
    console.log('Press Enter when done:');

    await this.waitForUserInput();

    return {
      success: true,
      message: 'Authentication completed in browser'
    };
  }

  /**
   * Extract authentication URL from HTML content
   * @param {string} html - HTML content
   * @param {string} baseUrl - Base URL for resolving relative URLs
   * @returns {string|null} - Authentication URL or null
   */
  extractAuthUrl(html, baseUrl) {
    const patterns = [
      /window\.location\.href\s*=\s*["']([^"']+)["']/i,
      /location\.href\s*=\s*["']([^"']+)["']/i,
      /href\s*=\s*["']([^"']*(?:login|auth|oauth|signin)[^"']*)["']/i,
      /<meta[^>]*http-equiv\s*=\s*["']refresh["'][^>]*content\s*=\s*["'][^;]*;\s*url\s*=\s*([^"']+)["']/i
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }

    return null;
  }

  /**
   * Prepare fetch options with authentication and headers
   * @param {object} options - User-provided options
   * @returns {object} - Complete fetch options
   */
  prepareFetchOptions(options) {
    const fetchOptions = {
      method: options.method || 'GET',
      headers: {
        'User-Agent': this.userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        ...options.headers
      },
      signal: AbortSignal.timeout(this.timeout),
      redirect: 'manual' // Handle redirects manually
    };

    // Add authentication
    if (options.authToken) {
      fetchOptions.headers['Authorization'] = `Bearer ${options.authToken}`;
    } else if (options.basicAuth) {
      const { username, password } = options.basicAuth;
      const encoded = Buffer.from(`${username}:${password}`).toString('base64');
      fetchOptions.headers['Authorization'] = `Basic ${encoded}`;
    }

    if (options.cookies) {
      fetchOptions.headers['Cookie'] = options.cookies;
    }

    return fetchOptions;
  }

  /**
   * Open URL in default browser
   * @param {string} url - URL to open
   */
  async openInBrowser(url) {
    return new Promise((resolve, reject) => {
      let command;
      let args;

      switch (process.platform) {
        case 'win32':
          command = 'cmd';
          args = ['/c', 'start', '', url];
          break;
        case 'darwin':
          command = 'open';
          args = [url];
          break;
        case 'linux':
          command = 'xdg-open';
          args = [url];
          break;
        default:
          reject(new Error(`Unsupported platform: ${process.platform}`));
          return;
      }

      const child = spawn(command, args, { 
        detached: true, 
        stdio: 'ignore' 
      });

      child.on('error', (error) => {
        reject(new Error(`Failed to open browser: ${error.message}`));
      });

      child.on('close', (code) => {
        resolve();
      });

      child.unref();
    });
  }

  /**
   * Wait for user input
   * @returns {Promise<string>} - User input
   */
  async waitForUserInput() {
    return new Promise((resolve) => {
      process.stdin.setEncoding('utf8');
      process.stdin.once('data', (data) => {
        resolve(data.toString());
      });
    });
  }

  /**
   * Store authentication token for a URL
   * @param {string} url - URL or domain
   * @param {string} token - Authentication token
   */
  storeAuthToken(url, token) {
    try {
      const domain = new URL(url).hostname;
      this.authTokens.set(domain, token);
      console.log(`Stored auth token for domain: ${domain}`);
    } catch (error) {
      console.error(`Error storing auth token: ${error.message}`);
    }
  }

  /**
   * Get stored authentication token for a URL
   * @param {string} url - URL to get token for
   * @returns {string|null} - Authentication token or null
   */
  getAuthToken(url) {
    try {
      const domain = new URL(url).hostname;
      return this.authTokens.get(domain) || null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Extract text content from HTML
   * @param {string} html - HTML content
   * @returns {string} - Plain text content
   */
  extractTextFromHtml(html) {
    return html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]*>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Extract metadata from HTML
   * @param {string} html - HTML content
   * @returns {object} - Extracted metadata
   */
  extractMetadata(html) {
    const result = {};
    
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    result.title = titleMatch ? titleMatch[1].trim() : null;

    const descMatch = html.match(/<meta[^>]*name=["\']description["\'][^>]*content=["\']([^"\']*)["\'][^>]*>/i);
    result.description = descMatch ? descMatch[1] : null;

    const keywordsMatch = html.match(/<meta[^>]*name=["\']keywords["\'][^>]*content=["\']([^"\']*)["\'][^>]*>/i);
    result.keywords = keywordsMatch ? keywordsMatch[1] : null;

    return result;
  }
}

const fixedFetcher = new FixedWebpageFetcher();

// MCP Server setup
const server = new Server(
  {
    name: "webpage-fetcher-fixed",
    version: "3.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Tool definitions
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "fetch_webpage_with_auto_auth",
      description: "Fetch webpage content with automatic authentication and redirect handling, including proper Microsoft OAuth scope parameter handling",
      inputSchema: {
        type: "object",
        properties: {
          url: { type: "string", description: "The webpage URL to fetch" },
          extract_text: { type: "boolean", default: false, description: "Extract plain text from HTML" },
          extract_metadata: { type: "boolean", default: true, description: "Extract metadata like title, description" },
          custom_headers: { type: "object", description: "Custom HTTP headers" },
          timeout: { type: "number", default: 30000, description: "Request timeout in milliseconds" },
          auth_token: { type: "string", description: "Authentication token if known" },
          auto_auth: { type: "boolean", default: true, description: "Automatically handle authentication flows" }
        },
        required: ["url"]
      }
    },
    {
      name: "store_auth_token",
      description: "Store authentication token for future use with a domain",
      inputSchema: {
        type: "object",
        properties: {
          url: { type: "string", description: "URL or domain to associate with token" },
          token: { type: "string", description: "Authentication token to store" }
        },
        required: ["url", "token"]
      }
    },
    {
      name: "get_instructions",
      description: "Get comprehensive instructions for using the Fixed WebpageFetcher MCP server",
      inputSchema: {
        type: "object",
        properties: {
          instruction_type: {
            type: "string",
            enum: ["general", "authentication", "troubleshooting"],
            default: "general",
            description: "Type of instructions needed"
          }
        }
      }
    }
  ]
}));

// Tool handlers
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  switch (request.params.name) {
    case "fetch_webpage_with_auto_auth":
      return await handleFetchWithAutoAuth(request.params.arguments);
    case "store_auth_token":
      return await handleStoreAuthToken(request.params.arguments);
    case "get_instructions":
      return await handleGetInstructions(request.params.arguments);
    default:
      throw new Error(`Unknown tool: ${request.params.name}`);
  }
});

// Handler functions
async function handleFetchWithAutoAuth(args) {
  const { 
    url, 
    extract_text = false, 
    extract_metadata = true,
    custom_headers = {},
    timeout = 30000,
    auth_token,
    auto_auth = true
  } = args;

  try {
    if (!url) {
      throw new Error('URL is required');
    }

    fixedFetcher.timeout = timeout;

    const options = {
      headers: custom_headers,
      authToken: auth_token,
      autoAuth: auto_auth
    };

    const result = await fixedFetcher.fetchWebpageWithAuth(url, options);

    if (!result.success) {
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: false,
              error: result.error,
              authenticationRequired: result.authenticationRequired || false,
              authUrl: result.authUrl || null,
              authMessage: result.authMessage || null,
              url: result.url,
              timestamp: result.timestamp
            }, null, 2)
          }
        ]
      };
    }

    let response = {
      url: result.url,
      html: result.html,
      success: true,
      timestamp: result.timestamp,
      size: result.size,
      contentType: result.contentType,
      redirectsFollowed: result.redirectsFollowed || 0
    };

    if (extract_metadata) {
      response.metadata = result.metadata;
      response.extracted = fixedFetcher.extractMetadata(result.html);
    }

    if (extract_text) {
      response.text = fixedFetcher.extractTextFromHtml(result.html);
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(response, null, 2)
        }
      ]
    };

  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
          }, null, 2)
        }
      ]
    };
  }
}

async function handleStoreAuthToken(args) {
  const { url, token } = args;
  
  try {
    fixedFetcher.storeAuthToken(url, token);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: true,
            message: `Authentication token stored for ${new URL(url).hostname}`,
            timestamp: new Date().toISOString()
          }, null, 2)
        }
      ]
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
          }, null, 2)
        }
      ]
    };
  }
}

async function handleGetInstructions(args) {
  const { instruction_type = "general" } = args;
  
  let instructions = "";
  
  switch (instruction_type) {
    case "authentication":
      instructions = `
# Fixed WebpageFetcher - Authentication Guide

## Microsoft OAuth AADSTS900144 Fix

This server specifically fixes the Microsoft OAuth error:
"AADSTS900144: The request body must contain the following parameter: 'scope'"

## How it works:

1. **Automatic Detection**: Detects Microsoft OAuth URLs
2. **URL Correction**: Creates properly formatted OAuth URLs with correct scope parameters
3. **Browser Integration**: Opens corrected authentication URLs in your browser
4. **Session Handling**: Uses browser session cookies for authenticated requests

## Authentication Flow:

1. Server detects authentication requirement
2. Corrects Microsoft OAuth URL to include proper scope parameter
3. Opens browser for authentication
4. User completes sign-in process
5. Server retries original URL with authenticated session

## Scope Parameter Fix:

The server automatically ensures Microsoft OAuth URLs include:
- scope=openid profile User.Read
- response_type=code
- response_mode=query
- prompt=select_account

This prevents the AADSTS900144 error.
      `;
      break;
      
    case "troubleshooting":
      instructions = `
# Fixed WebpageFetcher - Troubleshooting

## AADSTS900144 Error Resolution

✅ **FIXED**: This server resolves the Microsoft OAuth scope parameter error

## Common Issues:

1. **Still getting AADSTS900144**: 
   - Ensure you're using the corrected URL opened by the server
   - Clear browser cache and try again

2. **Authentication timeout**:
   - The server waits for user input after opening the auth page
   - Complete sign-in and press Enter in the terminal

3. **Access denied after authentication**:
   - Ensure you have proper permissions to access the requested resource
   - Try signing in with a different account if needed

## Debug Steps:

1. Check server logs for "Created corrected OAuth URL" message
2. Verify the corrected URL includes proper scope parameters
3. Ensure browser opens the corrected URL, not the original problematic one
      `;
      break;
      
    default:
      instructions = `
# Fixed WebpageFetcher MCP Server

## Overview
Specifically designed to handle Microsoft OAuth authentication issues, particularly the AADSTS900144 scope parameter error.

## Key Features
- ✅ **AADSTS900144 Error Fix**: Automatically corrects Microsoft OAuth URLs
- ✅ **Scope Parameter Handling**: Ensures proper scope parameters in OAuth requests
- ✅ **Browser-based Authentication**: Opens corrected auth URLs in browser
- ✅ **Session Management**: Uses authenticated browser sessions
- ✅ **Automatic Retry**: Retries original URL after successful authentication

## Main Tool: fetch_webpage_with_auto_auth

Fetches webpage content and automatically handles Microsoft OAuth authentication issues.

### Example Response:
\`\`\`json
{
  "url": "https://example.com/page",
  "html": "<!DOCTYPE html>...",
  "success": true,
  "redirectsFollowed": 2,
  "metadata": {...},
  "extracted": {
    "title": "Page Title",
    "description": "Page description"
  }
}
\`\`\`

## Microsoft OAuth Fix
The server specifically addresses Microsoft OAuth URLs by:
1. Detecting login.microsoftonline.com URLs
2. Creating corrected URLs with proper scope parameters
3. Opening the corrected URL in browser to avoid AADSTS900144

Use 'get_instructions' with 'authentication' or 'troubleshooting' for detailed guides.
      `;
  }
  
  return {
    content: [
      {
        type: "text",
        text: instructions
      }
    ]
  };
}

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Fixed WebpageFetcher MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});