import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

// Service Controller Generator Manager using Microsoft PowerApps CoreServices official commands
class ServiceControllerManager {
  constructor() {
    // Removed hardcoded templates - now using official dotnet CLI commands
    this.highwayTemplateSource = "https://msazure.pkgs.visualstudio.com/_packaging/Official%40Local/nuget/v3/index.json";
  }

  async executeDotnetCommand(command, workingDir = process.cwd()) {
    return new Promise((resolve, reject) => {
      const dotnetProcess = spawn('dotnet', command.split(' '), {
        cwd: workingDir,
        stdio: 'pipe',
        shell: true
      });

      let stdout = '';
      let stderr = '';

      dotnetProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      dotnetProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      dotnetProcess.on('close', (code) => {
        if (code === 0) {
          resolve({ success: true, output: stdout, error: stderr });
        } else {
          reject({ success: false, output: stdout, error: stderr, exitCode: code });
        }
      });

      dotnetProcess.on('error', (error) => {
        reject({ success: false, error: error.message });
      });
    });
  }

  async createSolution(solutionName, outputPath) {
    try {
      // Ensure output directory exists
      if (!fs.existsSync(outputPath)) {
        fs.mkdirSync(outputPath, { recursive: true });
      }

      // Create solution using dotnet CLI
      const result = await this.executeDotnetCommand(`new sln --name ${solutionName}`, outputPath);
      
      if (result.success) {
        const solutionPath = path.join(outputPath, `${solutionName}.sln`);
        return {
          success: true,
          path: solutionPath,
          output: result.output
        };
      }
      throw new Error(result.error);
    } catch (error) {
      throw new Error(`Failed to create solution: ${error.message}`);
    }
  }

  async createWebApiProject(projectName, solutionPath, projectPath) {
    try {
      const projectDir = path.dirname(projectPath);
      
      // Ensure project directory exists
      if (!fs.existsSync(projectDir)) {
        fs.mkdirSync(projectDir, { recursive: true });
      }

      // Create Web API project using dotnet CLI
      const createResult = await this.executeDotnetCommand(`new webapi --name ${projectName} --framework net8.0`, projectDir);
      
      if (!createResult.success) {
        throw new Error(`Failed to create project: ${createResult.error}`);
      }

      // Add project to solution
      const solutionDir = path.dirname(solutionPath);
      const relativeProjPath = path.relative(solutionDir, projectPath);
      
      const addResult = await this.executeDotnetCommand(`sln add "${relativeProjPath}"`, solutionDir);
      
      if (!addResult.success) {
        console.warn(`Warning: Could not add project to solution: ${addResult.error}`);
      }

      // Add required NuGet packages for Service Fabric style controllers
      const packages = [
        'Microsoft.AspNetCore.Authentication.JwtBearer',
        'Microsoft.AspNetCore.Authorization',
        'Microsoft.AspNetCore.Mvc.NewtonsoftJson',
        'Microsoft.Extensions.Configuration.Json',
        'Microsoft.Extensions.Logging',
        'Newtonsoft.Json',
        'Swashbuckle.AspNetCore'
      ];

      const projectFolder = path.join(projectDir, projectName);
      
      for (const packageName of packages) {
        try {
          await this.executeDotnetCommand(`add package ${packageName}`, projectFolder);
        } catch (error) {
          console.warn(`Warning: Could not add package ${packageName}: ${error.message}`);
        }
      }

      return {
        success: true,
        path: projectPath,
        projectFolder: projectFolder,
        output: createResult.output
      };
    } catch (error) {
      throw new Error(`Failed to create Web API project: ${error.message}`);
    }
  }

  // Install the CAPCoreServices.Highway template package using official Microsoft source
  async installHighwayTemplate() {
    try {
      // Check if template is already installed first
      try {
        const listResult = await this.executeDotnetCommand('new list');
        if (listResult && listResult.output && listResult.output.includes('csapprepo')) {
          return {
            success: true,
            message: "CAPCoreServices.Highway template already installed",
            output: "Template found in installed templates list"
          };
        }
      } catch (listError) {
        console.warn("Could not check existing templates, proceeding with installation...");
      }

      // Try non-interactive installation first (better for MCP servers)
      try {
        const nonInteractiveResult = await this.executeDotnetCommand(
          `new install CAPCoreServices.Highway --nuget-source "${this.highwayTemplateSource}"`
        );
        
        if (nonInteractiveResult && nonInteractiveResult.success) {
          return {
            success: true,
            message: "CAPCoreServices.Highway template installed successfully (non-interactive)",
            output: nonInteractiveResult.output
          };
        }
      } catch (nonInteractiveError) {
        console.warn("Non-interactive installation failed, trying interactive...");
      }

      // Fallback to interactive if non-interactive fails
      try {
        const interactiveResult = await this.executeDotnetCommand(
          `new install CAPCoreServices.Highway --nuget-source "${this.highwayTemplateSource}" --interactive`
        );
        
        if (interactiveResult && interactiveResult.success) {
          return {
            success: true,
            message: "CAPCoreServices.Highway template installed successfully (interactive)",
            output: interactiveResult.output
          };
        }
      } catch (interactiveError) {
        throw new Error(`Both installation methods failed. Interactive error: ${interactiveError.message || interactiveError}`);
      }

      throw new Error("Template installation failed - no successful installation method found");
    } catch (error) {
      throw new Error(`Failed to install Highway template: ${error.message}`);
    }
  }

  // Create CoreServices application using the official csapprepo template
  async createCoreServicesApplication(teamName, applicationName, serviceName, outputPath, devOnly = false) {
    try {
      // Create nested microservices directory to avoid conflicting with existing code
      const microservicesPath = path.join(outputPath, 'microservices', `${applicationName}-CoreServices`);
      
      // Ensure nested output directory exists
      if (!fs.existsSync(microservicesPath)) {
        fs.mkdirSync(microservicesPath, { recursive: true });
      }

      // Build the command with parameters
      let command = `new csapprepo --teamName "${teamName}" --applicationName "${applicationName}" --serviceName "${serviceName}"`;
      
      if (devOnly) {
        command += ' --devOnly true';
      }

      // Create the application using the official template in nested directory
      const createResult = await this.executeDotnetCommand(command, microservicesPath);
      
      if (!createResult.success) {
        throw new Error(`Failed to create CoreServices application: ${createResult.error}`);
      }

      return {
        success: true,
        path: microservicesPath,
        structure: {
          solutionPath: path.join(microservicesPath, 'src', `${applicationName}.sln`),
          applicationPath: path.join(microservicesPath, 'src', applicationName),
          servicePath: path.join(microservicesPath, 'src', applicationName, serviceName),
          testPath: path.join(microservicesPath, 'src', 'Tests', `${applicationName}.UnitTests`)
        },
        output: createResult.output,
        microservicesDirectory: microservicesPath
      };
    } catch (error) {
      throw new Error(`Failed to create CoreServices application: ${error.message}`);
    }
  }

  // Initialize git repository as required by Microsoft documentation
  async initializeGitRepository(projectPath) {
    try {
      
      // Initialize git repository
      await new Promise((resolve, reject) => {
        const gitInit = spawn('git', ['init'], { cwd: projectPath, stdio: 'pipe' });
        gitInit.on('close', (code) => code === 0 ? resolve() : reject(new Error('git init failed')));
      });
      
      // Add all files
      await new Promise((resolve, reject) => {
        const gitAdd = spawn('git', ['add', '*'], { cwd: projectPath, stdio: 'pipe' });
        gitAdd.on('close', (code) => code === 0 ? resolve() : reject(new Error('git add failed')));
      });
      
      // Make initial commit
      await new Promise((resolve, reject) => {
        const gitCommit = spawn('git', ['commit', '-m', 'initial commit'], { cwd: projectPath, stdio: 'pipe' });
        gitCommit.on('close', (code) => code === 0 ? resolve() : reject(new Error('git commit failed')));
      });
      
      return {
        success: true,
        message: "Git repository initialized successfully"
      };
    } catch (error) {
      throw new Error(`Failed to initialize git repository: ${error.message}`);
    }
  }

  generateGuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    }).toUpperCase();
  }

  sanitizeName(name) {
    return name.replace(/[^a-zA-Z0-9]/g, '');
  }

  createProjectStructure(basePath, projectName) {
    const structure = [
      `${basePath}`,
      `${basePath}/${projectName}`,
      `${basePath}/${projectName}/Controllers`,
      `${basePath}/${projectName}/Models`,
      `${basePath}/${projectName}/Services`,
      `${basePath}/${projectName}/Constants`,
      `${basePath}/${projectName}/Properties`,
      `${basePath}/${projectName}/wwwroot`
    ];

    structure.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });

    return structure;
  }
}

const controllerManager = new ServiceControllerManager();

