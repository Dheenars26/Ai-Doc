import React, { useState, useEffect, useRef } from 'react';
import { api } from '../services/api';
import { Navbar } from '../components/Navbar';
import { Hero } from '../components/Hero';
import { UploadCard } from '../components/UploadCard';
import { QuestionBox } from '../components/QuestionBox';
import { AnswerCard } from '../components/AnswerCard';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { Footer } from '../components/Footer';
import { Message, Collaborator } from '../types/types';
import { io } from 'socket.io-client';
import { 
  Sparkles, Trash2, FileCode, Users, Settings, Check, 
  ChevronDown, FileText, List, AlertCircle, Plus, Bold, 
  Italic, Code, Heading1, FileSignature
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

interface DocFile {
  name: string;
  content: string;
}

export const DocumentAssistantPage: React.FC = () => {
  // --- Active Document State ---
  const [fileName, setFileName] = useState<string | null>(null); // Name of the active file in the workspace
  const [editorContent, setEditorContent] = useState<string>(''); // Live editor content
  
  // --- AI Chat Assistant State ---
  const [messages, setMessages] = useState<Message[]>([]); // Conversation history thread
  const [isGenerating, setIsGenerating] = useState<boolean>(false); // True while AI is formulating response stream
  const [isCheckingStore, setIsCheckingStore] = useState<boolean>(true); // Initial state checking REST backend store
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]); // Dynamic suggested questions array

  // --- API Configuration Status ---
  const [hasApiKey, setHasApiKey] = useState<boolean>(false); // Checks if provider API key is loaded on server
  const [apiProvider, setApiProvider] = useState<string>('gemini'); // API provider backend name (e.g. gemini/openai)

  // --- Multi-document Sidebar State ---
  const [files, setFiles] = useState<DocFile[]>([]); // Array of all documents in sandbox list
  const [activeFileIdx, setActiveFileIdx] = useState<number>(0); // Current active document index

  // --- UI Layout Toggles ---
  const [activeLine, setActiveLine] = useState<number | null>(null); // Line where current user cursor resides
  const [profileModalOpen, setProfileModalOpen] = useState<boolean>(false); // Profile setting customization modal trigger

  // --- Dark Mode Theme State ---
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    return localStorage.getItem('theme') === 'dark' || 
      (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });

  // --- Socket.io Collaboration State ---
  const [socket, setSocket] = useState<any>(null); // Socket instance
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]); // List of all online collaborative editors
  const [collaboratorCursors, setCollaboratorCursors] = useState<Record<string, { name: string; color: string; line: number; ch: number }>>({}); // Live cursors map
  
  // --- User Profile State ---
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

  // --- AI Text Edit Menu State ---
  const [aiMenuOpen, setAiMenuOpen] = useState<boolean>(false); // Command popup visibility
  const [isEditingTextWithAi, setIsEditingTextWithAi] = useState<boolean>(false); // Inline AI rewrite progress state
  const [aiEditError, setAiEditError] = useState<string | null>(null); // Inline edit action error message
  const [selectedRange, setSelectedRange] = useState<{ start: number; end: number } | null>(null); // Editor selection index range

  // --- DOM Elements References ---
  const textareaRef = useRef<HTMLTextAreaElement>(null); // Gutter alignment ref
  const gutterRef = useRef<HTMLDivElement>(null); // Scroll sync ref
  const isExternalUpdate = useRef<boolean>(false); // Avoid recursive feedback loop on live sync cursor update
  const savedSelection = useRef<{ start: number; end: number } | null>(null); // Restores selection range after render

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

  const fetchSuggestedQuestions = async () => {
    try {
      const res = await api.get('/suggested-questions');
      if (res.data.success) {
        setSuggestedQuestions(res.data.questions || []);
      }
    } catch (err) {
      console.error('Failed to fetch suggested questions:', err);
    }
  };

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

          // Fetch suggestions for the active document
          fetchSuggestedQuestions();
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
    setTimeout(fetchSuggestedQuestions, 100);
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
    setTimeout(fetchSuggestedQuestions, 100);
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
    setTimeout(fetchSuggestedQuestions, 100);
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
          fetchSuggestedQuestions();
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
      setSuggestedQuestions([]);
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
      setSuggestedQuestions([]);
    }
  };

  const lineCount = editorContent.split('\n').length || 1;
  const avatarColors = [
    '#f87171', '#fb923c', '#fbbf24', '#34d399', '#2dd4bf',
    '#38bdf8', '#60a5fa', '#818cf8', '#a78bfa', '#c084fc', '#f472b6'
  ];  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col relative text-left font-sans transition-colors duration-200 overflow-hidden bg-grid-subtle">
      
      {/* Decorative Background Glow Blobs */}
      <div className="absolute top-0 left-0 right-0 h-[600px] overflow-hidden pointer-events-none z-0 select-none">
        <div className="absolute -top-[10%] left-[5%] w-[45vw] h-[45vw] rounded-full bg-blue-500/8 dark:bg-blue-600/4 blur-[120px] animate-pulse-glow"></div>
        <div className="absolute -top-[5%] right-[5%] w-[40vw] h-[40vw] rounded-full bg-indigo-500/8 dark:bg-indigo-600/4 blur-[150px] animate-pulse-glow-reverse"></div>
        <div className="absolute top-[35%] left-[20%] w-[30vw] h-[30vw] rounded-full bg-cyan-500/8 dark:bg-cyan-600/4 blur-[100px] animate-pulse-glow"></div>
      </div>

      {/* Top Navbar */}
      <Navbar 
        darkMode={darkMode} 
        onToggleDarkMode={() => setDarkMode(!darkMode)} 
        onOpenProfile={() => setProfileModalOpen(true)}
        myProfile={myProfile}
        collaborators={collaborators}
      />

      <div className="relative z-10 flex-grow flex flex-col w-full">
        {isCheckingStore ? (
          <div className="flex-1 flex items-center justify-center">
            <LoadingSpinner message="Reading workspace document store..." />
          </div>
        ) : !fileName ? (
          /* Lobby State (No Active Document) */
          <div className="flex-grow flex flex-col justify-center max-w-4xl mx-auto px-6 w-full space-y-12 py-12">
            <Hero />
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full">
              {/* Option 1: File Uploader */}
              <div className="flex flex-col space-y-4">
                <div className="text-left">
                  <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest block mb-1">Option 1</span>
                  <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-50">Upload an Existing File</h3>
                </div>
                <UploadCard 
                  fileName={fileName} 
                  editorContent={editorContent}
                  onUploadSuccess={handleUploadSuccess}
                  onReplace={handleClearDoc}
                  isCheckingStore={isCheckingStore}
                />
              </div>

              {/* Option 2: Blank Sandbox Workspace */}
              <div className="bg-white/60 dark:bg-zinc-900/60 backdrop-blur-xl border border-zinc-200/50 dark:border-zinc-800/40 rounded-2xl p-6 shadow-lg flex flex-col justify-between items-start text-left border-glow-hover transition-all duration-300">
                <div className="space-y-4">
                  <div>
                    <span className="text-[10px] font-bold text-purple-650 dark:text-purple-400 uppercase tracking-widest block mb-1">Option 2</span>
                    <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-50">Collaborative Sandbox</h3>
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed font-medium">
                    Start instantly in a collaborative writing studio. We will set up a blank document, a shared scratchpad, and a markdown template for you.
                  </p>
                </div>
                <button
                  onClick={handleStartWithBlank}
                  className="mt-6 w-full flex items-center justify-center gap-2 px-5 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-650 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold transition-all duration-300 cursor-pointer shadow-md hover:shadow-blue-500/25"
                >
                  <Plus className="h-4 w-4" />
                  <span>Start with Blank Document</span>
                </button>
              </div>
            </div>

            <Footer />
          </div>
        ) : (
          /* Workspace State (Rich 3-Panel Split Layout) */
          <div className="w-full max-w-[1600px] mx-auto px-6 py-8 flex-grow flex flex-col">
            
            {/* Action Bar for File Name and Replacement */}
            <div className="w-full mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white/40 dark:bg-zinc-900/30 backdrop-blur-md border border-zinc-200/50 dark:border-zinc-800/30 rounded-2xl p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/10 rounded-xl text-blue-600 dark:text-blue-400 shrink-0">
                  <FileText className="h-5 w-5" />
                </div>
                <div className="text-left">
                  <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-55">{fileName}</h2>
                  <p className="text-[10px] text-zinc-405 dark:text-zinc-550 font-bold uppercase tracking-wider mt-0.5">Active Workspace Document</p>
                </div>
              </div>
              <button
                onClick={handleClearDoc}
                className="flex items-center gap-1.5 px-3 py-2 border border-red-205 hover:border-red-300 dark:border-red-900/20 hover:bg-red-500/5 text-red-500 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer shadow-3xs"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Close Workspace</span>
              </button>
            </div>

            {/* 3-Panel Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch flex-grow">
              
              {/* PANEL 1: Left Sidebar (Multi-document Manager) */}
              <div className="col-span-12 lg:col-span-3 flex flex-col space-y-6">
                
                {/* Documents List Card */}
                <div className="bg-white/60 dark:bg-zinc-900/60 backdrop-blur-xl border border-zinc-200/50 dark:border-zinc-800/40 rounded-2xl p-5 shadow-md flex flex-col space-y-4 flex-grow">
                  <div className="flex items-center justify-between select-none">
                    <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">Documents List</span>
                    <button 
                      onClick={handleCreateNewFile}
                      className="p-1 hover:bg-zinc-100 dark:hover:bg-zinc-850 rounded-lg text-zinc-650 dark:text-zinc-400 hover:text-blue-500 transition-all cursor-pointer"
                      title="New Blank File"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="space-y-1.5 overflow-y-auto max-h-[220px] custom-scrollbar pr-1">
                    {files.map((file, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSelectFile(idx)}
                        className={`w-full flex items-center justify-between p-3 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer text-left ${
                          idx === activeFileIdx
                            ? 'bg-blue-500/10 text-blue-600 dark:text-blue-450 border border-blue-500/25'
                            : 'bg-transparent text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white border border-transparent hover:bg-zinc-100/50 dark:hover:bg-zinc-855/40'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <FileCode className="h-4 w-4 shrink-0 text-zinc-400" />
                          <span className="truncate">{file.name}</span>
                        </div>
                        {idx === activeFileIdx && (
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                        )}
                      </button>
                    ))}
                    {files.length === 0 && (
                      <div className="text-center py-6 text-xs text-zinc-450 dark:text-zinc-500 font-medium">
                        No additional documents
                      </div>
                    )}
                  </div>
                </div>

                {/* Collaboration & Live Users list */}
                <div className="bg-white/60 dark:bg-zinc-900/60 backdrop-blur-xl border border-zinc-200/50 dark:border-zinc-800/40 rounded-2xl p-5 shadow-md flex flex-col space-y-4">
                  <div className="flex items-center gap-1.5 select-none">
                    <Users className="h-4 w-4 text-blue-500" />
                    <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest">Connected Editors</span>
                  </div>

                  <div className="space-y-3 max-h-[180px] overflow-y-auto custom-scrollbar pr-1 text-left">
                    {/* Me User */}
                    <div className="flex items-center justify-between p-1.5 rounded-xl">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div 
                          className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-zinc-950 shrink-0 shadow-sm"
                          style={{ backgroundColor: myProfile.color }}
                        >
                          {(myProfile.name || 'W').substring(0, 1).toUpperCase()}
                        </div>
                        <span className="text-xs font-bold text-zinc-800 dark:text-zinc-100 truncate">{myProfile.name}</span>
                      </div>
                      <span className="text-[9px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full border border-blue-500/25">YOU</span>
                    </div>

                    {/* Other connected users */}
                    {collaborators.filter(c => !c.isMe).map((c) => (
                      <div key={c.id} className="flex items-center justify-between p-1.5 rounded-xl">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div 
                            className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-zinc-955 shrink-0 shadow-sm animate-pulse"
                            style={{ backgroundColor: c.color }}
                          >
                            {(c.name || 'C').substring(0, 1).toUpperCase()}
                          </div>
                          <span className="text-xs font-bold text-zinc-650 dark:text-zinc-300 truncate">{c.name}</span>
                        </div>
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                      </div>
                    ))}
                    {collaborators.length === 1 && (
                      <div className="text-center py-2 text-[10px] text-zinc-400 dark:text-zinc-500 font-semibold italic select-none">
                        Waiting for collaborators...
                      </div>
                    )}
                  </div>
                </div>

              </div>

              {/* PANEL 2: Collaborative Text Editor (Center Panel) */}
              <div className="col-span-12 lg:col-span-5 flex flex-col space-y-4">
                <div className="bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl border border-zinc-200/50 dark:border-zinc-800/40 rounded-2xl shadow-lg flex flex-col flex-grow relative overflow-hidden transition-all duration-300 border-glow-hover">
                  
                  {/* Editor Toolbars */}
                  <div className="border-b border-zinc-200/50 dark:border-zinc-800/40 bg-zinc-50/50 dark:bg-zinc-950/20 px-4 py-3 select-none space-y-2.5">
                    
                    {/* Basic Formatting Toolbar */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleFormatText('**', '**')}
                          className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-800/60 text-zinc-655 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white rounded-lg transition-all cursor-pointer"
                          title="Bold Text"
                        >
                          <Bold className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleFormatText('*', '*')}
                          className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-800/60 text-zinc-655 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white rounded-lg transition-all cursor-pointer"
                          title="Italic Text"
                        >
                          <Italic className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleFormatText('`', '`')}
                          className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-800/60 text-zinc-655 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white rounded-lg transition-all cursor-pointer"
                          title="Code block inline"
                        >
                          <Code className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleFormatText('# ')}
                          className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-800/60 text-zinc-655 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white rounded-lg transition-all cursor-pointer"
                          title="Heading"
                        >
                          <Heading1 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleFormatText('- ')}
                          className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-800/60 text-zinc-655 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white rounded-lg transition-all cursor-pointer"
                          title="Bullet List"
                        >
                          <List className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      {/* AI Command Dropdown Button */}
                      <div className="relative">
                        <button
                          onClick={() => setAiMenuOpen(!aiMenuOpen)}
                          disabled={isEditingTextWithAi}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-650 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-[11px] font-bold transition-all duration-200 cursor-pointer disabled:opacity-50"
                        >
                          <Sparkles className="h-3 w-3 animate-pulse text-cyan-300" />
                          <span>Inline AI Rewrite</span>
                          <ChevronDown className="h-3 w-3" />
                        </button>

                        {aiMenuOpen && (
                          <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-805 rounded-xl shadow-xl p-1.5 z-30 select-none animate-scale-in text-left">
                            <button
                              onClick={() => handleAiEdit('improve')}
                              className="w-full text-left px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-bold text-zinc-700 dark:text-zinc-350 rounded-lg cursor-pointer transition-colors"
                            >
                              ✨ Improve Style
                            </button>
                            <button
                              onClick={() => handleAiEdit('grammar')}
                              className="w-full text-left px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-bold text-zinc-700 dark:text-zinc-350 rounded-lg cursor-pointer transition-colors"
                            >
                              🔍 Fix Grammar
                            </button>
                            <button
                              onClick={() => handleAiEdit('summarize')}
                              className="w-full text-left px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-bold text-zinc-700 dark:text-zinc-350 rounded-lg cursor-pointer transition-colors"
                            >
                              📝 Summarize Text
                            </button>
                            <button
                              onClick={() => handleAiEdit('longer')}
                              className="w-full text-left px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-bold text-zinc-700 dark:text-zinc-350 rounded-lg cursor-pointer transition-colors"
                            >
                              ➕ Make Longer
                            </button>
                            <button
                              onClick={() => handleAiEdit('shorter')}
                              className="w-full text-left px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-bold text-zinc-700 dark:text-zinc-350 rounded-lg cursor-pointer transition-colors"
                            >
                              ➖ Make Shorter
                            </button>
                            <button
                              onClick={() => handleAiEdit('outline')}
                              className="w-full text-left px-3 py-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-bold text-zinc-700 dark:text-zinc-350 rounded-lg cursor-pointer transition-colors"
                            >
                              📋 Create Outline
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Helper Selection Tip */}
                    <div className="flex items-center justify-between text-[10px] text-zinc-400 dark:text-zinc-550 font-bold select-none px-1">
                      <span>Highlight selection to apply AI edit action</span>
                      {selectedRange && selectedRange.start !== selectedRange.end && (
                        <span className="text-blue-500 font-extrabold animate-pulse">
                          Selection: {selectedRange.end - selectedRange.start} chars
                        </span>
                      )}
                    </div>
                  </div>

                  {/* AI Inline Editing Status / Errors */}
                  {isEditingTextWithAi && (
                    <div className="absolute inset-0 bg-black/10 dark:bg-black/30 backdrop-blur-xs flex items-center justify-center z-20 animate-fade-in">
                      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl px-5 py-4 shadow-xl flex items-center gap-3 text-xs font-bold select-none">
                        <Sparkles className="h-4 w-4 text-blue-500 animate-spin" />
                        <span className="text-zinc-800 dark:text-zinc-200">AI is rewriting selection...</span>
                      </div>
                    </div>
                  )}

                  {aiEditError && (
                    <div className="px-4 py-2 bg-red-500/10 border-b border-red-500/20 text-[11px] font-bold text-red-400 flex items-center gap-2 select-none">
                      <AlertCircle className="h-4.5 w-4.5 shrink-0" />
                      <span>{aiEditError}</span>
                    </div>
                  )}

                  {/* Collaborative Editor Panel Textarea & Gutter */}
                  <div className="flex-grow flex items-stretch min-h-[460px] relative overflow-hidden bg-zinc-50/20 dark:bg-zinc-950/15">
                    
                    {/* Line numbers sync gutter */}
                    <div 
                      ref={gutterRef}
                      className="font-mono text-[10px] text-zinc-400 dark:text-zinc-650 w-9 select-none text-right pr-2.5 py-3 border-r border-zinc-200/50 dark:border-zinc-800/40 overflow-hidden leading-6 bg-zinc-50/50 dark:bg-zinc-950/25 shrink-0"
                    >
                      {Array.from({ length: lineCount }).map((_, i) => {
                        const collabOnLine = Object.values(collaboratorCursors).filter(c => c.line === i);
                        return (
                          <div key={i} className="relative h-6 flex items-center justify-end pr-0.5">
                            {collabOnLine.length > 0 && (
                              <span 
                                className="absolute left-1 w-2 h-2 rounded-full ring-2 ring-white dark:ring-zinc-900 shadow-sm animate-ping" 
                                style={{ backgroundColor: collabOnLine[0].color }} 
                                title={`Collaborator ${collabOnLine[0].name} active on line ${i+1}`}
                              />
                            )}
                            {i + 1}
                          </div>
                        );
                      })}
                    </div>

                    {/* Main Collaborative Textarea */}
                    <textarea
                      ref={textareaRef}
                      value={editorContent}
                      onChange={(e) => handleEditorChange(e.target.value)}
                      onScroll={handleScroll}
                      onKeyUp={handleCursorMove}
                      onMouseUp={handleCursorMove}
                      onSelect={handleTextareaSelect}
                      placeholder="Start collaborative pair writing, notes, documentation, or code analysis. Highlight text to trigger inline AI corrections!"
                      className="flex-grow bg-transparent text-zinc-800 dark:text-zinc-100 p-3 outline-none resize-none font-mono text-xs leading-6 overflow-y-auto custom-scrollbar focus:ring-0 placeholder-zinc-400 dark:placeholder-zinc-650"
                    />

                    {/* Floating Caret Overlays for other users in bottom toolbar indicator */}
                    <div className="absolute bottom-2.5 left-3 select-none flex items-center gap-1.5 pointer-events-none">
                      {Object.values(collaboratorCursors).map((c, i) => (
                        <div 
                          key={i} 
                          className="flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-900/80 dark:bg-white/80 text-white dark:text-zinc-955 border border-white/10 dark:border-black/5 text-[9px] font-bold shadow-sm"
                        >
                          <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: c.color }} />
                          <span>{c.name} (Line {c.line + 1})</span>
                        </div>
                      ))}
                    </div>

                  </div>

                </div>
              </div>

              {/* PANEL 3: AI Document Grounding Assistant Chat (Right Panel) */}
              <div className="col-span-12 lg:col-span-4 flex flex-col space-y-4">
                
                {/* Grounding Assistant Chat panels */}
                <div className="flex-grow flex flex-col space-y-4 min-h-[500px]">
                  
                  {/* AI Chat Question Box */}
                  <QuestionBox 
                    onSend={handleSendMessage} 
                    isGenerating={isGenerating} 
                    disabled={isCheckingStore}
                    suggestedQuestions={suggestedQuestions}
                    onSelectQuestion={handleSendMessage}
                  />

                  {/* AI Chat Responses Feed */}
                  <AnswerCard 
                    messages={messages} 
                    onRegenerate={() => handleSendMessage(messages[messages.length - 2]?.content || '')} 
                    onClear={handleClearChat} 
                    isGenerating={isGenerating}
                    disabled={isCheckingStore}
                    onInsertAtCursor={handleInsertChatAnswer}
                  />
                  
                </div>

              </div>

            </div>

          </div>
        )}
      </div>

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
              <div className="bg-zinc-50 dark:bg-zinc-955 rounded-xl p-4 border border-zinc-200/50 dark:border-zinc-800/80 flex items-center gap-3 select-none">
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
