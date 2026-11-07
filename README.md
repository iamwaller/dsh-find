# Find in conversation (dsh-find)

Find inside a DSH session: searches the **complete session history** (including turns that are not loaded yet), highlights every hit in the transcript, and walks through them with `Enter`.

## What you get

- A **search icon in the session header**, plus a shortcut:
  - Desktop: `Ctrl/Cmd+F`
  - Plain Web / browser: `Ctrl/Cmd+Alt+F`, so the browser's own find bar keeps working
- Typing a query scans the persisted session log through the host's `sessionQuery.filterEvents` (no SQLite FTS) and returns snippets from user and assistant messages.
- Every hit in the rendered transcript is painted; the active one is darker, and the counter reads `3/17`.
- `Enter` goes to the next hit, `Shift+Enter` to the previous one, loading the turn with `session.loadThrough(seq)` when it crosses the loaded boundary.
- Clicking a result loads that turn, jumps to its first hit and flashes the message.
- There is no "current view" mode and no configuration: the row switch on the Plugins page is the only setting.

## Install

```sh
dsh plugin --profile <profile> add dsh-find
```

Or in DSH Desktop / Web open **Plugins → Add plugin**, enter `dsh-find`, then choose **Enable now**. Restart or reload afterwards.

Open **Plugins** and confirm the `conversation-find` row in the **Find in conversation** card is on.

Turning the row off removes the header icon, the find bar and the shortcut, and unregisters the host route.

## Usage

- Click the search icon in the session header, or press the shortcut.
- Type a query; results (role, time, snippet) appear after roughly 250 ms of debounce.
- Hits in the transcript light up; `Enter` next hit, `Shift+Enter` previous hit, `Esc` closes and clears the paint.
- Clicking a result jumps to the first hit inside that message.

## How it works

- Client `lib/client.js` registers `conversation.session.header.utilities` and `shell.overlay`, and registers `find.inConversation` through `ctx.shortcuts`.
- Host `lib/index.js` registers `POST /api/dsh-find/search`, which calls:

```js
sessionQuery.filterEvents(sessionId, [
  { kind: "text", text: query },
  { kind: "surface", values: ["current"] },
  { kind: "type", values: ["user/message", "assistant/message"] },
])
```

- Pure functions live in `lib/search-core.js`: query normalization, snippet extraction, and the 100-result cap.
- Hit positions are resolved client-side in `scanPage`: text nodes are concatenated per block and matched offsets mapped back to DOM ranges, so a keyword split by `<strong>`, a link or inline code still matches. Painting uses the **CSS Custom Highlight API** (`::highlight(dshfind-hit)` / `::highlight(dshfind-current)`), so the React-owned DOM is never mutated.

## Limits

- Every query replays the session log; results are capped at 100 with a `仅显示前 100 条` notice.
- Jumping requires the target turn to be loadable through `loadThrough` and visible in the current chat window; otherwise it reports that the turn loaded but the message could not be located.
- Highlighting covers **rendered** messages only: unloaded history is pulled in by `Enter`, and nodes folded into a process/reasoning group do not take part.
- Requires the host's `sessionQuery` service; when it is unavailable the search reports that full-session search is not available (501).
- Needs Chromium 105+ for the in-page paint; without it the plugin falls back to scrolling and flashing the message.

## Difference from the same-named plugin

There is another community plugin called `dsh-conversation-find` that searches the page DOM of the current view.
This one searches the **persisted session log only**, so unloaded history still matches; the in-page paint only draws those results into the window and never widens the search to other elements on the page.

## License

MIT
