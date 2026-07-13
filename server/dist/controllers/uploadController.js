"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadDocument = void 0;
const fs_1 = __importDefault(require("fs"));
const parserService_1 = require("../services/parserService");
const documentStore_1 = require("../utils/documentStore");
/**
 * Handles incoming document uploads, extracts text, and caches it in memory.
 */
const uploadDocument = async (req, res) => {
    try {
        if (!req.file) {
            res.status(400).json({ success: false, message: 'No file uploaded.' });
            return;
        }
        console.log(`[Upload Controller] Received file: ${req.file.originalname} (${req.file.size} bytes)`);
        // Parse the file and extract text
        const extractedText = await (0, parserService_1.parseDocumentFile)(req.file.path, req.file.originalname);
        // Read raw file buffer and mimetype
        const fileBuffer = fs_1.default.readFileSync(req.file.path);
        const mimeType = req.file.mimetype;
        // Save to in-memory store (extractedText can be empty for images/scanned PDFs)
        documentStore_1.documentStore.setDocument(req.file.originalname, extractedText, fileBuffer, mimeType);
        // Delete the temporary file from disk immediately to keep filesystem clean
        if (fs_1.default.existsSync(req.file.path)) {
            fs_1.default.unlinkSync(req.file.path);
        }
        res.status(200).json({
            success: true,
            message: 'File uploaded and parsed successfully.',
            fileName: req.file.originalname,
        });
    }
    catch (error) {
        // Make sure to clean up uploaded file if parsing fails
        if (req.file && fs_1.default.existsSync(req.file.path)) {
            fs_1.default.unlinkSync(req.file.path);
        }
        console.error('[Upload Controller] Error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to process document.',
        });
    }
};
exports.uploadDocument = uploadDocument;
exports.default = exports.uploadDocument;
