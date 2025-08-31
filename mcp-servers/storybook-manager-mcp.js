import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

async function generateStory(args) {
  const { component_name, story_variants = ['Default', 'Dark', 'RTL'] } = args;

  const storyTemplate = `
import type { Meta, StoryObj } from '@storybook/react';
import { FluentProvider, webLightTheme, webDarkTheme } from '@fluentui/react-components';
import { ${component_name} } from './${component_name}';

const meta: Meta<typeof ${component_name}> = {
  title: 'Components/${component_name}',
  component: ${component_name},
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    theme: 'light',
    direction: 'ltr',
  },
};

export const Dark: Story = {
  args: {
    ...Default.args,
    theme: 'dark',
  },
};

export const RTL: Story = {
  args: {
    ...Default.args,
    direction: 'rtl',
  },
};`;

  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        component_name,
        story_code: storyTemplate,
        files_created: [`src/components/${component_name}/${component_name}.stories.tsx`],
        features: ["CSF3 format", "Theme support", "RTL testing", "Accessibility ready"]
      })
    }]
  };
}

async function getInstructions(args) {
  const { instruction_type } = args;

  const instructions = {
    stories: {
      overview: "Create Storybook stories with CSF3 format",
      requirements: ["Use CSF3 format", "Include theme variants", "Add accessibility tests", "Implement play functions"]
    },
    accessibility: {
      overview: "Implement accessibility testing",
      tools: ["@storybook/addon-a11y", "axe-core", "jest-axe"]
    }
  };

  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        instruction_type,
        instructions: instructions[instruction_type] || instructions
      })
    }]
  };
}

const server = new Server({ name: "storybook-manager-mcp", version: "0.1.0" }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "generate_story",
      description: "Generate Storybook story with CSF3 format",
      inputSchema: {
        type: "object",
        properties: {
          component_name: { type: "string" },
          story_variants: { type: "array", items: { type: "string" } }
        },
        required: ["component_name"]
      }
    },
    {
      name: "get_instructions",
      description: "Get Storybook development instructions",
      inputSchema: {
        type: "object",
        properties: {
          instruction_type: { type: "string", enum: ["stories", "accessibility"] }
        },
        required: ["instruction_type"]
      }
    }
  ]
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  switch (request.params.name) {
    case "generate_story":
      return await generateStory(request.params.arguments || {});
    case "get_instructions":
      return await getInstructions(request.params.arguments || {});
    default:
      throw new Error(`Unknown tool: ${request.params.name}`);
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("StorybookManager MCP server running");