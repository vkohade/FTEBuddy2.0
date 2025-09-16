import fs from "fs";
import { stat } from "fs/promises";
import mammoth from "mammoth";
import path from "path";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

async function parseDocument(args) {
  const { document_path } = args;

  if (!fs.existsSync(document_path)) {
    return { content: [{ type: "text", text: JSON.stringify({ error: "File not found", path: document_path }) }] };
  }

  try {
    const stats = await stat(document_path);
    const documentDir = path.dirname(document_path);
    const documentName = path.basename(document_path, path.extname(document_path));

    // Configure mammoth to extract images
    const options = {
      convertImage: mammoth.images.imgElement(function (image) {
        const imageName = `${documentName}_image_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${image.contentType.split('/')[1]}`;
        const imagePath = path.join(documentDir, imageName);

        return image.read().then(function (imageBuffer) {
          fs.writeFileSync(imagePath, imageBuffer);
          return {
            src: imagePath,
            alt: `Extracted image: ${imageName}`
          };
        });
      })
    };

    // Extract HTML content with images
    const result = await mammoth.convertToHtml({ path: document_path }, options);
    const rawText = result.value.replace(/<[^>]*>/g, "");

    // Identify extracted images
    const extractedImages = [];
    const imageMatches = result.value.match(/<img[^>]*src="([^"]*)"[^>]*>/g);

    if (imageMatches) {
      imageMatches.forEach((imgTag, index) => {
        const srcMatch = imgTag.match(/src="([^"]*)"/);
        if (srcMatch) {
          const imagePath = srcMatch[1];
          if (fs.existsSync(imagePath)) {
            extractedImages.push({
              index: index + 1,
              path: imagePath,
              filename: path.basename(imagePath),
              size_bytes: fs.statSync(imagePath).size,
              alt_text: imgTag.match(/alt="([^"]*)"/)?.[1] || `Image ${index + 1}`
            });
          }
        }
      });
    }

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          document_path,
          html_content: result.value,
          raw_text: rawText,
          extracted_images: extractedImages,
          processing_messages: result.messages,
          metadata: {
            parsed_at: new Date().toISOString(),
            file_size_bytes: stats.size,
            images_extracted: extractedImages.length,
            document_directory: documentDir
          }
        })
      }]
    };

  } catch (error) {
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          error: "Failed to parse document",
          details: error.message,
          document_path
        })
      }]
    };
  }
}

async function getInstructions(args) {
  const { instruction_type = "parsing" } = args;

  const instructions = {
    parsing: {
      overview: "Extract HTML content and images from Word documents for downstream processing",
      capabilities: [
        "Convert DOCX to clean HTML using mammoth.js",
        "Extract embedded images to separate files",
        "Preserve document structure and formatting",
        "Generate metadata about extracted content"
      ],
      output_format: {
        html_content: "Clean HTML representation of document content",
        raw_text: "Plain text with HTML tags removed",
        extracted_images: "Array of image files with metadata",
        processing_messages: "Mammoth conversion messages and warnings",
        metadata: "File statistics and processing information"
      },
      downstream_usage: [
        "ContentIntelligenceManager: Analyzes HTML and images to extract requirements",
        "GitHub Copilot Agent: Uses parsed content for intelligent analysis"
      ],
      image_handling: [
        "Images are extracted to the same directory as source document",
        "Unique filenames generated to prevent conflicts",
        "Image metadata includes path, size, and alt text",
        "Supports common image formats (PNG, JPG, GIF, etc.)"
      ]
    }
  };

  const instructionSet = instructions[instruction_type];
  if (!instructionSet) {
    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          error: "Unknown instruction type",
          supported_types: Object.keys(instructions),
          provided_type: instruction_type
        })
      }]
    };
  }

  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        instruction_type,
        instructions: instructionSet,
        context: {
          server: "WordParser MCP Server",
          version: "0.3.0",
          purpose: "Simple Word document HTML extraction with image handling",
          downstream_servers: ["ContentIntelligenceManager", "ADOWorkItemManager"]
        }
      })
    }]
  };
}

const server = new Server({ name: "word-parser-mcp", version: "0.3.0" }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "parse_document",
      description: "Parse Word (.docx) document and extract HTML content with embedded images",
      inputSchema: {
        type: "object",
        properties: {
          document_path: {
            type: "string",
            description: "Path to the Word document to parse"
          }
        },
        required: ["document_path"]
      }
    },
    {
      name: "get_instructions",
      description: "Get Word document parsing instructions and capabilities",
      inputSchema: {
        type: "object",
        properties: {
          instruction_type: {
            type: "string",
            enum: ["parsing"],
            description: "Type of instructions needed",
            default: "parsing"
          }
        },
        required: []
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
console.error("WordParser MCP server running - v0.3.0 (Simple HTML + Image Extraction)");