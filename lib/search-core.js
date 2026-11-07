/**
 * Pure search shaping shared by the host route and its tests.
 *
 * The host session-query service already applies the literal, case-insensitive,
 * whitespace-flexible event filter and the current-surface restriction; this
 * module only turns matching semantic documents into bounded, display-ready
 * snippets.
 */

const MAX_QUERY = 200;
const DEFAULT_LIMIT = 100;
const DEFAULT_SNIPPET = 160;

/** Trim and validate a user query. @returns the query, or null when unusable. */
export function normalizeQuery(value, max = MAX_QUERY) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > max) return null;
  return trimmed;
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Compile the same whitespace-flexible literal match the host filter uses. */
export function compileQueryPattern(query) {
  const parts = query.trim().split(/\s+/).map(escapeRegExp);
  return new RegExp(parts.join("\\s+"), "i");
}

/**
 * Build a one-line snippet with the first match kept near the middle.
 * @param text - semantic event text (may contain newlines).
 * @param query - literal query.
 * @param max - maximum snippet length.
 * @returns display snippet with ellipses at cut edges.
 */
export function buildSnippet(text, query, max = DEFAULT_SNIPPET) {
  const source = String(text ?? "").replace(/\s+/g, " ").trim();
  if (source.length === 0) return "";
  if (source.length <= max) return source;

  let index = -1;
  let matchLength = 0;
  try {
    const match = compileQueryPattern(query).exec(source);
    if (match !== null) {
      index = match.index;
      matchLength = match[0].length;
    }
  } catch {
    index = -1;
  }

  if (index < 0) return source.slice(0, max) + "…";

  const before = Math.max(0, Math.floor((max - Math.min(matchLength, max)) / 3));
  let start = Math.max(0, index - before);
  let end = Math.min(source.length, start + max);
  if (end === source.length) start = Math.max(0, end - max);

  const prefix = start > 0 ? "…" : "";
  const suffix = end < source.length ? "…" : "";
  return prefix + source.slice(start, end).trim() + suffix;
}

/**
 * Shape host filter results.
 * @param docs - documents returned by `sessionQuery.filterEvents`.
 * @param query - validated literal query.
 * @param limit - maximum returned results.
 * @param snippetChars - snippet budget.
 * @returns `{ items, hasMore }`, ascending by seq.
 */
export function buildSearchResponse(docs, query, limit = DEFAULT_LIMIT, snippetChars = DEFAULT_SNIPPET) {
  const cappedLimit = Math.max(1, Math.min(DEFAULT_LIMIT, Number.isFinite(limit) ? Math.floor(limit) : DEFAULT_LIMIT));
  const items = [];
  let hasMore = false;

  for (const doc of Array.isArray(docs) ? docs : []) {
    if (doc === null || typeof doc !== "object") continue;
    if (typeof doc.seq !== "number" || !Number.isFinite(doc.seq)) continue;
    if (doc.type !== "user/message" && doc.type !== "assistant/message") continue;
    if (doc.surface !== undefined && doc.surface !== "current") continue;
    const text = typeof doc.text === "string" ? doc.text : "";
    if (text.trim().length === 0) continue;
    if (items.length >= cappedLimit) {
      hasMore = true;
      break;
    }
    items.push({
      seq: doc.seq,
      type: doc.type === "user/message" ? "user" : "assistant",
      time: typeof doc.time === "number" && Number.isFinite(doc.time) ? doc.time : 0,
      snippet: buildSnippet(text, query, snippetChars),
    });
  }

  return { items, hasMore };
}
