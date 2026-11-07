import { test } from "node:test";
import assert from "node:assert/strict";

import { apply } from "../lib/index.js";

function routeHarness({ docs = [], filterEvents, remoteAccess, sessionQuery = true } = {}) {
  const routes = [];
  const calls = [];
  const sessionQueryService =
    sessionQuery === false
      ? undefined
      : {
          async filterEvents(sessionId, filters) {
            calls.push({ sessionId, filters });
            if (filterEvents !== undefined) return filterEvents(sessionId, filters);
            return docs;
          },
        };
  const scope = {
    get(name) {
      if (name === "connection") {
        return {
          fetch: {
            register(options) {
              routes.push(options);
              return () => {};
            },
          },
        };
      }
      if (name === "sessionQuery") return sessionQueryService;
      if (name === "remoteAccess") return remoteAccess;
      return undefined;
    },
    effect(fn) {
      return fn();
    },
  };
  apply({
    inject(deps, callback) {
      callback(scope);
      return () => {};
    },
  });
  assert.equal(routes.length, 1);
  assert.equal(routes[0].path, "/api/dsh-find/search");
  assert.deepEqual(routes[0].methods, ["POST"]);
  return { handler: routes[0].fetch, calls };
}

function request(body) {
  return new Request("http://127.0.0.1/api/dsh-find/search", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

test("search route returns shaped items and uses the current-surface text filter", async () => {
  const docs = [
    { seq: 7, type: "assistant/message", time: 3, surface: "current", text: "the needle is here" },
    { seq: 6, type: "user/message", time: 2, surface: "current", text: "find the needle" },
  ];
  const { handler, calls } = routeHarness({ docs });
  const response = await handler(request({ sessionId: "session-1", query: "needle" }));
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.ok, true);
  assert.deepEqual(payload.value.items.map((item) => item.seq), [7, 6]);
  assert.equal(payload.value.items[0].type, "assistant");
  assert.equal(payload.value.items[1].type, "user");
  assert.equal(payload.value.hasMore, false);
  assert.deepEqual(calls[0].filters, [
    { kind: "text", text: "needle" },
    { kind: "surface", values: ["current"] },
    { kind: "type", values: ["user/message", "assistant/message"] },
  ]);
});

test("search route rejects malformed bodies and queries", async () => {
  const { handler } = routeHarness();
  const bad = await handler(request("{"));
  assert.equal(bad.status, 400);
  assert.equal((await bad.json()).error.code, "dsh-find/bad-request");

  const missing = await handler(request({ query: "x" }));
  assert.equal(missing.status, 400);

  const empty = await handler(request({ sessionId: "s", query: "   " }));
  assert.equal(empty.status, 400);

  const long = await handler(request({ sessionId: "s", query: "x".repeat(201) }));
  assert.equal(long.status, 400);
});

test("search route refuses inaccessible sessions", async () => {
  const { handler, calls } = routeHarness({
    remoteAccess: { allows: () => false },
  });
  const response = await handler(request({ sessionId: "session-1", query: "needle" }));
  assert.equal(response.status, 403);
  assert.equal(calls.length, 0);
});

test("search route reports an unavailable session-query service", async () => {
  const { handler } = routeHarness({ sessionQuery: false });
  const response = await handler(request({ sessionId: "session-1", query: "needle" }));
  assert.equal(response.status, 501);
  assert.equal((await response.json()).error.code, "dsh-find/unavailable");
});

test("search route maps service failures to an internal error", async () => {
  const { handler } = routeHarness({
    filterEvents() {
      throw new Error("boom");
    },
  });
  const response = await handler(request({ sessionId: "session-1", query: "needle" }));
  assert.equal(response.status, 500);
  const payload = await response.json();
  assert.equal(payload.ok, false);
  assert.equal(payload.error.code, "dsh-find/internal");
  assert.equal(payload.error.message, "boom");
});
