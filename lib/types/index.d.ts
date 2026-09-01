/**
 * Host-plane External Agents control plane.
 * Registers official Product Worker tools from this plugin's config.
 * @module dsh-external-agents
 */
import type { Context } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
import { type Config as ExposureConfig } from './exposure.ts';
export { ADAPTERS, ADAPTER_IDS, GENERIC_TOOL_NAME, OFFICIAL_ADAPTER_IDS } from './catalog.ts';
export { resolveDelegationTarget, resolveExposure } from './exposure.ts';
export type { AdapterConfig, Exposure, NamedToolExposure } from './exposure.ts';
export { EXTERNAL_AGENTS_RPC_CHANNEL, PICK_ENDPOINT, PROBE_ENDPOINT, SAVE_ENDPOINT, SNAPSHOT_ENDPOINT, } from './client-contract.ts';
export declare const name = "external-agents";
/** Services required by every mounted feature of this control plane. */
export declare const inject: string[];
export type Config = ExposureConfig;
export declare const Config: z<Config>;
/**
 * Mount available official Delegation Tools and the generic delegate_worker.
 * Loading this plugin does not start any product process; without the optional
 * subprocess capability, no model-visible delegation tools are registered.
 */
export declare function apply(ctx: Context, config: Config): Promise<void>;
