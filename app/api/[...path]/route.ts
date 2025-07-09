export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import pdfParse from 'pdf-parse';
import sharp from 'sharp';

// Utility functions (extractFromText, extractFromImage) can be moved to a shared lib file.
async function extractFromText(text: string, openai: OpenAI) {
  const response = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
    messages: [
      { role: 'system', content: 'Extract all label-value pairs from this document text as JSON.' },
      { role: 'user', content: text }
    ],
    response_format: { type: 'json_object' },
    temperature: 0.1
  });
  return JSON.parse(response.choices[0].message.content || '{}');
}

async function extractFromImage(buffer: Buffer, mimeType: string, openai: OpenAI) {
  const base64 = buffer.toString('base64');
  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [
      { role: 'user', content: `Extract structured data from this image.` },
      { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } }
    ],
    max_tokens: 4096,
    temperature: 0.1
  });
  return JSON.parse(response.choices[0].message.content || '{}');
}

function getOpenAIClient() {
  const key = process.env.OPENAI_KEY;
  if (!key) throw new Error('Missing OPENAI_KEY environment variable');
  return new OpenAI({ apiKey: key });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const [route] = params.path;
  const openai = getOpenAIClient();

  if (route === 'extract') {
    const form = await req.formData();
    const file = form.get('file') as Blob;
    const buffer = Buffer.from(await file.arrayBuffer());
    let result;
    if (file.type === 'application/pdf') {
      const { text } = await pdfParse(buffer);
      result = await extractFromText(text, openai);
    } else {
      result = await extractFromImage(buffer, file.type, openai);
    }
    return NextResponse.json({ data: result });
  }

  if (route === 'chat') {
    const { id, message } = await req.json();
    // you will need to retrieve `extractedData` from a store if you need context
    const response = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: `Answer questions about document ${id}` },
        { role: 'user', content: message }
      ],
      stream: true
    });
    return new NextResponse(response.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive'
      }
    });
  }

  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}

export async function GET(
  req: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const [route] = params.path;
  // If you need download endpoints, implement here similarly using Papaparse/XLSX
  return NextResponse.json({ error: 'Not implemented' }, { status: 404 });
}
