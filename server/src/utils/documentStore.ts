/**
 * Simple in-memory storage for active document metadata, extracted text, and live editor content.
 * Avoids complex database setups for beginner-friendly structures.
 */
class InMemoryDocumentStore {
  private fileName: string | null = null;
  private extractedText: string | null = null;
  private editorContent: string | null = null;
  private fileBuffer: Buffer | null = null;
  private mimeType: string | null = null;

  public setDocument(name: string, text: string, buffer: Buffer | null = null, mimeType: string | null = null): void {
    this.fileName = name;
    this.extractedText = text;
    this.editorContent = text || 'This uploaded document appears to be empty or contains non-selectable text. You can start typing here!';
    this.fileBuffer = buffer;
    this.mimeType = mimeType;
    console.log(`[Document Store] In-memory active doc set: "${name}" (${text.length} characters, buffer size: ${buffer ? buffer.length : 0} bytes, mime: ${mimeType})`);
  }

  public getDocumentText(): string | null {
    // Grounding text should be current editor content if available, fallback to extractedText
    return this.editorContent || this.extractedText;
  }

  public getEditorContent(): string {
    return this.editorContent || '';
  }

  public updateEditorContent(content: string): void {
    this.editorContent = content;
  }

  public getFileName(): string | null {
    return this.fileName;
  }

  public getFileBuffer(): Buffer | null {
    return this.fileBuffer;
  }

  public getMimeType(): string | null {
    return this.mimeType;
  }

  public clearStore(): void {
    console.log(`[Document Store] Clearing active doc: "${this.fileName}"`);
    this.fileName = null;
    this.extractedText = null;
    this.editorContent = null;
    this.fileBuffer = null;
    this.mimeType = null;
  }
}

export const documentStore = new InMemoryDocumentStore();
export default documentStore;

