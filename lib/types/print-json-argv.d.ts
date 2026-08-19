/**
 * Product CLI argv for print-json one-shot workers.
 * @module dsh-external-agents/print-json-argv
 */
export type UnattendedPolicy = 'auto' | 'strict';
export declare function cursorArgv(input: {
    readonly executable: string;
    readonly cwd: string;
    readonly task: string;
    readonly unattended: UnattendedPolicy;
    readonly model?: string;
}): string[];
export declare function agyArgv(input: {
    readonly executable: string;
    readonly task: string;
    readonly unattended: UnattendedPolicy;
    readonly printTimeoutMs: number;
    readonly model?: string;
}): string[];
//# sourceMappingURL=print-json-argv.d.ts.map