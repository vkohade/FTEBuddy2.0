import { execSync } from "child_process";
import fs from "fs";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

async function scaffoldPcfControl(args) {
  const { control_name, namespace, template_type = "field", base_directory = process.cwd() } = args;

  try {
    const projectDir = `${base_directory}/PCFControls`;
    const controlDir = `${projectDir}/${control_name}`;

    if (!fs.existsSync(projectDir)) {
      fs.mkdirSync(projectDir, { recursive: true });
    }

    const commands = [
      `cd ${projectDir} && pac pcf init --namespace ${namespace} --name ${control_name} --template ${template_type} --run-npm-install`
    ];

    const results = commands.map((cmd) => {
      try {
        return { command: cmd, output: execSync(cmd, { encoding: "utf8", shell: true }) };
      } catch (error) {
        return { command: cmd, error: error.message };
      }
    });

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            project_name: control_name,
            pcf_control_directory: controlDir,
            base_directory,
            template_type,
            commands_executed: results,
            success: true,
          }),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            error: "Failed to scaffold PCF control",
            details: error.message,
          }),
        },
      ],
    };
  }
}

async function scaffoldPlugin(args) {
  const { plugin_name, entity, message = "create", base_directory = process.cwd() } = args;

  try {
    const projectDir = `${base_directory}/Plugins`;
    const pluginName = `${plugin_name.toLowerCase()}-plugin`;
    const pluginDir = `${projectDir}/${pluginName}`;

    if (!fs.existsSync(projectDir)) {
      fs.mkdirSync(projectDir, { recursive: true });
    }

    const commands = [
      `cd "${projectDir}" && pac plugin init --outputDirectory ${pluginName}`
    ];

    const results = commands.map((cmd) => {
      try {
        return { command: cmd, output: execSync(cmd, { encoding: "utf8", shell: true }) };
      } catch (error) {
        return { command: cmd, error: error.message };
      }
    });

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            project_name: plugin_name,
            plugin_directory: pluginDir,
            base_directory,
            target_entity: entity,
            message_type: message,
            commands_executed: results,
            success: true,
          }),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            error: "Failed to scaffold plugin",
            details: error.message,
          }),
        },
      ],
    };
  }
}

async function getInstructions(args) {
  const { project_type, instruction_type = "scaffolding" } = args;

  const instructions = {
    pcf_control: {
      scaffolding: "Run the pac cli commands for pcf control to create the skeleton of the control. Use scaffold_pcf_control tool to create it.",
    },
    plugin: {
      scaffolding: "Run the pac cli commands for plugin to create the skeleton of the plugin. Use scaffold_plugin tool to create it.",
    },
  };

  const projectInstructions = instructions[project_type];
  if (!projectInstructions) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            error: "Unknown project type",
            supported_types: Object.keys(instructions),
            provided_type: project_type,
          }),
        },
      ],
    };
  }

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({
          project_type,
          instruction_type,
          instructions:
            projectInstructions[instruction_type] || projectInstructions,
          context: {
            server: "TemplateManager MCP Server",
            purpose:
              "Scaffold and initialize project structures for Dynamics 365 development",
          },
        }),
      },
    ],
  };
}

const server = new Server(
  { name: "template-manager-mcp", version: "0.2.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "scaffold_pcf_control",
      description:
        "Create PCF control project structure with React 18, TypeScript, and Fluent UI v9",
      inputSchema: {
        type: "object",
        properties: {
          control_name: {
            type: "string",
            description: "Name of the PCF control",
          },
          namespace: {
            type: "string",
            description: "Namespace for the control",
          },
          template_type: {
            type: "string",
            enum: ["field", "dataset"],
            default: "field",
            description: "Type of PCF control template",
          },
          base_directory: {
            type: "string",
            description:
              "Base directory where PCFControls and Plugins will be created (default: current working directory)",
          },
        },
        required: ["control_name", "namespace", "base_directory"],
      },
    },
    {
      name: "scaffold_plugin",
      description: "Create Dynamics 365 plugin project structure",
      inputSchema: {
        type: "object",
        properties: {
          plugin_name: { type: "string", description: "Name of the plugin" },
          entity: {
            type: "string",
            description: "Target entity for the plugin",
          },
          message: {
            type: "string",
            enum: ["create", "update", "delete", "retrieve"],
            default: "create",
            description: "Plugin message type",
          },
          base_directory: {
            type: "string",
            description:
              "Base directory where PCFControls and Plugins will be created (default: current working directory)",
          },
        },
        required: ["plugin_name", "entity", "base_directory"],
      },
    },
    {
      name: "get_instructions",
      description:
        "Get scaffolding instructions for specific project types",
      inputSchema: {
        type: "object",
        properties: {
          project_type: {
            type: "string",
            enum: ["pcf_control", "plugin"],
            description: "Type of project to get instructions for",
          },
          instruction_type: {
            type: "string",
            enum: ["scaffolding"],
            default: "scaffolding",
            description: "Type of instructions needed",
          },
        },
        required: ["project_type"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  switch (request.params.name) {
    case "scaffold_pcf_control":
      return await scaffoldPcfControl(request.params.arguments || {});
    case "scaffold_plugin":
      return await scaffoldPlugin(request.params.arguments || {});
    case "get_instructions":
      return await getInstructions(request.params.arguments || {});
    default:
      throw new Error(`Unknown tool: ${request.params.name}`);
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("TemplateManager MCP server running");
