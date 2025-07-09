// app/api/[...path]/route.ts
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import pdfParse from "pdf-parse";
import sharp from "sharp";

// utility functions you extracted from server/server.ts
async function extractFromImage(buffer: Buffer, mime: string) { /*…*/ }
async function extractFromText(text: string) { /*…*/ }

function getOpenAI() {
  const key = process.env.OPENAI_KEY;
  if (!key) throw new Error("Missing OPENAI_KEY");
  return new OpenAI({ apiKey: key });
}

export async function POST(req: NextRequest, { params }: { params: { path: string[] } }) {
  const segments = params.path;
  const route = segments.join("/");  // e.g. "extract" or "chat"

  try {
    const openai = getOpenAI();

    if (route === "extract") {
      // handle file upload
      const form = await req.formData();
      const file = form.get("file") as Blob;
      const buffer = Buffer.from(await file.arrayBuffer());
      let result;

      if (file.type === "application/pdf") {
        const { text } = await pdfParse(buffer);
        result = await extractFromText(text, openai);
      } else {
        result = await extractFromImage(buffer, file.type, openai);
      }

      return NextResponse.json({ data: result });
    }

    if (route === "chat") {
      // handle streaming chat
      const { id, message } = await req.json();
      const data = /* retrieve your in-memory data by id, or pass it in */;

      const stream = await openai.chat.completions.create({
        model: process.env.OPENAI_MODEL || "gpt-3.5-turbo",
        messages: [
          { role: "system", content: `Answer about this doc: ${JSON.stringify(data)}` },
          { role: "user", content: message },
        ],
        stream: true,
      });

      return new NextResponse(stream.body, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    return NextResponse.json({ error: "Unknown route" }, { status: 404 });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message || "Server error" }, { status: 500 });
  }
}
