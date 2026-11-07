# 会话内查找（dsh-find）

在 DSH 会话内查找：搜索**完整会话历史**（包含尚未加载的部分），命中处在正文里高亮，`Enter` 逐处跳转。

## 功能

- **会话头部搜索图标**，以及快捷键：
  - 桌面端：`Ctrl/Cmd+F`
  - 普通 Web / 浏览器：`Ctrl/Cmd+Alt+F`（避免和浏览器自带查找冲突）
- 输入关键字后，通过 Host 的 `sessionQuery.filterEvents` 扫描持久化日志（不依赖 SQLite FTS），返回用户 / 助手消息的片段列表。
- 已渲染的命中处全部高亮（浅黄），当前那一处单独深色；`Enter` 下一处、`Shift+Enter` 上一处，跨消息时自动 `loadThrough` 加载，计数显示 `3/17`。
- 点击结果用 `session.loadThrough(seq)` 加载对应轮次，再滚到该消息的第一处命中并闪一下消息边框。
- 没有「当前视图」模式，也没有配置项；开关就是插件页里的行开关。

## 安装

```sh
dsh plugin --profile <profile> add dsh-find
```

或者在 DSH 桌面端 / Web 的 **插件 → 添加插件** 里输入包名 `dsh-find`，装完点 **立即启用**。之后重启或刷新页面。

打开 **插件** 页确认 **会话内查找** 卡片里的 `conversation-find` 行是开启的。

关闭该行会同时移除头部图标、查找条和快捷键，Host 的搜索路由也不再注册。

## 使用

- 点会话头部的搜索图标，或按快捷键。
- 输入关键字，约 250 毫秒防抖后显示结果（角色、时间、片段）。
- 正文里的命中全部高亮；`Enter` 跳到下一处、`Shift+Enter` 上一处，输入框右侧显示 `当前位置/总数`。
- 点击任意结果跳到该条消息的第一处命中；`Esc` 关闭并清掉高亮。

## 实现

- 客户端 `lib/client.js` 注册 `conversation.session.header.utilities`、`shell.overlay`，并通过 `ctx.shortcuts` 注册 `find.inConversation`。
- Host `lib/index.js` 注册 `POST /api/dsh-find/search`，调用：

```js
sessionQuery.filterEvents(sessionId, [
  { kind: "text", text: query },
  { kind: "surface", values: ["current"] },
  { kind: "type", values: ["user/message", "assistant/message"] },
])
```

- 纯函数在 `lib/search-core.js`：查询规范化、片段截取、结果上限（100 条）。
- 命中定位在客户端完成（`scanPage`）：按 `[data-chat-node-key]` 遍历已渲染消息，按块把文本节点拼成一条再回映射偏移，因此被 `<strong>`、链接、行内代码拆开的关键词也能命中。高亮走 **CSS Custom Highlight API**（`::highlight(dshfind-hit)` / `::highlight(dshfind-current)`），不改 React 管理的 DOM。

## 限制

- 每次查询都会重放一遍会话日志；结果上限 100 条，超出时提示 `仅显示前 100 条`。
- 跳转要求目标轮次能被 `loadThrough` 加载，并且该消息出现在当前聊天窗口；定位失败会提示「已加载该轮次，但未能定位到消息」。
- 高亮只覆盖**已渲染**的消息：未加载的历史靠 `Enter` 触发加载，折叠在「过程 / 思考」分组里的节点不参与命中。
- 需要 Host 的 `sessionQuery` 服务；不可用时提示完整会话搜索不可用（501）。
- 需要 Chromium 105+ 才有正文高亮；不支持时自动退化为「滚到消息 + 闪边框」。

## 与同名插件的区别

社区里另有一个 `dsh-conversation-find`，它只搜当前页面上的 DOM。
本插件搜的是**持久化的会话日志**，因此未加载的历史也能命中；正文高亮只是把命中结果画到当前窗口，不改变搜索范围（不会搜到会话之外的页面元素）。

## 许可

MIT
