import fs from "fs";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

async function analyzePerformance(args) {
  const { code_files, analysis_type = "react" } = args;

  const performanceIssues = [];
  const suggestions = [];
  const optimizations = [];

  for (const file of code_files) {
    try {
      const content = fs.readFileSync(file, 'utf8');

      // React-specific performance analysis
      if (analysis_type === "react") {
        // Check for common React performance issues

        // 1. Missing React.memo for pure components
        if (content.includes('export const') && !content.includes('React.memo') && !content.includes('useState') && !content.includes('useEffect')) {
          suggestions.push({
            file,
            issue: "Consider using React.memo for pure functional components",
            severity: "medium",
            line: content.split('\n').findIndex(line => line.includes('export const')) + 1
          });
        }

        // 2. Missing dependency arrays in useEffect
        const useEffectMatches = content.match(/useEffect\([^,]+,?\s*\)/g);
        if (useEffectMatches) {
          useEffectMatches.forEach(match => {
            if (!match.includes('[') || match.includes('[]')) {
              performanceIssues.push({
                file,
                issue: "useEffect missing or has empty dependency array",
                severity: "high",
                recommendation: "Add proper dependency array to useEffect"
              });
            }
          });
        }

        // 3. Inline object creation in JSX
        if (content.includes('={{') || content.includes('={() =>')) {
          performanceIssues.push({
            file,
            issue: "Inline object/function creation in render",
            severity: "high", 
            recommendation: "Move objects/functions outside render or use useMemo/useCallback"
          });
        }

        // 4. Missing key props in lists
        if (content.includes('.map(') && !content.includes('key=')) {
          performanceIssues.push({
            file,
            issue: "Missing key prop in mapped elements",
            severity: "medium",
            recommendation: "Add unique key prop to mapped elements"
          });
        }

        // 5. Large bundle size indicators
        if (content.includes('import *') && !content.includes('React')) {
          suggestions.push({
            file,
            issue: "Wildcard import may increase bundle size",
            severity: "low",
            recommendation: "Use specific imports instead of wildcard imports"
          });
        }
      }

      // Bundle analysis
      if (analysis_type === "bundle") {
        // Check for potential bundle size issues
        const importCount = (content.match(/import.*from/g) || []).length;
        if (importCount > 20) {
          suggestions.push({
            file,
            issue: "High number of imports may indicate code complexity",
            severity: "medium",
            recommendation: "Consider code splitting or reducing dependencies"
          });
        }
      }

    } catch (error) {
      performanceIssues.push({
        file,
        issue: `Failed to analyze file: ${error.message}`,
        severity: "error"
      });
    }
  }

  // Generate performance score
  const totalIssues = performanceIssues.length;
  const highSeverityIssues = performanceIssues.filter(i => i.severity === 'high').length;
  const performanceScore = Math.max(0, 100 - (highSeverityIssues * 20) - (totalIssues * 5));

  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        analysis_type,
        performance_score: performanceScore,
        files_analyzed: code_files.length,
        performance_issues: performanceIssues,
        suggestions,
        optimizations: [
          {
            type: "React Optimization",
            techniques: [
              "Use React.memo for pure components",
              "Implement proper useCallback and useMemo usage",
              "Optimize re-renders with proper state structure",
              "Use lazy loading for heavy components"
            ]
          },
          {
            type: "Bundle Optimization", 
            techniques: [
              "Implement code splitting with React.lazy",
              "Use tree shaking to eliminate dead code",
              "Optimize dependencies and use specific imports",
              "Configure webpack bundle analysis"
            ]
          }
        ]
      })
    }]
  };
}

