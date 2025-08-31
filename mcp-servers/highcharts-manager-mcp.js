import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

async function generateChart(args) {
  const { chart_spec, theme_integration = true } = args;
  const { chart_type, data_structure, accessibility_features, rtl_support } = chart_spec;

  const highchartsRequirements = {
    architecture_pattern: "React component with Highcharts integration using useEffect lifecycle",
    required_modules: [
      "highcharts/highcharts - Core Highcharts library",
      "highcharts/modules/accessibility - REQUIRED for a11y compliance",
      "highcharts/themes/dark-unica - Dark theme support (optional)",
      "highcharts-react-official - Official React wrapper"
    ],
    fluent_integration: {
      theme_detection: "Use Fluent UI theme tokens for chart styling",
      design_tokens: "Apply Fluent color palette to chart series and UI elements",
      container_integration: "Chart container should use Fluent UI styling patterns"
    },
    accessibility_requirements: {
      mandatory_setup: "Accessibility module MUST be imported and initialized",
      wcag_compliance: "Charts must meet WCAG 2.1 AA standards",
      screen_reader_support: "Provide comprehensive description and data table",
      keyboard_navigation: "Enable keyboard navigation through chart elements"
    }
  };

  const implementationRequirements = {
    react_integration: [
      "Use useRef for chart container element",
      "Initialize chart in useEffect with proper cleanup",
      "Handle chart updates through useEffect dependencies",
      "Implement proper error boundaries for chart failures",
      "Use useCallback for event handlers to prevent re-renders"
    ],
    accessibility_implementation: [
      "Import and initialize Highcharts accessibility module",
      "Provide meaningful chart title and subtitle",
      "Include comprehensive description for screen readers", 
      "Generate accessible data table as fallback",
      "Implement keyboard navigation support",
      "Use high contrast colors that meet WCAG standards",
      "Provide alternative text for chart images"
    ],
    theme_integration: [
      "Detect theme from Fluent UI context (light/dark)",
      "Apply Fluent design tokens to chart colors and styling",
      "Create theme-aware chart options",
      "Support automatic theme switching",
      "Use semantic colors from Fluent token system"
    ],
    rtl_support: [
      "Detect RTL direction from PCF context or Fluent provider",
      "Apply RTL-specific chart configurations",
      "Reverse chart orientations for RTL layouts",
      "Adjust text alignment and positioning",
      "Test chart behavior in both LTR and RTL modes"
    ],
    performance_optimization: [
      "Use React.memo for chart components",
      "Implement proper shouldUpdate logic for chart updates",
      "Optimize data processing before passing to Highcharts",
      "Use animation configurations appropriate for PCF environment",
      "Handle large datasets with data grouping or sampling"
    ]
  };

  const chartTypeRequirements = {
    line_chart: {
      accessibility: "Describe trend and key data points",
      rtl_considerations: "Time series axes remain left-to-right",
      performance: "Use turboThreshold for large datasets"
    },
    bar_chart: {
      accessibility: "Provide category and value descriptions",
      rtl_considerations: "Reverse horizontal bar orientations",
      performance: "Consider data labels for clarity"
    },
    pie_chart: {
      accessibility: "Describe each segment with percentage",
      rtl_considerations: "Maintain clockwise direction",
      performance: "Limit number of visible segments"
    },
    scatter_chart: {
      accessibility: "Describe correlation and outliers",
      rtl_considerations: "Maintain x/y axis orientations",
      performance: "Use marker clustering for large datasets"
    },
    column_chart: {
      accessibility: "Describe categories and comparative values",
      rtl_considerations: "Maintain vertical orientation",
      performance: "Group similar categories when possible"
    }
  };

  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        chart_type,
        highcharts_requirements: highchartsRequirements,
        implementation_requirements: implementationRequirements,
        chart_type_requirements: chartTypeRequirements[chart_type] || chartTypeRequirements.line_chart,
        chart_specifications: {
          chart_type,
          data_structure: data_structure || {},
          accessibility_features: accessibility_features || {},
          rtl_support: rtl_support || false,
          theme_integration
        },
        files_to_create: [
          `src/charts/${chart_type.charAt(0).toUpperCase() + chart_type.slice(1)}Chart.tsx - Main chart component`,
          `src/charts/${chart_type.charAt(0).toUpperCase() + chart_type.slice(1)}Chart.test.tsx - Comprehensive test suite`,
          `src/charts/themes/highchartsTheme.ts - Fluent UI theme integration`,
          `src/charts/utils/chartHelpers.ts - Chart utility functions`,
          `src/charts/hooks/useHighcharts.ts - Custom hook for chart lifecycle`
        ],
        required_dependencies: [
          "highcharts - ^11.0.0",
          "highcharts-react-official - ^3.2.0", 
          "@types/highcharts - ^7.0.0"
        ],
        architecture_notes: [
          "Initialize Highcharts accessibility module in app bootstrap",
          "Create theme adapter for Fluent UI token integration",
          "Use custom hook for chart lifecycle management",
          "Implement proper cleanup in component unmount",
          "Handle responsive behavior for different screen sizes"
        ],
        quality_gates: [
          "Accessibility module initialized and configured",
          "WCAG 2.1 AA compliance verified",
          "RTL layout support implemented and tested",
          "Theme integration with Fluent UI tokens",
          "Performance optimized for PCF environment",
          "Keyboard navigation fully functional"
        ]
      })
    }]
  };
}

