import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

const SERVER_VERSION = "0.2.0";

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
    overview: "Produce structured Agile requirements JSON (Epics -> User Stories -> Tasks). Store the json in work-items.json for downstream processing (e.g., ADO work item creation). Use the document directory of the parsed docx files as the base path for storing the json file.",
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
      "2. External agent (not this server) interprets parsed content.",
      "3. Agent assembles JSON strictly to this schema.",
      "4. JSON can be sent to downstream (e.g., ADO work item creation)."
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
    }
  ]
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  switch (request.params.name) {
    case "get_instructions":
      return await getInstructions(request.params.arguments || {});
    default:
      throw new Error(`Unknown tool: ${request.params.name}`);
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("ContentIntelligenceManager MCP server running (schema-guidance only) v" + SERVER_VERSION);