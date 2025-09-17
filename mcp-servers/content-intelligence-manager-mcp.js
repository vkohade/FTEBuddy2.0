import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dotenv from 'dotenv';
import * as azdev from 'azure-devops-node-api';
import * as msal from '@azure/msal-node';
import open from 'open';
import http from 'http';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const SERVER_VERSION = "0.5.0";

// Azure DevOps configuration from environment
const ADO_CONFIG = {
  organization: process.env.ADO_ORGANIZATION,
  project: process.env.ADO_PROJECT,
  areaPath: process.env.ADO_AREA_PATH || process.env.ADO_PROJECT,
  iterationPath: process.env.ADO_ITERATION_PATH || process.env.ADO_PROJECT,
  defaultAssignee: process.env.ADO_DEFAULT_ASSIGNEE || '',
  authCallbackPort: parseInt(process.env.ADO_AUTH_CALLBACK_PORT || '3000')
};

// MSAL configuration for interactive authentication
const msalConfig = {
  auth: {
    clientId: '872cd9fa-d31f-45e0-9eab-6e460a02d1f1', // Visual Studio Code client ID
    authority: 'https://login.microsoftonline.com/common',
  },
  system: {
    loggerOptions: {
      loggerCallback(loglevel, message, containsPii) {
        if (!containsPii) {
          console.error(`[MSAL] ${message}`);
        }
      },
      piiLoggingEnabled: false,
      logLevel: 3, // Error level
    }
  }
};

// Token cache for storing auth tokens
let tokenCache = null;
let adoConnection = null;

async function getInstructions(args) {
  const { instruction_type = "analysis" } = args;

  if (instruction_type !== "analysis") {
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          error: "Unsupported instruction_type",
          supported: ["analysis"],
          provided: instruction_type
        })
      }]
    };
  }

  // Return guidance for producing the required Agile JSON (Feature → User Story → Task).
  const schemaGuidance = {
    overview: "Produce structured Agile requirements JSON (Features -> User Stories -> Tasks).",
    required_top_level: ["features", "metadata"],
    schema: {
      features: [
        {
          id: "string (unique, e.g., F1)",
          title: "string",
          description: "string",
          acceptance_criteria: ["string", "string", "..."],
          user_stories: [
            {
              id: "string (unique within doc, e.g., US1)",
              title: "string",
              description: "string",
              acceptance_criteria: ["string", "string", "..."],
              tasks: [
                {
                  id: "string (unique, e.g., T1)",
                  title: "string",
                  purpose: "string (WHY the task exists)",
                  implementation_details: "string (HOW to do it)",
                  dependencies: ["T2", "T3"],
                  assignee: "string (or 'unassigned')",
                  status: "todo | in-progress | done",
                  estimated_effort: "string (e.g., 3d, 8h)"
                }
              ]
            }
          ]
        }
      ],
      metadata: {
        generated_at: "ISO 8601 timestamp",
        source_document: "path/to/doc.docx",
        parser_version: "0.3.0 (from Word Parser metadata)"
      }
    },
    field_notes: {
      feature: "Group of related user stories delivering a cohesive business capability or functionality.",
      user_story: "Follows user-centric value expression. Provide acceptance_criteria array.",
      task: "Actionable unit of work with purpose (why) and implementation_details (how)."
    },
    constraints: [
      "IDs must be unique across their level.",
      "Maintain nesting: Features > User Stories > Tasks.",
      "All arrays present even if empty.",
      "No extra top-level keys beyond features, metadata (unless explicitly extended)."
    ],
    recommended_id_strategy: {
      feature: "F<number>",
      user_story: "US<number>",
      task: "T<number>"
    },
    minimal_example: {
      features: [
        {
          id: "F1",
          title: "User Management",
          description: "Core capabilities for managing application users.",
          acceptance_criteria: [
            "All critical user operations are available",
            "Security model documented"
          ],
          user_stories: [
            {
              id: "US1",
              title: "Create user account",
              description: "As an admin, I want to create a user so that they can access the system.",
              acceptance_criteria: [
                "Form validates required fields",
                "New user receives activation email"
              ],
              tasks: [
                {
                  id: "T1",
                  title: "Backend create user endpoint",
                  purpose: "Enable persistence of new user accounts",
                  implementation_details: "POST /api/users with validation & audit logging",
                  dependencies: [],
                  assignee: "unassigned",
                  status: "todo",
                  estimated_effort: "8h"
                }
              ]
            }
          ]
        }
      ],
      metadata: {
        generated_at: "2024-01-01T12:00:00.000Z",
        source_document: "c:/docs/spec.docx"
      }
    },
    workitem_strategy: {
      pcf: "All PCF control related tasks go under one feature per control. UI related requirements become user stories. Figma nodes referenced in the dev docs should each be a task. Technical tasks (e.g., setup, data handling) become tasks.",
      plugin: "All plugin related tasks go under one feature per plugin. Each functional requirement becomes a user story. Technical tasks (e.g., setup, registration) become tasks.",
      default: "Group related requirements into features. Each user-centric capability is a user story. Break down implementation steps into tasks."
    }
  };

  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        instruction_type,
        instructions: schemaGuidance
      })
    }]
  };
}

