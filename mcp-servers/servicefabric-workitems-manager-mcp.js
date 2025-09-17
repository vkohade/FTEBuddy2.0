#!/usr/bin/env node

/**
 * Clean ServiceFabric Work Items Manager MCP Server
 * Version: 2.0.0
 * Purpose: Provides .NET commands and natural language instructions for implementing
 *          work items in Service Fabric microservices using GitHub Copilot guidance
 */

import fs from 'fs';
import path from 'path';
import { execSync, spawn } from 'child_process';

// Configuration for Microsoft PowerApps CoreServices
const HIGHWAY_TEMPLATE_SOURCE = "https://pkgs.dev.azure.com/microsoft/PowerAppsServices/_packaging/OneESTemplate/nuget/v3/index.json";

// MCP Protocol Handler
process.stdin.on('data', async (data) => {
  try {
    const request = JSON.parse(data.toString());
    const response = await handleRequest(request);
    console.log(JSON.stringify(response));
  } catch (error) {
    console.log(JSON.stringify({
      jsonrpc: "2.0",
      id: null,
      error: {
        code: -32000,
        message: error.message
      }
    }));
  }
});

async function handleRequest(request) {
  const { method, params } = request;

  switch (method) {
    case 'initialize':
      return {
        jsonrpc: "2.0",
        id: request.id,
        result: {
          protocolVersion: "2024-11-05",
          capabilities: {
            tools: {}
          },
          serverInfo: {
            name: "servicefabric-workitems-manager-mcp",
            version: "2.0.0"
          }
        }
      };

    case 'tools/list':
      return {
        jsonrpc: "2.0",
        id: request.id,
        result: {
          tools: [
            {
              name: "create_solution",
              description: "Create PowerApps CoreServices microservice using official Microsoft templates (CAPCoreServices.Highway csapprepo)",
              inputSchema: {
                type: "object",
                properties: {
                  team_name: { type: "string", description: "Team/project name for the solution (required by Microsoft PowerApps CoreServices)" },
                  application_name: { type: "string", description: "Application name for PowerApps CoreServices project" },
                  service_name: { type: "string", description: "Service name for the microservice within the application" },
                  base_path: { type: "string", description: "Base directory path for project creation" },
                  dev_only: { type: "boolean", description: "Create dev-only environment (uses --devOnly flag)", default: false }
                },
                required: ["team_name", "application_name", "service_name", "base_path"]
              }
            },
            {
              name: "identify_required_controllers",
              description: "Analyze work items and provide natural language instructions for identifying controllers needed",
              inputSchema: {
                type: "object",
                properties: {
                  work_items_path: { type: "string", description: "Path to work-items.json file" },
                  project_path: { type: "string", description: "Path to the microservice project" },
                  application_name: { type: "string", description: "Service Fabric application name" },
                  service_name: { type: "string", description: "Microservice name" }
                },
                required: ["work_items_path", "project_path", "application_name", "service_name"]
              }
            },
            {
              name: "create_controllers",
              description: "Provide instructions for creating controllers following EchoController pattern",
              inputSchema: {
                type: "object",
                properties: {
                  project_path: { type: "string", description: "Path to the microservice project" },
                  application_name: { type: "string", description: "Service Fabric application name" },
                  service_name: { type: "string", description: "Microservice name" },
                  controller_names: { type: "array", items: { type: "string" }, description: "List of controller names to create" }
                },
                required: ["project_path", "application_name", "service_name", "controller_names"]
              }
            },
            {
              name: "implement_work_item",
              description: "Provide natural language instructions for implementing a specific work item across all relevant controllers",
              inputSchema: {
                type: "object",
                properties: {
                  work_item: { type: "object", description: "Work item object with requirements" },
                  project_path: { type: "string", description: "Path to the microservice project" },
                  quality_level: { type: "string", enum: ["basic", "production", "enterprise"], default: "production" }
                },
                required: ["work_item", "project_path"]
              }
            },
            {
              name: "build_and_validate",
              description: "Build the solution and provide guidance for fixing issues",
              inputSchema: {
                type: "object",
                properties: {
                  project_path: { type: "string", description: "Path to the microservice project" },
                  application_name: { type: "string", description: "Service Fabric application name" }
                },
                required: ["project_path", "application_name"]
              }
            },
            {
              name: "validate_implementation",
              description: "Validate that all work items are implemented and suggest missing functionality",
              inputSchema: {
                type: "object",
                properties: {
                  work_items_path: { type: "string", description: "Path to work-items.json file" },
                  project_path: { type: "string", description: "Path to the microservice project" },
                  application_name: { type: "string", description: "Service Fabric application name" },
                  service_name: { type: "string", description: "Microservice name" }
                },
                required: ["work_items_path", "project_path", "application_name", "service_name"]
              }
            },
            {
              name: "implement_all_work_items",
              description: "Systematically implement all work items from the JSON file, iterating through each epic, user story, and task",
              inputSchema: {
                type: "object",
                properties: {
                  work_items_path: { type: "string", description: "Path to work-items.json file (string, required)" },
                  project_path: { type: "string", description: "Path to the microservice project (string, required)" },
                  application_name: { type: "string", description: "Service Fabric application name (string, required)" },
                  service_name: { type: "string", description: "Microservice name (string, required)" },
                  quality_level: { type: "string", enum: ["basic", "production", "enterprise"], default: "production", description: "Code quality level for all implementations" }
                },
                required: ["work_items_path", "project_path", "application_name", "service_name"]
              }
            },
            {
              name: "get_instructions",
              description: "Get comprehensive instructions for all tools with input parameters",
              inputSchema: {
                type: "object",
                properties: {
                  tool_name: { type: "string", description: "Specific tool name or 'all' for all tools" }
                }
              }
            }
          ]
        }
      };

    case 'tools/call':
      const toolName = params.name;
      const args = params.arguments || {};

      switch (toolName) {
        case 'create_solution':
          return await createSolution(args, request.id);
        case 'identify_required_controllers':
          return await identifyRequiredControllers(args, request.id);
        case 'create_controllers':
          return await createControllers(args, request.id);
        case 'implement_work_item':
          return await implementWorkItem(args, request.id);
        case 'build_and_validate':
          return await buildAndValidate(args, request.id);
        case 'validate_implementation':
          return await validateImplementation(args, request.id);
        case 'implement_all_work_items':
          return await implementAllWorkItems(args, request.id);
        case 'get_instructions':
          return await getInstructions(args, request.id);
        default:
          throw new Error(`Unknown tool: ${toolName}`);
      }

    default:
      throw new Error(`Unknown method: ${method}`);
  }
}

