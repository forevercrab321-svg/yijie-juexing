# Game Studio Templates

Use only the smallest template needed. Delete empty sections instead of filling them with guesses.

## Definition Of Ready

```md
# Ready: [Slice]

- Player outcome:
- Phase / pillar:
- Scope:
- Non-goals:
- Owning files/systems:
- Rules and edge cases:
- Save/IAP/network/UI impact:
- Acceptance evidence:
- Risks / rollback:
```

## Feature Brief

```md
# Feature: [Name]

## Player Intent

## Core Rules

## Player Flow

## Feedback / UI / Audio

## Data And Tuning

## Failure / Recovery

## Acceptance Criteria

## Verification
```

## Vertical Slice Review

```md
# Vertical Slice: [Name]

- Representative player path:
- Target quality surfaces:
- Save/reload proof:
- Target-device proof:
- Content-authoring proof:
- Known shortcuts:
- Production cost:
- Cut order:
- Decision: KEEP / CHANGE / CUT / TEST
- Next proof:
```

## Game Design Review

```md
# Design Review: [System]

- Intended emotion/fantasy:
- Mechanics:
- Expected dynamics:
- Observed dynamics:
- Meaningful decisions:
- Dominant/exploit risks:
- Failure readability:
- Accessibility/difficulty:
- KEEP:
- CHANGE:
- CUT:
- TEST:
```

## Economy Change

```md
# Economy Change: [Name]

- Player value:
- Source/sink affected:
- Before/after rates:
- Progression cohorts:
- Worst-case/random path:
- Inflation/starvation risk:
- Grant/deduplication/save path:
- Monetization trust risk:
- Simulation/test:
- Rollback:
```

## Experiment Brief

```md
# Experiment: [Name]

- Player problem:
- Hypothesis:
- Control:
- Treatment:
- Eligible population / exclusions:
- Assignment / mutual exclusion:
- Primary metric:
- Guardrails:
- Exposure event validation:
- Decision window:
- Stop conditions:
- Rollback owner:
- Expiry date:
```

## QA Report

```md
# QA Report: [Feature / Build]

## Build And Environment

## Tested Paths

## Findings
- [P0-P4] [Issue] - [Repro] - [Expected] - [Evidence]

## Regression Boundary

## Untested Areas

## Recommendation
Ready / Ready with risks / Not ready
```

## Release Gate

```md
# Release Gate: [Version / Artifact]

- Source commit:
- Package/application ID:
- Version name/code:
- Artifact path/hash:
- Signature/package verification:
- Fresh install / upgrade:
- Save migration:
- Purchase/restore/revoke:
- Offline / suspend/resume:
- Device / locale / accessibility:
- Performance / thermal:
- Privacy/data declarations:
- Rollout / monitoring / stop conditions:
- Rollback:
- Decision: GO / GO WITH RISKS / NO-GO
```

## Phase Completion

```md
# Phase: [Name]

## Gate Evidence

## Completed

## Cut / Deferred

## Known Risks

## Next Safest Slice
```

## Long Project Handoff

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

## Debug Handoff

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

## Response Handoff Block

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
