import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

export async function POST(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const path = params.path.join('/');
  
  try {
    // Handle file uploads
    if (path === 'extract') {
      const formData = await request.formData();
      const response = await fetch(`${BACKEND_URL}/api/${path}`, {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      return NextResponse.json(data);
    }
    
    // Handle JSON requests
    const body = await request.json();
    const response = await fetch(`${BACKEND_URL}/api/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    
    // Handle streaming responses
    if (path === 'chat') {
      return new NextResponse(response.body, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    }
    
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: 'Proxy error' }, { status: 500 });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const path = params.path.join('/');
  
  try {
    const response = await fetch(`${BACKEND_URL}/api/${path}`);
    
    // Handle file downloads
    if (path.includes('download')) {
      const blob = await response.blob();
      return new NextResponse(blob, {
        headers: response.headers,
      });
    }
    
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: 'Proxy error' }, { status: 500 });
  }
}
