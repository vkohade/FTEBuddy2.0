import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

async function generatePluginClass(args) {
  const { plugin_spec, execution_stage = "post" } = args;
  const { name, entity, message, business_logic } = plugin_spec;

  const pluginCode = `using System;
using System.ServiceModel;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Query;
using Microsoft.Extensions.Logging;

namespace ${plugin_spec.namespace || 'MyOrganization'}.Plugins
{
    [CrmPluginRegistration(
        MessageNameEnum.${message.charAt(0).toUpperCase() + message.slice(1)},
        "${entity}",
        StageEnum.${execution_stage === 'pre' ? 'Preoperation' : 'Postoperation'},
        ExecutionModeEnum.Synchronous,
        "",
        "${name}",
        1000,
        IsolationModeEnum.Sandbox)]
    public class ${name} : IPlugin
    {
        private readonly ILogger _logger;
        private readonly string _unsecureConfiguration;
        private readonly string _secureConfiguration;

        public ${name}(string unsecureConfiguration, string secureConfiguration)
        {
            _unsecureConfiguration = unsecureConfiguration;
            _secureConfiguration = secureConfiguration;
        }

        public void Execute(IServiceProvider serviceProvider)
        {
            // Get services
            var tracingService = (ITracingService)serviceProvider.GetService(typeof(ITracingService));
            var context = (IPluginExecutionContext)serviceProvider.GetService(typeof(IPluginExecutionContext));
            var serviceFactory = (IOrganizationServiceFactory)serviceProvider.GetService(typeof(IOrganizationServiceFactory));
            var organizationService = serviceFactory.CreateOrganizationService(context.UserId);

            try
            {
                tracingService.Trace($"${name} plugin started. Message: {context.MessageName}, Entity: {context.PrimaryEntityName}");

                // Validate context
                if (context.PrimaryEntityName != "${entity}")
                {
                    tracingService.Trace($"Plugin registered for {context.PrimaryEntityName} but expected ${entity}");
                    return;
                }

                // Get target entity
                Entity targetEntity = null;
                if (context.InputParameters.Contains("Target") && context.InputParameters["Target"] is Entity)
                {
                    targetEntity = (Entity)context.InputParameters["Target"];
                }
                else
                {
                    throw new InvalidPluginExecutionException("Target entity not found in context");
                }

                // Execute business logic
                ProcessBusinessLogic(organizationService, tracingService, context, targetEntity);

                tracingService.Trace("${name} plugin completed successfully");
            }
            catch (FaultException<OrganizationServiceFault> ex)
            {
                tracingService.Trace($"OrganizationServiceFault: {ex.Detail.Message}");
                throw new InvalidPluginExecutionException($"An error occurred in ${name}: {ex.Detail.Message}", ex);
            }
            catch (Exception ex)
            {
                tracingService.Trace($"Unexpected error: {ex.Message}");
                throw new InvalidPluginExecutionException($"An unexpected error occurred in ${name}: {ex.Message}", ex);
            }
        }

        private void ProcessBusinessLogic(IOrganizationService service, ITracingService tracing, IPluginExecutionContext context, Entity target)
        {
            try
            {
                tracing.Trace("Processing business logic");

                // Validate required fields
                ValidateRequiredFields(target, tracing);

                // ${business_logic?.description || 'Implement your business logic here'}
                ${GenerateBusinessLogicCode(business_logic)}

                tracing.Trace("Business logic processing completed");
            }
            catch (Exception ex)
            {
                tracing.Trace($"Error in business logic: {ex.Message}");
                throw;
            }
        }

        private void ValidateRequiredFields(Entity entity, ITracingService tracing)
        {
            ${(business_logic?.required_fields || []).map(field => 
                `if (!entity.Contains("${field}") || entity["${field}"] == null)
                {
                    throw new InvalidPluginExecutionException("Required field '${field}' is missing or null");
                }`).join('\n\n            ')}
        }
    }
}`;

  const testCode = `using Microsoft.VisualStudio.TestTools.UnitTesting;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Fakes;
using System;
using System.Collections.Generic;
using System.Fakes;

namespace ${plugin_spec.namespace || 'MyOrganization'}.Plugins.Tests
{
    [TestClass]
    public class ${name}Tests
    {
        [TestMethod]
        public void Execute_ValidTarget_Success()
        {
            // Arrange
            using (ShimsContext.Create())
            {
                var plugin = new ${name}("", "");
                var serviceProvider = CreateMockServiceProvider();
                var context = CreateMockPluginContext("${entity}", "${message}");
                var target = CreateTestEntity();

                // Act & Assert
                try
                {
                    plugin.Execute(serviceProvider);
                    Assert.IsTrue(true, "Plugin executed without exception");
                }
                catch (Exception ex)
                {
                    Assert.Fail($"Plugin execution failed: {ex.Message}");
                }
            }
        }

        [TestMethod]
        [ExpectedException(typeof(InvalidPluginExecutionException))]
        public void Execute_InvalidEntity_ThrowsException()
        {
            // Arrange
            using (ShimsContext.Create())
            {
                var plugin = new ${name}("", "");
                var serviceProvider = CreateMockServiceProvider();
                var context = CreateMockPluginContext("invalidentity", "${message}");

                // Act
                plugin.Execute(serviceProvider);
            }
        }

        [TestMethod]
        public void Execute_RequiredFieldMissing_ThrowsException()
        {
            // Arrange
            using (ShimsContext.Create())
            {
                var plugin = new ${name}("", "");
                var serviceProvider = CreateMockServiceProvider();
                var context = CreateMockPluginContext("${entity}", "${message}");
                var target = new Entity("${entity}");
                // Don't set required fields

                context.InputParameters["Target"] = target;

                // Act & Assert
                Assert.ThrowsException<InvalidPluginExecutionException>(() => plugin.Execute(serviceProvider));
            }
        }

        private IServiceProvider CreateMockServiceProvider()
        {
            var serviceProvider = new StubIServiceProvider();
            var tracingService = new StubITracingService();
            var context = new StubIPluginExecutionContext();
            var serviceFactory = new StubIOrganizationServiceFactory();
            var orgService = new StubIOrganizationService();

            tracingService.TraceString = (message) => { /* Log trace message */ };
            serviceProvider.GetServiceType = (type) =>
            {
                if (type == typeof(ITracingService)) return tracingService;
                if (type == typeof(IPluginExecutionContext)) return context;
                if (type == typeof(IOrganizationServiceFactory)) return serviceFactory;
                return null;
            };

            return serviceProvider;
        }

        private IPluginExecutionContext CreateMockPluginContext(string entityName, string messageName)
        {
            var context = new StubIPluginExecutionContext();
            context.PrimaryEntityNameGet = () => entityName;
            context.MessageNameGet = () => messageName;
            context.InputParametersGet = () => new ParameterCollection();
            context.UserIdGet = () => Guid.NewGuid();

            return context;
        }

        private Entity CreateTestEntity()
        {
            var entity = new Entity("${entity}");
            ${(business_logic?.required_fields || []).map(field => 
                `entity["${field}"] = "test_value";`).join('\n            ')}
            return entity;
        }
    }
}`;

  function GenerateBusinessLogicCode(businessLogic) {
    if (!businessLogic || !businessLogic.rules) return "// Add your business logic here";

    return businessLogic.rules.map(rule => {
      switch (rule.type) {
        case 'field_validation':
          return `// Validate ${rule.field}
                if (target.Contains("${rule.field}"))
                {
                    var ${rule.field}Value = target["${rule.field}"];
                    ${rule.validation || '// Add validation logic'}
                }`;
        case 'calculation':
          return `// Calculate ${rule.target_field}
                ${rule.calculation || '// Add calculation logic'}
                target["${rule.target_field}"] = calculatedValue;`;
        case 'lookup_update':
          return `// Update related ${rule.related_entity}
                if (target.Contains("${rule.lookup_field}"))
                {
                    var relatedRecord = service.Retrieve("${rule.related_entity}", 
                        ((EntityReference)target["${rule.lookup_field}"]).Id, 
                        new ColumnSet("${rule.fields_to_update.join('", "')}"));

                    ${rule.fields_to_update.map(field => 
                        `relatedRecord["${field}"] = ${rule.update_logic?.[field] || '"new_value"'};`
                    ).join('\n                    ')}

                    service.Update(relatedRecord);
                }`;
        default:
          return `// ${rule.description || 'Custom business logic'}`;
      }
    }).join('\n\n            ');
  }

  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        plugin_name: name,
        plugin_code: pluginCode,
        test_code: testCode,
        files_created: [
          `BusinessLogic/${name}.cs`,
          `Tests/${name}Tests.cs`,
          `Properties/AssemblyInfo.cs`
        ],
        features: [
          "Comprehensive error handling",
          "Structured logging with ITracingService",
          "Input validation and security checks",
          "Unit test framework integration",
          "Performance optimization patterns"
        ]
      })
    }]
  };
}

