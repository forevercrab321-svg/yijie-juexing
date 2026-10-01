# Game Engineering And Release Quality

Load this reference for architecture, save data, networking, IAP, testing, CI/CD, performance, thermal behavior, builds, exports, privacy, security, or release work.

## Contents

- Evidence and ownership
- Runtime architecture
- Save and migration safety
- Purchases and online authority
- Performance budgets
- Testing by risk
- Engine-specific checks
- CI, release, observability, and privacy

## Evidence Before Claims

Match each claim to evidence:

- source correctness: parser, type, lint, unit, or focused logic check
- scene/runtime behavior: headless load, play-mode test, browser smoke, or manual run
- device behavior: target-device profile, input, suspend/resume, thermal, memory, and safe-area evidence
- package behavior: artifact existence, package ID, version, contents, signature, and install/launch check
- store/service behavior: test-track install, purchase lifecycle, restoration, revocation, policy, and console evidence

Never report a generated artifact as shipped, a local purchase callback as store-verified, or an editor profile as target-device performance.

## Runtime Ownership

Before changing architecture, identify:

- authoritative owner of gameplay state
- presentation/read-model owner
- content and tuning source of truth
- save serialization and migration owner
- platform/service boundary
- test or debug entry point

Prefer existing engine patterns. Keep dependencies directional and state changes observable. Avoid singleton proliferation, duplicate caches, hidden mutable globals, and event buses used to avoid clear ownership.

Separate deterministic rules from effects when doing so enables focused tests, replay, networking, or balance simulation. Do not introduce ECS, dependency injection frameworks, service locators, or custom pipelines without measured need.

## Save And Migration Safety

For persistent games, require:

- explicit schema or data version
- forward migration from every supported shipped version
- validation and defaults for missing, unknown, malformed, or out-of-range data
- atomic write or write-then-replace behavior where the platform permits
- backup/recovery path for corrupt or interrupted writes
- stable identifiers instead of display names or array positions
- idempotent reward and transaction application
- UTC timestamps with explicit offline/clock-manipulation policy when time matters
- suspend, force-close, reinstall, account-switch, and restore expectations

Test at least current save, oldest supported save, missing fields, corrupt data, full inventory, duplicate grant, and interrupted write. Never delete or silently reset player progress as a convenience fix.

## Purchase And Entitlement Safety

Treat the store/backend purchase state as authoritative. Require:

- pending, purchased, cancelled, failed, refunded, revoked, consumed, acknowledged, and restored paths as applicable
- globally unique transaction or purchase-token deduplication
- entitlement grants that are idempotent
- server-side verification for valuable or account-bound entitlements when a backend exists or abuse risk justifies one
- no benefit grant while a transaction is only pending
- acknowledgement/consumption within platform requirements
- reconnect, retry, duplicate callback, app restart, and account mismatch handling
- visible purchase success/failure state without exposing secrets or raw internals

Keep signing material, API credentials, service-account keys, and purchase secrets out of source control and client code. Verify current store documentation before changing billing because requirements and library versions change.

## Multiplayer And Online State

When online play applies:

- define client, server, and service authority per state transition
- validate trust-boundary input and rate-limit abuse-prone actions
- design commands and grants for retry/idempotency
- define disconnect, reconnect, timeout, stale-state, and version-mismatch behavior
- simulate latency, jitter, packet loss, duplicate messages, and out-of-order delivery
- separate prediction/presentation from authoritative results
- preserve deterministic inputs or reconciliation evidence where the design requires it

Never trust the client for currency, inventory, competitive outcome, or purchase authority merely because transport is encrypted.

## Performance Budgets

Define budgets before optimization:

- target and minimum acceptable frame rate
- frame-time budget and p95/p99 spikes
- low, representative, and high device tiers
- CPU, GPU, main-thread, draw-call, memory, and allocation limits relevant to the project
- cold/warm start and scene-transition targets
- package/download size and content-update cost
- sustained thermal, battery, and background/resume behavior

Profile the shipping configuration on target hardware. Editor and development builds are diagnostic aids, not final evidence. Capture the same scenario before and after a change and preserve gameplay behavior.

