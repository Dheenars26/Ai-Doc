"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const uploadController_1 = require("../controllers/uploadController");
const askController_1 = require("../controllers/askController");
const streamController_1 = require("../controllers/streamController");
const editController_1 = require("../controllers/editController");
const documentStore_1 = require("../utils/documentStore");
const router = (0, express_1.Router)();
// Ensure temporary uploads directory exists
const uploadDir = path_1.default.resolve(__dirname, '../../uploads');
if (!fs_1.default.existsSync(uploadDir)) {
    fs_1.default.mkdirSync(uploadDir, { recursive: true });
}
// Multer storage setup
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, `${uniqueSuffix}-${file.originalname}`);
    },
});
// File extension filter
const fileFilter = (req, file, cb) => {
    const allowedExtensions = ['.pdf', '.docx', '.txt', '.png', '.jpg', '.jpeg'];
    const ext = path_1.default.extname(file.originalname).toLowerCase();
    if (allowedExtensions.includes(ext)) {
        cb(null, true);
    }
    else {
        cb(new Error(`Unsupported file format ${ext}. Supported formats are: PDF, DOCX, TXT, PNG, JPG, JPEG.`), false);
    }
};
const upload = (0, multer_1.default)({
    storage,
    limits: {
        fileSize: 100 * 1024 * 1024, // 100MB limit
    },
    fileFilter,
});
// Routes
router.post('/upload', upload.single('file'), uploadController_1.uploadDocument);
router.post('/ask', askController_1.askQuestion);
router.post('/ask-stream', streamController_1.askQuestionStream);
router.post('/edit-text', editController_1.editText);
// Get active document status endpoint
router.get('/document', (req, res) => {
    const fileName = documentStore_1.documentStore.getFileName();
    const provider = (process.env.AI_PROVIDER || 'gemini').toLowerCase();
    const hasApiKey = provider === 'openai' ? !!process.env.OPENAI_API_KEY : !!process.env.GEMINI_API_KEY;
    res.status(200).json({
        success: true,
        hasDocument: fileName !== null,
        fileName: fileName,
        content: documentStore_1.documentStore.getEditorContent(),
        hasApiKey,
        apiProvider: provider,
    });
});
// Clear active document endpoint
router.delete('/document', (req, res) => {
    const fileName = documentStore_1.documentStore.getFileName();
    if (!fileName) {
        res.status(400).json({ success: false, message: 'No document active in memory.' });
        return;
    }
    documentStore_1.documentStore.clearStore();
    res.status(200).json({ success: true, message: 'Document cleared from in-memory cache.' });
});
exports.default = router;
