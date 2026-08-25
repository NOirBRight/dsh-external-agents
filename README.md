# dsh-external-agents

DeepSeek Harness 的 **外部 Agent（Product Worker）控制面**：让本机已安装的 Codex、Claude Code、Cursor Agent、Antigravity CLI 当一次性工人，并在设置里被发现、启用、设默认。

先读：

- [领域词汇](CONTEXT.md)
- [产品规格](docs/spec.md)
- [阶段划分](docs/roadmap.md)
- [决策记录](docs/adr/)
- [外部 CLI 契约](docs/reference/cli-contracts.md)
- [P0 lab 陷阱](docs/notes/p0-lab.md)

## 一句话

DSH 继续当编排器；第三方产品继续当工人；设置页让人看得到工人；Job Panel 让人看得到活。

## 不是什么

- 不是 `dsh-llm-cursor` 那种把 Cursor 私有接口当父模型的供应商。
- 不是再做一套 DSH 内置子代理（`subagent` / `subagent_fork`）。人话里「子代理」只指那些。
- 不是多 Agent 编排器（Orca / 委员会）。

## 当前进度

**P0 已在 lab 验收**：Codex 前台+后台，Claude Code 在仓库本地 sonnet 下前台通。

P0–P3 已在 lab 接线。技能 `delegate-product-worker` 只路由、不 spawn。

## Plan 执行路由

在干净的官方 DSH 0.1.1-rc.2 上，Plan Review 没有公开、安全的外部交接 seam。本插件因此失败关闭：外部 Agent 目标会显示但不可选，不会 prepare、回答或取消 Plan 问题、commit，也不会启动 Worker。继续在 DSH 执行仍走官方批准答案；设置、探测、普通前台/后台委托和 Jobs 不受影响。

与 `dsh-composer-picker` 双装时，本插件仍以 priority `-6` 拥有顶层 `conversation.composer` 路由卡，并保留插件拥有的 `external-agents.plan-review.continue-in-dsh` child slot。picker 可以继续接入 DSH 执行模型选择；本插件单装时 Continue in DSH 使用当前模型。

完整 shadow `exit_plan_mode` 当前未获 ADR 授权，不实现。未来只有 Core 提供公开、可验证的 delegated Plan resolution seam，或另开 ADR 批准 shadow 方案后，才恢复外部 Plan 交接。见 [ADR 0007](docs/adr/0007-plan-handoff-fails-closed.md)。

## 安装（dsh-lab）

本机验收装进 **dsh-lab**（`DSH_HOME=~/.dsh-lab`，GUI `http://127.0.0.1:3082`），不要改正在跑的 dsh-web。

```sh
pnpm install
pnpm check
npm pack --ignore-scripts
DSH_HOME=~/.dsh-lab dsh plugin --profile web add ./dsh-external-agents-0.1.0.tgz
systemctl --user restart dsh-lab.service
```

lab 安装必须使用 pack 后的 artifact；不要写源码 checkout alias、手工 symlink 或直接修改 profile bundle 清单。依赖 store 不完整时先完成正常安装，再重新打包验收。

装上之后，官方预设里的 `tool-subagent-codex` / `tool-subagent-claude-code` 保持 `disabled: true`。模型看到的是本插件在宿主平面注册的同名工具。

## P0 配置

默认（本仓库 `cordis.patch.yml`）打开 Codex 与 Claude Code：

```yaml
- id: external-agents
  config:
    adapters:
      codex:
        enabled: true
      claude-code:
        enabled: true
      cursor:
        enabled: true
      antigravity:
        enabled: true
        env: {}
    defaultAdapter: codex
```

每个 Adapter 的 `env` 只传给该工人。用户可以自己填 `HTTPS_PROXY` 等；本插件不内置、不公布任何代理端点。

关掉某一个：在 profile 的 `cordis.patch.yml` 覆盖整份 config，把对应 `enabled` 设为 `false`。下一轮模型请求不再看到那把工具。

后台任务出现在会话头 Job Panel（`kind: subagent`），不要找第二套任务 UI。