// ============================================================================
// HELPER FUNCTIONS FOR MICROSOFT POWERAPPS CORESERVICES
// ============================================================================

async function executeDotnetCommand(command, workingDir = process.cwd()) {
  try {
    console.error(`Executing: dotnet ${command} in ${workingDir}`);
    const output = execSync(`dotnet ${command}`, { 
      cwd: workingDir, 
      stdio: 'pipe',
      encoding: 'utf8',
      timeout: 300000 // 5 minutes timeout
    });
    
    return {
      success: true,
      output: output.toString(),
      command: `dotnet ${command}`,
      workingDirectory: workingDir
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      stderr: error.stderr?.toString() || '',
      stdout: error.stdout?.toString() || '',
      command: `dotnet ${command}`,
      workingDirectory: workingDir
    };
  }
}

async function installHighwayTemplate() {
  try {
    // Check if template is already installed first
    try {
      const listResult = await executeDotnetCommand('new list');
      if (listResult && listResult.output && listResult.output.includes('csapprepo')) {
        return {
          success: true,
          message: "CAPCoreServices.Highway template already installed",
          output: "Template found in installed templates list"
        };
      }
    } catch (listError) {
      console.warn("Could not check existing templates, proceeding with installation...");
    }

    // Try non-interactive installation first (better for MCP servers)
    try {
      const nonInteractiveResult = await executeDotnetCommand(
        `new install CAPCoreServices.Highway --nuget-source "${HIGHWAY_TEMPLATE_SOURCE}"`
      );
      
      if (nonInteractiveResult && nonInteractiveResult.success) {
        return {
          success: true,
          message: "CAPCoreServices.Highway template installed successfully (non-interactive)",
          output: nonInteractiveResult.output
        };
      }
    } catch (nonInteractiveError) {
      console.warn("Non-interactive installation failed, trying interactive...");
    }

    // Fallback to interactive if non-interactive fails
    try {
      const interactiveResult = await executeDotnetCommand(
        `new install CAPCoreServices.Highway --nuget-source "${HIGHWAY_TEMPLATE_SOURCE}" --interactive`
      );
      
      if (interactiveResult && interactiveResult.success) {
        return {
          success: true,
          message: "CAPCoreServices.Highway template installed successfully (interactive)",
          output: interactiveResult.output
        };
      }
    } catch (interactiveError) {
      throw new Error(`Both installation methods failed. Interactive error: ${interactiveError.message || interactiveError}`);
    }

    throw new Error("Template installation failed - no successful installation method found");
  } catch (error) {
    throw new Error(`Failed to install Highway template: ${error.message}`);
  }
}

async function createCoreServicesApplication(teamName, applicationName, serviceName, outputPath, devOnly = false) {
  try {
    // Create nested microservices directory to avoid conflicting with existing code
    const microservicesPath = path.join(outputPath, 'microservices', `${applicationName}-CoreServices`);
    
    // Ensure nested output directory exists
    if (!fs.existsSync(microservicesPath)) {
      fs.mkdirSync(microservicesPath, { recursive: true });
    }

    // Build the command with parameters
    let command = `new csapprepo --teamName "${teamName}" --applicationName "${applicationName}" --serviceName "${serviceName}"`;
    
    if (devOnly) {
      command += ' --devOnly true';
    }

    // Create the application using the official template in nested directory
    const createResult = await executeDotnetCommand(command, microservicesPath);
    
    if (!createResult.success) {
      throw new Error(`Failed to create CoreServices application: ${createResult.error}`);
    }

    // IMMEDIATELY fix global.json SDK version to match installed SDK
    console.error(`Checking and fixing global.json SDK version...`);
    try {
      const globalJsonPath = path.join(microservicesPath, 'global.json');
      if (fs.existsSync(globalJsonPath)) {
        console.error(`Found global.json at: ${globalJsonPath}`);
        
        // Get installed SDKs
        const sdkListResult = await executeDotnetCommand('--list-sdks');
        if (sdkListResult.success && sdkListResult.output) {
          // Parse SDK versions more carefully - format is "8.0.414 [C:\Program Files\dotnet\sdk]"
          const sdkLines = sdkListResult.output.split('\n').filter(line => line.trim());
          const installedVersions = sdkLines.map(line => {
            const match = line.match(/^(\d+\.\d+\.\d+)/);
            return match ? match[1] : null;
          }).filter(version => version !== null);
          
          console.error(`Found installed SDK versions: ${installedVersions.join(', ')}`);
          
          if (installedVersions && installedVersions.length > 0) {
            // Use the latest installed version
            const latestVersion = installedVersions[installedVersions.length - 1];
            
            // Read and update global.json
            const globalJson = JSON.parse(fs.readFileSync(globalJsonPath, 'utf8'));
            const originalVersion = globalJson.sdk?.version;
            globalJson.sdk = globalJson.sdk || {};
            globalJson.sdk.version = latestVersion;
            
            // Write updated global.json
            fs.writeFileSync(globalJsonPath, JSON.stringify(globalJson, null, 2));
            console.error(`Updated global.json SDK version from ${originalVersion} to ${latestVersion}`);
            
            // Verify the update worked
            const verifyGlobalJson = JSON.parse(fs.readFileSync(globalJsonPath, 'utf8'));
            console.error(`Verified global.json now contains SDK version: ${verifyGlobalJson.sdk?.version}`);
          } else {
            console.warn('Could not detect installed SDK versions');
          }
        } else {
          console.warn('Failed to get SDK list');
        }
      } else {
        console.error('global.json not found - template may not have created it');
      }
    } catch (globalJsonError) {
      console.warn(`Warning: Could not update global.json: ${globalJsonError.message}`);
    }

    return {
      success: true,
      path: microservicesPath,
      structure: {
        solutionPath: path.join(microservicesPath, 'src', `${applicationName}.sln`),
        applicationPath: path.join(microservicesPath, 'src', applicationName),
        servicePath: path.join(microservicesPath, 'src', applicationName, serviceName),
        testPath: path.join(microservicesPath, 'src', 'Tests', `${applicationName}.UnitTests`)
      },
      output: createResult.output,
      microservicesDirectory: microservicesPath
    };
  } catch (error) {
    throw new Error(`Failed to create CoreServices application: ${error.message}`);
  }
}

