import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

async function generateComponent(args) {
  const { component_spec, design_tokens } = args;
  const { name, props, state, accessibility_features, pcf_context } =
    component_spec;

  // Define PCF Control architecture requirements as MCP instructions
  const pcfRequirements = {
    architecture_pattern:
      "Implement a PCF Control with a dedicated Root element and updateView integration.",
    fluent_provider_location:
      "FluentProvider must only be included at the Root element, never in child components.",
    rendering_method:
      "The updateView method must render the Root element using ReactDOM.createRoot.",
    component_structure: {
      root_element: `${name}Root - Main container wrapping content with FluentProvider.`,
      main_component: `${name} - Core component logic (exclude FluentProvider).`,
      supporting_components: "Add supporting components only if required.",
    },
    required_imports: [
      "Import from @fluentui/react-components (makeStyles, tokens, FluentProvider, webLightTheme, webDarkTheme).",
      "Import from @fluentui/react-icons as defined in component_spec.required_icons.",
      "Use React hooks (useState, useCallback, useId, useMemo, useEffect) as needed.",
      "Always use double quotes (\") for import statements (e.g., import { KPIDashboardRoot } from \"./src/KPIDashboardRoot\";) and never convert them to single quotes",
    ],
    pcf_integration: {
      context_usage:
        "Use ComponentFramework.Context<IInputs> for theme (light/dark) and RTL detection",
      theme_detection: "context.fluentDesignLanguage?.isDarkTheme",
      rtl_detection: "context.userSettings.isRTL",
      update_view:
        "Render Root element in updateView method using ReactDOM.createRoot",
      IInputsAndIOutputs:
        "Ensure IInputs and IOutputs in ManifestTypes.d.ts match the definitions in ControlManifest.Input.xml",
      lifecycle_methods: [
        "init - Initialize state and context, prepare container",
        "updateView - Render Root element, pass context and props/state, consider returning React.Element if needed",
        "getOutputs - Return output properties if applicable",
        "destroy - Properly unmount React components and clean up resources",
      ],
      check_Errors:
        "Ensure the generated code compiles without TypeScript errors and reiterate until all errors are fixed",
      runtime_validation:
        "Run and validate the control until no runtime errors are observed",
      re_edit:
        "Iteratively fix and re-edit all component/control files (including styles, root, main component, and manifest integration) until there are no TypeScript, ESLint, or runtime errors. The final code must be build-ready.",
      create_files: [
        `src/${name}Root.tsx - Root component containing FluentProvider (must be created)`,
        `src/components/${name}.tsx - Main component implementation (must be created)`,
        `src/styles/${name}Styles.ts - Component-specific styles (must be created)`,
      ],
      file_restrictions:
        "Do not create a new index.tsx file for lifecycle methods. Always use the existing index.ts file for lifecycle logic.",
      build_commands: [
        "Run `npm run build` to validate compilation",
        "Run `npm start watch` (or equivalent PCF CLI command) to test the control live",
      ],
      quality_gate:
        "Do not stop until the code passes TypeScript compilation, ESLint checks, and builds successfully with no errors.",
    },
  };

  const implementationRequirements = {
    styling_requirements: [
      "Use makeStyles with Fluent UI design tokens exclusively.",
      "Do not hard-code colors, spacing, or typography values.",
      "Support both light and dark themes automatically.",
      "Implement RTL support using CSS logical properties.",
      "Use semantic Fluent UI tokens (e.g., colorNeutralBackground1).",
    ],
    typescript_requirements: [
      "Enable strict mode in TypeScript.",
      "Define proper interfaces for all props and state.",
      "Use try-catch for error handling.",
      "Apply strict typing for all variables and functions.",
    ],
  };

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({
          component_name: name,
          pcf_requirements: pcfRequirements,
          implementation_requirements: implementationRequirements,
          component_specifications: {
            name,
            props: props || {},
            state: state || {},
            accessibility_features: accessibility_features || {},
            design_tokens: design_tokens || {},
            pcf_context: pcf_context || {},
          },
          architecture_notes: [
            "Root element must wrap the entire control with FluentProvider.",
            "updateView must render the Root element.",
            "Individual components must not include FluentProvider.",
            "Use PCF context for theme and RTL detection.",
            "Follow standard PCF lifecycle methods.",
          ],
          quality_gates: [
            "Accessibility score must be >= 85%.",
            "Performance must be optimized with proper memoization.",
            "Strict TypeScript compliance.",
            "Fluent UI v9 design system compliance.",
            "All compilation and runtime errors must be resolved before completion.",
          ],
          build_validation: [
            "Always run `npm run build` after code generation.",
            "Always run `npm start watch` to validate runtime execution.",
          ],
        }),
      },
    ],
  };
}

