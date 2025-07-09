'use client';

import { useEffect, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.js`;

interface DocumentViewerProps {
  file: File;
  highlightedField?: {
    label: string;
    value: string;
    boundingBox?: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
  } | null;
}

export default function DocumentViewer({ file, highlightedField }: DocumentViewerProps) {
  const [fileUrl, setFileUrl] = useState<string>('');
  const [numPages, setNumPages] = useState<number>(1);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(1);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setFileUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  if (file.type.startsWith('image/')) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex-1 relative overflow-auto p-4 bg-gray-50">
          <div className="relative inline-block">
            <img 
              src={fileUrl} 
              alt={file.name}
              className="max-w-full h-auto shadow-lg"
              style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}
            />
            {highlightedField?.boundingBox && (
              <div
                className="absolute border-2 border-blue-500 bg-blue-200 bg-opacity-30 pointer-events-none animate-pulse"
                style={{
                  left: `${highlightedField.boundingBox.x * 100}%`,
                  top: `${highlightedField.boundingBox.y * 100}%`,
                  width: `${highlightedField.boundingBox.width * 100}%`,
                  height: `${highlightedField.boundingBox.height * 100}%`,
                }}
              />
            )}
          </div>
        </div>
        <div className="border-t p-2 flex items-center justify-center gap-4 bg-white">
          <button
            onClick={() => setScale(Math.max(0.5, scale - 0.1))}
            className="px-3 py-1 text-sm border rounded hover:bg-gray-50"
          >
            Zoom Out
          </button>
          <span className="text-sm">{Math.round(scale * 100)}%</span>
          <button
            onClick={() => setScale(Math.min(2, scale + 0.1))}
            className="px-3 py-1 text-sm border rounded hover:bg-gray-50"
          >
            Zoom In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-auto p-4 bg-gray-50">
        <Document
          file={fileUrl}
          onLoadSuccess={({ numPages }) => setNumPages(numPages)}
          loading={<div className="text-center py-8">Loading PDF...</div>}
          error={<div className="text-center py-8 text-red-500">Failed to load PDF</div>}
        >
          <Page 
            pageNumber={pageNumber} 
            renderTextLayer={false}
            renderAnnotationLayer={false}
            className="shadow-lg mx-auto"
            scale={scale}
          />
        </Document>
      </div>
      <div className="border-t p-2 flex items-center justify-center gap-4 bg-white">
        <button
          onClick={() => setPageNumber(Math.max(1, pageNumber - 1))}
          disabled={pageNumber <= 1}
          className="px-3 py-1 text-sm border rounded disabled:opacity-50 hover:bg-gray-50"
        >
          Previous
        </button>
        <span className="text-sm">
          Page {pageNumber} of {numPages}
        </span>
        <button
          onClick={() => setPageNumber(Math.min(numPages, pageNumber + 1))}
          disabled={pageNumber >= numPages}
          className="px-3 py-1 text-sm border rounded disabled:opacity-50 hover:bg-gray-50"
        >
          Next
        </button>
        <div className="ml-4 flex items-center gap-2">
          <button
            onClick={() => setScale(Math.max(0.5, scale - 0.1))}
            className="px-2 py-1 text-sm border rounded hover:bg-gray-50"
          >
            -
          </button>
          <span className="text-sm">{Math.round(scale * 100)}%</span>
          <button
            onClick={() => setScale(Math.min(2, scale + 0.1))}
            className="px-2 py-1 text-sm border rounded hover:bg-gray-50"
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
}