async function suggestOptimizations(args) {
  const { performance_report } = args;
  const { performance_issues, analysis_type } = performance_report;

  const optimizations = [];

  performance_issues.forEach(issue => {
    switch (issue.issue.toLowerCase()) {
      case 'inline object/function creation in render':
        optimizations.push({
          issue: issue.issue,
          solution: `
// Before (problematic)
function MyComponent() {
  return <div onClick={() => handleClick()} style={{margin: 10}} />;
}

// After (optimized)
const styles = { margin: 10 };
function MyComponent() {
  const handleClick = useCallback(() => {
    // handle click
  }, []);

  return <div onClick={handleClick} style={styles} />;
}`,
          impact: "Prevents unnecessary re-renders of child components",
          effort: "Low"
        });
        break;

      case 'missing dependency arrays in useeffect':
        optimizations.push({
          issue: issue.issue,
          solution: `
// Before (problematic)
useEffect(() => {
  fetchData(userId);
});

// After (optimized)
useEffect(() => {
  fetchData(userId);
}, [userId]);`,
          impact: "Prevents infinite re-renders and unnecessary side effects",
          effort: "Low"
        });
        break;

      case 'consider using react.memo for pure functional components':
        optimizations.push({
          issue: issue.issue,
          solution: `
// Before
export const PureComponent = ({ name, value }) => {
  return <div>{name}: {value}</div>;
};

// After (optimized)
export const PureComponent = React.memo(({ name, value }) => {
  return <div>{name}: {value}</div>;
});`,
          impact: "Prevents re-renders when props haven't changed",
          effort: "Very Low"
        });
        break;
    }
  });

  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        optimizations,
        priority_order: optimizations.sort((a, b) => {
          const effortOrder = { "Very Low": 1, "Low": 2, "Medium": 3, "High": 4 };
          return effortOrder[a.effort] - effortOrder[b.effort];
        }),
        implementation_guide: {
          immediate: "Fix inline object/function creation and missing dependencies",
          short_term: "Add React.memo to pure components and implement code splitting",
          long_term: "Comprehensive bundle optimization and performance monitoring"
        }
      })
    }]
  };
}

async function generateOptimizedCode(args) {
  const { original_code, optimization_targets } = args;

  let optimizedCode = original_code;
  const changes = [];

  optimization_targets.forEach(target => {
    switch (target) {
      case 'react_memo':
        if (optimizedCode.includes('export const') && !optimizedCode.includes('React.memo')) {
          const componentMatch = optimizedCode.match(/export const (\w+) = \([^)]*\) => \{/);
          if (componentMatch) {
            const componentName = componentMatch[1];
            optimizedCode = optimizedCode.replace(
              componentMatch[0],
              `export const ${componentName} = React.memo(${componentMatch[0].replace('export const ' + componentName + ' = ', '')}`
            );
            optimizedCode = optimizedCode.replace(/\};$/, '});');
            changes.push(`Added React.memo to ${componentName}`);
          }
        }
        break;

      case 'use_callback':
        const inlineFunctions = optimizedCode.match(/onClick={\([^}]+\) => [^}]+}/g);
        if (inlineFunctions) {
          inlineFunctions.forEach(func => {
            const callbackName = 'handleClick';
            const callbackDef = `const ${callbackName} = useCallback${func.replace('onClick=', '')}, []);`;
            optimizedCode = optimizedCode.replace(func, `onClick={${callbackName}}`);
            // Add useCallback at the beginning of the component
            optimizedCode = optimizedCode.replace(/const \w+ = React\.memo\(\([^)]*\) => \{/, match => {
              return match + '\n  ' + callbackDef;
            });
            changes.push('Converted inline function to useCallback');
          });
        }
        break;

      case 'use_memo':
        const inlineObjects = optimizedCode.match(/style={{[^}]+}}/g);
        if (inlineObjects) {
          inlineObjects.forEach((obj, index) => {
            const styleName = `styles${index}`;
            const styleDef = `const ${styleName} = useMemo(() => (${obj.replace('style=', '')}), []);`;
            optimizedCode = optimizedCode.replace(obj, `style={${styleName}}`);
            optimizedCode = optimizedCode.replace(/const \w+ = React\.memo\(\([^)]*\) => \{/, match => {
              return match + '\n  ' + styleDef;
            });
            changes.push('Converted inline style object to useMemo');
          });
        }
        break;
    }
  });

  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        original_code,
        optimized_code: optimizedCode,
        changes_applied: changes,
        optimization_targets: optimization_targets,
        performance_improvements: [
          "Reduced unnecessary re-renders",
          "Improved memory usage",
          "Better component memoization",
          "Optimized callback handling"
        ]
      })
    }]
  };
}

