"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.askQuestionStream = void 0;
const aiService_1 = require("../services/aiService");
const documentStore_1 = require("../utils/documentStore");
/**
 * Handles real-time question answering via Server-Sent Events (SSE).
 */
const askQuestionStream = async (req, res) => {
    const { question, history } = req.body;
    try {
        if (!question || !question.trim()) {
            res.status(400).json({ success: false, message: 'Question cannot be empty.' });
            return;
        }
        const docText = documentStore_1.documentStore.getDocumentText();
        const fileName = documentStore_1.documentStore.getFileName();
        const fileBuffer = documentStore_1.documentStore.getFileBuffer();
        const mimeType = documentStore_1.documentStore.getMimeType();
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
            const canUseMultimodal = provider === 'gemini' && hasGeminiKey && fileBuffer && mimeType;
            if (!canUseMultimodal) {
                res.status(400).json({
                    success: false,
                    message: 'The uploaded document contains no readable text. To read scanned PDFs, images, or documents without selectable text, please configure a GEMINI_API_KEY in the server\'s .env file.'
                });
                return;
            }
        }
        console.log(`[Stream Controller] Direct streaming question about "${fileName}": "${question}"`);
        // Set headers for Server-Sent Events (SSE)
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            // Allow CORS for streaming
            'Access-Control-Allow-Origin': '*',
        });
        // Send keep-alive comment
        res.write(': keep-alive\n\n');
        let isClosed = false;
        res.on('close', () => {
            isClosed = true;
            console.log('[Stream Controller] Response connection closed.');
        });
        // Obtain the async generator for stream chunks
        const stream = (0, aiService_1.generateGroundedAnswerStream)(docText, question, fileBuffer, mimeType, history);
        let count = 0;
        for await (const chunk of stream) {
            if (isClosed) {
                console.log('[Stream Controller] Connection is closed, breaking loop.');
                break;
            }
            count++;
            console.log(`[Stream Controller] Writing chunk #${count}: "${chunk}"`);
            res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
            // Flush if the response supports it
            if (res.flush) {
                res.flush();
            }
        }
        console.log(`[Stream Controller] Loop complete. Wrote ${count} chunks. isClosed =`, isClosed);
        if (!isClosed) {
            res.write('data: [DONE]\n\n');
            res.end();
        }
    }
    catch (error) {
        console.error('[Stream Controller] Streaming error:', error);
        if (!res.headersSent) {
            res.status(500).json({
                success: false,
                message: error.message || 'Failed to initialize answer stream.',
            });
        }
        else {
            res.write(`data: ${JSON.stringify({ error: error.message || 'Stream interrupted.' })}\n\n`);
            res.end();
        }
    }
};
exports.askQuestionStream = askQuestionStream;
exports.default = exports.askQuestionStream;
