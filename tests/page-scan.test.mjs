/**
 * Offset-mapping tests for the in-page hit scanner.
 *
 * The scanner turns one concatenated block of text back into DOM ranges; that
 * mapping is where an inline `<strong>`/link/code split can silently drop a
 * hit, so it is tested against a fake document here. Everything that needs a
 * real transcript is verified in the running client instead.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

function loadBundle() {
  const path = fileURLToPath(new URL("../lib/client.js", import.meta.url));
  const source = readFileSync(path, "utf8");
  const fakeRequire = (id) => {
    if (id === "react") {
      return {
        createElement: () => null,
        Fragment: function Fragment() {},
        useState: () => [false, () => {}],
        useRef: () => ({ current: null }),
        useEffect: () => {},
        useCallback: (fn) => fn,
        useSyncExternalStore: () => ({}),
      };
    }
    if (id === "react-dom") return { createPortal: () => null };
    if (id === "@deepseek-ai/dsh-client-ui-primitives") return new Proxy({}, { get: () => () => null });
    throw new Error("unexpected require: " + id);
  };
  let captured;
  const windowStub = {
    localStorage: { getItem: () => null, setItem: () => {} },
    __ModuleLoader__: {
      load: ({ factory }) => {
        captured = factory(fakeRequire);
      },
    },
  };
  new Function("window", source)(windowStub);
  return captured.__test;
}

function installFakeDocument() {
  const created = [];
  globalThis.document = {
    createRange() {
      const range = {
        start: null,
        end: null,
        setStart(node, offset) {
          this.start = { node, offset };
        },
        setEnd(node, offset) {
          this.end = { node, offset };
        },
      };
      created.push(range);
      return range;
    },
  };
  return created;
}

const { pointAt, groupRanges, indexOfSeq, queryPattern } = loadBundle();

function entryOf(chunks) {
  const parts = [];
  let text = "";
  for (const chunk of chunks) {
    const node = { nodeValue: chunk };
    parts.push({ node, start: text.length, length: chunk.length });
    text += chunk;
  }
  return { text, parts };
}

test("pointAt maps an offset to the owning text node", () => {
  const entry = entryOf(["先核", "医保", "结算清单"]);
  const at = (offset) => {
    const point = pointAt(entry.parts, offset);
    return [point.node.nodeValue, point.offset];
  };
  assert.deepEqual(at(0), ["先核", 0]);
  assert.deepEqual(at(1), ["先核", 1]);
  assert.deepEqual(at(2), ["先核", 2]);
  assert.deepEqual(at(4), ["医保", 2]);
  assert.deepEqual(at(999), ["结算清单", 4]);
});

test("a hit inside one text node maps to a single node range", () => {
  const created = installFakeDocument();
  const entry = entryOf(["先核", "医保", "结算清单"]);
  const ranges = groupRanges(entry, new RegExp(queryPattern("医保"), "gi"));
  assert.equal(ranges.length, 1);
  assert.deepEqual([ranges[0].start.node.nodeValue, ranges[0].start.offset], ["先核", 2]);
  assert.deepEqual([ranges[0].end.node.nodeValue, ranges[0].end.offset], ["医保", 2]);
  assert.equal(created.length, 1);
});

test("a hit split by inline markup spans both text nodes", () => {
  installFakeDocument();
  const entry = entryOf(["关键", "词", "高亮"]);
  const ranges = groupRanges(entry, new RegExp(queryPattern("关键词"), "gi"));
  assert.equal(ranges.length, 1);
  assert.deepEqual(ranges[0].start, { node: entry.parts[0].node, offset: 0 });
  assert.deepEqual(ranges[0].end, { node: entry.parts[1].node, offset: 1 });
});

test("whitespace in the query matches across a text-node boundary", () => {
  installFakeDocument();
  const entry = entryOf(["医保", " ", "对账"]);
  const ranges = groupRanges(entry, new RegExp(queryPattern("医保 对账"), "gi"));
  assert.equal(ranges.length, 1);
  assert.equal(ranges[0].start.offset, 0);
  assert.equal(ranges[0].end.offset, 2);
});

test("every occurrence in a block is returned in order", () => {
  installFakeDocument();
  const entry = entryOf(["医保退费、", "医保", "结算"]);
  const ranges = groupRanges(entry, new RegExp(queryPattern("医保"), "gi"));
  assert.equal(ranges.length, 2);
  assert.equal(ranges[0].start.offset, 0);
  assert.equal(ranges[1].start.offset, 5);
});

test("indexOfSeq finds the first hit of a message", () => {
  const hits = [
    { seq: 3, range: null },
    { seq: 3, range: null },
    { seq: 8, range: null },
  ];
  assert.equal(indexOfSeq(hits, 3), 0);
  assert.equal(indexOfSeq(hits, 8), 2);
  assert.equal(indexOfSeq(hits, 9), -1);
});
