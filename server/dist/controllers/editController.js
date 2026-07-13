"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.editText = void 0;
const aiService_1 = require("../services/aiService");
const editText = async (req, res) => {
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
        const result = await (0, aiService_1.generateTextEdit)(text, command);
        res.status(200).json({
            success: true,
            result,
        });
    }
    catch (error) {
        console.error('[Edit Controller] Error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to edit text.',
        });
    }
};
exports.editText = editText;
exports.default = exports.editText;
