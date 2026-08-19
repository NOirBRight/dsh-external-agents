# ADR 0003：一次性委托，后台进 Job Panel

状态：已采纳

## 问题

产品工人要不要做成可续聊子会话？进度给人看什么？

## 决策

v1 只有 One-shot Job。Delegation Tool 使用 `backgroundMode: one-shot`。省略 `run_in_background` 则前台等待；显式 true 则 `ctx.jobs.start({ kind: 'subagent' })`，出现在 DSH Job Panel。

不把产品 session id 写入父 Session。不做本插件自己的任务列表。

## 理由

官方 Codex / Claude Code provider 明确不做续聊、不做父上下文、只交最终文本。Cursor `--print` 和 Agy `--print` 也是一次进程一次答案。续聊会逼出另一套产品协议（resume、审批、多轮 stdin），而 Job Panel 已经能看后台 one-shot。

## 后果

- 每次委托付一次新的产品上下文。
- 父 Agent 不能「对同一个 Codex 线程补一句」。要补就再开一次，自己在 Bounded Task 里写清上文。
- 人暂时不能从 Job Panel 点取消（DSH 官方未做完）；模型可以 `job_kill`。

## 放弃的方案

**continuable + `send_message`。** 官方提供方没有 `prepareContinuable`，Cursor/Agy 的 print 模式也不是会话服务器。

**自建侧栏。** 和 Job Panel、子 Agent 目录叠三份。