async function generateBusinessLogic(args) {
  const { business_rules, entity_context } = args;

  const logicCode = business_rules.map(rule => {
    const codeTemplate = {
      validation: `
        // Validation Rule: ${rule.name}
        private bool Validate${rule.name.replace(/\s+/g, '')}(Entity entity, ITracingService tracing)
        {
            try 
            {
                ${rule.conditions.map(condition => `
                if (entity.Contains("${condition.field}"))
                {
                    var value = entity["${condition.field}"];
                    if (!(${condition.expression}))
                    {
                        throw new InvalidPluginExecutionException("${condition.error_message}");
                    }
                }`).join(`

                `)}

                return true;
            }
            catch (Exception ex)
            {
                tracing.Trace($"Validation failed for ${rule.name}: {ex.Message}");
                throw;
            }
        }`,

      calculation: `
        // Calculation Rule: ${rule.name}
        private void Calculate${rule.name.replace(/\s+/g, '')}(Entity entity, IOrganizationService service, ITracingService tracing)
        {
            try
            {
        ${rule.formula_fields.map(field => 
        `                var ${field} = entity.GetAttributeValue<${rule.field_types[field] || 'object'}>("${field}");`
        ).join('\n')}
        
                        var result = ${rule.calculation_expression};
                        entity["${rule.target_field}"] = result;
        
                        tracing.Trace($"Calculated ${rule.target_field}: {result}");
                    }
                    catch (Exception ex)
                    {
                        tracing.Trace($"Calculation failed for ${rule.name}: {ex.Message}");
                        throw new InvalidPluginExecutionException($"Calculation error: {ex.Message}");
                    }
                }`,

      workflow: `
        // Workflow Rule: ${rule.name}
        private void Execute${rule.name.replace(/\s+/g, '')}Workflow(Entity entity, IOrganizationService service, ITracingService tracing)
        {
            try
            {
                ${rule.steps.map((step, index) => `
                // Step ${index + 1}: ${step.description}
                ${step.action_type === 'create' ? `
                var newRecord = new Entity("${step.target_entity}");
                ${step.field_mappings.map(mapping => 
                    `newRecord["${mapping.target}"] = ${mapping.source_type === 'field' ? 
                        `entity["${mapping.source}"]` : `"${mapping.source}"`};`
              ).join('\n')}
              var createdId = service.Create(newRecord);
              tracing.Trace($"Created {step.target_entity} record: {createdId}");` : ''}

              ${step.action_type === 'update' ? `
              var updateRecord = new Entity("${step.target_entity}", ${step.target_id});
              ${step.field_mappings.map(mapping => 
                  `updateRecord["${mapping.target}"] = ${mapping.source_type === 'field' ? 
                      `entity["${mapping.source}"]` : `"${mapping.source}"`};`
              ).join('\n')}
              service.Update(updateRecord);
              tracing.Trace($"Updated {step.target_entity} record");` : ''}
              `).join('\n')}
          }
          catch (Exception ex)
          {
              tracing.Trace($"Workflow execution failed for ${rule.name}: {ex.Message}");
              throw new InvalidPluginExecutionException($"Workflow error: {ex.Message}");
          }
      }`
  };

  return codeTemplate[rule.type] || `// Unknown rule type: ${rule.type}`;
}).join('\n\n');

  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        generated_logic: logicCode,
        entity_context,
        method_count: business_rules.length,
        rule_types: [...new Set(business_rules.map(r => r.type))]
      })
    }]
  };
}

