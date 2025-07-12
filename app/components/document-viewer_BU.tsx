'use client';

import { useEffect, useState } from 'react';

interface DocumentViewerProps {
  file: File;
  highlightedField?: {
    label: string;
    value: string;
    highlightType?: 'label' | 'value' | 'both';
    labelBoundingBox?: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
    valueBoundingBox?: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
  } | null;
}

export default function DocumentViewer({ file, highlightedField }: DocumentViewerProps) {
  const [fileUrl, setFileUrl] = useState<string>('');
  const [scale, setScale] = useState<number>(1);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setFileUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // For images
  if (file.type.startsWith('image/')) {
    return (
      <div className="h-full flex flex-col bg-gray-50">
        <div className="flex-1 relative overflow-auto p-4">
          <div className="relative inline-block">
            <img 
              src={fileUrl} 
              alt={file.name}
              className="max-w-full h-auto shadow-lg"
              style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}
            />
            
            {/* Highlight overlays */}
            {highlightedField && (
              <>
                {/* Label highlight */}
                {(highlightedField.highlightType === 'label' || highlightedField.highlightType === 'both') && 
                 highlightedField.labelBoundingBox && (
                  <div
                    className="absolute border-2 border-blue-500 bg-blue-500 bg-opacity-20 pointer-events-none"
                    style={{
                      left: `${highlightedField.labelBoundingBox.x * 100}%`,
                      top: `${highlightedField.labelBoundingBox.y * 100}%`,
                      width: `${highlightedField.labelBoundingBox.width * 100}%`,
                      height: `${highlightedField.labelBoundingBox.height * 100}%`,
                      transform: `scale(${scale})`,
                      transformOrigin: 'top left'
                    }}
                  >
                    <div className="absolute -top-6 left-0 bg-blue-500 text-white text-xs px-2 py-1 rounded">
                      Label: {highlightedField.label}
                    </div>
                  </div>
                )}
                
                {/* Value highlight */}
                {(highlightedField.highlightType === 'value' || highlightedField.highlightType === 'both') && 
                 highlightedField.valueBoundingBox && (
                  <div
                    className="absolute border-2 border-green-500 bg-green-500 bg-opacity-20 pointer-events-none"
                    style={{
                      left: `${highlightedField.valueBoundingBox.x * 100}%`,
                      top: `${highlightedField.valueBoundingBox.y * 100}%`,
                      width: `${highlightedField.valueBoundingBox.width * 100}%`,
                      height: `${highlightedField.valueBoundingBox.height * 100}%`,
                      transform: `scale(${scale})`,
                      transformOrigin: 'top left'
                    }}
                  >
                    <div className="absolute -bottom-6 left-0 bg-green-500 text-white text-xs px-2 py-1 rounded">
                      Value
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
        
        {/* Zoom controls */}
        <div className="border-t p-2 flex items-center justify-center gap-4 bg-white">
          <button
            onClick={() => setScale(Math.max(0.5, scale - 0.1))}
            className="px-3 py-1 text-sm border rounded hover:bg-gray-50"
          >
            Zoom Out
          </button>
          <span className="text-sm font-medium">{Math.round(scale * 100)}%</span>
          <button
            onClick={() => setScale(Math.min(2, scale + 0.1))}
            className="px-3 py-1 text-sm border rounded hover:bg-gray-50"
          >
            Zoom In
          </button>
          <button
            onClick={() => setScale(1)}
            className="px-3 py-1 text-sm border rounded hover:bg-gray-50"
          >
            Reset
          </button>
        </div>
      </div>
    );
  }

  // For PDFs - show as iframe
  return (
    <div className="h-full flex flex-col">
      <iframe
        src={fileUrl}
        className="flex-1 w-full"
        title="PDF Viewer"
      />
      <div className="border-t p-2 text-center text-sm text-gray-500 bg-white">
        PDF highlighting is not supported. Convert to image for highlighting features.
      </div>
    </div>
  );
}
