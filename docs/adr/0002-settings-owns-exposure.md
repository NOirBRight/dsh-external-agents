# ADR 0002：设置页拥有 Exposure

状态：已采纳（用户确认：设置拥有 Exposure）

## 问题

官方 DSH 规定：Preset 决定模型看见哪些工具；Profile 只注册休眠的 provider。结果是用户必须复制预设并删 `disabled: true`。用户要的是供应商那样的可视化开关和默认项。

## 决策

Exposure 和 Default Adapter 由设置页拥有。Control Plane 在宿主平面按设置动态注册 Delegation Tool。官方预设里的 `tool-subagent-codex` / `tool-subagent-claude-code` 保持禁用，避免重复工具。

设置分区是独立的 `settings.section`（「外部 Agent」/ External Agents），不是「插件配置」里的一张杂项卡。

写入以本插件 host RPC 为准。第三方插件的 settings 命名空间不一定能进 api-proxy 白名单；命名空间能暴露就当镜像，不能暴露也不挡保存。

## 理由

「发现、启用、默认」是部署事实，不是某一次会话的 Agent 人格。放进 Preset 会让两个会话、一次复制、一次漏改 `disabled` 变成三种状态。供应商页已经证明：宿主能力用设置页开关，模型只消费结果。

独立 section 才能放下 Catalog 四张卡和 Default Adapter。插件卡 slot 给的是单插件表单，装不下「谁是默认」。

## 后果

- 与官方「Preset 拥有模型工具」不一致。本 Profile 里以本插件为准。
- 工具出现在该 Profile 的所有会话，包括子 Agent。产品工人是 `provider-managed` 深度，可接受。
- 关掉开关必须撤掉工具注册，从下一轮模型请求生效。

## 放弃的方案

**继续改 Preset YAML。** 没有发现面，也做不出 Default Adapter。

**设置只写用户 Preset 文件。** 脆弱，和官方 Preset 编辑器抢同一份文件。

**只注册通用工具，不注册具名工具。** 模型无法执行「交给 Codex」这种点名，Default Adapter 会变成隐形路由。
