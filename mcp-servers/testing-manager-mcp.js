import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

async function generateUnitTests(args) {
  const { code_file, test_framework = "jest" } = args;

  try {
    const sourceCode = fs.readFileSync(code_file, 'utf8');
    const fileName = path.basename(code_file, path.extname(code_file));
    const isReactComponent = sourceCode.includes('React') || sourceCode.includes('jsx');
    const isPlugin = sourceCode.includes('IPlugin') || sourceCode.includes('IOrganizationService');

    let testCode = '';

    if (isReactComponent) {
      testCode = generateReactComponentTests(fileName, sourceCode);
    } else if (isPlugin) {
      testCode = generatePluginTests(fileName, sourceCode);
    } else {
      testCode = generateGenericTests(fileName, sourceCode);
    }

    const testFileName = `${fileName}.test.${code_file.endsWith('.ts') || code_file.endsWith('.tsx') ? 'ts' : 'js'}`;

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          source_file: code_file,
          test_file: testFileName,
          test_code: testCode,
          test_framework,
          test_type: isReactComponent ? 'React Component' : (isPlugin ? 'D365 Plugin' : 'Generic'),
          features: [
            "Comprehensive test coverage",
            "Edge case testing",
            "Error handling validation",
            "Accessibility testing (for React components)",
            "Mock implementations"
          ]
        })
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          error: "Failed to generate unit tests",
          details: error.message,
          file: code_file
        })
      }]
    };
  }
}

