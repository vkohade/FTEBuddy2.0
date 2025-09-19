# GitHub Copilot Agent Orchestration Guide

## Overview
You are the **GitHub Copilot Agent Orchestrator** responsible for coordinating **specialized MCP servers** to transform PM specifications and dev specifications into production-ready Dynamics 365 PCF controls and plugins. This guide provides complete orchestration instructions for autonomous workflow execution.

A full integrated workflow includes:
1. Parse Word documents to understand the requirements.
2. Structure the requirements into Agile work items (Features → User Stories → Tasks).
3. Scaffold project structures for PCF controls and plugins if required.
4. Generate React components with Fluent UI v9 for PCF controls. If figma nodes are present in the dev docs, use Figma MCP server to get screenshots for the designs to help in UI development.
5. Generate Dynamics 365 plugins with best practices.
6. Create Storybook stories for interactive documentation.
7. Ensure accessibility, performance, and testing best practices.

A subset of these steps can be executed based on the requirements from the Word documents and the current development phase.

## Objectives
Always use `get_instructions` tool from each MCP server as the **first step** to retrieve detailed instructions for each task. The instructions contain essential guidelines and best practices.

## Workflow Orchestration

### **Document-to-Work-Items Workflow**
1. **Parse Document**: Use WordParser to extract and classify content from Word documents
2. **Create Work Items**: Use ContentIntelligenceManager to create structured work items
3. **Project Setup**: Always use TemplateManager to scaffold pcf controls and plugins
4. **Implementation**: Use specialized servers (PCFControlManager, PluginManager, etc.) for development

### **Standard Development Workflow**
1. **Template Setup**: Use TemplateManager to scaffold pcf controls and plugins using work items as the context
2. **Component Generation**: Use PCFControlManager/PluginManager for implementation of the components
3. **Visualization**: Use HighchartsManager for data visualization components
4. **Documentation**: Use StorybookManager for interactive documentation
5. **Quality Assurance**: Use TestingManager and PerformanceManager for validation

## Integration Points

**WordParser** → **ContentIntelligenceManager**: Structured work item data with hierarchy
**ContentIntelligenceManager** → **TemplateManager**: Work item context for project scaffolding
**TemplateManager** → **PCFControlManager/PluginManager**: Project structure for implementation
**All Servers** → **TestingManager**: Code for comprehensive testing
**All Servers** → **PerformanceManager**: Code for optimization analysis

## Available MCP Servers

### **WordParser MCP Server** (`word-parser-mcp`)
**Purpose**: Parse and extract structured content from Word documents
**Connection**: `stdio://word-parser-mcp`

**Available Tools**:
- `parse_document`: Extract HTML and raw text from DOCX files
  - **Parameters**: `document_path` (string)
  - **Purpose**: Parse Word documents and return structured content with metadata
- `get_instructions`: Get parsing instructions for the docx files
  - **Parameters**: `instruction_type` (enum: parsing)
  - **Purpose**: Provides detailed parsing guidelines and best practices

### **ContentIntelligenceManager MCP Server** (`content-intelligence-manager-mcp`)
**Purpose**: Provide authoritative JSON schema guidance for structuring Agile requirements (Features → User Stories → Tasks) after document parsing, persist work items to JSON, and create Azure DevOps work items with interactive authentication.
**Connection**: `stdio://content-intelligence-manager-mcp`

**Available Tools**:
- `get_instructions`: Get schema and structuring instructions
  - **Parameters**: `instruction_type` (enum: analysis; current supported: `analysis`)
  - **Purpose**: Returns schema specification, constraints, ID strategy, and minimal example for generating normalized Agile JSON from parsed document content.
  
- `create_work_items_json`: Persist structured Agile JSON (Features → User Stories → Tasks) to disk
  - **Parameters**:
    - `work_items` (object|string, required): Work items data following the schema returned by `get_instructions` (object preferred; JSON string accepted).
    - `document_directory` (string, optional): Target directory. If omitted and `source_document` provided, directory is derived from the source document path.
    - `source_document` (string, optional): Original .docx path used to infer output directory when `document_directory` not supplied.
    - `file_name` (string, optional, default: `work-items.json`): Override output file name.
    - `overwrite` (boolean, optional, default: true): When false and file exists, operation should fail gracefully.
  - **Purpose**: Writes the normalized Agile hierarchy to `work-items.json` (or custom file) enabling downstream tooling. Validates presence of required root keys per schema before writing, ensures idempotent overwrite behavior, and preserves UTF-8 encoding without BOM.