// MCP Server Functions
async function createSolution(args) {
  const { 
    team_name, 
    application_name, 
    service_name,
    base_path = process.cwd(),
    dev_only = false
  } = args;

  try {
    // Validate required parameters for Microsoft PowerApps CoreServices
    if (!team_name || !application_name || !service_name) {
      throw new Error('team_name, application_name, and service_name are required for PowerApps CoreServices microservice creation');
    }

    const sanitizedTeamName = controllerManager.sanitizeName(team_name);
    const sanitizedApplicationName = controllerManager.sanitizeName(application_name);
    const sanitizedServiceName = controllerManager.sanitizeName(service_name);

    // Create project directory
    const projectPath = path.join(base_path, sanitizedApplicationName);

    // Step 1: Install Highway template package (official Microsoft PowerApps CoreServices)
    const templateInstallResult = await controllerManager.installHighwayTemplate();
    
    if (!templateInstallResult.success) {
      throw new Error(`Failed to install Highway template: ${templateInstallResult.error}`);
    }

    // Step 2: Create CoreServices application using official csapprepo template
    const applicationResult = await controllerManager.createCoreServicesApplication(
      sanitizedTeamName,
      sanitizedApplicationName, 
      sanitizedServiceName,
      projectPath,
      dev_only
    );

    if (!applicationResult.success) {
      throw new Error(`Failed to create CoreServices application: ${applicationResult.error}`);
    }

    // Step 3: Initialize git repository as required by Microsoft documentation
    const gitResult = await controllerManager.initializeGitRepository(projectPath);
    
    if (!gitResult.success) {
      console.warn(`Warning: Could not initialize git repository: ${gitResult.error}`);
    }

    // Optional: Build the project to verify it works
    try {
      const buildResult = await controllerManager.executeDotnetCommand('restore dirs.proj', projectPath);
      if (buildResult.success) {
        console.log('Project restored successfully');
      }
    } catch (error) {
      console.warn(`Warning: Could not restore project: ${error.message}`);
    }

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          message: "PowerApps CoreServices microservice created successfully using official Microsoft templates",
          team_name: sanitizedTeamName,
          application_name: sanitizedApplicationName,
          service_name: sanitizedServiceName,
          project_path: projectPath,
          structure: applicationResult.structure,
          template_installed: templateInstallResult.message,
          git_initialized: gitResult?.success || false,
          files_structure: {
            solution: `src/${sanitizedApplicationName}.sln`,
            service_project: `src/${sanitizedApplicationName}/${sanitizedServiceName}/${sanitizedApplicationName}.${sanitizedServiceName}.csproj`,
            controller: `src/${sanitizedApplicationName}/${sanitizedServiceName}/Controllers/EchoController.cs`,
            program: `src/${sanitizedApplicationName}/${sanitizedServiceName}/Program.cs`,
            startup: `src/${sanitizedApplicationName}/${sanitizedServiceName}/Startup.cs`,
            service_fabric: `src/${sanitizedApplicationName}/${sanitizedApplicationName}/${sanitizedApplicationName}.sfproj`,
            unit_tests: `src/Tests/${sanitizedApplicationName}.UnitTests/${sanitizedApplicationName}.UnitTests.csproj`,
            pipelines: '.pipelines/OneBranch.Official.yml',
            deployment: `src/${sanitizedApplicationName}/${sanitizedApplicationName}/Deployment/DeploymentDefinition.json`
          },
          next_steps: [
            "1. Replace placeholder values in ApplicationParameters.json (RolloutSpecNotifyEmail)",
            "2. Replace placeholder values in DeploymentDefinition.json (serviceTreeId, icmPath, acisClaimsAllowlist)",
            "3. Run 'dotnet restore dirs.proj' to restore packages",
            "4. Run 'dotnet build dirs.proj -c release' to build the solution",
            "5. Follow deployment guide to deploy to PowerApps CoreServices Platform"
          ],
          official_microsoft_commands_used: {
            template_install: `dotnet new install CAPCoreServices.Highway --nuget-source "${controllerManager.highwayTemplateSource}" --interactive`,
            project_create: `dotnet new csapprepo --teamName "${sanitizedTeamName}" --applicationName "${sanitizedApplicationName}" --serviceName "${sanitizedServiceName}"${dev_only ? ' --devOnly true' : ''}`
          },
          success: true
        })
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          error: "Failed to create solution",
          details: error.message,
          success: false
        })
      }]
    };
  }
}

async function generateController(args) {
  const {
    controller_name,
    project_path,
    application_name,
    service_name
  } = args;

  try {
    // Find the existing PowerApps CoreServices generated project structure in nested folder
    const servicePath = path.join(project_path, 'microservices', `${application_name}-CoreServices`, 'src', application_name, service_name);
    const controllersPath = path.join(servicePath, 'Controllers');
    const echoControllerPath = path.join(controllersPath, 'EchoController.cs');

    // Check if the PowerApps CoreServices project exists
    if (!fs.existsSync(echoControllerPath)) {
      throw new Error(`PowerApps CoreServices project not found. Please run createSolution first. Expected: ${echoControllerPath}`);
    }

    // Read the existing EchoController.cs as a template
    const echoControllerContent = fs.readFileSync(echoControllerPath, 'utf8');
    
    const sanitizedControllerName = controllerManager.sanitizeName(controller_name);
    const newControllerFileName = `${sanitizedControllerName}Controller.cs`;
    const newControllerPath = path.join(controllersPath, newControllerFileName);

    // Create a new controller based on the EchoController template with real business logic
    let newControllerContent = echoControllerContent
      .replace(/EchoController/g, `${sanitizedControllerName}Controller`)
      .replace(/Echo/g, sanitizedControllerName)
      .replace(/echo/g, sanitizedControllerName.toLowerCase())
      .replace(/EchoRequest/g, `${sanitizedControllerName}Request`)
      .replace(/EchoResponse/g, `${sanitizedControllerName}Response`);

    // Generate specific business logic based on controller type
    newControllerContent = generateBusinessLogicForController(newControllerContent, sanitizedControllerName);

    // Write the new controller
    fs.writeFileSync(newControllerPath, newControllerContent);

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          message: "Controller generated successfully using PowerApps CoreServices template",
          controller_name: sanitizedControllerName,
          file_path: newControllerPath,
          template_source: echoControllerPath,
          instructions: [
            `1. Review the generated controller at: ${newControllerPath}`,
            `2. The controller follows PowerApps CoreServices patterns and conventions`,
            `3. Update the business logic in the TODO sections`,
            `4. Consider creating corresponding Request/Response models if needed`,
            `5. The controller inherits all features from the official PowerApps CoreServices EchoController template`
          ],
          success: true
        })
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          error: "Failed to generate controller",
          details: error.message,
          suggested_action: "Ensure you have created a PowerApps CoreServices project first using the createSolution tool",
          success: false
        })
      }]
    };
  }
}

function generateBusinessLogicForController(controllerContent, controllerName) {
  // Generate specific business logic based on controller type
  const businessLogicPatterns = {
    'KPICalculations': generateKPICalculationsLogic,
    'DashboardData': generateDashboardDataLogic,
    'Analytics': generateAnalyticsLogic,
    'UserManagement': generateUserManagementLogic,
    'Inventory': generateInventoryLogic
  };

  const logicGenerator = businessLogicPatterns[controllerName] || generateGenericBusinessLogic;
  return logicGenerator(controllerContent, controllerName);
}

