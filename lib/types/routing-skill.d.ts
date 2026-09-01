/** Load and register the routing-only External Agents skill. */
import type { Context } from '@deepseek-ai/cordis';
export declare function routingSkillPath(): string;
export declare function parseSkillMarkdown(raw: string): {
    name: string;
    description: string;
    content: string;
};
/** Register the routing skill when the optional skill registry is available. */
export declare function registerRoutingSkill(ctx: Context): void;
