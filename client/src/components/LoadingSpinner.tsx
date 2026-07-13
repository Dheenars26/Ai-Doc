import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingSpinnerProps {
  message?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ message = 'Loading...' }) => {
  return (
    <div className="flex flex-col items-center justify-center p-8 space-y-4 select-none">
      
      {/* Animated Spinner Icon */}
      <div className="relative flex items-center justify-center">
        <div className="h-10 w-10 rounded-full border-4 border-zinc-100 dark:border-zinc-800"></div>
        <div className="absolute h-10 w-10 rounded-full border-4 border-t-blue-600 border-r-transparent border-b-transparent border-l-transparent animate-spin"></div>
      </div>

      {/* Loading message */}
      <div className="text-center space-y-1.5 animate-pulse">
        <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 block">
          {message}
        </span>
        <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-semibold block uppercase tracking-widest">
          Please wait a moment
        </span>
      </div>

      {/* Subtle Skeleton Loader lines */}
      <div className="w-full max-w-xs space-y-2.5 pt-4 opacity-40">
        <div className="h-3 bg-zinc-200 dark:bg-zinc-800 rounded-full w-3/4 mx-auto animate-pulse"></div>
        <div className="h-2.5 bg-zinc-150 dark:bg-zinc-800/80 rounded-full w-5/6 mx-auto animate-pulse"></div>
        <div className="h-2.5 bg-zinc-200 dark:bg-zinc-800 rounded-full w-2/3 mx-auto animate-pulse"></div>
      </div>

    </div>
  );
};

export default LoadingSpinner;
