import React from 'react';

export const Hero: React.FC = () => {
  return (
    <div className="text-center py-6 select-none max-w-xl mx-auto space-y-3 animate-fade-in-up">
      <h1 className="text-4xl font-extrabold text-zinc-900 dark:text-zinc-50 tracking-tight font-heading leading-tight">
        AI Document Assistant
      </h1>
      <p className="text-sm text-zinc-500 dark:text-zinc-400 font-normal leading-relaxed">
        Upload your study notes, code briefs, or PDFs and ask the context-grounded AI assistant questions to get instant, verified answers.
      </p>
    </div>
  );
};

export default Hero;