async function generateThemeIntegration(args) {
  const { fluent_theme_tokens, chart_type } = args;

  const themeIntegrationRequirements = {
    fluent_token_mapping: {
      background_colors: "tokens.colorNeutralBackground1, colorNeutralBackground2",
      text_colors: "tokens.colorNeutralForeground1, colorNeutralForeground2",
      brand_colors: "tokens.colorBrandBackground, colorBrandForeground",
      semantic_colors: "tokens.colorSuccessBackground, colorErrorBackground, colorWarningBackground",
      border_colors: "tokens.colorNeutralStroke1, colorNeutralStroke2"
    },
    theme_detection: [
      "Use FluentProvider context to detect current theme",
      "Implement theme switching without chart re-initialization",
      "Apply appropriate color schemes based on light/dark mode",
      "Ensure sufficient contrast in all theme modes"
    ],
    color_palette_generation: [
      "Generate chart series colors from Fluent brand palette",
      "Ensure accessibility compliance in color choices",
      "Provide fallback colors for colorblind users",
      "Maintain consistent color usage across chart types"
    ],
    responsive_theming: [
      "Adapt chart styling based on container size",
      "Adjust font sizes using Fluent typography tokens",
      "Scale elements appropriately for different screen sizes",
      "Maintain readability across all device types"
    ]
  };

  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        theme_integration_requirements: themeIntegrationRequirements,
        fluent_token_specifications: fluent_theme_tokens || {},
        chart_type,
        implementation_notes: [
          "Create theme adapter function that maps Fluent tokens to Highcharts options",
          "Implement theme switching functionality",
          "Ensure color accessibility in all theme modes",
          "Test theme integration across different chart types"
        ],
        required_features: [
          "Automatic theme detection and application",
          "Fluent UI design token integration", 
          "High contrast mode support",
          "Color accessibility compliance",
          "Smooth theme transition animations"
        ]
      })
    }]
  };
}

async function validateAccessibility(args) {
  const { chart_configuration } = args;

  const accessibilityValidation = {
    highcharts_a11y_checklist: {
      "Accessibility Module": "highcharts/modules/accessibility must be imported and initialized",
      "Chart Description": "Comprehensive description provided via chart.description option",
      "Data Table": "Accessible data table generated as fallback content",
      "Keyboard Navigation": "Chart elements navigable via keyboard",
      "Screen Reader Support": "Proper ARIA labels and descriptions",
      "Color Contrast": "All colors meet WCAG 2.1 AA contrast requirements (4.5:1 for text, 3:1 for graphics)",
      "Alternative Formats": "Data export options available for alternative access"
    },
    wcag_compliance_requirements: {
      "1.1.1 Non-text Content": "Chart includes meaningful alt text and data table",
      "1.4.3 Contrast (Minimum)": "All chart elements meet minimum contrast ratios",
      "2.1.1 Keyboard": "All chart interactions available via keyboard",
      "2.4.6 Headings and Labels": "Chart title and axis labels are descriptive",
      "3.1.3 Unusual Words": "Technical terms in chart are explained",
      "4.1.2 Name, Role, Value": "All interactive elements have accessible names"
    },
    implementation_requirements: [
      "Enable Highcharts accessibility module with proper configuration",
      "Provide comprehensive chart.description for screen readers",
      "Configure keyboard navigation with logical tab order",
      "Implement high contrast color schemes",
      "Generate accessible data tables as fallback content",
      "Provide export options for alternative data access",
      "Test with actual screen readers (NVDA, JAWS, VoiceOver)"
    ]
  };

  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        accessibility_validation: accessibilityValidation,
        chart_configuration: chart_configuration || {},
        validation_requirements: [
          "Verify accessibility module is properly initialized",
          "Test keyboard navigation through all chart elements",
          "Validate screen reader announcements",
          "Check color contrast ratios in all themes",
          "Ensure data table provides equivalent information",
          "Test export functionality for data access"
        ],
        testing_tools: [
          "axe-core for automated accessibility testing",
          "NVDA/JAWS/VoiceOver for screen reader testing",
          "Keyboard navigation testing",
          "Color contrast analyzers",
          "Highcharts accessibility demo for reference"
        ],
        compliance_score_factors: {
          accessibility_module_enabled: "25 points",
          proper_descriptions_provided: "25 points", 
          keyboard_navigation_working: "20 points",
          color_contrast_compliant: "20 points",
          data_table_equivalent: "10 points"
        }
      })
    }]
  };
}

