import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import fs from "fs";
import path from "path";

const SERVER_VERSION = "0.3.0";

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

  // Return guidance for producing the required Agile JSON (Epic → User Story → Task).
  const schemaGuidance = {
    overview: "Produce structured Agile requirements JSON (Epics -> User Stories -> Tasks).",
    required_top_level: ["epics", "metadata"],
    schema: {
      epics: [
        {
          id: "string (unique, e.g., E1)",
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
      epic: "Group of related user stories delivering a cohesive business objective.",
      user_story: "Follows user-centric value expression. Provide acceptance_criteria array.",
      task: "Actionable unit of work with purpose (why) and implementation_details (how)."
    },
    constraints: [
      "IDs must be unique across their level.",
      "Maintain nesting: Epics > User Stories > Tasks.",
      "All arrays present even if empty.",
      "No extra top-level keys beyond epics, metadata (unless explicitly extended)."
    ],
    recommended_id_strategy: {
      epic: "E<number>",
      user_story: "US<number>",
      task: "T<number>"
    },
    minimal_example: {
      epics: [
        {
          id: "E1",
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
    integration_flow: [
      "1. Use word-parser-mcp.parse_document to extract content.",
      "2. Github copilot agent interprets parsed content.",
      "3. Agent assembles JSON strictly to this schema.",
      "4. JSON can be sent to downstream to start implementing the work items."
    ]
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
    has_epics: Array.isArray(data?.epics),
    has_metadata: typeof data?.metadata === "object",
    epic_id_format_ok: true,
    user_story_id_format_ok: true,
    task_id_format_ok: true,
    errors: []
  };

  if (!validation.has_epics) validation.errors.push("Top-level 'epics' array missing.");
  if (!validation.has_metadata) validation.errors.push("Top-level 'metadata' object missing.");

  const idPattern = {
    epic: /^E\d+$/,
    userStory: /^US\d+$/,
    task: /^T\d+$/
  };

  if (validation.has_epics) {
    for (const epic of data.epics) {
      if (epic?.id && !idPattern.epic.test(epic.id)) validation.epic_id_format_ok = false;
      if (Array.isArray(epic?.user_stories)) {
        for (const us of epic.user_stories) {
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

const server = new Server(
  { name: "content-intelligence-manager-mcp", version: SERVER_VERSION },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "get_instructions",
      description: "Return instructions to analyze the parsed docs for producing Agile requirements JSON (Epics → User Stories → Tasks).",
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
      description: "Persist the assembled Agile JSON (Epics → User Stories → Tasks) to work-items.json in the document directory.",
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
    }
  ]
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  switch (request.params.name) {
    case "get_instructions":
      return await getInstructions(request.params.arguments || {});
    case "create_work_items_json":
      return await createWorkItemsJson(request.params.arguments || {});
    default:
      throw new Error(`Unknown tool: ${request.params.name}`);
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("ContentIntelligenceManager MCP server running (schema-guidance + writer) v" + SERVER_VERSION);