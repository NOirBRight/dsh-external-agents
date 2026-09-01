# 产品规格：Product Worker 控制面

状态：已实现，可供 P0–P3 验收。术语见 [CONTEXT.md](../CONTEXT.md)。决策见 [adr/](adr/)。

当前行为：设置拥有 Exposure；具名工具与通用工具均可用；无人值守策略由 Adapter 配置；设置页提供外部 Agent 管理。

## 1. 要解决的问题

DSH 0.1.2-alpha.1 已经有 Codex / Claude Code 的官方 Product Worker，但生产安装默认不带 provider，预设行是 `disabled: true`，用户要改 YAML、装包、复制预设，才能让模型看到工具。后台 one-shot 已经能进 Job Panel，但没有发现面。

同时：

- Cursor 插件当 LLM 供应商走私有接口，已因 ToS 夭折；官方 `cursor-agent` CLI 仍可合法当工人。
- Antigravity 的工人入口是 `agy`，不是 IDE 二进制 `antigravity`。
- 用户需要「像供应商页那样」看见有哪些工人、能否用、默认叫谁。

本产品把这四件事收成一个宿主插件：打开官方两条、补两条新 Adapter、给设置页、给一条 Routing Skill。

## 2. 产品是什么

一个 DSH Profile 插件。装上之后：

1. 宿主注册四个 Adapter（加载时不启动产品）。
2. 设置里出现独立的「外部 Agent」分区，列出 Catalog。
3. 用户启用某个 Adapter 后，当前 Profile 的会话模型看到对应 Delegation Tool。
4. 模型把 Bounded Task 交给工人；后台走 Job Panel。
5. 可选技能告诉父 Agent 何时委托、委托给谁。

DSH 仍是编排器与工具执行方。工人用自己的 harness 和账号干活。

## 3. 产品不是什么

| 不是 | 原因 |
| --- | --- |
| LLM 供应商 | 那是 Settings → 供应商。Cursor 私有 `AgentService/Run` 不再做。 |
| 内置 `subagent` / `subagent_fork` 的替代品 | 那些是同一套 harness 的子会话，可续聊。 |
| 第二套 Job / 子会话 UI | 后台任务沿用 DSH Job Panel。 |
| 账号管理器 | Native Login 留在各产品 CLI。设置页只探测并给出安装/登录说明。 |
| 任意命令注册器 | v1 只出厂四个 Adapter。 |
| 可续聊的产品会话 | v1 只有 One-shot Job。 |

## 4. 谁拥有什么

| 事实 | 主人 | 不归谁 |
| --- | --- | --- |
| 本机是否安装、是否登录 | 产品 CLI | 本插件 |
| 是否对模型可见（Exposure） | 设置页 | Agent Preset 的 `disabled` 行 |
| 默认叫谁（Default Adapter） | 设置页 | 父模型 picker |
| 产品内部模型 / 沙箱 / 权限 | 产品原生配置 + Adapter 上有限覆盖 | DSH 模型选择器 |
| 任务文本 | 父 Agent 写的 Bounded Task | 父对话自动拷贝 |
| 进程与取消 | DSH `dsh-subprocess` + `ctx.jobs` | 产品自己的 resume id |
| 人机进度 | Job Panel | 本插件自定义面板 |

官方 DSH 把「模型看见哪把工具」交给 Preset。本产品有意改成设置页拥有 Exposure，见 [ADR 0002](adr/0002-settings-owns-exposure.md)。官方预设里那两行 `tool-subagent-codex/claude-code` 保持 `disabled: true`，避免两套工具同时出现。

## 5. 用户流程

### 5.1 安装

```sh
npm pack --ignore-scripts
dsh plugin --profile web add ./dsh-external-agents-0.2.0.tgz
# 发布后也可使用 registry spec
```

插件自带 `cordis.patch.yml`，一次挂上 host 行和 client 行。用户不必手写 provider YAML。

### 5.2 发现与启用

打开 Settings → **外部 Agent**：

- 四张 Adapter 卡：Codex、Claude Code、Cursor Agent、Antigravity。
- 每张卡显示：可执行文件路径或「未找到」、登录状态或「未登录」、启用开关、可选模型覆盖、无人值守策略。
- 未找到：给出该产品的官方安装命令，不代装。
- 未登录：给出该产品的官方登录命令，不代登、不走浏览器 OAuth（Cursor 的 Deep Control 登录属于 LLM 插件，这里不用）。
- 顶部：Default Adapter 下拉，选项只有「已启用且可用」的 Adapter。

启用一个可用 Adapter 后，**新的一轮模型请求**就能看到对应工具。不必新开会话；不必复制 Preset。

### 5.3 让工人干活

用户对 DSH 说「把鉴权重构交给 Codex」或「用默认外部 Agent 跑测试」。父 Agent：

1. 需要时加载 Routing Skill。
2. 写 Bounded Task。
3. 调具名工具或通用工具；独立任务可 `run_in_background: true`。
4. 后台任务出现在会话头 Job Panel；父 Agent 用 `job_output` / `job_kill`。
5. 父 Agent 验收最终文本后再向用户汇报。

### 5.4 打开官方两条的最低验收

在本机已有 `codex`（0.147.x）和 `claude`（2.1.x）且已登录的前提下：

