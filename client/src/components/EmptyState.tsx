import React from 'react';
import { UploadCloud } from 'lucide-react';

export const EmptyState: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center select-none space-y-4 max-w-sm mx-auto animate-fade-in-up">
      
      {/* SVG Illustration */}
      <div className="relative w-36 h-28 mx-auto flex items-center justify-center">
        {/* Floating document shapes */}
        <div className="absolute inset-0 flex items-center justify-center">
          <svg className="w-full h-full text-zinc-100 dark:text-zinc-800/40" viewBox="0 0 144 112" fill="currentColor">
            <rect x="16" y="24" width="72" height="64" rx="12" fill="currentColor" stroke="rgba(255,255,255,0.02)" />
            <rect x="56" y="12" width="72" height="64" rx="12" fill="currentColor" opacity="0.6" />
          </svg>
        </div>
        
        {/* Floating Icon */}
        <div className="absolute p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-md text-blue-600 dark:text-blue-400 animate-bounce">
          <UploadCloud className="h-6 w-6" />
        </div>
      </div>

      {/* Description */}
      <div className="space-y-1">
        <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-50">
          No document uploaded yet
        </h3>
        <p className="text-xs text-zinc-400 dark:text-zinc-500 font-medium leading-relaxed">
          Get started by dragging and dropping a document or code file in the upload zone above.
        </p>
      </div>

    </div>
  );
};

export default EmptyState;
