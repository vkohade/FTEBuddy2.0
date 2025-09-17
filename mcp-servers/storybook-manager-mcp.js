import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

async function generateStory(args) {
  const {
    component_name,
    component_type = 'standard', // 'standard', 'chart', 'data-grid', 'form'
    story_variants = ['Default', 'Dark', 'RTL', 'Empty', 'Loading', 'Error'],
    has_interactions = true,
    has_accessibility = true,
    props_interface = {},
    mock_data = null,
    fluent_theme = true
  } = args;

  // Generate imports based on component type
  const generateImports = () => {
    let imports = `import React from "react";
import { Meta, StoryObj } from "@storybook/react";`;

    if (has_interactions) {
      imports += `
import { within, userEvent, waitFor } from "@storybook/testing-library";
import { expect } from "@storybook/jest";`;
    }

    if (fluent_theme) {
      imports += `
import { FluentProvider, webLightTheme, webDarkTheme } from "@fluentui/react-components";`;
    }

    if (component_type === 'chart') {
      imports += `
import { ILink, INode } from "SupervisorDashboardControl/Interfaces/MicroComponent";`;
    }

    imports += `
import ${component_name} from "../${component_name}";`;

    return imports;
  };

  // Generate meta configuration
  const generateMeta = () => {
    const decorators = fluent_theme ? `
    decorators: [
        (Story) => (
            <FluentProvider theme={webLightTheme}>
                <Story />
            </FluentProvider>
        )
    ]` : '';

    return `
const meta: Meta<typeof ${component_name}> = {
    title: "${component_type === 'chart' ? 'MicroComponent' : 'Components'}/${component_name}",
    component: ${component_name},${decorators}
};
export default meta;

type Story = StoryObj<typeof ${component_name}>;`;
  };

  // Generate play function for testing
  const generatePlayFunction = (variant, testScenarios = []) => {
    if (!has_interactions) return '';

    const defaultTests = [
      `// Test component renders
        const canvas = within(canvasElement);`,
      `// Test accessibility
        await expect(canvasElement).toHaveNoViolations();`
    ];

    const variantTests = {
      'Default': [
        `// Test default state
        await expect(canvas.getByRole('region')).toBeInTheDocument();`
      ],
      'Loading': [
        `// Test loading state
        await expect(canvas.getByRole('progressbar')).toBeInTheDocument();`
      ],
      'Error': [
        `// Test error state
        await expect(canvas.getByText(/error/i)).toBeInTheDocument();`
      ],
      'Empty': [
        `// Test empty state
        await expect(canvas.queryByRole('list')).not.toBeInTheDocument();`
      ],
      'Dark': [
        `// Test dark theme rendering
        await expect(canvasElement).toHaveStyle({ backgroundColor: expect.stringContaining('rgb') });`
      ]
    };

    const tests = [...defaultTests, ...(variantTests[variant] || []), ...testScenarios];

    return `
    play: async ({ canvasElement }) => {
        ${tests.join('\n        ')}
    }`;
  };

  // Generate story variants
  const generateStoryVariants = () => {
    const stories = [];

    for (const variant of story_variants) {
      let storyCode = `
export const ${variant}: Story = {`;

      // Add args based on variant
      if (variant === 'Default' && mock_data) {
        storyCode += `
    args: ${JSON.stringify(mock_data, null, 8)},`;
      } else if (variant === 'Dark') {
        storyCode += `
    args: { ...Default.args },
    decorators: [
        (Story) => (
            <FluentProvider theme={webDarkTheme}>
                <Story />
            </FluentProvider>
        )
    ],`;
      } else if (variant === 'RTL') {
        storyCode += `
    args: { ...Default.args, direction: 'rtl' },`;
      } else if (variant === 'Empty') {
        storyCode += `
    args: { data: [], title: "Empty State" },`;
      } else if (variant === 'Loading') {
        storyCode += `
    args: { ...Default.args, isLoading: true },`;
      } else if (variant === 'Error') {
        storyCode += `
    args: { ...Default.args, error: "Failed to load data" },`;
      }

      // Add play function
      const playFunc = generatePlayFunction(variant);
      if (playFunc) {
        storyCode += playFunc;
      }

      storyCode += `
};`;
      stories.push(storyCode);
    }

    return stories.join('\n');
  };

  // Generate complete story file
  const storyTemplate = `${generateImports()}

${generateMeta()}

${generateStoryVariants()}`;

  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        component_name,
        story_code: storyTemplate,
        files_created: [`src/components/${component_name}/${component_name}.stories.tsx`],
        features: [
          "CSF3 format",
          "Fluent UI theme support",
          "Interaction testing with play functions",
          "Accessibility testing",
          "Multiple story variants",
          "TypeScript support"
        ],
        test_configuration: {
          playwright_config: "Uses headless mode with optimized launch options",
          test_runner: "Configured with axe-playwright for a11y testing",
          addons: ["@storybook/addon-a11y", "@storybook/addon-interactions", "@storybook/addon-essentials"]
        }
      }, null, 2)
    }]
  };
}

