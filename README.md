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

## 安装（dsh-lab）

本机验收装进 **dsh-lab**（`DSH_HOME=~/.dsh-lab`，GUI `http://127.0.0.1:3082`），不要改正在跑的 dsh-web。

```sh
pnpm install
pnpm run build
DSH_HOME=/home/noirbright/.dsh-lab dsh plugin --profile web add /home/noirbright/Workstation/dsh-external-agents
systemctl --user restart dsh-lab.service
```

lab 的 pnpm store 若与当前 `dsh plugin` 对不齐，可以直接把依赖写成 `link:`，并在 profile 的 `node_modules` 里做同名 symlink，再把 `dsh-external-agents` 追加到 `dsh.profile.bundles`。

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
