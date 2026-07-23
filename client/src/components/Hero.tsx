import React from 'react';
import { Sparkles } from 'lucide-react';

export const Hero: React.FC = () => {
  return (
    <div className="text-center py-8 select-none max-w-xl mx-auto space-y-4 animate-fade-in-up relative">
      
      {/* Decorative badge */}
      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold bg-blue-50/80 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 border border-blue-100/50 dark:border-blue-900/30 shadow-2xs mb-2">
        <Sparkles className="h-3 w-3 animate-pulse text-blue-500" />
        <span>POWERED BY ADVANCED RAG</span>
      </div>

      <h1 className="text-4xl md:text-5xl font-black tracking-tight font-heading leading-tight bg-gradient-to-r from-zinc-900 via-blue-600 to-indigo-600 dark:from-zinc-50 dark:via-blue-400 dark:to-indigo-400 bg-clip-text text-transparent">
        AI Document Assistant
      </h1>
      
      <p className="text-xs md:text-sm text-zinc-500 dark:text-zinc-400 font-medium leading-relaxed max-w-md mx-auto">
        Upload your study notes, code briefs, or PDFs and ask the context-grounded AI assistant questions to get instant, verified answers.
      </p>
    </div>
  );
};

export default Hero;
