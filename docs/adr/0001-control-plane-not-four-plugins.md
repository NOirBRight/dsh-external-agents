# ADR 0001：一个控制面，不是四个插件

状态：已采纳

## 问题

要接 Codex、Claude Code、Cursor Agent、Antigravity 四个 Product Worker。可以发四个 npm 包，也可以发一个宿主插件。

## 决策

做一个 Control Plane 插件。它挂载全部 Adapter，拥有 Catalog、Exposure 和 Default Adapter。官方两条通过依赖并挂载 `@deepseek-ai/dsh-subagent-codex` / `@deepseek-ai/dsh-subagent-claude-code` 接入，不重写产品协议。Cursor 与 Antigravity 的 print-json 协议在本仓库实现。

## 理由

设置页要一张清单和「默认叫谁」。四个包会把发现、默认、开关拆成四份配置，用户还是要改 YAML。官方生产 dsh 不自带那两个 provider，本插件正好补上「一键打开」。

## 后果

- 安装一次即可。
- 单个 Adapter 的协议 bug 仍隔离在自己的模块里，但发布周期绑在一起。
- 本插件依赖官方 provider 包的版本；对不齐时在 roadmap P0 用 workspace / link 钉死。

## 放弃的方案

**四个独立包。** 更接近上游，但设置页和 Default Adapter 没有家。

**只做 Cursor / Antigravity，官方两条让用户自己装。** 用户要的第一件事就是「打开官方功能」，拆开会让 P0 验收落空。
