import { Request, Response } from 'express';
import { generateTextEdit } from '../services/aiService';

export const editText = async (req: Request, res: Response): Promise<void> => {
  const { text, command } = req.body;

  try {
    if (!text || !text.trim()) {
      res.status(400).json({ success: false, message: 'Text to edit cannot be empty.' });
      return;
    }

    if (!command) {
      res.status(400).json({ success: false, message: 'Command cannot be empty.' });
      return;
    }

    console.log(`[Edit Controller] Editing text with command: "${command}"`);
    const result = await generateTextEdit(text, command);

    res.status(200).json({
      success: true,
      result,
    });
  } catch (error) {
    console.error('[Edit Controller] Error:', error);
    res.status(500).json({
      success: false,
      message: (error as Error).message || 'Failed to edit text.',
    });
  }
};

export default editText;
