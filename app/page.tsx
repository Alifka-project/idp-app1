'use client';

import { useState } from 'react';
import FileUpload from './components/file-upload';
import DocumentViewer from './components/document-viewer';
import ExtractionForm from './components/extraction-form';
import ChatPanel from './components/chat-panel';
import { Button } from './components/ui/button';
import { FileText, Download, MessageSquare } from 'lucide-react';

interface ExtractedField {
  label: string;
  value: string;
  type?: string;
  position?: string;
  confidence: number;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

interface ExtractedData {
  id: string;
  data: {
    documentType?: string;
    keyValuePairs: Array<{ key: string; value: string; confidence: number }>;
    extractedFields: ExtractedField[];
    tables: Array<any>;
    logos?: Array<any>;
    signatures?: Array<any>;
    content: string;
    pages: Array<any>;
  };
}

export default function Home() {
  const [files, setFiles] = useState<File[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlightedField, setHighlightedField] = useState<ExtractedField | null>(null);

  const handleFilesSelected = (newFiles: File[]) => {
    setFiles([...files, ...newFiles]);
    if (!selectedFile && newFiles.length > 0) {
      setSelectedFile(newFiles[0]);
    }
  };

  const handleExtract = async () => {
    if (!selectedFile) return;
    
    setLoading(true);
    const formData = new FormData();
    formData.append('file', selectedFile);
    
    try {
      const res = await fetch('/api/extract', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        setExtractedData(data);
      } else {
        alert(data.error || 'Extraction failed');
      }
    } catch (error) {
      console.error('Extraction failed:', error);
      alert('Failed to extract document');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (format: 'csv' | 'xlsx') => {
    if (!extractedData) return;
    
    const res = await fetch(`/api/download/${extractedData.id}/${format}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `extracted.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFieldClick = (field: any, type: 'label' | 'value' | 'both') => {
    // Simple highlighting by setting the field
    setHighlightedField({
      ...field,
      highlightType: type
    });
    
    // Show alert with field info (since we can't highlight without coordinates)
    alert(`Selected ${type}: ${field.label} = ${field.value}`);
  };

  return (
    <div className="h-screen flex flex-col">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-white border-b px-4 py-3 flex items-center justify-between shadow-sm">
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <FileText className="w-5 h-5" />
          IDP App (OpenAI)
        </h1>
        <div className="flex items-center gap-3">
          <FileUpload onFilesSelected={handleFilesSelected} />
          <Button onClick={handleExtract} disabled={!selectedFile || loading}>
            {loading ? 'Extracting...' : 'Extract'}
          </Button>
          <Button variant="outline" onClick={() => handleDownload('csv')} disabled={!extractedData}>
            <Download className="w-4 h-4 mr-2" />
            CSV
          </Button>
          <Button variant="outline" onClick={() => handleDownload('xlsx')} disabled={!extractedData}>
            <Download className="w-4 h-4 mr-2" />
            XLSX
          </Button>
          <Button variant="outline" onClick={() => setShowChat(!showChat)} disabled={!extractedData}>
            <MessageSquare className="w-4 h-4 mr-2" />
            Ask Doc
          </Button>
        </div>
      </nav>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Thumbnails sidebar */}
        <div className="w-48 border-r p-4 overflow-y-auto bg-gray-50">
          <h3 className="text-sm font-semibold mb-3">Documents</h3>
          {files.map((file, idx) => (
            <div
              key={idx}
              className={`mb-2 p-2 border rounded cursor-pointer hover:bg-white transition-colors ${
                selectedFile === file ? 'border-blue-500 bg-white shadow-sm' : 'border-gray-200'
              }`}
              onClick={() => setSelectedFile(file)}
            >
              <div className="text-xs truncate font-medium">{file.name}</div>
              <div className="text-xs text-gray-500">{(file.size / 1024).toFixed(1)} KB</div>
            </div>
          ))}
        </div>

        {/* Split view */}
        <div className="flex-1 flex">
          {/* Left: Fixed Document viewer */}
          <div className="w-1/2 border-r flex flex-col bg-gray-50">
            <div className="p-2 border-b bg-white">
              <span className="text-sm font-medium text-gray-700">Original Document</span>
            </div>
            <div className="flex-1 overflow-hidden">
              {selectedFile ? (
                <DocumentViewer 
                  file={selectedFile} 
                  highlightedField={highlightedField}
                />
              ) : (
                <div className="h-full flex items-center justify-center text-gray-400">
                  Upload a document to begin
                </div>
              )}
            </div>
          </div>

          {/* Right: Scrollable Extraction form */}
          <div className="w-1/2 flex flex-col">
            <div className="p-2 border-b bg-white">
              <span className="text-sm font-medium text-gray-700">
                Extracted Data
                {extractedData?.data.documentType && (
                  <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                    {extractedData.data.documentType}
                  </span>
                )}
              </span>
            </div>
            <div className="flex-1 overflow-y-auto">
              {extractedData ? (
                <ExtractionForm 
                  data={extractedData} 
                  onUpdate={setExtractedData}
                  onFieldClick={handleFieldClick}
                />
              ) : (
                <div className="h-full flex items-center justify-center text-gray-400">
                  Click "Extract" to process the document
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Chat panel */}
        {showChat && extractedData && (
          <ChatPanel 
            extractedDataId={extractedData.id} 
            onClose={() => setShowChat(false)} 
          />
        )}
      </div>
    </div>
  );
}