function generateReactComponentTests(componentName, sourceCode) {
  const hasProps = sourceCode.includes('Props') || sourceCode.includes('interface');
  const hasState = sourceCode.includes('useState') || sourceCode.includes('useReducer');
  const hasEffects = sourceCode.includes('useEffect');
  const hasCallbacks = sourceCode.includes('useCallback') || sourceCode.includes('onClick');

  return `import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe, toHaveNoViolations } from 'jest-axe';
import { FluentProvider, webLightTheme } from '@fluentui/react-components';
import { ${componentName} } from './${componentName}';

expect.extend(toHaveNoViolations);

// Mock any external dependencies
jest.mock('../utils/api', () => ({
  fetchData: jest.fn(),
}));

const renderWithProvider = (ui, options = {}) => {
  const Wrapper = ({ children }) => (
    <FluentProvider theme={webLightTheme}>
      {children}
    </FluentProvider>
  );

  return render(ui, { wrapper: Wrapper, ...options });
};

describe('${componentName}', () => {
  const defaultProps = {
    ${hasProps ? '// Add default props based on component interface' : ''}
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders without crashing', () => {
      renderWithProvider(<${componentName} {...defaultProps} />);
      expect(screen.getByRole('region')).toBeInTheDocument();
    });

    it('renders with correct initial state', () => {
      renderWithProvider(<${componentName} {...defaultProps} />);
      ${hasState ? 'expect(screen.getByText(/initial/i)).toBeInTheDocument();' : '// Verify initial render state'}
    });

    it('applies custom className when provided', () => {
      const customClass = 'custom-component';
      renderWithProvider(<${componentName} {...defaultProps} className={customClass} />);
      expect(screen.getByRole('region')).toHaveClass(customClass);
    });
  });

  describe('Props and State', () => {
    ${hasProps ? `it('handles prop changes correctly', async () => {
      const { rerender } = renderWithProvider(<${componentName} {...defaultProps} />);

      // Update props and verify changes
      const newProps = { ...defaultProps, disabled: true };
      rerender(<${componentName} {...newProps} />);

      await waitFor(() => {
        expect(screen.getByRole('region')).toHaveAttribute('aria-disabled', 'true');
      });
    });` : ''}

    ${hasState ? `it('manages internal state correctly', async () => {
      renderWithProvider(<${componentName} {...defaultProps} />);

      // Trigger state change
      const trigger = screen.getByRole('button');
      await userEvent.click(trigger);

      // Verify state change
      await waitFor(() => {
        expect(screen.getByText(/updated/i)).toBeInTheDocument();
      });
    });` : ''}
  });

  describe('User Interactions', () => {
    ${hasCallbacks ? `it('handles click events correctly', async () => {
      const onClickMock = jest.fn();
      renderWithProvider(<${componentName} {...defaultProps} onClick={onClickMock} />);

      const clickableElement = screen.getByRole('button');
      await userEvent.click(clickableElement);

      expect(onClickMock).toHaveBeenCalledTimes(1);
    });` : ''}

    it('handles keyboard navigation correctly', async () => {
      renderWithProvider(<${componentName} {...defaultProps} />);

      const focusableElement = screen.getByRole('button');
      focusableElement.focus();

      expect(focusableElement).toHaveFocus();

      await userEvent.keyboard('{Enter}');
      // Verify Enter key handling
    });

    it('handles disabled state correctly', () => {
      renderWithProvider(<${componentName} {...defaultProps} disabled />);

      const component = screen.getByRole('region');
      expect(component).toHaveAttribute('aria-disabled', 'true');
    });
  });

  describe('Theme Support', () => {
    it('works with light theme', () => {
      renderWithProvider(<${componentName} {...defaultProps} theme="light" />);
      expect(screen.getByRole('region')).toBeInTheDocument();
    });

    it('works with dark theme', () => {
      renderWithProvider(<${componentName} {...defaultProps} theme="dark" />);
      expect(screen.getByRole('region')).toBeInTheDocument();
    });

    it('supports RTL direction', () => {
      const { container } = renderWithProvider(<${componentName} {...defaultProps} direction="rtl" />);
      expect(container.firstChild).toHaveAttribute('dir', 'rtl');
    });
  });

  describe('Accessibility', () => {
    it('meets accessibility guidelines', async () => {
      const { container } = renderWithProvider(<${componentName} {...defaultProps} />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('has proper ARIA attributes', () => {
      renderWithProvider(<${componentName} {...defaultProps} />);

      const component = screen.getByRole('region');
      expect(component).toHaveAttribute('aria-labelledby');
      expect(component).toHaveAttribute('aria-describedby');
    });

    it('supports screen readers', () => {
      renderWithProvider(<${componentName} {...defaultProps} />);

      // Verify screen reader accessible elements
      expect(screen.getByLabelText(/component/i)).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('handles errors gracefully', () => {
      const onErrorMock = jest.fn();
      renderWithProvider(<${componentName} {...defaultProps} onError={onErrorMock} />);

      // Trigger error condition
      const errorTrigger = screen.getByTestId('error-trigger');
      fireEvent.click(errorTrigger);

      expect(onErrorMock).toHaveBeenCalled();
    });

    it('displays error boundary when component crashes', () => {
      const ThrowError = () => {
        throw new Error('Test error');
      };

      const ErrorBoundary = ({ children }) => {
        try {
          return children;
        } catch (error) {
          return <div>Error caught: {error.message}</div>;
        }
      };

      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );

      expect(screen.getByText(/error caught/i)).toBeInTheDocument();
    });
  });

  ${hasEffects ? `describe('Side Effects', () => {
    it('handles useEffect lifecycle correctly', async () => {
      const mockEffect = jest.fn();

      renderWithProvider(<${componentName} {...defaultProps} onMount={mockEffect} />);

      await waitFor(() => {
        expect(mockEffect).toHaveBeenCalled();
      });
    });

    it('cleans up effects on unmount', () => {
      const mockCleanup = jest.fn();

      const { unmount } = renderWithProvider(<${componentName} {...defaultProps} onUnmount={mockCleanup} />);
      unmount();

      expect(mockCleanup).toHaveBeenCalled();
    });
  });` : ''}

  describe('Performance', () => {
    it('does not cause unnecessary re-renders', () => {
      const renderSpy = jest.fn();
      const MemoizedComponent = React.memo(${componentName});

      const { rerender } = renderWithProvider(<MemoizedComponent {...defaultProps} onRender={renderSpy} />);

      // Re-render with same props
      rerender(<MemoizedComponent {...defaultProps} onRender={renderSpy} />);

      expect(renderSpy).toHaveBeenCalledTimes(1);
    });
  });
});`;
}

