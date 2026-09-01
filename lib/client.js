window.__ModuleLoader__.load({
	id: "dsh-external-agents",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_dom = require("react-dom");
		let react_jsx_runtime = require("react/jsx-runtime");
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
			const enabled = row.enabled === true;
			const missing = probe?.found !== true;
			const status = !enabled ? t("disabledBadge") : missing ? t("missingBadge") : t("enabledBadge");
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("li", {
				style: cardShell(inUse, missing || !enabled),
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
						type: "button",
						style: {
							...headBtn,
							cursor: inUse || !enabled ? "default" : "pointer"
						},
						"aria-pressed": inUse,
						disabled: inUse || !enabled,
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
								children: status
							}),
							inUse ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
								style: inUseBadge,
								children: t("inUse")
							}) : null
						]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
						style: {
							display: "flex",
							alignItems: "center",
							gap: 8,
							padding: "0 16px 8px",
							fontSize: 13,
							color: "var(--dsw-alias-label-secondary)"
						},
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
							type: "checkbox",
							checked: enabled,
							"aria-label": (enabled ? t("disableAdapter") : t("enableAdapter")) + ": " + card.displayName,
							onChange: () => onChange({
								...row,
								enabled: !enabled
							}, true)
						}), enabled ? t("enabledBadge") : t("disabledBadge")]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
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
					})
				]
			});
		}
		function ExternalAgentsSection(props) {
			const { t, load, probe, pick, save } = props;
			const [snapshot, setSnapshot] = (0, react.useState)(void 0);
			const [draft, setDraft] = (0, react.useState)({});
			const [probes, setProbes] = (0, react.useState)({});
			const [probing, setProbing] = (0, react.useState)(true);
			const [error, setError] = (0, react.useState)(void 0);
			const loadRef = (0, react.useRef)(load);
			const probeRef = (0, react.useRef)(probe);
			loadRef.current = load;
			probeRef.current = probe;
			(0, react.useEffect)(() => {
				let cancelled = false;
				const started = Date.now();
				loadRef.current().then(async (next) => {
					if (cancelled) return;
					setSnapshot(next);
					setDraft(next.config);
					const cached = next.probes;
					if (Object.keys(cached).length > 0) {
						setProbes(cached);
						setProbing(false);
						return;
					}
					const fresh = await probeRef.current(false);
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
			}, []);
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
							inUse: draft.defaultAdapter === card.id && draft.adapters?.[card.id]?.enabled === true,
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
		//#region src/client/locales.ts
		const zh = {
			nav: "外部 Agent",
			title: "外部 Agent",
			jobNote: "后台任务出现在会话头 Job Panel，不在本页。",
			sectionIntro: "模型会同时看到所有已启用外部 Agent 的具名工具。使用复选框控制暴露，点卡片可设置默认：delegate_worker 没写 adapter 时走这一张。未检测到 CLI 时点「选择可执行文件」。",
			inUse: "默认",
			setDefault: "设为默认",
			refresh: "重新探测",
			enabledBadge: "已启用",
			disabledBadge: "已停用",
			enableAdapter: "启用",
			disableAdapter: "停用",
			missingBadge: "未安装",
			productDefault: "产品默认",
			model: "模型",
			modelHint: "启用时必填；会去掉首尾空白。",
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
			"agent.codex": "Codex 外部 Agent",
			"agent.claude-code": "Claude Code 外部 Agent",
			"agent.cursor": "Cursor 外部 Agent",
			"agent.antigravity": "Antigravity 外部 Agent"
		};
		const en = {
			nav: "External Agents",
			title: "External Agents",
			jobNote: "Background work shows up in the session-header Job Panel, not on this page.",
			sectionIntro: "The model sees a named tool for every enabled External Agent. Use each checkbox to control exposure; click a card to set the default used when delegate_worker omits adapter. If a CLI is missing, use Locate executable.",
			inUse: "Default",
			setDefault: "Set as default",
			refresh: "Rescan",
			enabledBadge: "Enabled",
			disabledBadge: "Disabled",
			enableAdapter: "Enable",
			disableAdapter: "Disable",
			missingBadge: "Not installed",
			productDefault: "Product default",
			model: "Model",
			modelHint: "Required when enabled; surrounding whitespace is removed.",
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
			const { rpc } = ctx.connection;
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
			const pick = async () => {
				const result = await rpc.call(EXTERNAL_AGENTS_RPC_CHANNEL, PICK_ENDPOINT, {}, void 0);
				if (!result.ok) throw new Error(result.error.message);
				return result.value.path ?? null;
			};
			const save = async (config) => {
				const payload = decodeConfig(config);
				if (payload === void 0) throw new Error(t("failed"));
				const result = await rpc.call(EXTERNAL_AGENTS_RPC_CHANNEL, SAVE_ENDPOINT, payload, void 0);
				if (!result.ok) throw new Error(result.error.message);
			};
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
		exports.apply = apply;
		exports.inject = inject;
		exports.name = name;
		return module.exports;
	}
});