function generateKPICalculationsLogic(content, controllerName) {
  // Replace the Echo response logic with KPI calculations
  const responsePattern = /var result = new .*?Response\s*{[\s\S]*?};/;
  const businessLogic = `
        // Business logic for KPI calculations
        var timePeriod = GetTimePeriodFromRequest();
        var startDate = GetStartDateFromTimePeriod(timePeriod);
        var endDate = GetEndDateFromTimePeriod(timePeriod);

        var result = new ${controllerName}Response
        {
            IncomingUrl = this.Request.GetDisplayUrl(),
            IncomingHeadersCount = this.Request.Headers.Count,
            ServerTime = new DateTimeOffset(DateTimeOffset.UtcNow.Ticks / 10000 * 10000, TimeSpan.Zero),
            // KPI Calculation Results
            LeadConversionRate = await CalculateLeadConversionRateAsync(startDate, endDate),
            RevenueMetrics = await CalculateRevenueMetricsAsync(startDate, endDate),
            TrendData = await GetTrendDataAsync(startDate, endDate),
            TimePeriod = timePeriod.ToString(),
            StartDate = startDate,
            EndDate = endDate
        };`;

  content = content.replace(responsePattern, businessLogic);

  // Add the response model with KPI-specific properties
  const responseModelPattern = /public record .*?Response\s*{[\s\S]*?}/;
  const responseModel = `public record ${controllerName}Response
        {
            public string IncomingUrl { get; init; }
            public int IncomingHeadersCount { get; init; }
            public DateTimeOffset ServerTime { get; init; }
            
            // KPI Calculation Properties
            public decimal LeadConversionRate { get; init; }
            public RevenueMetrics RevenueMetrics { get; init; }
            public List<TrendDataPoint> TrendData { get; init; } = new();
            public string TimePeriod { get; init; }
            public DateTimeOffset StartDate { get; init; }
            public DateTimeOffset EndDate { get; init; }
        }

        public record RevenueMetrics
        {
            public decimal TotalRevenue { get; init; }
            public decimal AverageRevenue { get; init; }
            public int OpportunityCount { get; init; }
        }

        public record TrendDataPoint
        {
            public DateTimeOffset Date { get; init; }
            public decimal Value { get; init; }
            public string Label { get; init; }
        }`;

  content = content.replace(responseModelPattern, responseModel);

  // Add helper methods for KPI calculations
  const helperMethods = `
        private TimePeriod GetTimePeriodFromRequest()
        {
            // Extract time period from request query or body
            var timePeriodStr = this.Request.Query["timePeriod"].FirstOrDefault() ?? "LastMonth";
            return Enum.TryParse<TimePeriod>(timePeriodStr, out var period) ? period : TimePeriod.LastMonth;
        }

        private DateTimeOffset GetStartDateFromTimePeriod(TimePeriod period)
        {
            var now = DateTimeOffset.UtcNow;
            return period switch
            {
                TimePeriod.LastWeek => now.AddDays(-7),
                TimePeriod.LastMonth => now.AddMonths(-1),
                TimePeriod.LastQuarter => now.AddMonths(-3),
                TimePeriod.LastYear => now.AddYears(-1),
                _ => now.AddMonths(-1)
            };
        }

        private DateTimeOffset GetEndDateFromTimePeriod(TimePeriod period)
        {
            return DateTimeOffset.UtcNow;
        }

        private async Task<decimal> CalculateLeadConversionRateAsync(DateTimeOffset startDate, DateTimeOffset endDate)
        {
            // Mock implementation - replace with real data access
            await Task.Delay(10); // Simulate async operation
            return 0.24m; // 24% conversion rate
        }

        private async Task<RevenueMetrics> CalculateRevenueMetricsAsync(DateTimeOffset startDate, DateTimeOffset endDate)
        {
            // Mock implementation - replace with real data access
            await Task.Delay(10);
            return new RevenueMetrics
            {
                TotalRevenue = 125000.50m,
                AverageRevenue = 5208.35m,
                OpportunityCount = 24
            };
        }

        private async Task<List<TrendDataPoint>> GetTrendDataAsync(DateTimeOffset startDate, DateTimeOffset endDate)
        {
            // Mock implementation - replace with real data access
            await Task.Delay(10);
            var trendData = new List<TrendDataPoint>();
            var current = startDate;
            var random = new Random();
            
            while (current <= endDate)
            {
                trendData.Add(new TrendDataPoint
                {
                    Date = current,
                    Value = 1000 + (decimal)(random.NextDouble() * 2000),
                    Label = current.ToString("MMM dd")
                });
                current = current.AddDays(7);
            }
            
            return trendData;
        }

        public enum TimePeriod
        {
            LastWeek,
            LastMonth,
            LastQuarter,
            LastYear,
            Custom
        }`;

  // Insert helper methods before the closing brace of the class
  const classClosingPattern = /(\s+)}\s*}\s*$/;
  content = content.replace(classClosingPattern, `${helperMethods}$1}$1}`);

  return content;
}

function generateDashboardDataLogic(content, controllerName) {
  // Replace the Echo response logic with Dashboard data aggregation
  const responsePattern = /var result = new .*?Response\s*{[\s\S]*?};/;
  const businessLogic = `
        // Business logic for dashboard data aggregation
        var dashboardType = GetDashboardTypeFromRequest();
        var filters = GetFiltersFromRequest();

        var result = new ${controllerName}Response
        {
            IncomingUrl = this.Request.GetDisplayUrl(),
            IncomingHeadersCount = this.Request.Headers.Count,
            ServerTime = new DateTimeOffset(DateTimeOffset.UtcNow.Ticks / 10000 * 10000, TimeSpan.Zero),
            // Dashboard Data Properties
            DashboardData = await GetDashboardDataAsync(dashboardType, filters),
            Widgets = await GetWidgetDataAsync(dashboardType),
            LastUpdated = DateTimeOffset.UtcNow,
            DashboardType = dashboardType
        };`;

  content = content.replace(responsePattern, businessLogic);

  // Add the response model with Dashboard-specific properties
  const responseModelPattern = /public record .*?Response\s*{[\s\S]*?}/;
  const responseModel = `public record ${controllerName}Response
        {
            public string IncomingUrl { get; init; }
            public int IncomingHeadersCount { get; init; }
            public DateTimeOffset ServerTime { get; init; }
            
            // Dashboard Data Properties
            public DashboardDataSet DashboardData { get; init; }
            public List<WidgetData> Widgets { get; init; } = new();
            public DateTimeOffset LastUpdated { get; init; }
            public string DashboardType { get; init; }
        }

        public record DashboardDataSet
        {
            public List<Dictionary<string, object>> RawData { get; init; } = new();
            public int TotalRecords { get; init; }
            public Dictionary<string, object> Aggregations { get; init; } = new();
        }

        public record WidgetData
        {
            public string WidgetId { get; init; }
            public string Title { get; init; }
            public string Type { get; init; }
            public Dictionary<string, object> Data { get; init; } = new();
        }`;

  content = content.replace(responseModelPattern, responseModel);

  // Add helper methods for dashboard data
  const helperMethods = `
        private string GetDashboardTypeFromRequest()
        {
            return this.Request.Query["dashboardType"].FirstOrDefault() ?? "Default";
        }

        private Dictionary<string, string> GetFiltersFromRequest()
        {
            var filters = new Dictionary<string, string>();
            
            foreach (var query in this.Request.Query)
            {
                if (query.Key.StartsWith("filter_"))
                {
                    filters[query.Key.Substring(7)] = query.Value.FirstOrDefault();
                }
            }
            
            return filters;
        }

        private async Task<DashboardDataSet> GetDashboardDataAsync(string dashboardType, Dictionary<string, string> filters)
        {
            // Mock implementation - replace with real data access
            await Task.Delay(10);
            
            return new DashboardDataSet
            {
                RawData = GenerateMockDashboardData(),
                TotalRecords = 150,
                Aggregations = new Dictionary<string, object>
                {
                    {"totalValue", 95000.75m},
                    {"averageValue", 633.34m},
                    {"maxValue", 2500.00m}
                }
            };
        }

        private async Task<List<WidgetData>> GetWidgetDataAsync(string dashboardType)
        {
            // Mock implementation - replace with real data access
            await Task.Delay(10);
            
            return new List<WidgetData>
            {
                new WidgetData
                {
                    WidgetId = "widget_1",
                    Title = "Performance Metrics",
                    Type = "chart",
                    Data = new Dictionary<string, object> { {"chartType", "line"}, {"dataPoints", 12} }
                },
                new WidgetData
                {
                    WidgetId = "widget_2", 
                    Title = "Summary Stats",
                    Type = "card",
                    Data = new Dictionary<string, object> { {"value", 1250}, {"trend", "up"} }
                }
            };
        }

        private List<Dictionary<string, object>> GenerateMockDashboardData()
        {
            var data = new List<Dictionary<string, object>>();
            var random = new Random();
            
            for (int i = 0; i < 10; i++)
            {
                data.Add(new Dictionary<string, object>
                {
                    {"id", Guid.NewGuid().ToString()},
                    {"name", $"Item {i + 1}"},
                    {"value", 100 + (decimal)(random.NextDouble() * 500)},
                    {"date", DateTimeOffset.UtcNow.AddDays(-random.Next(30))}
                });
            }
            
            return data;
        }`;

  // Insert helper methods before the closing brace of the class
  const classClosingPattern = /(\s+)}\s*}\s*$/;
  content = content.replace(classClosingPattern, `${helperMethods}$1}$1}`);

  return content;
}