function generatePluginTests(pluginName, sourceCode) {
  const hasBusinessLogic = sourceCode.includes('ProcessBusinessLogic') || sourceCode.includes('business');
  const hasValidation = sourceCode.includes('ValidateRequiredFields') || sourceCode.includes('validation');

  return `using Microsoft.VisualStudio.TestTools.UnitTesting;
using Microsoft.Xrm.Sdk;
using Microsoft.Xrm.Sdk.Fakes;
using System;
using System.Fakes;
using Moq;

namespace MyOrganization.Plugins.Tests
{
    [TestClass]
    public class ${pluginName}Tests
    {
        private Mock<IServiceProvider> mockServiceProvider;
        private Mock<ITracingService> mockTracingService;
        private Mock<IPluginExecutionContext> mockContext;
        private Mock<IOrganizationServiceFactory> mockServiceFactory;
        private Mock<IOrganizationService> mockOrganizationService;
        private ${pluginName} plugin;

        [TestInitialize]
        public void Initialize()
        {
            mockServiceProvider = new Mock<IServiceProvider>();
            mockTracingService = new Mock<ITracingService>();
            mockContext = new Mock<IPluginExecutionContext>();
            mockServiceFactory = new Mock<IOrganizationServiceFactory>();
            mockOrganizationService = new Mock<IOrganizationService>();

            mockServiceProvider.Setup(s => s.GetService(typeof(ITracingService))).Returns(mockTracingService.Object);
            mockServiceProvider.Setup(s => s.GetService(typeof(IPluginExecutionContext))).Returns(mockContext.Object);
            mockServiceProvider.Setup(s => s.GetService(typeof(IOrganizationServiceFactory))).Returns(mockServiceFactory.Object);
            mockServiceFactory.Setup(f => f.CreateOrganizationService(It.IsAny<Guid>())).Returns(mockOrganizationService.Object);

            plugin = new ${pluginName}("", "");
        }

        [TestMethod]
        public void Execute_ValidContext_Success()
        {
            // Arrange
            var targetEntity = new Entity("contact");
            targetEntity["firstname"] = "John";
            targetEntity["lastname"] = "Doe";

            mockContext.Setup(c => c.PrimaryEntityName).Returns("contact");
            mockContext.Setup(c => c.MessageName).Returns("Create");
            mockContext.Setup(c => c.InputParameters).Returns(new ParameterCollection { {"Target", targetEntity} });
            mockContext.Setup(c => c.UserId).Returns(Guid.NewGuid());

            // Act
            plugin.Execute(mockServiceProvider.Object);

            // Assert
            mockTracingService.Verify(t => t.Trace(It.IsAny<string>()), Times.AtLeastOnce);
        }

        [TestMethod]
        [ExpectedException(typeof(InvalidPluginExecutionException))]
        public void Execute_WrongEntity_ThrowsException()
        {
            // Arrange
            mockContext.Setup(c => c.PrimaryEntityName).Returns("account");
            mockContext.Setup(c => c.MessageName).Returns("Create");

            // Act
            plugin.Execute(mockServiceProvider.Object);

            // Assert - Exception expected
        }

        [TestMethod]
        [ExpectedException(typeof(InvalidPluginExecutionException))]
        public void Execute_MissingTarget_ThrowsException()
        {
            // Arrange
            mockContext.Setup(c => c.PrimaryEntityName).Returns("contact");
            mockContext.Setup(c => c.MessageName).Returns("Create");
            mockContext.Setup(c => c.InputParameters).Returns(new ParameterCollection());

            // Act
            plugin.Execute(mockServiceProvider.Object);

            // Assert - Exception expected
        }

        ${hasValidation ? `[TestMethod]
        [ExpectedException(typeof(InvalidPluginExecutionException))]
        public void Execute_MissingRequiredField_ThrowsException()
        {
            // Arrange
            var targetEntity = new Entity("contact");
            // Don't set required fields

            mockContext.Setup(c => c.PrimaryEntityName).Returns("contact");
            mockContext.Setup(c => c.MessageName).Returns("Create");
            mockContext.Setup(c => c.InputParameters).Returns(new ParameterCollection { {"Target", targetEntity} });

            // Act
            plugin.Execute(mockServiceProvider.Object);

            // Assert - Exception expected
        }` : ''}

        ${hasBusinessLogic ? `[TestMethod]
        public void ProcessBusinessLogic_ValidInput_Success()
        {
            // Arrange
            var targetEntity = new Entity("contact");
            targetEntity["firstname"] = "John";
            targetEntity["lastname"] = "Doe";

            mockContext.Setup(c => c.PrimaryEntityName).Returns("contact");
            mockContext.Setup(c => c.InputParameters).Returns(new ParameterCollection { {"Target", targetEntity} });

            // Act
            plugin.Execute(mockServiceProvider.Object);

            // Assert
            mockOrganizationService.Verify(s => s.Update(It.IsAny<Entity>()), Times.AtLeastOnce);
        }` : ''}

        [TestMethod]
        public void Execute_ServiceFault_HandlesGracefully()
        {
            // Arrange
            var targetEntity = new Entity("contact");
            targetEntity["firstname"] = "John";

            mockContext.Setup(c => c.PrimaryEntityName).Returns("contact");
            mockContext.Setup(c => c.InputParameters).Returns(new ParameterCollection { {"Target", targetEntity} });
            mockOrganizationService.Setup(s => s.Update(It.IsAny<Entity>()))
                                 .Throws(new FaultException<OrganizationServiceFault>(new OrganizationServiceFault()));

            // Act & Assert
            Assert.ThrowsException<InvalidPluginExecutionException>(() => plugin.Execute(mockServiceProvider.Object));
            mockTracingService.Verify(t => t.Trace(It.Is<string>(s => s.Contains("OrganizationServiceFault"))), Times.Once);
        }

        [TestMethod]
        public void Execute_UnexpectedException_HandlesGracefully()
        {
            // Arrange
            var targetEntity = new Entity("contact");
            mockContext.Setup(c => c.PrimaryEntityName).Returns("contact");
            mockContext.Setup(c => c.InputParameters).Returns(new ParameterCollection { {"Target", targetEntity} });
            mockOrganizationService.Setup(s => s.Create(It.IsAny<Entity>()))
                                 .Throws(new InvalidOperationException("Unexpected error"));

            // Act & Assert
            Assert.ThrowsException<InvalidPluginExecutionException>(() => plugin.Execute(mockServiceProvider.Object));
            mockTracingService.Verify(t => t.Trace(It.Is<string>(s => s.Contains("Unexpected error"))), Times.Once);
        }

        [TestMethod]
        public void Execute_Performance_CompletesWithinTimeout()
        {
            // Arrange
            var targetEntity = new Entity("contact");
            targetEntity["firstname"] = "John";

            mockContext.Setup(c => c.PrimaryEntityName).Returns("contact");
            mockContext.Setup(c => c.InputParameters).Returns(new ParameterCollection { {"Target", targetEntity} });

            var startTime = DateTime.Now;

            // Act
            plugin.Execute(mockServiceProvider.Object);

            // Assert
            var executionTime = DateTime.Now - startTime;
            Assert.IsTrue(executionTime.TotalMilliseconds < 30000, "Plugin execution took too long");
        }
    }
}`;
}

