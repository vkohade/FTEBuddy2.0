import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

async function generateComponent(args) {
  const { component_spec, design_tokens } = args;
  const { name, props, state, accessibility_features, pcf_context } = component_spec;

  // Define PCF Control architecture requirements
  const pcfRequirements = {
    architecture_pattern: "PCF Control with Root Element and updateView integration",
    fluent_provider_location: "Root element only - not in individual components",
    rendering_method: "updateView method renders the Root element",
    component_structure: {
      root_element: `${name}Root - Main container with FluentProvider`,
      main_component: `${name} - Core component logic without FluentProvider`,
      supporting_components: "Additional components as needed based on specifications"
    },
    required_imports: [
      "@fluentui/react-components (makeStyles, tokens, FluentProvider, webLightTheme, webDarkTheme)",
      "@fluentui/react-icons (as specified in component_spec.required_icons)",
      "React hooks (useState, useCallback, useId, useMemo, useEffect as needed)"
    ],
    pcf_integration: {
      context_usage: "Use ComponentFramework.Context<IInputs> for theme and RTL detection",
      theme_detection: "context.fluentDesignLanguage?.isDarkTheme",
      rtl_detection: "context.userSettings.isRTL",
      update_view: "Render root element in updateView method"
    }
  };

  const implementationRequirements = {
    styling_requirements: [
      "Use makeStyles with Fluent UI design tokens exclusively",
      "Never use hard-coded colors, spacing, or typography values",
      "Support both light and dark themes automatically",
      "Implement RTL support using CSS logical properties",
      "Use semantic color tokens (e.g., colorNeutralBackground1)"
    ],
    accessibility_requirements: [
      "Implement WCAG 2.1 AA compliance",
      "Use semantic HTML elements and proper ARIA attributes",
      "Ensure keyboard navigation support",
      "Provide proper focus management",
      "Include accessible names and descriptions"
    ],
    performance_requirements: [
      "Use React.memo for pure components when appropriate",
      "Implement useMemo for expensive calculations", 
      "Use useCallback for event handlers",
      "Avoid inline object/function creation in render",
      "Implement proper dependency arrays in hooks"
    ],
    typescript_requirements: [
      "Use TypeScript strict mode",
      "Define proper interfaces for all props and state",
      "Include proper error handling with try-catch blocks",
      "Use proper typing for all variables and functions"
    ]
  };

  return {
    content: [{
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
          pcf_context: pcf_context || {}
        },
        files_to_create: [
          `src/Root.tsx - Root component with FluentProvider`,
          `src/components/${name}.tsx - Main component implementation`,
          `src/components/index.ts - Barrel exports`,
          `src/styles/${name}Styles.ts - Component-specific styles`
        ],
        architecture_notes: [
          "Root element should wrap the entire control with FluentProvider",
          "updateView method should render the Root element",
          "Individual components should NOT include FluentProvider",
          "Use PCF context for theme and RTL detection",
          "Follow PCF control lifecycle methods"
        ],
        quality_gates: [
          "Accessibility score >= 85%",
          "Performance optimized with proper memoization", 
          "Full TypeScript strict mode compliance",
          "Fluent UI design system compliance"
        ]
      })
    }]
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