async function initializeGitRepository(projectPath) {
  try {
    // Initialize git repository
    await new Promise((resolve, reject) => {
      const gitInit = spawn('git', ['init'], { cwd: projectPath, stdio: 'pipe' });
      gitInit.on('close', (code) => code === 0 ? resolve() : reject(new Error('git init failed')));
    });
    
    // Add all files
    await new Promise((resolve, reject) => {
      const gitAdd = spawn('git', ['add', '*'], { cwd: projectPath, stdio: 'pipe' });
      gitAdd.on('close', (code) => code === 0 ? resolve() : reject(new Error('git add failed')));
    });
    
    // Make initial commit
    await new Promise((resolve, reject) => {
      const gitCommit = spawn('git', ['commit', '-m', 'initial commit'], { cwd: projectPath, stdio: 'pipe' });
      gitCommit.on('close', (code) => code === 0 ? resolve() : reject(new Error('git commit failed')));
    });
    
    return {
      success: true,
      message: "Git repository initialized successfully"
    };
  } catch (error) {
    throw new Error(`Failed to initialize git repository: ${error.message}`);
  }
}

function sanitizeName(name) {
  return name.replace(/[^a-zA-Z0-9]/g, '');
}

// ============================================================================
// TOOL 0: Solution Generation (Updated with proper Microsoft PowerApps CoreServices setup)
// ============================================================================

async function createSolution(args, requestId) {
  const { team_name, application_name, service_name, base_path, dev_only = false } = args;

  try {
    // Validate required parameters for Microsoft PowerApps CoreServices
    if (!team_name || !application_name || !service_name) {
      throw new Error('team_name, application_name, and service_name are required for PowerApps CoreServices microservice creation');
    }

    const sanitizedTeamName = sanitizeName(team_name);
    const sanitizedApplicationName = sanitizeName(application_name);
    const sanitizedServiceName = sanitizeName(service_name);

    // Create project directory
    const projectPath = path.join(base_path, sanitizedApplicationName);

    // Step 1: Install Highway template package (official Microsoft PowerApps CoreServices)
    console.error(`Installing CAPCoreServices.Highway template...`);
    const templateInstallResult = await installHighwayTemplate();
    
    if (!templateInstallResult.success) {
      throw new Error(`Failed to install Highway template: ${templateInstallResult.error}`);
    }

    // Step 2: Create CoreServices application using official csapprepo template
    console.error(`Creating CoreServices application: ${sanitizedApplicationName}`);
    const applicationResult = await createCoreServicesApplication(
      sanitizedTeamName,
      sanitizedApplicationName, 
      sanitizedServiceName,
      projectPath,
      dev_only
    );

    if (!applicationResult.success) {
      throw new Error(`Failed to create CoreServices application: ${applicationResult.error}`);
    }

    // Step 3: Initialize git repository as required by Microsoft documentation
    console.error(`Initializing git repository...`);
    const gitResult = await initializeGitRepository(projectPath);
    
    if (!gitResult.success) {
      console.warn(`Warning: Could not initialize git repository: ${gitResult.error}`);
    }

    // Optional: Build the project to verify it works
    try {
      console.error(`Restoring project packages...`);
      const buildResult = await executeDotnetCommand('restore dirs.proj', projectPath);
      if (buildResult.success) {
        console.error('Project restored successfully');
      }
    } catch (error) {
      console.warn(`Warning: Could not restore project: ${error.message}`);
    }

    const result = {
      success: true,
      message: "PowerApps CoreServices microservice created successfully using official Microsoft templates",
      team_name: sanitizedTeamName,
      application_name: sanitizedApplicationName,
      service_name: sanitizedServiceName,
      project_path: projectPath,
      structure: applicationResult.structure,
      template_installed: templateInstallResult.message,
      git_initialized: gitResult?.success || false,
      files_structure: {
        solution: `src/${sanitizedApplicationName}.sln`,
        service_project: `src/${sanitizedApplicationName}/${sanitizedServiceName}/${sanitizedApplicationName}.${sanitizedServiceName}.csproj`,
        controller: `src/${sanitizedApplicationName}/${sanitizedServiceName}/Controllers/EchoController.cs`,
        program: `src/${sanitizedApplicationName}/${sanitizedServiceName}/Program.cs`,
        startup: `src/${sanitizedApplicationName}/${sanitizedServiceName}/Startup.cs`,
        unit_tests: `src/Tests/${sanitizedApplicationName}.UnitTests/${sanitizedApplicationName}.UnitTests.csproj`,
        pipelines: '.pipelines/OneBranch.Official.yml'
      },
      next_steps: [
        "1. Replace placeholder values in ApplicationParameters.json (RolloutSpecNotifyEmail)",
        "2. Replace placeholder values in DeploymentDefinition.json (serviceTreeId, icmPath, acisClaimsAllowlist)",
        "3. Run 'dotnet restore dirs.proj' to restore packages",
        "4. Run 'dotnet build dirs.proj -c release' to build the solution",
        "5. Follow deployment guide to deploy to PowerApps CoreServices Platform"
      ],
      official_microsoft_commands_used: {
        template_install: `dotnet new install CAPCoreServices.Highway --nuget-source "${HIGHWAY_TEMPLATE_SOURCE}" --interactive`,
        project_create: `dotnet new csapprepo --teamName "${sanitizedTeamName}" --applicationName "${sanitizedApplicationName}" --serviceName "${sanitizedServiceName}"${dev_only ? ' --devOnly true' : ''}`
      }
    };

    return {
      jsonrpc: "2.0",
      id: requestId,
      result: { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] }
    };

  } catch (error) {
    return {
      jsonrpc: "2.0",
      id: requestId,
      result: { 
        content: [{ 
          type: "text", 
          text: JSON.stringify({ 
            success: false, 
            error: error.message,
            details: "Failed to create PowerApps CoreServices solution"
          }, null, 2) 
        }] 
      }
    };
  }
}



