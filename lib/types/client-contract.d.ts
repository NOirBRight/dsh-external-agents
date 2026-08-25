/** Browser-safe RPC contract for the External Agents settings page. */
import { type AdapterId } from './catalog.ts';
import type { Config } from './exposure.ts';
export declare const EXTERNAL_AGENTS_RPC_CHANNEL = "/external-agents";
export declare const SNAPSHOT_ENDPOINT = "snapshot";
export declare const SAVE_ENDPOINT = "save";
export declare const PROBE_ENDPOINT = "probe";
export declare const PICK_ENDPOINT = "pick";
/** Legacy handoff endpoints stay registered and fail closed on stock DSH. */
export declare const PLAN_PREPARE_ENDPOINT = "plan.prepare";
export declare const PLAN_COMMIT_ENDPOINT = "plan.commit";
export declare const EXTERNAL_PLAN_HANDOFF_UNAVAILABLE = "External Agent Plan handoff is unavailable in this DSH version";
/** Public package-root contract mirrored by composer-picker without a runtime dependency. */
export declare const CONTINUE_IN_DSH_SLOT: "external-agents.plan-review.continue-in-dsh";
export type ExternalAgentAdapterId = 'codex' | 'claude-code' | 'cursor' | 'antigravity';
export type ExternalAgentPlanTargetId = `external-agent:${ExternalAgentAdapterId}`;
export type PlanTargetId = 'dsh' | ExternalAgentPlanTargetId;
export interface PlanExternalAgentTarget {
    id: ExternalAgentPlanTargetId;
    adapterId: ExternalAgentAdapterId;
    label: string;
    description?: string;
    disabled?: boolean;
}
/** Public plugin-to-plugin owner Interface; Composer supplies the execution commit. */
export interface ContinueInDshOwner {
    locked: boolean;
    targets: readonly PlanExternalAgentTarget[];
    targetsLabel: string;
    selectedTarget: PlanTargetId;
    selectTarget: (target: PlanTargetId) => void;
    registerCommit: (commit: (() => Promise<boolean>) | null) => () => void;
}
export interface AdapterProbe {
    found: boolean;
    path?: string;
    version?: string;
    login?: 'product-managed' | 'ok' | 'unknown';
    loginDetail?: string;
    /** Product model ids the settings dropdown can offer. */
    models?: string[];
}
export interface CatalogCard {
    id: AdapterId;
    displayName: string;
    executable: string;
    toolName: string;
    docsUrl: string;
    loginMode: 'cursor-status' | 'product-managed';
    supportsUnattended: boolean;
    knownModels: {
        id: string;
        label: string;
    }[];
}
export interface ExternalAgentsSnapshot {
    config: Config;
    catalog: CatalogCard[];
    probes: Partial<Record<AdapterId, AdapterProbe>>;
}
export declare function decodeSnapshot(value: unknown): ExternalAgentsSnapshot | undefined;
