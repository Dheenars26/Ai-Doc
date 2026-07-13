export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export interface DocumentState {
  fileName: string | null;
  isActive: boolean;
  content?: string;
}

export interface Collaborator {
  id: string;
  name: string;
  color: string;
  isMe?: boolean;
  isSimulated?: boolean;
  cursor?: { line: number; ch: number };
}

