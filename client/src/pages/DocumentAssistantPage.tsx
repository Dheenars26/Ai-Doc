import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Navbar } from '../components/Navbar';
import { Hero } from '../components/Hero';
import { UploadCard } from '../components/UploadCard';
import { QuestionBox } from '../components/QuestionBox';
import { AnswerCard } from '../components/AnswerCard';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { Footer } from '../components/Footer';
import { Message } from '../types/types';
import { Sparkles } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

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

  // --- Dark Mode Theme State ---
  const [darkMode, setDarkMode] = useState<boolean>(() => {
    return localStorage.getItem('theme') === 'dark' || 
      (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });

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
          const loadedName = res.data.fileName || 'document.txt';
          const loadedContent = res.data.content || '';
          setFileName(loadedName);
          setEditorContent(loadedContent);
          fetchSuggestedQuestions();
        }
      }
    } catch (err) {
      console.error('Failed to sync active store REST:', err);
    } finally {
      setIsCheckingStore(false);
    }
  };

  useEffect(() => {
    syncStore();
  }, []);

  const handleUploadSuccess = (uploadedName: string) => {
    setMessages([]);
    setIsCheckingStore(true);
    setTimeout(async () => {
      try {
        const res = await api.get('/document');
        if (res.data.success) {
          const content = res.data.content || '';
          setFileName(uploadedName);
          setEditorContent(content);
          setHasApiKey(!!res.data.hasApiKey);
          setApiProvider(res.data.apiProvider || 'gemini');
          fetchSuggestedQuestions();
        }
      } catch (err) {
        console.error('Failed to reload document content:', err);
      } finally {
        setIsCheckingStore(false);
      }
    }, 500);
  };

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

  const handleClearChat = () => {
    setMessages([]);
  };

  const handleClearDoc = async () => {
    try {
      await api.delete('/document');
      setFileName(null);
      setEditorContent('');
      setMessages([]);
      setSuggestedQuestions([]);
    } catch (err) {
      console.error('Failed to clear active document:', err);
      setFileName(null);
      setEditorContent('');
      setMessages([]);
      setSuggestedQuestions([]);
    }
  };

  return (
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
            
            <div className="max-w-xl mx-auto w-full space-y-6">
              <UploadCard 
                fileName={fileName} 
                editorContent={editorContent}
                onUploadSuccess={handleUploadSuccess}
                onReplace={handleClearDoc}
                isCheckingStore={isCheckingStore}
              />
            </div>

            <Footer />
          </div>
        ) : (
          /* Workspace State (Clean Center-Aligned Layout) */
          <div className="flex-grow flex flex-col justify-center max-w-2xl mx-auto px-6 w-full space-y-6 py-12 z-10 animate-fade-in-up">
            
            {/* Header info */}
            <div className="text-center space-y-2 select-none mb-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                <Sparkles className="h-3.5 w-3.5 animate-pulse" />
                <span>Document Grounded Session</span>
              </span>
              <h2 className="text-xl font-extrabold text-zinc-900 dark:text-zinc-55 tracking-tight">
                Ask Questions & Extract Knowledge
              </h2>
              <p className="text-xs text-zinc-550 dark:text-zinc-450 max-w-md mx-auto leading-relaxed">
                The AI is fully grounded in the contents of your active document. Ask anything to summarize, outline, or extract key facts.
              </p>
            </div>

            {/* Document details card */}
            <UploadCard 
              fileName={fileName} 
              editorContent={editorContent}
              onUploadSuccess={handleUploadSuccess}
              onReplace={handleClearDoc}
              isCheckingStore={isCheckingStore}
            />

            {/* Question entry area */}
            <QuestionBox 
              onSend={handleSendMessage} 
              isGenerating={isGenerating} 
              disabled={isCheckingStore}
              suggestedQuestions={suggestedQuestions}
              onSelectQuestion={handleSendMessage}
            />

            {/* Q&A chat history card */}
            <AnswerCard 
              messages={messages} 
              onRegenerate={() => handleSendMessage(messages[messages.length - 2]?.content || '')} 
              onClear={handleClearChat} 
              isGenerating={isGenerating}
              disabled={isCheckingStore}
            />

            <Footer />
          </div>
        )}
      </div>

    </div>
  );
};

export default DocumentAssistantPage;