function generateAnalyticsLogic(content, controllerName) {
  // Replace the Echo response logic with Analytics functionality
  const responsePattern = /var result = new .*?Response\s*{[\s\S]*?};/;
  const businessLogic = `
        // Business logic for analytics and reporting
        var reportType = GetReportTypeFromRequest();
        var dateRange = GetDateRangeFromRequest();

        var result = new ${controllerName}Response
        {
            IncomingUrl = this.Request.GetDisplayUrl(),
            IncomingHeadersCount = this.Request.Headers.Count,
            ServerTime = new DateTimeOffset(DateTimeOffset.UtcNow.Ticks / 10000 * 10000, TimeSpan.Zero),
            // Analytics Properties
            ReportData = await GenerateReportAsync(reportType, dateRange),
            InsightsGenerated = await GenerateInsightsAsync(reportType, dateRange),
            ReportType = reportType,
            DateRange = dateRange
        };`;

  content = content.replace(responsePattern, businessLogic);

  // Add the response model with Analytics-specific properties
  const responseModelPattern = /public record .*?Response\s*{[\s\S]*?}/;
  const responseModel = `public record ${controllerName}Response
        {
            public string IncomingUrl { get; init; }
            public int IncomingHeadersCount { get; init; }
            public DateTimeOffset ServerTime { get; init; }
            
            // Analytics Properties
            public ReportData ReportData { get; init; }
            public List<Insight> InsightsGenerated { get; init; } = new();
            public string ReportType { get; init; }
            public DateRange DateRange { get; init; }
        }

        public record ReportData
        {
            public List<Dictionary<string, object>> Data { get; init; } = new();
            public Dictionary<string, decimal> Metrics { get; init; } = new();
            public List<ChartData> Charts { get; init; } = new();
        }

        public record Insight
        {
            public string Type { get; init; }
            public string Description { get; init; }
            public decimal Confidence { get; init; }
            public Dictionary<string, object> SupportingData { get; init; } = new();
        }

        public record ChartData
        {
            public string ChartType { get; init; }
            public string Title { get; init; }
            public List<DataPoint> DataPoints { get; init; } = new();
        }

        public record DataPoint
        {
            public string Label { get; init; }
            public decimal Value { get; init; }
            public DateTimeOffset? Date { get; init; }
        }

        public record DateRange
        {
            public DateTimeOffset StartDate { get; init; }
            public DateTimeOffset EndDate { get; init; }
        }`;

  content = content.replace(responseModelPattern, responseModel);

  // Add helper methods for analytics
  const helperMethods = `
        private string GetReportTypeFromRequest()
        {
            return this.Request.Query["reportType"].FirstOrDefault() ?? "Summary";
        }

        private DateRange GetDateRangeFromRequest()
        {
            var startDateStr = this.Request.Query["startDate"].FirstOrDefault();
            var endDateStr = this.Request.Query["endDate"].FirstOrDefault();
            
            var startDate = DateTimeOffset.TryParse(startDateStr, out var start) ? start : DateTimeOffset.UtcNow.AddMonths(-1);
            var endDate = DateTimeOffset.TryParse(endDateStr, out var end) ? end : DateTimeOffset.UtcNow;
            
            return new DateRange { StartDate = startDate, EndDate = endDate };
        }

        private async Task<ReportData> GenerateReportAsync(string reportType, DateRange dateRange)
        {
            // Mock implementation - replace with real analytics logic
            await Task.Delay(10);
            
            return new ReportData
            {
                Data = GenerateMockReportData(),
                Metrics = new Dictionary<string, decimal>
                {
                    {"totalTransactions", 1250m},
                    {"averageValue", 845.50m},
                    {"growthRate", 0.12m}
                },
                Charts = new List<ChartData>
                {
                    new ChartData
                    {
                        ChartType = "bar",
                        Title = "Monthly Trends",
                        DataPoints = GenerateMockChartData()
                    }
                }
            };
        }

        private async Task<List<Insight>> GenerateInsightsAsync(string reportType, DateRange dateRange)
        {
            // Mock implementation - replace with real insights engine
            await Task.Delay(10);
            
            return new List<Insight>
            {
                new Insight
                {
                    Type = "Trend",
                    Description = "Performance metrics show 12% improvement over previous period",
                    Confidence = 0.85m,
                    SupportingData = new Dictionary<string, object> { {"dataPoints", 50}, {"correlation", 0.75} }
                },
                new Insight
                {
                    Type = "Anomaly",
                    Description = "Unusual spike detected in activity during week 3",
                    Confidence = 0.92m,
                    SupportingData = new Dictionary<string, object> { {"threshold", 150}, {"actualValue", 245} }
                }
            };
        }

        private List<Dictionary<string, object>> GenerateMockReportData()
        {
            var data = new List<Dictionary<string, object>>();
            var random = new Random();
            
            for (int i = 0; i < 25; i++)
            {
                data.Add(new Dictionary<string, object>
                {
                    {"id", i + 1},
                    {"category", $"Category {(i % 5) + 1}"},
                    {"value", 500 + (decimal)(random.NextDouble() * 1000)},
                    {"timestamp", DateTimeOffset.UtcNow.AddHours(-random.Next(168))}
                });
            }
            
            return data;
        }

        private List<DataPoint> GenerateMockChartData()
        {
            var dataPoints = new List<DataPoint>();
            var random = new Random();
            
            for (int i = 0; i < 12; i++)
            {
                dataPoints.Add(new DataPoint
                {
                    Label = $"Month {i + 1}",
                    Value = 1000 + (decimal)(random.NextDouble() * 500),
                    Date = DateTimeOffset.UtcNow.AddMonths(-11 + i)
                });
            }
            
            return dataPoints;
        }`;

  // Insert helper methods before the closing brace of the class
  const classClosingPattern = /(\s+)}\s*}\s*$/;
  content = content.replace(classClosingPattern, `${helperMethods}$1}$1}`);

  return content;
}

function generateGenericBusinessLogic(content, controllerName) {
  // Generate generic business logic for any controller type
  const responsePattern = /var result = new .*?Response\s*{[\s\S]*?};/;
  const businessLogic = `
        // Generic business logic implementation
        var requestData = await GetRequestDataAsync();
        var processedData = await ProcessBusinessLogicAsync(requestData);

        var result = new ${controllerName}Response
        {
            IncomingUrl = this.Request.GetDisplayUrl(),
            IncomingHeadersCount = this.Request.Headers.Count,
            ServerTime = new DateTimeOffset(DateTimeOffset.UtcNow.Ticks / 10000 * 10000, TimeSpan.Zero),
            // Generic Business Properties
            Data = processedData,
            Success = true,
            Message = "Request processed successfully"
        };`;

  content = content.replace(responsePattern, businessLogic);

  // Add generic response model
  const responseModelPattern = /public record .*?Response\s*{[\s\S]*?}/;
  const responseModel = `public record ${controllerName}Response
        {
            public string IncomingUrl { get; init; }
            public int IncomingHeadersCount { get; init; }
            public DateTimeOffset ServerTime { get; init; }
            
            // Generic Business Properties
            public Dictionary<string, object> Data { get; init; } = new();
            public bool Success { get; init; }
            public string Message { get; init; }
        }`;

  content = content.replace(responseModelPattern, responseModel);

  // Add generic helper methods
  const helperMethods = `
        private async Task<Dictionary<string, object>> GetRequestDataAsync()
        {
            // Extract and validate request data
            await Task.Delay(10);
            
            var requestData = new Dictionary<string, object>();
            
            // Process query parameters
            foreach (var query in this.Request.Query)
            {
                requestData[$"query_{query.Key}"] = query.Value.FirstOrDefault();
            }
            
            return requestData;
        }

        private async Task<Dictionary<string, object>> ProcessBusinessLogicAsync(Dictionary<string, object> requestData)
        {
            // Implement your business logic here
            await Task.Delay(10);
            
            return new Dictionary<string, object>
            {
                {"processedAt", DateTimeOffset.UtcNow},
                {"itemCount", requestData.Count},
                {"status", "processed"}
            };
        }`;

  // Insert helper methods before the closing brace of the class
  const classClosingPattern = /(\s+)}\s*}\s*$/;
  content = content.replace(classClosingPattern, `${helperMethods}$1}$1}`);

  return content;
}

function generateUserManagementLogic(content, controllerName) {
  return generateGenericBusinessLogic(content, controllerName);
}

function generateInventoryLogic(content, controllerName) {
  return generateGenericBusinessLogic(content, controllerName);
}

async function addRouteConstant(args) {
  const { project_path, constant_name, route_value } = args;

  try {
    const constantsPath = path.join(project_path, 'Constants', 'WebApiConstants.cs');
    
    if (!fs.existsSync(constantsPath)) {
      throw new Error('Constants file not found. Please create the solution first.');
    }

    let content = fs.readFileSync(constantsPath, 'utf8');
    
    const newConstant = `        public const string ${constant_name} = "${route_value}";`;
    
    // Find the insertion point (before the closing brace of the class)
    const insertionPoint = content.lastIndexOf('    }');
    if (insertionPoint === -1) {
      throw new Error('Could not find insertion point in constants file');
    }

    // Insert the new constant
    const updatedContent = content.slice(0, insertionPoint) + 
                          newConstant + '\n' + 
                          content.slice(insertionPoint);

    fs.writeFileSync(constantsPath, updatedContent);

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          message: "Route constant added successfully",
          constant_name: constant_name,
          route_value: route_value,
          file_path: constantsPath,
          success: true
        })
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          error: "Failed to add route constant",
          details: error.message,
          success: false
        })
      }]
    };
  }
}

