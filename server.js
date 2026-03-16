import path from "node:path";
import { fileURLToPath } from "node:url";

import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import OpenAI from "openai";

dotenv.config();

const app = express();
app.disable("x-powered-by");

const PORT = Number(process.env.PORT || 3000);
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

if (!process.env.OPENAI_API_KEY) {
  console.warn(
    "Missing OPENAI_API_KEY. Create server/.env from server/.env.example before using /api/chat."
  );
}

let openaiClient = null;
function getOpenAIClient() {
  if (openaiClient) return openaiClient;
  if (!process.env.OPENAI_API_KEY) return null;
  openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  return openaiClient;
}

app.use(
  cors({
    origin: [/^http:\/\/localhost:\d+$/, /^http:\/\/127\.0\.0\.1:\d+$/],
  })
);
app.use(express.json({ limit: "64kb" }));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webDir = path.resolve(__dirname, "..", "web");

app.use(express.static(webDir));

function isValidMessage(m) {
  return (
    m &&
    (m.role === "user" || m.role === "assistant") &&
    typeof m.content === "string" &&
    m.content.length > 0 &&
    m.content.length < 8000
  );
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function extractJsonObject(text) {
  if (typeof text !== "string") return null;
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) return null;
  return safeJsonParse(text.slice(first, last + 1));
}

app.post("/api/chat", async (req, res) => {
  try {
    const body = req.body ?? {};
    const incoming = Array.isArray(body.messages) ? body.messages : [];
    const cleaned = incoming.filter(isValidMessage).slice(-30);

    if (cleaned.length === 0) {
      return res.status(400).json({ error: "No messages provided." });
    }

    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({
        error: "Server not configured. Missing OPENAI_API_KEY in server/.env",
      });
    }

    const openai = getOpenAIClient();
    if (!openai) {
      return res.status(500).json({
        error: "Server not configured. Missing OPENAI_API_KEY in server/.env",
      });
    }

    const lastUser = [...cleaned].reverse().find((m) => m.role === "user")?.content || "";

    const system = {
      role: "system",
      content:
        [
          "You are a helpful Japanese language conversation partner.",
          "",
          "Hard rules:",
          "- Speak ONLY in Japanese in the main reply.",
          "- Return EXACTLY one JSON object and nothing else.",
          "",
          "JSON schema (all strings):",
          `{`,
          `  "reply_ja": "Japanese reply only (no English).",`,
          `  "furigana": "Same content as reply_ja, but with readings in parentheses after kanji. Example: 私(わたし)は学生(がくせい)です。",`,
          `  "meaning_en": "English meaning/translation of reply_ja.",`,
          `  "user_corrected_ja": "Corrected natural Japanese version of the user's last message (if already correct, repeat it).",`,
          `  "correction_notes_en": "Short English notes on what was corrected (or 'No corrections.')."`,
          `}`,
          "",
          "If the user didn't write Japanese, still provide user_corrected_ja as a natural Japanese version of what they meant.",
          "Keep reply_ja concise and friendly.",
        ].join("\n"),
    };

    const response = await openai.chat.completions.create({
      model: OPENAI_MODEL,
      messages: [system, ...cleaned, { role: "user", content: `User last message:\n${lastUser}` }],
      temperature: 0.7,
    });

    const raw = response.choices?.[0]?.message?.content?.trim() || "";
    if (!raw) {
      return res.status(502).json({ error: "Empty response from model." });
    }

    const parsed = safeJsonParse(raw) ?? extractJsonObject(raw);
    if (!parsed || typeof parsed.reply_ja !== "string") {
      return res.status(502).json({ error: "Model returned an invalid JSON response." });
    }

    return res.json({
      reply: parsed.reply_ja,
      reply_ja: parsed.reply_ja,
      furigana: typeof parsed.furigana === "string" ? parsed.furigana : "",
      meaning_en: typeof parsed.meaning_en === "string" ? parsed.meaning_en : "",
      user_corrected_ja:
        typeof parsed.user_corrected_ja === "string" ? parsed.user_corrected_ja : "",
      correction_notes_en:
        typeof parsed.correction_notes_en === "string" ? parsed.correction_notes_en : "",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown server error";
    return res.status(500).json({ error: message });
  }
});

app.get("/healthz", (_req, res) => {
  res.json({ ok: true });
});

const server = app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log("Open the site in your browser (served by this server).");
});

server.on("error", (err) => {
  if (err && typeof err === "object" && "code" in err && err.code === "EADDRINUSE") {
    console.error(`Port ${PORT} is already in use. Close the other process or set PORT in server/.env.`);
    process.exit(1);
  }
  console.error(err);
  process.exit(1);
});

