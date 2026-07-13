"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.documentStore = void 0;
/**
 * Simple in-memory storage for active document metadata, extracted text, and live editor content.
 * Avoids complex database setups for beginner-friendly structures.
 */
class InMemoryDocumentStore {
    fileName = null;
    extractedText = null;
    editorContent = null;
    fileBuffer = null;
    mimeType = null;
    setDocument(name, text, buffer = null, mimeType = null) {
        this.fileName = name;
        this.extractedText = text;
        this.editorContent = text || 'This uploaded document appears to be empty or contains non-selectable text. You can start typing here!';
        this.fileBuffer = buffer;
        this.mimeType = mimeType;
        console.log(`[Document Store] In-memory active doc set: "${name}" (${text.length} characters, buffer size: ${buffer ? buffer.length : 0} bytes, mime: ${mimeType})`);
    }
    getDocumentText() {
        // Grounding text should be current editor content if available, fallback to extractedText
        return this.editorContent || this.extractedText;
    }
    getEditorContent() {
        return this.editorContent || '';
    }
    updateEditorContent(content) {
        this.editorContent = content;
    }
    getFileName() {
        return this.fileName;
    }
    getFileBuffer() {
        return this.fileBuffer;
    }
    getMimeType() {
        return this.mimeType;
    }
    clearStore() {
        console.log(`[Document Store] Clearing active doc: "${this.fileName}"`);
        this.fileName = null;
        this.extractedText = null;
        this.editorContent = null;
        this.fileBuffer = null;
        this.mimeType = null;
    }
}
exports.documentStore = new InMemoryDocumentStore();
exports.default = exports.documentStore;
