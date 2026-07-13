import React, { useState } from 'react';
import { Search, Loader2 } from 'lucide-react';

interface QuestionBoxProps {
  onSend: (text: string) => void;
  isGenerating: boolean;
  disabled: boolean;
}

export const QuestionBox: React.FC<QuestionBoxProps> = ({ onSend, isGenerating, disabled }) => {
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
    <div className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm space-y-4 animate-scale-in transition-colors duration-200">
      
      <div className="text-left select-none">
        <label className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest block mb-1">
          Query Document
        </label>
        <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">Ask a Question</h3>
      </div>

      <form onSubmit={handleSubmit} className="relative flex flex-col gap-3">
        <textarea
          rows={3}
          placeholder="Ask anything about your uploaded document..."
          className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-blue-500/40 focus:ring-1 focus:ring-blue-500/10 transition-all resize-none font-sans glass-input"
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
            className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-100 dark:disabled:bg-zinc-800 disabled:text-zinc-400 text-white rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer disabled:pointer-events-none hover:shadow-lg hover:shadow-blue-500/15"
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
