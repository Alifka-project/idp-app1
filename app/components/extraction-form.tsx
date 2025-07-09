'use client';

import { useState } from 'react';
import { Input } from './ui/input';
import { Badge } from './ui/badge'; // Adjusted the path to match the correct location
import { FileText, Image, Stamp, PenTool } from 'lucide-react';

interface ExtractedField {
  label: string;
  value: string;
  type?: string;
  position?: string;
  confidence: number;
  boundingBox?: any;
}

interface ExtractionFormProps {
  data: {
    id: string;
    data: {
      documentType?: string;
      extractedFields: ExtractedField[];
      tables: Array<any>;
      logos?: Array<any>;
      signatures?: Array<any>;
      content: string;
    };
  };
  onUpdate: (data: any) => void;
  onFieldClick?: (field: ExtractedField) => void;
}

export default function ExtractionForm({ data, onUpdate, onFieldClick }: ExtractionFormProps) {
  const [formData, setFormData] = useState(data.data.extractedFields);

  const handleChange = (index: number, field: 'label' | 'value', value: string) => {
    const updated = [...formData];
    updated[index] = { ...updated[index], [field]: value };
    setFormData(updated);
    
    onUpdate({
      ...data,
      data: {
        ...data.data,
        extractedFields: updated
      }
    });
  };

  const getTypeIcon = (type?: string) => {
    switch (type) {
      case 'logo':
        return <Image className="w-3 h-3" />;
      case 'signature':
        return <PenTool className="w-3 h-3" />;
      case 'stamp':
        return <Stamp className="w-3 h-3" />;
      default:
        return <FileText className="w-3 h-3" />;
    }
  };

  return (
    <div className="p-6">
      {/* Special Elements */}
      {((data.data.logos?.length ?? 0) > 0 || (data.data.signatures?.length ?? 0) > 0) && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold mb-3 text-gray-700">Special Elements</h3>
          <div className="space-y-2">
            {data.data.logos?.map((logo: any, idx: number) => (
              <div key={`logo-${idx}`} className="flex items-center gap-2 p-2 bg-blue-50 rounded">
                <Image className="w-4 h-4 text-blue-600" />
                <span className="text-sm">{logo.description}</span>
                {logo.text && <Badge variant="secondary">{logo.text}</Badge>}
              </div>
            ))}
            {data.data.signatures?.map((sig: any, idx: number) => (
              <div key={`sig-${idx}`} className="flex items-center gap-2 p-2 bg-green-50 rounded">
                <PenTool className="w-4 h-4 text-green-600" />
                <span className="text-sm">Signature {sig.signatory && `- ${sig.signatory}`}</span>
                <Badge variant="secondary">{sig.position}</Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Extracted Fields */}
      <div className="space-y-4">
        {formData.map((item, idx) => (
          <div 
            key={idx} 
            className="border rounded-lg p-4 bg-white hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => onFieldClick?.(item)}
          >
            <div className="flex items-start gap-2 mb-3">
              {getTypeIcon(item.type)}
              <div className="flex-1">
                <div className="text-sm font-medium text-gray-600 mb-1">Label</div>
                <Input
                  value={item.label || ''}
                  onChange={(e) => {
                    e.stopPropagation();
                    handleChange(idx, 'label', e.target.value);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="font-medium"
                />
              </div>
            </div>
            
            <div className="mb-3">
              <div className="text-sm font-medium text-gray-600 mb-1">Value</div>
              <Input
                value={item.value || ''}
                onChange={(e) => {
                  e.stopPropagation();
                  handleChange(idx, 'value', e.target.value);
                }}
                onClick={(e) => e.stopPropagation()}
                className="font-mono text-sm"
              />
            </div>

            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <span className="text-gray-500">
                  Confidence: {(item.confidence * 100).toFixed(0)}%
                </span>
                {item.position && (
                  <Badge variant="outline" className="text-xs">
                    {item.position}
                  </Badge>
                )}
              </div>
              <span className="text-blue-600 hover:underline">
                Click to highlight in document
              </span>
            </div>
          </div>
        ))}
        
        {formData.length === 0 && (
          <div className="text-center text-gray-500 py-8">
            No fields extracted
          </div>
        )}
      </div>

      {/* Tables */}
      {data.data.tables?.length > 0 && (
        <div className="mt-8">
          <h3 className="text-sm font-semibold mb-3 text-gray-700">Tables Found</h3>
          {data.data.tables.map((table: any, idx: number) => (
            <div key={idx} className="mb-4 p-4 border rounded bg-gray-50">
              <div className="text-sm font-medium mb-2">Table {idx + 1}</div>
              {table.headers && (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr>
                        {table.headers.map((header: string, hidx: number) => (
                          <th key={hidx} className="px-2 py-1 text-left font-medium bg-gray-100">
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {table.rows?.map((row: any[], ridx: number) => (
                        <tr key={ridx}>
                          {row.map((cell: string, cidx: number) => (
                            <td key={cidx} className="px-2 py-1 border-t">
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}