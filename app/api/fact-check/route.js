import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

function isProbablyUrl(text) {
  try {
    const url = new URL(text.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function decodeHtmlEntities(text) {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function stripTags(html) {
  return decodeHtmlEntities(
    html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/\s+/g, " ")
    .replace(/\n\s+\n/g, "\n\n")
    .trim();
}

function extractMeta(html, name) {
  const regexes = [
    new RegExp(
      `<meta[^>]+property=["']${name}["'][^>]+content=["']([^"']+)["'][^>]*>`,
      "i"
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${name}["'][^>]*>`,
      "i"
    ),
    new RegExp(
      `<meta[^>]+name=["']${name}["'][^>]+content=["']([^"']+)["'][^>]*>`,
      "i"
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${name}["'][^>]*>`,
      "i"
    ),
  ];

  for (const regex of regexes) {
    const match = html.match(regex);
    if (match?.[1]) return decodeHtmlEntities(match[1]).trim();
  }

  return "";
}

function cleanHtmlForReading(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<img[^>]*>/gi, " ")
    .replace(/<video[\s\S]*?<\/video>/gi, " ")
    .replace(/<audio[\s\S]*?<\/audio>/gi, " ")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<header[\s\S]*?<\/header>/gi, " ")
    .replace(/<aside[\s\S]*?<\/aside>/gi, " ")
    .replace(/<form[\s\S]*?<\/form>/gi, " ");
}

function extractReadableText(html) {
  const cleaned = cleanHtmlForReading(html);

  const titleMatch = cleaned.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? stripTags(titleMatch[1]) : "";

  const ogTitle = extractMeta(cleaned, "og:title");
  const metaDescription =
    extractMeta(cleaned, "description") ||
    extractMeta(cleaned, "og:description");

  const articleMatch = cleaned.match(/<article[\s\S]*?>([\s\S]*?)<\/article>/i);
  const sourceBlock = articleMatch ? articleMatch[1] : cleaned;

  const paragraphMatches = [...sourceBlock.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)];
  let paragraphs = paragraphMatches
    .map((m) => stripTags(m[1]))
    .filter((p) => p.length > 40);

  if (paragraphs.length < 3) {
    const bodyMatch = cleaned.match(/<body[\s\S]*?>([\s\S]*?)<\/body>/i);
    const bodyHtml = bodyMatch ? bodyMatch[1] : cleaned;
    const fallbackText = stripTags(bodyHtml);
    paragraphs = fallbackText
      .split(/(?<=[.!?])\s+/)
      .filter((s) => s.length > 60)
      .slice(0, 30);
  }

  const articleText = paragraphs.join("\n\n").slice(0, 12000);

  return {
    title: ogTitle || title,
    description: metaDescription,
    articleText,
  };
}

async function fetchArticleContent(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Factisizer/1.0",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.8",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Could not open link (${response.status})`);
    }

    const html = await response.text();
    const extracted = extractReadableText(html);

    if (!extracted.articleText || extracted.articleText.length < 200) {
      throw new Error("Could not extract enough readable article text");
    }

    return extracted;
  } finally {
    clearTimeout(timeout);
  }
}

function detectDirectTextLanguage(text) {
  const sample = (text || "").trim().slice(0, 3000);
  const lower = sample.toLowerCase();

  if (!sample) return "English";

  if (/[\u0590-\u05FF]/.test(sample)) return "Hebrew";
  if (/[\u0900-\u097F]/.test(sample)) {
    const marathiMarkers = [" आहे", " आणि", " नाही", "मध्ये", "वर", "चे", "ची", "चा"];
    const hindiMarkers = [" है", " और", " नहीं", "में", "पर", "के", "की", "का"];

    const countHits = (markers) =>
      markers.reduce((total, marker) => total + (sample.includes(marker) ? 1 : 0), 0);

    const marathiHits = countHits(marathiMarkers);
    const hindiHits = countHits(hindiMarkers);

    if (marathiHits > hindiHits) return "Marathi";
    if (hindiHits > marathiHits) return "Hindi";
    return "Hindi";
  }
  if (/[\u0600-\u06FF]/.test(sample)) return "Arabic";
  if (/[\u0400-\u04FF]/.test(sample)) return "Russian";

  const score = (words) =>
    words.reduce((total, word) => {
      const regex = new RegExp(`\\b${word}\\b`, "g");
      const matches = lower.match(regex);
      return total + (matches ? matches.length : 0);
    }, 0);

  const ranking = [
    ["English", score(["the", "is", "are", "and", "this", "that", "in", "of"])],
    ["Spanish", score(["el", "la", "los", "las", "es", "son", "de", "que", "en"])],
    ["French", score(["le", "la", "les", "est", "une", "un", "de", "que"])],
    ["German", score(["der", "die", "das", "ist", "und", "ein", "eine"])],
    ["Portuguese", score(["o", "a", "os", "as", "é", "são", "de", "que"])],
    ["Italian", score(["il", "lo", "la", "gli", "le", "è", "di", "che"])],
  ].sort((a, b) => b[1] - a[1]);

  if (ranking[0][1] === 0) return "English";
  return ranking[0][0];
}

async function detectArticleLanguageWithAI(textSample) {
  const response = await openai.responses.create({
    model: "gpt-5.1",
    reasoning: { effort: "none" },
    temperature: 0,
    max_output_tokens: 40,
    input: `
Identify the primary language of the following article text.

Rules:
- Return only the language name in English.
- Examples: English, Marathi, Hindi, Hebrew, German, French, Spanish, Arabic, Russian.
- For Devanagari text, distinguish carefully between Marathi and Hindi.
- No explanation. Only one language name.

TEXT:
${textSample.slice(0, 4000)}
    `.trim(),
  });

  const language = (response.output_text || "").trim();
  return language || "English";
}

async function extractMainClaim({ inputIsUrl, originalInput, workingText, targetLanguage }) {
  const response = await openai.responses.create({
    model: "gpt-5.1",
    reasoning: { effort: "none" },
    temperature: 0.1,
    max_output_tokens: 120,
    input: `
You are a precision claim extraction engine.

Your task:
Extract ONE main factual claim for fact-checking and display.

Rules:
- Output language must be exactly ${targetLanguage}
- If direct short claim input is already suitable, clean it and use it
- If article-like content, extract the single most central factual claim
- Maximum 8 to 15 words ideally
- Neutral, simple, declarative
- No clickbait, no emotional tone, no uncertainty words
- Must stand alone without context
- Must be fact-checkable
- If no clear single checkable claim exists, return exactly:
No single checkable claim found in the content.

Return ONLY this format:
Main Claim: <claim>

INPUT TYPE: ${inputIsUrl ? "URL" : "DIRECT_TEXT"}

ORIGINAL INPUT:
${originalInput}

CONTENT:
${workingText}
    `.trim(),
  });

  const text = (response.output_text || "").trim();
  const prefix = "Main Claim:";
  if (text.startsWith(prefix)) {
    return text.slice(prefix.length).trim();
  }
  return text.trim();
}

export async function POST(req) {
  try {
    const { input } = await req.json();

    if (!input || !input.trim()) {
      return Response.json({ error: "No input provided" }, { status: 400 });
    }

    const trimmedInput = input.trim();
    const inputIsUrl = isProbablyUrl(trimmedInput);

    let workingText = trimmedInput;
    let pageTitle = "";
    let pageDescription = "";
    let targetLanguage = "English";

    if (inputIsUrl) {
      const extracted = await fetchArticleContent(trimmedInput);
      pageTitle = extracted.title || "";
      pageDescription = extracted.description || "";
      workingText = `
PAGE TITLE:
${pageTitle}

PAGE DESCRIPTION:
${pageDescription}

ARTICLE BODY:
${extracted.articleText}
      `.trim();

      targetLanguage = await detectArticleLanguageWithAI(
        `${pageTitle}\n${pageDescription}\n${extracted.articleText}`
      );
    } else {
      targetLanguage = detectDirectTextLanguage(trimmedInput);
    }

    const claim = await extractMainClaim({
      inputIsUrl,
      originalInput: trimmedInput,
      workingText,
      targetLanguage,
    });

    const prompt = `
You are Factisizer, a careful multilingual fact-checking assistant.

STRICT RULES:
1. The required output language is: ${targetLanguage}
2. Every field must be entirely written in ${targetLanguage}
3. Do not switch languages
4. Fact-check the MAIN CLAIM below, not the raw URL
5. Explanation must be 90 to 110 words
6. Confidence must be only a number, like 84
7. Sources must be short readable labels, not fake URLs
8. Return only valid JSON. No markdown. No extra commentary
9. Before finalizing, verify that the explanation language is exactly ${targetLanguage}

Return ONLY this exact JSON shape:

{
  "verdict": "TRUE or FALSE or UNVERIFIABLE",
  "explanation": "90-110 words in ${targetLanguage}",
  "confidence": "84",
  "sources": ["source 1", "source 2", "source 3"]
}

MAIN CLAIM:
${claim}

SUPPORTING CONTENT:
${workingText}
    `.trim();

    const response = await openai.responses.create({
      model: "gpt-5.1",
      reasoning: { effort: "none" },
      temperature: 0.1,
      max_output_tokens: 500,
      input: prompt,
    });

    const text = response.output_text;

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      return Response.json(
        { error: "Invalid JSON from AI", raw: text },
        { status: 500 }
      );
    }

    return Response.json({
      claim,
      verdict: parsed.verdict || "UNVERIFIABLE",
      explanation: parsed.explanation || "",
      confidence: String(parsed.confidence || ""),
      sources: Array.isArray(parsed.sources) ? parsed.sources.slice(0, 3) : [],
    });
  } catch (error) {
    return Response.json(
      {
        error: "Server error",
        details: error.message,
      },
      { status: 500 }
    );
  }
}