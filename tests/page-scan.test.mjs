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

const { pointAt, groupRanges, snippetTokens, snippetProbe, textMatchesProbe, queryPattern } = loadBundle();

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

test("snippetTokens ignores markdown that the rendered node no longer has", () => {
  const tokens = snippetTokens("…或 `conversation-find`。\\n- 关闭该行后，该行的插件都会卸载");
  assert.ok(tokens.includes("conversation"));
  assert.ok(tokens.includes("关闭该行后"));
  assert.ok(tokens.every((token) => token.length >= 2));
  assert.ok(!tokens.some((token) => token.includes("`")));
});

test("snippetProbe keeps a short, distinctive head", () => {
  assert.equal(snippetProbe("…"), null);
  assert.equal(snippetProbe(null), null);
  const probe = snippetProbe("卸载 之后 该行 的 插件 都会 卸载 对应的 配置页 也会 消失");
  assert.ok(probe.length <= 8);
  assert.equal(probe[0], "卸载");
  const long = snippetProbe("甲".repeat(40));
  assert.deepEqual(long, ["甲".repeat(40)]);
});

test("textMatchesProbe survives the markdown/HTML gap", () => {
  const snippet = "…```powershell\ncd D:\\lightwork\\dsh-test\\dsh-plugins\nnode deploy.mjs --dry-run\n```";
  const probe = snippetProbe(snippet);
  const rendered = "cd D:\\lightwork\\dsh-test\\dsh-plugins node deploy.mjs --dry-run 查看将写入的内容";
  assert.equal(textMatchesProbe(rendered, probe), true);
  const unrelated = "这段消息讲的是医保对账和单边账退费，与部署脚本无关";
  assert.equal(textMatchesProbe(unrelated, probe), false);
});
