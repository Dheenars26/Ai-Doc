import fs from 'fs';
import path from 'path';
import pdf from 'pdf-parse';
import mammoth from 'mammoth';

/**
 * Reads and extracts raw text from PDF, DOCX, and TXT files.
 */
export const parseDocumentFile = async (filePath: string, originalFilename: string): Promise<string> => {
  const ext = path.extname(originalFilename).toLowerCase();
  
  if (!fs.existsSync(filePath)) {
    throw new Error('Upload file does not exist on disk.');
  }

  try {
    switch (ext) {
      case '.txt': {
        // Plain text parsing
        const rawText = fs.readFileSync(filePath, 'utf8');
        return rawText.trim();
      }

      case '.pdf': {
        // PDF parsing using pdf-parse
        const buffer = fs.readFileSync(filePath);
        // Cast options to any to satisfy TS compiler definitions
        const parsedData = await pdf(buffer, {} as any);
        return parsedData.text.trim();
      }

      case '.docx': {
        // Microsoft Word parsing using mammoth
        const result = await mammoth.extractRawText({ path: filePath });
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
  } catch (error) {
    console.error(`[Parser Service] Failed to parse file ${originalFilename}:`, error);
    throw new Error(`File parsing failed: ${(error as Error).message}`);
  }
};