// ============================================================================
// TOOL 1: Identify Required Controllers
// ============================================================================

async function identifyRequiredControllers(args, requestId) {
  const { work_items_path, project_path, application_name, service_name } = args;

  try {
    // Load work items
    if (!fs.existsSync(work_items_path)) {
      throw new Error(`Work items file not found: ${work_items_path}`);
    }

    const workItems = JSON.parse(fs.readFileSync(work_items_path, 'utf8'));
    
    const instructions = [
      "🎯 CONTROLLER IDENTIFICATION INSTRUCTIONS:",
      "",
      "OBJECTIVE: Identify the API endpoints which would be called from the frontend and consolidate them into separate controllers within the microservice. If there are similar API endpoints, consolidate them into one controller with different endpoints.",
      "",
      "ANALYSIS STEPS:",
      "1. Review all epics, user stories, and tasks in the work items",
      "2. Identify frontend interactions and data requirements",
      "3. Group related functionality into logical controller categories",
      "4. Ensure each controller has a clear, single responsibility",
      "",
      "CONTROLLER NAMING GUIDELINES:",
      "- Use descriptive names that reflect business functionality",
      "- Follow PascalCase naming convention",
      "- Avoid generic names like 'DataController' or 'ApiController'",
      "- Examples: UserManagementController, ReportingController, AnalyticsController",
      "",
      "CONSOLIDATION RULES:",
      "- Group CRUD operations for the same entity into one controller",
      "- Separate read-heavy operations from write-heavy operations if needed",
      "- Keep authentication/authorization endpoints separate",
      "- Separate real-time data endpoints from batch processing endpoints",
      "",
      "RECOMMENDED APPROACH:",
      "1. Create a list of all data entities mentioned in work items",
      "2. Create a list of all operations (Create, Read, Update, Delete, Calculate, etc.)",
      "3. Group entities and operations into logical business domains",
      "4. Create one controller per business domain",
      "5. Ensure each controller doesn't exceed 10-15 endpoints",
      "",
      `WORK ITEMS SUMMARY:`,
      `- Epics: ${workItems.epics?.length || 0}`,
      `- User Stories: ${workItems.userStories?.length || 0}`,
      `- Tasks: ${workItems.tasks?.length || 0}`,
      "",
      "NEXT STEPS:",
      "1. Analyze the work items using the guidelines above",
      "2. Create a list of proposed controller names",
      "3. Use the 'create_controllers' tool with the identified controller names",
      "4. Follow the EchoController pattern for implementation"
    ];

    const result = {
      success: true,
      instructions: instructions,
      work_items_summary: {
        epics: workItems.epics?.length || 0,
        user_stories: workItems.userStories?.length || 0,
        tasks: workItems.tasks?.length || 0
      },
      sample_epic_titles: workItems.epics?.slice(0, 3).map(epic => epic.title) || [],
      next_tool: "create_controllers"
    };

    return {
      jsonrpc: "2.0",
      id: requestId,
      result: { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] }
    };

  } catch (error) {
    return {
      jsonrpc: "2.0",
      id: requestId,
      result: { 
        content: [{ 
          type: "text", 
          text: JSON.stringify({ 
            success: false, 
            error: error.message 
          }, null, 2) 
        }] 
      }
    };
  }
}

// ============================================================================
// TOOL 2: Create Controllers
// ============================================================================

async function createControllers(args, requestId) {
  const { project_path, application_name, service_name, controller_names } = args;

  try {
    const servicePath = path.join(project_path, application_name, 'microservices', `${application_name}-CoreServices`, 'src', application_name, service_name);
    const controllersPath = path.join(servicePath, 'Controllers');
    const echoControllerPath = path.join(controllersPath, 'EchoController.cs');

    // Verify EchoController exists
    if (!fs.existsSync(echoControllerPath)) {
      throw new Error(`EchoController not found at: ${echoControllerPath}. Please run create_solution first.`);
    }

    const instructions = [
      "🏗️ CONTROLLER CREATION INSTRUCTIONS:",
      "",
      "OBJECTIVE: Create controllers following the pattern from the EchoController which is auto-generated by the dotnet commands for microservice setup.",
      "",
      `TARGET CONTROLLERS TO CREATE: ${controller_names.join(', ')}`,
      "",
      "IMPLEMENTATION STEPS:",
      "1. Examine the EchoController.cs file structure and patterns",
      "2. Copy the EchoController structure for each new controller",
      "3. Follow the same namespace, using statements, and base class patterns",
      "4. Maintain the same logging, dependency injection, and error handling patterns",
      "",
      "CONTROLLER TEMPLATE STRUCTURE:",
      "- Use the same namespace as EchoController",
      "- Import the same using statements",
      "- Inherit from the same base controller class",
      "- Use constructor dependency injection for ILogger",
      "- Follow the same async/await patterns",
      "- Use the same response models and status codes",
      "",
      "NAMING CONVENTIONS:",
      "- Controller class: [Name]Controller (e.g., UserManagementController)",
      "- File name: [Name]Controller.cs",
      "- Route prefix: [Route(\"api/[controller]\")]",
      "- Method names: descriptive action names (Get, Post, Put, Delete + context)",
      "",
      "STANDARD ENDPOINTS TO INCLUDE:",
      "- GET api/[controller]/status (health check)",
      "- GET api/[controller] (list/search)",
      "- GET api/[controller]/{id} (get by id)",
      "- POST api/[controller] (create)",
      "- PUT api/[controller]/{id} (update)",
      "- DELETE api/[controller]/{id} (delete)",
      "",
      "ERROR HANDLING PATTERN:",
      "- Follow EchoController error handling patterns",
      "- Use appropriate HTTP status codes",
      "- Include structured logging for all operations",
      "- Return consistent error response formats",
      "",
      `ECHO CONTROLLER LOCATION: ${echoControllerPath}`,
      `CONTROLLERS DIRECTORY: ${controllersPath}`,
      "",
      "NEXT STEPS:",
      "1. Study the EchoController implementation",
      "2. Create each controller following the same patterns",
      "3. Use the 'implement_work_item' tool to add specific business logic"
    ];

    const result = {
      success: true,
      instructions: instructions,
      controllers_to_create: controller_names,
      echo_controller_path: echoControllerPath,
      target_directory: controllersPath,
      next_tool: "implement_work_item"
    };

    return {
      jsonrpc: "2.0",
      id: requestId,
      result: { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] }
    };

  } catch (error) {
    return {
      jsonrpc: "2.0",
      id: requestId,
      result: { 
        content: [{ 
          type: "text", 
          text: JSON.stringify({ 
            success: false, 
            error: error.message 
          }, null, 2) 
        }] 
      }
    };
  }
}

