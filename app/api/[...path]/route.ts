import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import * as Papa from 'papaparse';
import * as XLSX from 'xlsx';

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_KEY || ''
});

// In-memory storage (use Vercel KV in production)
const extractedData = new Map<string, any>();

// Helper function to extract from image with bounding boxes
async function extractFromImage(imageBuffer: Buffer, mimeType: string): Promise<any> {
  const base64Image = imageBuffer.toString('base64');
  
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4-vision-preview",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Analyze this document image carefully. Extract ALL text fields with their positions.

For each piece of text, estimate its position as a percentage of the image dimensions:
- x: horizontal position (0=left edge, 1=right edge)
- y: vertical position (0=top edge, 1=bottom edge)
- width: width as percentage of image width
- height: height as percentage of image height

Return JSON in this exact format:
{
  "documentType": "invoice/receipt/form/other",
  "extractedFields": [
    {
      "label": "Account No",
      "value": "12345",
      "confidence": 0.95,
      "labelBoundingBox": {"x": 0.1, "y": 0.2, "width": 0.15, "height": 0.03},
      "valueBoundingBox": {"x": 0.3, "y": 0.2, "width": 0.25, "height": 0.03}
    }
  ]
}

IMPORTANT: 
- Extract the EXACT text as it appears
- Estimate positions based on visual layout
- Include all fields you can see`
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${base64Image}`,
                detail: "high" // Use high detail for better extraction
              }
            }
          ]
        }
      ],
      max_tokens: 4096,
      temperature: 0
    });

    const content = response.choices[0]?.message?.content || '';
    console.log('GPT-4 Vision response:', content.substring(0, 200) + '...');
    
    try {
      const parsed = JSON.parse(content);
      return {
        documentType: parsed.documentType || 'document',
        extractedFields: parsed.extractedFields || [],
        keyValuePairs: parsed.extractedFields?.map((f: any) => ({
          key: f.label,
          value: f.value,
          confidence: f.confidence
        })) || [],
        content: content
      };
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      // Fallback: try to extract key-value pairs from response
      return extractFromPlainText(content);
    }
  } catch (error: any) {
    console.error('GPT-4 Vision error:', error.message);
    throw new Error(`Image extraction failed: ${error.message}`);
  }
}

// Fallback text extraction
function extractFromPlainText(text: string): any {
  const lines = text.split('\n');
  const extractedFields: any[] = [];
  
  for (const line of lines) {
    const colonMatch = line.match(/^([^:]+):\s*(.+)$/);
    if (colonMatch) {
      extractedFields.push({
        label: colonMatch[1].trim(),
        value: colonMatch[2].trim(),
        confidence: 0.8
      });
    }
  }

  return {
    documentType: 'document',
    extractedFields: extractedFields,
    keyValuePairs: extractedFields.map(f => ({
      key: f.label,
      value: f.value,
      confidence: f.confidence
    })),
    content: text
  };
}

// PDF extraction using text analysis
async function extractFromPDF(text: string): Promise<any> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: `Extract all field names and values from this document text.
Return JSON: {"extractedFields": [{"label": "field name", "value": "field value", "confidence": 0.95}]}`
        },
        {
          role: "user",
          content: text.substring(0, 4000) // Limit text length
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0
    });

    const parsed = JSON.parse(response.choices[0].message.content || '{}');
    return {
      documentType: 'document',
      extractedFields: parsed.extractedFields || [],
      keyValuePairs: (parsed.extractedFields || []).map((f: any) => ({
        key: f.label,
        value: f.value,
        confidence: f.confidence
      })),
      content: text
    };
  } catch (error) {
    console.error('PDF extraction error:', error);
    return extractFromPlainText(text);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const path = params.path.join('/');
  
  try {
    // Handle extraction
    if (path === 'extract') {
      const formData = await request.formData();
      const file = formData.get('file') as File;
      
      if (!file) {
        return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
      }

      console.log('Processing file:', file.name, 'Type:', file.type, 'Size:', file.size);

      if (!process.env.OPENAI_KEY) {
        return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 });
      }

      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      let extracted;
      
      if (file.type === 'application/pdf') {
        // For PDFs, we'll use a simpler text extraction
        // Note: pdf-parse doesn't work well in Vercel, so we'll use a different approach
        const text = await extractTextFromPDF(buffer);
        extracted = await extractFromPDF(text);
      } else if (file.type.startsWith('image/')) {
        extracted = await extractFromImage(buffer, file.type);
      } else {
        return NextResponse.json({ error: 'Unsupported file type. Please upload PDF or image files.' }, { status: 400 });
      }

      const id = Date.now().toString();
      extractedData.set(id, extracted);

      console.log('Extraction complete. Fields:', extracted.extractedFields?.length || 0);
      return NextResponse.json({ id, data: extracted });
    }
    
    // Handle chat
    if (path === 'chat') {
      const body = await request.json();
      const { id, message } = body;
      const data = extractedData.get(id);
      
      if (!data) {
        return NextResponse.json({ error: 'Data not found' }, { status: 404 });
      }

      const stream = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: `Document data: ${JSON.stringify(data, null, 2)}`
          },
          { role: 'user', content: message }
        ],
        stream: true
      });

      const encoder = new TextEncoder();
      const readableStream = new ReadableStream({
        async start(controller) {
          for await (const chunk of stream) {
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`));
            }
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        }
      });

      return new NextResponse(readableStream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }
    
    return NextResponse.json({ error: 'Invalid endpoint' }, { status: 404 });
  } catch (error: any) {
    console.error('API error:', error);
    return NextResponse.json({ 
      error: error.message || 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const path = params.path.join('/');
  
  try {
    // Handle downloads
    if (path.startsWith('download/')) {
      const [, id, format] = path.split('/');
      const data = extractedData.get(id);
      
      if (!data) {
        return NextResponse.json({ error: 'Data not found' }, { status: 404 });
      }

      const exportData = (data.extractedFields || []).map((field: any) => ({
        Label: field.label,
        Value: field.value,
        Confidence: ((field.confidence || 0.95) * 100).toFixed(0) + '%'
      }));

      if (format === 'csv') {
        const csv = Papa.unparse(exportData);
        return new NextResponse(csv, {
          headers: {
            'Content-Type': 'text/csv',
            'Content-Disposition': 'attachment; filename=extracted.csv'
          }
        });
      } else if (format === 'xlsx') {
        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Extracted Data');
        const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
        
        return new NextResponse(buffer, {
          headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': 'attachment; filename=extracted.xlsx'
          }
        });
      }
    }
    
    return NextResponse.json({ error: 'Invalid endpoint' }, { status: 404 });
  } catch (error: any) {
    console.error('API error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

// Simple PDF text extraction for Vercel
async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  // For Vercel, we'll send the PDF to GPT-4 Vision as well
  // This avoids pdf-parse compatibility issues
  const base64 = buffer.toString('base64');
  
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4-vision-preview",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract all text from this PDF document. Return only the text content."
            },
            {
              type: "image_url",
              image_url: {
                url: `data:application/pdf;base64,${base64}`
              }
            }
          ]
        }
      ],
      max_tokens: 4096
    });
    
    return response.choices[0]?.message?.content || '';
  } catch (error) {
    console.error('PDF text extraction error:', error);
    return '';
  }
}