async function generateTestRunner(args) {
  const {
    accessibility_rules = {},
    detailed_report = true,
    custom_checks = []
  } = args;

  const testRunnerConfig = `import { injectAxe, checkA11y } from "axe-playwright";
import type { TestRunnerConfig } from "@storybook/test-runner";

const config: TestRunnerConfig = {
    async preVisit(page, context) {
        await injectAxe(page);
    },

    async postVisit(page, context) {
        await checkA11y(page, "#storybook-root", {
            axeOptions: {
                rules: ${JSON.stringify(accessibility_rules, null, 16)}
            },
            detailedReport: ${detailed_report},
            detailedReportOptions: {
                html: true
            }
        });
        ${custom_checks.length > 0 ? `
        // Custom checks
        ${custom_checks.join('\n        ')}` : ''}
    }
};

export default config;`;

  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        config_type: "test-runner",
        configuration: testRunnerConfig,
        file_path: ".storybook/test-runner.ts",
        features: ["Accessibility testing", "Detailed HTML reports", "Custom rule configuration"]
      }, null, 2)
    }]
  };
}

async function generatePlaywrightConfig(args) {
  const {
    headless = true,
    browser_args = ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"]
  } = args;

  const playwrightConfig = `import { defineConfig } from "@playwright/test";

export default defineConfig({
    use: {
        headless: ${headless},
        launchOptions: {
            args: ${JSON.stringify(browser_args)}
        }
    }
});`;

  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        config_type: "playwright",
        configuration: playwrightConfig,
        file_path: "playwright.config.ts"
      }, null, 2)
    }]
  };
}

async function generateStorybookConfig(args) {
  const { addons = [], framework = "react-webpack5" } = args;

  const defaultAddons = [
    "@storybook/addon-links",
    "@storybook/addon-essentials",
    "@storybook/addon-interactions",
    "@storybook/addon-webpack5-compiler-babel",
    "@storybook/addon-a11y"
  ];

  const configTemplate = `import type { StorybookConfig } from '@storybook/${framework}';

const config: StorybookConfig = {
    stories: ['../**/*.stories.@(js|jsx|ts|tsx)'],

    addons: ${JSON.stringify([...defaultAddons, ...addons], null, 8)},

    framework: {
        name: "@storybook/${framework}",
        options: {},
    },

    babel: (options) => {
        options.presets = options.presets || [];
        options.presets.push(["@babel/preset-typescript", { allowDeclareFields: true }]);
        return options;
    },

    webpackFinal: (config) => {
        config.module ??= {};
        config.module.rules ??= [];
        config.module.rules.push({
            test: /\\.(ts|tsx)$/,
            use: [
                {
                    loader: 'babel-loader',
                    options: {
                        presets: ['@babel/preset-env', '@babel/preset-react', '@babel/preset-typescript'],
                    },
                }
            ],
        });
        return config;
    },

    docs: {
        autodocs: true
    },

    typescript: {
        reactDocgen: 'react-docgen-typescript'
    }
};

export default config;`;

  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        config_type: "storybook-main",
        configuration: configTemplate,
        file_path: ".storybook/main.ts",
        features: ["TypeScript support", "Auto documentation", "Webpack 5", "Babel configuration"]
      }, null, 2)
    }]
  };
}