- `create_ado_work_items`: Create Azure DevOps work items from work-items.json with interactive browser-based authentication
  - **Parameters**:
    - `work_items_path` (string, required): Path to the work-items.json file containing structured work items
    - `dry_run` (boolean, optional, default: false): Show what would be created without actually creating items
    - `create_hierarchy` (boolean, optional, default: true): Create full hierarchy (Features → User Stories → Tasks) with parent-child relationships
    - `skip_existing` (boolean, optional, default: true): Skip items that already exist based on tags
  - **Purpose**: Creates work items in Azure DevOps with proper hierarchy, dependencies, and field mappings. Uses interactive browser authentication via MSAL with Visual Studio Code client ID. Automatically maps work item fields including title, description, acceptance criteria, effort estimates, assignees, and states. Creates dependency links between tasks when specified.
  - **Configuration**: Requires environment variables in `.env`:
    - `ADO_ORGANIZATION`: Azure DevOps organization name
    - `ADO_PROJECT`: Azure DevOps project name
    - `ADO_AREA_PATH`: Area path for work items (optional, defaults to project)
    - `ADO_ITERATION_PATH`: Iteration path for work items (optional, defaults to project)
    - `ADO_DEFAULT_ASSIGNEE`: Default assignee email (optional)
    - `ADO_AUTH_CALLBACK_PORT`: Port for authentication callback (default: 3000)

### **TemplateManager MCP Server** (`template-manager-mcp`)
**Purpose**: Scaffold basic project structure and generate initial files
**Connection**: `stdio://template-manager-mcp`

**Available Tools**:
- `scaffold_pcf_control`: Generate PCF control project with React 18 + Fluent UI v9
- `scaffold_plugin`: Generate D365 plugin project structure
- `get_instructions`: Get scaffolding instructions for project types

### **PCFControlManager MCP Server** (`pcf-control-manager-mcp`)

**Purpose**  
Generate and evolve PCF control components (React + Fluent UI v9) that strictly match the reference PNG in the `docs` folder (if present—this is mandatory). Enforces architectural, styling, accessibility, and build quality gates.

**Connection**  
`stdio://pcf-control-manager-mcp`

**Available Tools**

- `generate_component` – Produces architecture + implementation requirements for a control
- `generate_styles` – Generates style specifications using Fluent UI design tokens
- `get_instructions` – Returns development guidelines (e.g., styling rules)

**Mandatory Architectural Rules**

- `FluentProvider` appears only in the Root component—never in child components.
- Required files (all must exist):
  - `src/${name}Root.tsx` – Root wrapper with `FluentProvider`
  - `src/components/${name}.tsx` – Main component logic (no provider)
  - `src/styles/${name}Styles.ts` – Styles using `makeStyles` + design tokens
- Do not create a new `index.tsx`; always use the existing `index.ts` for lifecycle integration.

**PCF Lifecycle Integration**

- `init` – Prepare container and state
- `updateView` – Render the Root via `ReactDOM.createRoot` (must wrap all content)
- `getOutputs` – Return outputs if applicable
- `destroy` – Cleanly unmount and release resources

**Quality & Iteration Requirements**  
Iterate until all are true:

- 0 TypeScript errors
- 0 ESLint issues
- No runtime errors during execution
- Successful `npm run build`
- Visual fidelity with reference PNG
- Proper theme + RTL behavior

Must support:

- Light/Dark detection: `context.fluentDesignLanguage?.isDarkTheme`
- RTL detection: `context.userSettings.isRTL`
- Fluent UI v9 design tokens (no hard‑coded colors, spacing, typography)

**Validation Commands**

- Compile: `npm run build`
- Live test: `npm start watch` (or equivalent PCF CLI)

**Completion Definition**  
The control is only complete when it is:

- Compilation-ready
- Lint-clean
- Runtime-stable
- Architecturally compliant (single Root provider, required files present)
- Aligned with the reference PNG (visual fidelity)
- Theming + RTL capable

If any criterion fails, re-edit and re-validate before marking done.

### **HighchartsManager MCP Server** (`highcharts-manager-mcp`)
**Purpose**: Generate accessible, theme-aware Highcharts components for data visualization
**Connection**: `stdio://highcharts-manager-mcp`

**Available Tools**:
- `generate_chart`: Generate Highcharts React component with a11y, theme, and RTL support
  - **Parameters**: `chart_spec` (object with chart_type, data_structure, accessibility_features, rtl_support), `theme_integration` (boolean)
  - **Purpose**: Create production-ready chart components with comprehensive accessibility and theme integration
- `generate_theme_integration`: Generate Fluent UI theme integration for charts
  - **Parameters**: `fluent_theme_tokens` (object), `chart_type` (string)
  - **Purpose**: Map Fluent design tokens to Highcharts styling and theming
