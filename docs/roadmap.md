# 路线图

按依赖排序。每一阶段结束必须能在本机 **dsh-lab（3082）** 上手点验收。不要在 3080 上验收。

## P0 — 打开官方两条

状态：**lab 已验收**（陷阱见 [notes/p0-lab.md](notes/p0-lab.md)）。

目标：在 dsh-lab 上通过本插件跑通 Codex 与 Claude Code。

- 插件骨架：`package.json`、`cordis.patch.yml`、host `apply`。
- 作为依赖挂载 `@deepseek-ai/dsh-subagent-codex`、`@deepseek-ai/dsh-subagent-claude-code`。
- 用本插件的临时配置（文件或 settings）启用工具行：`backgroundMode: one-shot`，`maxDepth: provider-managed`。
- 验收：[spec §5.4](spec.md)。
- 不改官方预设源文件；保持那两行 `disabled: true`。

## P1 — Cursor 与 Antigravity Adapter

状态：**lab 已验收**。Cursor 与 Agy 前台+后台都通。见 [notes/p0-lab.md](notes/p0-lab.md)。

- `cursor-agent -p --output-format json` 的 one-shot provider。
- `agy -p --output-format json` 的 one-shot provider。
- 与官方两条相同的结果约定：最终文本 / error / aborted。
- 探测 `PATH`；登录失败要变成可读错误。
- 本机已登录的 `cursor-agent`、已安装的 `agy` 各跑通一次前台 + 一次后台 Job。

## P2 — 设置「外部 Agent」分区

状态：**lab 已接线**。host RPC `/external-agents/{snapshot,save}`；关掉 Codex 后下一轮没有 `subagent_codex`。写入文件是 profile 下的 `external-agents.settings.json`（RPC 权威）。不要把本机 FlClash 端点写进设置文案。

- client：`settings.section` id `external-agents`，文案「外部 Agent」/ External Agents。
- Catalog 四张卡 + Default Adapter。
- host RPC：探测、读配置、写 Exposure。
- 开关即时影响下一轮工具表，不必新会话。
- 验收：关掉 Codex 后模型不再看到 `subagent_codex`。

## P3 — Routing Skill

状态：**已写入并在 apply() 注册**。技能只路由，禁止 spawn。description 先写「不要用于识图/闲聊」。

- 发布 `skills/delegate-product-worker/SKILL.md`。
- 描述要能被 DSH 技能目录扫到。
- 不包含 spawn 脚本。

## 明确不做（除非新开 ADR）

- 自定义 CLI Adapter
- 产品会话续聊
- 替代 Job Panel
- Cursor 私有 HTTP
- 在 DSH 没有公开 delegated Plan resolution seam 时，本插件不提供 Plan 交接或完整 shadow `exit_plan_mode`
