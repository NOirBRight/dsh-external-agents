# dsh-external-agents

DeepSeek Harness 的 **外部 Agent（Product Worker）控制面**：让本机已安装的 Codex、Claude Code、Cursor Agent、Antigravity CLI 作为一次性外部 Agent，并在设置里被发现、启用、设默认。

先读：

- [领域词汇](CONTEXT.md)
- [产品规格](docs/spec.md)
- [阶段划分](docs/roadmap.md)
- [决策记录](docs/adr/)
- [外部 CLI 契约](docs/reference/cli-contracts.md)
- [P0 lab 陷阱](docs/notes/p0-lab.md)

## 一句话

DSH 继续当编排器；第三方产品作为外部 Agent；设置页展示外部 Agent；Job Panel 展示后台任务。

## 不是什么

- 不是 `dsh-llm-cursor` 那种把 Cursor 私有接口当父模型的供应商。
- 不是再做一套 DSH 内置子代理（`subagent` / `subagent_fork`）。人话里「子代理」只指那些。
- 不是多 Agent 编排器（Orca / 委员会）。

## 当前进度

**P0 已在 lab 验收**：Codex 前台+后台，Claude Code 在仓库本地 sonnet 下前台通。

P0–P3 已在 lab 接线。技能 `delegate-product-worker` 只路由、不 spawn。

## Plan

本插件不拥有 Plan UI。外部 Agent 的 Plan 交接需要 DSH 官方提供已命名的委托 Plan 归属 seam；在该 seam 出现前，Plan 审查与执行完全由 DSH 内置能力负责。

## Development and lab verification

本机验收装进 **dsh-lab**（`DSH_HOME=~/.dsh-lab`，GUI `http://127.0.0.1:3082`），不要改正在跑的 dsh-web。

标准 `pnpm check` 在本插件的独立 checkout 中完成 build、test 与 pack gate。

```sh
pnpm install
pnpm check
npm pack --ignore-scripts
DSH_HOME=~/.dsh-lab dsh plugin --profile web add ./dsh-external-agents-0.2.1.tgz
systemctl --user restart dsh-lab.service
```

lab 安装必须使用 pack 后的 artifact；不要写源码 checkout alias、手工 symlink 或直接修改 profile bundle 清单。依赖 store 不完整时先完成正常安装，再重新打包验收。

装上之后，官方预设里的 `tool-subagent-codex` / `tool-subagent-claude-code` 保持 `disabled: true`。模型看到的是本插件在宿主平面注册的同名工具。

## P0 配置

默认（本仓库 `cordis.patch.yml`）打开四个 Adapter：

```yaml
- id: external-agents
  config:
    adapters:
      codex:
        enabled: true
        model: gpt-5.6-luna
      claude-code:
        enabled: true
        model: sonnet
      cursor:
        enabled: true
        model: auto
      antigravity:
        enabled: true
        model: gemini-3.7-flash-high
        env: {}
    defaultAdapter: codex
```

每个已启用 Adapter 必须填写去掉首尾空白后的非空 `model`；已禁用 Adapter 可以省略 `model`。`env` 只传给该外部 Agent。用户可以自己填 `HTTPS_PROXY` 等；本插件不内置、不公布任何代理端点。

关掉某一个：在 profile 的 `cordis.patch.yml` 覆盖整份 config，把对应 `enabled` 设为 `false`。下一轮模型请求不再看到那把工具。

后台任务出现在会话头 Job Panel（`kind: subagent`），不要找第二套任务 UI。


## Release installation (Latest)

External Agent control plane for Codex, Claude Code, Cursor Agent, and Antigravity adapters. The release artifact targets DeepSeek Harness 0.1.2-alpha.1 and contains built Host/Client files only; it has no sibling-repository source, workstation path, link:, or workspace: dependency.

Latest installation (the URL never contains a version):

~~~sh
dsh plugin --profile web add --force \
  https://github.com/NOirBRight/dsh-external-agents/releases/latest/download/dsh-external-agents.tgz
~~~

Fixed-version installation:

~~~sh
dsh plugin --profile web add --force \
  https://github.com/NOirBRight/dsh-external-agents/releases/download/v0.2.1/dsh-external-agents.tgz
~~~

Update, uninstall, and verify:

~~~sh
# Update to the latest Release
dsh plugin --profile web add --force \
  https://github.com/NOirBRight/dsh-external-agents/releases/latest/download/dsh-external-agents.tgz
# Verify the loaded version
dsh plugin --profile web list
dsh plugin --profile web doctor
# Uninstall only this plugin
dsh plugin --profile web remove dsh-external-agents
~~~

Configuration: use the plugin section in Settings for Web UI plugins, or the profile dsh.profile.bundles entry for Host-only plugins. Start with this README's minimal YAML/JSON example and provide credentials/backend addresses explicitly.

Rollback: rerun the fixed v0.2.1 command, verify the profile list, then restart the Web service once. Inspect journalctl --user -u dsh-web.service and dsh plugin --profile web doctor; never put a source checkout in the production profile.

Release and integrity: [v0.2.1](https://github.com/NOirBRight/dsh-external-agents/releases/tag/v0.2.1) · [SHA256SUMS](https://github.com/NOirBRight/dsh-external-agents/releases/download/v0.2.1/SHA256SUMS).