function generateGenericTests(functionName, sourceCode) {
  return `describe('${functionName}', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should execute without errors', () => {
    // Arrange
    const input = {};

    // Act
    const result = ${functionName}(input);

    // Assert
    expect(result).toBeDefined();
  });

  it('should handle edge cases', () => {
    // Arrange
    const edgeCases = [null, undefined, {}, []];

    // Act & Assert
    edgeCases.forEach(testCase => {
      expect(() => ${functionName}(testCase)).not.toThrow();
    });
  });

  it('should validate input parameters', () => {
    // Arrange
    const invalidInput = null;

    // Act & Assert
    expect(() => ${functionName}(invalidInput)).toThrow();
  });
});`;
}

async function generateIntegrationTests(args) {
  const { workflow_spec } = args;
  const { name, components, data_flow } = workflow_spec;

  const integrationTestCode = `
describe('${name} Integration Tests', () => {
  let testContainer;
  let mockServices;

  beforeAll(async () => {
    // Set up test environment
    testContainer = await setupTestEnvironment();
    mockServices = await setupMockServices();
  });

  afterAll(async () => {
    await tearDownTestEnvironment(testContainer);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('End-to-End Workflow', () => {
    it('completes full workflow successfully', async () => {
      // Arrange
      const testData = createTestData();

      ${components.map(component => `
      // Initialize ${component.name}
      const ${component.name.toLowerCase()} = await initialize${component.name}(testData.${component.name.toLowerCase()});`).join('')}

      // Act
      const result = await executeWorkflow({
        ${components.map(c => `${c.name.toLowerCase()}`).join(',\n        ')}
      });

      // Assert
      expect(result.success).toBe(true);
      expect(result.data).toMatchObject(expectedOutput);
    });

    it('handles component failures gracefully', async () => {
      // Arrange
      const testData = createTestData();
      mockServices.${components[0].name.toLowerCase()}.mockImplementation(() => {
        throw new Error('Component failure');
      });

      // Act & Assert
      await expect(executeWorkflow(testData)).rejects.toThrow('Component failure');
    });
  });

  describe('Data Flow Integration', () => {
    ${data_flow.map(flow => `
    it('${flow.description}', async () => {
      // Arrange
      const inputData = createTestData('${flow.from}');

      // Act
      const result = await processDataFlow('${flow.from}', '${flow.to}', inputData);

      // Assert
      expect(result).toMatchSchema('${flow.to}Schema');
      expect(mockServices.${flow.to.toLowerCase()}).toHaveBeenCalledWith(
        expect.objectContaining(inputData)
      );
    });`).join('')}
  });

  describe('Error Recovery', () => {
    it('recovers from transient failures', async () => {
      // Arrange
      let attemptCount = 0;
      mockServices.externalAPI.mockImplementation(() => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error('Transient failure');
        }
        return { success: true, data: 'recovered' };
      });

      // Act
      const result = await executeWorkflowWithRetry();

      // Assert
      expect(result.success).toBe(true);
      expect(attemptCount).toBe(3);
    });
  });
});`;

  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        workflow_name: name,
        integration_test_code: integrationTestCode,
        components_tested: components.length,
        data_flows_tested: data_flow.length,
        test_types: [
          "End-to-end workflow testing",
          "Component integration testing", 
          "Data flow validation",
          "Error recovery testing",
          "Performance integration testing"
        ]
      })
    }]
  };
}