async function createWorkItemsJson(args) {
  const {
    work_items,
    document_directory,
    source_document,
    file_name = "work-items.json",
    overwrite = true
  } = args || {};

  if (!work_items) {
    return {
      content: [{
        type: "text",
        text: JSON.stringify({ error: "Missing required 'work_items' argument" })
      }]
    };
  }

  let data;
  if (typeof work_items === "string") {
    try {
      data = JSON.parse(work_items);
    } catch (e) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({ error: "Failed to parse work_items JSON string", details: e.message })
        }]
      };
    }
  } else {
    data = work_items;
  }

  // Basic schema validation (lightweight)
  const validation = {
    has_features: Array.isArray(data?.features),
    has_metadata: typeof data?.metadata === "object",
    feature_id_format_ok: true,
    user_story_id_format_ok: true,
    task_id_format_ok: true,
    errors: []
  };

  if (!validation.has_features) validation.errors.push("Top-level 'features' array missing.");
  if (!validation.has_metadata) validation.errors.push("Top-level 'metadata' object missing.");

  const idPattern = {
    feature: /^F\d+$/,
    userStory: /^US\d+$/,
    task: /^T\d+$/
  };

  if (validation.has_features) {
    for (const feature of data.features) {
      if (feature?.id && !idPattern.feature.test(feature.id)) validation.feature_id_format_ok = false;
      if (Array.isArray(feature?.user_stories)) {
        for (const us of feature.user_stories) {
          if (us?.id && !idPattern.userStory.test(us.id)) validation.user_story_id_format_ok = false;
          if (Array.isArray(us?.tasks)) {
            for (const t of us.tasks) {
              if (t?.id && !idPattern.task.test(t.id)) validation.task_id_format_ok = false;
            }
          }
        }
      }
    }
  }

  const targetDir =
    document_directory ||
    (source_document ? path.dirname(source_document) : null) ||
    process.cwd();

  try {
    if (!fs.existsSync(targetDir)) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({ error: "Target directory does not exist", targetDir })
        }]
      };
    }

    const targetPath = path.join(targetDir, file_name);

    if (!overwrite && fs.existsSync(targetPath)) {
      return {
        content: [{
          type: "text",
          text: JSON.stringify({ error: "File exists and overwrite=false", path: targetPath })
        }]
      };
    }

    // Auto add generated_at if missing
    if (!data.metadata) data.metadata = {};
    if (!data.metadata.generated_at) data.metadata.generated_at = new Date().toISOString();

    fs.writeFileSync(targetPath, JSON.stringify(data, null, 2), "utf-8");

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          status: "success",
          path: targetPath,
          validation,
          bytes_written: fs.statSync(targetPath).size
        })
      }]
    };
  } catch (e) {
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          error: "Failed to write work-items file",
          details: e.message
        })
      }]
    };
  }
}

