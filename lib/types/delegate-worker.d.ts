/** Generic Delegation Tool. Routes to the Default Adapter or an explicit one. */
import type { Context } from '@deepseek-ai/cordis';
import { type Exposure } from './exposure.ts';
/** Register the generic delegate_worker tool against the current Exposure. */
export declare function registerDelegateWorker(ctx: Context, exposure: Exposure): (() => void) | void;
//# sourceMappingURL=delegate-worker.d.ts.map