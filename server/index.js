import express from "express";
import cors from "cors";
import multer from "multer";
import dotenv from "dotenv";
import pdfParse from "pdf-parse";
import mammoth from "mammoth";
import OpenAI from "openai";
import { runATSCheck } from "./ats-engine.js";

dotenv.config();

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

async function extractText(buffer, mimetype) {
  if (mimetype === "application/pdf") {
    const data = await pdfParse(buffer);
    return data.text;
  }

  if (
    mimetype ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  throw new Error("Please upload a PDF or DOCX file.");
}

// Score resume using real ATS logic (primary method)
function analyzeWithATS(resumeText, jobTitle, jobDescription) {
  return runATSCheck(resumeText, jobTitle, jobDescription);
}

// Optional: enhance with OpenAI if API key works
async function analyzeResume(resumeText, jobTitle, jobDescription) {
  const atsResult = analyzeWithATS(resumeText, jobTitle, jobDescription);

  const apiKey = (process.env.OPENAI_API_KEY || "").trim();
  if (!apiKey || apiKey === "sk-placeholder") {
    return atsResult;
  }

  try {
    const openai = new OpenAI({ apiKey });
    const jobInfo = jobTitle
      ? `\nJob: ${jobTitle}\nDescription: ${jobDescription || ""}`
      : "";

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are an ATS expert. Return JSON only. Add 2-3 extra specific recommendations.",
        },
        {
          role: "user",
          content: `ATS score: ${atsResult.atsScore}. Missing keywords: ${atsResult.missingKeywords.join(", ")}.
Return JSON: { "extraRecommendations": ["...", "..."] }
${jobInfo}
Resume excerpt: ${resumeText.slice(0, 3000)}`,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });

    const extra = JSON.parse(response.choices[0].message.content);
    return {
      ...atsResult,
      recommendations: [
        ...atsResult.recommendations,
        ...(extra.extraRecommendations || []),
      ].slice(0, 8),
      mode: "ats+ai",
    };
  } catch {
    return atsResult;
  }
}

app.post("/api/analyze", upload.single("resume"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No resume file uploaded." });
    }

    const resumeText = await extractText(req.file.buffer, req.file.mimetype);
    const cleaned = resumeText.replace(/\s+/g, " ").trim();

    if (cleaned.length < 50) {
      return res.status(400).json({
        error: "Could not read enough text from the file. Try a different resume.",
      });
    }

    const jobTitle = req.body.jobTitle || "";
    const jobDescription = req.body.jobDescription || "";

    const result = await analyzeResume(cleaned, jobTitle, jobDescription);
    res.json(result);
  } catch (err) {
    console.error("Analysis error:", err.message);
    res.status(500).json({ error: err.message || "Failed to analyze resume." });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