async function getInstructions(args) {
  const { instruction_type } = args;

  const instructions = {
    react_optimization: {
      overview: "Optimize React components for minimal re-renders and fast performance",
      techniques: {
        memoization: [
          "Use React.memo for pure functional components",
          "Implement useMemo for expensive calculations", 
          "Use useCallback for stable function references",
          "Memoize context values to prevent cascading re-renders"
        ],
        render_optimization: [
          "Avoid inline object and function creation in JSX",
          "Use proper key props for list items",
          "Implement proper component state structure",
          "Use lazy loading for heavy components with React.lazy"
        ],
        state_management: [
          "Keep state as close to where it's used as possible",
          "Use reducer pattern for complex state logic",
          "Implement proper dependency arrays in hooks",
          "Avoid unnecessary state updates"
        ]
      },
      performance_patterns: [
        "Virtual scrolling for large lists",
        "Debouncing for search and input handling",
        "Image lazy loading and optimization",
        "Code splitting at route and component level"
      ]
    },

    bundle_optimization: {
      overview: "Optimize bundle size and loading performance",
      techniques: {
        code_splitting: [
          "Route-based splitting with React.lazy",
          "Component-based splitting for heavy components",
          "Dynamic imports for conditional features",
          "Vendor code splitting for better caching"
        ],
        tree_shaking: [
          "Use ES modules for all imports/exports",
          "Configure webpack for effective tree shaking",
          "Use specific imports instead of wildcard imports",
          "Mark side-effect-free modules in package.json"
        ],
        dependency_optimization: [
          "Audit and remove unused dependencies",
          "Use lighter alternatives where possible",
          "Implement polyfill optimization",
          "Configure external dependencies properly"
        ]
      },
      tools: [
        "webpack-bundle-analyzer for bundle analysis",
        "Lighthouse for performance auditing",
        "Chrome DevTools for runtime analysis",
        "Bundlephobia for dependency size analysis"
      ]
    },

    runtime_optimization: {
      overview: "Optimize runtime performance and user experience",
      strategies: {
        loading_performance: [
          "Implement progressive loading strategies",
          "Use skeleton screens for better perceived performance",
          "Optimize critical rendering path",
          "Implement proper error boundaries"
        ],
        interaction_performance: [
          "Debounce expensive operations",
          "Use requestIdleCallback for non-critical tasks",
          "Implement virtualization for large datasets",
          "Optimize animation performance with CSS transforms"
        ],
        memory_management: [
          "Clean up event listeners and subscriptions",
          "Avoid memory leaks in closures",
          "Use WeakMap and WeakSet where appropriate",
          "Implement proper cleanup in useEffect"
        ]
      }
    }
  };

  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        instruction_type,
        instructions: instructions[instruction_type],
        context: {
          server: "PerformanceManager MCP Server",
          purpose: "Analyze and optimize code performance for React and Dynamics 365 applications",
          integration_points: [
            "PCFControlManager: Receives components for performance analysis",
            "PluginManager: Receives plugins for optimization review",
            "TestingManager: Provides performance test scenarios"
          ]
        }
      })
    }]
  };
}

const server = new Server({ name: "performance-manager-mcp", version: "0.1.0" }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "analyze_performance", 
      description: "Analyze code files for performance bottlenecks and issues",
      inputSchema: {
        type: "object",
        properties: {
          code_files: {
            type: "array",
            items: { type: "string" },
            description: "Array of file paths to analyze"
          },
          analysis_type: {
            type: "string",
            enum: ["react", "bundle", "runtime"],
            default: "react",
            description: "Type of performance analysis to perform"
          }
        },
        required: ["code_files"]
      }
    },
    {
      name: "suggest_optimizations",
      description: "Suggest specific optimizations based on performance analysis",
      inputSchema: {
        type: "object",
        properties: {
          performance_report: {
            type: "object",
            description: "Performance analysis report from analyze_performance"
          }
        },
        required: ["performance_report"]
      }
    },
    {
      name: "generate_optimized_code",
      description: "Generate optimized version of code with performance improvements",
      inputSchema: {
        type: "object",
        properties: {
          original_code: { type: "string", description: "Original code to optimize" },
          optimization_targets: {
            type: "array", 
            items: { 
              type: "string",
              enum: ["react_memo", "use_callback", "use_memo", "code_splitting"]
            },
            description: "Specific optimizations to apply"
          }
        },
        required: ["original_code", "optimization_targets"]
      }
    },
    {
      name: "get_instructions",
      description: "Get performance optimization instructions and best practices",
      inputSchema: {
        type: "object",
        properties: {
          instruction_type: {
            type: "string",
            enum: ["react_optimization", "bundle_optimization", "runtime_optimization"],
            description: "Type of performance instructions needed"
          }
        },
        required: ["instruction_type"]
      }
    }
  ]
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  switch (request.params.name) {
    case "analyze_performance":
      return await analyzePerformance(request.params.arguments || {});
    case "suggest_optimizations":
      return await suggestOptimizations(request.params.arguments || {});
    case "generate_optimized_code":
      return await generateOptimizedCode(request.params.arguments || {});
    case "get_instructions":
      return await getInstructions(request.params.arguments || {});
    default:
      throw new Error(`Unknown tool: ${request.params.name}`);
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("PerformanceManager MCP server running");