// ============================================================================
// TOOL 3: Implement Work Item
// ============================================================================

async function implementWorkItem(args, requestId) {
  const { work_item, project_path, quality_level = 'production' } = args;

  try {

    const qualityInstructions = {
      basic: [
        "- Use async/await patterns for all I/O operations",
        "- Add basic try-catch error handling",
        "- Validate required input parameters",
        "- Return appropriate HTTP status codes (200, 400, 500)",
        "- Use standard response models"
      ],
      production: [
        "- Add comprehensive structured logging with correlation IDs",
        "- Implement detailed error handling with specific exception types",
        "- Add input validation with detailed error messages",
        "- Use proper HTTP status codes (200, 400, 401, 403, 404, 500)",
        "- Add XML documentation comments for all public methods",
        "- Implement proper async/await patterns throughout",
        "- Add response caching headers where appropriate",
        "- Handle edge cases and null reference scenarios"
      ],
      enterprise: [
        "- Add distributed caching with configurable expiration",
        "- Implement comprehensive metrics collection and monitoring",
        "- Add authentication and authorization checks",
        "- Include rate limiting and throttling protection",
        "- Add circuit breaker patterns for external dependencies",
        "- Implement comprehensive request/response validation",
        "- Add performance monitoring with execution timing",
        "- Include security headers and OWASP compliance",
        "- Generate unit test stubs with test scenarios",
        "- Add health check endpoints for service monitoring",
        "- Implement correlation IDs for distributed tracing"
      ]
    };

    const instructions = [
      "⚙️ WORK ITEM IMPLEMENTATION INSTRUCTIONS:",
      "",
      "OBJECTIVE: Implement work item in the most appropriate controllers following good code practices, error handling, logging, etc.",
      "",
      `WORK ITEM: ${work_item.title || work_item.id}`,
      `QUALITY LEVEL: ${quality_level.toUpperCase()}`,
      "",
      "WORK ITEM DETAILS:",
      `- ID: ${work_item.id || 'N/A'}`,
      `- Title: ${work_item.title || 'N/A'}`,
      `- Description: ${work_item.description || work_item.purpose || 'N/A'}`,
      `- Implementation Details: ${work_item.implementation_details || 'N/A'}`,
      "",
    
      "IMPLEMENTATION REQUIREMENTS:",
      `1. Extract business logic requirements from: ${work_item.description || work_item.title}`,
      `2. Create appropriate HTTP endpoints based on: ${work_item.acceptance_criteria?.join(', ') || 'RESTful patterns'}`,
      `3. Implement validation rules for: ${work_item.tasks?.map(t => t.title).join(', ') || 'input parameters'}`,
      `4. Add business methods to handle: ${work_item.tasks?.length || 0} tasks`,
      "",
      "",
      "IMPLEMENTATION STEPS:",
      "1. **ANALYZE**: Read the work item details and determine which files need to be modified",
      "2. **SELECT**: Choose the appropriate files and projects based on the functionality described",
      "3. **IMPLEMENT**: ",
      "   b. Add new endpoints / controllers if required, otherwise modify the implementation of existing ones based on work item requirements",
      "   c. Implement business logic following the work item acceptance criteria",
      "   d. Add appropriate request/response models if needed",
      "4. **TEST**: Test the implementation locally",
      "",
      "ENDPOINT DESIGN GUIDELINES:",
      "- Use RESTful URL patterns",
      "- Include proper HTTP verbs (GET, POST, PUT, DELETE)",
      "- Add meaningful route parameters",
      "- Return consistent response formats",
      "- Include appropriate status codes",
      "",
      "ERROR HANDLING REQUIREMENTS:",
      "- Catch and handle all exceptions appropriately",
      "- Log errors with sufficient context",
      "- Return user-friendly error messages",
      "- Use problem details format for errors",
      "- Include correlation IDs for tracking",
      "",
      "TESTING CONSIDERATIONS:",
      "- Test happy path scenarios",
      "- Test error conditions",
      "- Test input validation",
      "- Test edge cases",
      "- Verify logging output",
      "",
      "NEXT STEPS:",
      "2. Use 'build_and_validate' tool to verify implementation",
      "3. Continue with remaining todos for the other tasks, keep iterating until all todos are completed",
    ];

    const result = {
      success: true,
      instructions: instructions,
      work_item_summary: {
        id: work_item.id,
        title: work_item.title,
        epic_id: work_item.epic_id,
        tasks_count: work_item.tasks?.length || 0
      },
    quality_level: quality_level,
      next_tool: "implement_work_item",
    };

    return {
      jsonrpc: "2.0",
      id: requestId,
      result: { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] }
    };

  } catch (error) {
    return {
      jsonrpc: "2.0",
      id: requestId,
      result: { 
        content: [{ 
          type: "text", 
          text: JSON.stringify({ 
            success: false, 
            error: error.message 
          }, null, 2) 
        }] 
      }
    };
  }
}