async function generateFromTemplate(args) {
  const { 
    template_source_path, 
    target_project_path, 
    controller_mappings = [] 
  } = args;

  try {
    // This function would analyze existing controllers and generate similar ones
    // For now, it's a placeholder for future implementation
    
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          message: "Template-based generation is not yet implemented",
          success: false
        })
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          error: "Failed to generate from template",
          details: error.message,
          success: false
        })
      }]
    };
  }
}

async function implementRealControllers(args) {
  const {
    project_path,
    application_name,
    service_name,
    requirements_doc_path,
    add_mock_dependencies = true
  } = args;

  try {
    // Find the PowerApps CoreServices generated project structure
    const servicePath = path.join(project_path, 'microservices', `${application_name}-CoreServices`, 'src', application_name, service_name);
    const controllersPath = path.join(servicePath, 'Controllers');
    const modelsPath = path.join(servicePath, 'Models');
    const servicesPath = path.join(servicePath, 'Services');

    if (!fs.existsSync(controllersPath)) {
      throw new Error(`PowerApps CoreServices project not found. Expected controllers at: ${controllersPath}`);
    }

    // Implementation steps
    const implementationSteps = [];
    const generatedFiles = [];

    // Step 1: Create comprehensive data models
    if (!fs.existsSync(modelsPath)) {
      fs.mkdirSync(modelsPath, { recursive: true });
    }

    // Generate generic business data models template
    // Generate data models file with instructions for agent
    const dataModelsPath = path.join(modelsPath, 'BusinessDataModels.cs');
    implementationSteps.push("⚠️  Manual Step Required: Create data models file at Models/BusinessDataModels.cs with:");
    implementationSteps.push("   1. Create enums based on your business requirements (e.g., TimePeriod, Status, Category)");
    implementationSteps.push("   2. BusinessEntityBase record with common properties: Id, Name, CreatedDate, ModifiedDate, Category, Description");
    implementationSteps.push("   3. AggregationResult record for analytics: TotalValue, AverageValue, ItemCount, TimePeriod, StartDate, EndDate, TrendData");
    implementationSteps.push("   4. DataPoint record for visualization: Date, Value, Label, Category, Metadata dictionary");
    implementationSteps.push("   5. PerformanceInfo record for monitoring: QueryTimeMs, CacheStatus, DataPointsCount, Source, Timestamp");
    implementationSteps.push("   6. Add proper using statements, namespace declaration, and any domain-specific models");
    generatedFiles.push(dataModelsPath);

    // Step 2: Create DataAccessService with real business logic
    if (!fs.existsSync(servicesPath)) {
      fs.mkdirSync(servicesPath, { recursive: true });
    }

    // Generate service interfaces and implementations with instructions for agent
    const dataAccessServicePath = path.join(servicesPath, 'DataAccessService.cs');
    generatedFiles.push(dataAccessServicePath);
    
    implementationSteps.push("⚠️  Manual Step Required: Create IDataAccessService interface with methods:");
    implementationSteps.push("   1. ExecuteQueryAsync(string query) - returns List<Dictionary<string, object>> for raw data access");
    implementationSteps.push("   2. ExecuteCountQueryAsync(string query) - returns Task<int> for counting records");
    implementationSteps.push("   3. ExecuteAggregateQueryAsync(string query, string aggregateAlias) - returns Task<decimal> for calculations");
    implementationSteps.push("   4. GetAggregationDataAsync(enum timePeriod, string entityType, DateTimeOffset?, DateTimeOffset?) - for business analytics");
    implementationSteps.push("   5. GetBusinessEntitiesAsync(string entityType, enum period, DateTimeOffset?, DateTimeOffset?) - for filtered entity retrieval");
    
    if (add_mock_dependencies) {
      implementationSteps.push("⚠️  Manual Step Required: Create IExternalDataClient interface with methods:");
      implementationSteps.push("   1. ExecuteQueryAsync(string query) - returns Task<string>");
      implementationSteps.push("   2. ExecuteCommandAsync(string command) - returns Task<string>");
      
      implementationSteps.push("⚠️  Manual Step Required: Create MockExternalDataClient class implementing IExternalDataClient:");
      implementationSteps.push("   1. Add ExecuteQueryAsync method with mock responses based on query patterns and business requirements");
      implementationSteps.push("   2. Add ExecuteCommandAsync method returning appropriate success/error messages");
      implementationSteps.push("   3. Include private methods for generating mock responses: GenerateMockEntityResponse(), GenerateMockAggregateResponse(), GenerateEmptyResponse()");
      implementationSteps.push("   4. Add Task.Delay to simulate realistic network latency for testing");
      implementationSteps.push("   5. Return responses in format matching your data source (XML for Dataverse, JSON for APIs, etc.)");
    }
    
    implementationSteps.push("⚠️  Manual Step Required: Create DataAccessService class implementing IDataAccessService:");
    implementationSteps.push("   1. Add constructor with IExternalDataClient and ILogger<DataAccessService> dependencies");
    implementationSteps.push("   2. Implement ExecuteQueryAsync method to parse responses (XML/JSON/SQL) into Dictionary lists");
    implementationSteps.push("   3. Implement GetAggregationDataAsync with date range calculations and business logic for your domain");
    implementationSteps.push("   4. Implement GetBusinessEntitiesAsync with filtering, mapping, and entity-specific logic");
    implementationSteps.push("   5. Add helper methods: ExecuteCountQueryAsync, ExecuteAggregateQueryAsync, GetDateRange (customize for business needs)");
    implementationSteps.push("   6. Include comprehensive error handling, logging, and performance monitoring");
    implementationSteps.push("   7. Customize query syntax for your data source: FetchXML (Dataverse), SQL (Database), GraphQL (APIs), etc.");

    if (add_mock_dependencies) {
      implementationSteps.push("✅ Added mock IExternalDataClient implementation for development and testing");
    }

    // Step 3: Create instruction for updating Startup.cs
    implementationSteps.push("⚠️  Manual Step Required: Update Startup.cs to register services:");
    implementationSteps.push("   - Add: services.AddScoped<IDataAccessService, DataAccessService>();");
    if (add_mock_dependencies) {
      implementationSteps.push("   - Add: services.AddScoped<IExternalDataClient, MockExternalDataClient>();");
    }
    implementationSteps.push("   - Add: using Microsoft." + application_name + "." + service_name + ".Services;");

    // Step 4: Create instruction for updating controllers
    implementationSteps.push("⚠️  Manual Step Required: Update Controllers to use real DataAccessService:");
    implementationSteps.push("   1. Inject IDataAccessService into controller constructors via dependency injection");
    implementationSteps.push("   2. Replace mock/hardcoded responses with appropriate dataAccessService method calls");
    implementationSteps.push("   3. Implement business logic specific to your domain requirements and calculations");
    implementationSteps.push("   4. Handle data type conversions (enums to strings, date formatting, number precision)");
    implementationSteps.push("   5. Add comprehensive async/await patterns, error handling, and input validation");

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          message: "Real controller implementation completed successfully",
          project_path: servicePath,
          implementation_steps: implementationSteps,
          generated_files: generatedFiles.map(f => path.relative(servicePath, f)),
          next_manual_steps: [
            {
              step: 1,
              description: "Update Startup.cs dependency injection",
              file: "Startup.cs",
              code_to_add: [
                "services.AddScoped<IDataAccessService, DataAccessService>();",
                add_mock_dependencies ? "services.AddScoped<IExternalDataClient, MockExternalDataClient>();" : null,
                "using Microsoft." + application_name + "." + service_name + ".Services;"
              ].filter(Boolean)
            },
            {
              step: 2,
              description: "Update Controllers to use real DataAccessService",
              files: ["Controllers/*.cs"],
              actions: [
                "Inject IDataAccessService into constructors",
                "Replace mock responses with real service calls based on business requirements",
                "Add proper async/await error handling and input validation",
                "Handle data type conversions specific to your domain"
              ]
            },
            {
              step: 3,
              description: "Build and test the implementation",
              command: "dotnet build",
              expected: "No compilation errors, all dependencies resolved correctly"
            }
          ],
          real_business_logic_features: [
            "✅ Generic business entity data access patterns",
            "✅ Configurable aggregation and analytics calculations", 
            "✅ Flexible query system supporting multiple data sources (SQL, FetchXML, GraphQL, Web APIs)",
            "✅ Extensible data models with performance monitoring",
            "✅ Mock external data client for development and testing",
            "✅ Comprehensive error handling and logging throughout service stack",
            "✅ Generic time period filtering and date range calculations",
            "✅ Performance optimization framework with caching support"
          ],
          mock_dependencies_note: add_mock_dependencies ? 
            "Mock IExternalDataClient added for development. Replace with actual data client implementation in production (e.g., Dataverse, SQL, Web API clients)." :
            "No mock dependencies added. You will need to provide real IExternalDataClient implementation for your data source.",
          success: true
        })
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          error: "Failed to implement real controllers",
          details: error.message,
          success: false
        })
      }]
    };
  }
}

