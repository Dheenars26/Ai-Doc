import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface ErrorAlertProps {
  message: string;
  onRetry?: () => void;
}

export const ErrorAlert: React.FC<ErrorAlertProps> = ({ message, onRetry }) => {
  return (
    <div className="w-full bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 animate-scale-in text-left transition-colors duration-200">
      
      {/* Alert Body */}
      <div className="flex items-center gap-3 w-full sm:w-auto">
        <div className="p-2 bg-rose-100 dark:bg-rose-900/40 rounded-xl text-rose-600 dark:text-rose-400 shrink-0">
          <AlertCircle className="h-4.5 w-4.5" />
        </div>
        <div className="min-w-0">
          <span className="text-xs font-bold text-rose-800 dark:text-rose-400 block leading-tight">
            Processing Error
          </span>
          <span className="text-[11px] text-rose-600 dark:text-rose-500 font-medium block mt-1 leading-snug">
            {message}
          </span>
        </div>
      </div>

      {/* Retry Action */}
      {onRetry && (
        <button
          onClick={onRetry}
          className="w-full sm:w-auto flex items-center justify-center gap-1 px-3.5 py-2 border border-rose-200 dark:border-rose-900/40 bg-white dark:bg-zinc-900 hover:bg-rose-100/30 dark:hover:bg-rose-950/40 rounded-xl text-xs font-bold text-rose-700 dark:text-rose-400 transition-all duration-200 cursor-pointer shrink-0"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span>Retry Upload</span>
        </button>
      )}

    </div>
  );
};

export default ErrorAlert;
