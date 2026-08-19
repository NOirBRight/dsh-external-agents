# AGENTS.md

实现前先读 [CONTEXT.md](CONTEXT.md) 和 [docs/spec.md](docs/spec.md)。改产品决策时先写或改 [docs/adr/](docs/adr/)，再动代码。

3080 / `~/.dsh` 是 production，只读。验收、预览、重启只走 3082 / `~/.dsh-lab`。见 `/home/noirbright/Workstation/AGENTS.md`。

## 站队

- 这是宿主平面插件。Adapter、设置命名空间、探测、RPC 都挂在 host，不进 Agent Preset。
- 词汇用 CONTEXT.md。对人：外部 Agent / External Agents。对领域：Product Worker。对 DSH 内置子会话：Native Subagent / 子代理。不要把外部 Agent 写成 LLM provider，也不要把设置分区叫做「子代理」。
- 官方 Codex / Claude Code 走已发布的 `@deepseek-ai/dsh-subagent-codex` / `@deepseek-ai/dsh-subagent-claude-code`，不要重写 app-server 或 Claude Agent SDK 协议。
- Cursor 只允许官方 `cursor-agent` CLI（或以后的官方 `@cursor/sdk` local runtime）。禁止再打 `api2.cursor.sh` 私有 AgentService。
- Antigravity 的可执行文件是 `agy`，不是 IDE 的 `antigravity`。
- 后台委托只注册 `ctx.jobs`，沿用 Job Panel。不要做第二套任务 UI。
- v1 不做续聊、不做父上下文拷贝、不让用户登记任意 shell 作为 Adapter。

## 文档

- 术语进 CONTEXT.md，不进 ADR 正文重复定义。
- 对外 CLI 旗标进 [docs/reference/cli-contracts.md](docs/reference/cli-contracts.md)。lab 验收陷阱进 [docs/notes/p0-lab.md](docs/notes/p0-lab.md)。
- 代码注释英文；产品文案中文。
