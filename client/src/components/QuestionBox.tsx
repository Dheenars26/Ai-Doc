import React, { useState } from 'react';
import { Search, Loader2, Sparkles } from 'lucide-react';

interface QuestionBoxProps {
  onSend: (text: string) => void;
  isGenerating: boolean;
  disabled: boolean;
  suggestedQuestions?: string[];
  onSelectQuestion?: (question: string) => void;
}

export const QuestionBox: React.FC<QuestionBoxProps> = ({
  onSend,
  isGenerating,
  disabled,
  suggestedQuestions = [],
  onSelectQuestion
}) => {
  const [input, setInput] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isGenerating || disabled) return;
    onSend(input);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="w-full bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl border border-zinc-200/50 dark:border-zinc-800/40 rounded-2xl p-5 shadow-lg space-y-4 animate-scale-in transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/5 border-glow-hover">
      
      <div className="text-left select-none">
        <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest block mb-1">
          Query Document
        </label>
        <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">Ask a Question</h3>
      </div>

      {suggestedQuestions && suggestedQuestions.length > 0 && (
        <div className="space-y-2 select-none animate-fade-in text-left">
          <span className="text-[9px] font-bold text-zinc-400 dark:text-zinc-550 uppercase tracking-wider block">
            Suggested starter queries:
          </span>
          <div className="flex flex-wrap gap-2">
            {suggestedQuestions.map((q, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => onSelectQuestion?.(q)}
                disabled={isGenerating || disabled}
                className="text-left px-3 py-2 bg-white/40 dark:bg-zinc-950/45 hover:bg-blue-500/10 dark:hover:bg-blue-900/20 border border-zinc-200/50 dark:border-zinc-800/40 hover:border-blue-300 dark:hover:border-blue-900/50 rounded-xl text-[11px] font-semibold text-zinc-600 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 transition-all duration-300 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed hover:-translate-y-0.5 active:translate-y-0 shadow-2xs hover:shadow-xs flex items-center gap-1.5"
              >
                <Sparkles className="h-3 w-3 shrink-0 text-blue-500 animate-pulse" />
                <span>{q}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="relative flex flex-col gap-3">
        <textarea
          rows={3}
          placeholder="Ask anything about your uploaded document..."
          className="w-full bg-zinc-50/50 dark:bg-zinc-950/40 border border-zinc-200/60 dark:border-zinc-800/50 rounded-xl px-4 py-3 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-blue-500/40 focus:ring-1 focus:ring-blue-500/10 transition-all resize-none font-sans glass-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isGenerating || disabled}
        />
        
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-medium select-none">
            Press Shift+Enter for newline
          </span>
          <button
            type="submit"
            disabled={!input.trim() || isGenerating || disabled}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-650 hover:from-blue-700 hover:to-indigo-700 disabled:from-zinc-150 disabled:to-zinc-150 dark:disabled:from-zinc-800 dark:disabled:to-zinc-800 disabled:text-zinc-400 text-white rounded-xl text-xs font-bold transition-all duration-300 cursor-pointer disabled:pointer-events-none hover:shadow-lg hover:shadow-blue-500/25"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Thinking...</span>
              </>
            ) : (
              <>
                <Search className="h-3.5 w-3.5" />
                <span>Ask Question</span>
              </>
            )}
          </button>
        </div>
      </form>

    </div>
  );
};

export default QuestionBox;

