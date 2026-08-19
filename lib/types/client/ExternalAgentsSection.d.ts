/** External Agents settings page. */
import { type JSX } from 'react';
import type { InjectFace, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import type { AdapterId } from '../catalog.ts';
import type { AdapterProbe, ExternalAgentsSnapshot } from '../client-contract.ts';
import type { Config } from '../exposure.ts';
import type { ExternalAgentsKey } from './locales.ts';
export interface ExternalAgentsFace {
    t: (key: ExternalAgentsKey) => string;
    load: () => Promise<ExternalAgentsSnapshot>;
    probe: (models?: boolean) => Promise<Partial<Record<AdapterId, AdapterProbe>>>;
    pick: () => Promise<string | null>;
    save: (config: Config) => Promise<void>;
}
export type ExternalAgentsSectionProps = PropsRuntime<'settings.section'> & InjectFace<ExternalAgentsFace>;
export declare function ExternalAgentsSection(props: ExternalAgentsSectionProps): JSX.Element;
//# sourceMappingURL=ExternalAgentsSection.d.ts.map