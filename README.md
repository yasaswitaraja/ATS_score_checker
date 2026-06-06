# Simple ATS Resume Checker

A beginner-friendly ATS resume checker built with React, JavaScript, and CSS.

**No sign in. No database. Just upload and check.**

## Features

- Upload PDF or DOCX resume
- Get ATS score (0–100)
- Strengths, weaknesses, and recommendations
- Optional job title/description for keyword matching
- Dark theme

## Tech Stack

- **Frontend:** React + Vite + plain CSS
- **Backend:** Node.js + Express
- **AI:** OpenAI API (optional — works in demo mode without a key)

## How to Run

```bash
npm install
npm run dev
```

Open **http://localhost:5173** in your browser.

## Add Real AI Analysis

1. Get an API key from [OpenAI](https://platform.openai.com)
2. Add it to `.env`:
   ```
   OPENAI_API_KEY=sk-your-key-here
   ```
3. Restart the server

Without an API key, the app runs in **demo mode** with basic rule-based scoring.

## Project Structure

```
src/
  App.jsx      ← Main React component
  App.css      ← Dark theme styles
  main.jsx     ← React entry point
server/
  index.js     ← Express API (parse resume + analyze)
```

## How It Works

1. User uploads a resume (PDF/DOCX)
2. Backend extracts text using `pdf-parse` or `mammoth`
3. Text is sent to OpenAI for ATS analysis (or demo scoring)
4. Results shown on screen — score, tips, keywords