// ============================================================================
// TOOL 4: Build and Validate
// ============================================================================

async function buildAndValidate(args, requestId) {
  const { project_path, application_name } = args;

  try {
    const microservicePath = path.join(project_path, application_name, 'microservices', `${application_name}-CoreServices`);
    
    if (!fs.existsSync(microservicePath)) {
      throw new Error(`Microservice path not found: ${microservicePath}`);
    }

    const instructions = [
      "🔨 BUILD AND VALIDATION INSTRUCTIONS:",
      "",
      "OBJECTIVE: Build the solution and provide guidance for fixing issues.",
      "",
      "BUILD PROCESS:",
      "1. Navigate to the microservice directory",
      "2. Run 'dotnet restore' to restore NuGet packages",
      "3. Run 'dotnet build' to compile the solution",
      "4. Address any compilation errors",
      "5. Run 'dotnet test' if tests exist",
      "",
      "COMMON BUILD ISSUES AND SOLUTIONS:",
      "",
      "MISSING USING STATEMENTS:",
      "- Add 'using Microsoft.AspNetCore.Mvc;' for controller attributes",
      "- Add 'using Microsoft.Extensions.Logging;' for logging",
      "- Add 'using System.ComponentModel.DataAnnotations;' for validation",
      "",
      "COMPILATION ERRORS:",
      "- Check method signatures match interface contracts",
      "- Ensure all async methods return Task or Task<T>",
      "- Verify all using statements are present",
      "- Check for typos in class and method names",
      "",
      "DEPENDENCY INJECTION ISSUES:",
      "- Ensure services are registered in Program.cs or Startup.cs",
      "- Check constructor parameter types match registered services",
      "- Verify interface implementations are complete",
      "",
      "MODEL VALIDATION ERRORS:",
      "- Ensure all required properties have validation attributes",
      "- Check that model classes are properly structured",
      "- Verify JSON serialization attributes if needed",
      "",
      "BUILD COMMANDS TO RUN:",
      `cd "${microservicePath}"`,
      "dotnet restore",
      "dotnet build",
      "dotnet test (if tests exist)",
      "",
      "ERROR ANALYSIS STEPS:",
      "1. Read the build output carefully",
      "2. Identify the root cause of each error",
      "3. Fix errors starting with the first one listed",
      "4. Rebuild after each fix to see progress",
      "5. Use IntelliSense in VS Code for syntax help",
      "",
      "VALIDATION CHECKS:",
      "- All controllers compile without errors",
      "- All endpoints are accessible via HTTP",
      "- Request/response models serialize correctly",
      "- Dependency injection works properly",
      "- Logging outputs meaningful information",
      "",
      `BUILD DIRECTORY: ${microservicePath}`,
      "",
      "NEXT STEPS:",
      "1. Run the build commands above",
      "2. Fix any compilation errors",
      "3. Go back to the 'implement_work_item' tool and implement all the remaining work items"
    ];

    const result = {
      success: true,
      instructions: instructions,
      build_directory: microservicePath,
      build_commands: [
        "dotnet restore",
        "dotnet build",
        "dotnet test"
      ],
      next_tool: "implement_work_item"
    };

    return {
      jsonrpc: "2.0",
      id: requestId,
      result: { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] }
    };

  } catch (error) {
    return {
      jsonrpc: "2.0",
      id: requestId,
      result: { 
        content: [{ 
          type: "text", 
          text: JSON.stringify({ 
            success: false, 
            error: error.message 
          }, null, 2) 
        }] 
      }
    };
  }
}

// ============================================================================
// TOOL 5: Validate Implementation
// ============================================================================

