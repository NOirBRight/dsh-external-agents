export type ExternalAgentsKey =
  | 'nav'
  | 'title'
  | 'jobNote'
  | 'sectionIntro'
  | 'inUse'
  | 'setDefault'
  | 'refresh'
  | 'enabledBadge'
  | 'missingBadge'
  | 'productDefault'
  | 'model'
  | 'modelHint'
  | 'locate'
  | 'loginManaged'
  | 'loggedIn'
  | 'env'
  | 'envHint'
  | 'unattended'
  | 'unattendedAuto'
  | 'unattendedStrict'
  | 'unattendedHint'
  | 'probeMissing'
  | 'probeFound'
  | 'docs'
  | 'save'
  | 'saved'
  | 'failed'
  | 'loading'
  | 'blurb.codex'
  | 'blurb.claude-code'
  | 'blurb.cursor'
  | 'blurb.antigravity'
  | 'install.codex'
  | 'install.claude-code'
  | 'install.cursor'
  | 'install.antigravity'

export const zh: Record<ExternalAgentsKey, string> = {
  nav: '外部 Agent',
  title: '外部 Agent',
  jobNote: '后台任务出现在会话头 Job Panel，不在本页。',
  sectionIntro: '模型会同时看到所有已启用工人的具名工具。点卡片只改默认：delegate_worker 没写 adapter 时走这一张。未检测到 CLI 时点「选择可执行文件」。',
  inUse: '默认',
  setDefault: '设为默认',
  refresh: '重新探测',
  enabledBadge: '已启用',
  missingBadge: '未安装',
  productDefault: '产品默认',
  model: '模型',
  modelHint: '产品默认',
  locate: '选择可执行文件',
  loginManaged: '由产品管理登录',
  loggedIn: '已登录',
  env: '环境变量',
  envHint: '每行 KEY=value，只传给这个工人。不要在这里填共享密钥到文档里。',
  unattended: '无人值守',
  unattendedAuto: '自动批准（可改文件、跑命令）',
  unattendedStrict: '严格：能拒绝就拒绝',
  unattendedHint: '自动批准等于该产品在本工作区可以改文件、跑命令。官方 Codex / Claude Code 若提供方本身拒绝审批，则保持失败即失败。',
  probeMissing: '未找到可执行文件',
  probeFound: '已找到',
  docs: '官方文档',
  save: '保存',
  saved: '已保存。下一轮模型请求生效。',
  failed: '保存失败',
  loading: '正在探测本机工人…',
  'blurb.codex': 'OpenAI Codex CLI，一次性工人。',
  'blurb.claude-code': 'Anthropic Claude Code，一次性工人。',
  'blurb.cursor': '官方 cursor-agent CLI，一次性工人。',
  'blurb.antigravity': 'Google Antigravity CLI（agy），一次性工人。',
  'install.codex': '安装后运行：codex login',
  'install.claude-code': '安装 Claude Code 并完成原生登录',
  'install.cursor': '安装后运行：cursor-agent login',
  'install.antigravity': '安装 agy 并用产品自己的方式登录',
}

export const en: Record<ExternalAgentsKey, string> = {
  nav: 'External Agents',
  title: 'External Agents',
  jobNote: 'Background work shows up in the session-header Job Panel, not on this page.',
  sectionIntro: 'The model sees a named tool for every enabled worker. Click a card to set the default used when delegate_worker omits adapter. If a CLI is missing, use Locate executable.',
  inUse: 'Default',
  setDefault: 'Set as default',
  refresh: 'Rescan',
  enabledBadge: 'Enabled',
  missingBadge: 'Not installed',
  productDefault: 'Product default',
  model: 'Model',
  modelHint: 'Product default',
  locate: 'Locate executable',
  loginManaged: 'Sign-in is managed by the product',
  loggedIn: 'Signed in',
  env: 'Environment',
  envHint: 'One KEY=value per line. Applied only to this worker.',
  unattended: 'Unattended',
  unattendedAuto: 'Auto-approve (can edit files and run commands)',
  unattendedStrict: 'Strict: deny when the product can deny',
  unattendedHint: 'Auto-approve means this product may change files and run commands in this workspace. Official Codex / Claude Code stay fail-closed if their provider has no approve switch.',
  probeMissing: 'Executable not found',
  probeFound: 'Found',
  docs: 'Docs',
  save: 'Save',
  saved: 'Saved. The next model request picks this up.',
  failed: 'Save failed',
  loading: 'Probing local workers…',
  'blurb.codex': 'OpenAI Codex CLI as a one-shot worker.',
  'blurb.claude-code': 'Anthropic Claude Code as a one-shot worker.',
  'blurb.cursor': 'Official cursor-agent CLI as a one-shot worker.',
  'blurb.antigravity': 'Google Antigravity CLI (agy) as a one-shot worker.',
  'install.codex': 'After install, run: codex login',
  'install.claude-code': 'Install Claude Code and complete native login',
  'install.cursor': 'After install, run: cursor-agent login',
  'install.antigravity': 'Install agy and sign in with the product itself',
}
