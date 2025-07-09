import path from 'path';
import dotenv from 'dotenv';
dotenv.config({
  path: path.resolve(__dirname, '../.env')  // ✅ explicitly load .env
});

console.log("🔐 OpenAI Key Loaded:", process.env.OPENAI_KEY ? "YES" : "NO");

console.log("HELLO:", process.env.HELLO);
// This is a Node.js server using Express to handle file uploads and process documents with OpenAI's GPT models.
// It supports PDF and image files, extracts structured data, and allows users to download the results in CSV or XLSX format.
// It also provides a chat interface to ask questions about the extracted data

// Ensure you have the necessary packages installed:
// npm install express cors multer openai papaparse xlsx pdf-parse sharp fs/promises path dotenv

import express from 'express';
import cors from 'cors';
import multer from 'multer';
import OpenAI from 'openai';
import * as Papaparse from 'papaparse';
import * as XLSX from 'xlsx';
import pdfParse from 'pdf-parse';
import sharp from 'sharp';

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

app.use(cors());
app.use(express.json());

// OpenAI setup
const openai = new OpenAI({
  apiKey: process.env.OPENAI_KEY || ''
});

// Store extracted data in memory
const extractedData = new Map<string, any>();

// Enhanced extraction prompt for better accuracy
const EXTRACTION_PROMPT = `Analyze this document image and extract ALL information with high accuracy.

IMPORTANT INSTRUCTIONS:
1. Extract EVERY piece of text, including headers, labels, values, logos, signatures, stamps
2. Identify the document type (invoice, receipt, form, etc.)
3. For each piece of information, identify if it's a label (field name) or a value (field content)
4. Detect and note any logos, signatures, stamps, or special marks
5. Preserve the exact text as it appears (including case, punctuation, special characters)
6. Note the approximate position of each element (top-left, center, bottom-right, etc.)
7. Identify table structures if present

Return the data in this EXACT JSON format:
{
  "documentType": "invoice/receipt/form/etc",
  "extractedFields": [
    {
      "label": "exact label text as shown",
      "value": "exact value text as shown",
      "type": "text/logo/signature/stamp",
      "position": "top-left/top-center/top-right/middle-left/center/middle-right/bottom-left/bottom-center/bottom-right",
      "confidence": 0.95,
      "boundingBox": {
        "x": 0.1,
        "y": 0.1,
        "width": 0.2,
        "height": 0.05
      }
    }
  ],
  "tables": [
    {
      "position": "position description",
      "headers": ["col1", "col2"],
      "rows": [
        ["value1", "value2"]
      ]
    }
  ],
  "logos": [
    {
      "description": "company logo description",
      "position": "position",
      "text": "any text in logo"
    }
  ],
  "signatures": [
    {
      "description": "signature description",
      "position": "position",
      "signatory": "name if readable"
    }
  ],
  "fullText": "complete document text"
}

Be extremely thorough - do not miss ANY text or visual element!`;

// Extract data from image using GPT-4 Vision
async function extractFromImage(imageBuffer: Buffer, mimeType: string): Promise<any> {
  const base64Image = imageBuffer.toString('base64');
  
  const response = await openai.chat.completions.create({
    model: "gpt-4-vision-preview",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: EXTRACTION_PROMPT
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
    temperature: 0.1 // Lower temperature for more consistent extraction
  });

  const result = response.choices[0].message.content;
  try {
    const parsed = JSON.parse(result || '{}');
    // Transform to expected format
    return {
      documentType: parsed.documentType,
      extractedFields: parsed.extractedFields || [],
      tables: parsed.tables || [],
      logos: parsed.logos || [],
      signatures: parsed.signatures || [],
      content: parsed.fullText || '',
      rawResponse: parsed
    };
  } catch (e) {
    console.error('Failed to parse GPT response:', e);
    return {
      extractedFields: [],
      tables: [],
      content: result || '',
      error: 'Failed to parse structured data'
    };
  }
}

// Extract from PDF text
async function extractFromText(text: string): Promise<any> {
  const response = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [
      {
        role: "system",
        content: `Extract all label-value pairs from this document text. 
        Identify actual field labels and their corresponding values.
        Return JSON format: {"extractedFields": [{"label": "field name", "value": "field value", "confidence": 0.95}]}`
      },
      {
        role: "user",
        content: text
      }
    ],
    response_format: { type: "json_object" },
    temperature: 0.1
  });

  try {
    const parsed = JSON.parse(response.choices[0].message.content || '{}');
    return {
      ...parsed,
      content: text
    };
  } catch (e) {
    return {
      extractedFields: [],
      content: text
    };
  }
}

app.post('/api/extract', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    let extracted;
    
    if (req.file.mimetype === 'application/pdf') {
      const pdfData = await pdfParse(req.file.buffer);
      extracted = await extractFromText(pdfData.text);
    } else if (req.file.mimetype.startsWith('image/')) {
      extracted = await extractFromImage(req.file.buffer, req.file.mimetype);
    } else {
      return res.status(400).json({ error: 'Unsupported file type' });
    }

    const id = Date.now().toString();
    extractedData.set(id, extracted);

    res.json({ id, data: extracted });
  } catch (error) {
    console.error('Extraction error:', error);
    res.status(500).json({ error: 'Failed to extract document' });
  }
});

app.get('/api/download/:id/:format', (req, res) => {
  const { id, format } = req.params;
  const data = extractedData.get(id);
  
  if (!data) {
    return res.status(404).json({ error: 'Data not found' });
  }

  const exportData = data.extractedFields?.map((field: any) => ({
    Label: field.label,
    Value: field.value,
    Type: field.type || 'text',
    Confidence: field.confidence
  })) || [];

  if (format === 'csv') {
    const csv = Papaparse.unparse(exportData);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=extracted.csv');
    res.send(csv);
  } else if (format === 'xlsx') {
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Extracted Data');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=extracted.xlsx');
    res.send(buffer);
  } else {
    res.status(400).json({ error: 'Invalid format' });
  }
});

app.post('/api/chat', express.json(), async (req, res) => {
  const { id, message } = req.body;
  const data = extractedData.get(id);
  
  if (!data) {
    return res.status(404).json({ error: 'Data not found' });
  }

  try {
    const stream = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: `Answer questions about this document: ${JSON.stringify(data)}`
        },
        { role: 'user', content: message }
      ],
      stream: true
    });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        res.write(`data: ${JSON.stringify({ content })}\n\n`);
      }
    }
    res.write('data: [DONE]\n\n');
    res.end();
  } catch (error) {
    res.status(500).json({ error: 'Chat failed' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// app/api/extract/route.ts
import { NextResponse } from "next/server";
// Removed duplicate import of OpenAI

const openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: Request) {
  const { text } = await req.json();
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: text }],
  });
  return NextResponse.json(completion.choices[0].message);
}