async function generatePackageScripts(args) {
  const {
    include_ci_scripts = true,
    custom_port = 6006,
    max_workers = 2,
    additional_scripts = {}
  } = args;

  const baseScripts = {
    "serve-storybook": `storybook dev -p ${custom_port}`,
    "build-storybook": "storybook build",
    "test-storybook": `test-storybook --ci --junit --maxWorkers=${max_workers}`
  };

  const ciScripts = include_ci_scripts ? {
    "build-storybook:ci": `npm run build-storybook && npx http-server storybook-static --port ${custom_port}`,
    "test-storybook:ci": `npx concurrently -k -s first -n "SB,TEST" -c "magenta,blue" "npm run build-storybook:ci" "npx wait-on tcp:127.0.0.1:${custom_port} && npm run test-storybook"`
  } : {};

  const scripts = {
    ...baseScripts,
    ...ciScripts,
    ...additional_scripts
  };

  const packageJsonUpdate = {
    scripts,
    devDependencies: {
      "@storybook/react-webpack5": "^8.0.0",
      "@storybook/addon-a11y": "^8.0.0",
      "@storybook/addon-interactions": "^8.0.0",
      "@storybook/addon-essentials": "^8.0.0",
      "@storybook/addon-links": "^8.0.0",
      "@storybook/addon-webpack5-compiler-babel": "^3.0.0",
      "@storybook/testing-library": "^0.2.0",
      "@storybook/jest": "^0.2.0",
      "@storybook/test-runner": "^0.19.0",
      "axe-playwright": "^2.0.0",
      "playwright": "^1.40.0",
      "concurrently": "^8.0.0",
      "wait-on": "^7.0.0",
      "http-server": "^14.0.0"
    }
  };

  const instructions = `
## Package.json Update Instructions

1. Add the following scripts to your package.json:
\`\`\`json
${JSON.stringify(scripts, null, 2)}
\`\`\`

2. Ensure you have the required devDependencies installed:
\`\`\`bash
npm install --save-dev @storybook/react-webpack5 @storybook/addon-a11y @storybook/addon-interactions @storybook/addon-essentials @storybook/addon-links @storybook/addon-webpack5-compiler-babel @storybook/testing-library @storybook/jest @storybook/test-runner axe-playwright playwright concurrently wait-on http-server
\`\`\`

## Script Descriptions:
- **serve-storybook**: Start Storybook development server on port ${custom_port}
- **build-storybook**: Build static Storybook for production
- **test-storybook**: Run Storybook tests with Jest and JUnit reporting (max ${max_workers} workers)
- **build-storybook:ci**: Build Storybook and serve it with http-server for CI environments
- **test-storybook:ci**: Run Storybook build and tests concurrently for CI pipelines

## CI/CD Integration:
The CI scripts are optimized for continuous integration environments:
- Uses concurrently to run build and test in parallel
- Waits for the server to be ready before running tests
- Outputs colored logs for better visibility
- Kills all processes when the first one completes
`;

  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        package_json_update: packageJsonUpdate,
        instructions,
        scripts_added: Object.keys(scripts),
        ci_ready: include_ci_scripts,
        features: [
          "Development server script",
          "Production build script",
          "Test runner with JUnit reporting",
          include_ci_scripts ? "CI-optimized scripts" : null,
          include_ci_scripts ? "Concurrent build and test execution" : null
        ].filter(Boolean)
      }, null, 2)
    }]
  };
}

