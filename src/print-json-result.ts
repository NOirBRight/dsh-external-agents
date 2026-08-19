/**
 * Shared one-shot print-json result mapping for Cursor Agent and Agy.
 * @module dsh-external-agents/print-json-result
 */

export interface PrintJsonSuccess {
  readonly ok: true
  readonly text: string
}

export interface PrintJsonFailure {
  readonly ok: false
  readonly error: string
}

export type PrintJsonOutcome = PrintJsonSuccess | PrintJsonFailure

function lastJsonObject(stdout: string): unknown {
  const trimmed = stdout.trim()
  if (trimmed.length === 0) return undefined
  try {
    return JSON.parse(trimmed) as unknown
  } catch {
    const start = trimmed.lastIndexOf("{")
    if (start < 0) return undefined
    try {
      return JSON.parse(trimmed.slice(start)) as unknown
    } catch {
      return undefined
    }
  }
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return undefined
  return value as Record<string, unknown>
}

function loginHint(product: "cursor" | "agy", stderr: string): string | undefined {
  const text = stderr.toLowerCase()
  if (product === "cursor") {
    if (
      text.includes("not logged")
      || text.includes("unauthoriz")
      || text.includes("please log")
      || text.includes("cursor-agent login")
    ) {
      return "Cursor Agent 未登录。请在本机运行 cursor-agent login。"
    }
  }
  if (product === "agy") {
    if (
      text.includes("not logged")
      || text.includes("unauthoriz")
      || text.includes("please log")
      || text.includes("agy login")
    ) {
      return "Antigravity 未登录。请用 Agy 原生登录后再试。"
    }
  }
  return undefined
}

/** Map one print-json process outcome to a final text or a readable error. */
export function interpretPrintJson(input: {
  readonly product: "cursor" | "agy"
  readonly displayName: string
  readonly exitCode: number | null
  readonly stdout: string
  readonly stderr: string
}): PrintJsonOutcome {
  const login = loginHint(input.product, input.stderr)
  if (login !== undefined) return { ok: false, error: login }

  const record = asRecord(lastJsonObject(input.stdout))
  if (record !== undefined) {
    const result = record.result
    const response = record.response
    const subtype = record.subtype
    const status = record.status
    const isError = record.is_error
    const text = typeof result === "string" && result.trim().length > 0
      ? result
      : typeof response === "string" && response.trim().length > 0
        ? response
        : undefined
    const success = isError !== true
      && (subtype === undefined || subtype === "success")
      && (status === undefined || String(status).toLowerCase() === "success")
    if (text !== undefined && success) {
      return { ok: true, text: text.trim() }
    }
    if (isError === true || (typeof subtype === "string" && subtype !== "success")) {
      const details = Array.isArray(record.errors)
        ? record.errors.filter((item): item is string => typeof item === "string").join("; ")
        : undefined
      const detail = details && details.length > 0
        ? details
        : typeof result === "string" && result.trim().length > 0
          ? result
          : typeof subtype === "string" ? subtype : "is_error"
      return { ok: false, error: input.displayName + " 失败：" + detail }
    }
  }

  if (input.exitCode !== 0 && input.exitCode !== null) {
    const tail = input.stderr.trim() || input.stdout.trim()
    if (tail.length > 0) {
      return { ok: false, error: input.displayName + " 退出码 " + String(input.exitCode) + "：" + tail.slice(0, 2000) }
    }
    return { ok: false, error: input.displayName + " 退出码 " + String(input.exitCode) + "，且没有 JSON 最终文本。" }
  }

  return {
    ok: false,
    error: input.displayName + " 没有给出非空最终文本（需要 stdout JSON：subtype=success、is_error=false、result 非空）。",
  }
}
