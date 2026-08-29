window.__ModuleLoader__.load({
	id: "dsh-external-agents",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_dom = require("react-dom");
		let react_jsx_runtime = require("react/jsx-runtime");
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		//#region src/catalog.ts
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
		function isAdapterId(value) {
			return ADAPTER_IDS.includes(value);
		}
		//#endregion
		//#region src/client-contract.ts
		/** Browser-safe RPC contract for the External Agents settings page. */
		const EXTERNAL_AGENTS_RPC_CHANNEL = "/external-agents";
		const SNAPSHOT_ENDPOINT = "snapshot";
		const SAVE_ENDPOINT = "save";
		const PROBE_ENDPOINT = "probe";
		const PICK_ENDPOINT = "pick";
		/** Public package-root contract mirrored by composer-picker without a runtime dependency. */
		const CONTINUE_IN_DSH_SLOT = "external-agents.plan-review.continue-in-dsh";
		const isRecord = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
		function decodeSnapshot(value) {
			if (!isRecord(value) || !isRecord(value.config) || !Array.isArray(value.catalog) || !isRecord(value.probes)) return;
			const catalog = [];
			for (const row of value.catalog) {
				if (!isRecord(row)) return void 0;
				if (!ADAPTER_IDS.includes(String(row.id))) return void 0;
				if (typeof row.displayName !== "string" || typeof row.executable !== "string") return void 0;
				if (typeof row.toolName !== "string" || typeof row.docsUrl !== "string") return void 0;
				if (row.loginMode !== "cursor-status" && row.loginMode !== "product-managed") return void 0;
				if (typeof row.supportsUnattended !== "boolean") return void 0;
				const knownModels = Array.isArray(row.knownModels) ? row.knownModels.filter((item) => {
					return typeof item === "object" && item !== null && typeof item.id === "string" && typeof item.label === "string";
				}) : [];
				catalog.push({
					id: row.id,
					displayName: row.displayName,
					executable: row.executable,
					toolName: row.toolName,
					docsUrl: row.docsUrl,
					loginMode: row.loginMode,
					supportsUnattended: row.supportsUnattended,
					knownModels
				});
			}
			return {
				config: value.config,
				catalog,
				probes: value.probes
			};
		}
		//#endregion
		//#region src/config-codec.ts
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
		//#endregion
		//#region src/client/agy-icon.ts
		/** Official Antigravity app icon, 56px. */
		const AGY_ICON_SRC = "data:image/png;base64,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";
		//#endregion
		//#region src/client/ExternalAgentsSection.tsx
		/** External Agents settings page. */
		const CLAUDE_MODEL_LABELS = {
			fable: "Fable",
			opus: "Opus",
			sonnet: "Sonnet",
			haiku: "Haiku"
		};
		function modelOptions(card, probe, current) {
			const byId = /* @__PURE__ */ new Map();
			for (const row of card.knownModels) byId.set(row.id, row.label);
			for (const id of probe?.models ?? []) if (!byId.has(id)) byId.set(id, CLAUDE_MODEL_LABELS[id] ?? id);
			if (current !== void 0 && current.length > 0 && !byId.has(current)) byId.set(current, CLAUDE_MODEL_LABELS[current] ?? current);
			return [...byId.entries()].map(([id, label]) => ({
				id,
				label
			}));
		}
		const sectionStyle = {
			display: "flex",
			flexDirection: "column",
			gap: 16,
			maxWidth: 760,
			color: "var(--dsw-alias-label-primary)",
			scrollbarGutter: "stable"
		};
		const titleStyle = {
			margin: 0,
			fontSize: 20,
			fontWeight: 600,
			lineHeight: "28px"
		};
		const introStyle = {
			margin: 0,
			fontSize: 14,
			lineHeight: "22px",
			color: "var(--dsw-alias-label-tertiary)"
		};
		const cardsStyle = {
			listStyle: "none",
			margin: 0,
			padding: 0,
			display: "grid",
			gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
			gap: 14
		};
		function cardShell(active, missing) {
			return {
				border: "1px solid " + (active ? "var(--dsw-alias-label-primary)" : "var(--dsw-alias-border-l2)"),
				borderRadius: 14,
				display: "flex",
				flexDirection: "column",
				background: active ? "var(--dsw-alias-bg-layer-2)" : "var(--dsw-alias-bg-layer-3)",
				opacity: missing ? .7 : 1,
				minWidth: 0
			};
		}
		const headBtn = {
			appearance: "none",
			border: 0,
			background: "none",
			font: "inherit",
			color: "inherit",
			textAlign: "left",
			display: "flex",
			alignItems: "center",
			gap: 10,
			padding: "16px 16px 10px"
		};
		const nameStyle = {
			fontSize: 16,
			fontWeight: 600,
			lineHeight: "22px"
		};
		const badge = {
			borderRadius: 999,
			padding: "2px 8px",
			fontSize: 12,
			lineHeight: "18px",
			fontWeight: 500,
			border: "1px solid var(--dsw-alias-border-l2)",
			color: "var(--dsw-alias-label-tertiary)"
		};
		const inUseBadge = {
			...badge,
			marginLeft: "auto",
			border: 0,
			background: "var(--dsw-alias-label-primary)",
			color: "var(--dsw-alias-bg-layer-3)"
		};
		const foot = {
			display: "flex",
			flexDirection: "column",
			gap: 10,
			padding: "4px 16px 16px"
		};
		const meta = {
			fontSize: 13,
			lineHeight: "20px",
			color: "var(--dsw-alias-label-tertiary)"
		};
		function BrandIcon({ id }) {
			const box = {
				width: 28,
				height: 28,
				viewBox: "0 0 24 24",
				"aria-hidden": true
			};
			if (id === "codex") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
				...box,
				fill: "#10A37F",
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2054 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654 2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z" })
			});
			if (id === "claude-code") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
				...box,
				fill: "#D97757",
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M17.3041 3.541h-3.6718l6.696 16.918H24Zm-10.6082 0L0 20.459h3.7442l1.3693-3.5527h7.0052l1.3693 3.5528h3.7442L10.5363 3.5409Zm-.3712 10.2232 2.2914-5.9456 2.2914 5.9456Z" })
			});
			if (id === "cursor") return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
				...box,
				fill: "currentColor",
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", { d: "M11.503.131 1.891 5.678a.84.84 0 0 0-.42.726v11.188c0 .3.162.575.42.724l9.609 5.55a1 1 0 0 0 .998 0l9.61-5.55a.84.84 0 0 0 .42-.724V6.404a.84.84 0 0 0-.42-.726L12.497.131a1.01 1.01 0 0 0-.996 0M2.657 6.338h18.55c.263 0 .43.287.297.515L12.23 22.918c-.062.107-.229.064-.229-.06V12.335a.59.59 0 0 0-.294-.508L2.36 6.853c-.133-.228.034-.515.297-.515" })
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("img", {
				src: AGY_ICON_SRC,
				width: 28,
				height: 28,
				alt: "",
				style: { borderRadius: 6 }
			});
		}
		function ChipSelect(props) {
			const { value, options, placeholder, onChange } = props;
			const [open, setOpen] = (0, react.useState)(false);
			const [menu, setMenu] = (0, react.useState)(void 0);
			const rootRef = (0, react.useRef)(null);
			const triggerRef = (0, react.useRef)(null);
			const menuRef = (0, react.useRef)(null);
			const id = (0, react.useId)();
			const label = options.find((row) => row.id === value)?.label ?? placeholder;
			(0, react.useEffect)(() => {
				if (!open) return;
				const place = () => {
					const rect = triggerRef.current?.getBoundingClientRect();
					if (rect === void 0) return;
					const gap = 8;
					const want = Math.min(280, options.length * 40 + 48);
					const below = window.innerHeight - rect.bottom - 12;
					const above = rect.top - 12;
					const openUp = below < 160 && above > below;
					const maxHeight = Math.max(120, Math.min(want, openUp ? above - gap : below - gap));
					setMenu({
						top: openUp ? rect.top - maxHeight - gap : rect.bottom + gap,
						left: rect.left,
						width: rect.width,
						maxHeight
					});
				};
				place();
				const close = (event) => {
					const target = event.target;
					if (rootRef.current?.contains(target) === true) return;
					if (menuRef.current?.contains(target) === true) return;
					setOpen(false);
				};
				window.addEventListener("resize", place);
				document.addEventListener("mousedown", close);
				return () => {
					window.removeEventListener("resize", place);
					document.removeEventListener("mousedown", close);
				};
			}, [open, options.length]);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				ref: rootRef,
				style: {
					position: "relative",
					minWidth: 0
				},
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					type: "button",
					"aria-haspopup": "listbox",
					"aria-expanded": open,
					"aria-controls": id,
					ref: triggerRef,
					onClick: () => setOpen((v) => !v),
					style: {
						display: "flex",
						alignItems: "center",
						gap: 4,
						width: "100%",
						height: 32,
						padding: "0 8px 0 12px",
						border: "none",
						borderRadius: 24,
						background: "var(--dsw-alias-interactive-bg-hover)",
						color: "var(--dsw-alias-label-secondary)",
						fontSize: 14,
						lineHeight: "20px",
						fontWeight: 500,
						cursor: "pointer"
					},
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						style: {
							minWidth: 0,
							overflow: "hidden",
							textOverflow: "ellipsis",
							whiteSpace: "nowrap"
						},
						children: label
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
						width: "14",
						height: "14",
						viewBox: "0 0 14 14",
						"aria-hidden": true,
						style: {
							marginLeft: "auto",
							transform: open ? "rotate(180deg)" : void 0
						},
						children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
							d: "M3 5l4 4 4-4",
							fill: "none",
							stroke: "currentColor",
							strokeWidth: "1.4"
						})
					})]
				}), open && menu !== void 0 ? (0, react_dom.createPortal)(/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					ref: menuRef,
					id,
					role: "listbox",
					style: {
						position: "fixed",
						top: menu.top,
						left: menu.left,
						width: menu.width,
						maxHeight: menu.maxHeight,
						zIndex: 1e4,
						overflow: "auto",
						padding: 4,
						border: "1px solid var(--dsw-alias-border-inverted)",
						borderRadius: 12,
						background: "var(--dsw-specific-menu)",
						boxShadow: "var(--dsw-shadow-lv3)"
					},
					children: [{
						id: "",
						label: placeholder
					}, ...options].map((row) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						role: "option",
						"aria-selected": row.id === value,
						onClick: () => {
							onChange(row.id);
							setOpen(false);
						},
						style: {
							display: "flex",
							alignItems: "center",
							width: "100%",
							minHeight: 38,
							padding: "6px 10px",
							border: "none",
							borderRadius: 8,
							background: row.id === value ? "var(--dsw-alias-interactive-bg-hover)" : "transparent",
							color: "var(--dsw-alias-label-primary)",
							fontSize: 14,
							textAlign: "left",
							cursor: "pointer"
						},
						children: row.label
					}, row.id || "default"))
				}), document.body) : null]
			});
		}
		function SkeletonCard() {
			const bar = (width, height) => ({
				width,
				height,
				borderRadius: 8,
				background: "linear-gradient(90deg, var(--dsw-alias-bg-layer-2) 20%, var(--dsw-alias-bg-layer-1) 40%, var(--dsw-alias-bg-layer-2) 60%)",
				backgroundSize: "240% 100%",
				animation: "dsh-ea-shimmer 1.1s linear infinite"
			});
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("li", {
				style: cardShell(false, false),
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					style: {
						padding: 16,
						display: "flex",
						flexDirection: "column",
						gap: 12
					},
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							style: {
								display: "flex",
								gap: 10,
								alignItems: "center"
							},
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { style: {
								...bar("28px", 28),
								borderRadius: 8
							} }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { style: bar("46%", 16) })]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { style: bar("70%", 12) }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", { style: {
							...bar("100%", 32),
							borderRadius: 16
						} })
					]
				})
			});
		}
		function loginText(probe, t) {
			if (probe?.found !== true) return void 0;
			if (probe.login === "ok") return probe.loginDetail ?? t("loggedIn");
			if (probe.login === "product-managed") return t("loginManaged");
			return probe.loginDetail;
		}
		function AdapterCard(props) {
			const { card, row, probe, inUse, t, onPickDefault, onChange, onLocate } = props;
			const missing = probe?.found !== true;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
				style: cardShell(inUse, missing),
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					type: "button",
					style: {
						...headBtn,
						cursor: inUse ? "default" : "pointer"
					},
					"aria-pressed": inUse,
					disabled: inUse,
					"aria-label": (inUse ? t("inUse") : t("setDefault")) + ": " + card.displayName,
					onClick: onPickDefault,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(BrandIcon, { id: card.id }),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							style: nameStyle,
							children: card.displayName
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							style: badge,
							children: missing ? t("missingBadge") : t("enabledBadge")
						}),
						inUse ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							style: inUseBadge,
							children: t("inUse")
						}) : null
					]
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					style: foot,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						style: meta,
						children: [probe?.version, loginText(probe, t)].filter(Boolean).join(" · ")
					}), missing ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: onLocate,
						style: {
							height: 32,
							border: "1px solid var(--dsw-alias-border-l2)",
							borderRadius: 24,
							background: "transparent",
							color: "inherit",
							fontSize: 14,
							fontWeight: 500,
							cursor: "pointer"
						},
						children: t("locate")
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ChipSelect, {
						value: row.model ?? "",
						placeholder: t("productDefault"),
						options: modelOptions(card, probe, row.model),
						onChange: (value) => {
							const next = { ...row };
							if (value === "") delete next.model;
							else next.model = value;
							onChange(next, true);
						}
					})]
				})]
			});
		}
		function ExternalAgentsSection(props) {
			const { t, load, probe, pick, save } = props;
			const [snapshot, setSnapshot] = (0, react.useState)(void 0);
			const [draft, setDraft] = (0, react.useState)({});
			const [probes, setProbes] = (0, react.useState)({});
			const [probing, setProbing] = (0, react.useState)(true);
			const [error, setError] = (0, react.useState)(void 0);
			(0, react.useEffect)(() => {
				let cancelled = false;
				const started = Date.now();
				load().then(async (next) => {
					if (cancelled) return;
					setSnapshot(next);
					setDraft(next.config);
					const cached = next.probes;
					if (Object.keys(cached).length > 0) {
						setProbes(cached);
						setProbing(false);
						return;
					}
					const fresh = await probe(false);
					const wait = 280 - (Date.now() - started);
					if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
					if (cancelled) return;
					setProbes(fresh);
					setProbing(false);
				}).catch((cause) => {
					if (!cancelled) {
						setError(String(cause));
						setProbing(false);
					}
				});
				return () => {
					cancelled = true;
				};
			}, [load, probe]);
			const persist = (next) => {
				setDraft(next);
				save(next).catch((cause) => setError(String(cause)));
			};
			const setAdapter = (id, row) => {
				persist({
					...draft,
					adapters: {
						...draft.adapters,
						[id]: row
					}
				});
			};
			const locate = (id) => {
				pick().then((path) => {
					if (path === null) return;
					setAdapter(id, {
						...draft.adapters?.[id],
						path
					});
					probe().then(setProbes);
				});
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				style: sectionStyle,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("style", { children: "@keyframes dsh-ea-shimmer { 0% { background-position: 100% 0 } 100% { background-position: 0 0 } }" }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						style: {
							display: "flex",
							alignItems: "flex-start",
							gap: 12
						},
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
							style: {
								...titleStyle,
								flex: 1
							},
							children: t("title")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => {
								setProbing(true);
								probe(false).then((fresh) => {
									setProbes(fresh);
									setProbing(false);
								}).catch((cause) => {
									setError(String(cause));
									setProbing(false);
								});
							},
							style: {
								height: 32,
								padding: "0 12px",
								border: "1px solid var(--dsw-alias-border-l2)",
								borderRadius: 24,
								background: "transparent",
								color: "inherit",
								fontSize: 13,
								fontWeight: 500,
								cursor: "pointer"
							},
							children: t("refresh")
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						style: introStyle,
						children: t("sectionIntro")
					}),
					probing || snapshot === void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("ul", {
						style: cardsStyle,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SkeletonCard, {}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SkeletonCard, {}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SkeletonCard, {}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(SkeletonCard, {})
						]
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("ul", {
						style: cardsStyle,
						children: snapshot.catalog.map((card) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)(AdapterCard, {
							card,
							row: draft.adapters?.[card.id] ?? {},
							probe: probes[card.id],
							inUse: draft.defaultAdapter === card.id,
							t,
							onPickDefault: () => persist({
								...draft,
								defaultAdapter: card.id
							}),
							onChange: (row) => setAdapter(card.id, row),
							onLocate: () => locate(card.id)
						}, card.id))
					}),
					error !== void 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
						style: {
							...introStyle,
							color: "var(--dsw-alias-state-error-primary)"
						},
						role: "alert",
						children: error
					}) : null
				]
			});
		}
		//#endregion
		//#region src/client/plan-review.ts
		function planReviewOf(questions) {
			if (questions.length !== 1) return void 0;
			const question = questions[0];
			if (question === void 0 || question.intent?.kind !== "plan-review" || question.detail === void 0) return void 0;
			if (question.multiSelect === true) return void 0;
			const options = question.options ?? [];
			if (options.length > 2) return void 0;
			const approve = options.find((option) => option.label === question.intent?.approve);
			if (approve === void 0) return void 0;
			const decline = options.find((option) => option.label !== question.intent?.approve);
			return {
				id: question.id,
				question: question.question,
				plan: question.detail,
				approve,
				...decline === void 0 ? {} : { decline }
			};
		}
		function isQuestionWait(value) {
			if (value.kind !== "question" && value.kind !== "plan-review") return false;
			if (Array.isArray(value.questions)) return true;
			if (value.payload === void 0 || typeof value.payload !== "object" || value.payload === null) return false;
			return Array.isArray(value.payload.questions);
		}
		function questionsOf(wait) {
			if (Array.isArray(wait.questions)) return wait.questions;
			if (wait.payload !== void 0 && typeof wait.payload === "object" && wait.payload !== null) {
				const qs = wait.payload.questions;
				if (Array.isArray(qs)) return qs;
			}
			return [];
		}
		function selectPlanReview(owner) {
			const wait = (owner.pendingInteraction !== void 0 ? [owner.pendingInteraction] : owner.interactions ?? []).find(isQuestionWait);
			if (wait === void 0) return null;
			return planReviewOf(questionsOf(wait)) === void 0 ? null : wait;
		}
		function disabledPlanWorkers(snapshot, copy) {
			return snapshot.catalog.map((row) => ({
				id: `external-agent:${row.id}`,
				adapterId: row.id,
				label: copy.labelOf(row.id),
				description: (snapshot.probes[row.id]?.found === false ? copy.missingLabel : copy.productOf(row.id)) + " · " + copy.unavailableLabel,
				disabled: true
			}));
		}
		//#endregion
		//#region src/client/plan-review-controller.ts
		var ResponseRejectedError = class extends Error {};
		async function callWait(work, rejectedMessage, failedMessage) {
			let receipt;
			try {
				receipt = await work();
			} catch {
				throw new Error(failedMessage);
			}
			if (receipt !== void 0 && receipt.accepted === false) throw new ResponseRejectedError(rejectedMessage);
		}
		async function respond(wait, id, label, rejectedMessage, failedMessage) {
			const answers = { answers: [{
				id,
				selected: [label]
			}] };
			if (typeof wait.answer === "function") {
				await callWait(() => wait.answer(answers), rejectedMessage, failedMessage);
				return;
			}
			await callWait(() => wait.respond({
				ok: true,
				value: {
					sessionId: wait.sessionId,
					answer: answers
				}
			}), rejectedMessage, failedMessage);
		}
		async function cancel(wait, message, rejectedMessage, failedMessage) {
			if (typeof wait.cancel === "function") {
				await callWait(() => wait.cancel(), rejectedMessage, failedMessage);
				return;
			}
			await callWait(() => wait.respond({
				ok: false,
				error: {
					code: "cancelled",
					message,
					details: {}
				}
			}), rejectedMessage, failedMessage);
		}
		const labelKeys = {
			codex: "agent.codex",
			"claude-code": "agent.claude-code",
			cursor: "agent.cursor",
			antigravity: "agent.antigravity"
		};
		/** One top-card owner for routing, registered commit ordering, and receipt policy. */
		function usePlanReviewController(options) {
			const [waitKey, setWaitKey] = (0, react.useState)(options.matched.key);
			const [catalog, setCatalog] = (0, react.useState)(null);
			const [selectedTarget, setSelectedTarget] = (0, react.useState)("dsh");
			const [busy, setBusy] = (0, react.useState)(false);
			const [blocked, setBlocked] = (0, react.useState)(false);
			const [error, setError] = (0, react.useState)(null);
			const [targetsError, setTargetsError] = (0, react.useState)(null);
			const actionLocked = (0, react.useRef)(false);
			const activeWait = (0, react.useRef)(options.matched.key);
			const commitRef = (0, react.useRef)(null);
			if (waitKey !== options.matched.key) {
				activeWait.current = options.matched.key;
				actionLocked.current = false;
				commitRef.current = null;
				setWaitKey(options.matched.key);
				setCatalog(null);
				setSelectedTarget("dsh");
				setBusy(false);
				setBlocked(false);
				setError(null);
				setTargetsError(null);
			}
			(0, react.useEffect)(() => {
				const identity = options.matched.key;
				let active = true;
				options.loadTargets().then((value) => {
					if (active && activeWait.current === identity) {
						setCatalog(value);
						setTargetsError(null);
					}
				}, () => {
					if (active && activeWait.current === identity) {
						setCatalog(null);
						setTargetsError(options.t("plan.targetsFailed"));
					}
				});
				return () => {
					active = false;
				};
			}, [
				options.loadTargets,
				options.matched.key,
				options.t
			]);
			const targets = (0, react.useMemo)(() => catalog === null ? [] : disabledPlanWorkers(catalog, {
				labelOf: (id) => options.t(labelKeys[id]),
				productOf: (id) => ADAPTERS[id].displayName,
				missingLabel: options.t("probeMissing"),
				unavailableLabel: options.t("plan.externalUnavailable")
			}), [catalog, options.t]);
			const execute = (0, react.useCallback)((work, terminalOnRejected = false) => {
				if (actionLocked.current || blocked) return;
				const identity = options.matched.key;
				actionLocked.current = true;
				setBusy(true);
				setError(null);
				work().catch((cause) => {
					if (activeWait.current !== identity) return;
					actionLocked.current = false;
					setBusy(false);
					if (terminalOnRejected && cause instanceof ResponseRejectedError) setBlocked(true);
					setError(cause instanceof Error ? cause.message : String(cause));
				});
			}, [blocked, options.matched.key]);
			const registerCommit = (0, react.useCallback)((commit) => {
				commitRef.current = commit;
				return () => {
					if (commitRef.current === commit) commitRef.current = null;
				};
			}, []);
			const selectTarget = (0, react.useCallback)((target) => {
				if (target === "dsh" && !busy && !blocked) setSelectedTarget(target);
			}, [blocked, busy]);
			const approve = (0, react.useCallback)(() => {
				if (selectedTarget !== "dsh") return;
				execute(async () => {
					const commit = commitRef.current;
					if (commit !== null) {
						let committed = false;
						try {
							committed = await commit();
						} catch {}
						if (!committed) throw new Error(options.t("plan.modelFailed"));
					}
					await respond(options.matched, options.review.id, options.review.approve.label, options.t("plan.responseRejected"), options.t("plan.responseFailed"));
				}, true);
			}, [
				execute,
				options,
				selectedTarget
			]);
			const discuss = (0, react.useCallback)(() => {
				execute(() => cancel(options.matched, options.t("plan.discussCancel"), options.t("plan.cancelRejected"), options.t("plan.cancelFailed")));
			}, [execute, options]);
			const keepPlanning = (0, react.useCallback)(() => {
				if (options.review.decline === void 0) return;
				execute(() => respond(options.matched, options.review.id, options.review.decline.label, options.t("plan.responseRejected"), options.t("plan.responseFailed")));
			}, [execute, options]);
			return {
				busy,
				blocked,
				error: error ?? targetsError,
				targets,
				selectedTarget,
				approvalReady: !busy && !blocked && selectedTarget === "dsh",
				registerCommit,
				selectTarget,
				approve,
				discuss,
				keepPlanning
			};
		}
		//#endregion
		//#region src/client/ExternalPlanReviewCard.tsx
		/** External Agents Plan-review router and registered child entry. */
		const frame = {
			width: "100%",
			display: "flex",
			justifyContent: "center",
			padding: "12px max(16px, env(safe-area-inset-right)) max(12px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left))"
		};
		const card = {
			width: "min(860px, 100%)",
			maxHeight: "min(760px, calc(100vh - 120px))",
			display: "flex",
			flexDirection: "column",
			border: "1px solid var(--dsw-alias-border-l2)",
			borderRadius: 18,
			background: "var(--dsw-alias-bg-layer-2)",
			overflow: "hidden",
			boxShadow: "var(--dsw-shadow-lv2)"
		};
		const head = {
			padding: "20px 22px 14px",
			borderBottom: "1px solid var(--dsw-alias-border-l2)"
		};
		const kicker = {
			fontSize: 12,
			fontWeight: 600,
			color: "var(--dsw-alias-label-tertiary)",
			textTransform: "uppercase",
			letterSpacing: ".08em"
		};
		const title = {
			margin: "4px 0 0",
			fontSize: 20,
			lineHeight: "28px",
			color: "var(--dsw-alias-label-primary)"
		};
		const body = {
			flex: 1,
			minHeight: 120,
			overflow: "auto",
			padding: "18px 22px"
		};
		const router = {
			padding: "14px 22px",
			borderTop: "1px solid var(--dsw-alias-border-l2)",
			display: "flex",
			flexDirection: "column",
			gap: 10
		};
		const fallbackSelect = {
			width: "100%",
			minHeight: 36,
			padding: "7px 10px",
			color: "var(--dsw-alias-label-primary)",
			background: "var(--dsw-alias-bg-layer-1)",
			border: "1px solid var(--dsw-alias-border-l2)",
			borderRadius: 8
		};
		const footer = {
			padding: "12px 22px 18px",
			display: "flex",
			gap: 8,
			justifyContent: "space-between",
			alignItems: "center",
			flexWrap: "wrap"
		};
		function CurrentModelSelector({ owner, label }) {
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
				"aria-label": label,
				style: fallbackSelect,
				disabled: owner.locked,
				value: owner.selectedTarget,
				onChange: (event) => {
					owner.selectTarget(event.currentTarget.value);
				},
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
					value: "dsh",
					children: label
				}), owner.targets.map((target) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
					value: target.id,
					disabled: true,
					children: target.label
				}, target.id))]
			});
		}
		function ExternalPlanReviewCard(props) {
			const raw = props.matched;
			const review = planReviewOf(Array.isArray(raw.questions) ? raw.questions : Array.isArray(raw.payload?.questions) ? raw.payload.questions : []);
			if (review === void 0) return null;
			const controller = usePlanReviewController({
				matched: props.matched,
				review,
				loadTargets: props.loadTargets,
				t: props.t
			});
			const owner = {
				locked: controller.busy || controller.blocked,
				targets: controller.targets,
				targetsLabel: props.t("plan.workers"),
				selectedTarget: controller.selectedTarget,
				selectTarget: controller.selectTarget,
				registerCommit: controller.registerCommit
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				style: frame,
				"data-external-plan-review": props.matched.key,
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
					style: card,
					"aria-label": review.question,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", {
							style: head,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								style: kicker,
								children: props.t("plan.kicker")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
								style: title,
								children: props.t("plan.title")
							})]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							style: body,
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.MarkdownText, { text: review.plan })
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							style: router,
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", {
									style: {
										color: "var(--dsw-alias-label-primary)",
										fontSize: 13
									},
									children: props.t("plan.executeWith")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)(react.Fragment, { children: props.renderSlot(CONTINUE_IN_DSH_SLOT, owner, { fallback: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(CurrentModelSelector, {
									owner,
									label: props.t("plan.currentModel")
								}) }) }, props.matched.key),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									role: "status",
									style: {
										color: "var(--dsw-alias-label-tertiary)",
										fontSize: 13
									},
									children: props.t("plan.externalUnavailable")
								})
							]
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("footer", {
							style: footer,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								role: "status",
								style: {
									color: "var(--dsw-alias-label-error)",
									fontSize: 12
								},
								children: controller.error
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								style: {
									display: "flex",
									gap: 8,
									marginLeft: "auto",
									flexWrap: "wrap",
									justifyContent: "flex-end"
								},
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
										variant: "ghost",
										icon: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconEditOutline16, { size: 14 }),
										disabled: controller.busy || controller.blocked,
										onClick: controller.discuss,
										children: props.t("plan.discuss")
									}),
									review.decline !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
										variant: "ghost",
										disabled: controller.busy || controller.blocked,
										onClick: controller.keepPlanning,
										children: props.t("plan.keep")
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
										disabled: !controller.approvalReady,
										onClick: controller.approve,
										children: props.t("plan.approve")
									})
								]
							})]
						})
					]
				})
			});
		}
		//#endregion
		//#region src/client/locales.ts
		const zh = {
			nav: "外部 Agent",
			title: "外部 Agent",
			jobNote: "后台任务出现在会话头 Job Panel，不在本页。",
			sectionIntro: "模型会同时看到所有已启用外部 Agent 的具名工具。点卡片只改默认：delegate_worker 没写 adapter 时走这一张。未检测到 CLI 时点「选择可执行文件」。",
			inUse: "默认",
			setDefault: "设为默认",
			refresh: "重新探测",
			enabledBadge: "已启用",
			missingBadge: "未安装",
			productDefault: "产品默认",
			model: "模型",
			modelHint: "产品默认",
			locate: "选择可执行文件",
			loginManaged: "由产品管理登录",
			loggedIn: "已登录",
			env: "环境变量",
			envHint: "每行 KEY=value，只传给这个外部 Agent。不要在这里填共享密钥到文档里。",
			unattended: "无人值守",
			unattendedAuto: "自动批准（可改文件、跑命令）",
			unattendedStrict: "严格：能拒绝就拒绝",
			unattendedHint: "自动批准等于该产品在本工作区可以改文件、跑命令。官方 Codex / Claude Code 若提供方本身拒绝审批，则保持失败即失败。",
			probeMissing: "未找到可执行文件",
			probeFound: "已找到",
			docs: "官方文档",
			save: "保存",
			saved: "已保存。下一轮模型请求生效。",
			failed: "保存失败",
			loading: "正在探测本机外部 Agent…",
			"blurb.codex": "OpenAI Codex CLI，一次性外部 Agent。",
			"blurb.claude-code": "Anthropic Claude Code，一次性外部 Agent。",
			"blurb.cursor": "官方 cursor-agent CLI，一次性外部 Agent。",
			"blurb.antigravity": "Google Antigravity CLI（agy），一次性外部 Agent。",
			"install.codex": "安装后运行：codex login",
			"install.claude-code": "安装 Claude Code 并完成原生登录",
			"install.cursor": "安装后运行：cursor-agent login",
			"install.antigravity": "安装 agy 并用产品自己的方式登录",
			"plan.kicker": "计划已就绪",
			"plan.title": "选择执行方式",
			"plan.executeWith": "执行方式",
			"plan.workers": "外部 Agent",
			"plan.currentModel": "使用当前会话模型。安装 composer-picker 后可在这里选择 DSH 执行模型。",
			"plan.externalUnavailable": "当前 DSH 版本没有安全的外部 Plan 交接接口；外部 Agent 目标暂不可选，未启动任何任务。",
			"plan.discuss": "讨论",
			"plan.keep": "继续规划",
			"plan.approve": "批准",
			"plan.modelFailed": "切换 DSH 执行模型失败；计划尚未批准，可以重试。",
			"plan.targetsFailed": "无法加载外部 Agent 目标；外部执行保持不可用。",
			"plan.discussCancel": "用户关闭计划审查以继续讨论",
			"plan.responseRejected": "计划答复已被另一客户端处理；已完成的模型切换无法由插件回滚。",
			"plan.responseFailed": "发送计划答复失败；连接恢复后可以重试。",
			"plan.cancelRejected": "计划取消已被另一客户端处理；本页未执行后续操作。",
			"plan.cancelFailed": "发送计划取消失败；连接恢复后可以重试。",
			"agent.codex": "Codex 外部 Agent",
			"agent.claude-code": "Claude Code 外部 Agent",
			"agent.cursor": "Cursor 外部 Agent",
			"agent.antigravity": "Antigravity 外部 Agent"
		};
		const en = {
			nav: "External Agents",
			title: "External Agents",
			jobNote: "Background work shows up in the session-header Job Panel, not on this page.",
			sectionIntro: "The model sees a named tool for every enabled External Agent. Click a card to set the default used when delegate_worker omits adapter. If a CLI is missing, use Locate executable.",
			inUse: "Default",
			setDefault: "Set as default",
			refresh: "Rescan",
			enabledBadge: "Enabled",
			missingBadge: "Not installed",
			productDefault: "Product default",
			model: "Model",
			modelHint: "Product default",
			locate: "Locate executable",
			loginManaged: "Sign-in is managed by the product",
			loggedIn: "Signed in",
			env: "Environment",
			envHint: "One KEY=value per line. Applied only to this External Agent.",
			unattended: "Unattended",
			unattendedAuto: "Auto-approve (can edit files and run commands)",
			unattendedStrict: "Strict: deny when the product can deny",
			unattendedHint: "Auto-approve means this product may change files and run commands in this workspace. Official Codex / Claude Code stay fail-closed if their provider has no approve switch.",
			probeMissing: "Executable not found",
			probeFound: "Found",
			docs: "Docs",
			save: "Save",
			saved: "Saved. The next model request picks this up.",
			failed: "Save failed",
			loading: "Probing local External Agents…",
			"blurb.codex": "OpenAI Codex CLI as a one-shot External Agent.",
			"blurb.claude-code": "Anthropic Claude Code as a one-shot External Agent.",
			"blurb.cursor": "Official cursor-agent CLI as a one-shot External Agent.",
			"blurb.antigravity": "Google Antigravity CLI (agy) as a one-shot External Agent.",
			"install.codex": "After install, run: codex login",
			"install.claude-code": "Install Claude Code and complete native login",
			"install.cursor": "After install, run: cursor-agent login",
			"install.antigravity": "Install agy and sign in with the product itself",
			"plan.kicker": "Plan ready",
			"plan.title": "Choose how to execute",
			"plan.executeWith": "Execute with",
			"plan.workers": "External Agents",
			"plan.currentModel": "Uses the current conversation model. Install composer-picker to choose the DSH execution model here.",
			"plan.externalUnavailable": "This DSH version has no safe external Plan handoff API. External Agent targets are unavailable and no task has started.",
			"plan.discuss": "Discuss",
			"plan.keep": "Keep planning",
			"plan.approve": "Approve",
			"plan.modelFailed": "Could not switch the DSH execution model; the Plan is still pending and can be retried.",
			"plan.targetsFailed": "Could not load External Agent targets. External execution remains unavailable.",
			"plan.discussCancel": "The user closed Plan Review to continue the discussion",
			"plan.responseRejected": "Another client already handled this Plan response. A completed model change cannot be rolled back by this plugin.",
			"plan.responseFailed": "Could not send the Plan response. Retry after the connection recovers.",
			"plan.cancelRejected": "Another client already handled this Plan cancellation. This page took no further action.",
			"plan.cancelFailed": "Could not send the Plan cancellation. Retry after the connection recovers.",
			"agent.codex": "Codex External Agent",
			"agent.claude-code": "Claude Code External Agent",
			"agent.cursor": "Cursor External Agent",
			"agent.antigravity": "Antigravity External Agent"
		};
		//#endregion
		//#region src/client/index.ts
		const name = "dsh-external-agents-client";
		const inject = [
			"slots",
			"locale",
			"connection"
		];
		function apply(ctx) {
			const localeNamespace = "settings.external-agents";
			ctx.effect(() => ctx.locale.register(localeNamespace, {
				zh,
				en
			}), "dsh-external-agents: Settings page copy");
			const t = ctx.locale.bind(localeNamespace);
			const { rpc } = ctx.get("connection");
			const load = async () => {
				const result = await rpc.call(EXTERNAL_AGENTS_RPC_CHANNEL, SNAPSHOT_ENDPOINT, {}, void 0);
				if (!result.ok) throw new Error(result.error.message);
				const decoded = decodeSnapshot(result.value);
				if (decoded === void 0) throw new Error(t("failed"));
				return decoded;
			};
			const probe = async (models) => {
				const result = await rpc.call(EXTERNAL_AGENTS_RPC_CHANNEL, PROBE_ENDPOINT, { models: models === true }, void 0);
				if (!result.ok) throw new Error(result.error.message);
				return result.value.probes ?? {};
			};
			const loadPlanTargets = async () => {
				const snapshot = await load();
				try {
					const probes = await probe(false);
					return {
						...snapshot,
						probes
					};
				} catch {
					return snapshot;
				}
			};
			const pick = async () => {
				const result = await rpc.call(EXTERNAL_AGENTS_RPC_CHANNEL, PICK_ENDPOINT, {}, void 0);
				if (!result.ok) throw new Error(result.error.message);
				return result.value.path ?? null;
			};
			const save = async (config) => {
				const payload = decodeConfig(config) ?? config;
				const result = await rpc.call(EXTERNAL_AGENTS_RPC_CHANNEL, SAVE_ENDPOINT, payload, void 0);
				if (!result.ok) throw new Error(result.error.message);
			};
			ctx.inject(["slots"], (scope) => {
				scope.slots.inject("conversation.composer", () => scope.slots.register({
					name: "conversation.composer",
					locale: localeNamespace,
					priority: -6,
					select: (owner) => selectPlanReview(owner),
					children: { [CONTINUE_IN_DSH_SLOT]: {
						kind: "single",
						scope: "session"
					} },
					inject: () => ({ loadTargets: loadPlanTargets })
				}, ExternalPlanReviewCard));
			});
			ctx.slots.inject("settings.section", () => ctx.slots.register({
				name: "settings.section",
				id: "external-agents",
				order: 14,
				label: () => t("nav"),
				inject: () => ({
					t,
					load,
					probe,
					pick,
					save
				})
			}, ExternalAgentsSection));
		}
		//#endregion
		exports.CONTINUE_IN_DSH_SLOT = CONTINUE_IN_DSH_SLOT;
		exports.apply = apply;
		exports.inject = inject;
		exports.name = name;
		return module.exports;
	}
});
