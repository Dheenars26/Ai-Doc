import React from 'react';
import { FileText, CheckCircle, RefreshCw, Upload } from 'lucide-react';
import { FileUploader } from './FileUploader';

interface UploadCardProps {
  fileName: string | null;
  editorContent: string;
  onUploadSuccess: (name: string) => void;
  onReplace: () => void;
  isCheckingStore: boolean;
}

export const UploadCard: React.FC<UploadCardProps> = ({
  fileName,
  editorContent,
  onUploadSuccess,
  onReplace,
  isCheckingStore
}) => {
  // Estimate file size based on content character count
  const estimatedSize = editorContent 
    ? `${(editorContent.length / 1024).toFixed(1)} KB` 
    : '0 KB';

  if (!fileName) {
    return (
      <div className="w-full select-none animate-fade-in-up">
        <FileUploader onUploadSuccess={onUploadSuccess} />
      </div>
    );
  }

  return (
    <div className="w-full bg-white/70 dark:bg-zinc-900/60 backdrop-blur-xl border border-zinc-200/50 dark:border-zinc-800/40 rounded-2xl p-6 shadow-lg flex flex-col md:flex-row items-center justify-between gap-4 animate-scale-in transition-all duration-300 hover:shadow-xl hover:shadow-indigo-500/5 border-glow-hover">
      
      {/* File Details */}
      <div className="flex items-center gap-4 min-w-0 text-left w-full md:w-auto">
        <div className="p-3 bg-gradient-to-br from-blue-500/10 to-indigo-500/10 dark:from-blue-500/20 dark:to-indigo-500/20 rounded-xl text-blue-600 dark:text-blue-400 border border-blue-100/30 dark:border-blue-900/20 shrink-0">
          <FileText className="h-5 w-5 animate-pulse" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-zinc-900 dark:text-zinc-50 truncate" title={fileName}>
              {fileName}
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <CheckCircle className="h-2.5 w-2.5" />
              <span>Loaded</span>
            </span>
          </div>
          <p className="text-xs text-zinc-400 dark:text-zinc-550 font-medium mt-1">
            Size: {estimatedSize}
          </p>
        </div>
      </div>

      {/* Action Button */}
      <button
        onClick={onReplace}
        disabled={isCheckingStore}
        className="w-full md:w-auto flex items-center justify-center gap-1.5 px-4 py-2.5 border border-zinc-200/65 dark:border-zinc-800/65 hover:border-zinc-350 dark:hover:border-zinc-700 bg-white/50 dark:bg-zinc-900/40 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 rounded-xl text-xs font-bold text-zinc-700 dark:text-zinc-300 transition-all duration-200 cursor-pointer disabled:opacity-40 shrink-0 shadow-2xs hover:shadow-sm"
      >
        <RefreshCw className="h-3.5 w-3.5" />
        <span>Replace Document</span>
      </button>

    </div>
  );
};

export default UploadCard;