async function analyzeCoverage(args) {
  const { coverage_report } = args;

  try {
    // Execute coverage analysis
    const coverageOutput = execSync('npm run test:coverage -- --json', { encoding: 'utf8' });
    const coverageData = JSON.parse(coverageOutput);

    const analysis = {
      overall_coverage: calculateOverallCoverage(coverageData),
      file_coverage: analyzeFileCoverage(coverageData),
      uncovered_areas: identifyUncoveredAreas(coverageData),
      recommendations: generateCoverageRecommendations(coverageData)
    };

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          coverage_analysis: analysis,
          meets_threshold: analysis.overall_coverage >= 80,
          critical_gaps: analysis.uncovered_areas.filter(area => area.criticality === 'high'),
          improvement_plan: generateImprovementPlan(analysis)
        })
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          error: "Failed to analyze coverage",
          details: error.message,
          suggestion: "Ensure test:coverage script is configured and tests are runnable"
        })
      }]
    };
  }
}

function calculateOverallCoverage(coverageData) {
  if (!coverageData.total) return 0;
  const { lines, functions, branches } = coverageData.total;
  return Math.round((lines.pct + functions.pct + branches.pct) / 3);
}

function analyzeFileCoverage(coverageData) {
  return Object.entries(coverageData).map(([file, data]) => ({
    file,
    line_coverage: data.lines?.pct || 0,
    function_coverage: data.functions?.pct || 0,
    branch_coverage: data.branches?.pct || 0,
    status: data.lines?.pct >= 80 ? 'good' : (data.lines?.pct >= 60 ? 'warning' : 'poor')
  }));
}

