# ADR 0005：无人值守默认自动批准

状态：已采纳

## 问题

产品工人会问「能不能跑这条命令」。本插件没有把产品审批桥回 DSH 的人机 UI。官方 Codex / Claude 提供方选择拒绝未知审批，任务常常直接失败。

## 决策

v1 默认自动批准产品内部工具（Cursor `--force` / `--trust`，Agy `--dangerously-skip-permissions`）。设置卡提供「严格」：能拒绝就拒绝。

官方 Codex / Claude 提供方若本身没有自动批准开关，则不在本插件伪造批准，行为保持上游的失败即失败。若上游后来暴露配置，再接到同一设置项。

注意：产品 CLI `claude` 有 `--dangerously-skip-permissions` / `--permission-mode`（见 [cli-contracts](../reference/cli-contracts.md)）。「没有开关」指的是 `@deepseek-ai/dsh-subagent-claude-code` 没把这些接到自己的 Config，不是 Claude 没有旗标。

卡上必须用一句话写清：自动批准等于该产品在本工作区可以改文件、跑命令。

## 理由

用户要的是能干活的工人。print 模式卡住等一个不存在的 TTY，等于坏掉。严格模式留给不信任该产品的人。

## 后果

- 默认更危险，必须在 UI 上可见。
- 与官方 Codex/Claude 的「拒绝审批」不对称，设置卡要写明白。
- 本插件不回滚工人已经改过的文件。

## 放弃的方案

**一律拒绝。** 安全，但 P1 验收过不了任何写文件任务。

**把产品审批接到 DSH ask_user。** 协议各异，v1 范围过大。
