# ADR 0007：Plan 外部交接在无公开 seam 时失败关闭

状态：已采纳

## 问题

DSH 0.1.1-rc.2 的公开 Plan Review 接口只允许回答或取消 pending question。它没有“当前 Agent 停止、但计划交给外部 Product Worker”的公开结果，也没有把 cancel receipt 委托给插件 Host 的不可伪造令牌。用自定义答案 sentinel 伪造第三种结果依赖 Core 私有行为，并可能被 Core 当普通答案处理。

## 决策

在干净的官方 DSH 0.1.1-rc.2 上，External Agents 的 Plan 路由卡仍占有顶层 `conversation.composer` priority `-6`，并保留插件拥有的 `external-agents.plan-review.continue-in-dsh` child slot，供 composer-picker 集成。继续在 DSH 中执行仍使用官方 approve 答案。

外部 Product Worker 目标在此卡中可见但明确标为不可用。选择外部目标不得调用 prepare、回答或取消 pending question、commit，亦不得启动 Worker。插件不再发送自定义答案 sentinel，也不提供可从官方 rc.2 UI 触发的 Plan handoff RPC。

## 理由

失败关闭避免 DSH Agent 与 Product Worker 双执行，也避免把未获 Core 承认的自定义答案当协议。保留卡与 child slot 则维持 composer-picker 的稳定组合 seam，并不影响设置、探测、普通前台/后台委托或 Job Panel。

## 后果

- Plan Review 中可继续在 DSH 执行、继续规划或讨论。
- 外部 Plan 交接会显示上游能力尚不可用，且在任何有副作用的阶段之前停止。
- 普通 Delegation Tool 仍可前台或后台启动 Product Worker；后台 run/cancel/done handle 交给官方 Jobs service，重载或重连后的展示与恢复也由该 service 拥有，插件不复制 Job ledger。
- 以前生成的 Plan handoff ledger 不再读取或写入；文件若存在也被忽略。

## 未来方案

只有 Core 提供公开、可验证的 delegated Plan resolution seam 后，才恢复 prepare/cancel/commit 状态机。完整 shadow `exit_plan_mode` 会复制 Core 的 Plan Review 与继续执行语义，当前 ADR 不授权实现；若未来确需该方案，必须另开 ADR。

## 放弃的方案

**自定义答案 sentinel。** 依赖未公开的答案解释，无法在干净官方版本上保证不会继续原 Agent。

**完整 shadow `exit_plan_mode`。** 范围过大且没有既有 ADR 授权。
