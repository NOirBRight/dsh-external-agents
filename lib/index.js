import z from "@deepseek-ai/schemastery";
import * as subagentClaudeCode from "@deepseek-ai/dsh-subagent-claude-code";
import * as subagentCodex from "@deepseek-ai/dsh-subagent-codex";
import * as toolSubagent from "@deepseek-ai/dsh-tool-subagent";
import { NO_START_CAPABILITIES, assertPositiveFinite, resolveChildCwd, settleRun, settleRunResult, subprocessRunHandle } from "@deepseek-ai/dsh-subagent";
import { defineTool } from "@deepseek-ai/dsh-tools";
import { randomUUID } from "node:crypto";
import { SessionId } from "@deepseek-ai/dsh-session";
import { MAX_TIMER_DELAY_MS } from "@deepseek-ai/dsh-timeout";
import { execFile } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
//#region lib/types/catalog.js
/**
* Closed shipped Adapter set. New workers require a new ADR.
* @module dsh-external-agents/catalog
*/
const ADAPTER_IDS = [
	"codex",
	"claude-code",
	"cursor",
	"antigravity"
];
/** Official DSH packages this plugin mounts. */
const OFFICIAL_ADAPTER_IDS = ["codex", "claude-code"];
/** Adapters this plugin implements (official packages plus print-json workers). */
const IMPLEMENTED_ADAPTER_IDS = [
	"codex",
	"claude-code",
	"cursor",
	"antigravity"
];
const ADAPTERS = {
	codex: {
		id: "codex",
		provider: "codex",
		toolName: "subagent_codex",
		executable: "codex",
		displayName: "Codex",
		implemented: true,
		docsUrl: "https://developers.openai.com/codex",
		loginMode: "product-managed",
		supportsUnattended: false,
		knownModels: [
			{
				id: "gpt-5.6-sol",
				label: "GPT-5.6 Sol"
			},
			{
				id: "gpt-5.6-terra",
				label: "GPT-5.6 Terra"
			},
			{
				id: "gpt-5.6-luna",
				label: "GPT-5.6 Luna"
			}
		]
	},
	"claude-code": {
		id: "claude-code",
		provider: "claude-code",
		toolName: "subagent_claude_code",
		executable: "claude",
		displayName: "Claude Code",
		implemented: true,
		docsUrl: "https://code.claude.com/docs/en/overview",
		loginMode: "product-managed",
		supportsUnattended: false,
		knownModels: [
			{
				id: "fable",
				label: "Fable"
			},
			{
				id: "opus",
				label: "Opus"
			},
			{
				id: "sonnet",
				label: "Sonnet"
			},
			{
				id: "haiku",
				label: "Haiku"
			}
		]
	},
	cursor: {
		id: "cursor",
		provider: "cursor",
		toolName: "worker_cursor",
		executable: "cursor-agent",
		displayName: "Cursor Agent",
		implemented: true,
		docsUrl: "https://docs.cursor.com/en/cli/overview",
		loginMode: "cursor-status",
		supportsUnattended: true,
		knownModels: [
			{
				id: "auto",
				label: "Auto"
			},
			{
				id: "composer-2.5",
				label: "Composer 2.5"
			},
			{
				id: "gpt-5.3-codex",
				label: "Codex 5.3"
			},
			{
				id: "gpt-5.6-sol",
				label: "GPT-5.6 Sol"
			},
			{
				id: "cursor-grok-4.6-high",
				label: "Grok 4.6"
			},
			{
				id: "claude-opus-5-thinking-high",
				label: "Opus 5 Thinking"
			},
			{
				id: "claude-fable-5-thinking-high",
				label: "Fable 5 Thinking"
			},
			{
				id: "claude-sonnet-5-thinking-high",
				label: "Sonnet 5 Thinking"
			},
			{
				id: "gemini-3.7-flash-high",
				label: "Gemini 3.7 Flash"
			},
			{
				id: "kimi-k3-max",
				label: "Kimi K3"
			},
			{
				id: "kimi-k2.7-code",
				label: "Kimi K2.7 Code"
			},
			{
				id: "glm-5.2-high",
				label: "GLM 5.2"
			}
		]
	},
	antigravity: {
		id: "antigravity",
		provider: "antigravity",
		toolName: "worker_antigravity",
		executable: "agy",
		displayName: "Antigravity",
		implemented: true,
		docsUrl: "https://www.antigravity.google/docs/cli-overview",
		loginMode: "product-managed",
		supportsUnattended: true,
		knownModels: [
			{
				id: "gemini-3.7-flash-high",
				label: "Gemini 3.7 Flash"
			},
			{
				id: "gemini-3.1-pro-high",
				label: "Gemini 3.1 Pro"
			},
			{
				id: "claude-sonnet-4-6",
				label: "Claude Sonnet 4.6"
			},
			{
				id: "claude-opus-4-6-thinking",
				label: "Claude Opus 4.6"
			},
			{
				id: "gpt-oss-120b-medium",
				label: "GPT-OSS 120B"
			}
		]
	}
};
const GENERIC_TOOL_NAME = "delegate_worker";
const ENABLE_HINT = "在设置的「外部 Agent」页启用该工人，或在 profile 的 cordis.patch.yml 里改 adapters.<id>.enabled。";
function isAdapterId(value) {
	return ADAPTER_IDS.includes(value);
}
function isImplementedAdapterId(value) {
	return IMPLEMENTED_ADAPTER_IDS.includes(value);
}
//#endregion
//#region lib/types/exposure.js
/**
* Exposure: which Delegation Tools the model may see.
* Settings (P0: this plugin's config) own this; Agent Preset rows stay disabled.
* @module dsh-external-agents/exposure
*/
function isEnabled(config, id) {
	return config.adapters?.[id]?.enabled !== false;
}
/** Resolve live named tools and the Default Adapter from plugin config. */
function resolveExposure(config) {
	const named = [];
	for (const id of IMPLEMENTED_ADAPTER_IDS) {
		const descriptor = ADAPTERS[id];
		if (!isEnabled(config, id)) continue;
		named.push({
			adapter: id,
			provider: descriptor.provider,
			toolName: descriptor.toolName
		});
	}
	const enabledIds = named.map((row) => row.adapter);
	const pinned = config.defaultAdapter;
	const defaultAdapter = pinned !== void 0 && isImplementedAdapterId(pinned) && enabledIds.includes(pinned) ? pinned : enabledIds[0];
	return {
		named,
		defaultAdapter,
		delegateWorker: defaultAdapter !== void 0
	};
}
/** Pick the provider for one delegate_worker call. */
function resolveDelegationTarget(exposure, requested) {
	if (requested !== void 0 && requested !== "") {
		if (!isAdapterId(requested)) return {
			ok: false,
			error: `未知的 Adapter「${requested}」。可用：${ADAPTER_IDS.join("、")}。`
		};
		const descriptor = ADAPTERS[requested];
		if (!descriptor.implemented || !isImplementedAdapterId(requested)) return {
			ok: false,
			error: `Adapter「${descriptor.displayName}」尚未实现。${ENABLE_HINT}`
		};
		if (!exposure.named.some((row) => row.adapter === requested)) return {
			ok: false,
			error: `外部 Agent「${descriptor.displayName}」未启用。${ENABLE_HINT}`
		};
		return {
			ok: true,
			adapter: requested,
			provider: descriptor.provider
		};
	}
	if (exposure.defaultAdapter === void 0) return {
		ok: false,
		error: `没有已启用的外部 Agent，无法调用 ${GENERIC_TOOL_NAME}。${ENABLE_HINT}`
	};
	return {
		ok: true,
		adapter: exposure.defaultAdapter,
		provider: ADAPTERS[exposure.defaultAdapter].provider
	};
}
//#endregion
//#region lib/types/delegate-worker.js
/**
* Generic Delegation Tool. Routes to the Default Adapter or an explicit one.
* @module dsh-external-agents/delegate-worker
*/
function outputValueText(values) {
	return values.filter((value) => typeof value === "object" && value !== null && !Array.isArray(value) && value.type === "text" && typeof value.text === "string").map((value) => value.text).join("");
}
function stopReasonError(result) {
	switch (result.stopReason) {
		case "completed": return;
		case "aborted": return "外部 Agent 运行被取消";
		case "error": return "外部 Agent 运行失败";
		case "max-tokens": return "外部 Agent 在完成前耗尽了上下文";
		case "refusal": return "外部 Agent 拒绝了该任务";
		default: return `外部 Agent 异常结束（${String(result.stopReason)}）`;
	}
}
function withPartialText(error, output) {
	const text = output.filter((block) => block.type === "text").map((block) => block.text).join("");
	return text.length === 0 ? error : `${error}\n结束前的部分输出：\n${text}`;
}
async function settleForegroundRun(run) {
	const [execution] = await Promise.allSettled([run.result.then((result) => {
		const error = stopReasonError(result);
		if (error !== void 0) throw new Error(withPartialText(error, result.output));
		return {
			kind: "foreground",
			runId: run.id,
			output: result.output
		};
	})]);
	const [disposal] = await Promise.allSettled([Promise.resolve().then(() => run.dispose())]);
	if (execution.status === "rejected") {
		if (disposal.status === "rejected") throw new AggregateError([execution.reason, disposal.reason], `外部 Agent 运行失败：${String(execution.reason)}；dispose 失败：${String(disposal.reason)}`);
		throw execution.reason;
	}
	if (disposal.status === "rejected") throw disposal.reason;
	return execution.value;
}
async function settleStart(start, signal) {
	try {
		return await settleRun(await start);
	} catch (error) {
		return signal.aborted ? { status: "killed" } : {
			status: "failed",
			detail: String(error)
		};
	}
}
/** Register the generic delegate_worker tool against the current Exposure. */
function registerDelegateWorker(ctx, exposure) {
	return ctx.tools.register(defineTool({
		name: GENERIC_TOOL_NAME,
		description: "把一段自包含任务交给默认外部 Agent（本机第三方编码产品）一次性执行。父对话不会被复制过去，所以 prompt 必须写全目标、路径、验收和禁止事项。可用 adapter 点名 Codex / Claude Code；省略则走 Default Adapter。默认前台等待最终文本。设 run_in_background: true 则返回 job id，出现在会话头 Job Panel。",
		parameters: {
			description: {
				type: "string",
				required: true,
				description: "3–5 词，进入 Job 标签。"
			},
			prompt: {
				type: "string",
				required: true,
				description: "交给外部 Agent 的 Bounded Task。它看不到本对话，必须自包含。"
			},
			adapter: {
				type: "string",
				description: `点名一个 Adapter：${ADAPTER_IDS.join(" / ")}。省略则用 Default Adapter。`
			},
			run_in_background: {
				type: "boolean",
				description: "是否作为后台 Job 并立即返回 id。默认 false；用 job_output / job_kill 收集或取消。"
			}
		},
		output: {
			schema: { oneOf: [{
				type: "object",
				additionalProperties: false,
				properties: {
					kind: {
						type: "string",
						required: true,
						const: "background"
					},
					jobId: {
						type: "string",
						required: true
					}
				}
			}, {
				type: "object",
				additionalProperties: false,
				properties: {
					kind: {
						type: "string",
						required: true,
						const: "foreground"
					},
					runId: {
						type: "string",
						required: true
					},
					output: {
						type: "array",
						required: true,
						items: { type: "json" }
					}
				}
			}] },
			render: (_args, value) => [{
				type: "text",
				text: value.kind === "background" ? `started background subagent task ${value.jobId}` : outputValueText(value.output)
			}]
		},
		isConcurrencySafe: () => true,
		async execute(args, exec) {
			const parent = exec.agent;
			if (!parent) throw new Error("delegate_worker 需要调用方 Agent（exec.agent 为空）");
			const target = resolveDelegationTarget(exposure, args.adapter);
			if (!target.ok) throw new Error(target.error);
			const request = {
				label: args.description,
				prompt: [{
					type: "text",
					text: args.prompt
				}],
				parent
			};
			if (args.run_in_background === true) {
				const jobs = ctx.get("jobs");
				if (jobs === void 0) throw new Error("后台 Job 不可用：需要加载 @deepseek-ai/dsh-jobs");
				return {
					kind: "background",
					jobId: jobs.start({
						kind: "subagent",
						label: args.description,
						owner: parent,
						run: () => {
							const controller = new AbortController();
							return {
								cancel: (reason) => {
									controller.abort(reason ?? "background subagent task killed");
								},
								done: settleStart(ctx.subagents.start(target.provider, {
									...request,
									signal: controller.signal
								}), controller.signal)
							};
						}
					})
				};
			}
			return settleForegroundRun(await ctx.subagents.start(target.provider, {
				...request,
				signal: exec.signal
			}));
		}
	}));
}
//#endregion
//#region lib/types/print-json-argv.js
/**
* Product CLI argv for print-json one-shot workers.
* @module dsh-external-agents/print-json-argv
*/
function cursorArgv(input) {
	const argv = [
		input.executable,
		"-p",
		"--output-format",
		"json"
	];
	if (input.unattended === "auto") argv.push("--force");
	argv.push("--trust", "--workspace", input.cwd);
	if (input.model !== void 0 && input.model.length > 0) argv.push("--model", input.model);
	argv.push("--", input.task);
	return argv;
}
function agyArgv(input) {
	const argv = [input.executable];
	if (input.unattended === "auto") argv.push("--dangerously-skip-permissions");
	argv.push("--output-format", "json");
	argv.push("--print-timeout", String(Math.floor(input.printTimeoutMs / 1e3)) + "s");
	if (input.model !== void 0 && input.model.length > 0) argv.push("--model", input.model);
	argv.push("--print", input.task);
	return argv;
}
//#endregion
//#region lib/types/print-json-result.js
/**
* Shared one-shot print-json result mapping for Cursor Agent and Agy.
* @module dsh-external-agents/print-json-result
*/
function lastJsonObject(stdout) {
	const trimmed = stdout.trim();
	if (trimmed.length === 0) return void 0;
	try {
		return JSON.parse(trimmed);
	} catch {
		const start = trimmed.lastIndexOf("{");
		if (start < 0) return void 0;
		try {
			return JSON.parse(trimmed.slice(start));
		} catch {
			return;
		}
	}
}
function asRecord$1(value) {
	if (value === null || typeof value !== "object" || Array.isArray(value)) return void 0;
	return value;
}
function loginHint(product, stderr) {
	const text = stderr.toLowerCase();
	if (product === "cursor") {
		if (text.includes("not logged") || text.includes("unauthoriz") || text.includes("please log") || text.includes("cursor-agent login")) return "Cursor Agent 未登录。请在本机运行 cursor-agent login。";
	}
	if (product === "agy") {
		if (text.includes("not logged") || text.includes("unauthoriz") || text.includes("please log") || text.includes("agy login")) return "Antigravity 未登录。请用 Agy 原生登录后再试。";
	}
}
/** Map one print-json process outcome to a final text or a readable error. */
function interpretPrintJson(input) {
	const login = loginHint(input.product, input.stderr);
	if (login !== void 0) return {
		ok: false,
		error: login
	};
	const record = asRecord$1(lastJsonObject(input.stdout));
	if (record !== void 0) {
		const result = record.result;
		const response = record.response;
		const subtype = record.subtype;
		const status = record.status;
		const isError = record.is_error;
		const text = typeof result === "string" && result.trim().length > 0 ? result : typeof response === "string" && response.trim().length > 0 ? response : void 0;
		const success = isError !== true && (subtype === void 0 || subtype === "success") && (status === void 0 || String(status).toLowerCase() === "success");
		if (text !== void 0 && success) return {
			ok: true,
			text: text.trim()
		};
		if (isError === true || typeof subtype === "string" && subtype !== "success") {
			const details = Array.isArray(record.errors) ? record.errors.filter((item) => typeof item === "string").join("; ") : void 0;
			const detail = details && details.length > 0 ? details : typeof result === "string" && result.trim().length > 0 ? result : typeof subtype === "string" ? subtype : "is_error";
			return {
				ok: false,
				error: input.displayName + " 失败：" + detail
			};
		}
	}
	if (input.exitCode !== 0 && input.exitCode !== null) {
		const tail = input.stderr.trim() || input.stdout.trim();
		if (tail.length > 0) return {
			ok: false,
			error: input.displayName + " 退出码 " + String(input.exitCode) + "：" + tail.slice(0, 2e3)
		};
		return {
			ok: false,
			error: input.displayName + " 退出码 " + String(input.exitCode) + "，且没有 JSON 最终文本。"
		};
	}
	return {
		ok: false,
		error: input.displayName + " 没有给出非空最终文本（需要 stdout JSON：subtype=success、is_error=false、result 非空）。"
	};
}
const STDOUT_MAX_BYTES = 2e6;
const STDERR_MAX_BYTES = 256e3;
function textTask(prefix, prompt) {
	if (prompt.length === 0) throw new Error(prefix + ": the one-shot task must contain only text blocks");
	const texts = [];
	for (const block of prompt) {
		if (block.type !== "text") throw new Error(prefix + ": the one-shot task must contain only text blocks");
		texts.push(block.text);
	}
	if (texts.every((text) => text.trim().length === 0)) throw new Error(prefix + ": the one-shot task must not be empty");
	return texts.join("");
}
function collectedText(reader) {
	return reader?.readFrom(0).text ?? "";
}
var PrintJsonProvider = class {
	name;
	product;
	displayName;
	binary;
	ctx;
	config;
	capabilities = NO_START_CAPABILITIES;
	inheritsParentContext = false;
	constructor(name, product, displayName, binary, ctx, config) {
		this.name = name;
		this.product = product;
		this.displayName = displayName;
		this.binary = binary;
		this.ctx = ctx;
		this.config = config;
	}
	async start(request) {
		const prefix = "subagent-" + this.name;
		const parentCwd = request.parent.session.header.cwd;
		if (parentCwd === void 0) throw new Error(prefix + ": no working directory for the child — delegate from a parent session that has one");
		const cwd = resolveChildCwd(prefix, void 0, parentCwd);
		const task = textTask(prefix, request.prompt);
		const executable = this.config.executable !== void 0 && this.config.executable.length > 0 ? this.config.executable : await this.ctx.subprocess.resolveExecutable(this.binary, this.config.env, request.signal);
		const argv = this.product === "cursor" ? cursorArgv({
			executable,
			cwd,
			task,
			unattended: this.config.unattended,
			...this.config.model !== void 0 ? { model: this.config.model } : {}
		}) : agyArgv({
			executable,
			task,
			unattended: this.config.unattended,
			printTimeoutMs: this.config.printTimeoutMs,
			...this.config.model !== void 0 ? { model: this.config.model } : {}
		});
		const controller = new AbortController();
		const requestCancel = () => {
			if (!controller.signal.aborted) controller.abort(/* @__PURE__ */ new Error(prefix + ": run cancelled locally"));
		};
		const onAbort = () => {
			requestCancel();
		};
		request.signal.addEventListener("abort", onAbort, { once: true });
		if (request.signal.aborted) {
			request.signal.removeEventListener("abort", onAbort);
			throw new Error(prefix + ": request was aborted before spawn");
		}
		const child = this.ctx.subprocess.spawn({
			argv,
			cwd,
			env: this.config.env,
			graceMs: this.config.disposeGraceMs,
			signal: controller.signal,
			stdio: {
				stdin: "ignore",
				stdout: { maxBytes: STDOUT_MAX_BYTES },
				stderr: { maxBytes: STDERR_MAX_BYTES }
			}
		});
		let lastFailure;
		const result = settleRunResult({
			attempt: async () => {
				const outcome = await child.done;
				const mapped = interpretPrintJson({
					product: this.product,
					displayName: this.displayName,
					exitCode: outcome.exitCode,
					stdout: collectedText(child.collected.stdout),
					stderr: collectedText(child.collected.stderr)
				});
				if (!mapped.ok) {
					lastFailure = mapped.error;
					throw new Error(mapped.error);
				}
				return {
					output: [{
						type: "text",
						text: mapped.text
					}],
					stopReason: "completed"
				};
			},
			collectOutput: () => {
				if (lastFailure !== void 0) return [{
					type: "text",
					text: lastFailure
				}];
				const stdout = collectedText(child.collected.stdout).trim();
				return stdout.length === 0 ? [] : [{
					type: "text",
					text: stdout.slice(0, 4e3)
				}];
			},
			cancelled: () => controller.signal.aborted,
			onError: (error, stopReason) => {
				this.ctx.logger.warn(prefix + ": child run failed (" + stopReason + "): " + error.message);
			},
			signal: request.signal,
			onAbort
		});
		return subprocessRunHandle({
			id: SessionId(randomUUID()),
			result,
			signal: request.signal,
			onAbort,
			requestCancel,
			teardown: async () => {
				child.terminate();
				await child.waitForExit();
			}
		});
	}
};
function resolveProviderConfig(config) {
	return {
		env: config.env ?? {},
		disposeGraceMs: config.disposeGraceMs ?? 3e3,
		unattended: config.unattended ?? "auto",
		printTimeoutMs: config.printTimeoutMs ?? 3e5,
		...config.model !== void 0 ? { model: config.model } : {},
		...config.executable !== void 0 ? { executable: config.executable } : {}
	};
}
function assertTiming(prefix, config) {
	assertPositiveFinite(prefix, "disposeGraceMs", config.disposeGraceMs);
	assertPositiveFinite(prefix, "printTimeoutMs", config.printTimeoutMs);
	if (config.disposeGraceMs > MAX_TIMER_DELAY_MS) throw new Error(prefix + ": disposeGraceMs must be no greater than " + String(MAX_TIMER_DELAY_MS));
	if (config.printTimeoutMs > MAX_TIMER_DELAY_MS) throw new Error(prefix + ": printTimeoutMs must be no greater than " + String(MAX_TIMER_DELAY_MS));
}
function applyCursorProvider(ctx, config = {}) {
	const resolved = resolveProviderConfig(config);
	assertTiming("subagent-cursor", resolved);
	ctx.subagents.registerProvider(new PrintJsonProvider("cursor", "cursor", "Cursor Agent", "cursor-agent", ctx, resolved));
}
function applyAntigravityProvider(ctx, config = {}) {
	const resolved = resolveProviderConfig(config);
	assertTiming("subagent-antigravity", resolved);
	ctx.subagents.registerProvider(new PrintJsonProvider("antigravity", "agy", "Antigravity", "agy", ctx, resolved));
}
const cursorPlugin = {
	name: "subagent-cursor",
	inject: ["subagents", "subprocess"],
	apply: applyCursorProvider
};
const antigravityPlugin = {
	name: "subagent-antigravity",
	inject: ["subagents", "subprocess"],
	apply: applyAntigravityProvider
};
//#endregion
//#region lib/types/probe.js
/** PATH / version / login probes. Never run synchronously from apply(). */
const execFileAsync = promisify(execFile);
const PROBE_TIMEOUT_MS = 2500;
async function commandOutput(command, args) {
	try {
		const { stdout, stderr } = await execFileAsync(command, args, {
			timeout: PROBE_TIMEOUT_MS,
			encoding: "utf8"
		});
		const text = (stdout || stderr).trim();
		return text.length === 0 ? void 0 : text;
	} catch {
		return;
	}
}
function parseCursorModels(text) {
	const ids = [];
	for (const line of text.split(/\r?\n/)) {
		const match = /^([A-Za-z0-9._:-]+)\s+-\s+/.exec(line.trim());
		if (match?.[1] !== void 0 && !ids.includes(match[1])) ids.push(match[1]);
	}
	return ids;
}
function parseAgyModels(text) {
	const ids = [];
	for (const line of text.split(/\r?\n/)) {
		const trimmed = line.trim();
		if (trimmed.length === 0 || /^fetching/i.test(trimmed)) continue;
		const id = trimmed.split(/\t/, 1)[0]?.trim();
		if (id !== void 0 && id.length > 0 && !ids.includes(id)) ids.push(id);
	}
	return ids;
}
function readCodexCachedModels() {
	try {
		const raw = readFileSync(join(homedir(), ".codex", "models_cache.json"), "utf8");
		return (JSON.parse(raw).models ?? []).filter((row) => row.visibility !== "hide" && typeof row.slug === "string").map((row) => row.slug);
	} catch {
		return [];
	}
}
async function listModels(id, resolved) {
	if (id === "claude-code") return [
		"fable",
		"opus",
		"sonnet",
		"haiku"
	];
	if (id === "codex") {
		const cached = readCodexCachedModels();
		return cached.length > 0 ? cached : void 0;
	}
	if (id === "cursor") {
		const text = await commandOutput(resolved, ["--list-models"]);
		const parsed = text === void 0 ? [] : parseCursorModels(text);
		return parsed.length > 0 ? parsed : void 0;
	}
	if (id === "antigravity") try {
		const { stdout, stderr } = await execFileAsync(resolved, ["models"], {
			timeout: 2e4,
			encoding: "utf8"
		});
		const parsed = parseAgyModels((stdout || stderr).trim());
		return parsed.length > 0 ? parsed : void 0;
	} catch {
		return;
	}
}
async function firstLine(command, args) {
	try {
		const { stdout, stderr } = await execFileAsync(command, args, {
			timeout: PROBE_TIMEOUT_MS,
			encoding: "utf8"
		});
		const text = (stdout || stderr).trim();
		if (text.length === 0) return void 0;
		return text.split(/\r?\n/, 1)[0];
	} catch {
		return;
	}
}
async function probeAdapter(id, resolveExecutable, signal, overridePath) {
	const descriptor = ADAPTERS[id];
	try {
		const resolved = overridePath !== void 0 && overridePath.length > 0 ? overridePath : await resolveExecutable(descriptor.executable, {}, signal);
		const [version, status] = await Promise.all([firstLine(resolved, ["--version"]), descriptor.loginMode === "cursor-status" ? firstLine(resolved, ["status"]) : Promise.resolve(void 0)]);
		let login = "product-managed";
		let loginDetail;
		if (status !== void 0 && /logged in/i.test(status)) {
			login = "ok";
			loginDetail = status.replace(/^✓\s*/, "");
		} else if (status !== void 0) {
			login = "unknown";
			loginDetail = status;
		}
		return {
			found: true,
			path: resolved,
			...version !== void 0 ? { version } : {},
			login,
			...loginDetail !== void 0 ? { loginDetail } : {}
		};
	} catch {
		return { found: false };
	}
}
async function probeAll(resolveExecutable, signal, paths) {
	const entries = await Promise.all(IMPLEMENTED_ADAPTER_IDS.map(async (id) => {
		if (signal.aborted) return [id, { found: false }];
		return [id, await probeAdapter(id, resolveExecutable, signal, paths?.[id])];
	}));
	return Object.fromEntries(entries);
}
async function probeModels(probes) {
	const entries = await Promise.all(IMPLEMENTED_ADAPTER_IDS.map(async (id) => {
		const current = probes[id];
		if (current?.found !== true || current.path === void 0) return [id, current];
		const models = await listModels(id, current.path);
		return [id, {
			...current,
			...models !== void 0 && models.length > 0 ? { models } : {}
		}];
	}));
	return Object.fromEntries(entries);
}
function startOfficialProbes(ctx) {
	const subprocess = ctx.get("subprocess");
	if (subprocess === void 0) return;
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
	(async () => {
		const probes = await probeAll(subprocess.resolveExecutable.bind(subprocess), controller.signal);
		for (const id of IMPLEMENTED_ADAPTER_IDS) {
			const probe = probes[id];
			const name = ADAPTERS[id].displayName;
			if (probe?.found === true) ctx.logger.info("external-agents: found " + name + " at " + String(probe.path));
			else ctx.logger.info("external-agents: " + name + " not found");
		}
	})().catch(() => void 0);
	ctx.effect(() => () => {
		clearTimeout(timer);
		controller.abort();
	});
}
//#endregion
//#region lib/types/routing-skill.js
/** Load and register the routing-only External Agents skill. */
const SKILL_REL = join("skills", "delegate-product-worker", "SKILL.md");
function routingSkillPath() {
	return join(dirname(fileURLToPath(import.meta.url)), "..", SKILL_REL);
}
function parseSkillMarkdown(raw) {
	const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(raw);
	if (match === null) throw new Error("delegate-product-worker: SKILL.md is missing frontmatter");
	const front = match[1] ?? "";
	const content = (match[2] ?? "").trim();
	const name = /^name:\s*(.+)$/m.exec(front)?.[1]?.trim();
	const description = /description:\s*>-\n([\s\S]*?)(?=\n[A-Za-z_-]+:|\n*$)/.exec(front)?.[1]?.split("\n").map((line) => line.replace(/^\s{2}/, "").trim()).filter((line) => line.length > 0).join(" ");
	if (name === void 0 || description === void 0 || content.length === 0) throw new Error("delegate-product-worker: SKILL.md frontmatter is incomplete");
	return {
		name,
		description,
		content
	};
}
function registerRoutingSkill(ctx) {
	const skills = ctx.get("skills");
	if (skills === void 0) {
		ctx.logger.info("external-agents: skills registry missing; routing skill not registered");
		return;
	}
	const parsed = parseSkillMarkdown(readFileSync(routingSkillPath(), "utf8"));
	skills.register({
		name: parsed.name,
		description: parsed.description,
		source: "runtime",
		content: parsed.content
	});
}
//#endregion
//#region lib/types/client-contract.js
const EXTERNAL_AGENTS_RPC_CHANNEL = "/external-agents";
const SNAPSHOT_ENDPOINT = "snapshot";
const SAVE_ENDPOINT = "save";
const PROBE_ENDPOINT = "probe";
const PICK_ENDPOINT = "pick";
//#endregion
//#region lib/types/config-codec.js
/** Browser-safe config decode/merge. */
function asRecord(value) {
	if (value === null || typeof value !== "object" || Array.isArray(value)) return void 0;
	return value;
}
function asBoolean(value) {
	return typeof value === "boolean" ? value : void 0;
}
function asString(value) {
	return typeof value === "string" ? value : void 0;
}
function asEnv(value) {
	const record = asRecord(value);
	if (record === void 0) return void 0;
	const env = {};
	for (const [key, item] of Object.entries(record)) if (typeof item === "string") env[key] = item;
	return env;
}
function asUnattended(value) {
	return value === "auto" || value === "strict" ? value : void 0;
}
function asNumber(value) {
	return typeof value === "number" && Number.isFinite(value) ? value : void 0;
}
function decodeAdapter(value) {
	const record = asRecord(value);
	if (record === void 0) return void 0;
	const enabled = asBoolean(record.enabled);
	const env = asEnv(record.env);
	const unattended = asUnattended(record.unattended);
	const model = asString(record.model);
	const path = asString(record.path);
	const printTimeoutMs = asNumber(record.printTimeoutMs);
	return {
		...enabled !== void 0 ? { enabled } : {},
		...env !== void 0 ? { env } : {},
		...unattended !== void 0 ? { unattended } : {},
		...model !== void 0 ? { model } : {},
		...path !== void 0 ? { path } : {},
		...printTimeoutMs !== void 0 ? { printTimeoutMs } : {}
	};
}
function decodeConfig(value) {
	const record = asRecord(value);
	if (record === void 0) return void 0;
	const adaptersRecord = asRecord(record.adapters);
	const adapters = {};
	if (adaptersRecord !== void 0) for (const id of ADAPTER_IDS) {
		const row = decodeAdapter(adaptersRecord[id]);
		if (row !== void 0) adapters[id] = row;
	}
	const pinned = asString(record.defaultAdapter);
	return {
		...Object.keys(adapters).length > 0 ? { adapters } : {},
		...pinned !== void 0 && isAdapterId(pinned) ? { defaultAdapter: pinned } : {}
	};
}
function mergeConfig(base, overlay) {
	if (overlay === void 0) return base;
	const adapters = { ...base.adapters };
	for (const id of ADAPTER_IDS) {
		const left = base.adapters?.[id];
		const right = overlay.adapters?.[id];
		if (left === void 0 && right === void 0) continue;
		adapters[id] = {
			...left,
			...right,
			env: {
				...left?.env,
				...right?.env
			}
		};
	}
	const defaultAdapter = overlay.defaultAdapter ?? base.defaultAdapter;
	return {
		adapters,
		...defaultAdapter !== void 0 ? { defaultAdapter } : {}
	};
}
//#endregion
//#region lib/types/store.js
/** Persist Exposure to a profile-local file. RPC writes are authoritative. */
const SETTINGS_FILE_NAME = "external-agents.settings.json";
function settingsFilePath(home, profile = "web") {
	return join(home, "profiles", profile, SETTINGS_FILE_NAME);
}
function persistEnabled() {
	return process.env.VITEST !== "true" && typeof process.env.DSH_HOME === "string" && process.env.DSH_HOME.length > 0;
}
function loadPersistedConfig(home, profile = "web") {
	if (!persistEnabled()) return void 0;
	try {
		const raw = readFileSync(settingsFilePath(home, profile), "utf8");
		return decodeConfig(JSON.parse(raw));
	} catch {
		return;
	}
}
function savePersistedConfig(home, config, profile = "web") {
	if (!persistEnabled()) return;
	const path = settingsFilePath(home, profile);
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, JSON.stringify(config, null, 2) + "\n", "utf8");
}
function dshHome() {
	return process.env.DSH_HOME ?? join(process.env.HOME ?? "/tmp", ".dsh");
}
const PROBES_FILE_NAME = "external-agents.probes.json";
function probesFilePath(home, profile = "web") {
	return join(home, "profiles", profile, PROBES_FILE_NAME);
}
function loadPersistedProbes(home, profile = "web") {
	if (!persistEnabled()) return {};
	try {
		const raw = JSON.parse(readFileSync(probesFilePath(home, profile), "utf8"));
		if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return {};
		return raw;
	} catch {
		return {};
	}
}
function savePersistedProbes(home, probes, profile = "web") {
	if (!persistEnabled()) return;
	const path = probesFilePath(home, profile);
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, JSON.stringify(probes, null, 2) + "\n", "utf8");
}
//#endregion
//#region lib/types/rpc.js
/** Host RPC: snapshot + save Exposure. */
function catalogCards() {
	return ADAPTER_IDS.map((id) => {
		const row = ADAPTERS[id];
		return {
			id: row.id,
			displayName: row.displayName,
			executable: row.executable,
			toolName: row.toolName,
			docsUrl: row.docsUrl,
			loginMode: row.loginMode,
			supportsUnattended: row.supportsUnattended,
			knownModels: row.knownModels.map((item) => ({
				id: item.id,
				label: item.label
			}))
		};
	});
}
function fail(message) {
	return {
		ok: false,
		error: {
			code: "internal",
			message,
			details: {}
		}
	};
}
function adapterPaths(config) {
	const paths = {};
	for (const id of ADAPTER_IDS) {
		const path = config.adapters?.[id]?.path;
		if (path !== void 0 && path.length > 0) paths[id] = path;
	}
	return paths;
}
function createExternalAgentsRpcHandler(deps) {
	return async (endpoint, payload, signal) => {
		if (endpoint === "snapshot") return {
			ok: true,
			value: {
				config: deps.liveConfig(),
				catalog: catalogCards(),
				probes: deps.cachedProbes()
			}
		};
		if (endpoint === "probe") {
			if (typeof payload === "object" && payload !== null && payload.models === true) {
				const next = await probeModels(deps.cachedProbes());
				deps.setCachedProbes(next);
				return {
					ok: true,
					value: { probes: next }
				};
			}
			const probes = deps.resolveExecutable === void 0 ? {} : await probeAll(deps.resolveExecutable, signal, adapterPaths(deps.liveConfig()));
			deps.setCachedProbes(probes);
			return {
				ok: true,
				value: { probes }
			};
		}
		if (endpoint === "pick") try {
			const { stdout } = await promisify(execFile)("zenity", ["--file-selection", "--title=Select executable"], {
				encoding: "utf8",
				timeout: 12e4
			});
			const path = stdout.trim();
			return {
				ok: true,
				value: { path: path.length > 0 ? path : null }
			};
		} catch {
			return {
				ok: true,
				value: { path: null }
			};
		}
		if (endpoint === "save") {
			const decoded = decodeConfig(payload);
			if (decoded === void 0) return fail("invalid external-agents config");
			resolveExposure(decoded);
			savePersistedConfig(dshHome(), decoded);
			deps.applyConfig(decoded);
			return {
				ok: true,
				value: { saved: true }
			};
		}
		return fail("unknown external-agents endpoint: " + endpoint);
	};
}
function registerExternalAgentsRpc(ctx, deps) {
	ctx.inject(["connection"], (connectionCtx) => {
		connectionCtx.connection.rpc.handle(EXTERNAL_AGENTS_RPC_CHANNEL, createExternalAgentsRpcHandler(deps), { authority: "loopback" });
	});
}
//#endregion
//#region lib/types/index.js
/**
* Host-plane External Agents control plane.
* Registers official Product Worker tools from this plugin's config.
* @module dsh-external-agents
*/
const name = "external-agents";
const inject = ["tools", "subagents"];
const Config = z.object({
	adapters: z.object({
		codex: z.object({
			enabled: z.boolean().default(false),
			env: z.dict(z.string()).default({}),
			path: z.string()
		}),
		"claude-code": z.object({
			enabled: z.boolean().default(false),
			env: z.dict(z.string()).default({}),
			path: z.string()
		}),
		cursor: z.object({
			enabled: z.boolean().default(false),
			env: z.dict(z.string()).default({}),
			unattended: z.union(["auto", "strict"]).default("auto"),
			model: z.string(),
			path: z.string()
		}),
		antigravity: z.object({
			enabled: z.boolean().default(false),
			env: z.dict(z.string()).default({}),
			unattended: z.union(["auto", "strict"]).default("auto"),
			model: z.string(),
			path: z.string(),
			printTimeoutMs: z.number()
		})
	}),
	defaultAdapter: z.union(ADAPTER_IDS.map((id) => z.const(id)))
});
const NAMED_TOOL_CONFIG = {
	backgroundMode: "one-shot",
	maxDepth: "provider-managed"
};
function rememberDisposer(bucket, value) {
	if (typeof value === "function") {
		bucket.push(value);
		return;
	}
	if (value !== null && typeof value === "object" && "dispose" in value) {
		const dispose = value.dispose;
		if (typeof dispose === "function") bucket.push(() => {
			dispose();
		});
	}
}
/**
* Mount enabled official Delegation Tools and the generic delegate_worker.
* Loading this plugin does not start any product process.
*/
function apply(ctx, config) {
	let live = mergeConfig(config, loadPersistedConfig(dshHome()));
	const disposers = [];
	const remount = (next) => {
		live = next;
		while (disposers.length > 0) disposers.pop()?.();
		rememberDisposer(disposers, ctx.plugin(subagentCodex, { env: live.adapters?.codex?.env ?? {} }));
		rememberDisposer(disposers, ctx.plugin(subagentClaudeCode, { env: live.adapters?.["claude-code"]?.env ?? {} }));
		rememberDisposer(disposers, ctx.plugin(cursorPlugin, {
			env: live.adapters?.cursor?.env ?? {},
			unattended: live.adapters?.cursor?.unattended ?? "auto",
			...live.adapters?.cursor?.model !== void 0 ? { model: live.adapters.cursor.model } : {},
			...live.adapters?.cursor?.path !== void 0 ? { executable: live.adapters.cursor.path } : {}
		}));
		rememberDisposer(disposers, ctx.plugin(antigravityPlugin, {
			env: live.adapters?.antigravity?.env ?? {},
			unattended: live.adapters?.antigravity?.unattended ?? "auto",
			...live.adapters?.antigravity?.model !== void 0 ? { model: live.adapters.antigravity.model } : {},
			...live.adapters?.antigravity?.printTimeoutMs !== void 0 ? { printTimeoutMs: live.adapters.antigravity.printTimeoutMs } : {},
			...live.adapters?.antigravity?.path !== void 0 ? { executable: live.adapters.antigravity.path } : {}
		}));
		const exposure = resolveExposure(live);
		for (const row of exposure.named) rememberDisposer(disposers, ctx.plugin(toolSubagent, {
			provider: row.provider,
			toolName: row.toolName,
			...NAMED_TOOL_CONFIG
		}));
		if (exposure.delegateWorker) rememberDisposer(disposers, registerDelegateWorker(ctx, exposure));
	};
	remount(live);
	registerRoutingSkill(ctx);
	startOfficialProbes(ctx);
	const subprocess = ctx.get("subprocess");
	let probeCache = loadPersistedProbes(dshHome());
	registerExternalAgentsRpc(ctx, {
		liveConfig: () => live,
		applyConfig: remount,
		cachedProbes: () => probeCache,
		setCachedProbes: (probes) => {
			probeCache = probes;
			savePersistedProbes(dshHome(), probes);
		},
		...subprocess === void 0 ? {} : { resolveExecutable: subprocess.resolveExecutable.bind(subprocess) }
	});
	ctx.effect(() => () => {
		while (disposers.length > 0) disposers.pop()?.();
	});
}
//#endregion
export { ADAPTERS, ADAPTER_IDS, Config, EXTERNAL_AGENTS_RPC_CHANNEL, GENERIC_TOOL_NAME, OFFICIAL_ADAPTER_IDS, PICK_ENDPOINT, PROBE_ENDPOINT, SAVE_ENDPOINT, SNAPSHOT_ENDPOINT, apply, inject, name, resolveDelegationTarget, resolveExposure };
