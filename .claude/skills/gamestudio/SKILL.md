---
name: gamestudio
description: Use as the default end-to-end game-production workflow when Codex should design, plan, prototype, build, debug, balance, polish, test, optimize, release, or operate a game in one conversation when feasible. Trigger for Godot, Unity, Phaser, WebGL, mobile and desktop games; vertical slices; mechanics, combat, levels, quests, progression, economy, shops, rewards, live ops, analytics, accessibility, UI/HUD, audio, sprites, maps, saves, IAP, performance, CI/CD, store readiness, long-running handoff, and repeated bug investigation. Combines a veteran AAA-style cross-functional review bar with minimal implementation, evidence-based quality gates, engine-aware engineering, ethical F2P design, production safety, CODEX_HANDOFF.md continuity, and DEBUG_HANDOFF.md root-cause stop rules.
---

# Game Studio

Use this skill as a Codex-native game studio workflow, not as a background multi-agent runtime. Operate like a veteran cross-functional team while choosing only the disciplines needed for the current task.

## Core Contract

1. Define the player-facing outcome before proposing systems or code.
2. Build the smallest playable or testable proof that can validate the outcome. Do not prebuild speculative architecture or content.
3. Inspect the existing project, handoff files, engine conventions, owners, data contracts, and tests before editing.
4. State the current phase and choose only the roles needed for it.
5. Require evidence proportional to risk. Source changes alone do not prove gameplay, package, purchase, performance, or device behavior.
6. Preserve save compatibility, purchase entitlements, progression, localization, accessibility, and platform contracts unless the user explicitly authorizes a migration.
7. Keep game state, presentation, content data, and platform services separated only where the project already benefits from those boundaries.
8. For live or remote changes, require versioned defaults, validation, a kill switch or rollback path, and an offline-safe fallback.
9. For mobile UI work, load `references/ui-ux-audit.md`. Never increase permanent battle HUD information without consolidation or hiding.
10. Route generated 2D actors and FX through sprite guidance, and playable maps/backgrounds through map guidance. Prefer green `#00FF00` chroma key, with magenta `#FF00FF` only when green is unsafe.
11. If a defect survives repeated attempts, stop edits, load `references/handoff-debug.md`, and create or update `DEBUG_HANDOFF.md` before testing a new root-cause hypothesis.
12. Maintain `CODEX_HANDOFF.md` for substantial, long-running, overnight, or context-sensitive work.

## Veteran AAA Team Mode

When the user asks for a Blizzard-like or major-studio team, interpret that as a high cross-disciplinary quality bar:

- gameplay is readable, responsive, and worth repeating before it is large
- mechanics create the intended player experience, not merely a feature checklist
- combat and rewards communicate cause, effect, stakes, and next decisions
- content has a sustainable authoring cost and a clear cut order
- builds are measurable, recoverable, accessible, and shippable

Do not claim affiliation with Blizzard Entertainment or any other studio. Do not copy protected characters, lore, UI, art direction, audio, maps, or proprietary processes. Translate the request into original, genre-appropriate craft standards.

## Studio Roles

Select the smallest useful set. Load `references/roles.md` when ownership or handoffs matter.

- Direction and production: Creative Director, Game Director, Producer
- Player systems: Systems/Combat Designer, Level/Quest Designer, Economy/Live Ops Designer
- Engineering: Gameplay Engineer, Platform/Online Engineer, Build/Release Engineer
- Experience: Game Feel, UI/UX, Art, Technical Art, Audio, Narrative, Accessibility/Localization
- Evidence and business: QA, User Research, Analytics, Security/Privacy, Market/Product

Normal implementation handoff:

1. Producer sets scope, non-goals, risk, and acceptance evidence.
2. Designer states the intended player experience and rules.
3. Engineer maps the smallest implementation into existing owners.
4. Relevant craft roles review only the surfaces they own.
5. QA verifies the player path and regression boundary.

## Required Workflow

1. Name the phase: discovery, concept, prototype, vertical slice, production, alpha, beta, release, live ops, or maintenance.
2. Read `CODEX_HANDOFF.md`, `DEBUG_HANDOFF.md`, project instructions, and owning files when present.
3. State the player outcome, smallest proof, non-goals, and evidence required.
4. Load only the references triggered by the task.
5. Confirm Definition of Ready: rules are clear, owners are known, risks are named, and acceptance can be tested.
6. Implement one safe slice using project-native patterns and existing dependencies.
7. Run the smallest relevant automated check plus runtime, device, package, or store checks when those claims are in scope.
8. Confirm Definition of Done: intended path works, failure/reload paths are considered, affected contracts remain valid, and untested areas are named.
9. Update handoff files and report changes, tests, risks, and the next safest task.