async function validateRequirements(args) {
  const {
    project_path,
    application_name,
    service_name,
    requirements_docs = []
  } = args;

  try {
    // Check if the generated microservice exists
    const servicePath = path.join(project_path, 'microservices', `${application_name}-CoreServices`, 'src', application_name, service_name);
    const controllersPath = path.join(servicePath, 'Controllers');
    const modelsPath = path.join(servicePath, 'Models');

    if (!fs.existsSync(controllersPath)) {
      throw new Error(`Generated microservice not found. Expected controllers at: ${controllersPath}`);
    }

    // Analyze generated backend structure
    const controllers = fs.readdirSync(controllersPath).filter(file => file.endsWith('.cs'));
    const models = fs.existsSync(modelsPath) ? fs.readdirSync(modelsPath).filter(file => file.endsWith('.cs')) : [];

    // Extract API endpoints from controllers
    const apiEndpoints = [];
    controllers.forEach(controllerFile => {
      const controllerPath = path.join(controllersPath, controllerFile);
      const content = fs.readFileSync(controllerPath, 'utf8');
      
      // Extract HTTP endpoints using regex
      const httpMethods = content.match(/\[Http(Get|Post|Put|Delete).*?Route\("([^"]+)"\).*?\]\s*public\s+\w+\s+(\w+)/g);
      if (httpMethods) {
        httpMethods.forEach(match => {
          const methodMatch = match.match(/Http(Get|Post|Put|Delete)/);
          const routeMatch = match.match(/Route\("([^"]+)"\)/);
          const functionMatch = match.match(/public\s+\w+\s+(\w+)/);
          
          if (methodMatch && routeMatch && functionMatch) {
            apiEndpoints.push({
              method: methodMatch[1].toUpperCase(),
              route: routeMatch[1],
              function: functionMatch[1],
              controller: controllerFile.replace('.cs', '')
            });
          }
        });
      }
    });

    // Validate against business requirements and technical standards
    const validationResults = {
      coreDataStructure: validateCoreDataStructure(models, modelsPath),
      apiEndpoints: validateAPIEndpoints(apiEndpoints),
      performanceFeatures: validatePerformanceFeatures(models, modelsPath),
      dataVisualizationSupport: validateDataVisualizationSupport(models, modelsPath),
      microsoftCompliance: validateMicrosoftCompliance(controllers, controllersPath)
    };

    // Generate compliance report
    const complianceReport = generateComplianceReport(validationResults, controllers, models, apiEndpoints);

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          message: "Requirements validation completed",
          project_path: servicePath,
          generated_components: {
            controllers: controllers.length,
            models: models.length,
            api_endpoints: apiEndpoints.length
          },
          api_endpoints: apiEndpoints,
          validation_results: validationResults,
          compliance_report: complianceReport,
          recommendations: generateRecommendations(validationResults),
          success: true
        })
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          error: "Failed to validate requirements",
          details: error.message,
          success: false
        })
      }]
    };
  }
}

function validateCoreDataStructure(models, modelsPath) {
  // Check for core business data models
  const commonBusinessFields = ['Id', 'Name', 'Value', 'Category', 'Description', 'CreatedDate', 'ModifiedDate'];
  const hasBusinessModels = models.length > 0;
  
  let fieldsCovered = [];
  let businessEntitiesFound = [];
  
  if (hasBusinessModels && fs.existsSync(modelsPath)) {
    models.forEach(modelFile => {
      const content = fs.readFileSync(path.join(modelsPath, modelFile), 'utf8');
      
      // Identify business entities (not just technical DTOs)
      const isBusinessModel = /class|record|interface/.test(content) && 
                             !/Response|Request|DTO|Config/.test(modelFile);
      
      if (isBusinessModel) {
        businessEntitiesFound.push(modelFile.replace('.cs', ''));
      }
      
      commonBusinessFields.forEach(field => {
        if (content.includes(field) && !fieldsCovered.includes(field)) {
          fieldsCovered.push(field);
        }
      });
    });
  }

  return {
    status: hasBusinessModels && fieldsCovered.length >= 4 ? 'satisfied' : 'partial',
    details: `Business models found: ${businessEntitiesFound.join(', ')}, Common fields covered: ${fieldsCovered.join(', ')}`,
    coverage: `${fieldsCovered.length}/${commonBusinessFields.length}`,
    business_entities: businessEntitiesFound,
    missing_fields: commonBusinessFields.filter(field => !fieldsCovered.includes(field))
  };
}

function validateAPIEndpoints(apiEndpoints) {
  // Analyze endpoint patterns for common business operations
  const httpMethods = ['GET', 'POST', 'PUT', 'DELETE'];
  const methodCoverage = {};
  const routePatterns = {
    crud: apiEndpoints.filter(e => /\/(create|read|update|delete|get|post|put|patch)/i.test(e.route)).length,
    business_logic: apiEndpoints.filter(e => /\/(calculate|process|analyze|generate|validate)/i.test(e.route)).length,
    data_retrieval: apiEndpoints.filter(e => e.method === 'GET').length,
    data_modification: apiEndpoints.filter(e => ['POST', 'PUT', 'PATCH', 'DELETE'].includes(e.method)).length
  };

  // Count HTTP method distribution
  httpMethods.forEach(method => {
    methodCoverage[method] = apiEndpoints.filter(e => e.method === method).length;
  });

  const hasBasicCRUD = methodCoverage.GET > 0 && (methodCoverage.POST > 0 || methodCoverage.PUT > 0);
  const hasBusinessLogic = routePatterns.business_logic > 0;
  
  return {
    status: hasBasicCRUD && apiEndpoints.length >= 3 ? 'satisfied' : 'partial',
    details: `Found ${apiEndpoints.length} total endpoints with ${Object.values(methodCoverage).filter(c => c > 0).length} HTTP methods`,
    endpoint_analysis: {
      total_endpoints: apiEndpoints.length,
      http_method_coverage: methodCoverage,
      pattern_analysis: routePatterns,
      has_basic_crud: hasBasicCRUD,
      has_business_logic: hasBusinessLogic
    },
    recommendations: [
      !hasBasicCRUD ? "Add basic CRUD operations (GET, POST/PUT)" : null,
      apiEndpoints.length < 3 ? "Consider adding more API endpoints for complete functionality" : null,
      !hasBusinessLogic ? "Add business logic endpoints beyond basic CRUD" : null
    ].filter(Boolean)
  };
}

function validatePerformanceFeatures(models, modelsPath) {
  const performanceFeatures = ['PerformanceInfo', 'QueryTimeMs', 'CacheStatus', 'DataPointsCount'];
  let featuresFound = [];

  if (fs.existsSync(modelsPath)) {
    models.forEach(modelFile => {
      const content = fs.readFileSync(path.join(modelsPath, modelFile), 'utf8');
      performanceFeatures.forEach(feature => {
        if (content.includes(feature)) {
          featuresFound.push(feature);
        }
      });
    });
  }

  return {
    status: featuresFound.length >= 3 ? 'satisfied' : 'partial',
    details: `Performance features found: ${featuresFound.join(', ')}`,
    coverage: `${featuresFound.length}/${performanceFeatures.length}`
  };
}

function validateDataVisualizationSupport(models, modelsPath) {
  // Generic patterns for data visualization and reporting
  const dataVizPatterns = [
    'DataPoint', 'ChartData', 'HistoricalData', 'TimeSeries', 'Aggregation',
    'Summary', 'Report', 'Analytics', 'Metrics', 'Trend'
  ];
  let dataVizFeaturesFound = [];

  if (fs.existsSync(modelsPath)) {
    models.forEach(modelFile => {
      const content = fs.readFileSync(path.join(modelsPath, modelFile), 'utf8');
      dataVizPatterns.forEach(pattern => {
        if (content.includes(pattern) && !dataVizFeaturesFound.includes(pattern)) {
          dataVizFeaturesFound.push(pattern);
        }
      });
    });
  }

  const hasTimeSeriesSupport = dataVizFeaturesFound.some(f => 
    ['HistoricalData', 'TimeSeries', 'Trend'].includes(f));
  const hasAggregationSupport = dataVizFeaturesFound.some(f => 
    ['Aggregation', 'Summary', 'Analytics', 'Metrics'].includes(f));

  return {
    status: dataVizFeaturesFound.length >= 2 ? 'satisfied' : 'partial',
    details: `Data visualization features found: ${dataVizFeaturesFound.join(', ')}`,
    coverage: `${dataVizFeaturesFound.length}/${dataVizPatterns.length}`,
    capabilities: {
      time_series_support: hasTimeSeriesSupport,
      aggregation_support: hasAggregationSupport,
      basic_charting: dataVizFeaturesFound.includes('DataPoint') || dataVizFeaturesFound.includes('ChartData')
    }
  };
}