function identifyUncoveredAreas(coverageData) {
  const uncovered = [];
  Object.entries(coverageData).forEach(([file, data]) => {
    if (data.lines?.pct < 80) {
      uncovered.push({
        file,
        type: 'lines',
        coverage: data.lines.pct,
        criticality: data.lines.pct < 50 ? 'high' : 'medium'
      });
    }
  });
  return uncovered;
}

function generateCoverageRecommendations(coverageData) {
  return [
    "Focus on files with less than 60% coverage first",
    "Add tests for error handling and edge cases",
    "Ensure all public API methods are tested",
    "Add integration tests for critical workflows",
    "Consider mutation testing for test quality assessment"
  ];
}

function generateImprovementPlan(analysis) {
  return {
    immediate: analysis.uncovered_areas.filter(a => a.criticality === 'high').slice(0, 5),
    short_term: "Achieve 80% coverage across all critical components",
    long_term: "Implement comprehensive test suite with 90%+ coverage and quality metrics"
  };
}

async function getInstructions(args) {
  const { instruction_type } = args;

  const instructions = {
    unit_testing: {
      overview: "Create comprehensive unit tests with high coverage and quality",
      frameworks: {
        react: ["@testing-library/react", "@testing-library/jest-dom", "jest-axe"],
        dotnet: ["MSTest", "NUnit", "xUnit", "Moq", "Microsoft.Fakes"],
        javascript: ["Jest", "Vitest", "Mocha", "Chai"]
      },
      best_practices: [
        "Follow AAA pattern (Arrange, Act, Assert)",
        "Test behavior, not implementation details",
        "Use descriptive test names that explain the scenario",
        "Achieve minimum 80% code coverage",
        "Mock external dependencies and side effects",
        "Test edge cases and error conditions"
      ],
      test_structure: {
        organization: "Group related tests in describe blocks",
        naming: "Use clear, descriptive test names",
        setup: "Use beforeEach/beforeAll for common setup",
        cleanup: "Use afterEach/afterAll for cleanup"
      }
    },

    integration_testing: {
      overview: "Test component interactions and data flow across system boundaries",
      scope: [
        "API integration between frontend and backend",
        "Database integration with proper transaction handling",
        "External service integration with proper mocking",
        "Cross-component communication and state management"
      ],
      strategies: [
        "Test realistic user scenarios end-to-end",
        "Use test databases or containers for isolation",
        "Mock external services with realistic responses",
        "Test error handling and recovery scenarios",
        "Validate data transformation and validation"
      ],
      tools: [
        "Supertest for API testing",
        "Testcontainers for database testing",
        "MSW (Mock Service Worker) for API mocking",
        "Playwright or Cypress for E2E testing"
      ]
    },

    e2e_testing: {
      overview: "Test complete user journeys across the entire application stack",
      frameworks: ["Playwright", "Cypress", "Selenium WebDriver"],
      test_scenarios: [
        "Critical user workflows and happy paths",
        "Error handling and recovery paths",
        "Cross-browser compatibility testing",
        "Responsive design and mobile testing",
        "Performance and load testing scenarios"
      ],
      best_practices: [
        "Use page object model for maintainability",
        "Implement proper wait strategies",
        "Test with realistic test data",
        "Include accessibility testing in E2E flows",
        "Run tests in multiple environments"
      ]
    },

    accessibility_testing: {
      overview: "Ensure applications meet WCAG 2.1 AA accessibility standards",
      automated_tools: [
        "axe-core for automated accessibility audits",
        "jest-axe for unit test integration",
        "Pa11y for command-line accessibility testing",
        "Lighthouse for accessibility scoring"
      ],
      manual_testing: [
        "Screen reader testing (NVDA, JAWS, VoiceOver)",
        "Keyboard navigation testing",
        "High contrast mode testing",
        "Zoom and magnification testing"
      ],
      test_cases: [
        "Color contrast ratios meet WCAG standards",
        "All interactive elements are keyboard accessible",
        "Form labels and validation messages are accessible",
        "Dynamic content changes are announced",
        "Focus management works correctly"
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
          server: "TestingManager MCP Server",
          purpose: "Generate comprehensive testing suites for React components, D365 plugins, and integration workflows",
          integration_points: [
            "PCFControlManager: Generates tests for React components",
            "PluginManager: Generates tests for D365 plugins",
            "StorybookManager: Provides interaction scenarios for testing",
            "PerformanceManager: Provides performance test scenarios"
          ]
        }
      })
    }]
  };
}

