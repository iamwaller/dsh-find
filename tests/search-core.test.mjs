import { test } from "node:test";
import assert from "node:assert/strict";

import { buildSearchResponse, buildSnippet, normalizeQuery, compileQueryPattern } from "../lib/search-core.js";

test("normalizeQuery trims and bounds the query", () => {
  assert.equal(normalizeQuery("  hello  "), "hello");
  assert.equal(normalizeQuery("   "), null);
  assert.equal(normalizeQuery(""), null);
  assert.equal(normalizeQuery(42), null);
  assert.equal(normalizeQuery("x".repeat(201)), null);
  assert.equal(normalizeQuery("x".repeat(200)), "x".repeat(200));
});

test("query pattern is literal, case-insensitive and whitespace-flexible", () => {
  const pattern = compileQueryPattern("a.b   c");
  assert.equal(pattern.test("A.B\nC"), true);
  assert.equal(pattern.test("axb c"), false);
});

test("short snippets are returned as a single flat line", () => {
  assert.equal(buildSnippet("hello   world\nnext", "wor"), "hello world next");
  assert.equal(buildSnippet("", "x"), "");
});

test("long snippets keep the match near the middle with ellipses", () => {
  const text = "a".repeat(400) + " needle " + "b".repeat(400);
  const snippet = buildSnippet(text, "needle", 120);
  assert.ok(snippet.includes("needle"));
  assert.ok(snippet.startsWith("…"));
  assert.ok(snippet.endsWith("…"));
  assert.ok(snippet.length <= 122);
});

test("long snippets without a match truncate from the start", () => {
  const snippet = buildSnippet("a".repeat(300), "zzz", 80);
  assert.equal(snippet, "a".repeat(80) + "…");
});

test("search response keeps current user/assistant messages and caps results", () => {
  const docs = [
    { seq: 5, type: "assistant/message", time: 2, surface: "current", text: "the needle is here" },
    { seq: 3, type: "tool/result", time: 1, surface: "current", text: "needle in a tool result" },
    { seq: 4, type: "user/message", time: 1, surface: "current", text: "needle in a prompt" },
    { seq: 6, type: "assistant/message", time: 3, surface: "shadowed", text: "stale needle" },
  ];
  const result = buildSearchResponse(docs, "needle", 10, 80);
  assert.equal(result.hasMore, false);
  assert.deepEqual(
    result.items.map((item) => [item.seq, item.type]),
    [
      [5, "assistant"],
      [4, "user"],
    ],
  );
  assert.equal(result.items[0].snippet, "the needle is here");
});

test("search response reports truncation above the cap", () => {
  const docs = Array.from({ length: 5 }, (_, index) => ({
    seq: index + 1,
    type: "user/message",
    time: index,
    surface: "current",
    text: "needle " + index,
  }));
  const result = buildSearchResponse(docs, "needle", 2, 80);
  assert.equal(result.items.length, 2);
  assert.equal(result.hasMore, true);
  assert.deepEqual(
    result.items.map((item) => item.seq),
    [1, 2],
  );
});

test("search response tolerates malformed documents", () => {
  const result = buildSearchResponse([null, {}, { seq: "x", type: "user/message", text: "needle" }], "needle");
  assert.deepEqual(result, { items: [], hasMore: false });
  assert.deepEqual(buildSearchResponse(null, "x"), { items: [], hasMore: false });
});