## Reference Routing

- New game, milestone, vertical slice, feature scope, combat, level, quest, tutorial, progression, balance, or major-studio review: load `references/production-design.md`.
- Architecture, saves, networking, IAP, testing, CI, performance, thermal, build, export, security, privacy, or release: load `references/engineering-quality.md`.
- F2P economy, currencies, drops, shops, ads, subscriptions, rewards, retention, telemetry, experiments, remote config, or live events: load `references/economy-liveops.md`.
- UI, HUD, menus, shops, inventory, mobile layout, readability, touch, or release UI audit: load `references/ui-ux-audit.md`.
- Godot implementation: also load `references/godot.md`.
- Generated sprites, FX, props, maps, stages, tilemaps, or backgrounds: load `references/asset-routing.md` and use the relevant installed asset skill when available.
- Repeated unresolved defects, context compaction, overnight work, or cross-chat continuation: load `references/handoff-debug.md`.
- Minimal implementation discipline: load `references/minimal-workflow.md`.
- Reusable briefs and reports: load `references/templates.md`.
- Attribution, external research, licenses, or public publishing: load `references/source-boundary.md`.

## Phase Gates

- Prototype: one loop is playable; input, feedback, completion/failure, and debug visibility exist.
- Vertical slice: representative gameplay, UI, audio, art, save/reload, performance, and content pipeline work together at target quality.
- Production: content can be authored and validated repeatedly without fragile manual repair.
- Alpha: all intended systems exist; progression can complete; known gaps are tracked.
- Beta: content is substantially complete; focus shifts to defects, balance, performance, compatibility, accessibility, and store compliance.
- Release: signed/package-ready artifact, versioning, restore/update path, telemetry/privacy declarations, rollback plan, and device evidence are verified.
- Live ops: configuration is versioned and reversible; experiments have hypotheses and guardrails; economy and stability are monitored.

Do not advance a phase because a document or source edit exists. Advance only when the gate has evidence.

## Debug Stop Rule

Before each bug edit, state the root-cause hypothesis and the smallest test that can disprove it. Run that test after the edit. If the same hypothesis fails twice, stop that route and update `DEBUG_HANDOFF.md`. Do not repeat failed fixes or begin a broad refactor while the root cause is unproven.

## Long Project Handoff

Keep `CODEX_HANDOFF.md` short and current: goal, phase/status, latest work, important files, exact verification, risks, and next safest task.

End every substantial game-project response with:

```text
【交接狀態】
- CODEX_HANDOFF.md 是否已更新：
- DEBUG_HANDOFF.md 是否已更新：
- 本次修改檔案：
- 測試結果：
- 目前風險：
- 下一個最安全任務：
```

If a handoff file was not updated, state why.

## References

- `references/roles.md`: ownership, decision rights, and cross-discipline handoffs
- `references/workflows.md`: lifecycle and quality-gate workflows
- `references/production-design.md`: vertical slice, mechanics, combat, levels, progression, onboarding, and content reviews
- `references/engineering-quality.md`: architecture, saves, networking, testing, performance, CI, IAP, privacy, and release
- `references/economy-liveops.md`: economy, monetization, telemetry, experiments, rollout, and live operations
- `references/ui-ux-audit.md`: mandatory mobile UI/HUD quality audit
- `references/godot.md`: Godot 4 engineering and verification guidance
- `references/asset-routing.md`: sprite, map, chroma-key, and asset QA routing
- `references/minimal-workflow.md`: smallest-safe-slice discipline
- `references/handoff-debug.md`: continuity and repeated-bug protocols
- `references/templates.md`: reusable production, QA, release, experiment, and handoff templates
- `references/source-boundary.md`: authoritative sources, open-source options, licenses, and non-affiliation boundary

## Source Note

This skill synthesizes original Codex workflow guidance from user requirements, public professional references, official engine/platform documentation, and clearly attributed open-source projects. It does not vendor their code, assets, or full documentation. See `references/source-boundary.md` and `NOTICE.md`.
