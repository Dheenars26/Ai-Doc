import { Request, Response } from 'express';
import fs from 'fs';
import { parseDocumentFile } from '../services/parserService';
import { documentStore } from '../utils/documentStore';

/**
 * Handles incoming document uploads, extracts text, and caches it in memory.
 */
export const uploadDocument = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, message: 'No file uploaded.' });
      return;
    }

    console.log(`[Upload Controller] Received file: ${req.file.originalname} (${req.file.size} bytes)`);

    // Parse the file and extract text
    const extractedText = await parseDocumentFile(req.file.path, req.file.originalname);

    // Read raw file buffer and mimetype
    const fileBuffer = fs.readFileSync(req.file.path);
    const mimeType = req.file.mimetype;

    // Save to in-memory store (extractedText can be empty for images/scanned PDFs)
    documentStore.setDocument(req.file.originalname, extractedText, fileBuffer, mimeType);

    // Delete the temporary file from disk immediately to keep filesystem clean
    if (fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(200).json({
      success: true,
      message: 'File uploaded and parsed successfully.',
      fileName: req.file.originalname,
    });
  } catch (error) {
    // Make sure to clean up uploaded file if parsing fails
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    console.error('[Upload Controller] Error:', error);
    res.status(500).json({
      success: false,
      message: (error as Error).message || 'Failed to process document.',
    });
  }
};
export default uploadDocument;
