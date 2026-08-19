---
name: delegate-product-worker
description: >-
  Do not use for images, screenshots, OCR, attached pictures, chat, Q&A,
  or one-line edits. Use only to route an independent, checkable coding task
  to a local product worker (Codex, Claude Code, Cursor Agent, Antigravity,
  agy, 外部 Agent, External Agent) when the user names one or asks to 委托 / delegate.
  Call subagent_codex, subagent_claude_code, worker_cursor, worker_antigravity,
  or delegate_worker. Never spawn the product CLI.
---

# Delegate to a product worker

Reply to the user in the language they used. This file is procedure, not the UI language.

Default is **do the work yourself**. Delegation is the exception. Workers do not see this conversation, attached images, or parent tools.

Do not spawn `codex`, `claude`, `cursor-agent`, or `agy` from the shell.

## 1. Refuse first

Stay in this session if **any** of these is true:

- The user attached an image, screenshot, or sticker, or asked what a picture shows
- The turn is chat, explanation, translation, or a short question
- The change is one line or one obvious edit
- The work only makes sense with this conversation
- The action is irreversible publish, production delete, or a live release

A product worker cannot see the image in this chat. Sending it to a worker is a bug, not a fallback.

If the user named a product **and** the turn is still one of the cases above, stay. Naming a product does not override "this is not a coding task."

## 2. Delegate only when all of these hold

- The work is coding or repo surgery that can be specified alone
- It is worth a new product context
- The prompt can list goal, paths, allowed edits, and a check
- The user named a product, or the task is large enough that a worker is cheaper than doing it here

## 3. Pick one tool

1. User named a product → that named tool
2. Otherwise → `delegate_worker` with no `adapter` (settings Default)

| User said | Tool |
| --- | --- |
| Codex | `subagent_codex` |
| Claude / Claude Code | `subagent_claude_code` |
| Cursor / cursor-agent | `worker_cursor` |
| Antigravity / agy | `worker_antigravity` |
| 外部 Agent / External Agent / unnamed | `delegate_worker` |

Do not use built-in `subagent` / `subagent_fork` to impersonate these products.

## 4. Write a bounded task

The `prompt` must be self-contained. Include goal, paths, allow/deny, and how to check. `description` is 3–5 words for the Job Panel. Set `run_in_background: true` only if the user asked to background it or the job will clearly run long.

## 5. After the tool returns

Use the returned text. If you need proof, run the check yourself. A worker saying "tests passed" is not evidence. On failure, report the tool error. Do not retry the same product via the shell.

Do not resume a product session or pass a product session id.
