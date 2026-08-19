# ADR 0004：出厂四个 Adapter

状态：已采纳

## 问题

第一版接哪些产品？Antigravity 用哪个二进制？Cursor 走 CLI 还是 SDK？

## 决策

出厂四个 id：`codex`、`claude-code`、`cursor`、`antigravity`。

- Codex / Claude Code：官方 provider 包。
- Cursor：`cursor-agent` 的 print-json。不使用 `dsh-llm-cursor`，不调用 `api2.cursor.sh` 私有 AgentService。暂不依赖 `@cursor/sdk`（它更偏 API key / 云端计费，不能默认复用 CLI 登录）。
- Antigravity：`agy`。`antigravity` 是 IDE，不能当工人。不接已退休路径上的 `gemini` CLI 作为独立 Adapter。

v1 不开放用户自定义 argv。

## 理由

这四个都是本机已存在或用户点名的官方 CLI 工人。`cursor-agent --print --output-format json` 的成功 JSON 与 Claude Code 的 result 几乎同构，实现成本低于 Codex app-server。`agy --print --output-format json` 同样是 headless 契约。

自定义 argv 会变成「任意命令当 subagent」，审批、输出解析、探测全都失去类型。

## 后果

- Catalog 是封闭枚举。新工人要新 ADR。
- 本机 `antigravity` 在 PATH 上不等于 Antigravity Adapter 可用。
- Cursor Ultra 的 CLI 登录可以直接用；SDK 路线留待以后。

## 放弃的方案

**`@cursor/sdk` 作为 v1 入口。** 官方，但鉴权与计费模型和已登录 CLI 不一致。

**把 `gemini` 和 `agy` 并成两个 Adapter。** Google 已把终端工人迁到 Agy；两套入口会让 Catalog 说谎。
