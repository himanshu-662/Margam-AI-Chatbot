import React, { useRef } from 'react';
import { FileAttachment } from '../types';

interface FileUploaderProps {
  onFilesSelected: (files: FileAttachment[]) => void;
  isLoading: boolean;
}

export const FileUploader: React.FC<FileUploaderProps> = ({ onFilesSelected, isLoading }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []) as File[];
    const processedFiles: FileAttachment[] = [];

    for (const file of selectedFiles) {
      const base64 = await convertToBase64(file);
      processedFiles.push({
        name: file.name,
        type: file.type,
        data: base64,
        previewUrl: file.type.startsWith('image/') ? base64 : undefined
      });
    }

    onFilesSelected(processedFiles);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const convertToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  return (
    <div className="flex items-center">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
        multiple
        accept=".pdf,.doc,.docx,.ppt,.pptx,image/*"
      />
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={isLoading}
        className="p-2.5 rounded-full text-slate-300 hover:text-[#1A73E8] hover:bg-[#D2E3FC]/40 transition-all flex items-center justify-center group"
        title="Upload Context"
      >
        <svg className="w-5 h-5 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
        </svg>
      </button>
    </div>
  );
};