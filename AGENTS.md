# DSH 两套平面

3080 / `~/.dsh` 是工作空间：只安装 Release 的 GitHub 插件（`github:…#vX.Y.Z`）；只读，不为预览改/刷新/重启。
3082 / `~/.dsh-lab` 是测试空间：只安装 `link:` 到 Workstation checkout 的插件；验收、预览、重启只走这里。
完整约定：`/home/noirbright/Workstation/AGENTS.md`

实现前先读 [CONTEXT.md](CONTEXT.md) 和 [docs/spec.md](docs/spec.md)。改产品决策时先写或改 [docs/adr/](docs/adr/)，再动代码。

## Core 边界

本项目只维护插件：官方 DeepSeek Harness 及其本地 checkout 是只读依赖。实现与兼容处理留在本项目；禁止修改或要求 DSH core patch。缺少公开 seam 时记录上游提案，并让插件在干净的官方 tag 上降级或关闭该能力。

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

## DSH 版本兼容

- 官方 DSH Host 包（`@deepseek-ai/dsh` 及 `@deepseek-ai/dsh-*`）在 `package.json` 的 `dependencies`、`optionalDependencies`、`devDependencies`、`peerDependencies` 中使用无上界的下限范围 `>=最低已验证兼容版本`；不得用精确版本或带上界的范围限制后续版本。锁文件、构建输入和安装/发布工件选择器可固定实际验证的版本。
- 对有明确公开 API 或协议兼容承诺的 DSH 插件 peer，也使用无上界的下限范围 `>=最低已验证兼容版本`。未定义兼容承诺的插件协议应先定义并验证；不要仅凭包名放宽版本。插件 peer 新版本通过互操作测试和构建后，再声明兼容。
- 声明兼容新 DSH release 前，审查其公开 API 变化与插件实际调用，运行相关测试和 `pnpm run build`，并在 3082（`DSH_HOME=~/.dsh-lab`）验证；全部通过后再宣称兼容。
