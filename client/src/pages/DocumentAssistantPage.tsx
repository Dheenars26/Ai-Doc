import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import { FileUploader } from '../components/FileUploader';
import { Navbar } from '../components/Navbar';
import { Hero } from '../components/Hero';
import { UploadCard } from '../components/UploadCard';
import { QuestionBox } from '../components/QuestionBox';
import { AnswerCard } from '../components/AnswerCard';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { EmptyState } from '../components/EmptyState';
import { ErrorAlert } from '../components/ErrorAlert';
import { Footer } from '../components/Footer';
import { Message, Collaborator } from '../types/types';
import { io } from 'socket.io-client';
import { 
  Brain, Sparkles, Trash2, 
  FileCode, CheckCircle2, Users, Settings, Check, 
  ChevronDown, FileText, List, CheckSquare, Zap, AlertCircle,
  Plus, Bold, Italic, Code, Heading1, ChevronRight, FileSignature, Trash
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

interface DocFile {
  name: string;
  content: string;
}

export const DocumentAssistantPage: React.FC = () => {
  const [fileName, setFileName] = useState<string | null>(null);
  const [editorContent, setEditorContent] = useState<string>('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isCheckingStore, setIsCheckingStore] = useState<boolean>(true);

  // Server configurations status
  const [hasApiKey, setHasApiKey] = useState<boolean>(false);
  const [apiProvider, setApiProvider] = useState<string>('gemini');

  // Sidebar Multi-document state
  const [files, setFiles] = useState<DocFile[]>([]);
  const [activeFileIdx, setActiveFileIdx] = useState<number>(0);

  // Layout UI Toggles
  const [activeLine, setActiveLine] = useState<number | null>(null);
  const [profileModalOpen, setProfileModalOpen] = useState<boolean>(false);

  // Dark Mode State
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    return localStorage.getItem('theme') === 'dark' || 
      (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });

  // Socket state
  const [socket, setSocket] = useState<any>(null);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [collaboratorCursors, setCollaboratorCursors] = useState<Record<string, { name: string; color: string; line: number; ch: number }>>({});
  
  // Local profile state
  const [myProfile, setMyProfile] = useState<{ name: string; color: string }>(() => {
    const saved = localStorage.getItem('documind_profile');
    if (saved) {
      try { return JSON.parse(saved); } catch(e) {}
    }
    const defaultName = `Writer-${Math.floor(100 + Math.random() * 900)}`;
    const avatarColors = [
      '#f87171', '#fb923c', '#fbbf24', '#34d399', '#2dd4bf',
      '#38bdf8', '#60a5fa', '#818cf8', '#a78bfa', '#c084fc', '#f472b6'
    ];
    return { name: defaultName, color: avatarColors[Math.floor(Math.random() * avatarColors.length)] };
  });

  const [aiMenuOpen, setAiMenuOpen] = useState<boolean>(false);
  const [isEditingTextWithAi, setIsEditingTextWithAi] = useState<boolean>(false);
  const [aiEditError, setAiEditError] = useState<string | null>(null);
  const [selectedRange, setSelectedRange] = useState<{ start: number; end: number } | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const isExternalUpdate = useRef<boolean>(false);
  const savedSelection = useRef<{ start: number; end: number } | null>(null);

  const activeFileIdxRef = useRef<number>(0);
  const fileNameRef = useRef<string | null>(null);

  useEffect(() => {
    activeFileIdxRef.current = activeFileIdx;
  }, [activeFileIdx]);

  useEffect(() => {
    fileNameRef.current = fileName;
  }, [fileName]);

  // Sync Tailwind class with Dark Mode state
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  // Sync active document details on page load (REST fallback + API configurations check)
  const syncStore = async () => {
    try {
      const res = await api.get('/document');
      if (res.data.success) {
        setHasApiKey(!!res.data.hasApiKey);
        setApiProvider(res.data.apiProvider || 'gemini');
        if (res.data.hasDocument) {
          const loadedName = res.data.fileName || 'Collab Doc.txt';
          const loadedContent = res.data.content || '';
          setFileName(loadedName);
          setEditorContent(loadedContent);
          
          setFiles(prev => {
            const idx = prev.findIndex(f => f.name === loadedName);
            if (idx !== -1) {
              const next = [...prev];
              next[idx] = { name: loadedName, content: loadedContent };
              setActiveFileIdx(idx);
              return next;
            } else {
              const next = [...prev, { name: loadedName, content: loadedContent }];
              setActiveFileIdx(next.length - 1);
              return next;
            }
          });
        }
      }
    } catch (err) {
      console.error('Failed to sync active store REST:', err);
    } finally {
      setIsCheckingStore(false);
    }
  };

  // Socket Connection and Event Bindings (Run once on mount)
  useEffect(() => {
    const socketUrl = API_URL.endsWith('/api') ? API_URL.substring(0, API_URL.length - 4) : 'http://localhost:5000';
    console.log('[Socket] Connecting to:', socketUrl);
    const newSocket = io(socketUrl);
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('[Socket] Connected as socket ID:', newSocket.id);
      newSocket.emit('update-profile', myProfile);
    });

    newSocket.on('document-init', (data: { content: string; fileName: string | null; users: any[] }) => {
      console.log('[Socket] document-init received:', data);
      if (data.fileName) {
        setFileName(data.fileName);
        setEditorContent(data.content || '');
        setFiles(prev => {
          const idx = prev.findIndex(f => f.name === data.fileName);
          if (idx !== -1) {
            const next = [...prev];
            next[idx] = { name: data.fileName!, content: data.content };
            setActiveFileIdx(idx);
            return next;
          } else {
            const next = [...prev, { name: data.fileName!, content: data.content }];
            setActiveFileIdx(next.length - 1);
            return next;
          }
        });
      }
      setCollaborators(data.users || []);
    });

    newSocket.on('user-list-update', (users: any[]) => {
      setCollaborators(users || []);
    });

    newSocket.on('document-change', (data: { content: string; fileName?: string | null; senderId: string }) => {
      if (data.senderId !== newSocket.id) {
        if (textareaRef.current) {
          savedSelection.current = {
            start: textareaRef.current.selectionStart,
            end: textareaRef.current.selectionEnd
          };
        }
        isExternalUpdate.current = true;
        setEditorContent(data.content);
        if (data.fileName !== undefined) {
          setFileName(data.fileName);
        }

        // Sync local files list
        setFiles(prev => prev.map(f => {
          if (data.fileName && f.name === data.fileName) {
            return { ...f, content: data.content };
          }
          return f;
        }));
      }
    });

    newSocket.on('cursor-update', (data: { userId: string; name: string; color: string; cursor?: { line: number; ch: number } }) => {
      if (data.userId !== newSocket.id) {
        setCollaboratorCursors(prev => {
          const next = { ...prev };
          if (data.cursor) {
            next[data.userId] = {
              name: data.name,
              color: data.color,
              line: data.cursor.line,
              ch: data.cursor.ch
            };
          } else {
            delete next[data.userId];
          }
          return next;
        });
      }
    });

    newSocket.on('insert-ai-text-broadcast', (data: { text: string; position: { line: number; ch: number }; senderId: string }) => {
      setEditorContent(prev => {
        const lines = prev.split('\n');
        const targetLineIdx = Math.min(data.position.line, lines.length - 1);
        const line = lines[targetLineIdx] || '';
        const chIdx = Math.min(data.position.ch, line.length);
        
        lines[targetLineIdx] = line.substring(0, chIdx) + data.text + line.substring(chIdx);
        const nextContent = lines.join('\n');
        
        // Sync in files state matching active fileNameRef current value
        setFiles(prevFiles => prevFiles.map(f => {
          if (f.name === fileNameRef.current) {
            return { ...f, content: nextContent };
          }
          return f;
        }));

        return nextContent;
      });
    });

    return () => {
      newSocket.disconnect();
    };
  }, []);

  // Update profile to server and save to storage
  useEffect(() => {
    localStorage.setItem('documind_profile', JSON.stringify(myProfile));
    if (socket) {
      socket.emit('update-profile', myProfile);
    }
  }, [myProfile, socket]);

  // Restore cursor position after external updates
  useEffect(() => {
    if (isExternalUpdate.current && textareaRef.current && savedSelection.current) {
      const { start, end } = savedSelection.current;
      textareaRef.current.setSelectionRange(start, end);
      isExternalUpdate.current = false;
      savedSelection.current = null;
    }
  }, [editorContent]);

  useEffect(() => {
    syncStore();
  }, []);

  const handleEditorChange = (newContent: string, newFileName: string | null = fileName) => {
    setEditorContent(newContent);
    setFiles(prev => prev.map((f, i) => {
      if (i === activeFileIdx) {
        return { ...f, content: newContent };
      }
      return f;
    }));
    if (socket) {
      socket.emit('document-change', {
        content: newContent,
        fileName: newFileName,
        source: 'user'
      });
    }
  };

  const handleScroll = () => {
    if (textareaRef.current && gutterRef.current) {
      gutterRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  const handleCursorMove = () => {
    if (!textareaRef.current || !socket) return;
    const textarea = textareaRef.current;
    const text = textarea.value;
    const selStart = textarea.selectionStart;
    const lines = text.substring(0, selStart).split('\n');
    const line = lines.length - 1;
    const ch = lines[lines.length - 1].length;

    setActiveLine(line);
    socket.emit('cursor-move', { line, ch });
  };

  const handleTextareaSelect = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const textarea = e.currentTarget;
    setSelectedRange({
      start: textarea.selectionStart,
      end: textarea.selectionEnd
    });
  };

  // Switch active document file
  const handleSelectFile = (idx: number) => {
    setActiveFileIdx(idx);
    const targetFile = files[idx];
    setFileName(targetFile.name);
    setEditorContent(targetFile.content);
    if (socket) {
      socket.emit('document-change', {
        content: targetFile.content,
        fileName: targetFile.name,
        source: 'switch'
      });
    }
  };

  // Create new blank document in workspace
  const handleCreateNewFile = () => {
    const defaultName = `document-${files.length + 1}.txt`;
    const defaultContent = '';
    const updatedFiles = [...files, { name: defaultName, content: defaultContent }];
    setFiles(updatedFiles);
    
    // Switch to it
    const newIdx = updatedFiles.length - 1;
    setActiveFileIdx(newIdx);
    setFileName(defaultName);
    setEditorContent(defaultContent);
    if (socket) {
      socket.emit('document-change', {
        content: defaultContent,
        fileName: defaultName,
        source: 'create'
      });
    }
  };

  const handleStartWithBlank = () => {
    const blankName = 'Collab Doc.txt';
    const blankContent = 'Welcome to DocuMind Studio! This is a real-time collaborative workspace. Highlight text segments to apply AI improvements, use the formatting bar below to edit structure, and click the Chat panel on the right to ground your queries.';
    
    setFileName(blankName);
    setEditorContent(blankContent);
    setFiles([
      { name: 'Collab Doc.txt', content: 'Welcome to DocuMind Studio! This is a real-time collaborative workspace. Highlight text segments to apply AI improvements, use the formatting bar below to edit structure, and click the Chat panel on the right to ground your queries.' },
      { name: 'scratchpad.txt', content: '// Scratchpad - write temporary code or notes here' },
      { name: 'README.md', content: '# DocuMind Studio\n\nA collaborative workspace designed for pair writing and grounded AI reasoning.' }
    ]);
    setActiveFileIdx(0);
    
    if (socket) {
      socket.emit('document-change', {
        content: blankContent,
        fileName: blankName,
        source: 'create'
      });
    }
  };

  // Selection formatting tools (Bold, Italic, Outline, Code)
  const handleFormatText = (prefix: string, suffix: string = prefix) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = selectedRange ? selectedRange.start : textarea.selectionStart;
    const end = selectedRange ? selectedRange.end : textarea.selectionEnd;
    const currentText = textarea.value;
    const selectedText = currentText.substring(start, end);

    const replacement = prefix + selectedText + suffix;
    const newText = currentText.substring(0, start) + replacement + currentText.substring(end);
    
    handleEditorChange(newText);

    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(start, start + replacement.length);
        setSelectedRange({ start, end: start + replacement.length });
      }
    }, 100);
  };

  const handleUploadSuccess = (uploadedName: string) => {
    setMessages([]);
    setIsCheckingStore(true);
    setTimeout(async () => {
      try {
        const res = await api.get('/document');
        if (res.data.success) {
          const content = res.data.content || '';
          
          setFiles(prev => {
            const exists = prev.findIndex(f => f.name === uploadedName);
            if (exists !== -1) {
              const updated = [...prev];
              updated[exists] = { name: uploadedName, content };
              setActiveFileIdx(exists);
              return updated;
            } else {
              const next = [...prev, { name: uploadedName, content }];
              setActiveFileIdx(next.length - 1);
              return next;
            }
          });

          setFileName(uploadedName);
          setEditorContent(content);
          setHasApiKey(!!res.data.hasApiKey);
          setApiProvider(res.data.apiProvider || 'gemini');
          if (socket) {
            socket.emit('document-change', {
              content,
              fileName: uploadedName,
              source: 'upload'
            });
          }
        }
      } catch (err) {
        console.error('Failed to reload document content:', err);
      } finally {
        setIsCheckingStore(false);
      }
    }, 500);
  };

  // Stream assistant grounded answer
  const handleSendMessage = async (text: string) => {
    if (!text.trim() || isGenerating) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
    };

    setMessages(prev => [...prev, userMessage]);
    setIsGenerating(true);

    const assistantMessageId = (Date.now() + 1).toString();
    setMessages(prev => [
      ...prev,
      { id: assistantMessageId, role: 'assistant', content: '░' }
    ]);

    try {
      const response = await fetch(`${API_URL}/ask-stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          question: text,
          history: messages.map(m => ({ role: m.role, content: m.content }))
        }),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.message || 'Error initializing AI stream.');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('Reader not supported.');

      const decoder = new TextDecoder();
      let assistantResponseText = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (value) buffer += decoder.decode(value, { stream: true });

        let boundary = buffer.indexOf('\n');
        while (boundary !== -1) {
          const line = buffer.substring(0, boundary).trim();
          buffer = buffer.substring(boundary + 1);
          boundary = buffer.indexOf('\n');

          if (line.startsWith('data: ')) {
            const dataStr = line.substring(6).trim();
            if (dataStr === '[DONE]') break;
            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.chunk) {
                assistantResponseText += parsed.chunk;
                setMessages(prev =>
                  prev.map(m => m.id === assistantMessageId ? { ...m, content: assistantResponseText } : m)
                );
              }
            } catch (e) {
              console.error('[SSE] Parse error:', e);
            }
          }
        }

        if (done) {
          const finalLine = buffer.trim();
          if (finalLine.startsWith('data: ')) {
            const dataStr = finalLine.substring(6).trim();
            if (dataStr !== '[DONE]') {
              try {
                const parsed = JSON.parse(dataStr);
                if (parsed.chunk) {
                  assistantResponseText += parsed.chunk;
                  setMessages(prev =>
                    prev.map(m => m.id === assistantMessageId ? { ...m, content: assistantResponseText } : m)
                  );
                }
              } catch (e) {
                console.error('[SSE] Final line error:', e);
              }
            }
          }
          break;
        }
      }
    } catch (err: any) {
      console.error('[SSE Chat] error:', err);
      const errorText = err.message || 'Error communicating with AI. Please verify key settings.';
      setMessages(prev =>
        prev.map(m => m.id === assistantMessageId ? { ...m, content: errorText } : m)
      );
    } finally {
      setIsGenerating(false);
    }
  };

  // Perform AI Edit Action (Inline replacements)
  const handleAiEdit = async (command: 'improve' | 'grammar' | 'summarize' | 'longer' | 'shorter' | 'outline') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = selectedRange ? selectedRange.start : textarea.selectionStart;
    const end = selectedRange ? selectedRange.end : textarea.selectionEnd;
    const selectedText = textarea.value.substring(start, end).trim();

    if (!selectedText) {
      setAiEditError("Please select/highlight text in the editor first to apply AI edits!");
      setTimeout(() => setAiEditError(null), 4000);
      setAiMenuOpen(false);
      return;
    }

    setIsEditingTextWithAi(true);
    setAiEditError(null);
    setAiMenuOpen(false);

    try {
      const res = await api.post('/edit-text', {
        text: selectedText,
        command
      });

      if (res.data.success) {
        const replacement = res.data.result;
        const currentText = textarea.value;
        const newText = currentText.substring(0, start) + replacement + currentText.substring(end);
        
        handleEditorChange(newText);
        
        // Highlight updated segment
        setTimeout(() => {
          if (textareaRef.current) {
            textareaRef.current.focus();
            textareaRef.current.setSelectionRange(start, start + replacement.length);
            setSelectedRange({ start, end: start + replacement.length });
          }
        }, 100);
      } else {
        setAiEditError(res.data.message || "Edit action failed.");
      }
    } catch (err: any) {
      console.error("AI edit request error:", err);
      setAiEditError(err.response?.data?.message || "Failed to contact edit API.");
      setTimeout(() => setAiEditError(null), 4000);
    } finally {
      setIsEditingTextWithAi(false);
    }
  };

  const handleInsertChatAnswer = (text: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      const newText = editorContent ? `${editorContent}\n\n${text}` : text;
      handleEditorChange(newText);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentText = textarea.value;

    const newText = currentText.substring(0, start) + text + currentText.substring(end);
    handleEditorChange(newText);

    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(start + text.length, start + text.length);
      }
    }, 100);
  };

  const handleClearChat = () => {
    setMessages([]);
  };

  const handleClearDoc = async () => {
    try {
      await api.delete('/document');
      
      setFiles([]);
      setFileName(null);
      setEditorContent('');
      setMessages([]);
      if (socket) {
        socket.emit('document-change', {
          content: '',
          fileName: null,
          source: 'clear'
        });
      }
    } catch (err) {
      console.error('Failed to clear active document:', err);
      setFiles([]);
      setFileName(null);
      setEditorContent('');
      setMessages([]);
    }
  };

  const lineCount = editorContent.split('\n').length || 1;
  const avatarColors = [
    '#f87171', '#fb923c', '#fbbf24', '#34d399', '#2dd4bf',
    '#38bdf8', '#60a5fa', '#818cf8', '#a78bfa', '#c084fc', '#f472b6'
  ];

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col relative text-left font-sans transition-colors duration-200">
      
      {/* Top Navbar */}
      <Navbar darkMode={darkMode} onToggleDarkMode={() => setDarkMode(!darkMode)} />

      {isCheckingStore ? (
        <div className="flex-1 flex items-center justify-center">
          <LoadingSpinner message="Reading workspace document store..." />
        </div>
      ) : !fileName ? (
        /* Lobby State (No Active Document) */
        <div className="flex-grow flex flex-col justify-center max-w-4xl mx-auto px-6 w-full space-y-8 py-12">
          <Hero />
          
          <div className="max-w-xl mx-auto w-full space-y-6">
            <UploadCard 
              fileName={fileName} 
              editorContent={editorContent}
              onUploadSuccess={handleUploadSuccess}
              onReplace={handleClearDoc}
              isCheckingStore={isCheckingStore}
            />
            <EmptyState />
          </div>

          <Footer />
        </div>
      ) : (
        /* Workspace State (Active Document Layout Centered) */
        <div className="flex-grow flex flex-col justify-center max-w-4xl mx-auto px-6 w-full space-y-8 py-12">
          <div className="max-w-xl mx-auto w-full space-y-6">
            <UploadCard 
              fileName={fileName} 
              editorContent={editorContent}
              onUploadSuccess={handleUploadSuccess}
              onReplace={handleClearDoc}
              isCheckingStore={isCheckingStore}
            />

            <QuestionBox 
              onSend={handleSendMessage} 
              isGenerating={isGenerating} 
              disabled={isCheckingStore}
            />

            <AnswerCard 
              messages={messages} 
              onRegenerate={() => handleSendMessage(messages[messages.length - 2]?.content || '')} 
              onClear={handleClearChat} 
              isGenerating={isGenerating}
              disabled={isCheckingStore}
            />
          </div>

          <Footer />
        </div>
      )}

      {/* User profile customize Dialog Modal */}
      {profileModalOpen && (
        <div className="fixed inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 animate-fade-in">
          <div className="w-full max-w-sm bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-850 rounded-3xl shadow-xl p-6 space-y-6 relative overflow-hidden animate-scale-in text-left">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
            
            {/* Modal Header */}
            <div className="flex items-center justify-between select-none">
              <div className="flex items-center gap-2">
                <Settings className="h-4.5 w-4.5 text-blue-600 dark:text-blue-400" />
                <h3 className="font-heading text-sm font-bold text-zinc-900 dark:text-zinc-50">Customize User Profile</h3>
              </div>
              <button 
                onClick={() => setProfileModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white text-[10px] font-bold uppercase transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>

            {/* Nickname Input */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest block">Your Nickname</label>
              <input
                type="text"
                placeholder="Enter nickname..."
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-blue-500/50 glass-input font-medium"
                value={myProfile.name}
                onChange={(e) => setMyProfile(prev => ({ ...prev, name: e.target.value }))}
                maxLength={14}
              />
            </div>

            {/* Gradient Selector */}
            <div className="space-y-3">
              <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest block">Choose Avatar Color</label>
              <div className="grid grid-cols-6 gap-3">
                {avatarColors.map((color) => (
                  <button
                    key={color}
                    onClick={() => setMyProfile(prev => ({ ...prev, color }))}
                    className="w-10 h-10 rounded-full relative border border-zinc-200 dark:border-zinc-800 transition-all transform hover:scale-110 cursor-pointer shadow-sm"
                    style={{ backgroundColor: color }}
                  >
                    {myProfile.color === color && (
                      <div className="absolute inset-0 m-auto w-5 h-5 rounded-full bg-white shadow flex items-center justify-center animate-scale-in">
                        <Check className="h-3.5 w-3.5 text-blue-600 font-extrabold" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Live Cursor Preview */}
            <div className="space-y-3 border-t border-zinc-100 dark:border-zinc-800 pt-4">
              <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest block">Live Caret preview</label>
              <div className="bg-zinc-50 dark:bg-zinc-950 rounded-xl p-4 border border-zinc-200/50 dark:border-zinc-800/80 flex items-center gap-3 select-none">
                {/* Simulated Gutter line */}
                <div className="font-mono text-[9px] text-zinc-400 w-4 border-r border-zinc-200 dark:border-zinc-800 pr-1.5 text-right">12</div>
                
                {/* Caret tag */}
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold text-zinc-800 dark:text-zinc-200 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-850 shadow-sm">
                  <div 
                    className="w-3.5 h-3.5 rounded-full flex items-center justify-center text-[7px] font-bold text-zinc-950 shrink-0"
                    style={{ backgroundColor: myProfile.color }}
                  >
                    {(myProfile.name || 'Writer').substring(0, 1).toUpperCase()}
                  </div>
                  <span>{myProfile.name || 'Writer'}</span>
                  <span className="w-1 h-3 bg-blue-500 animate-pulse"></span>
                </div>
                <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono italic">typing edits...</span>
              </div>
            </div>

            {/* Save Action */}
            <button
              onClick={() => setProfileModalOpen(false)}
              className="w-full py-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-xs font-bold text-white dark:text-zinc-950 transition-all duration-200 cursor-pointer text-center block shadow-sm"
            >
              Apply Settings
            </button>

          </div>
        </div>
      )}

    </div>
  );
};

export default DocumentAssistantPage;
