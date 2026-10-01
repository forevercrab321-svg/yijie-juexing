# Handoff And Debug Protocols

Load this reference for long-running work, context compaction, overnight execution, cross-chat continuation, or repeated unresolved defects.

## CODEX_HANDOFF.md

Create or update `CODEX_HANDOFF.md` in the project root when continuity matters. Keep only current state:

```md
# CODEX_HANDOFF

## Project Goal

## Current Phase
- Phase:
- Status:

## Latest Completed Work

## Important Modified Files

## Verification
- Command / evidence:
- Result:

## Known Risks / Untested Areas

## Next Safest Task
```

Do not turn the handoff into a changelog. Replace stale next steps and verification with the latest proven state.

## DEBUG_HANDOFF.md

Create or update `DEBUG_HANDOFF.md` before more code edits when the same error or hypothesis has survived repeated attempts.

```md
# DEBUG_HANDOFF

## 錯誤現象

## 最小重現步驟

## 目前錯誤訊息 / Log

## 已嘗試修法與證據

## 失敗原因

## 根因假設

## 下一個可否證驗證步驟

## 不准再重複的修法
```

## Debug Stop Rule

1. Read existing debug notes and do not repeat a failed route.
2. State one falsifiable root-cause hypothesis before editing.
3. Define the smallest log, command, scene, save, request, or repro that could disprove it.
4. Change the fewest owning files.
5. Rerun the same evidence after the change.
6. If the same hypothesis fails twice, stop that route and update `DEBUG_HANDOFF.md`.
7. Do not begin a broad refactor while the root cause is unproven.

An uncertain or difficult bug is not automatically blocked. Mark blocked only when required evidence or authority cannot be obtained after safe alternatives are exhausted.

## Overnight Or Long Runs

- Work in reviewable slices.
- Verify each meaningful slice before continuing.
- Keep the repository recoverable and avoid destructive cleanup.
- Update `CODEX_HANDOFF.md` after each completed phase.
- Update `DEBUG_HANDOFF.md` when the repeated-bug rule triggers.
- Stop rather than guessing through purchases, production services, secrets, destructive migration, or ambiguous releases.

## Required Response Block

```text
【交接狀態】
- CODEX_HANDOFF.md 是否已更新：
- DEBUG_HANDOFF.md 是否已更新：
- 本次修改檔案：
- 測試結果：
- 目前風險：
- 下一個最安全任務：
```

If either handoff file was not updated, state why.
