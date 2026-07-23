import React, { useState } from 'react';
import { UploadCloud, Loader, AlertCircle } from 'lucide-react';
import { api } from '../services/api';

interface FileUploaderProps {
  onUploadSuccess: (fileName: string) => void;
}

export const FileUploader: React.FC<FileUploaderProps> = ({ onUploadSuccess }) => {
  const [isDragActive, setIsDragActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    const allowedExtensions = ['.pdf', '.docx', '.txt', '.png', '.jpg', '.jpeg'];
    const fileExt = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

    if (!allowedExtensions.includes(fileExt)) {
      setError('Unsupported file type. Please upload PDF, DOCX, TXT, PNG, JPG, or JPEG.');
      return;
    }

    if (file.size > 100 * 1024 * 1024) {
      setError('File size exceeds the 100MB limit.');
      return;
    }

    setError(null);
    setIsUploading(true);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await api.post('/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (res.data.success) {
        onUploadSuccess(res.data.fileName);
      } else {
        setError(res.data.message || 'Upload failed.');
      }
    } catch (err: any) {
      console.error('Upload error:', err);
      setError(err.response?.data?.message || 'Failed to upload and parse file.');
    } finally {
      setIsUploading(false);
    }
  };

  const onDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragActive(true);
    } else if (e.type === 'dragleave') {
      setIsDragActive(false);
    }
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  return (
    <div className="w-full max-w-lg mx-auto space-y-4 text-left">
      <div 
        onDragEnter={onDrag}
        onDragOver={onDrag}
        onDragLeave={onDrag}
        onDrop={onDrop}
        className={`w-full min-h-[220px] rounded-2xl border border-dashed flex flex-col items-center justify-center p-6 text-center cursor-pointer transition-all backdrop-blur-xl border-glow-hover ${
          isDragActive 
            ? 'border-purple-500 bg-purple-500/10' 
            : 'border-zinc-200/50 dark:border-white/5 bg-white/60 dark:bg-zinc-950/35 hover:bg-zinc-50/50 dark:hover:bg-zinc-900/20 shadow-lg'
        }`}
      >
        <input 
          type="file" 
          id="file-upload-input"
          className="hidden" 
          accept=".pdf,.docx,.txt,.png,.jpg,.jpeg"
          onChange={onFileChange}
          disabled={isUploading}
        />
        
        <label htmlFor="file-upload-input" className="cursor-pointer flex flex-col items-center justify-center w-full h-full">
          {isUploading ? (
            <div className="flex flex-col items-center gap-3">
              <Loader className="h-10 w-10 text-purple-500 dark:text-purple-400 animate-spin" />
              <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">Parsing document details...</span>
              <span className="text-xs text-zinc-400 dark:text-zinc-500">Extracting raw text segments</span>
            </div>
          ) : (
            <>
              <div className="p-3.5 bg-purple-500/10 dark:bg-purple-950/20 rounded-2xl border border-purple-500/20 dark:border-purple-900/30 text-purple-600 dark:text-purple-400 mb-4 glow-primary">
                <UploadCloud className="h-8 w-8" />
              </div>
              <span className="text-base font-bold text-zinc-900 dark:text-white mb-1">Upload study document</span>
              <span className="text-sm text-zinc-500 dark:text-zinc-400">Drag & drop your file here, or click to browse</span>
              <span className="text-xs text-zinc-450 dark:text-zinc-600 mt-2">Supports PDF, DOCX, TXT, PNG, JPG, JPEG (Max 100MB)</span>
            </>
          )}
        </label>
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-2 text-xs text-red-400">
          <AlertCircle className="h-4.5 w-4.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
};
export default FileUploader;
