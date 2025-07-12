'use client';

import { useEffect, useState, useRef } from 'react';

interface DocumentViewerProps {
  file: File;
  highlightedField?: {
    label: string;
    value: string;
    highlightType?: 'label' | 'value' | 'both';
  } | null;
}

export default function DocumentViewer({ file, highlightedField }: DocumentViewerProps) {
  const [fileUrl, setFileUrl] = useState<string>('');
  const [scale, setScale] = useState<number>(1);
  const imageRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setFileUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    // Handle text highlighting for images
    if (file.type.startsWith('image/') && highlightedField && imageRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      const img = imageRef.current;

      if (ctx) {
        // Clear previous highlights
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // This is a placeholder for actual text detection
        // In a real implementation, you'd use OCR to find text positions
        // For now, we'll just show a visual indicator
        if (highlightedField.label) {
          ctx.fillStyle = 'rgba(59, 130, 246, 0.3)';
          ctx.strokeStyle = 'rgb(59, 130, 246)';
          ctx.lineWidth = 2;
          
          // Example highlight area (you'd calculate this based on OCR results)
          const x = 100;
          const y = 100;
          const width = 200;
          const height = 30;
          
          ctx.fillRect(x * scale, y * scale, width * scale, height * scale);
          ctx.strokeRect(x * scale, y * scale, width * scale, height * scale);
        }
      }
    }
  }, [highlightedField, scale, file.type]);

  // For images
  if (file.type.startsWith('image/')) {
    return (
      <div className="h-full flex flex-col bg-gray-50">
        <div className="flex-1 relative overflow-auto p-4">
          <div className="relative inline-block">
            <img 
              ref={imageRef}
              src={fileUrl} 
              alt={file.name}
              className="max-w-full h-auto shadow-lg"
              style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}
            />
            <canvas
              ref={canvasRef}
              className="absolute top-0 left-0 pointer-events-none"
              style={{ 
                transform: `scale(${scale})`, 
                transformOrigin: 'top left',
                width: '100%',
                height: '100%'
              }}
            />
          </div>
        </div>
        
        {/* Zoom controls */}
        <div className="border-t p-2 flex items-center justify-center gap-4 bg-white">
          <button
            onClick={() => setScale(Math.max(0.5, scale - 0.1))}
            className="px-3 py-1 text-sm border rounded hover:bg-gray-50"
          >
            -
          </button>
          <span className="text-sm font-medium">{Math.round(scale * 100)}%</span>
          <button
            onClick={() => setScale(Math.min(2, scale + 0.1))}
            className="px-3 py-1 text-sm border rounded hover:bg-gray-50"
          >
            +
          </button>
          <button
            onClick={() => setScale(1)}
            className="ml-4 px-3 py-1 text-sm border rounded hover:bg-gray-50"
          >
            Reset
          </button>
        </div>
      </div>
    );
  }

  // For PDFs - clean viewer without highlighting message
  return (
    <div className="h-full flex flex-col">
      <iframe
        src={`${fileUrl}#toolbar=1&navpanes=0`}
        className="flex-1 w-full border-0"
        title="PDF Viewer"
      />
    </div>
  );
}