async function validateImplementation(args, requestId) {
  const { work_items_path, project_path, application_name, service_name } = args;

  try {
    // Load work items
    if (!fs.existsSync(work_items_path)) {
      throw new Error(`Work items file not found: ${work_items_path}`);
    }

    const workItems = JSON.parse(fs.readFileSync(work_items_path, 'utf8'));
    const servicePath = path.join(project_path, application_name, 'microservices', `${application_name}-CoreServices`, 'src', application_name, service_name);
    const controllersPath = path.join(servicePath, 'Controllers');

    // Check if controllers directory exists
    let existingControllers = [];
    if (fs.existsSync(controllersPath)) {
      existingControllers = fs.readdirSync(controllersPath)
        .filter(file => file.endsWith('.cs'))
        .map(file => file.replace('.cs', ''));
    }

    const instructions = [
      "✅ IMPLEMENTATION VALIDATION INSTRUCTIONS:",
      "",
      "OBJECTIVE: Validate that all work items are implemented and suggest missing functionality.",
      "",
      `WORK ITEMS SUMMARY:`,
      `- Epics: ${workItems.epics?.length || 0}`,
      `- User Stories: ${workItems.userStories?.length || 0}`,
      `- Tasks: ${workItems.tasks?.length || 0}`,
      "",
      `EXISTING CONTROLLERS: ${existingControllers.join(', ')}`,
      "",
      "VALIDATION CHECKLIST:",
      "",
      "1. EPIC COVERAGE:",
      "   - Review each epic to ensure user stories address all requirements",
      "   - Verify that epic acceptance criteria are met",
      "   - Check that all epic deliverables are implemented",
      "",
      "2. USER STORY IMPLEMENTATION:",
      "   - Each user story should map to specific controller endpoints",
      "   - Verify acceptance criteria are translated into working features",
      "   - Check that user story dependencies are resolved",
      "",
      "3. TASK COMPLETION:",
      "   - Each task should result in specific code implementation",
      "   - Verify technical tasks are properly implemented",
      "   - Check that all task deliverables exist",
      "",
      "4. API ENDPOINT COVERAGE:",
      "   - Ensure all required CRUD operations are implemented",
      "   - Verify business logic endpoints exist",
      "   - Check that all data retrieval needs are met",
      "",
      "5. DATA MODEL COMPLETENESS:",
      "   - Verify all required data models exist",
      "   - Check that model relationships are properly defined",
      "   - Ensure validation rules are implemented",
      "",
      "6. ERROR HANDLING COVERAGE:",
      "   - Check that all endpoints have proper error handling",
      "   - Verify logging is implemented consistently",
      "   - Ensure user-friendly error messages exist",
      "",
      "MISSING FUNCTIONALITY ANALYSIS:",
      "1. Compare work item requirements with implemented endpoints",
      "2. Identify gaps in functionality",
      "3. List missing controllers or endpoints",
      "4. Note incomplete business logic implementations",
      "",
      "QUALITY ASSURANCE CHECKS:",
      "- All controllers follow consistent patterns",
      "- HTTP status codes are used appropriately",
      "- Request/response models are properly structured",
      "- Documentation is adequate",
      "- Code follows naming conventions",
      "",
      "RE-IMPLEMENTATION GUIDANCE:",
      "If missing functionality is found:",
      "1. Use 'identify_required_controllers' for missing controllers",
      "2. Use 'create_controllers' for new controllers needed",
      "3. Use 'implement_work_item' for incomplete work items",
      "4. Use 'build_and_validate' after changes",
      "",
      "COMPLETION CRITERIA:",
      "- All epics have corresponding implementations",
      "- All user stories map to working endpoints",
      "- All tasks result in actual code artifacts",
      "- Solution builds without errors",
      "- All endpoints respond with expected data structures"
    ];

    const result = {
      success: true,
      instructions: instructions,
      validation_summary: {
        epics: workItems.epics?.length || 0,
        user_stories: workItems.userStories?.length || 0,
        tasks: workItems.tasks?.length || 0,
        existing_controllers: existingControllers.length
      },
      existing_controllers: existingControllers,
      controllers_path: controllersPath,
      next_tool: "implement_work_item"
    };

    return {
      jsonrpc: "2.0",
      id: requestId,
      result: { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] }
    };

  } catch (error) {
    return {
      jsonrpc: "2.0",
      id: requestId,
      result: { 
        content: [{ 
          type: "text", 
          text: JSON.stringify({ 
            success: false, 
            error: error.message 
          }, null, 2) 
        }] 
      }
    };
  }
}

// ============================================================================
// TOOL 6: Implement All Work Items Systematically
// ============================================================================

async function implementAllWorkItems(args, requestId) {
  const { work_items_path, project_path, application_name, service_name, quality_level = 'production' } = args;

  try {
    // Load work items
    if (!fs.existsSync(work_items_path)) {
      throw new Error(`Work items file not found: ${work_items_path}`);
    }

    const workItems = JSON.parse(fs.readFileSync(work_items_path, 'utf8'));
    console.error(`Starting systematic implementation of all work items...`);
    
    let totalWorkItems = 0;
    const todoItems = [];
    let todoId = 1;
    

    // Create todo items for all work items
    if (workItems.epics && workItems.epics.length > 0) {
      for (const epic of workItems.epics) {
        
        // Create todos for user stories within this epic
        if (epic.user_stories && epic.user_stories.length > 0) {
          for (const userStory of epic.user_stories) {
            
            
            // Create todos for tasks within this user story
            if (userStory.tasks && userStory.tasks.length > 0) {
              for (const task of userStory.tasks) {
                todoItems.push({
                  id: todoId++,
                  title: `Implement Task ${task.id}`,
                  description: `Execute implement_work_item tool for Task ${task.id} (${task.title}) with production quality level. Work item details: ${JSON.stringify({work_item: task, project_path, quality_level})}`,
                  status: "not-started",
                  work_item_type: "task",
                  work_item: task,
                  epic_id: epic.id,
                  user_story_id: userStory.id,
                  mcp_tool_call: {
                    method: "tools/call",
                    params: {
                      name: "implement_work_item",
                      arguments: {
                        work_item: task,
                        project_path: project_path,
                        quality_level: quality_level
                      }
                    }
                  }
                });
                totalWorkItems++;
              }
            }
          }
        }
      }
    }

    const result = {
      success: true,
      message: `Created ${totalWorkItems} todo items for systematic work item implementation`,
      total_work_items: totalWorkItems,
      todo_items: todoItems,
      implementation_strategy: "Each todo item contains an MCP tool call to execute implement_work_item for individual work items",
      next_steps: [
        "The agent should create and execute these todo items one by one",
        "Each todo will call the implement_work_item tool via MCP protocol",
        "This ensures proper separation and individual processing of each work item",
        "After all todos are completed, use 'build_and_validate' tool to test implementation"
      ],
      instructions_for_agent: {
        approach: "Create and execute each todo item individually",
        execution_method: "Use the mcp_tool_call data in each todo to execute implement_work_item tool",
        quality_assurance: "Each work item will be processed with detailed instructions and proper controller assignment",
        validation: "After all todos are completed, run build_and_validate to ensure everything compiles"
      }
    };

    return {
      jsonrpc: "2.0",
      id: requestId,
      result: { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] },

    };

  } catch (error) {
    return {
      jsonrpc: "2.0",
      id: requestId,
      result: { 
        content: [{ 
          type: "text", 
          text: JSON.stringify({ 
            success: false, 
            error: error.message,
            details: "Failed to create todo items for work item implementation"
          }, null, 2) 
        }] 
      }
    };
  }
}



