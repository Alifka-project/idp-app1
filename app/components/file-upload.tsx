'use client';

import { useRef } from 'react';
import { Button } from './ui/button';
import { Upload } from 'lucide-react';

interface FileUploadProps {
  onFilesSelected: (files: File[]) => void;
}

export default function FileUpload({ onFilesSelected }: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles = files.filter(file => 
      file.type === 'application/pdf' || 
      file.type.startsWith('image/')
    );
    
    if (validFiles.length > 0) {
      onFilesSelected(validFiles);
    }
    
    // Reset input
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,image/*"
        multiple
        onChange={handleFileChange}
        className="hidden"
      />
      <Button
        variant="outline"
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="w-4 h-4 mr-2" />
        Upload
      </Button>
    </>
  );
}