async function authenticateADO() {
  return new Promise(async (resolve, reject) => {
    const pca = new msal.PublicClientApplication(msalConfig);
    
    // Try to get cached token first
    const accounts = await pca.getTokenCache().getAllAccounts();
    if (accounts.length > 0) {
      try {
        const result = await pca.acquireTokenSilent({
          account: accounts[0],
          scopes: ['499b84ac-1321-427f-aa17-267ca6975798/.default'] // Azure DevOps scope
        });
        
        if (result && result.accessToken) {
          resolve(result.accessToken);
          return;
        }
      } catch (error) {
        console.error('Silent token acquisition failed, falling back to interactive');
      }
    }
    
    // Interactive authentication with local server callback
    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url, `http://localhost:${ADO_CONFIG.authCallbackPort}`);
      const code = url.searchParams.get('code');
      
      if (code) {
        try {
          const tokenRequest = {
            code: code,
            scopes: ['499b84ac-1321-427f-aa17-267ca6975798/.default'],
            redirectUri: `http://localhost:${ADO_CONFIG.authCallbackPort}`
          };
          
          const response = await pca.acquireTokenByCode(tokenRequest);
          
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end('<html><body><h2>Authentication successful!</h2><p>You can close this window and return to the application.</p></body></html>');
          
          server.close();
          resolve(response.accessToken);
        } catch (error) {
          res.writeHead(500, { 'Content-Type': 'text/html' });
          res.end('<html><body><h2>Authentication failed</h2><p>Please try again.</p></body></html>');
          server.close();
          reject(error);
        }
      }
    });
    
    server.listen(ADO_CONFIG.authCallbackPort, async () => {
      const authCodeUrlParameters = {
        scopes: ['499b84ac-1321-427f-aa17-267ca6975798/.default'],
        redirectUri: `http://localhost:${ADO_CONFIG.authCallbackPort}`
      };
      
      const authUrl = await pca.getAuthCodeUrl(authCodeUrlParameters);
      console.error(`Opening browser for authentication: ${authUrl}`);
      await open(authUrl);
    });
    
    // Timeout after 5 minutes
    setTimeout(() => {
      server.close();
      reject(new Error('Authentication timeout'));
    }, 300000);
  });
}

async function getADOConnection() {
  if (!adoConnection) {
    const token = await authenticateADO();
    const authHandler = azdev.getPersonalAccessTokenHandler(token);
    adoConnection = new azdev.WebApi(
      `https://dev.azure.com/${ADO_CONFIG.organization}`,
      authHandler
    );
  }
  return adoConnection;
}

function mapWorkItemType(itemType) {
  const typeMap = {
    'feature': 'Feature',
    'epic': 'Epic',
    'user_story': 'User Story',
    'task': 'Task'
  };
  return typeMap[itemType] || 'Task';
}

function createWorkItemPatch(item, itemType, parentPath = null) {
  const patch = [];
  
  // Add title
  patch.push({
    op: 'add',
    path: '/fields/System.Title',
    value: item.title
  });
  
  // Add description
  if (item.description) {
    patch.push({
      op: 'add',
      path: '/fields/System.Description',
      value: item.description
    });
  }
  
  // Add acceptance criteria
  if (item.acceptance_criteria && item.acceptance_criteria.length > 0) {
    const criteriaHtml = '<ul>' + 
      item.acceptance_criteria.map(c => `<li>${c}</li>`).join('') + 
      '</ul>';
    patch.push({
      op: 'add',
      path: '/fields/Microsoft.VSTS.Common.AcceptanceCriteria',
      value: criteriaHtml
    });
  }
  
  // Add area and iteration paths
  patch.push({
    op: 'add',
    path: '/fields/System.AreaPath',
    value: ADO_CONFIG.areaPath
  });
  
  patch.push({
    op: 'add',
    path: '/fields/System.IterationPath',
    value: ADO_CONFIG.iterationPath
  });
  
  // Task-specific fields
  if (itemType === 'task') {
    if (item.purpose) {
      patch.push({
        op: 'add',
        path: '/fields/System.Description',
        value: `<strong>Purpose:</strong> ${item.purpose}<br/><br/><strong>Implementation Details:</strong> ${item.implementation_details || 'TBD'}`
      });
    }
    
    if (item.estimated_effort) {
      // Parse effort (e.g., "3d" -> 24 hours, "8h" -> 8 hours)
      const effort = item.estimated_effort.toLowerCase();
      let hours = 0;
      if (effort.endsWith('d')) {
        hours = parseInt(effort) * 8;
      } else if (effort.endsWith('h')) {
        hours = parseInt(effort);
      }
      
      if (hours > 0) {
        patch.push({
          op: 'add',
          path: '/fields/Microsoft.VSTS.Scheduling.OriginalEstimate',
          value: hours
        });
      }
    }
    
    if (item.assignee && item.assignee !== 'unassigned') {
      patch.push({
        op: 'add',
        path: '/fields/System.AssignedTo',
        value: item.assignee
      });
    }
    
    // Set state based on status
    const stateMap = {
      'todo': 'New',           // Changed from 'To Do' to 'New'
      'in-progress': 'Active', // Changed from 'In Progress' to 'Active'
      'done': 'Done'
    };
    
    patch.push({
      op: 'add',
      path: '/fields/System.State',
      value: stateMap[item.status] || 'New' // Default to 'New'
    });
  }
  
  // Add parent link if provided
  if (parentPath) {
    patch.push({
      op: 'add',
      path: '/relations/-',
      value: {
        rel: 'System.LinkTypes.Hierarchy-Reverse',
        url: parentPath
      }
    });
  }
  
  // Add tags for tracking
  patch.push({
    op: 'add',
    path: '/fields/System.Tags',
    value: `FTEBuddy; Generated; ${item.id}`
  });
  
  return patch;
}