1. 设置页两张卡显示已找到可执行文件。
2. 打开 Codex，新开一轮，模型能调用 `subagent_codex`。
3. 前台委托返回非空最终文本或明确错误。
4. `run_in_background: true` 后 Job Panel 出现 `kind: subagent` 的行，结束态可见。
5. Claude Code 同样走通。
6. 关掉开关后，模型不再看到该工具。

## 6. 模型看到的工具

通用工具名：`delegate_worker`。

| 参数 | 必填 | 含义 |
| --- | --- | --- |
| `description` | 是 | 3–5 词，进 Job 标签 |
| `prompt` | 是 | Bounded Task |
| `adapter` | 否 | `codex` / `claude-code` / `cursor` / `antigravity`。省略则用 Default Adapter |
| `run_in_background` | 否 | 默认 false。true 则返回 job id |

具名工具：官方两条沿用 `subagent_codex`、`subagent_claude_code`；本仓库新增 `worker_cursor`、`worker_antigravity`。参数不含 `adapter`，其余相同。未启用则整把工具不注册。

`backgroundMode` 固定 `one-shot`。`maxDepth` 固定 `provider-managed`。

父模型只收到最终文本或错误。产品 stderr、推理、diff、会话 id 不进父 Session。

## 7. Adapter 一览

| id | 可执行文件 | 官方入口 | 本插件的做法 |
| --- | --- | --- | --- |
| `codex` | `codex` | `codex app-server --stdio` | 挂载 `@deepseek-ai/dsh-subagent-codex` |
| `claude-code` | `claude` | Claude Agent SDK `query()` | 挂载 `@deepseek-ai/dsh-subagent-claude-code` |
| `cursor` | `cursor-agent` | `-p --output-format json --force --trust` | 本仓库实现 |
| `antigravity` | `agy` | `-p --output-format json --dangerously-skip-permissions` | 本仓库实现 |

探测失败不阻止插件加载。启用一个探测失败的 Adapter 时，工具调用以明确错误失败，设置卡显示原因。

每个已启用 Adapter 必须提供去掉首尾空白后的非空模型名，Control Plane 显式转发该模型；已禁用 Adapter 可以省略 `model`。

## 8. 设置分区

独立 `settings.section`，id 为 `external-agents`，文案「外部 Agent」（英文 External Agents）。不要只塞在「插件配置」里当一张杂项卡——Catalog + Default Adapter 需要一整页。

每张 Adapter 卡：

- 名称、一句职责、官方文档链接
- 探测：路径、版本（能取到就显示）、登录（能探测就显示，不能则写「由产品自身管理」）
- 启用
- 模型名（启用时必填）、额外 `env`、无人值守策略（自动批准 / 严格拒绝）
- 主按钮只做「启用 / 保存」。安装和登录是复制命令，不是本页的浏览器 OAuth

页顶：

- Default Adapter
- 一句说明：后台任务在会话头 Job Panel，不在本页

写入走本插件自己的 host RPC + 设置命名空间。第三方插件不一定进得了 api-proxy 的 settings 白名单，因此 RPC 是权威写入，设置命名空间能暴露就当缓存。见 [ADR 0002](adr/0002-settings-owns-exposure.md)。

## 9. 无人值守

产品工人没有 DSH 审批 UI 可回。v1 默认 **自动批准产品内部的工具/命令**（Cursor `--force`、Agy `--dangerously-skip-permissions`；官方 Codex/Claude 若提供方本身拒绝审批，则保持其失败即失败，不在本插件里伪造批准）。

设置里提供「严格」：能拒绝的请求一律拒绝，任务因此更容易失败。默认自动批准必须在卡上用一句话写清风险。见 [ADR 0005](adr/0005-unattended-auto-approve.md)。

## 10. Routing Skill

名称：`delegate-product-worker`。

技能只做路由，不 spawn：

- 何时委托：独立、可验收、值得付一次新上下文。
- 何时自己做：改一字、要看父对话、要做不可逆发布。
- 选谁：用户点名 > 具名工具 > Default Adapter。
- 怎么写 Bounded Task。
- 怎么验收，不得把工人的话当已证实。

见 [ADR 0006](adr/0006-routing-skill.md)。

## 11. 失败与取消

| 情况 | 对模型 | 对 Job Panel |
| --- | --- | --- |
| 未启用 / 未安装 / 未登录 | 明确错误，含设置页提示 | 不注册 Job |
| 产品非 0 退出或无最终文本 | `error` | `failed` + detail |
| 父级取消或 `job_kill` | `aborted` | `killed` |
| Codex 上下文耗尽 | 官方提供方的 `max-tokens` | `failed` |

取消必须拆掉产品进程树。已改的文件不回滚。

### 11.1 Plan 归属

本插件不拥有 Plan UI。外部 Agent 的 Plan 交接需要 DSH 官方提供已命名的委托 Plan 归属 seam；在该 seam 出现前，Plan 相关能力完全由 DSH 内置实现负责。

## 12. 非目标（v1）

- 续聊、`--resume`、把产品 session id 交给父模型
- 把父对话或 DSH 工具表拷进工人
- `@cursor/sdk` 云端 VM、Antigravity Cloud
- `gemini` CLI（Agy 是后续工人入口）
- 用户自定义 argv Adapter
- 人在 Job Panel 里点取消（等 DSH 官方做完）
- 进度流进父对话
- 在本插件里实现 OAuth
- 在 DSH 没有公开 delegated Plan resolution seam 时，本插件不提供 Plan 交接或 shadow `exit_plan_mode`
