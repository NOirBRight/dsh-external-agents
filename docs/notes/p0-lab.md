# P0 lab 陷阱（历史记录，2026-08-31）

验收只走 **3082 / `~/.dsh-lab`**。3080 / `~/.dsh` 是 production，只读。

## 已通

- Codex 前台 `P0_CODEX_OK`；后台 `subagent-1`（`kind: subagent`）。
- Claude Code 前台在仓库本地钉 **sonnet** 后 `P0_CLAUDE_OK`。
- Exposure：关掉 `claude-code.enabled` 后下一轮没有 `subagent_claude_code`。

## 陷阱

1. **「没有自动批准」说的是 DSH 包，不是 `claude` CLI。**  
   `claude --help` 有 `--dangerously-skip-permissions` 和 `--permission-mode`。官方提供方 `0.1.2-alpha.1` 传 `model`，权限策略默认 `permissionMode: 'dontAsk'`。旗标以 [cli-contracts](../reference/cli-contracts.md) 为准。

2. **原生 opus 在 SDK 里是 claude-opus-5，会 529 Overloaded。**  
   第一次 lab 委托失败被收成 `Error: subagent run failed`。同机 `claude -p --model sonnet` 和仓库 `.claude/settings.local.json`（`model: sonnet`）都能通。不要改 `~/.claude/settings.json` 的全局 opus。

3. **失败原文进不了父 Session，也进不了 Claude 项目目录。**  
   `dsh-tool-subagent` 把任何 `stopReason: error` 收成 `subagent run failed`。提供方 `persistSession: false`，`~/.claude/projects` 没有那次 run。要 log：CLI `--debug-file`；SDK `options.debugFile`（官方包现在也不接）。

4. **link 插件的依赖不会 hoist 进 profile。**  
   YAML `name: '@deepseek-ai/dsh-subagent-codex'` 从 profile 解析会失败。P0 在 `apply()` 里 `ctx.plugin()` 官方提供方。

5. **lab 的 pnpm store 可能对不齐 `dsh plugin add`。**  
   当前 release gate 只接受 pack 后的 artifact；不再使用源码 checkout alias、手工 symlink 或直接改 bundle 清单。

6. **Grok 当父模型会 `Duplicate tool names: web_search`。**  
   lab 验收父模型用 `ollama-cloud` / `glm-5.2`。

## P1 补充

7. **Cursor 前台+后台已通。** `worker_cursor` 返回 `P1_CURSOR_OK`；后台 `subagent-1`。默认 `--force --trust`。

8. **Agy print 契约：** `--print` 必须最后一项带着任务；JSON 是 `status=SUCCESS` + `response`。consumer Gemini 会按出口 IP 拒 `User location is not supported`。  
   **产品面：** 用户给 Adapter 配 `env`（任意键，只进该工人）。本插件不内置、不要求、不公布代理端点。  
   **本机运维（不要写进产品/设置文案）：** lab 这台用 FlClash 进程规则拆 `agy` 出口。那是操作，不是 ADR。

9. **Agy 前台+后台已通（3082）。** 前台 `worker_antigravity` → `P1_AGY_OK`；后台注册 `subagent-1`（`kind: subagent`）。父模型用 `ollama-cloud` / `glm-5.2`。

## 相关设计（P2）

见 [roadmap](../roadmap.md)：设置「外部 Agent」分区。不要开自定义 CLI Adapter。
