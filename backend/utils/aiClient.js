const API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent';

/**
 * Thin wrapper around the Google Gemini API (vision-capable).
 * The API key is read from process.env ONLY, on the server, and is never
 * forwarded to or readable by the client.
 *
 * `messages` uses a unified content blocks format — callers in routes/*.js pass
 * { type: 'text', text } and { type: 'image', source: { media_type, data } } blocks,
 * which we translate to Google Gemini's `_inline_data` / `text` shape below.
 */
async function callAI({ system, messages, maxTokens = 1024 }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    const err = new Error('Server is not configured with an AI API key.');
    err.status = 500;
    throw err;
  }

  // Build Gemini content array: system message + user content
  const geminiContents = messages.map(m => {
    if (typeof m.content === 'string') {
      return {
        role: m.role === 'system' ? 'user' : m.role,
        parts: [{ text: m.content }],
      };
    }
    
    const parts = m.content.map(block => {
      if (block.type === 'text') {
        return { text: block.text };
      }
      if (block.type === 'image') {
        return {
          inlineData: {
            mimeType: block.source.media_type,
            data: block.source.data,
          },
        };
      }
      return null;
    }).filter(Boolean);
    
    return {
      role: m.role === 'system' ? 'user' : m.role,
      parts,
    };
  });

  // Prepend system message as first user message if it exists
  if (system) {
    geminiContents.unshift({
      role: 'user',
      parts: [{ text: system }],
    });
  }

  const res = await fetch(`${API_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      contents: geminiContents,
      generationConfig: {
        maxOutputTokens: maxTokens,
        temperature: 0.7,
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const err = new Error(`AI provider error (${res.status}): ${text.slice(0, 300)}`);
    err.status = 502;
    throw err;
  }

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

// Kept as an alias so route files (and any external code) can call either
// name — `callClaude` was the original name used throughout routes/*.js.
const callClaude = callAI;

/** Strip markdown code fences the model sometimes wraps JSON in. */
function extractJson(raw) {
  const cleaned = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
  const start = cleaned.indexOf('[') === -1 ? cleaned.indexOf('{') : Math.min(...[cleaned.indexOf('['), cleaned.indexOf('{')].filter(i => i !== -1));
  try {
    return JSON.parse(cleaned);
  } catch {
    // Fallback: try to locate the first JSON-looking span
    const match = cleaned.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
    if (match) return JSON.parse(match[0]);
    throw new Error('Model did not return parseable JSON.');
  }
}

module.exports = { callClaude, extractJson };
