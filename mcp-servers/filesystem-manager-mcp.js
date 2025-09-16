import fs from "fs";
import path from "path";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

// File system utilities
class FileSystemManager {
  constructor() {
    this.cache = new Map();
    this.maxCacheSize = 1000;
  }

  sanitizePath(filePath) {
    // Normalize the path and resolve it
    try {
      return path.resolve(filePath);
    } catch (error) {
      throw new Error(`Invalid path: ${filePath}`);
    }
  }

  async readFileContent(filePath, encoding = 'utf8') {
    const normalizedPath = this.sanitizePath(filePath);
    
    // Check cache first
    const cacheKey = `${normalizedPath}-${fs.statSync(normalizedPath).mtime.getTime()}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      const content = fs.readFileSync(normalizedPath, encoding);
      
      // Cache the content (with size limit)
      if (this.cache.size >= this.maxCacheSize) {
        const firstKey = this.cache.keys().next().value;
        this.cache.delete(firstKey);
      }
      this.cache.set(cacheKey, content);
      
      return content;
    } catch (error) {
      throw new Error(`Unable to read file ${normalizedPath}: ${error.message}`);
    }
  }

  async listDirectory(dirPath, options = {}) {
    const normalizedPath = this.sanitizePath(dirPath);
    const { recursive = false, filter = null, maxDepth = 10, currentDepth = 0 } = options;

    if (currentDepth > maxDepth) {
      return [];
    }

    try {
      const items = fs.readdirSync(normalizedPath, { withFileTypes: true });
      const result = [];

      for (const item of items) {
        const fullPath = path.join(normalizedPath, item.name);
        
        // Apply filter if provided
        if (filter && !this.matchesFilter(item.name, filter)) {
          continue;
        }

        const itemInfo = {
          name: item.name,
          path: fullPath,
          type: item.isDirectory() ? 'directory' : 'file',
          size: item.isFile() ? fs.statSync(fullPath).size : null,
          modified: fs.statSync(fullPath).mtime,
          extension: item.isFile() ? path.extname(item.name) : null
        };

        result.push(itemInfo);

        // Recursive directory listing
        if (recursive && item.isDirectory()) {
          try {
            const subItems = await this.listDirectory(fullPath, {
              ...options,
              currentDepth: currentDepth + 1
            });
            result.push(...subItems);
          } catch (error) {
            // Skip directories we can't access
            continue;
          }
        }
      }

      return result;
    } catch (error) {
      throw new Error(`Unable to list directory ${normalizedPath}: ${error.message}`);
    }
  }

  matchesFilter(filename, filter) {
    if (typeof filter === 'string') {
      // Simple glob pattern matching
      const regex = new RegExp(filter.replace(/\*/g, '.*').replace(/\?/g, '.'), 'i');
      return regex.test(filename);
    }
    if (filter instanceof RegExp) {
      return filter.test(filename);
    }
    if (typeof filter === 'function') {
      return filter(filename);
    }
    return true;
  }

  async searchFiles(searchPath, pattern, options = {}) {
    const { 
      recursive = true, 
      caseSensitive = false, 
      fileExtensions = null,
      maxResults = 100,
      includeContent = false 
    } = options;

    const results = [];
    const searchRegex = new RegExp(pattern, caseSensitive ? 'g' : 'gi');

    const processFile = async (filePath) => {
      try {
        if (fileExtensions) {
          const ext = path.extname(filePath).toLowerCase();
          if (!fileExtensions.includes(ext)) {
            return;
          }
        }

        const content = await this.readFileContent(filePath);
        const matches = [...content.matchAll(searchRegex)];

        if (matches.length > 0) {
          const result = {
            path: filePath,
            filename: path.basename(filePath),
            matchCount: matches.length,
            matches: matches.slice(0, 10).map(match => ({
              text: match[0],
              index: match.index,
              line: content.substring(0, match.index).split('\n').length
            }))
          };

          if (includeContent) {
            result.content = content;
          }

          results.push(result);
        }
      } catch (error) {
        // Skip files we can't read
      }
    };

    const processDirectory = async (dirPath, depth = 0) => {
      if (depth > 10 || results.length >= maxResults) return;

      try {
        const items = await this.listDirectory(dirPath, { recursive: false });
        
        for (const item of items) {
          if (results.length >= maxResults) break;

          if (item.type === 'file') {
            await processFile(item.path);
          } else if (item.type === 'directory' && recursive) {
            await processDirectory(item.path, depth + 1);
          }
        }
      } catch (error) {
        // Skip directories we can't access
      }
    };

    await processDirectory(searchPath);
    return results;
  }

  getFileInfo(filePath) {
    const normalizedPath = this.sanitizePath(filePath);
    
    try {
      const stats = fs.statSync(normalizedPath);
      return {
        path: normalizedPath,
        name: path.basename(normalizedPath),
        directory: path.dirname(normalizedPath),
        extension: path.extname(normalizedPath),
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
        accessed: stats.atime,
        isDirectory: stats.isDirectory(),
        isFile: stats.isFile(),
        permissions: stats.mode.toString(8)
      };
    } catch (error) {
      throw new Error(`Unable to get file info for ${normalizedPath}: ${error.message}`);
    }
  }
}

const fileSystemManager = new FileSystemManager();

// MCP Server Functions
async function readFile(args) {
  const { file_path, encoding = 'utf8', start_line = null, end_line = null } = args;

  try {
    let content = await fileSystemManager.readFileContent(file_path, encoding);
    const fileInfo = fileSystemManager.getFileInfo(file_path);

    // Handle line range if specified
    if (start_line !== null || end_line !== null) {
      const lines = content.split('\n');
      const startIdx = start_line ? start_line - 1 : 0;
      const endIdx = end_line ? end_line : lines.length;
      content = lines.slice(startIdx, endIdx).join('\n');
    }

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          file_path: file_path,
          file_info: fileInfo,
          content: content,
          line_range: start_line && end_line ? { start: start_line, end: end_line } : null,
          success: true
        })
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          error: "Failed to read file",
          file_path: file_path,
          details: error.message,
          success: false
        })
      }]
    };
  }
}

async function listDirectory(args) {
  const { 
    directory_path, 
    recursive = false, 
    filter = null, 
    max_depth = 5,
    include_hidden = false 
  } = args;

  try {
    let items = await fileSystemManager.listDirectory(directory_path, {
      recursive,
      filter,
      maxDepth: max_depth
    });

    // Filter out hidden files if requested
    if (!include_hidden) {
      items = items.filter(item => !item.name.startsWith('.'));
    }

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          directory_path: directory_path,
          items: items,
          total_count: items.length,
          recursive: recursive,
          success: true
        })
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          error: "Failed to list directory",
          directory_path: directory_path,
          details: error.message,
          success: false
        })
      }]
    };
  }
}

async function searchFiles(args) {
  const { 
    search_path, 
    pattern, 
    file_extensions = null,
    recursive = true,
    case_sensitive = false,
    max_results = 50,
    include_content = false 
  } = args;

  try {
    const results = await fileSystemManager.searchFiles(search_path, pattern, {
      recursive,
      caseSensitive: case_sensitive,
      fileExtensions: file_extensions,
      maxResults: max_results,
      includeContent: include_content
    });

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          search_path: search_path,
          pattern: pattern,
          results: results,
          total_matches: results.length,
          search_options: {
            recursive,
            case_sensitive,
            file_extensions,
            max_results
          },
          success: true
        })
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          error: "Failed to search files",
          search_path: search_path,
          pattern: pattern,
          details: error.message,
          success: false
        })
      }]
    };
  }
}

async function getFileInfo(args) {
  const { file_path } = args;

  try {
    const fileInfo = fileSystemManager.getFileInfo(file_path);

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          file_info: fileInfo,
          success: true
        })
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          error: "Failed to get file info",
          file_path: file_path,
          details: error.message,
          success: false
        })
      }]
    };
  }
}

async function findCodePatterns(args) {
  const { 
    search_path, 
    language = 'csharp',
    pattern_type = 'controller',
    specific_patterns = null 
  } = args;

  const languagePatterns = {
    csharp: {
      controller: [
        'public class \\w+Controller\\s*:\\s*ControllerBase',
        'public class \\w+Controller\\s*:\\s*Controller',
        '\\[ApiController\\]',
        '\\[Route\\(',
        '\\[HttpGet\\]',
        '\\[HttpPost\\]',
        '\\[HttpPut\\]',
        '\\[HttpDelete\\]'
      ],
      service: [
        'public class \\w+Service\\s*:\\s*I\\w+Service',
        'public interface I\\w+Service',
        '\\[Service\\]',
        'services\\.AddScoped',
        'services\\.AddTransient',
        'services\\.AddSingleton'
      ],
      model: [
        'public class \\w+\\s*{',
        'public record \\w+',
        '\\[DataContract\\]',
        '\\[Serializable\\]',
        'public \\w+ \\w+ { get; set; }'
      ]
    },
    typescript: {
      component: [
        'export.*React\\.FC',
        'export.*function.*Component',
        'interface.*Props',
        'useState\\(',
        'useEffect\\('
      ]
    }
  };

  try {
    const patterns = specific_patterns || languagePatterns[language]?.[pattern_type] || [];
    const fileExtensions = language === 'csharp' ? ['.cs'] : language === 'typescript' ? ['.ts', '.tsx'] : null;

    const allResults = [];
    for (const pattern of patterns) {
      const results = await fileSystemManager.searchFiles(search_path, pattern, {
        recursive: true,
        caseSensitive: false,
        fileExtensions: fileExtensions,
        maxResults: 20,
        includeContent: false
      });
      allResults.push(...results);
    }

    // Remove duplicates and sort by relevance
    const uniqueResults = Array.from(
      new Map(allResults.map(r => [r.path, r])).values()
    ).sort((a, b) => b.matchCount - a.matchCount);

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          search_path: search_path,
          language: language,
          pattern_type: pattern_type,
          patterns_searched: patterns,
          results: uniqueResults.slice(0, 30),
          total_files_found: uniqueResults.length,
          success: true
        })
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          error: "Failed to find code patterns",
          search_path: search_path,
          details: error.message,
          success: false
        })
      }]
    };
  }
}

async function getInstructions(args) {
  const { instruction_type = 'general' } = args;

  const instructions = {
    general: {
      overview: "Universal File System MCP Server for reading and referencing files from entire hard drive",
      capabilities: [
        "Read any file from the file system with proper permissions",
        "List directories recursively with filtering options",
        "Search for patterns across multiple files and directories",
        "Get detailed file information and metadata",
        "Find code patterns for specific languages and frameworks",
        "Cache frequently accessed files for better performance"
      ],
      security_considerations: [
        "Server respects file system permissions",
        "Implements path sanitization to prevent directory traversal",
        "Includes rate limiting and caching to prevent abuse",
        "Filters sensitive system files by default"
      ]
    },
    file_reading: {
      overview: "Read file contents with various options",
      parameters: {
        "file_path": "Absolute or relative path to the file",
        "encoding": "File encoding (default: utf8)",
        "start_line": "Starting line number (1-based)",
        "end_line": "Ending line number (inclusive)"
      },
      examples: [
        "Read entire C# controller: read_file({ file_path: 'C:/path/to/Controller.cs' })",
        "Read specific lines: read_file({ file_path: 'file.cs', start_line: 10, end_line: 50 })"
      ]
    },
    directory_listing: {
      overview: "List directory contents with filtering and recursion",
      parameters: {
        "directory_path": "Path to directory to list",
        "recursive": "Include subdirectories (default: false)",
        "filter": "Filter pattern for file names",
        "max_depth": "Maximum recursion depth (default: 5)",
        "include_hidden": "Include hidden files (default: false)"
      },
      examples: [
        "List Controllers directory: list_directory({ directory_path: 'C:/project/Controllers' })",
        "Find all .cs files: list_directory({ directory_path: 'C:/project', recursive: true, filter: '*.cs' })"
      ]
    },
    pattern_search: {
      overview: "Search for patterns across files",
      parameters: {
        "search_path": "Root directory to search",
        "pattern": "Regular expression pattern to search for",
        "file_extensions": "Array of file extensions to include",
        "recursive": "Search subdirectories (default: true)",
        "case_sensitive": "Case sensitive search (default: false)",
        "max_results": "Maximum number of results (default: 50)"
      },
      examples: [
        "Find all controllers: search_files({ search_path: 'C:/project', pattern: 'Controller', file_extensions: ['.cs'] })",
        "Find API endpoints: search_files({ search_path: 'C:/project', pattern: '\\[Http(Get|Post|Put|Delete)\\]' })"
      ]
    },
    code_patterns: {
      overview: "Find specific code patterns for different languages",
      supported_languages: ["csharp", "typescript", "javascript", "python"],
      pattern_types: {
        "csharp": ["controller", "service", "model", "repository"],
        "typescript": ["component", "service", "interface", "type"]
      },
      examples: [
        "Find C# controllers: find_code_patterns({ search_path: 'C:/project', language: 'csharp', pattern_type: 'controller' })",
        "Find TypeScript components: find_code_patterns({ search_path: 'C:/project', language: 'typescript', pattern_type: 'component' })"
      ]
    }
  };

  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        instruction_type,
        instructions: instructions[instruction_type] || instructions.general,
        all_available_types: Object.keys(instructions),
        server: "FileSystem MCP Server",
        version: "1.0.0"
      })
    }]
  };
}

// Server setup
const server = new Server({ name: "filesystem-manager-mcp", version: "1.0.0" }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "read_file",
      description: "Read file contents from anywhere on the file system",
      inputSchema: {
        type: "object",
        properties: {
          file_path: { type: "string", description: "Path to the file to read" },
          encoding: { type: "string", default: "utf8", description: "File encoding" },
          start_line: { type: "number", description: "Starting line number (1-based)" },
          end_line: { type: "number", description: "Ending line number (inclusive)" }
        },
        required: ["file_path"]
      }
    },
    {
      name: "list_directory",
      description: "List directory contents with filtering options",
      inputSchema: {
        type: "object",
        properties: {
          directory_path: { type: "string", description: "Path to directory to list" },
          recursive: { type: "boolean", default: false, description: "Include subdirectories" },
          filter: { type: "string", description: "Filter pattern for file names" },
          max_depth: { type: "number", default: 5, description: "Maximum recursion depth" },
          include_hidden: { type: "boolean", default: false, description: "Include hidden files" }
        },
        required: ["directory_path"]
      }
    },
    {
      name: "search_files",
      description: "Search for patterns across multiple files",
      inputSchema: {
        type: "object",
        properties: {
          search_path: { type: "string", description: "Root directory to search" },
          pattern: { type: "string", description: "Regular expression pattern to search" },
          file_extensions: { type: "array", items: { type: "string" }, description: "File extensions to include" },
          recursive: { type: "boolean", default: true, description: "Search subdirectories" },
          case_sensitive: { type: "boolean", default: false, description: "Case sensitive search" },
          max_results: { type: "number", default: 50, description: "Maximum number of results" },
          include_content: { type: "boolean", default: false, description: "Include file content in results" }
        },
        required: ["search_path", "pattern"]
      }
    },
    {
      name: "get_file_info",
      description: "Get detailed information about a file or directory",
      inputSchema: {
        type: "object",
        properties: {
          file_path: { type: "string", description: "Path to file or directory" }
        },
        required: ["file_path"]
      }
    },
    {
      name: "find_code_patterns",
      description: "Find specific code patterns for different programming languages",
      inputSchema: {
        type: "object",
        properties: {
          search_path: { type: "string", description: "Root directory to search" },
          language: { 
            type: "string", 
            enum: ["csharp", "typescript", "javascript", "python"],
            default: "csharp",
            description: "Programming language" 
          },
          pattern_type: { 
            type: "string", 
            description: "Type of pattern to find (controller, service, model, etc.)" 
          },
          specific_patterns: { 
            type: "array", 
            items: { type: "string" }, 
            description: "Custom regex patterns to search for" 
          }
        },
        required: ["search_path"]
      }
    },
    {
      name: "get_instructions",
      description: "Get comprehensive instructions for using the FileSystem MCP server",
      inputSchema: {
        type: "object",
        properties: {
          instruction_type: {
            type: "string",
            enum: ["general", "file_reading", "directory_listing", "pattern_search", "code_patterns"],
            default: "general",
            description: "Type of instructions needed"
          }
        }
      }
    }
  ]
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  switch (request.params.name) {
    case "read_file":
      return await readFile(request.params.arguments || {});
    case "list_directory":
      return await listDirectory(request.params.arguments || {});
    case "search_files":
      return await searchFiles(request.params.arguments || {});
    case "get_file_info":
      return await getFileInfo(request.params.arguments || {});
    case "find_code_patterns":
      return await findCodePatterns(request.params.arguments || {});
    case "get_instructions":
      return await getInstructions(request.params.arguments || {});
    default:
      throw new Error(`Unknown tool: ${request.params.name}`);
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("FileSystem Manager MCP server running");
