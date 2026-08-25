/**
 * Closed shipped Adapter set. New workers require a new ADR.
 * @module dsh-external-agents/catalog
 */
export declare const ADAPTER_IDS: readonly ["codex", "claude-code", "cursor", "antigravity"];
export type AdapterId = (typeof ADAPTER_IDS)[number];
/** Official DSH packages this plugin mounts. */
export declare const OFFICIAL_ADAPTER_IDS: readonly ["codex", "claude-code"];
export type OfficialAdapterId = (typeof OFFICIAL_ADAPTER_IDS)[number];
/** Adapters this plugin implements (official packages plus print-json workers). */
export declare const IMPLEMENTED_ADAPTER_IDS: readonly ["codex", "claude-code", "cursor", "antigravity"];
export type ImplementedAdapterId = (typeof IMPLEMENTED_ADAPTER_IDS)[number];
export interface AdapterDescriptor {
    readonly id: AdapterId;
    readonly provider: string;
    readonly toolName: string;
    readonly executable: string;
    readonly displayName: string;
    readonly implemented: boolean;
    readonly docsUrl: string;
    readonly loginMode: 'cursor-status' | 'product-managed';
    readonly supportsUnattended: boolean;
    /** Curated --model ids. Maintained here; CLI listing is optional refresh. */
    readonly knownModels: readonly {
        readonly id: string;
        readonly label: string;
    }[];
}
export declare const ADAPTERS: Record<AdapterId, AdapterDescriptor>;
export declare const GENERIC_TOOL_NAME = "delegate_worker";
export declare const ENABLE_HINT = "\u5728\u8BBE\u7F6E\u7684\u300C\u5916\u90E8 Agent\u300D\u9875\u542F\u7528\u8BE5\u5DE5\u4EBA\uFF0C\u6216\u5728 profile \u7684 cordis.patch.yml \u91CC\u6539 adapters.<id>.enabled\u3002";
export declare function isAdapterId(value: string): value is AdapterId;
export declare function isOfficialAdapterId(value: string): value is OfficialAdapterId;
export declare function isImplementedAdapterId(value: string): value is ImplementedAdapterId;
