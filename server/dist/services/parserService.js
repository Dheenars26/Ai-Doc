"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseDocumentFile = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const pdf_parse_1 = __importDefault(require("pdf-parse"));
const mammoth_1 = __importDefault(require("mammoth"));
/**
 * Reads and extracts raw text from PDF, DOCX, and TXT files.
 */
const parseDocumentFile = async (filePath, originalFilename) => {
    const ext = path_1.default.extname(originalFilename).toLowerCase();
    if (!fs_1.default.existsSync(filePath)) {
        throw new Error('Upload file does not exist on disk.');
    }
    try {
        switch (ext) {
            case '.txt': {
                // Plain text parsing
                const rawText = fs_1.default.readFileSync(filePath, 'utf8');
                return rawText.trim();
            }
            case '.pdf': {
                // PDF parsing using pdf-parse
                const buffer = fs_1.default.readFileSync(filePath);
                // Cast options to any to satisfy TS compiler definitions
                const parsedData = await (0, pdf_parse_1.default)(buffer, {});
                return parsedData.text.trim();
            }
            case '.docx': {
                // Microsoft Word parsing using mammoth
                const result = await mammoth_1.default.extractRawText({ path: filePath });
                return result.value.trim();
            }
            case '.png':
            case '.jpg':
            case '.jpeg': {
                // Images do not contain direct extractable text.
                // We will pass their raw buffers to the multimodal model in the AI service.
                return '';
            }
            default:
                throw new Error(`Unsupported file type: ${ext}`);
        }
    }
    catch (error) {
        console.error(`[Parser Service] Failed to parse file ${originalFilename}:`, error);
        throw new Error(`File parsing failed: ${error.message}`);
    }
};
exports.parseDocumentFile = parseDocumentFile;