Optimize measured hotspots in this order when applicable: unnecessary work, repeated loading/allocation, overdraw/draw calls, oversized assets, expensive effects/shaders, update frequency, then lower-level rewrites. Stop when the target budget is met.

For mobile, include a sustained fixed-brightness run long enough to expose thermal throttling; record device, build, settings, frame pacing, temperature/thermal state when available, and battery conditions.

## Testing By Risk

Use the smallest layer that can catch the failure:

- pure logic tests for economy, combat math, drops, migrations, and deterministic rules
- component/scene tests for wiring, signals, lifecycle, and UI state
- play/browser smoke tests for the player path and input
- device tests for performance, lifecycle, touch, platform SDKs, and permissions
- artifact tests for package identity, version, signature, contents, and launch
- store-track/service tests for billing, achievements, cloud saves, ads, and policy behavior

Always test changed behavior plus its highest-risk adjacent contract. Add a framework only when repeated tests justify ownership; otherwise use existing checks or one focused script.

## Engine-Specific Checks

### Godot 4

- Read `project.godot`, owning scenes/scripts, autoloads, resources, and existing tests.
- Keep reusable scenes self-contained or inject dependencies from an owner; do not hardcode fragile external node paths.
- Preserve node names, signals, exported properties, UIDs, and import metadata when contracts depend on them.
- Use typed GDScript and warnings where they improve long-lived or high-risk code; do not rewrite a project solely for style.
- Prefer engine headless scene loads, focused scripts, and project checks. Use GUT or GdUnit4 only when already present or when a real test suite is justified.
- Automate export with explicit presets and paths. Commit `export_presets.cfg` when appropriate; never commit `.godot/export_credentials.cfg`.

Also load `references/godot.md` for detailed project reading and UI guidance.

### Unity

- Respect assembly, prefab, scene, ScriptableObject, serialization, Addressables, and package-version contracts.
- Use EditMode for isolated logic and PlayMode/player tests for scene/runtime behavior.
- Profile a player build on target hardware; editor profiling is not shipping evidence.
- Preserve content-state files required by the project's Addressables update workflow.
- Use GameCI only when CI value outweighs license/activation/setup cost and versions are pinned.

### Phaser/Web

- Respect Scene lifecycle, ownership, shutdown cleanup, unified pointer input, Scale Manager, and browser visibility/resume behavior.
- Run static/type checks, a real browser smoke test, console-error check, touch input, orientation/resize, and mobile viewport screenshots.
- Verify asset preload failures, audio unlock, offline/network failure, focus loss, and repeated scene restart.
- Use existing Playwright/webapp-testing support rather than inventing a browser harness.

## CI And Release Gate

CI should make one reproducible claim at a time:

1. restore pinned toolchain/dependencies
2. validate source and content data
3. run focused tests
4. build/export explicit target
5. verify artifact identity, contents, version, and signature
6. publish only the named artifact from the named commit

Release checklist:

- version name/code and package/application ID
- clean source scope and reproducible build instructions
- secrets/signing preflight without printing sensitive values
- save migration and update-from-production path
- fresh install, upgrade, launch, suspend/resume, offline, and low-storage behavior
- supported device/OS and locale matrix
- UI/accessibility audit
- purchase/restore/revoke tests when monetized
- crash/ANR/performance/thermal evidence
- privacy/data-safety declarations matching actual SDK behavior
- staged rollout, monitoring owner, stop conditions, and rollback path

## Observability And Privacy

Capture enough context to diagnose production failures:

- build/version, platform, device class, scene/mode, session step, and error category
- bounded breadcrumbs around important state transitions
- performance samples tied to scenarios and build IDs
- economy/purchase events with reason and deduplication IDs, without secrets

Do not log purchase tokens, credentials, raw personal data, chat, or stable identifiers unless strictly required, disclosed, protected, and retained appropriately. Inventory every SDK and ensure telemetry, ads, crash reporting, and account data match current consent and store declarations.

## Engineering Definition Of Done

A change is done only when:

- the intended player path and relevant failure path work
- save, purchase, networking, UI, and content contracts touched by the change are verified
- performance stays inside the defined budget or the exception is explicit
- tests or reproducible evidence exist
- artifact/store claims are checked at their actual layer
- risks, untested areas, rollout, and rollback are documented