async function validateSecurity(args) {
  const { plugin_code } = args;

  const securityChecks = {
    input_validation: [],
    sql_injection: [],
    privilege_escalation: [],
    data_access: [],
    configuration_security: []
  };

  const issues = [];
  const warnings = [];
  const recommendations = [];

  // Check for input validation
  if (!plugin_code.includes('ValidateRequiredFields') && !plugin_code.includes('validation')) {
    issues.push("Missing input validation - all user inputs should be validated");
  }

  // Check for SQL injection prevention
  if (plugin_code.includes('string.Format') || plugin_code.includes('+ ')) {
    warnings.push("Potential string concatenation detected - use parameterized queries");
  }

  // Check for privilege checks
  if (!plugin_code.includes('SecurityPrivilege') && !plugin_code.includes('privilege')) {
    recommendations.push("Consider implementing privilege checks for sensitive operations");
  }

  // Check for secure configuration
  if (plugin_code.includes('_secureConfiguration') && plugin_code.includes('Trace')) {
    warnings.push("Secure configuration values should not be logged in trace");
  }

  const securityScore = Math.max(0, 100 - (issues.length * 20) - (warnings.length * 10));

  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        security_score: securityScore,
        issues,
        warnings,
        recommendations,
        compliance_checklist: {
          "Input Validation": issues.filter(i => i.includes('validation')).length === 0,
          "SQL Injection Prevention": !plugin_code.includes('string.Format'),
          "Privilege Checks": plugin_code.includes('privilege') || plugin_code.includes('Security'),
          "Error Handling": plugin_code.includes('try') && plugin_code.includes('catch'),
          "Audit Logging": plugin_code.includes('Trace') || plugin_code.includes('Log')
        },
        security_best_practices: [
          "Always validate and sanitize input parameters",
          "Use parameterized queries and avoid string concatenation",
          "Implement proper exception handling with appropriate error messages",
          "Never log sensitive data in trace or error messages",
          "Check user privileges before performing sensitive operations",
          "Use secure configuration for sensitive settings",
          "Implement rate limiting for expensive operations"
        ]
      })
    }]
  };
}