async function getInstructions(args) {
  const { instruction_type } = args;

  const instructions = {
    setup: {
      overview: "Initialize Highcharts with accessibility, theme, and RTL support in React components",
      required_imports: [
        "import Highcharts from 'highcharts';",
        "import HighchartsReact from 'highcharts-react-official';",
        "import AccessibilityModule from 'highcharts/modules/accessibility';",
        "import ExportingModule from 'highcharts/modules/exporting';",
        "import ExportDataModule from 'highcharts/modules/export-data';"
      ],
      initialization_pattern: [
        "Initialize accessibility module in app bootstrap: AccessibilityModule(Highcharts);",
        "Initialize exporting modules: ExportingModule(Highcharts); ExportDataModule(Highcharts);",
        "Create theme adapter function for Fluent UI integration",
        "Set up global Highcharts defaults for accessibility"
      ],
      fluent_integration: [
        "Import Fluent UI design tokens and theme context",
        "Create mapping between Fluent tokens and Highcharts styling",
        "Implement theme detection and switching logic",
        "Apply RTL detection from PCF or Fluent context"
      ]
    },

    accessibility: {
      overview: "Implement comprehensive accessibility support for Highcharts components",
      mandatory_requirements: [
        "Accessibility module MUST be imported and initialized globally",
        "Every chart MUST have a meaningful description",
        "Keyboard navigation MUST be enabled and tested",
        "Color contrast MUST meet WCAG 2.1 AA standards",
        "Alternative data access MUST be provided"
      ],
      implementation_guidelines: {
        chart_description: [
          "Provide chart.description with comprehensive chart summary",
          "Include key insights, trends, and important data points",
          "Describe chart type, axes, and data structure",
          "Mention interactive features available to users"
        ],
        keyboard_navigation: [
          "Enable accessibility.keyboardNavigation in chart options",
          "Configure logical tab order through chart elements",
          "Provide keyboard shortcuts for common actions",
          "Ensure all interactive features work with keyboard only"
        ],
        screen_reader_support: [
          "Configure accessibility.screenReaderSection for data table",
          "Use meaningful series names and point descriptions",
          "Provide context for chart updates and interactions",
          "Test with multiple screen readers"
        ],
        color_accessibility: [
          "Use high contrast colors that meet WCAG standards",
          "Provide pattern or texture alternatives for color coding",
          "Test charts in high contrast mode",
          "Ensure colorblind accessibility with alternative indicators"
        ]
      }
    },

    theme_integration: {
      overview: "Integrate Highcharts with Fluent UI design system and theme switching",
      fluent_theme_mapping: {
        color_mapping: [
          "Map Fluent brand colors to chart series colors",
          "Use Fluent semantic colors for status indicators",
          "Apply Fluent neutral colors for backgrounds and borders",
          "Ensure theme consistency across all chart elements"
        ],
        typography_integration: [
          "Use Fluent typography tokens for chart text",
          "Apply consistent font families and sizes",
          "Implement responsive typography scaling",
          "Maintain text readability in all themes"
        ],
        layout_integration: [
          "Apply Fluent spacing tokens for chart margins and padding",
          "Use Fluent border radius values for chart containers",
          "Implement consistent elevation and shadows",
          "Ensure chart styling matches surrounding UI"
        ]
      },
      theme_switching: [
        "Detect theme changes from Fluent UI context",
        "Update chart options without re-initialization",
        "Animate theme transitions smoothly",
        "Maintain chart state during theme switches"
      ],
      performance_considerations: [
        "Cache theme configurations to avoid recalculation",
        "Use efficient color palette generation",
        "Minimize theme switching impact on chart performance",
        "Optimize for frequent theme changes in development"
      ]
    },

    rtl_support: {
      overview: "Implement comprehensive RTL (right-to-left) layout support for charts",
      rtl_detection: [
        "Use PCF context.userSettings.isRTL for detection",
        "Listen to Fluent UI direction context changes",
        "Implement fallback RTL detection methods",
        "Handle dynamic RTL switching"
      ],
      chart_adaptations: {
        layout_adjustments: [
          "Reverse horizontal chart orientations where appropriate",
          "Adjust text alignment for RTL reading patterns",
          "Modify legend positioning for RTL layouts",
          "Adapt tooltip positioning and alignment"
        ],
        axis_considerations: [
          "Time series axes typically remain LTR",
          "Category axes may need reversal in RTL",
          "Value axes positioning should adapt to RTL",
          "Axis labels and titles need RTL-appropriate alignment"
        ],
        interaction_patterns: [
          "Adapt hover and selection behaviors for RTL",
          "Modify keyboard navigation directions",
          "Adjust zoom and pan interactions",
          "Ensure tooltip positioning works in RTL"
        ]
      },
      testing_requirements: [
        "Test all chart types in both LTR and RTL modes",
        "Verify text rendering and alignment",
        "Check interactive features in RTL layout",
        "Validate accessibility in RTL configurations"
      ]
    },

    performance: {
      overview: "Optimize Highcharts components for PCF and enterprise environments",
      react_optimization: [
        "Use React.memo for chart components to prevent unnecessary re-renders",
        "Implement useCallback for event handlers and update functions",
        "Use useMemo for expensive chart option calculations",
        "Avoid recreating chart options on every render"
      ],
      highcharts_optimization: [
        "Configure appropriate turboThreshold for large datasets",
        "Use data grouping for time series with many points",
        "Implement lazy loading for complex chart features",
        "Optimize animation settings for PCF environment"
      ],
      data_handling: [
        "Process data efficiently before passing to Highcharts",
        "Implement data caching strategies",
        "Use streaming updates for real-time data",
        "Handle large datasets with pagination or sampling"
      ],
      memory_management: [
        "Properly destroy charts in component cleanup",
        "Remove event listeners and subscriptions",
        "Clear references to prevent memory leaks",
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
          server: "HighchartsManager MCP Server",
          purpose: "Generate accessible, theme-aware Highcharts components for PCF controls",
          integration_points: [
            "PCFControlManager: Provides chart components for PCF controls",
            "StorybookManager: Generates interactive chart documentation",
            "TestingManager: Provides accessibility and functionality tests",
            "PerformanceManager: Optimizes chart rendering performance"
          ],
          key_dependencies: [
            "highcharts - Core charting library",
            "highcharts-react-official - React integration",
            "highcharts/modules/accessibility - MANDATORY for a11y",
            "@fluentui/react-components - Theme integration"
          ]
        }
      })
    }]
  };
}