async function getInstructions(args) {
  const { instruction_type } = args;

  const instructions = {
    setup: {
      overview: "Complete Storybook setup with testing and accessibility",
      required_packages: [
        "@storybook/react-webpack5",
        "@storybook/addon-a11y",
        "@storybook/addon-interactions",
        "@storybook/testing-library",
        "@storybook/jest",
        "@storybook/test-runner",
        "axe-playwright",
        "@fluentui/react-components"
      ],
      configuration_files: [
        ".storybook/main.ts - Main configuration",
        ".storybook/preview.ts - Preview configuration with mocks",
        ".storybook/test-runner.ts - Test runner with a11y",
        "playwright.config.ts - Playwright configuration"
      ]
    },
    stories: {
      overview: "Create comprehensive Storybook stories with CSF3 format",
      requirements: [
        "Use CSF3 format with TypeScript",
        "Include Fluent UI theme variants (light/dark)",
        "Add RTL support testing",
        "Implement play functions for interaction testing",
        "Add accessibility testing in play functions",
        "Include edge cases (empty, loading, error states)",
        "Mock data for complex components"
      ],
      best_practices: [
        "Group related stories logically",
        "Use within() for scoped queries",
        "Test hover/click interactions with userEvent",
        "Use waitFor for async operations",
        "Test accessibility with toHaveNoViolations",
        "Provide meaningful test descriptions"
      ]
    },
    accessibility: {
      overview: "Implement comprehensive accessibility testing",
      tools: ["@storybook/addon-a11y", "axe-playwright", "jest-axe"],
      rules_configuration: {
        "color-contrast": "Check color contrast ratios",
        "aria-hidden-focus": "Ensure focusable elements aren't hidden",
        "region": "Ensure all content is in landmarks",
        "label": "Ensure form elements have labels"
      },
      testing_approach: [
        "Inject axe-core in preVisit",
        "Run checkA11y in postVisit",
        "Generate detailed HTML reports",
        "Configure rules based on requirements"
      ]
    },
    testing: {
      overview: "Comprehensive testing strategy",
      interaction_testing: [
        "Use @storybook/testing-library for DOM queries",
        "Use @storybook/jest for assertions",
        "Test user interactions with userEvent",
        "Test async behavior with waitFor"
      ],
      test_scenarios: [
        "Component rendering",
        "User interactions (click, hover, type)",
        "State changes",
        "Accessibility compliance",
        "Theme switching",
        "RTL support",
        "Error handling",
        "Loading states",
        "Empty states"
      ]
    },
    charts: {
      overview: "Testing strategy for chart components",
      specific_tests: [
        "Data rendering verification",
        "Tooltip interactions",
        "Legend interactions",
        "Responsive behavior",
        "Theme integration",
        "Large dataset handling",
        "Empty data handling"
      ],
      mock_data_structure: {
        nodes: "Array of node objects with nodeId, name, color",
        links: "Array of link objects with source, target, dataSourceKey",
        dataset: "Object mapping dataSourceKey to numeric values"
      }
    },
    scripts: {
      overview: "Package.json scripts for Storybook development and testing",
      base_scripts: {
        "serve-storybook": "Start Storybook development server",
        "build-storybook": "Build static Storybook for production",
        "test-storybook": "Run Storybook tests with test-runner"
      },
      ci_scripts: {
        "build-storybook:ci": "Build and serve Storybook for CI",
        "test-storybook:ci": "Run build and tests concurrently for CI"
      },
      required_packages: [
        "concurrently - Run multiple commands concurrently",
        "wait-on - Wait for resources to be available",
        "http-server - Simple static file server",
        "@storybook/test-runner - Test runner for Storybook",
        "playwright - Browser automation for testing"
      ],
      ci_benefits: [
        "Parallel execution saves CI time",
        "Automatic server startup and shutdown",
        "JUnit output for CI reporting",
        "Colored logs for debugging",
        "Graceful process termination"
      ]
    }
  };

  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        instruction_type,
        instructions: instructions[instruction_type] || instructions,
        current_setup: {
          framework: "React with TypeScript",
          ui_library: "Fluent UI v9",
          test_runner: "@storybook/test-runner with Playwright",
          accessibility: "axe-playwright integration",
          story_format: "CSF3 with TypeScript"
        }
      }, null, 2)
    }]
  };
}

