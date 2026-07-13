import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { uploadDocument } from '../controllers/uploadController';
import { askQuestion } from '../controllers/askController';
import { askQuestionStream } from '../controllers/streamController';
import { editText } from '../controllers/editController';
import { documentStore } from '../utils/documentStore';

const router = Router();

// Ensure temporary uploads directory exists
const uploadDir = path.resolve(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer storage setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  },
});

// File extension filter
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedExtensions = ['.pdf', '.docx', '.txt', '.png', '.jpg', '.jpeg'];
  const ext = path.extname(file.originalname).toLowerCase();
  
  if (allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`Unsupported file format ${ext}. Supported formats are: PDF, DOCX, TXT, PNG, JPG, JPEG.`) as any, false);
  }
};

const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
  },
  fileFilter,
});

// Routes
router.post('/upload', upload.single('file'), uploadDocument);
router.post('/ask', askQuestion);
router.post('/ask-stream', askQuestionStream);
router.post('/edit-text', editText);

// Get active document status endpoint
router.get('/document', (req, res) => {
  const fileName = documentStore.getFileName();
  const provider = (process.env.AI_PROVIDER || 'gemini').toLowerCase();
  const hasApiKey = provider === 'openai' ? !!process.env.OPENAI_API_KEY : !!process.env.GEMINI_API_KEY;

  res.status(200).json({
    success: true,
    hasDocument: fileName !== null,
    fileName: fileName,
    content: documentStore.getEditorContent(),
    hasApiKey,
    apiProvider: provider,
  });
});

// Clear active document endpoint
router.delete('/document', (req, res) => {
  const fileName = documentStore.getFileName();
  if (!fileName) {
    res.status(400).json({ success: false, message: 'No document active in memory.' });
    return;
  }
  documentStore.clearStore();
  res.status(200).json({ success: true, message: 'Document cleared from in-memory cache.' });
});

export default router;
