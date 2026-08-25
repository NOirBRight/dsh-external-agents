/**
 * Shared one-shot print-json result mapping for Cursor Agent and Agy.
 * @module dsh-external-agents/print-json-result
 */
export interface PrintJsonSuccess {
    readonly ok: true;
    readonly text: string;
}
export interface PrintJsonFailure {
    readonly ok: false;
    readonly error: string;
}
export type PrintJsonOutcome = PrintJsonSuccess | PrintJsonFailure;
/** Map one print-json process outcome to a final text or a readable error. */
export declare function interpretPrintJson(input: {
    readonly product: "cursor" | "agy";
    readonly displayName: string;
    readonly exitCode: number | null;
    readonly stdout: string;
    readonly stderr: string;
}): PrintJsonOutcome;