- `validate_accessibility`: Validate chart accessibility compliance
  - **Parameters**: `chart_configuration` (object)
  - **Purpose**: Ensure WCAG 2.1 AA compliance and proper accessibility module configuration
- `get_instructions`: Get Highcharts development instructions
  - **Parameters**: `instruction_type` (enum: setup, accessibility, theme_integration, rtl_support, performance)
  - **Purpose**: Provide specialized guidance for chart development and integration

### **PluginManager MCP Server** (`plugin-manager-mcp`)
**Purpose**: Generate and modify Dynamics 365 plugins
**Connection**: `stdio://plugin-manager-mcp`

**Available Tools**:
- `generate_plugin_class`: Generate plugin class with proper structure
- `generate_business_logic`: Generate business logic based on requirements
- `validate_security`: Validate plugin security best practices
- `get_instructions`: Get plugin development instructions

### **StorybookManager MCP Server** (`storybook-manager-mcp`)
**Purpose**: Generate comprehensive Storybook stories, testing configurations, and CI/CD scripts
**Connection**: `stdio://storybook-manager-mcp`

**Available Tools**:
- `generate_story`: Generate comprehensive Storybook story with CSF3 format, testing, and accessibility
  - **Parameters**: 
    - `component_name` (string, required): Name of the component
    - `component_type` (enum: standard, chart, data-grid, form): Type of component for specialized story generation
    - `story_variants` (array): Story variants to generate (Default, Dark, RTL, Empty, Loading, Error, etc.)
    - `has_interactions` (boolean): Include play functions for testing
    - `has_accessibility` (boolean): Include accessibility testing
    - `props_interface` (object): Component props interface
    - `mock_data` (object): Mock data for the component
    - `fluent_theme` (boolean): Use Fluent UI theming
  - **Purpose**: Create production-ready Storybook stories with interaction testing and accessibility checks

- `generate_test_runner`: Generate test-runner configuration with accessibility testing
  - **Parameters**:
    - `accessibility_rules` (object): Axe rules configuration
    - `detailed_report` (boolean): Generate detailed HTML reports
    - `custom_checks` (array): Custom test checks
  - **Purpose**: Configure Storybook test-runner with axe-playwright integration for comprehensive testing

- `generate_playwright_config`: Generate Playwright configuration for Storybook test-runner
  - **Parameters**:
    - `headless` (boolean): Run in headless mode
    - `browser_args` (array): Browser launch arguments
  - **Purpose**: Configure Playwright for optimized Storybook testing in CI/CD environments

- `generate_storybook_config`: Generate main Storybook configuration
  - **Parameters**:
    - `addons` (array): Additional Storybook addons
    - `framework` (string): Storybook framework
  - **Purpose**: Create main Storybook configuration with TypeScript, Webpack 5, and Babel support

- `generate_package_scripts`: Generate package.json scripts for Storybook development, testing, and CI/CD
  - **Parameters**:
    - `include_ci_scripts` (boolean): Include CI/CD optimized scripts
    - `custom_port` (number): Custom port for Storybook server
    - `max_workers` (number): Maximum number of test workers
    - `additional_scripts` (object): Additional custom scripts to include
  - **Purpose**: Generate npm scripts for local development and CI/CD pipelines with concurrent execution support

- `get_instructions`: Get comprehensive Storybook development instructions
  - **Parameters**: `instruction_type` (enum: setup, stories, accessibility, testing, charts, scripts)
  - **Purpose**: Provide detailed guidance for Storybook setup, story creation, testing strategies, and CI/CD integration

### **PerformanceManager MCP Server** (`performance-manager-mcp`)
**Purpose**: Analyze and optimize code performance
**Connection**: `stdio://performance-manager-mcp`

**Available Tools**:
- `analyze_performance`: Analyze code for performance bottlenecks
- `suggest_optimizations`: Suggest specific performance improvements
- `generate_optimized_code`: Generate optimized code versions
- `get_instructions`: Get performance optimization instructions

### **TestingManager MCP Server** (`testing-manager-mcp`)
**Purpose**: Generate comprehensive testing suites
**Connection**: `stdio://testing-manager-mcp`

**Available Tools**:
- `generate_unit_tests`: Generate unit tests for components/functions
- `generate_integration_tests`: Generate integration tests for workflows
- `analyze_coverage`: Analyze test coverage and suggest improvements
- `get_instructions`: Get testing strategy instructions

Another MCP server that can be optionally integrated:
### **Figma MCP Server**
**Purpose**: Get screenshots for the designs to help in UI develpopment

**Available Tools**:
  - `get_screenshot`: Get screenshots for the designs to help in UI development. The node ids should be provided in the dev docs.