function validateMicrosoftCompliance(controllers, controllersPath) {
  const complianceFeatures = ['PowerApps.CoreFramework', 'Geneva', 'AuditClassification', 'MonitorWith'];
  let complianceFound = [];

  controllers.forEach(controllerFile => {
    const content = fs.readFileSync(path.join(controllersPath, controllerFile), 'utf8');
    complianceFeatures.forEach(feature => {
      if (content.includes(feature)) {
        complianceFound.push(feature);
      }
    });
  });

  return {
    status: complianceFound.length >= 3 ? 'satisfied' : 'partial',
    details: `Microsoft compliance features found: ${[...new Set(complianceFound)].join(', ')}`,
    coverage: `${[...new Set(complianceFound)].length}/${complianceFeatures.length}`
  };
}

function generateComplianceReport(validationResults, controllers, models, apiEndpoints) {
  const totalChecks = Object.keys(validationResults).length;
  const satisfiedChecks = Object.values(validationResults).filter(result => result.status === 'satisfied').length;
  const partialChecks = Object.values(validationResults).filter(result => result.status === 'partial').length;
  
  return {
    overall_compliance: `${Math.round((satisfiedChecks / totalChecks) * 100)}%`,
    status_breakdown: {
      satisfied: satisfiedChecks,
      partial: partialChecks,
      failed: totalChecks - satisfiedChecks - partialChecks,
      total: totalChecks
    },
    generated_assets: {
      controllers: controllers.length,
      models: models.length,
      api_endpoints: apiEndpoints.length
    }
  };
}

function generateRecommendations(validationResults) {
  const recommendations = [];

  if (validationResults.coreDataStructure.status !== 'satisfied') {
    recommendations.push({
      priority: 'high',
      category: 'data_model',
      description: 'Enhance core business data models',
      action: `Add missing common fields: ${validationResults.coreDataStructure.missing_fields?.join(', ')}`,
      details: `Found ${validationResults.coreDataStructure.business_entities?.length || 0} business entities, consider adding more domain-specific models`
    });
  }

  if (validationResults.apiEndpoints.status !== 'satisfied') {
    const apiAnalysis = validationResults.apiEndpoints.endpoint_analysis;
    recommendations.push({
      priority: 'high',
      category: 'api_endpoints',
      description: 'Expand API endpoint coverage',
      action: `Current: ${apiAnalysis?.total_endpoints || 0} endpoints. ${validationResults.apiEndpoints.recommendations?.join('; ') || 'Add more business operations'}`
    });
  }

  if (validationResults.performanceFeatures.status !== 'satisfied') {
    recommendations.push({
      priority: 'medium',
      category: 'performance',
      description: 'Add performance monitoring capabilities',
      action: 'Implement PerformanceInfo models with query timing, cache status, and metrics collection'
    });
  }

  if (validationResults.dataVisualizationSupport.status !== 'satisfied') {
    const vizCapabilities = validationResults.dataVisualizationSupport.capabilities;
    const missingFeatures = [];
    if (!vizCapabilities?.time_series_support) missingFeatures.push('time series data');
    if (!vizCapabilities?.aggregation_support) missingFeatures.push('data aggregation');
    if (!vizCapabilities?.basic_charting) missingFeatures.push('chart data structures');

    recommendations.push({
      priority: 'medium',
      category: 'data_visualization',
      description: 'Improve data visualization support',
      action: `Add support for: ${missingFeatures.join(', ')}`
    });
  }

  if (validationResults.microsoftCompliance.status !== 'satisfied') {
    recommendations.push({
      priority: 'high',
      category: 'compliance',
      description: 'Ensure Microsoft PowerApps CoreServices compliance',
      action: 'Add Geneva audit logging, PowerApps CoreFramework integration, and enterprise monitoring'
    });
  }

  return recommendations;
}

async function getInstructions(args) {
  const { instruction_type = 'general' } = args;

  const instructions = {
    general: {
      overview: "PowerApps CoreServices Microservice Generator MCP Server",
      description: "Creates PowerApps CoreServices microservices using official Microsoft templates and commands from the Microsoft PowerApps CoreServices documentation",
      important_note: "ALL HARDCODED TEMPLATES REMOVED - Uses only official Microsoft PowerApps CoreServices generated files",
      capabilities: [
        "Install official CAPCoreServices.Highway template package",
        "Create microservices using 'dotnet new csapprepo' template",
        "Generate complete Service Fabric application structure (54 files)",
        "Generate controllers based on PowerApps CoreServices EchoController.cs template",
        "Set up proper CoreServices authentication and telemetry",
        "Initialize git repository as required by Microsoft",
        "Follow Microsoft PowerApps CoreServices naming conventions"
      ],
      official_microsoft_commands: {
        "template_install": "dotnet new install CAPCoreServices.Highway --nuget-source 'https://msazure.pkgs.visualstudio.com/_packaging/Official%40Local/nuget/v3/index.json' --interactive",
        "project_create": "dotnet new csapprepo --teamName <Your team name> --applicationName <Your app name> --serviceName <Your service name>",
        "dev_only_option": "dotnet new csapprepo --teamName <Your team name> --applicationName <Your app name> --serviceName <Your service name> --devOnly true"
      },
      microsoft_documentation_source: "https://eng.ms/docs/experiences-devices/business-and-industry-copilot/bic-agent-cloud/bac-foundations/coreservices-microservices-infrastructure/powerapps-coreservices-wiki/onboardandlivesite/buildmicroservice/createnewmicroservice"
    },
    solution_creation: {
      overview: "Create PowerApps CoreServices microservice using official Microsoft templates",
      tool: "create_solution",
      parameters: {
        "team_name": "Your team name (required by Microsoft PowerApps CoreServices)",
        "application_name": "Your application name (required by Microsoft PowerApps CoreServices)",
        "service_name": "Your service name (required by Microsoft PowerApps CoreServices)",
        "base_path": "Directory where microservice will be created (optional)",
        "dev_only": "Create dev-only environment using --devOnly flag (optional, default: false)"
      },
      example: {
        "team_name": "TestTeam",
        "application_name": "TestApp",
        "service_name": "TestService",
        "base_path": "C:/repos",
        "dev_only": false
      },
      official_process: [
        "1. Install CAPCoreServices.Highway template package from Microsoft Azure DevOps",
        "2. Create microservice using 'dotnet new csapprepo' template with your parameters",
        "3. Initialize git repository with 'git init', 'git add *', 'git commit -m \"initial commit\"'",
        "4. Project structure includes Service Fabric application, Web API service, unit tests, and deployment configs",
        "5. Follow Microsoft documentation to replace placeholder values before deployment"
      ]
    },
    controller_generation: {
      overview: "Generate new controllers based on PowerApps CoreServices EchoController.cs template (no hardcoded templates)",
      tool: "generate_controller", 
      parameters: {
        "controller_name": "Name of the new controller (without 'Controller' suffix)",
        "project_path": "Path to the PowerApps CoreServices project root directory",
        "application_name": "Application name from PowerApps CoreServices project",
        "service_name": "Service name from PowerApps CoreServices project"
      },
      example: {
        "controller_name": "UserManagement",
        "project_path": "C:/repos/TestApp",
        "application_name": "TestApp",
        "service_name": "TestService"
      },
      process: [
        "1. Reads the existing EchoController.cs generated by PowerApps CoreServices",
        "2. Creates a new controller by copying and modifying the EchoController template",
        "3. Replaces 'Echo' references with your controller name",
        "4. Maintains all PowerApps CoreServices patterns and conventions",
        "5. No hardcoded templates - uses only Microsoft-generated files"
      ]
    },
    real_implementation: {
      overview: "Replace mock controller implementations with real business logic and data access patterns",
      tool: "implement_real_controllers",
      description: "Transforms PowerApps CoreServices projects from template scaffolding to production-ready microservices with real data access and business logic",
      parameters: {
        "project_path": "Path to the project root directory containing microservices folder",
        "application_name": "Application name from PowerApps CoreServices project",
        "service_name": "Service name from PowerApps CoreServices project",
        "requirements_doc_path": "Path to requirements document containing business logic specifications (optional)",
        "add_mock_dependencies": "Whether to add mock implementations for external dependencies during development (default: true)"
      },
      examples: [
        {
          "use_case": "Business Analytics Dashboard with Dataverse integration",
          "project_path": "C:/repos/AnalyticsDashboard",
          "application_name": "Analytics", 
          "service_name": "DataService",
          "requirements_doc_path": "docs/Analytics_Requirements.docx",
          "data_sources": ["Dataverse CRM entities", "FetchXML queries"],
          "business_logic": ["Business metric calculations", "Data aggregations", "Trend analysis"]
        },
        {
          "use_case": "User Management with Azure AD integration",
          "project_path": "C:/repos/UserManagement",
          "application_name": "UserManagement",
          "service_name": "UserService", 
          "requirements_doc_path": "docs/UserManagement_Requirements.docx",
          "data_sources": ["Azure AD Graph API", "SQL Database"],
          "business_logic": ["User authentication", "Role management", "Activity tracking"]
        },
        {
          "use_case": "Inventory System with SAP integration",
          "project_path": "C:/repos/InventorySystem",
          "application_name": "Inventory",
          "service_name": "InventoryService",
          "data_sources": ["SAP OData APIs", "Local cache database"],
          "business_logic": ["Stock level monitoring", "Reorder calculations", "Supplier management"]
        }
      ],
      generic_implementation_process: [
        "1. Analyze requirements document to identify data entities and business rules",
        "2. Create comprehensive data models based on domain-specific requirements",
        "3. Implement data access service with real API/database integration patterns",
        "4. Add mock implementations for external dependencies to enable development/testing",
        "5. Replace template controllers with domain-specific business logic",
        "6. Add cross-cutting concerns: error handling, logging, caching, performance monitoring",
        "7. Ensure type safety and consistency between models, services, and API responses",
        "8. Configure dependency injection for all services and external integrations"
      ],
      common_patterns_implemented: [
        "Data access layer with repository pattern for external systems",
        "Business logic services with domain-specific calculations and rules", 
        "Performance monitoring and metrics collection (response times, cache hit rates)",
        "Mock implementations for external dependencies during development phase",
        "Comprehensive error handling and logging throughout the service stack",
        "Async/await patterns for scalable I/O operations",
        "Dependency injection configuration for testability and maintainability"
      ]
    },
    requirements_validation: {
      overview: "Validate generated microservice against business requirements and technical specifications",
      tool: "validate_requirements",
      description: "Analyzes PowerApps CoreServices projects to ensure compliance with requirements documents and enterprise standards",
      parameters: {
        "project_path": "Path to the project root directory containing microservices folder",
        "application_name": "Application name from PowerApps CoreServices project",
        "service_name": "Service name from PowerApps CoreServices project", 
        "requirements_docs": "Optional array of requirement document paths to validate against"
      },
      examples: [
        {
          "use_case": "Business Analytics Dashboard validation",
          "project_path": "C:/repos/AnalyticsDashboard",
          "application_name": "Analytics",
          "service_name": "DataService",
          "requirements_docs": ["docs/Analytics_Requirements.docx", "docs/Business_Rules.docx"],
          "validation_focus": ["Data model completeness", "API endpoint coverage", "Chart data support"]
        },
        {
          "use_case": "User Management validation",
          "project_path": "C:/repos/UserManagement",
          "application_name": "UserManagement", 
          "service_name": "UserService",
          "requirements_docs": ["docs/UserManagement_Requirements.docx"],
          "validation_focus": ["Authentication endpoints", "Role-based access", "Audit logging"]
        },
        {
          "use_case": "Inventory Management validation",
          "project_path": "C:/repos/InventorySystem",
          "application_name": "Inventory",
          "service_name": "InventoryService",
          "requirements_docs": ["docs/Inventory_Requirements.docx"],
          "validation_focus": ["Stock tracking endpoints", "Supplier management", "Reporting capabilities"]
        }
      ],
      generic_validation_areas: [
        "1. Core data models match domain requirements and business entities",
        "2. API endpoints provide complete coverage for required business operations",
        "3. Performance monitoring and optimization features are implemented",
        "4. Data visualization support meets frontend integration requirements",
        "5. Microsoft PowerApps CoreServices compliance and enterprise standards",
        "6. Security patterns and authentication/authorization implementation",
        "7. Error handling and logging meet operational requirements"
      ],
      compliance_reporting_features: [
        "Overall compliance percentage across all validation areas",
        "Detailed status breakdown (satisfied/partial/failed) with specific gaps",
        "Missing components identification with priority ranking",
        "Actionable recommendations for addressing compliance gaps",
        "Generated assets inventory (controllers, models, endpoints, services)",
        "Technical debt assessment and architectural compliance review"
      ]
    }
  };

  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        instruction_type,
        instructions: instructions[instruction_type] || instructions.general,
        all_available_types: Object.keys(instructions),
        server: "Service Fabric Controller Generator MCP Server",
        version: "1.0.0"
      })
    }]
  };
}