const server = new Server({ name: "storybook-manager-mcp", version: "0.3.0" }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "generate_story",
      description: "Generate comprehensive Storybook story with CSF3 format, testing, and accessibility",
      inputSchema: {
        type: "object",
        properties: {
          component_name: { type: "string", description: "Name of the component" },
          component_type: {
            type: "string",
            enum: ["standard", "chart", "data-grid", "form"],
            description: "Type of component for specialized story generation"
          },
          story_variants: {
            type: "array",
            items: { type: "string" },
            description: "Story variants to generate (Default, Dark, RTL, Empty, Loading, Error, etc.)"
          },
          has_interactions: { type: "boolean", description: "Include play functions for testing" },
          has_accessibility: { type: "boolean", description: "Include accessibility testing" },
          props_interface: { type: "object", description: "Component props interface" },
          mock_data: { type: "object", description: "Mock data for the component" },
          fluent_theme: { type: "boolean", description: "Use Fluent UI theming" }
        },
        required: ["component_name"]
      }
    },
    {
      name: "generate_test_runner",
      description: "Generate test-runner configuration with accessibility testing",
      inputSchema: {
        type: "object",
        properties: {
          accessibility_rules: { type: "object", description: "Axe rules configuration" },
          detailed_report: { type: "boolean", description: "Generate detailed HTML reports" },
          custom_checks: { type: "array", items: { type: "string" }, description: "Custom test checks" }
        }
      }
    },
    {
      name: "generate_playwright_config",
      description: "Generate Playwright configuration for Storybook test-runner",
      inputSchema: {
        type: "object",
        properties: {
          headless: { type: "boolean", description: "Run in headless mode" },
          browser_args: { type: "array", items: { type: "string" }, description: "Browser launch arguments" }
        }
      }
    },
    {
      name: "generate_storybook_config",
      description: "Generate main Storybook configuration",
      inputSchema: {
        type: "object",
        properties: {
          addons: { type: "array", items: { type: "string" }, description: "Additional Storybook addons" },
          framework: { type: "string", description: "Storybook framework" }
        }
      }
    },
    {
      name: "generate_package_scripts",
      description: "Generate package.json scripts for Storybook development, testing, and CI/CD",
      inputSchema: {
        type: "object",
        properties: {
          include_ci_scripts: { type: "boolean", description: "Include CI/CD optimized scripts" },
          custom_port: { type: "number", description: "Custom port for Storybook server" },
          max_workers: { type: "number", description: "Maximum number of test workers" },
          additional_scripts: { type: "object", description: "Additional custom scripts to include" }
        }
      }
    },
    {
      name: "get_instructions",
      description: "Get comprehensive Storybook development instructions",
      inputSchema: {
        type: "object",
        properties: {
          instruction_type: {
            type: "string",
            enum: ["setup", "stories", "accessibility", "testing", "charts", "scripts"],
            description: "Type of instructions needed"
          }
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
    case "generate_test_runner":
      return await generateTestRunner(request.params.arguments || {});
    case "generate_playwright_config":
      return await generatePlaywrightConfig(request.params.arguments || {});
    case "generate_storybook_config":
      return await generateStorybookConfig(request.params.arguments || {});
    case "generate_package_scripts":
      return await generatePackageScripts(request.params.arguments || {});
    case "get_instructions":
      return await getInstructions(request.params.arguments || {});
    default:
      throw new Error(`Unknown tool: ${request.params.name}`);
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("StorybookManager MCP server v0.3.0 running - Enhanced with package.json scripts generation");