# Game Studio Lifecycle Workflows

Use the workflow matching the current phase. Do not drag every phase into a narrow task.

## Discovery And Concept

Use for a new game, major direction, audience question, or uncertain feature.

1. Define player, context, fantasy, target emotion, and core problem.
2. State three to five pillars and anti-pillars.
3. Identify platform, input, session, content, team, technology, accessibility, and business constraints.
4. List riskiest assumptions and the cheapest proof for each.
5. Cut ideas that do not serve a pillar or test a risk.

Gate:

- one clear player promise
- one testable core loop hypothesis
- explicit non-goals
- prototype question and success/failure evidence

## Prototype

Use to answer whether one interaction or loop works.

1. Build minimum input, rules, feedback, completion/failure, and restart.
2. Use replaceable assets and direct data.
3. Expose enough state to diagnose the result.
4. Observe a real play path without coaching when possible.
5. Decide `KEEP`, `CHANGE`, `CUT`, or `TEST`.

Gate:

- the player can enter, act, understand consequence, fail/succeed, and retry
- the original question has evidence
- roughness and intentional omissions are documented

## Vertical Slice

Use to prove representative shipping quality and production feasibility.

1. Select one end-to-end path representative of final play.
2. Integrate gameplay, UI, audio, art, save/resume, content data, and target-device performance.
3. Produce one additional content unit through the intended pipeline.
4. Measure authoring time, integration friction, defects, memory/package impact, and device behavior.
5. Establish cut order and production risks.

Gate:

- representative quality is playable on target hardware
- core contracts survive reload and failure paths
- another content unit can be produced predictably
- budgets and risks are evidence-based

## Production

Use to implement repeatable systems and content.

1. Work in small vertical slices with Definition of Ready and Done.
2. Keep tuning/content in established data owners.
3. Validate authored data and preview it where existing tools allow.
4. Preserve save migrations, localization keys, import metadata, and platform contracts.
5. Run focused checks on each slice and broader regression at integration points.

Gate:

- features complete their intended player path
- content throughput is sustainable
- repeated manual repair is eliminated or tracked
- build health and performance budgets remain visible

## Alpha

Use when all intended systems should exist.

Focus on:

- complete start-to-finish progression
- missing integrations and blocked content paths
- save/update compatibility
- telemetry/data validation
- major exploits, soft locks, crashes, and performance cliffs
- full cut list and schedule risk

Gate: every intended system is represented and the game can be completed through its planned path, with gaps explicitly tracked.

## Beta

Use when content is substantially complete.

Focus on:

- defects and regression
- balance across player/build/progression bands
- target-device performance, thermal, memory, load, and lifecycle
- accessibility, localization, input, safe area, and supported platform matrix
- purchase, ad, account, network, and offline behavior
- package/store readiness and privacy declarations

Gate: no unresolved issue blocks primary play, progress, purchases, accessibility, security, or platform acceptance; remaining risks have owners.

## Release

1. Freeze the named candidate commit and version.
2. Run source, runtime, device, artifact, and store gates at their actual layers.
3. Verify fresh install, production upgrade, restore, offline, suspend/resume, low storage, and failure recovery.
4. Confirm signed package identity, contents, version, and launch.
5. Confirm monitoring, staged rollout, stop conditions, support notes, and rollback.

Gate: the exact release artifact is verified, recoverable, attributable to its source, and ready for the named distribution path.

## Live Operations

1. Define player value, target cohort, schedule, configuration/content version, success metric, and guardrails.
2. Validate defaults, compatibility, rewards, localization, purchases, and failure/late-claim paths.
3. Stage rollout and monitor stability, economy, fairness, and player response.
4. Pause or roll back when stop conditions trigger.
5. Close the event with grants reconciled, configs archived, and findings recorded.

Gate: the change is reversible, measurable, privacy-safe, and compatible with supported clients.

## Maintenance And Debugging

1. Reproduce and capture exact build, environment, state, inputs, logs, and expected behavior.
2. Identify the owning boundary and state a falsifiable root-cause hypothesis.
3. Run the smallest test that can disprove it before broad edits.
4. Make one focused change and rerun the same evidence.
5. If the hypothesis fails twice, stop the route and update `DEBUG_HANDOFF.md`.

Gate: root cause is demonstrated, the fix covers the repro, and the highest-risk adjacent behavior is checked.

## Change Risk Classification

- Low: isolated presentation/text/content with no persistent or shared contract
- Medium: shared gameplay, UI flow, content schema, scene lifecycle, or performance-sensitive change
- High: saves, purchases, economy, networking, accounts, security, platform SDK, build/signing, or broad shared architecture

Scale validation and rollout with risk. A small diff can still be high risk.

## Review Cadence

Use only the review needed:

- daily/slice: player outcome, changed owners, focused evidence, blockers
- milestone: phase gate, playable build, risks, cuts, cross-discipline contracts
- release candidate: artifact, device/store matrix, operations, rollback
- live review: metric definitions, stability/economy guardrails, incidents, next experiment

Every review ends with decisions and owners, not only observations.
