import { getAppMetadata, formatMetadataForLLM } from "./scraper.js";
import { formatPrompt } from "./prompts.js";
import { t } from "./i18n.js";

const MAX_REFERENCE_CHARS = 40000;
const FIELD_ORDER = ["title", "subtitle", "keywords", "description"];

let cachedReference = null;

async function loadReference() {
  if (cachedReference !== null) return cachedReference;
  try {
    const resp = await fetch("./aso-reference.txt");
    if (!resp.ok) throw new Error(`reference fetch ${resp.status}`);
    const text = await resp.text();
    cachedReference = text.slice(0, MAX_REFERENCE_CHARS);
  } catch (err) {
    console.warn("[chain] ASO reference load failed", err);
    cachedReference = "";
  }
  return cachedReference;
}

function emptyField() {
  return { original: "", reason: "", recommended: "" };
}

function normalizeASOResult(parsed, metadata) {
  const authoritative = {
    title: metadata.title || "",
    subtitle: metadata.subtitle || "",
    description: metadata.description || "",
  };
  const result = {};
  for (const key of FIELD_ORDER) {
    const raw = parsed && typeof parsed === "object" ? parsed[key] : null;
    if (raw && typeof raw === "object") {
      result[key] = {
        original: String(raw.original || ""),
        reason: String(raw.reason || ""),
        recommended: String(raw.recommended || ""),
      };
    } else {
      result[key] = emptyField();
    }
    if (authoritative[key]) {
      result[key].original = authoritative[key];
    }
  }
  result.app_info = {
    title: metadata.title || "",
    subtitle: metadata.subtitle || "",
    developer: metadata.developer || "",
    category: metadata.category || "",
    rating: metadata.rating || 0,
    rating_count: metadata.rating_count || 0,
  };
  return result;
}

function extractJSON(text) {
  let t = text.trim();
  if (t.startsWith("```")) {
    t = t.replace(/^```[a-zA-Z]*\n?/, "").replace(/```$/, "").trim();
  }
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start === -1 || end === -1) {
    throw new Error("No JSON object found in LLM output");
  }
  return JSON.parse(t.slice(start, end + 1));
}

export async function runASOChain({
  url,
  locale,
  config,
  onEvent,
}) {
  // Step 1: fetch metadata
  onEvent({
    step: 1,
    name: "fetch_app_info",
    status: "start",
    label: t(locale, "step1"),
  });

  let metadata;
  try {
    metadata = await getAppMetadata(url, config.proxy || "");
  } catch (err) {
    console.error("[chain] metadata failed", err);
    onEvent({ step: 1, content: `Error: ${err.message || err}` });
    onEvent({ step: 1, status: "done" });
    throw new Error(t(locale, "fetchFail"));
  }

  const appInfoText = formatMetadataForLLM(metadata);
  const summary = t(locale, "fetchSummary")
    .replace("{title}", metadata.title || "—")
    .replace("{subtitle}", metadata.subtitle || "—")
    .replace("{developer}", metadata.developer || "—")
    .replace("{category}", metadata.category || "—");

  onEvent({ step: 1, content: summary });
  onEvent({ step: 1, status: "done" });

  // Step 2: LLM
  onEvent({
    step: 2,
    name: "aso_optimization",
    status: "start",
    label: t(locale, "step2"),
  });

  const reference = await loadReference();
  const prompt = formatPrompt(locale, reference, appInfoText);

  const body = {
    model: config.model,
    stream: true,
    max_tokens: 8000,
    temperature: 0.6,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: "You are a senior ASO consultant. Return JSON only.",
      },
      { role: "user", content: prompt },
    ],
    reasoning: { enabled: true },
  };

  let resp;
  try {
    resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
        "HTTP-Referer": location.origin,
        "X-Title": "TopStore Static",
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    onEvent({ step: 2, content: `Error: ${err.message || err}` });
    onEvent({ step: 2, status: "done" });
    throw new Error(t(locale, "llmFail") + (err.message || err));
  }

  if (!resp.ok || !resp.body) {
    const msg = await resp.text().catch(() => `${resp.status}`);
    onEvent({ step: 2, content: `Error: ${resp.status} ${msg}` });
    onEvent({ step: 2, status: "done" });
    throw new Error(t(locale, "llmFail") + `${resp.status} ${msg}`);
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let rawOutput = "";
  let reasoningStarted = false;
  const emittedMarkers = new Set();

  const FIELD_MARKER_KEYS = {
    title: "fieldMarkerTitle",
    subtitle: "fieldMarkerSubtitle",
    keywords: "fieldMarkerKeywords",
    description: "fieldMarkerDescription",
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;

      let parsed;
      try {
        parsed = JSON.parse(payload);
      } catch {
        continue;
      }
      const choice = parsed.choices && parsed.choices[0];
      if (!choice) continue;
      const delta = choice.delta || {};

      const reasoning = delta.reasoning;
      if (reasoning) {
        if (!reasoningStarted) {
          onEvent({ step: 2, content: t(locale, "reasoningHeader") });
          reasoningStarted = true;
        }
        onEvent({ step: 2, content: reasoning });
      }

      if (delta.content) {
        rawOutput += delta.content;
        for (const field of FIELD_ORDER) {
          if (emittedMarkers.has(field)) continue;
          if (rawOutput.includes(`"${field}"`)) {
            onEvent({
              step: 2,
              content: t(locale, FIELD_MARKER_KEYS[field]),
            });
            emittedMarkers.add(field);
          }
        }
      }
    }
  }

  let parsedJSON;
  try {
    parsedJSON = extractJSON(rawOutput);
  } catch (err) {
    console.error("[chain] JSON parse failed", err, rawOutput.slice(0, 500));
    onEvent({ step: 2, content: "Error: invalid optimization output." });
    onEvent({ step: 2, status: "done" });
    throw new Error(t(locale, "parseFail"));
  }

  const asoResult = normalizeASOResult(parsedJSON, metadata);
  onEvent({ step: 2, status: "done" });
  onEvent({ aso_result: asoResult });
  return asoResult;
}
