import React, { useState, useEffect, useRef } from 'react';
import { Bot, Copy, Check, Trash2, RotateCw, User } from 'lucide-react';
import { Message } from '../types/types';

interface AnswerCardProps {
  messages: Message[];
  onRegenerate: () => void;
  onClear: () => void;
  isGenerating: boolean;
  disabled: boolean;
}

export const AnswerCard: React.FC<AnswerCardProps> = ({
  messages,
  onRegenerate,
  onClear,
  isGenerating,
  disabled
}) => {
  const [copied, setCopied] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Extract the last AI response for the copy action
  const aiMessages = messages.filter(m => m.role === 'assistant' || (m.role as string) === 'model');
  const lastAiMessage = aiMessages[aiMessages.length - 1];

  // Auto-scroll to bottom of conversation
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isGenerating]);

  const handleCopy = () => {
    if (!lastAiMessage) return;
    navigator.clipboard.writeText(lastAiMessage.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const parseSimpleMarkdown = (text: string) => {
    if (!text) return null;
    
    // Split text by code blocks
    const parts = text.split(/(```[\s\S]*?```)/g);
    
    return parts.map((part, index) => {
      if (part.startsWith('```') && part.endsWith('```')) {
        const code = part.slice(3, -3).trim();
        return (
          <pre key={index} className="my-3.5 p-3.5 bg-zinc-950 text-zinc-200 rounded-xl overflow-x-auto text-[11px] font-mono border border-white/5 select-text leading-5">
            <code>{code}</code>
          </pre>
        );
      }
      
      const lines = part.split('\n');
      const formattedLines = lines.map((line, lIdx) => {
        let content = line;
        
        const isBullet = content.trim().startsWith('- ') || content.trim().startsWith('* ');
        if (isBullet) {
          content = content.replace(/^[\s]*[-*]\s+/, '');
        }
        
        const boldRegex = /\*\*(.*?)\*\*/g;
        const codeRegex = /`(.*?)`/g;
        
        const html = content
          .replace(boldRegex, '<strong class="font-bold text-zinc-900 dark:text-zinc-100">$1</strong>')
          .replace(codeRegex, '<code class="px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-850 text-[10px] font-mono rounded text-blue-600 dark:text-blue-400 border border-zinc-200/50 dark:border-zinc-700/50 font-semibold">$1</code>');
        
        if (isBullet) {
          return (
            <li key={lIdx} className="ml-5 list-disc pl-1 text-zinc-755 dark:text-zinc-355 leading-relaxed text-xs my-1" dangerouslySetInnerHTML={{ __html: html }} />
          );
        }
        
        if (!content.trim()) {
          return <div key={lIdx} className="h-2" />;
        }
        
        return (
          <p key={lIdx} className="text-zinc-750 dark:text-zinc-350 leading-relaxed text-xs my-2 select-text" dangerouslySetInnerHTML={{ __html: html }} />
        );
      });
      
      return <div key={index}>{formattedLines}</div>;
    });
  };

  if (messages.length === 0) return null;

  return (
    <div className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm space-y-4 animate-scale-in transition-colors duration-200 flex flex-col max-h-[500px]">
      
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-150 dark:border-zinc-800/80 pb-3 select-none shrink-0">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-blue-50 dark:bg-blue-950/40 rounded-lg text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/30">
            <Bot className="h-4 w-4" />
          </div>
          <span className="text-xs font-bold text-zinc-900 dark:text-zinc-50">
            Conversation Chat History
          </span>
        </div>
        
        {onClear && (
          <button
            onClick={onClear}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-all duration-200 cursor-pointer"
            title="Clear Chat History"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Chat Messages Log Viewport */}
      <div 
        ref={scrollContainerRef}
        className="flex-grow overflow-y-auto pr-1 space-y-4 custom-scrollbar min-h-[120px]"
      >
        {messages.map((m) => {
          const isUser = m.role === 'user';
          
          if (isUser) {
            return (
              <div key={m.id} className="flex flex-col items-end space-y-1 animate-scale-in">
                <span className="text-[9px] font-bold text-zinc-400 dark:text-zinc-550 uppercase select-none mr-2">You</span>
                <div className="bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 px-3.5 py-2.5 rounded-2xl rounded-tr-none text-xs max-w-[85%] select-text border border-zinc-200/30 dark:border-zinc-700/30 shadow-2xs font-sans">
                  {m.content}
                </div>
              </div>
            );
          }

          const isPlaceholder = m.content === '░';

          return (
            <div key={m.id} className="flex flex-col items-start space-y-1 animate-scale-in">
              <div className="flex items-center gap-1 ml-2">
                <span className="text-[9px] font-bold text-blue-600 dark:text-blue-400 uppercase select-none">AI Assistant</span>
              </div>
              <div className="bg-blue-50/40 dark:bg-blue-950/15 text-zinc-800 dark:text-zinc-200 px-3.5 py-2.5 rounded-2xl rounded-tl-none text-xs max-w-[85%] select-text border border-blue-100/30 dark:border-blue-900/10 shadow-2xs w-full text-left">
                {isPlaceholder ? (
                  <div className="flex items-center gap-2 text-zinc-400 dark:text-zinc-500 text-[11px] font-medium py-1 select-none animate-pulse">
                    <Bot className="h-3.5 w-3.5 animate-spin text-blue-500" />
                    <span>AI is formulating answer...</span>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {parseSimpleMarkdown(m.content)}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Footer controls */}
      {lastAiMessage && lastAiMessage.content !== '░' && (
        <div className="flex items-center justify-between border-t border-zinc-150 dark:border-zinc-800/80 pt-3.5 select-none shrink-0">
          <button
            onClick={onRegenerate}
            disabled={isGenerating || disabled}
            className="flex items-center gap-1.5 px-3 py-2 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 rounded-xl text-xs font-bold text-zinc-700 dark:text-zinc-300 transition-all duration-200 cursor-pointer disabled:opacity-40"
          >
            <RotateCw className={`h-3.5 w-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
            <span>Regenerate</span>
          </button>
          
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer hover:shadow-lg hover:shadow-blue-500/10"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-white" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                <span>Copy Last</span>
              </>
            )}
          </button>
        </div>
      )}

    </div>
  );
};

export default AnswerCard;