async function getInstructions(args) {
  const { instruction_type } = args;

  const instructions = {
    architecture: {
      overview: "Implement robust, maintainable Dynamics 365 plugins with proper architecture",
      design_patterns: [
        "Dependency Injection: Use IServiceProvider for loose coupling",
        "Repository Pattern: Abstract data access logic",
        "Service Layer: Separate business logic from plugin infrastructure",
        "Command Pattern: Encapsulate business operations",
        "Factory Pattern: Create services and dependencies"
      ],
      error_handling: {
        principles: [
          "Fail fast with meaningful error messages",
          "Use structured exception handling with try-catch-finally",
          "Log all errors with sufficient context for troubleshooting",
          "Return user-friendly error messages",
          "Implement circuit breaker for external service calls"
        ],
        exception_types: [
          "InvalidPluginExecutionException: For business logic errors",
          "FaultException<OrganizationServiceFault>: For CRM service errors", 
          "TimeoutException: For operation timeout scenarios",
          "SecurityException: For privilege/permission issues"
        ]
      },
      performance_optimization: [
        "Minimize database queries using ColumnSet with specific fields",
        "Use ExecuteMultipleRequest for bulk operations",
        "Implement caching for frequently accessed data",
        "Avoid unnecessary plugin executions with condition checks",
        "Use async patterns for long-running operations"
      ]
    },

    security: {
      overview: "Implement comprehensive security measures for Dynamics 365 plugins",
      input_validation: [
        "Validate all input parameters before processing",
        "Check for null, empty, and malformed values",
        "Validate data types and format constraints", 
        "Sanitize string inputs to prevent injection attacks",
        "Implement length and range validations"
      ],
      privilege_management: [
        "Check user privileges before performing sensitive operations",
        "Use impersonation judiciously and document reasons",
        "Implement role-based access control (RBAC)",
        "Validate entity-level permissions",
        "Check field-level security settings"
      ],
      data_protection: [
        "Never log sensitive data (passwords, tokens, PII)",
        "Use secure configuration for sensitive settings",
        "Encrypt sensitive data in transit and at rest",
        "Implement proper audit trails",
        "Follow data retention and deletion policies"
      ],
      secure_coding: [
        "Use parameterized queries to prevent SQL injection",
        "Validate and sanitize all external inputs",
        "Implement proper session management",
        "Use HTTPS for all external communications",
        "Follow principle of least privilege"
      ]
    },

    performance: {
      overview: "Optimize plugin performance for enterprise-scale Dynamics 365 environments",
      query_optimization: [
        "Use specific ColumnSet instead of ColumnSet(true)",
        "Implement query pagination for large result sets",
        "Use FetchXML for complex queries with joins",
        "Cache frequently accessed reference data",
        "Minimize round trips to CRM service"
      ],
      bulk_operations: [
        "Use ExecuteMultipleRequest for batch operations",
        "Implement parallel processing where appropriate",
        "Use background jobs for long-running processes",
        "Implement proper transaction boundaries",
        "Handle bulk operation failures gracefully"
      ],
      memory_management: [
        "Dispose of CRM service connections properly",
        "Avoid memory leaks in long-running processes",
        "Use streaming for large data processing",
        "Implement garbage collection optimization",
        "Monitor memory usage in production"
      ]
    },

    testing: {
      overview: "Comprehensive testing strategy for Dynamics 365 plugins",
      unit_testing: [
        "Test business logic in isolation using mocks",
        "Use Microsoft Fakes or Moq for dependency mocking",
        "Test error handling and exception scenarios",
        "Validate input parameter handling",
        "Achieve minimum 80% code coverage"
      ],
      integration_testing: [
        "Test against actual CRM environment",
        "Validate plugin registration and configuration",
        "Test cross-entity operations and workflows",
        "Verify security and privilege enforcement",
        "Test performance under load"
      ],
      test_data_management: [
        "Use consistent test data across environments",
        "Implement test data cleanup procedures",
        "Use data factories for test entity creation",
        "Manage test environment configuration",
        "Implement automated test execution"
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
          server: "PluginManager MCP Server",
          purpose: "Generate and manage Dynamics 365 plugins with enterprise-grade architecture",
          integration_points: [
            "TemplateManager: Receives scaffolded plugin structure",
            "TestingManager: Provides code for comprehensive testing",
            "PerformanceManager: Provides code for optimization analysis",
            "WordParser: Receives plugin specifications from dev documents"
          ]
        }
      })
    }]
  };
}