async function generateStyles(args) {
  const { style_spec, theme_support = true } = args;
  const { component, tokens, responsive, animations } = style_spec;

  const stylingRequirements = {
    design_token_usage: [
      "Use Fluent UI design tokens exclusively from @fluentui/react-components",
      "Never use hard-coded values for colors, spacing, typography",
      "Use semantic tokens (colorNeutralBackground1) over primitive tokens",
      "Leverage token categories: spacing, colors, typography, borders, shadows"
    ],
    theme_support_requirements: theme_support ? [
      "Automatic theme switching using Fluent design tokens",
      "Support for webLightTheme and webDarkTheme",
      "Use semantic color tokens that adapt automatically"
    ] : [],
    rtl_support_requirements: [
      "Use CSS logical properties (margin-inline-start vs margin-left)",
      "Implement RTL-specific styles where needed", 
      "Use Fluent UI's RTL-aware components"
    ],
    responsive_design_requirements: responsive ? [
      "Implement mobile-first responsive design",
      "Use CSS media queries within makeStyles",
      "Ensure touch-friendly interactive elements"
    ] : [],
    performance_requirements: [
      "Memoize styles with makeStyles",
      "Avoid style recalculations",
      "Use efficient CSS selectors",
      "Minimize style complexity"
    ]
  };

  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        component_name: component,
        styling_requirements: stylingRequirements,
        style_specifications: {
          component,
          tokens: tokens || {},
          responsive: responsive || {},
          animations: animations || {},
          theme_support
        },
        implementation_notes: [
          "Create styles using makeStyles from @fluentui/react-components",
          "Structure styles with logical hierarchy (root, container, elements)",
          "Include interaction states (hover, focus, disabled)",
          "Implement animation classes if specified",
          "Add RTL support for directional properties"
        ],
        required_features: [
          "Fluent UI design token integration",
          "Theme-aware styling",
          "RTL layout support", 
          "Responsive breakpoints (if specified)",
          "Accessibility focus states",
          "Performance-optimized styles"
        ]
      })
    }]
  };
}

async function getInstructions(args) {
  const { instruction_type } = args;

  const instructions = {
    styling: {
      overview: "Create maintainable, accessible styles using Fluent UI v9 design tokens",
      core_principles: [
        "Use Fluent UI design tokens exclusively - never hard-code values",
        "Implement automatic theme support (light/dark)",
        "Support RTL layouts with CSS logical properties",
        "Follow Fluent design system guidelines",
        "Optimize for performance with memoized styles"
      ],
      pcf_specific_requirements: [
        "Apply FluentProvider only at the root component level",
        "Use PCF context for theme detection: context.fluentDesignLanguage?.isDarkTheme",
        "Use PCF context for RTL detection: context.userSettings.isRTL",
        "Integrate with PCF lifecycle methods (updateView, getOutputs)",
        "Handle PCF control resizing and container constraints"
      ],
      design_token_categories: {
        colors: "colorNeutral*, colorBrand*, colorSuccess*, colorError*, colorWarning*",
        spacing: "spacingVertical*, spacingHorizontal*",
        typography: "fontFamily*, fontSize*, fontWeight*, lineHeight*",
        borders: "borderRadius*, strokeWidth*",
        shadows: "shadow*",
        motion: "duration*, curve*"
      },
      implementation_patterns: [
        "Create component-specific style files using makeStyles",
        "Structure styles hierarchically (root → containers → elements)",
        "Include all interaction states (default, hover, focus, disabled, active)",
        "Implement responsive breakpoints when specified",
        "Add animation classes for enhanced user experience"
      ]
    }
  };

  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        instruction_type,
        instructions: instructions[instruction_type],
        context: {
          server: "PCFControlManager MCP Server",
          purpose: "Generate PCF control components following enterprise standards",
          pcf_architecture: {
            root_component_pattern: "Use Root element with FluentProvider wrapper",
            update_view_integration: "Render root element in updateView method", 
            context_usage: "Leverage PCF context for theme and RTL detection",
            lifecycle_integration: "Follow PCF control lifecycle patterns"
          },
          integration_points: [
            "TemplateManager: Receives scaffolded PCF project structure",
            "StorybookManager: Provides components for interactive documentation",
            "PerformanceManager: Analyzes and optimizes component performance"
          ]
        }
      })
    }]
  };
}

const server = new Server({ name: "pcf-control-manager-mcp", version: "0.2.0" }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "generate_component",
      description: "Generate PCF control component requirements and architecture specifications",
      inputSchema: {
        type: "object",
        properties: {
          component_spec: {
            type: "object",
            properties: {
              name: { type: "string", description: "Component name" },
              props: { type: "object", description: "Component props definition" },
              state: { type: "object", description: "Component state definition" },
              accessibility_features: { type: "object", description: "Accessibility requirements" },
              required_icons: { type: "array", items: { type: "string" }, description: "Required Fluent icons" },
              pcf_context: { type: "object", description: "PCF-specific context and requirements" }
            },
            required: ["name"]
          },
          design_tokens: { type: "object", description: "Design token specifications" }
        },
        required: ["component_spec"]
      }
    },
    {
      name: "generate_styles",
      description: "Generate styling requirements and specifications using Fluent UI design tokens",
      inputSchema: {
        type: "object",
        properties: {
          style_spec: {
            type: "object",
            properties: {
              component: { type: "string", description: "Component name" },
              tokens: { type: "object", description: "Style specifications" },
              responsive: { type: "object", description: "Responsive breakpoint styles" },
              animations: { type: "object", description: "Animation definitions" }
            },
            required: ["component"]
          },
          theme_support: { type: "boolean", default: true, description: "Enable theme support" }
        },
        required: ["style_spec"]
      }
    },
    {
      name: "get_instructions",
      description: "Get comprehensive PCF control development instructions and best practices",
      inputSchema: {
        type: "object",
        properties: {
          instruction_type: {
            type: "string",
            enum: ["styling"],
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
    case "generate_component":
      return await generateComponent(request.params.arguments || {});
    case "generate_styles":
      return await generateStyles(request.params.arguments || {});
    case "get_instructions":
      return await getInstructions(request.params.arguments || {});
    default:
      throw new Error(`Unknown tool: ${request.params.name}`);
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("PCFControlManager MCP server running - v0.2.0 (Requirements-focused)");