/**
 * Product CLI argv for print-json one-shot workers.
 * @module dsh-external-agents/print-json-argv
 */

export type UnattendedPolicy = 'auto' | 'strict'

export function cursorArgv(input: {
  readonly executable: string
  readonly cwd: string
  readonly task: string
  readonly unattended: UnattendedPolicy
  readonly model?: string
}): string[] {
  const argv = [input.executable, '-p', '--output-format', 'json']
  if (input.unattended === 'auto') argv.push('--force')
  argv.push('--trust', '--workspace', input.cwd)
  if (input.model !== undefined && input.model.length > 0) argv.push('--model', input.model)
  argv.push('--', input.task)
  return argv
}

export function agyArgv(input: {
  readonly executable: string
  readonly task: string
  readonly unattended: UnattendedPolicy
  readonly printTimeoutMs: number
  readonly model?: string
}): string[] {
  // --print takes an optional prompt argument. Flags after --print are eaten as
  // the task (the model then "explains --output-format"). Keep --print last.
  const argv = [input.executable]
  if (input.unattended === 'auto') argv.push('--dangerously-skip-permissions')
  argv.push('--output-format', 'json')
  argv.push('--print-timeout', String(Math.floor(input.printTimeoutMs / 1000)) + 's')
  if (input.model !== undefined && input.model.length > 0) argv.push('--model', input.model)
  argv.push('--print', input.task)
  return argv
}
