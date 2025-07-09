<<<<<<< HEAD
# IDP App - Intelligent Document Processing (OpenAI Version)

Extract structured data from PDFs and images using OpenAI GPT-4 Vision and GPT-3.5.

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Next.js   │────▶│   Express    │────▶│   OpenAI    │
│   Frontend  │     │   Backend    │     │  GPT-4V/3.5 │
│  (Port 3000)│     │  (Port 3001) │     └─────────────┘
└─────────────┘     └──────────────┘
       │                     │
       └─────────────────────┘
              API Proxy
```

## Features

- **Upload**: PDF and image files with thumbnail preview
- **Extract**: 
  - Images: Uses GPT-4 Vision to extract structured data
  - PDFs: Extracts text and uses GPT-3.5 to parse structure
- **Edit**: Modify extracted key-value pairs in split view
- **Export**: Download as CSV or XLSX
- **Chat**: Query extracted data using GPT-3.5

## Prerequisites

- Node.js 18+
- OpenAI API key with GPT-4 Vision access

## Setup

1. Clone and install dependencies:
```bash
npm install
```

2. Copy `.env.example` to `.env` and add your OpenAI key:
```bash
cp .env.example .env
# Edit .env and add your OPENAI_KEY
```

## Run

```bash
npm run dev
```

Opens at http://localhost:3000

## How It Works

1. **Image Processing**: Sends images directly to GPT-4 Vision API
2. **PDF Processing**: Extracts text from PDFs and uses GPT-3.5 to identify structure
3. **Data Extraction**: AI identifies key-value pairs, tables, and structured content
4. **Chat**: Uses the extracted data as context for answering questions

## API Usage Costs

- GPT-4 Vision: ~$0.01 per image
- GPT-3.5 Turbo: ~$0.001 per page of text
- Chat queries: ~$0.001 per query

## Build

```bash
npm run build
npm start
```

## Notes

- All processing done via OpenAI APIs
- No Azure dependencies required
- Files processed in memory (no persistent storage)
- Best results with clear, well-structured documents
=======
# idp-app1
>>>>>>> e8588647bf4dca77ad3cef8af225826f315c40b3
# idp-app2