async function validateAccessibility(args) {
  const { component_code } = args;

  const accessibilityValidation = {
    wcag_compliance_checklist: {
      "1.1.1 Non-text Content": "All images have alt text or are decorative",
      "1.4.3 Contrast (Minimum)": "Color contrast ratio meets 4.5:1 for normal text",
      "1.4.11 Non-text Contrast": "UI components have 3:1 contrast ratio",
      "2.1.1 Keyboard": "All functionality available from keyboard",
      "2.1.2 No Keyboard Trap": "Focus can move away from component",
      "2.4.3 Focus Order": "Focus order is logical and meaningful",
      "2.4.7 Focus Visible": "Focus indicator is visible",
      "3.2.1 On Focus": "No unexpected context changes on focus",
      "4.1.1 Parsing": "Valid HTML/ARIA markup",
      "4.1.2 Name, Role, Value": "All elements have accessible names"
    },
    validation_criteria: [
      "Proper ARIA attributes and roles implementation",
      "Semantic HTML element usage",
      "Keyboard navigation support",
      "Screen reader compatibility",
      "Focus management implementation",
      "Color contrast compliance",
      "Alternative text for non-text content"
    ]
  };

  // Simple heuristic analysis - in real implementation, would use proper AST parsing
  const issues = [];
  const warnings = [];
  const suggestions = [];

  // Basic code analysis
  if (!component_code.includes('aria-label') && !component_code.includes('aria-labelledby')) {
    issues.push("Missing accessible name - implement aria-label or aria-labelledby");
  }

  if (!component_code.includes('role=') && !component_code.includes('semantic')) {
    warnings.push("Consider using semantic HTML elements or explicit ARIA roles");
  }

  if (!component_code.includes('onKeyDown') && !component_code.includes('keyboard')) {
    suggestions.push("Implement keyboard event handling for interactive elements");
  }

  const accessibilityScore = Math.max(0, 100 - (issues.length * 20) - (warnings.length * 10));

  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        accessibility_score: accessibilityScore,
        wcag_compliance_checklist: accessibilityValidation.wcag_compliance_checklist,
        validation_criteria: accessibilityValidation.validation_criteria,
        analysis_results: {
          issues,
          warnings,
          suggestions
        },
        compliance_levels: {
          "WCAG 2.1 A": issues.length === 0,
          "WCAG 2.1 AA": issues.length === 0 && warnings.length <= 2,
          "WCAG 2.1 AAA": issues.length === 0 && warnings.length === 0
        },
        remediation_priority: issues.length > 0 ? "High - Fix critical accessibility issues" :
                             warnings.length > 0 ? "Medium - Address accessibility warnings" :
                             "Low - Consider accessibility enhancements",
        next_steps: [
          "Run automated accessibility tests with jest-axe",
          "Perform manual testing with screen readers",
          "Test keyboard navigation thoroughly",
          "Validate color contrast ratios",
          "Test with Windows High Contrast mode"
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
    },

    accessibility: {
      overview: "Ensure WCAG 2.1 AA compliance with comprehensive accessibility support",
      pcf_accessibility_requirements: [
        "PCF controls must be fully keyboard accessible",
        "Support screen readers with proper ARIA implementation",
        "Integrate with Dynamics 365 accessibility features",
        "Handle focus management within the control boundary",
        "Provide accessible error messaging and validation"
      ],
      implementation_requirements: {
        semantic_html: [
          "Use appropriate HTML elements (button, input, select, etc.)",
          "Implement proper heading hierarchy when applicable",
          "Use lists for grouped content",
          "Apply semantic roles where HTML elements are insufficient"
        ],
        aria_implementation: [
          "aria-label or aria-labelledby for all interactive elements",
          "aria-describedby for additional context or help text",
          "aria-expanded for collapsible content",
          "aria-selected for selectable items",
          "aria-invalid and aria-errormessage for form validation"
        ],
        keyboard_navigation: [
          "All interactive elements accessible via Tab key",
          "Arrow key navigation for composite widgets",
          "Enter and Space key activation for custom controls",
          "Escape key handling for dismissing overlays",
          "Home/End keys for beginning/end navigation where appropriate"
        ],
        focus_management: [
          "Visible focus indicators meeting contrast requirements",
          "Logical tab order throughout the component",
          "Focus trapping in modal or overlay scenarios",
          "Focus restoration when dismissing overlays",
          "Skip links for complex components"
        ]
      }
    },

    performance: {
      overview: "Optimize PCF controls for enterprise-scale Dynamics 365 environments",
      pcf_performance_considerations: [
        "PCF controls render within Dynamics 365 forms with multiple controls",
        "Optimize for frequent updateView calls from D365",
        "Handle large datasets efficiently in dataset controls",
        "Minimize bundle size for faster control loading",
        "Implement efficient change detection for property updates"
      ],
      react_optimization_techniques: [
        "Use React.memo for pure components to prevent unnecessary re-renders",
        "Implement useMemo for expensive calculations and derived state",
        "Use useCallback for event handlers to maintain stable references",
        "Avoid creating objects/arrays in render methods",
        "Implement proper dependency arrays in useEffect and useMemo"
      ],
      rendering_optimization: [
        "Minimize DOM nodes and nesting depth",
        "Use CSS transforms for animations instead of layout properties",
        "Implement virtualization for large lists",
        "Debounce user input handling",
        "Use requestAnimationFrame for smooth animations"
      ],
      bundle_optimization: [
        "Configure tree shaking to eliminate unused code",
        "Use dynamic imports for optional features",
        "Optimize Fluent UI imports (specific components vs. barrel imports)",
        "Minimize third-party dependencies",
        "Use production builds for deployment"
      ],
      memory_management: [
        "Clean up event listeners in useEffect cleanup",
        "Dispose of subscriptions and timers properly",
        "Avoid memory leaks in closures",
        "Use WeakMap/WeakSet for object associations",
        "Monitor memory usage in development"
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
      name: "validate_accessibility",
      description: "Validate component accessibility compliance against WCAG 2.1 AA standards",
      inputSchema: {
        type: "object",
        properties: {
          component_code: { type: "string", description: "Component code to validate" }
        },
        required: ["component_code"]
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
            enum: ["styling", "accessibility", "performance"],
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
    case "validate_accessibility":
      return await validateAccessibility(request.params.arguments || {});
    case "get_instructions":
      return await getInstructions(request.params.arguments || {});
    default:
      throw new Error(`Unknown tool: ${request.params.name}`);
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("PCFControlManager MCP server running - v0.2.0 (Requirements-focused)");