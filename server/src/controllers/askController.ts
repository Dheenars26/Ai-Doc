import { Request, Response } from 'express';
import { generateGroundedAnswer, generateSuggestedQuestions } from '../services/aiService';
import { documentStore } from '../utils/documentStore';

/**
 * Handles user questions. Grounds queries against the in-memory document text.
 */
export const askQuestion = async (req: Request, res: Response): Promise<void> => {
  const { question, history } = req.body;

  try {
    if (!question || !question.trim()) {
      res.status(400).json({ success: false, message: 'Question cannot be empty.' });
      return;
    }

    const docText = documentStore.getDocumentText();
    const fileName = documentStore.getFileName();
    const fileBuffer = documentStore.getFileBuffer();
    const mimeType = documentStore.getMimeType();

    if (fileName === null || docText === null) {
      res.status(400).json({ 
        success: false, 
        message: 'No document active in memory. Please upload a document first.' 
      });
      return;
    }

    const provider = (process.env.AI_PROVIDER || 'gemini').toLowerCase();
    const hasGeminiKey = !!process.env.GEMINI_API_KEY;

    if (docText.trim().length === 0) {
      // Check if we can fall back to direct multimodal parsing via Gemini API
      const canUseMultimodal = provider === 'gemini' && hasGeminiKey && fileBuffer && mimeType;
      if (!canUseMultimodal) {
        res.status(400).json({
          success: false,
          message: 'The uploaded document contains no readable text. To read scanned PDFs, images, or documents without selectable text, please configure a GEMINI_API_KEY in the server\'s .env file.'
        });
        return;
      }
    }

    console.log(`[Ask Controller] Processing question about "${fileName}": "${question}"`);

    // Call completion service
    const answer = await generateGroundedAnswer(docText, question, fileBuffer, mimeType, history);

    res.status(200).json({
      success: true,
      answer,
    });
  } catch (error) {
    console.error('[Ask Controller] Error:', error);
    res.status(500).json({
      success: false,
      message: (error as Error).message || 'Failed to generate answer.',
    });
  }
};

/**
 * Generates suggested questions for the active document.
 */
export const getSuggestedQuestions = async (req: Request, res: Response): Promise<void> => {
  try {
    const docText = documentStore.getDocumentText();
    const fileName = documentStore.getFileName();

    if (!fileName || !docText) {
      res.status(200).json({
        success: true,
        questions: []
      });
      return;
    }

    console.log(`[Ask Controller] Generating suggested questions for "${fileName}"`);
    const questions = await generateSuggestedQuestions(docText);

    res.status(200).json({
      success: true,
      questions,
    });
  } catch (error) {
    console.error('[Ask Controller] Error generating suggested questions:', error);
    res.status(500).json({
      success: false,
      message: (error as Error).message || 'Failed to generate suggested questions.',
    });
  }
};

export default askQuestion;