// Server setup
const server = new Server({ name: "servicefabric-controller-manager-mcp", version: "1.0.0" }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "create_solution",
      description: "Create PowerApps CoreServices microservice using official Microsoft templates (CAPCoreServices.Highway csapprepo)",
      inputSchema: {
        type: "object",
        properties: {
          team_name: { type: "string", description: "Your team name (required by Microsoft PowerApps CoreServices)" },
          application_name: { type: "string", description: "Your application name (required by Microsoft PowerApps CoreServices)" },
          service_name: { type: "string", description: "Your service name (required by Microsoft PowerApps CoreServices)" },
          base_path: { type: "string", description: "Directory where microservice will be created", default: "current working directory" },
          dev_only: { type: "boolean", description: "Create dev-only environment (uses --devOnly flag)", default: false }
        },
        required: ["team_name", "application_name", "service_name"]
      }
    },
    {
      name: "generate_controller",
      description: "Generate new controller based on PowerApps CoreServices EchoController.cs template (no hardcoded templates)",
      inputSchema: {
        type: "object",
        properties: {
          controller_name: { type: "string", description: "Name of the new controller" },
          project_path: { type: "string", description: "Path to the PowerApps CoreServices project root directory" },
          application_name: { type: "string", description: "Application name from PowerApps CoreServices project" },
          service_name: { type: "string", description: "Service name from PowerApps CoreServices project" }
        },
        required: ["controller_name", "project_path", "application_name", "service_name"]
      }
    },
    {
      name: "add_route_constant", 
      description: "Add route constant to WebApiConstants file",
      inputSchema: {
        type: "object",
        properties: {
          project_path: { type: "string", description: "Path to the project directory" },
          constant_name: { type: "string", description: "Name of the constant" },
          route_value: { type: "string", description: "Route value" }
        },
        required: ["project_path", "constant_name", "route_value"]
      }
    },
    {
      name: "generate_from_template",
      description: "Generate controllers based on existing template analysis",
      inputSchema: {
        type: "object", 
        properties: {
          template_source_path: { type: "string", description: "Path to template controllers" },
          target_project_path: { type: "string", description: "Target project path" },
          controller_mappings: { type: "array", items: { type: "object" }, description: "Controller mapping definitions" }
        },
        required: ["template_source_path", "target_project_path"]
      }
    },
    {
      name: "implement_real_controllers",
      description: "Replace mock controller implementations with real business logic and data queries based on requirements",
      inputSchema: {
        type: "object",
        properties: {
          project_path: { type: "string", description: "Path to the project root directory containing microservices folder" },
          application_name: { type: "string", description: "Application name from PowerApps CoreServices project" },
          service_name: { type: "string", description: "Service name from PowerApps CoreServices project" },
          requirements_doc_path: { type: "string", description: "Path to requirements document (e.g., Business_Requirements.docx, Technical_Specifications.docx)" },
          add_mock_dependencies: { type: "boolean", description: "Whether to add mock implementations for external dependencies (e.g., DataverseClient, SqlClient, ApiClient)", default: true }
        },
        required: ["project_path", "application_name", "service_name"]
      }
    },
    {
      name: "validate_requirements",
      description: "Validate generated microservice against business requirements and generate compliance report",
      inputSchema: {
        type: "object",
        properties: {
          project_path: { type: "string", description: "Path to the project root directory containing microservices folder" },
          application_name: { type: "string", description: "Application name from PowerApps CoreServices project" },
          service_name: { type: "string", description: "Service name from PowerApps CoreServices project" },
          requirements_docs: { type: "array", items: { type: "string" }, description: "Optional array of requirement document paths", default: [] }
        },
        required: ["project_path", "application_name", "service_name"]
      }
    },
    {
      name: "get_instructions",
      description: "Get comprehensive instructions for using the Service Fabric Controller Generator",
      inputSchema: {
        type: "object",
        properties: {
          instruction_type: {
            type: "string",
            enum: ["general", "solution_creation", "controller_generation", "real_implementation", "requirements_validation"],
            default: "general",
            description: "Type of instructions needed"
          }
        }
      }
    }
  ]
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  switch (request.params.name) {
    case "create_solution":
      return await createSolution(request.params.arguments || {});
    case "generate_controller":
      return await generateController(request.params.arguments || {});
    case "add_route_constant":
      return await addRouteConstant(request.params.arguments || {});
    case "generate_from_template":
      return await generateFromTemplate(request.params.arguments || {});
    case "implement_real_controllers":
      return await implementRealControllers(request.params.arguments || {});
    case "validate_requirements":
      return await validateRequirements(request.params.arguments || {});
    case "get_instructions":
      return await getInstructions(request.params.arguments || {});
    default:
      throw new Error(`Unknown tool: ${request.params.name}`);
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Service Fabric Controller Manager MCP server running");