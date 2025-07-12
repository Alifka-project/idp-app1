import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import * as Papa from 'papaparse';
import * as XLSX from 'xlsx';

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_KEY || ''
});

// In-memory storage
const extractedData = new Map<string, any>();

// Simple extraction that was working before
async function extractFromImage(imageBuffer: Buffer, mimeType: string): Promise<any> {
  const base64Image = imageBuffer.toString('base64');
  
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // Updated model name
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Extract all information from this document. List each field in this format:
Field Name: Field Value

For example:
Invoice Number: INV001
Date: 2024-01-01
Company: ABC Corp

Extract EVERY field you can see in the document.`
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${base64Image}`
              }
            }
          ]
        }
      ],
      max_tokens: 4096,
      temperature: 0
    });

    const content = response.choices[0]?.message?.content || '';
    console.log('Extraction response:', content.substring(0, 200) + '...');
    
    // Parse the simple format
    const lines = content.split('\n');
    const extractedFields: any[] = [];
    const keyValuePairs: any[] = [];
    
    for (const line of lines) {
      const colonIndex = line.indexOf(':');
      if (colonIndex > 0) {
        const label = line.substring(0, colonIndex).trim();
        const value = line.substring(colonIndex + 1).trim();
        
        if (label && value) {
          extractedFields.push({
            label: label,
            value: value,
            confidence: 0.95
          });
          keyValuePairs.push({
            key: label,
            value: value,
            confidence: 0.95
          });
        }
      }
    }

    return {
      documentType: 'document',
      extractedFields: extractedFields,
      keyValuePairs: keyValuePairs,
      content: content
    };
  } catch (error: any) {
    console.error('GPT-4 error:', error);
    throw new Error(`Extraction failed: ${error.message}`);
  }
}

// PDF extraction
async function extractFromPDF(text: string): Promise<any> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "user",
          content: `Extract all field names and values from this document text. List each field as:
Field Name: Field Value

Document text:
${text.substring(0, 3000)}`
        }
      ],
      temperature: 0
    });

    const content = response.choices[0]?.message?.content || '';
    
    // Parse the response
    const lines = content.split('\n');
    const extractedFields: any[] = [];
    const keyValuePairs: any[] = [];
    
    for (const line of lines) {
      const colonIndex = line.indexOf(':');
      if (colonIndex > 0) {
        const label = line.substring(0, colonIndex).trim();
        const value = line.substring(colonIndex + 1).trim();
        
        if (label && value) {
          extractedFields.push({
            label: label,
            value: value,
            confidence: 0.95
          });
          keyValuePairs.push({
            key: label,
            value: value,
            confidence: 0.95
          });
        }
      }
    }

    return {
      documentType: 'document',
      extractedFields: extractedFields,
      keyValuePairs: keyValuePairs,
      content: text
    };
  } catch (error) {
    console.error('PDF extraction error:', error);
    return {
      documentType: 'document',
      extractedFields: [],
      keyValuePairs: [],
      content: text
    };
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

      console.log('Processing file:', file.name, 'Type:', file.type);

      if (!process.env.OPENAI_KEY) {
        return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 });
      }

      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      let extracted;
      
      if (file.type === 'application/pdf') {
        // For PDFs, convert to text first
        // Since pdf-parse doesn't work on Vercel, we'll use a simple approach
        const textContent = "PDF content extraction not available. Please convert to image.";
        extracted = await extractFromPDF(textContent);
      } else if (file.type.startsWith('image/')) {
        extracted = await extractFromImage(buffer, file.type);
      } else {
        return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 });
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
            content: `You are helping analyze a document. Here's the extracted data:
            ${JSON.stringify(data, null, 2)}
            
            Answer questions based on this data.`
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
      error: error.message || 'Internal server error'
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

      const exportData = (data.extractedFields || data.keyValuePairs || []).map((field: any) => ({
        Label: field.label || field.key,
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