async function generateWorkItemInstructions(workItem, targetController, qualityLevel) {
  // Generate specific implementation instructions for this work item
  const instructions = [
    `WORK ITEM: ${workItem.title || workItem.id}`,
    `TARGET CONTROLLER: ${targetController}Controller`,
    `QUALITY LEVEL: ${qualityLevel.toUpperCase()}`,
    `DESCRIPTION: ${workItem.description || 'No description provided'}`,
    `PURPOSE: ${workItem.purpose || 'Implementation required'}`,
    ""
  ];

  if (workItem.acceptance_criteria && workItem.acceptance_criteria.length > 0) {
    instructions.push("ACCEPTANCE CRITERIA:");
    workItem.acceptance_criteria.forEach((criteria, index) => {
      instructions.push(`${index + 1}. ${criteria}`);
    });
    instructions.push("");
  }

  if (workItem.implementation_details) {
    instructions.push("IMPLEMENTATION DETAILS:");
    instructions.push(workItem.implementation_details);
    instructions.push("");
  }

  instructions.push("IMPLEMENTATION APPROACH:");
  instructions.push(`1. Add endpoint to ${targetController}Controller`);
  instructions.push("2. Follow existing controller patterns");
  instructions.push("3. Include proper error handling and logging");
  instructions.push("4. Add appropriate request/response models");
  instructions.push("5. Implement business logic as per requirements");

  return {
    instructions: instructions.join('\n'),
    summary: `${workItem.title || workItem.id} → ${targetController}Controller (${qualityLevel})`
  };
}

// ============================================================================
// TOOL 7: Get Instructions
// ============================================================================

async function getInstructions(args, requestId) {
  const { tool_name = 'all' } = args;

  const toolInstructions = {
    create_solution: {
      description: "Create Service Fabric application and microservice using official .NET templates",
      input_parameters: {
        team_name: "Team/project name for the solution (string, required)",
        application_name: "Service Fabric application name (string, required)",
        service_name: "Microservice name within the application (string, required)",
        base_path: "Base directory path for project creation (string, required)"
      },
      example: {
        team_name: "KPIDashboard",
        application_name: "DashWorkItems",
        service_name: "KPIService",
        base_path: "C:\\repos\\FTEBuddy2.0"
      }
    },
    identify_required_controllers: {
      description: "Analyze work items and provide natural language instructions for identifying controllers needed",
      input_parameters: {
        work_items_path: "Path to work-items.json file (string, required)",
        project_path: "Path to the microservice project (string, required)",
        application_name: "Service Fabric application name (string, required)",
        service_name: "Microservice name (string, required)"
      },
      example: {
        work_items_path: "C:\\repos\\FTEBuddy2.0\\work-items.json",
        project_path: "C:\\repos\\FTEBuddy2.0",
        application_name: "DashWorkItems",
        service_name: "KPIService"
      }
    },
    create_controllers: {
      description: "Provide instructions for creating controllers following EchoController pattern",
      input_parameters: {
        project_path: "Path to the microservice project (string, required)",
        application_name: "Service Fabric application name (string, required)",
        service_name: "Microservice name (string, required)",
        controller_names: "List of controller names to create (array of strings, required)"
      },
      example: {
        project_path: "C:\\repos\\FTEBuddy2.0",
        application_name: "DashWorkItems",
        service_name: "KPIService",
        controller_names: ["ConversionRatio", "Revenue", "Dashboard"]
      }
    },
    implement_work_item: {
      description: "Provide natural language instructions for implementing a specific work item",
      input_parameters: {
        work_item: "Work item object with requirements (object, required)",
        project_path: "Path to the microservice project (string, required)",
        target_controller: "Target controller name for implementation (string, required)",
        quality_level: "Code quality level: basic, production, enterprise (string, optional, default: production)"
      },
      example: {
        work_item: { "id": "US-E2-1", "title": "Conversion Ratio Calculation" },
        project_path: "C:\\repos\\FTEBuddy2.0",
        target_controller: "ConversionRatio",
        quality_level: "production"
      }
    },
    build_and_validate: {
      description: "Build the solution and provide guidance for fixing issues",
      input_parameters: {
        project_path: "Path to the microservice project (string, required)",
        application_name: "Service Fabric application name (string, required)"
      },
      example: {
        project_path: "C:\\repos\\FTEBuddy2.0",
        application_name: "DashWorkItems"
      }
    },
    validate_implementation: {
      description: "Validate that all work items are implemented and suggest missing functionality",
      input_parameters: {
        work_items_path: "Path to work-items.json file (string, required)",
        project_path: "Path to the microservice project (string, required)",
        application_name: "Service Fabric application name (string, required)",
        service_name: "Microservice name (string, required)"
      },
      example: {
        work_items_path: "C:\\repos\\FTEBuddy2.0\\work-items.json",
        project_path: "C:\\repos\\FTEBuddy2.0",
        application_name: "DashWorkItems",
        service_name: "KPIService"
      }
    },
    implement_all_work_items: {
      description: "Systematically implement all work items from the JSON file, iterating through each epic, user story, and task",
      input_parameters: {
        work_items_path: "Path to work-items.json file (string, required)",
        project_path: "Path to the microservice project (string, required)",
        application_name: "Service Fabric application name (string, required)",
        service_name: "Microservice name (string, required)",
        quality_level: "Code quality level: basic, production, enterprise (string, optional, default: production)"
      },
      example: {
        work_items_path: "C:\\repos\\FTEBuddy2.0\\docs\\work-items.json",
        project_path: "C:\\repos\\FTEBuddy2.0",
        application_name: "DashWorkItems",
        service_name: "KPIService",
        quality_level: "production"
      }
    }
  };

  const result = tool_name === 'all' ? {
    success: true,
    all_tools: toolInstructions,
    workflow_order: [
      "1. create_solution - Set up the Service Fabric application and microservice",
      "2. identify_required_controllers - Analyze work items to identify needed controllers",
      "3. create_controllers - Create controllers following EchoController pattern",
      "4. implement_all_work_items - Systematically implement ALL work items (epics, user stories, tasks)",
      "5. build_and_validate - Build solution and fix any issues",
      "6. validate_implementation - Ensure all work items are complete"
    ]
  } : {
    success: true,
    tool: toolInstructions[tool_name] || { error: `Tool '${tool_name}' not found` }
  };

  return {
    jsonrpc: "2.0",
    id: requestId,
    result: { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] }
  };
}

export { handleRequest };

if (import.meta.url === `file://${process.argv[1]}`) {
  console.error('ServiceFabric Work Items Manager MCP Server v2.0.0 - Ready for requests');
}