async function createADOWorkItems(args) {
  const { 
    work_items_path,
    dry_run = false,
    create_hierarchy = true,
    skip_existing = true
  } = args || {};
  
  if (!work_items_path) {
    return {
      content: [{
        type: "text",
        text: JSON.stringify({ error: "Missing required 'work_items_path' argument" })
      }]
    };
  }
  
  // Validate ADO configuration
  if (!ADO_CONFIG.organization || !ADO_CONFIG.project) {
    return {
      content: [{
        type: "text",
        text: JSON.stringify({ 
          error: "Missing Azure DevOps configuration",
          required: ["ADO_ORGANIZATION", "ADO_PROJECT"],
          hint: "Please configure these in your .env file"
        })
      }]
    };
  }
  
  // Read work items JSON
  let workItemsData;
  try {
    const jsonContent = fs.readFileSync(work_items_path, 'utf-8');
    workItemsData = JSON.parse(jsonContent);
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: JSON.stringify({ 
          error: "Failed to read work items file",
          details: error.message 
        })
      }]
    };
  }
  
  // Check for both 'features' and 'epics' (support both formats)
  const topLevelItems = workItemsData.features || workItemsData.epics || [];
  const itemType = workItemsData.features ? 'feature' : 'epic';
  
  if (!topLevelItems || topLevelItems.length === 0) {
    return {
      content: [{
        type: "text",
        text: JSON.stringify({ 
          error: "No features or epics found in work items file"
        })
      }]
    };
  }
  
  if (dry_run) {
    // Just return what would be created
    const summary = {
      mode: "DRY RUN",
      organization: ADO_CONFIG.organization,
      project: ADO_CONFIG.project,
      items_to_create: {
        [itemType + 's']: topLevelItems.length,
        user_stories: topLevelItems.reduce((sum, f) => sum + (f.user_stories?.length || 0), 0),
        tasks: topLevelItems.reduce((sum, f) => 
          sum + f.user_stories?.reduce((s, us) => s + (us.tasks?.length || 0), 0) || 0, 0
        )
      },
      hierarchy: create_hierarchy
    };
    
    return {
      content: [{
        type: "text",
        text: JSON.stringify(summary, null, 2)
      }]
    };
  }
  
  // Get ADO connection with authentication
  let connection;
  try {
    connection = await getADOConnection();
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: JSON.stringify({ 
          error: "Authentication failed",
          details: error.message,
          hint: "A browser window should open for authentication. Please sign in with your Azure DevOps account."
        })
      }]
    };
  }
  
  const witApi = await connection.getWorkItemTrackingApi();
  const created = [];
  const errors = [];
  const idMap = {}; // Map original IDs to ADO work item IDs
  
  try {
    // Create top-level items (features/epics)
    for (const topItem of topLevelItems) {
      try {
        const patch = createWorkItemPatch(topItem, itemType);
        const workItem = await witApi.createWorkItem(
          null,
          patch,
          ADO_CONFIG.project,
          mapWorkItemType(itemType)
        );
        
        created.push({
          type: itemType,
          id: topItem.id,
          ado_id: workItem.id,
          title: topItem.title
        });
        
        idMap[topItem.id] = workItem.id;
        
        // Create user stories
        if (create_hierarchy && topItem.user_stories) {
          for (const story of topItem.user_stories) {
            try {
              const storyPatch = createWorkItemPatch(
                story, 
                'user_story',
                workItem.url
              );
              
              const storyWorkItem = await witApi.createWorkItem(
                null,
                storyPatch,
                ADO_CONFIG.project,
                'User Story'
              );
              
              created.push({
                type: 'user_story',
                id: story.id,
                ado_id: storyWorkItem.id,
                title: story.title,
                parent: topItem.id
              });
              
              idMap[story.id] = storyWorkItem.id;
              
              // Create tasks
              if (story.tasks) {
                for (const task of story.tasks) {
                  try {
                    // Handle task dependencies
                    const taskPatch = createWorkItemPatch(
                      task,
                      'task',
                      storyWorkItem.url
                    );
                    
                    const taskWorkItem = await witApi.createWorkItem(
                      null,
                      taskPatch,
                      ADO_CONFIG.project,
                      'Task'
                    );
                    
                    created.push({
                      type: 'task',
                      id: task.id,
                      ado_id: taskWorkItem.id,
                      title: task.title,
                      parent: story.id
                    });
                    
                    idMap[task.id] = taskWorkItem.id;
                  } catch (error) {
                    errors.push({
                      task: task.id,
                      error: error.message
                    });
                  }
                }
              }
            } catch (error) {
              errors.push({
                story: story.id,
                error: error.message
              });
            }
          }
        }
      } catch (error) {
        errors.push({
          [itemType]: topItem.id,
          error: error.message
        });
      }
    }
    
    // Create dependency links for tasks
    for (const topItem of topLevelItems) {
      if (topItem.user_stories) {
        for (const story of topItem.user_stories) {
          if (story.tasks) {
            for (const task of story.tasks) {
              if (task.dependencies && task.dependencies.length > 0) {
                const taskAdoId = idMap[task.id];
                
                for (const depId of task.dependencies) {
                  const depAdoId = idMap[depId];
                  if (depAdoId && taskAdoId) {
                    try {
                      const patch = [{
                        op: 'add',
                        path: '/relations/-',
                        value: {
                          rel: 'System.LinkTypes.Dependency-Forward',
                          url: `https://dev.azure.com/${ADO_CONFIG.organization}/_apis/wit/workItems/${depAdoId}`
                        }
                      }];
                      
                      await witApi.updateWorkItem(null, patch, taskAdoId, ADO_CONFIG.project);
                    } catch (error) {
                      errors.push({
                        dependency_link: `${task.id} -> ${depId}`,
                        error: error.message
                      });
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
    
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          status: "success",
          organization: ADO_CONFIG.organization,
          project: ADO_CONFIG.project,
          created: created.length,
          items: created,
          errors: errors.length > 0 ? errors : undefined,
          id_mapping: idMap
        }, null, 2)
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: JSON.stringify({ 
          error: "Failed to create work items",
          details: error.message,
          created_so_far: created,
          errors: errors
        })
      }]
    };
  }
}

const server = new Server(
  { name: "content-intelligence-manager-mcp", version: SERVER_VERSION },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "get_instructions",
      description: "Return instructions to analyze the parsed docs for producing Agile requirements JSON (Features → User Stories → Tasks).",
      inputSchema: {
        type: "object",
        properties: {
          instruction_type: {
            type: "string",
            enum: ["analysis"],
            default: "analysis",
            description: "Only 'analysis' is supported."
          }
        },
        required: []
      }
    },
    {
      name: "create_work_items_json",
      description: "Persist the assembled Agile JSON (Features → User Stories → Tasks) to work-items.json in the document directory.",
      inputSchema: {
        type: "object",
        properties: {
          work_items: { description: "Object or JSON string of the work items schema.", anyOf: [{ type: "object" }, { type: "string" }] },
          document_directory: { type: "string", description: "Directory where file will be written (preferred)." },
          source_document: { type: "string", description: "Path to original docx (used to derive directory if document_directory not provided)." },
          file_name: { type: "string", default: "work-items.json", description: "Optional override of output filename." },
          overwrite: { type: "boolean", default: true }
        },
        required: ["work_items"]
      }
    },
    {
      name: "create_ado_work_items",
      description: "Create Azure DevOps work items from the work-items.json file with interactive authentication",
      inputSchema: {
        type: "object",
        properties: {
          work_items_path: {
            type: "string",
            description: "Path to the work-items.json file containing the structured work items"
          },
          dry_run: {
            type: "boolean",
            default: false,
            description: "If true, only show what would be created without actually creating items"
          },
          create_hierarchy: {
            type: "boolean",
            default: true,
            description: "If true, create the full hierarchy (Features -> User Stories -> Tasks)"
          },
          skip_existing: {
            type: "boolean",
            default: true,
            description: "If true, skip items that already exist (based on tags)"
          }
        },
        required: ["work_items_path"]
      }
    }
  ]
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  switch (request.params.name) {
    case "get_instructions":
      return await getInstructions(request.params.arguments || {});
    case "create_work_items_json":
      return await createWorkItemsJson(request.params.arguments || {});
    case "create_ado_work_items":
      return await createADOWorkItems(request.params.arguments || {});
    default:
      throw new Error(`Unknown tool: ${request.params.name}`);
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("ContentIntelligenceManager MCP server running (schema-guidance + writer + ADO) v" + SERVER_VERSION);