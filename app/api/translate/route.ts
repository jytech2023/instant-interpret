import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText } from "ai";
import { z } from "zod";
import { LANGUAGE_BY_CODE, type LangCode } from "@/lib/languages";

export const runtime = "nodejs";
export const maxDuration = 30;

const Body = z.object({
  text: z.string().trim().min(1).max(4000),
  from: z.string(),
  to: z.string(),
});

function isLang(code: string): code is LangCode {
  return code in LANGUAGE_BY_CODE;
}

const TRANSLATE_MODEL =
  process.env.TRANSLATE_MODEL ?? "google/gemini-2.5-flash";

export async function POST(req: Request) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "OPENROUTER_API_KEY not set" },
      { status: 500 },
    );
  }

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { text, from, to } = body;
  if (!isLang(from) || !isLang(to)) {
    return Response.json({ error: "Unsupported language" }, { status: 400 });
  }
  if (from === to) {
    return Response.json({ translation: text });
  }

  const fromName = LANGUAGE_BY_CODE[from].englishName;
  const toName = LANGUAGE_BY_CODE[to].englishName;

  const openrouter = createOpenRouter({ apiKey });

  try {
    const { text: translation } = await generateText({
      model: openrouter(TRANSLATE_MODEL),
      temperature: 0,
      maxOutputTokens: 512,
      system: `You are a professional simultaneous interpreter. Translate the user's spoken text from ${fromName} into ${toName}. Output ONLY the translation, with no preamble, no quotes, no commentary, no romanization. Preserve names and numbers exactly. Keep it natural and idiomatic for spoken use.`,
      prompt: text,
    });

    return Response.json({ translation: translation.trim() });
  } catch (err) {
    console.error("translate error", err);
    return Response.json({ error: "translate_failed" }, { status: 502 });
  }
}
