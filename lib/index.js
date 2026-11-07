/**
 * dsh-find — host half.
 *
 * Registers one POST route that scans the complete session log through the
 * host `sessionQuery` service. `filterEvents` works without the SQLite FTS
 * index (the shipped profile mounts the query backend with `openAt: never`),
 * so the feature needs no settings or storage change.
 */
import { buildSearchResponse, normalizeQuery } from "./search-core.js";

export const name = "dsh-find";
export const inject = ["connection"];

const ROUTE = "/api/dsh-find/search";
const MAX_QUERY_LENGTH = 200;
const MAX_RESULTS = 100;

function json(body, status = 200) {
  return Response.json(body, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

function fail(code, message, status = 400) {
  return json({ ok: false, error: { code, message } }, status);
}

/**
 * Scan one session's semantic documents for a literal query.
 * @param context - host plugin context with `sessionQuery` available.
 * @param request - buffered request.
 * @returns a JSON `Response`.
 */
async function handleSearch(context, request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return fail("dsh-find/bad-request", "body is not JSON");
  }

  const sessionId = typeof body?.sessionId === "string" ? body.sessionId : "";
  if (sessionId === "") return fail("dsh-find/bad-request", "missing sessionId");

  const query = normalizeQuery(body?.query, MAX_QUERY_LENGTH);
  if (query === null) {
    return fail("dsh-find/bad-request", "query must be 1-" + MAX_QUERY_LENGTH + " characters");
  }

  const remoteAccess = context.get("remoteAccess");
  if (remoteAccess !== undefined && typeof remoteAccess.allows === "function") {
    try {
      if (!remoteAccess.allows({ kind: "session", id: sessionId })) {
        return fail("dsh-find/forbidden", "session is not accessible", 403);
      }
    } catch {
      /* an access probe that cannot answer must not break local search */
    }
  }

  const sessionQuery = context.get("sessionQuery");
  if (sessionQuery === undefined || typeof sessionQuery.filterEvents !== "function") {
    return fail("dsh-find/unavailable", "session query service is unavailable", 501);
  }

  try {
    const docs = await sessionQuery.filterEvents(sessionId, [
      { kind: "text", text: query },
      { kind: "surface", values: ["current"] },
      { kind: "type", values: ["user/message", "assistant/message"] },
    ]);
    const result = buildSearchResponse(docs, query, MAX_RESULTS, 160);
    return json({ ok: true, value: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return fail("dsh-find/internal", message, 500);
  }
}

/**
 * Client plugin body.
 * @param ctx - host context (connection is required).
 */
export function apply(ctx) {
  ctx.inject(["connection"], (scope) => {
    const connection = scope.get("connection");
    const register = connection?.fetch?.register;
    if (typeof register !== "function") return;

    scope.effect(
      () =>
        register.call(connection.fetch, {
          path: ROUTE,
          methods: ["POST"],
          requestBody: "buffered",
          fetch: (request) => handleSearch(scope, request),
        }),
      "dsh-find: search route",
    );
  });
}
