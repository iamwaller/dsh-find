/**
 * dsh-find — browser half.
 *
 * One entry point into the find bar: a session-header icon button, plus the
 * `find.inConversation` shortcut (Ctrl/Cmd+F on desktop, Ctrl/Cmd+Alt+F on the
 * web). The bar always searches the complete session through the host
 * `sessionQuery.filterEvents` route; clicking a result loads the matching seq
 * into the chat window and scrolls to it.
 */
window.__ModuleLoader__.load({
  id: "dsh-find",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;

    const React = require("react");
    const ReactDOM = require("react-dom");
    const primitives = require("@deepseek-ai/dsh-client-ui-primitives");
    const h = React.createElement;
    const { useState, useRef, useEffect, useSyncExternalStore, useCallback } = React;

    const NS = "dsh-find";
    const STYLE_ID = "dsh-find/styles";
    const API_PATH = "api/dsh-find/search";

    // ---------------------------------------------------------------- locale
    const zh = {
      "find.open": "在对话中查找",
      "find.placeholder": "查找整个会话…",
      "find.close": "关闭",
      "find.matches": "条结果",
      "find.noMatches": "没有匹配",
      "find.searching": "搜索中…",
      "find.error": "搜索失败",
      "find.unavailable": "完整会话搜索不可用（宿主插件未启用）",
      "find.noSession": "没有可搜索的会话",
      "find.notFound": "已加载该轮次，但未能定位到消息",
      "find.user": "用户",
      "find.assistant": "助手",
      "find.more": "仅显示前 {count} 条",
      "find.hint": "搜索整个会话；回车跳到下一处，Shift+回车上一处",
    };
    const en = {
      "find.open": "Find in conversation",
      "find.placeholder": "Search the whole session…",
      "find.close": "Close",
      "find.matches": "results",
      "find.noMatches": "No matches",
      "find.searching": "Searching…",
      "find.error": "Search failed",
      "find.unavailable": "Whole-session search is unavailable (host plugin not loaded)",
      "find.noSession": "No searchable session",
      "find.notFound": "The turn loaded, but the message could not be located",
      "find.user": "User",
      "find.assistant": "Assistant",
      "find.more": "Showing the first {count}",
      "find.hint": "Searches the whole session; Enter for the next hit, Shift+Enter for the previous",
    };

    // ----------------------------------------------------------------- styles
    const STYLE_TEXT = [
      ".dshfind_panel{position:fixed;top:56px;right:20px;z-index:1200;box-sizing:border-box;width:440px;max-width:calc(100vw - 24px);border-radius:var(--dsw-radius-lg);background:var(--dsw-specific-menu);backdrop-filter:var(--dsw-menu-backdrop-filter);box-shadow:var(--dsw-elevation-prominent);border:.5px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-secondary);font-size:13px;line-height:20px;padding:10px;display:flex;flex-direction:column;gap:8px}",
      ".dshfind_row{display:flex;align-items:center;gap:4px}",
      ".dshfind_input{box-sizing:border-box;flex:1;min-width:0;border:0;outline:0;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;padding:2px 4px}",
      ".dshfind_count{color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums;white-space:nowrap;font-size:12px}",
      ".dshfind_iconBtn{box-sizing:border-box;border:0;border-radius:var(--dsw-radius-sm);background:0 0;color:var(--dsw-alias-label-tertiary);width:26px;height:26px;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;flex:none}",
      ".dshfind_iconBtn:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-secondary)}",
      ".dshfind_iconBtn[disabled]{opacity:.4;cursor:default}",
      ".dshfind_hint{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px}",
      ".dshfind_status{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px}",
      ".dshfind_status[data-tone=error]{color:var(--dsw-alias-state-error-primary,#f2a1a1)}",
      ".dshfind_results{max-height:300px;overflow:auto;display:flex;flex-direction:column;gap:2px;--dsh-scrollbar-thumb:var(--dsw-alias-scrollbar-bg-l2);--dsh-scrollbar-thumb-hover:var(--dsw-alias-scrollbar-hover-l2)}",
      ".dshfind_result{box-sizing:border-box;width:100%;border:0;border-radius:var(--dsw-radius-sm);background:0 0;color:var(--dsw-alias-label-secondary);font:inherit;text-align:left;padding:6px 8px;cursor:pointer;display:flex;flex-direction:column;gap:2px}",
      ".dshfind_result:hover{background:var(--dsw-alias-interactive-bg-hover)}",
      ".dshfind_result[data-active=true]{background:var(--dsw-alias-interactive-bg-hover)}",
      ".dshfind_resultMeta{display:flex;align-items:center;gap:8px;color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px}",
      ".dshfind_badge{border-radius:999px;border:.5px solid var(--dsw-alias-border-l2);padding:0 6px;font-size:10px;line-height:15px}",
      ".dshfind_snippet{overflow-wrap:anywhere;font-size:12px;line-height:18px}",
      ".dshfind_snippet mark{background:rgba(255,196,0,.35);color:inherit;border-radius:2px}",
      ".dshfind_empty{color:var(--dsw-alias-label-tertiary);font-size:12px;padding:4px 2px}",
      ".dshfind_footer{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px}",
      ".dshfind_flash{outline:2px solid var(--dsw-alias-label-accent,#6aa9ff);outline-offset:2px;border-radius:var(--dsw-radius-sm)}",
      ".dshfind_headerBtn{flex:none}",
      "::highlight(dshfind-hit){background-color:rgba(255,196,0,.32);color:inherit}",
      "::highlight(dshfind-current){background-color:#fac775;color:#241a00}",
    ].join("");

    function injectStyles() {
      if (typeof document === "undefined") return;
      if (document.querySelector('style[data-plugin-css="' + STYLE_ID + '"]') !== null) return;
      const tag = document.createElement("style");
      tag.dataset.plugin = "dsh-find";
      tag.dataset.pluginCss = STYLE_ID;
      tag.textContent = STYLE_TEXT;
      document.head.appendChild(tag);
    }

    // ------------------------------------------------------------------ utils
    function escapeRegExp(text) {
      return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }
    function queryPattern(query) {
      return query
        .trim()
        .split(/\s+/)
        .map(escapeRegExp)
        .join("\\s+");
    }
    function formatClock(time) {
      if (typeof time !== "number" || !Number.isFinite(time) || time <= 0) return "";
      try {
        return new Date(time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      } catch {
        return "";
      }
    }
    function cssEscape(value) {
      const registry = globalThis.CSS;
      if (registry !== undefined && typeof registry.escape === "function") return registry.escape(String(value));
      return String(value).replace(/["\\]/g, "\\$&");
    }

    // -------------------------------------------------------------- page scan
    // The host route only knows which messages matched. Everything below turns
    // that message-level answer into per-occurrence positions inside the chat
    // transcript, so Enter can walk hit by hit and the current hit can be
    // painted without touching the React-owned DOM (CSS Custom Highlight API).
    const GROUP_SELECTOR = "p,li,td,th,h1,h2,h3,h4,h5,h6,pre,blockquote,dd,dt,figcaption,summary";
    const SKIP_SELECTOR = "script,style,textarea,noscript,[data-dsh-find-ui],[hidden]";
    const HIT_NAME = "dshfind-hit";
    const CURRENT_NAME = "dshfind-current";
    const MAX_PAINTED = 4000;

    function nextFrame() {
      return new Promise((resolve) => {
        let settled = false;
        const finish = () => {
          if (settled) return;
          settled = true;
          resolve();
        };
        if (typeof requestAnimationFrame === "function") requestAnimationFrame(() => requestAnimationFrame(finish));
        setTimeout(finish, 250);
      });
    }

    function highlightRegistry() {
      const css = globalThis.CSS;
      if (css === undefined || css === null || css.highlights === undefined || css.highlights === null) return null;
      if (typeof globalThis.Highlight !== "function") return null;
      return css.highlights;
    }

    function clearPageHighlights() {
      const registry = highlightRegistry();
      if (registry === null) return;
      try {
        registry.delete(HIT_NAME);
        registry.delete(CURRENT_NAME);
      } catch {
        /* a stale registry must not break the bar */
      }
    }

    function paintPageHighlights(ranges, current) {
      const registry = highlightRegistry();
      if (registry === null) return false;
      try {
        if (ranges.length === 0 && current === null) {
          clearPageHighlights();
          return true;
        }
        registry.set(HIT_NAME, new Highlight(...ranges.slice(0, MAX_PAINTED)));
        if (current === null) registry.delete(CURRENT_NAME);
        else registry.set(CURRENT_NAME, new Highlight(current));
        return true;
      } catch {
        return false;
      }
    }

    /**
     * Collect the visible text of one message node, grouped by block so a match
     * can still be found when inline markup (`<strong>`, links, code) splits it.
     */
    function collectTextGroups(root) {
      const groups = new Map();
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          const parent = node.parentElement;
          if (parent === null || parent.closest(SKIP_SELECTOR) !== null) return NodeFilter.FILTER_REJECT;
          if (node.nodeValue === null || node.nodeValue.length === 0) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        },
      });
      let node = walker.nextNode();
      while (node !== null) {
        const group = node.parentElement.closest(GROUP_SELECTOR) ?? node.parentElement;
        let entry = groups.get(group);
        if (entry === undefined) {
          entry = { text: "", parts: [] };
          groups.set(group, entry);
        }
        entry.parts.push({ node, start: entry.text.length, length: node.nodeValue.length });
        entry.text += node.nodeValue;
        node = walker.nextNode();
      }
      return groups;
    }

    /** Map a concatenated-text offset back to a live DOM point. */
    function pointAt(parts, offset) {
      for (const part of parts) {
        if (offset <= part.start + part.length) return { node: part.node, offset: offset - part.start };
      }
      const last = parts[parts.length - 1];
      return { node: last.node, offset: last.length };
    }

    function groupRanges(entry, pattern) {
      const ranges = [];
      pattern.lastIndex = 0;
      let match = pattern.exec(entry.text);
      while (match !== null) {
        const width = match[0].length;
        if (width === 0) {
          pattern.lastIndex += 1;
        } else {
          const start = pointAt(entry.parts, match.index);
          const end = pointAt(entry.parts, match.index + width);
          if (start.node !== end.node || start.offset !== end.offset) {
            try {
              const range = document.createRange();
              range.setStart(start.node, Math.min(start.offset, start.node.nodeValue.length));
              range.setEnd(end.node, Math.min(end.offset, end.node.nodeValue.length));
              ranges.push(range);
            } catch {
              /* a range that cannot be built is simply not painted */
            }
          }
        }
        match = pattern.exec(entry.text);
        if (ranges.length >= MAX_PAINTED) break;
      }
      return ranges;
    }

    /**
     * Scan every rendered message node for the query.
     * @returns occurrences in document order: `{ seq, range, element }`.
     */
    function scanPage(query, seqForKey) {
      const hits = [];
      if (query.trim() === "" || typeof document === "undefined") return hits;
      let pattern;
      try {
        pattern = new RegExp(queryPattern(query), "gi");
      } catch {
        return hits;
      }
      for (const element of document.querySelectorAll("[data-chat-node-key]")) {
        if (element.parentElement !== null && element.parentElement.closest("[data-chat-node-key]") !== null) continue;
        if (element.getClientRects().length === 0) continue;
        const seq = seqForKey(element.getAttribute("data-chat-node-key"));
        if (typeof seq !== "number") continue;
        for (const entry of collectTextGroups(element).values()) {
          for (const range of groupRanges(entry, pattern)) hits.push({ seq, range, element });
        }
      }
      return hits;
    }

    function scrollContainerOf(element) {
      let node = element;
      while (node !== null && node !== document.body && node !== document.documentElement) {
        const style = globalThis.getComputedStyle(node);
        if ((style.overflowY === "auto" || style.overflowY === "scroll") && node.scrollHeight > node.clientHeight + 4) return node;
        node = node.parentElement;
      }
      return null;
    }

    /** Bring one occurrence to the middle of the transcript without mutating it. */
    function revealRange(range, element) {
      let box = null;
      const rects = typeof range.getClientRects === "function" ? range.getClientRects() : [];
      for (const rect of rects) {
        if (rect.width > 0 || rect.height > 0) {
          box = rect;
          break;
        }
      }
      if (box !== null) {
        const container = scrollContainerOf(element === null ? range.startContainer.parentElement : element);
        if (container !== null) {
          const frame = container.getBoundingClientRect();
          const delta = box.top - frame.top - container.clientHeight / 2 + box.height / 2;
          if (Math.abs(delta) > 2) container.scrollTop += delta;
          return;
        }
        const top = box.top + (globalThis.scrollY ?? 0) - (globalThis.innerHeight ?? 0) / 2 + box.height / 2;
        globalThis.scrollTo({ top: Math.max(0, top) });
        return;
      }
      if (element !== null && typeof element.scrollIntoView === "function") element.scrollIntoView({ block: "center", inline: "nearest" });
    }

    function indexOfSeq(hits, seq) {
      for (let index = 0; index < hits.length; index += 1) {
        if (hits[index].seq === seq) return index;
      }
      return -1;
    }

    function chatRoot() {
      const any = document.querySelector("[data-chat-node-key]");
      if (any === null) return null;
      return any.closest("[data-chat-flow]") ?? any.parentElement;
    }

    // ------------------------------------------------------------------ store
    function createFindStore() {
      let state = { open: false, sessionId: null, query: "" };
      const listeners = new Set();
      const nodesBySession = new Map();
      const seqByKey = new Map();
      let lastFocus = null;
      const publish = (patch) => {
        state = Object.freeze({ ...state, ...patch });
        for (const listener of listeners) {
          try {
            listener();
          } catch {
            /* a subscriber must not break the find bar */
          }
        }
      };
      const store = {
        getSnapshot: () => state,
        subscribe(listener) {
          listeners.add(listener);
          return () => {
            listeners.delete(listener);
          };
        },
        open(sessionId) {
          lastFocus = typeof document !== "undefined" ? document.activeElement : null;
          const same = state.sessionId === sessionId;
          publish({ open: true, sessionId, query: same ? state.query : "" });
        },
        close() {
          publish({ open: false });
          if (lastFocus !== null && lastFocus.isConnected !== false && typeof lastFocus.focus === "function") {
            const target = lastFocus;
            setTimeout(() => {
              try {
                target.focus();
              } catch {
                /* the composer may have unmounted */
              }
            }, 0);
          }
          lastFocus = null;
        },
        setQuery(query) {
          publish({ query });
        },
        setNodes(sessionId, nodes) {
          if (!Array.isArray(nodes)) return;
          nodesBySession.set(sessionId, nodes);
          const index = new Map();
          for (const node of nodes) {
            if (node === null || typeof node !== "object") continue;
            if (typeof node.key !== "string" || typeof node.anchorSeq !== "number") continue;
            if (!index.has(node.key)) index.set(node.key, node.anchorSeq);
          }
          seqByKey.set(sessionId, index);
        },
        seqForKey(sessionId, key) {
          const index = seqByKey.get(sessionId);
          if (index === undefined || typeof key !== "string") return null;
          const seq = index.get(key);
          return typeof seq === "number" ? seq : null;
        },
        nodeKeyFor(sessionId, seq) {
          const nodes = nodesBySession.get(sessionId);
          if (!Array.isArray(nodes)) return null;
          for (const node of nodes) {
            if (node !== null && typeof node === "object" && node.anchorSeq === seq && typeof node.key === "string") {
              return node.key;
            }
          }
          return null;
        },
        waitForNodeKey(sessionId, seq, timeoutMs = 4000) {
          return new Promise((resolve) => {
            const started = Date.now();
            const check = () => {
              const key = store.nodeKeyFor(sessionId, seq);
              if (key !== null) {
                resolve(key);
                return;
              }
              if (Date.now() - started >= timeoutMs) {
                resolve(null);
                return;
              }
              setTimeout(check, 50);
            };
            check();
          });
        },
      };
      return store;
    }

    // ------------------------------------------------------------ header button
    function FindHeaderButton({ store, sessionId, translate, useChat }) {
      const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
      const open = state.open && state.sessionId === sessionId;
      const useChatSafe = typeof useChat === "function" ? useChat : () => undefined;
      const nodes = useChatSafe((snapshot) => snapshot?.legacy?.nodes ?? snapshot?.nodes);
      useEffect(() => {
        if (Array.isArray(nodes)) store.setNodes(sessionId, nodes);
      }, [store, sessionId, nodes]);
      const label = typeof translate === "function" ? translate("find.open") : "Find in conversation";
      return h(
        primitives.Tooltip,
        {
          label,
          side: "bottom",
          children: h(primitives.Button, {
            variant: "ghost",
            size: "sm",
            className: "dshfind_headerBtn",
            "aria-label": label,
            "aria-pressed": open || undefined,
            icon: h(primitives.IconSearchOutlineRegular, { size: 14 }),
            onClick: () => (open ? store.close() : store.open(sessionId)),
          }),
        },
      );
    }

    // ----------------------------------------------------------------- overlay
    function markSnippet(snippet, query) {
      const pattern = queryPattern(query);
      if (pattern === "") return snippet;
      let expression;
      try {
        expression = new RegExp(pattern, "gi");
      } catch {
        return snippet;
      }
      const parts = [];
      let last = 0;
      let match = expression.exec(snippet);
      while (match !== null) {
        if (match.index > last) parts.push(snippet.slice(last, match.index));
        parts.push(h("mark", { key: "m" + last }, match[0]));
        last = match.index + match[0].length;
        if (match[0].length === 0) expression.lastIndex += 1;
        match = expression.exec(snippet);
        if (parts.length > 40) break;
      }
      if (last < snippet.length) parts.push(snippet.slice(last));
      return parts;
    }

    function FindOverlay({ store, sessions, translate, t }) {
      const tr = typeof t === "function" ? t : translate;
      const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
      const [items, setItems] = useState([]);
      const [hasMore, setHasMore] = useState(false);
      const [status, setStatus] = useState("idle");
      const [error, setError] = useState(null);
      const [jumping, setJumping] = useState(0);
      const [occCount, setOccCount] = useState(0);
      const [cursor, setCursor] = useState(-1);
      const [activeSeq, setActiveSeq] = useState(null);
      const inputRef = useRef(null);
      const sessionId = state.sessionId;
      const hitsRef = useRef([]);
      const cursorRef = useRef(-1);
      const itemsRef = useRef(items);
      const queryRef = useRef(state.query);
      itemsRef.current = items;
      queryRef.current = state.query;

      // Focus the input each time the bar opens.
      useEffect(() => {
        if (!state.open) return;
        const timer = setTimeout(() => {
          inputRef.current?.focus?.();
          inputRef.current?.select?.();
        }, 0);
        return () => clearTimeout(timer);
      }, [state.open]);

      // Escape closes from anywhere in the page.
      useEffect(() => {
        if (!state.open) return;
        const onKeyDown = (event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            store.close();
          }
        };
        document.addEventListener("keydown", onKeyDown, true);
        return () => document.removeEventListener("keydown", onKeyDown, true);
      }, [state.open, store]);

      // Whole-session search through the host route.
      useEffect(() => {
        if (!state.open) return;
        const query = state.query.trim();
        if (query === "") {
          setItems([]);
          setHasMore(false);
          setStatus("idle");
          setError(null);
          return;
        }
        if (state.sessionId === null) {
          setItems([]);
          setHasMore(false);
          setStatus("no-session");
          return;
        }
        const controller = new AbortController();
        const timer = setTimeout(async () => {
          setStatus("loading");
          setError(null);
          try {
            const response = await fetch(API_PATH, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ sessionId: state.sessionId, query }),
              signal: controller.signal,
            });
            const payload = await response.json().catch(() => null);
            if (!response.ok || payload?.ok !== true) {
              if (response.status === 404 || response.status === 501) {
                setStatus("unavailable");
                return;
              }
              throw new Error(payload?.error?.message ?? "HTTP " + response.status);
            }
            const next = Array.isArray(payload.value?.items) ? payload.value.items : [];
            setItems(next);
            setHasMore(payload.value?.hasMore === true);
            setStatus("ready");
          } catch (cause) {
            if (cause instanceof DOMException && cause.name === "AbortError") return;
            if (cause?.name === "AbortError") return;
            setItems([]);
            setHasMore(false);
            setStatus("error");
            setError(cause instanceof Error ? cause.message : String(cause));
          }
        }, 250);
        return () => {
          clearTimeout(timer);
          controller.abort();
        };
      }, [state.open, state.query, state.sessionId]);

      // Recompute per-occurrence hits from the rendered transcript.
      const rescan = useCallback(
        (options) => {
          const opts = options === undefined || options === null ? {} : options;
          const next = sessionId === null ? [] : scanPage(queryRef.current, (key) => store.seqForKey(sessionId, key));
          hitsRef.current = next;
          setOccCount(next.length);
          let index = -1;
          if (typeof opts.afterSeq === "number") {
            for (let cursorIndex = 0; cursorIndex < next.length; cursorIndex += 1) {
              if (typeof next[cursorIndex].seq === "number" && next[cursorIndex].seq > opts.afterSeq) {
                index = cursorIndex;
                break;
              }
            }
            if (index < 0 && next.length > 0) index = next.length - 1;
          } else if (typeof opts.anchorSeq === "number") {
            index = indexOfSeq(next, opts.anchorSeq);
          }
          cursorRef.current = index;
          setCursor(index);
          setActiveSeq(index >= 0 ? next[index].seq : null);
          paintPageHighlights(
            next.map((hit) => hit.range),
            index >= 0 ? next[index].range : null,
          );
          if (index >= 0 && opts.reveal === true) revealRange(next[index].range, next[index].element);
        },
        [sessionId, store],
      );

      const goTo = useCallback((index) => {
        const hits = hitsRef.current;
        if (hits.length === 0) return;
        const next = ((index % hits.length) + hits.length) % hits.length;
        cursorRef.current = next;
        setCursor(next);
        setActiveSeq(hits[next].seq);
        paintPageHighlights(
          hits.map((hit) => hit.range),
          hits[next].range,
        );
        revealRange(hits[next].range, hits[next].element);
      }, []);

      const flashNode = useCallback(
        (seq) => {
          if (sessionId === null) return;
          const key = store.nodeKeyFor(sessionId, seq);
          if (key === null) return;
          const element = document.querySelector('[data-chat-node-key="' + cssEscape(key) + '"]');
          if (element === null) return;
          element.classList.add("dshfind_flash");
          setTimeout(() => element.classList.remove("dshfind_flash"), 1400);
        },
        [sessionId, store],
      );

      const ensureLoaded = useCallback(
        async (seq) => {
          if (sessionId === null) return false;
          if (store.nodeKeyFor(sessionId, seq) !== null) return true;
          const controller = sessions?.binding?.(sessionId)?.session;
          if (controller === undefined || controller === null || typeof controller.loadThrough !== "function") return false;
          try {
            await controller.loadThrough(seq);
          } catch {
            return false;
          }
          const key = await store.waitForNodeKey(sessionId, seq, 4000);
          if (key === null) return false;
          await nextFrame();
          return true;
        },
        [sessionId, sessions, store],
      );

      // The next result whose turn is still outside the loaded window.
      const loadNextUnloaded = useCallback(
        async (afterSeq) => {
          for (const item of itemsRef.current) {
            if (typeof afterSeq === "number" && item.seq <= afterSeq) continue;
            if (sessionId !== null && store.nodeKeyFor(sessionId, item.seq) !== null) continue;
            const loaded = await ensureLoaded(item.seq);
            if (loaded) return item.seq;
          }
          return null;
        },
        [ensureLoaded, sessionId, store],
      );

      const step = useCallback(
        async (direction) => {
          const hits = hitsRef.current;
          if (hits.length === 0) {
            const seq = await loadNextUnloaded();
            if (seq !== null) rescan({ anchorSeq: seq, reveal: true });
            return;
          }
          const current = cursorRef.current;
          if (current < 0) {
            goTo(direction > 0 ? 0 : hits.length - 1);
            return;
          }
          const target = current + direction;
          if (target >= 0 && target < hits.length) {
            goTo(target);
            return;
          }
          if (direction < 0) {
            goTo(hits.length - 1);
            return;
          }
          const lastSeq = hits[hits.length - 1].seq;
          const seq = await loadNextUnloaded(lastSeq);
          if (seq === null) goTo(0);
          else rescan({ afterSeq: lastSeq, reveal: true });
        },
        [goTo, loadNextUnloaded, rescan],
      );

      const jumpTo = useCallback(
        async (item) => {
          if (sessionId === null) return;
          setJumping(item.seq);
          setError(null);
          try {
            let index = indexOfSeq(hitsRef.current, item.seq);
            if (index < 0) {
              const loaded = await ensureLoaded(item.seq);
              if (!loaded) {
                setError(tr("find.noSession"));
                return;
              }
              rescan({ anchorSeq: item.seq });
              index = indexOfSeq(hitsRef.current, item.seq);
            }
            if (index < 0) {
              flashNode(item.seq);
              setError(tr("find.notFound"));
              return;
            }
            goTo(index);
            flashNode(item.seq);
          } catch (cause) {
            setError(cause instanceof Error ? cause.message : String(cause));
          } finally {
            setJumping(0);
          }
        },
        [ensureLoaded, flashNode, goTo, rescan, sessionId, tr],
      );

      // Keep the page highlight in step with the query and the result set.
      useEffect(() => {
        if (!state.open) return;
        if (status === "ready") {
          rescan({});
          return;
        }
        if (status !== "loading") {
          hitsRef.current = [];
          cursorRef.current = -1;
          setOccCount(0);
          setCursor(-1);
          setActiveSeq(null);
          clearPageHighlights();
        }
      }, [state.open, status, items, rescan]);

      // Re-scan when turns stream in or history loads under the open bar.
      useEffect(() => {
        if (!state.open || status !== "ready") return;
        const root = chatRoot();
        if (root === null || typeof MutationObserver !== "function") return;
        let timer = 0;
        const observer = new MutationObserver((records) => {
          let structural = false;
          for (const record of records) {
            if (record.addedNodes.length > 0 || record.removedNodes.length > 0) {
              structural = true;
              break;
            }
          }
          if (!structural) return;
          if (timer !== 0) clearTimeout(timer);
          timer = setTimeout(() => {
            timer = 0;
            const current = cursorRef.current;
            const anchor = current >= 0 && current < hitsRef.current.length ? hitsRef.current[current].seq : undefined;
            rescan(typeof anchor === "number" ? { anchorSeq: anchor } : {});
          }, 400);
        });
        observer.observe(root, { childList: true, subtree: true });
        return () => {
          if (timer !== 0) clearTimeout(timer);
          observer.disconnect();
        };
      }, [state.open, status, rescan]);

      // Drop every highlight when the bar closes or unmounts.
      useEffect(() => {
        if (state.open) return undefined;
        hitsRef.current = [];
        cursorRef.current = -1;
        return () => clearPageHighlights();
      }, [state.open]);

      useEffect(() => () => clearPageHighlights(), []);

      if (!state.open) return null;

      const query = state.query;
      const message =
        status === "no-session"
          ? tr("find.noSession")
          : status === "unavailable"
            ? tr("find.unavailable")
            : status === "error"
              ? tr("find.error") + (error === null ? "" : "：" + error)
              : status === "loading"
                ? tr("find.searching")
                : status === "ready"
                  ? items.length + (hasMore ? "+" : "") + " " + tr("find.matches")
                  : "";
      const count = status === "ready" && occCount > 0 ? (cursor >= 0 ? cursor + 1 + "/" + occCount : String(occCount)) : "";

      const results =
        items.length > 0
          ? h(
              "div",
              { className: "dshfind_results", role: "listbox", "aria-label": tr("find.open") },
              items.map((item) =>
                h(
                  "button",
                  {
                    key: item.seq,
                    type: "button",
                    role: "option",
                    className: "dshfind_result",
                    "data-seq": item.seq,
                    "data-active": activeSeq === item.seq ? "true" : undefined,
                    "aria-selected": activeSeq === item.seq,
                    onClick: () => {
                      void jumpTo(item);
                    },
                    disabled: jumping !== 0,
                  },
                  h(
                    "div",
                    { className: "dshfind_resultMeta" },
                    h("span", { className: "dshfind_badge" }, tr(item.type === "user" ? "find.user" : "find.assistant")),
                    h("span", null, formatClock(item.time)),
                    jumping === item.seq ? h("span", null, tr("find.searching")) : null,
                  ),
                  h("div", { className: "dshfind_snippet" }, markSnippet(item.snippet, query)),
                ),
              ),
            )
          : null;

      return ReactDOM.createPortal(
        h(
          "div",
          { className: "dshfind_panel", role: "search", "data-dsh-find-ui": true, "aria-label": tr("find.open") },
          h(
            "div",
            { className: "dshfind_row" },
            h(primitives.IconSearchOutlineRegular, { size: 14 }),
            h("input", {
              ref: inputRef,
              className: "dshfind_input",
              type: "text",
              value: query,
              maxLength: 200,
              placeholder: tr("find.placeholder"),
              "aria-label": tr("find.placeholder"),
              onChange: (event) => store.setQuery(event.target.value),
              onKeyDown: (event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void step(event.shiftKey ? -1 : 1);
                } else if (event.key === "Escape") {
                  event.preventDefault();
                  store.close();
                }
              },
            }),
            h("span", { className: "dshfind_count" }, count),
            h(
              primitives.Tooltip,
              {
                label: tr("find.close"),
                side: "bottom",
                children: h(
                  "button",
                  {
                    type: "button",
                    className: "dshfind_iconBtn",
                    "aria-label": tr("find.close"),
                    onClick: () => store.close(),
                  },
                  h(primitives.IconCloseOutlineRegular, { size: 14 }),
                ),
              },
            ),
          ),
          h("div", { className: "dshfind_hint" }, tr("find.hint")),
          h(
            "div",
            { className: "dshfind_status", "data-tone": status === "error" || status === "unavailable" ? "error" : undefined },
            message,
          ),
          results,
          hasMore ? h("div", { className: "dshfind_footer" }, tr("find.more", { count: 100 })) : null,
        ),
        document.body,
      );
    }

    // ------------------------------------------------------------------- apply
    function currentSessionId(ctx) {
      try {
        const rows = ctx.sessions.list.getSnapshot().byId;
        for (const [id, row] of Object.entries(rows)) {
          if ((row?.retainedBy?.mainView ?? 0) > 0) return id;
        }
      } catch {
        /* fall through to the workspace selection */
      }
      try {
        return ctx.get("uiWorkspace")?.selection?.getSnapshot()?.sessionId ?? null;
      } catch {
        return null;
      }
    }

    function apply(ctx) {
      ctx.effect(
        () =>
          ctx.locale.register(NS, {
            zh,
            en,
            ja: en,
            es: en,
            fr: en,
            de: en,
            ru: en,
            pt: en,
          }),
        "dsh-find: dictionaries",
      );
      injectStyles();
      const t = ctx.locale.bind(NS);
      const store = createFindStore();

      ctx.slots.inject("conversation.session.header.utilities", () =>
        ctx.slots.register(
          {
            name: "conversation.session.header.utilities",
            id: "find-in-conversation",
            order: 12,
            locale: NS,
            inject: (sessionId) => ({ store, sessionId, translate: t }),
          },
          FindHeaderButton,
        ),
      );

      ctx.slots.inject("shell.overlay", () =>
        ctx.slots.register(
          {
            name: "shell.overlay",
            id: "find-in-conversation",
            order: 20,
            locale: NS,
            inject: () => ({ store, sessions: ctx.sessions, translate: t }),
          },
          FindOverlay,
        ),
      );

      ctx.inject(["shortcuts"], (scope) => {
        scope.effect(
          () => {
            try {
              return scope.shortcuts.register({
                id: "find.inConversation",
                label: () => t("find.open"),
                aliases: ["find in conversation", "conversation find"],
                defaults: {
                  "desktop:macos": { code: "KeyF", modifiers: ["primary"] },
                  "desktop:windows": { code: "KeyF", modifiers: ["primary"] },
                  "desktop:linux": { code: "KeyF", modifiers: ["primary"] },
                  "web:macos": { code: "KeyF", modifiers: ["primary", "alt"] },
                  "web:windows": { code: "KeyF", modifiers: ["primary", "alt"] },
                },
                regions: ["page", "editable"],
                modals: ["sidebar"],
                resolve: () => {
                  const sessionId = currentSessionId(ctx);
                  if (sessionId === null) return { status: "blocked", reason: t("find.noSession") };
                  return { status: "handled", run: () => store.open(sessionId) };
                },
              });
            } catch (error) {
              console.warn("[dsh-find] shortcut registration failed:", error);
              return () => {};
            }
          },
          "dsh-find: shortcut",
        );
      });
    }

    exports.name = "dsh-find";
    exports.inject = ["slots", "locale", "sessions"];
    exports.apply = apply;
    exports.__test = { markSnippet, queryPattern, pointAt, groupRanges, indexOfSeq };
    return module.exports;
  },
});