const server = new Server({ name: "testing-manager-mcp", version: "0.1.0" }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "generate_unit_tests",
      description: "Generate comprehensive unit tests for components, functions, or plugins",
      inputSchema: {
        type: "object",
        properties: {
          code_file: { type: "string", description: "Path to the source code file to test" },
          test_framework: {
            type: "string",
            enum: ["jest", "vitest", "mstest"],
            default: "jest",
            description: "Testing framework to use"
          }
        },
        required: ["code_file"]
      }
    },
    {
      name: "generate_integration_tests",
      description: "Generate integration tests for workflows and component interactions",
      inputSchema: {
        type: "object",
        properties: {
          workflow_spec: {
            type: "object",
            properties: {
              name: { type: "string", description: "Workflow name" },
              components: { type: "array", description: "Components involved in workflow" },
              data_flow: { type: "array", description: "Data flow between components" }
            },
            required: ["name", "components"]
          }
        },
        required: ["workflow_spec"]
      }
    },
    {
      name: "analyze_coverage",
      description: "Analyze test coverage and suggest improvements",
      inputSchema: {
        type: "object",
        properties: {
          coverage_report: { type: "object", description: "Coverage report data" }
        },
        required: ["coverage_report"]
      }
    },
    {
      name: "get_instructions",
      description: "Get testing strategy and implementation instructions",
      inputSchema: {
        type: "object",
        properties: {
          instruction_type: {
            type: "string",
            enum: ["unit_testing", "integration_testing", "e2e_testing", "accessibility_testing"],
            description: "Type of testing instructions needed"
          }
        },
        required: ["instruction_type"]
      }
    }
  ]
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  switch (request.params.name) {
    case "generate_unit_tests":
      return await generateUnitTests(request.params.arguments || {});
    case "generate_integration_tests":
      return await generateIntegrationTests(request.params.arguments || {});
    case "analyze_coverage":
      return await analyzeCoverage(request.params.arguments || {});
    case "get_instructions":
      return await getInstructions(request.params.arguments || {});
    default:
      throw new Error(`Unknown tool: ${request.params.name}`);
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("TestingManager MCP server running");