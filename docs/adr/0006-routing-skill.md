# ADR 0006：技能只路由，不 spawn

状态：已采纳（用户确认：具名工具 + 通用 `delegate_worker` 都要）

## 问题

Codex 社区的 luna worker 有两种做法：技能里塞 `codex exec` 脚本，或定义一个自定义 agent 再教模型去调。本产品已经有 Delegation Tool，还要不要技能？

## 决策

要技能，但技能禁止 spawn。`delegate-product-worker` 只规定：何时委托、选哪个 Adapter、Bounded Task 写什么、如何验收。真正启动工人的是 Delegation Tool。

父 Agent 点名产品时用具名工具；没点名时用 `delegate_worker`。

## 理由

luna 脚本那条路绕开了 Job Panel、取消和统一错误。工具已经存在时，再给一份 bash 会让模型走两条生命周期。技能的价值是路由判断，不是再做一次进程管理。

## 后果

- 技能不装也能调工具；技能提高选对工人、写全任务的概率。
- 技能描述必须写清触发支：用户提到 Codex / Claude / Cursor / Antigravity / 外部 Agent，或任务明显独立可验收。

## 放弃的方案

**技能内 `bash cursor-agent -p`。** 重复、看不见 Job、取消不一致。

**不做技能。** 模型容易把工人当内置 `subagent`，或把整段对话当成工人已经知道的上下文。