const server = new Server({ name: "plugin-manager-mcp", version: "0.1.0" }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "generate_plugin_class",
      description: "Generate Dynamics 365 plugin class with proper structure and error handling",
      inputSchema: {
        type: "object",
        properties: {
          plugin_spec: {
            type: "object",
            properties: {
              name: { type: "string", description: "Plugin class name" },
              entity: { type: "string", description: "Target entity logical name" },
              message: { type: "string", enum: ["create", "update", "delete", "retrieve"], description: "Plugin message" },
              namespace: { type: "string", description: "Plugin namespace" },
              business_logic: { type: "object", description: "Business logic specification" },
              required_fields: { type: "array", items: { type: "string" }, description: "Required entity fields" }
            },
            required: ["name", "entity", "message"]
          },
          execution_stage: { type: "string", enum: ["pre", "post"], default: "post", description: "Plugin execution stage" }
        },
        required: ["plugin_spec"]
      }
    },
    {
      name: "generate_business_logic",
      description: "Generate business logic methods based on requirements",
      inputSchema: {
        type: "object",
        properties: {
          business_rules: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                type: { type: "string", enum: ["validation", "calculation", "workflow"] },
                description: { type: "string" },
                conditions: { type: "array" },
                target_field: { type: "string" }
              }
            }
          },
          entity_context: { type: "object", description: "Entity context and metadata" }
        },
        required: ["business_rules"]
      }
    },
    {
      name: "validate_security",
      description: "Validate plugin security best practices and compliance",
      inputSchema: {
        type: "object",
        properties: {
          plugin_code: { type: "string", description: "Plugin code to validate" }
        },
        required: ["plugin_code"]
      }
    },
    {
      name: "get_instructions",
      description: "Get plugin development instructions for specific aspects",
      inputSchema: {
        type: "object",
        properties: {
          instruction_type: {
            type: "string",
            enum: ["architecture", "security", "performance", "testing"],
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
    case "generate_plugin_class":
      return await generatePluginClass(request.params.arguments || {});
    case "generate_business_logic":
      return await generateBusinessLogic(request.params.arguments || {});
    case "validate_security":
      return await validateSecurity(request.params.arguments || {});
    case "get_instructions":
      return await getInstructions(request.params.arguments || {});
    default:
      throw new Error(`Unknown tool: ${request.params.name}`);
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("PluginManager MCP server running");