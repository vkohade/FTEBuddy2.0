import fs from "fs";
import { stat } from "fs/promises";
import mammoth from "mammoth";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

async function parseDocument(args) {
  const { document_path } = args;
  if (!fs.existsSync(document_path)) {
    return { content: [{ type: "text", text: JSON.stringify({ error: "File not found", path: document_path }) }] };
  }
  const result = await mammoth.convertToHtml({ path: document_path });
  const rawText = result.value.replace(/<[^>]*>/g, "");
  const stats = await stat(document_path);
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({
          html: result.value,
          raw_text: rawText,
          messages: result.messages,
          metadata: { path: document_path, parsed_at: new Date().toISOString(), size_bytes: stats.size }
        })
      }
    ]
  };
}

async function getInstructions(args) {
  const { document_type, instruction_type = "parsing" } = args;

  const instructions = {
    pm_spec: {
      parsing: {
        objective: "Extract business requirements and user-facing specifications for Dynamics 365 and PCF control development",
        extraction_targets: [
          {
            section: "Business Requirements",
            elements: ["User stories", "Acceptance criteria", "Business rules", "Stakeholder needs"],
            format: "Structured JSON with story_id, description, acceptance_criteria[], priority, stakeholder"
          },
          {
            section: "UI/UX Specifications", 
            elements: ["Wireframes descriptions", "User interaction flows", "Visual requirements", "Accessibility needs"],
            format: "Hierarchical structure with component_name, interaction_type, accessibility_requirements"
          },
          {
            section: "Functional Requirements",
            elements: ["Feature descriptions", "Data requirements", "Integration points", "Performance criteria"],
            format: "Feature matrix with feature_id, description, data_dependencies[], integration_requirements"
          },
          {
            section: "Constraints & Dependencies",
            elements: ["Technical constraints", "Business constraints", "External dependencies", "Timeline requirements"],
            format: "Constraint catalog with type, description, impact_level, mitigation_strategy"
          }
        ],
        validation_rules: [
          "Ensure all user stories follow 'As a [user], I want [goal] so that [benefit]' format",
          "Verify acceptance criteria are testable and measurable",
          "Confirm UI specifications include Fluent UI v9 component mappings",
          "Validate accessibility requirements meet WCAG 2.1 AA standards"
        ],
        output_schema: {
          document_type: "pm_specification",
          business_requirements: "BusinessRequirement[]",
          ui_specifications: "UISpecification[]", 
          functional_requirements: "FunctionalRequirement[]",
          constraints: "Constraint[]",
          metadata: "DocumentMetadata"
        }
      },
      generation: {
        next_steps: [
          "Pass business requirements to TemplateManager for project scaffolding",
          "Send UI specifications to PCFControlManager for component planning",
          "Forward functional requirements to PluginManager for business logic planning",
          "Submit constraints to all downstream servers for validation"
        ]
      }
    },

    dev_spec: {
      parsing: {
        objective: "Extract technical implementation details for Dynamics 365 PCF controls and plugins",
        extraction_targets: [
          {
            section: "Technical Architecture",
            elements: ["Component hierarchy", "Data flow diagrams", "API specifications", "Database schema"],
            format: "Technical blueprint with component_tree, api_endpoints[], data_models[], integration_points[]"
          },
          {
            section: "PCF Control Specifications",
            elements: ["Control properties", "Event handlers", "Styling requirements", "Performance targets"],
            format: "PCF manifest structure with property_definitions, event_bindings, style_tokens, performance_metrics"
          },
          {
            section: "Plugin Requirements", 
            elements: ["Business logic", "Entity operations", "Security rules", "Error handling"],
            format: "Plugin specification with entity_context, business_rules[], security_requirements, exception_handling"
          },
          {
            section: "Integration Specifications",
            elements: ["External APIs", "Web resources", "Custom actions", "Workflow integration"],
            format: "Integration map with endpoint_definitions, authentication_methods, data_transforms"
          }
        ],
        validation_rules: [
          "Ensure all PCF properties include TypeScript type definitions",
          "Verify plugin specifications include proper error handling patterns",
          "Confirm API specifications follow RESTful conventions",
          "Validate security requirements align with D365 best practices"
        ],
        output_schema: {
          document_type: "dev_specification",
          technical_architecture: "TechnicalArchitecture",
          pcf_specifications: "PCFSpecification[]",
          plugin_specifications: "PluginSpecification[]",
          integration_specifications: "IntegrationSpecification[]",
          metadata: "DocumentMetadata"
        }
      },
      generation: {
        next_steps: [
          "Send PCF specifications to PCFControlManager for React component generation",
          "Forward plugin specifications to PluginManager for C# class generation", 
          "Pass integration specs to all relevant servers for dependency planning",
          "Submit technical architecture to PerformanceManager for optimization planning"
        ]
      }
    },

    requirements: {
      parsing: {
        objective: "Extract formal requirements with traceability for compliance and testing",
        extraction_targets: [
          {
            section: "Functional Requirements",
            elements: ["Requirement ID", "Description", "Priority", "Source", "Validation criteria"],
            format: "Requirements matrix with req_id, description, priority_level, source_document, test_criteria[]"
          },
          {
            section: "Non-Functional Requirements",
            elements: ["Performance", "Security", "Usability", "Reliability", "Scalability"],
            format: "NFR specifications with category, metric, target_value, measurement_method"
          },
          {
            section: "Compliance Requirements", 
            elements: ["Regulatory standards", "Security frameworks", "Accessibility standards", "Industry guidelines"],
            format: "Compliance matrix with standard_name, requirement_details[], verification_method"
          },
          {
            section: "Traceability Matrix",
            elements: ["Requirement links", "Test cases", "Design elements", "Implementation components"],
            format: "Traceability map with requirement_id, linked_elements[], coverage_status"
          }
        ],
        validation_rules: [
          "Ensure all requirements have unique identifiers",
          "Verify requirements are testable and measurable",
          "Confirm traceability links are bidirectional",
          "Validate compliance requirements include verification methods"
        ],
        output_schema: {
          document_type: "requirements_document",
          functional_requirements: "FunctionalRequirement[]",
          non_functional_requirements: "NonFunctionalRequirement[]",
          compliance_requirements: "ComplianceRequirement[]",
          traceability_matrix: "TraceabilityMatrix",
          metadata: "DocumentMetadata"
        }
      },
      generation: {
        next_steps: [
          "Send functional requirements to TestingManager for test case generation",
          "Forward NFRs to PerformanceManager for optimization targets",
          "Pass compliance requirements to all servers for validation integration",
          "Submit traceability matrix to quality assurance workflows"
        ]
      }
    },

    design_doc: {
      parsing: {
        objective: "Extract UI/UX design specifications for Fluent UI v9 component generation",
        extraction_targets: [
          {
            section: "Design System Specifications",
            elements: ["Color tokens", "Typography scale", "Spacing units", "Component variants"],
            format: "Design token mapping with fluent_token_name, value, usage_context, responsive_behavior"
          },
          {
            section: "Component Specifications",
            elements: ["Component hierarchy", "State definitions", "Interaction patterns", "Accessibility features"],
            format: "Component library with component_name, props_interface, state_machine, a11y_requirements"
          },
          {
            section: "Layout Specifications",
            elements: ["Grid systems", "Responsive breakpoints", "RTL support", "Theme variations"],
            format: "Layout system with grid_definitions, breakpoint_values, rtl_adaptations, theme_mappings"
          },
          {
            section: "Interaction Specifications",
            elements: ["User flows", "Animation requirements", "Feedback patterns", "Error states"],
            format: "Interaction map with flow_id, steps[], animation_specs, feedback_mechanisms"
          }
        ],
        validation_rules: [
          "Ensure all design tokens map to Fluent UI v9 equivalents",
          "Verify component specifications include dark theme variants",
          "Confirm RTL support is specified for all directional elements", 
          "Validate accessibility features meet WCAG 2.1 AA standards"
        ],
        output_schema: {
          document_type: "design_document",
          design_system: "DesignSystemSpecification",
          component_specifications: "ComponentSpecification[]",
          layout_specifications: "LayoutSpecification",
          interaction_specifications: "InteractionSpecification[]",
          metadata: "DocumentMetadata"
        }
      },
      generation: {
        next_steps: [
          "Send design system specs to PCFControlManager for Fluent UI v9 token mapping",
          "Forward component specs to StorybookManager for story generation planning",
          "Pass layout specs to all UI generators for responsive implementation",
          "Submit interaction specs to TestingManager for user flow testing"
        ]
      }
    }
  };

  const documentInstructions = instructions[document_type];
  if (!documentInstructions) {
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          error: "Unknown document type",
          supported_types: Object.keys(instructions),
          provided_type: document_type
        })
      }]
    };
  }

  const instructionSet = documentInstructions[instruction_type];
  if (!instructionSet) {
    return {
      content: [{
        type: "text", 
        text: JSON.stringify({
          error: "Unknown instruction type",
          supported_types: Object.keys(documentInstructions),
          provided_type: instruction_type
        })
      }]
    };
  }

  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        document_type,
        instruction_type,
        instructions: instructionSet,
        context: {
          server: "WordParser MCP Server",
          version: "0.2.0",
          purpose: "Parse and extract structured content from Word documents for Dynamics 365 and PCF development workflows",
          downstream_servers: ["TemplateManager", "PCFControlManager", "PluginManager", "StorybookManager", "TestingManager", "PerformanceManager"]
        }
      })
    }]
  };
}

const server = new Server({ name: "word-parser-mcp", version: "0.2.0" }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "parse_document",
      description: "Parse a Word (.docx) document and extract HTML and raw text",
      inputSchema: {
        type: "object",
        properties: { document_path: { type: "string" } },
        required: ["document_path"]
      }
    },
    {
      name: "get_instructions", 
      description: "Get highly precise parsing and processing instructions for specific document types in the Dynamics 365 workflow",
      inputSchema: {
        type: "object",
        properties: {
          document_type: {
            type: "string",
            enum: ["pm_spec", "dev_spec", "requirements", "design_doc"],
            description: "Type of document to get instructions for"
          },
          instruction_type: {
            type: "string", 
            enum: ["parsing", "generation"],
            description: "Type of instructions needed (parsing for extraction, generation for next steps)",
            default: "parsing"
          }
        },
        required: ["document_type"]
      }
    }
  ]
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  switch (request.params.name) {
    case "parse_document":
      return await parseDocument(request.params.arguments || {});

    case "get_instructions":
      return await getInstructions(request.params.arguments || {});

    default:
      throw new Error(`Unknown tool: ${request.params.name}`);
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Word Parser MCP server running with instruction capabilities");