const server = new Server({ name: "highcharts-manager-mcp", version: "0.1.0" }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "generate_chart",
      description: "Generate Highcharts React component with accessibility, theme, and RTL support",
      inputSchema: {
        type: "object",
        properties: {
          chart_spec: {
            type: "object",
            properties: {
              chart_type: { 
                type: "string", 
                enum: ["line", "bar", "column", "pie", "scatter", "area", "spline", "gauge"],
                description: "Type of chart to generate"
              },
              data_structure: { type: "object", description: "Expected data structure and format" },
              accessibility_features: { type: "object", description: "Specific accessibility requirements" },
              rtl_support: { type: "boolean", default: false, description: "Enable RTL layout support" }
            },
            required: ["chart_type"]
          },
          theme_integration: { type: "boolean", default: true, description: "Enable Fluent UI theme integration" }
        },
        required: ["chart_spec"]
      }
    },
    {
      name: "generate_theme_integration",
      description: "Generate Fluent UI theme integration for Highcharts components",
      inputSchema: {
        type: "object",
        properties: {
          fluent_theme_tokens: { type: "object", description: "Fluent UI design tokens to map" },
          chart_type: { type: "string", description: "Chart type for specific theming" }
        },
        required: ["chart_type"]
      }
    },
    {
      name: "validate_accessibility",
      description: "Validate Highcharts accessibility compliance and configuration",
      inputSchema: {
        type: "object",
        properties: {
          chart_configuration: { type: "object", description: "Highcharts configuration to validate" }
        },
        required: ["chart_configuration"]
      }
    },
    {
      name: "get_instructions",
      description: "Get comprehensive Highcharts development instructions",
      inputSchema: {
        type: "object",
        properties: {
          instruction_type: {
            type: "string",
            enum: ["setup", "accessibility", "theme_integration", "rtl_support", "performance"],
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
    case "generate_chart":
      return await generateChart(request.params.arguments || {});
    case "generate_theme_integration":
      return await generateThemeIntegration(request.params.arguments || {});
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
console.error("HighchartsManager MCP server running");