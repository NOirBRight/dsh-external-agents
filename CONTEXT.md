# Domain: Product Workers

DSH 会话把独立、自包含的任务交给**本机已安装的第三方编码产品**执行，并只收回最终文本。本文件只记录术语与关系，不记录实现。

## Glossary

### Native Subagent

DSH 自己的子会话：`subagent` / `subagent_fork`。同一套 harness、可续聊、出现在会话头的子代理目录。人话就叫「子代理」，本产品不再占用这个词。

### Product Worker

一个**进程外**的第三方编码产品，在父会话工作区里独立完成一次任务后退出。它有自己的 harness、模型、登录态和工具。父会话不把对话、persona 或 DSH 工具表交给它。

人话：**外部 Agent**。设置分区、按钮、技能描述都用这个词。英文分区名：External Agents。

不是：Native Subagent。不是：把该产品当父模型用的 LLM 供应商。

### Adapter

把某一个 Product Worker 接到 DSH `ctx.subagents` 上的适配器。每个 Adapter 有稳定 id：`codex`、`claude-code`、`cursor`、`antigravity`。Adapter 负责启动官方入口、提交一段文本任务、把产品终态映射成 DSH 的完成 / 失败 / 取消。

不是：模型供应商。不是：用户在设置里手写的任意 shell 命令（v1 不提供）。

### Control Plane

本插件。它在宿主平面注册全部 Adapter、探测本机产品是否可用、按用户选择决定模型能看到哪些委托工具，并提供「外部 Agent」设置页。一个 Profile 只装这一份。

不是：四个互不相干的 npm 包。不是：Agent Preset 编辑器。不是：子代理目录。

### Catalog

设置页上的 Adapter 清单。每一行是探测结果（可执行文件是否在 PATH、是否已登录、是否已启用）加上该 Adapter 的用户配置。Catalog 反映**这台机器此刻的部署事实**，不是一份静态营销列表。

### Exposure

某个 Adapter 是否对模型可见。启用后，模型才能调用对应的委托工具。未启用的 Adapter 仍可出现在 Catalog 里（用于发现和登录），但没有工具、也不会启动产品进程。

Exposure 的唯一主人是设置页，不是 YAML 里的 `disabled: true` 预设行。

### Default Adapter

当模型调用通用工具、且没有点名某一个产品时，Control Plane 选用的 Adapter。必须是当前已启用且探测为可用的 Adapter。用户可以钉死一个；未钉死时取 Catalog 中第一个可用且已启用的。

不是：父会话的默认 LLM。不是：产品内部自己的默认模型。

### Delegation Tool

模型看到的工具。v1 有两类：

- 通用工具 `delegate_worker`：走 Default Adapter。
- 具名工具：官方两条沿用 `subagent_codex` / `subagent_claude_code`（上游已定名）；本仓库新增 `worker_cursor` / `worker_antigravity`。只在对应 Adapter 已启用时存在。

两类都是一次性委托。模型可以选择前台等待，或后台拿到 Job 再继续。

### One-shot Job

一次委托对应一个新的产品进程、一个不可恢复的产品会话、一条最终文本。后台运行时登记到 DSH 通用 `ctx.jobs`，出现在会话头的 Job Panel。

不是：可续聊的 DSH 子会话。不是：产品自己的 resume / conversation id 对父模型公开。

### Native Login

产品自己的安装与登录。Control Plane 不代替 `codex login` / `claude` / `cursor-agent login` / `agy` 做账号体系，不保存这些产品的 refresh token，不把它们的私有 HTTP API 当推理面。

### Bounded Task

交给 Product Worker 的那段独立文本。必须自包含：目标、路径、验收、禁止事项。父对话不会被复制过去，所以漏写等于漏做。

### Routing Skill

教父 Agent **何时**委托、**委托给谁**、**如何写 Bounded Task**、**如何验收**的技能。它不替代 Delegation Tool，也不自己 spawn 进程。

## Relationships

- 一个 Control Plane 拥有一份 Catalog。
- 一个 Adapter 对应零或一个本机产品安装。
- 一个已启用的 Adapter 贡献零或一个具名 Delegation Tool，并可以作为 Default Adapter。
- 一次委托产生一个 One-shot Job；Job 的人机视图是 DSH Job Panel，不是本插件的第二套面板。
- Native Login 属于产品；Exposure 和 Default Adapter 属于用户；Bounded Task 属于父 Agent。

## Invariants

1. 加载 Control Plane 不得启动任何产品进程。
2. 未启用的 Adapter 对模型不可见。
3. 父模型只看见最终文本或明确失败，看不见产品内部的推理、工具轨迹或 diff。
4. 产品会话 id 不写入父 Session，也不能用来续聊。
5. 本插件不把第三方产品当作 DSH 的 LLM 供应商。
