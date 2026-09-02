# 外部 CLI 契约

本文件记录 v1 Adapter 依赖的**产品官方入口**。旗标以本机实测为准；升级产品后先改这里再改代码。

## Codex

- 二进制：`codex`
- 本机版本：`codex-cli 0.147.0`
- 协议：本插件不直接讲。由 `@deepseek-ai/dsh-subagent-codex` 启动 `codex app-server --stdio`。
- 登录：`codex login`，状态由产品自己管。
- 探测：`PATH` 上能解析 `codex`，`codex --version` 能跑。

## Claude Code

- 二进制：`claude`
- 本机版本：`2.1.234`
- 协议：本插件不直接讲。由 `@deepseek-ai/dsh-subagent-claude-code` 调官方 Agent SDK `query()`，并把 `pathToClaudeCodeExecutable` 指到宿主解析到的 `claude`。
- 登录：Claude Code 原生（本机 `claude auth status` → claude.ai Pro）。
- 探测：`PATH` 上能解析 `claude`，`claude --version` 能跑。
- 产品 CLI **有**无人值守旗标（本机 `claude --help` 实测）：
  - `--dangerously-skip-permissions`
  - `--permission-mode <default|acceptEdits|bypassPermissions|plan|dontAsk|auto>`
  - `-p --output-format json`
  - `--model <alias|full>`（`sonnet` / `opus` / 全名）
  - `--debug-file <path>`（隐式开 debug）
- **DSH 官方提供方使用 Alpha.4 的受限选项。** `@deepseek-ai/dsh-subagent-claude-code@0.1.2-alpha.4` 可接收 `model` 与 `permissionMode`；本插件只转发设置页提供的 `model`，权限策略保持提供方的 `dontAsk` 默认值，不伪造审批。
- 本插件按 [ADR 0005](../adr/0005-unattended-auto-approve.md) 不在包装层伪造批准；官方提供方拒绝审批时保持失败。
- 模型：已启用 Adapter 的设置页 `model` 去掉首尾空白后显式转发给提供方；已禁用 Adapter 可以不填写。原生 `~/.claude/settings.json` 的 `"model": "opus"` 本机落到 **claude-opus-5**。仓库可用 gitignore 的 `.claude/settings.local.json` 钉 `sonnet`（落到 **claude-sonnet-5**），只影响该 cwd。

## Cursor Agent

- 二进制：`cursor-agent`（不要用 IDE 的 `cursor`）
- 本机版本：`2026.08.11-e8db854`
- 登录：`cursor-agent login`；`cursor-agent status` 可探测。
- 一次性调用：

```sh
cursor-agent -p --output-format json --force --trust --workspace <cwd> -- "<task>"
```

- 成功：stdout 单行 JSON，`type=result`、`subtype=success`、`is_error=false`、`result` 为非空最终文本。
- 失败：非 0 退出，不保证 JSON；读 stderr。
- 严格模式：去掉 `--force`，保留 `--trust`（只跳过 workspace 提示）。无 TTY 时需要审批的任务应失败而不是挂起。
- 禁止：`api2.cursor.sh` 私有 AgentService、Deep Control PKCE、`dsh-llm-cursor` 的会话文件。

官方说明：<https://docs.cursor.com/en/cli/reference/output-format>、<https://docs.cursor.com/en/cli/headless>

## Antigravity

- 工人二进制：`agy`
- 不是：`/usr/bin/antigravity`（那是 IDE，`antigravity --help` 是 VS Code 分叉）
- 一次性调用：

```sh
agy --dangerously-skip-permissions --output-format json --print-timeout 300s --print "<task>"
```

`--print` 必须放在任务前面的最后一项。它会吃掉后一个参数当 prompt；写成 `--print --output-format json` 会把旗标当成任务。

工作区即进程 cwd，由 DSH 父会话 cwd spawn。

- `--output-format`：`text` | `json` | `stream-json`，print 模式默认 `text`。本插件用 `json`。
- `--print-timeout` 默认 5m。Adapter 应把它接到可配的有限超时，且不得超过 DSH `MAX_TIMER_DELAY_MS` 能表达的范围之外的「无限等」。
- 严格模式：去掉 `--dangerously-skip-permissions`。
- 登录：Agy 原生；能探测就显示，不能就写「由产品自身管理」。
- 不要把 `gemini` CLI 当成这个 Adapter 的别名。

官方说明：<https://www.antigravity.google/docs/cli-overview>

## 共同规则

- cwd = 父会话 workspace。没有 cwd 的父会话不得启动工人。
- 凭证特征环境变量会被 `dsh-subprocess` 清掉。每个 Adapter 可配自己的 `env`，只叠到**那一个**工人进程上（例如 `HTTPS_PROXY`、产品自己的 key）。这是给用户的配置面，不是本插件内置的出口或端点。父进程 / 其它 Adapter 不会自动带上这些键。
- 加载插件不得 spawn 上述任一进程。探测可以跑 `--version` / `status`，必须有超时，且不得在 apply() 里同步堵死启动。
