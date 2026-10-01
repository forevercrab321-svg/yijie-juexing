# Economy, Analytics, And Live Operations

Load this reference for F2P progression, currencies, drops, shops, ads, subscriptions, rewards, retention, telemetry, experiments, remote configuration, events, or post-launch operation.

## Contents

- Economy model
- Progression and rewards
- Ethical monetization
- Telemetry and metrics
- Experiments
- Remote configuration and live events
- Incident and review gates

## Economy Model

Map every economy before tuning:

```text
Source -> Currency/item -> Inventory/cap -> Sink -> Player value -> Next decision
```

For each resource, define:

- player-facing purpose
- earning sources and expected rate by progression band
- spending sinks and expected rate
- storage cap, overflow, expiry, and duplicate behavior
- tradability, refund, revocation, and restoration rules
- authoritative data owner and telemetry reason codes
- inflation, hoarding, starvation, and exploit risks

Avoid currencies with no distinct decision role. Prefer fewer, legible resources over a dashboard of near-duplicates.

## Progression And Reward Pacing

Build a progression table or simulation before relying on intuition. Check:

- time/actions to first reward, first upgrade, first meaningful choice, and major milestone
- expected and worst-case progress for random drops
- new, average, expert, returning, and non-paying player paths
- power growth versus encounter growth
- duplicate protection, pity/bad-luck protection, and inventory pressure when randomness is material
- catch-up without invalidating earlier effort
- maximum-level, post-cap, and season-reset behavior

Rewards should acknowledge mastery, exploration, persistence, or choice. Do not use constant rewards to hide a weak core loop.

For loot, record the complete grant path: table/version, roll context, result, inventory destination, overflow behavior, save confirmation, and player feedback.

## Ethical Monetization Gate

Monetization must preserve informed choice and the core game experience. Require:

- clear real-money price and exact contents before confirmation
- honest scarcity, timers, odds, comparisons, and subscription terms
- no accidental purchase path or disguised advertisement
- purchase restoration and entitlement visibility
- a playable non-paying path appropriate to the product promise
- spending limits, parental/platform controls, and age-sensitive design where applicable
- current platform, regional, loot-box, subscription, refund, and advertising policy review before release

Do not manufacture confusion, hide total cost, punish players for declining, or tune frustration solely to force payment. Commercial success is a constraint to design with, not permission to damage trust.

### Shops

Check offer hierarchy, value explanation, currency conversion clarity, owned/maxed state, unavailable state, purchase pending/success/failure, restoration, duplicate protection, and post-purchase feedback.

### Rewarded Ads

Keep ads explicitly optional when presented as rewarded. State the reward before opt-in, grant exactly once after verified completion, handle no-fill/offline/cancel/retry, and avoid interrupting high-focus gameplay or stacking misleading close buttons.

### Subscriptions

Explain benefits, renewal period, current entitlement state, restore/manage path, expiry/grace/hold behavior, and what persists after cancellation. Test purchase, renewal, restore, account change, revocation, and offline cache behavior against current store rules.

## Telemetry With A Question

Do not track everything. Every event must answer a named product, design, economy, or reliability question.

Minimum useful event fields when appropriate:

- event name and schema version
- UTC timestamp, build/version, platform, locale, and session ID
- anonymous/player subject consistent with consent and privacy design
- gameplay context such as mode, level, encounter, item, offer, or experiment variant
- result, reason code, duration, and before/after balance for economy events
- transaction/grant deduplication identifier without purchase secrets

Use stable names and enums, validate payloads, document units, and preserve backward-compatible schemas. Do not send raw personal data merely because an SDK accepts it.

## Core Questions And Funnels

Instrument only the steps needed to answer questions such as:

- Can players start and complete the first meaningful action?
- Where do they fail, quit, retry, or ask for help?
- Do upgrades change success or decision quality?
- Are sources and sinks balanced by progression band?
- Does a shop view lead to comprehension, not only conversion?
- Does a new build improve its primary goal without harming stability, fairness, or accessibility?

Useful events may include first open, tutorial start/step/complete, level or battle start/end, fail/retry, reward grant, upgrade, inventory full, shop view, purchase lifecycle, ad lifecycle, session resume, and error. Add only those required by current questions.

Never invent retention or revenue conclusions from screenshots, small anecdotes, or events that were not validated end to end.

## Metric Discipline

Define each metric with population, time window, timezone, inclusion/exclusion, and data freshness. Segment by build, platform, device tier, locale, acquisition or progression only when privacy and sample size permit.

Use:

- activation/funnel completion for onboarding
- cohort retention for return behavior
- session frequency/length with genre context
- progression velocity and failure/retry for balance
- source/sink flow and balances for economy health
- conversion, payer rate, ARPDAU/ARPPU only with clear definitions
- crash, ANR, frame-time, load, and purchase errors as guardrails

An average can hide a broken device, locale, progression band, or payer/non-payer experience. Inspect distributions and affected cohorts.

## Experiment Gate

Before an A/B test, define:

- hypothesis and player problem
- control and one coherent treatment
- primary metric and expected direction
- stability, revenue, fairness, accessibility, and economy guardrails
- eligible population, exclusions, mutual-exclusion group, and assignment unit
- sample-size/decision method, minimum run window, and stop conditions
- telemetry validation and variant exposure event
- rollback owner and expiry date

Do not run overlapping treatments that make attribution impossible. Do not repeatedly peek and stop on a convenient result. Treat statistical significance, practical effect, novelty, and long-term harm separately.

## Remote Configuration

Every remotely controlled value needs:

- safe client default
- schema/type/range validation
- version and audit history
- activation timing that cannot corrupt an active run
- offline and fetch-failure behavior
- staged rollout and monitored guardrails
- kill switch or rollback
- compatibility with older clients

Remote config is not a substitute for server authority, secure purchase logic, or an app update when code or platform SDKs must change.

## Live Event Production

For each event or season, define:

- player fantasy and target cohort
- start/end timezone and grace period
- eligibility, matchmaking, progression, and reward rules
- content/config version compatibility
- schedule, localization, art/audio/UI, QA, support, community, and store dependencies
- reward grant, duplicate, late claim, full inventory, and rollback behavior
- success metric and guardrails
- post-event archive or conversion behavior

Use a reusable event template only after two or more events prove the common structure. Keep a cut list for optional content.

## Incident Response

When a live change causes harm:

1. Stop exposure with rollback, kill switch, or rollout pause.
2. Preserve logs, configuration version, affected cohorts, and timestamps.
3. Protect purchases, saves, rewards, and competitive integrity.
4. Communicate known impact without guessing.
5. Repair idempotently and define compensation from evidence.
6. Verify recovery and monitor recurrence.
7. Record root cause and prevention in the handoff.

## Required Economy/Live Ops Review

Report:

- economy sources, sinks, balances, and authority
- player value and decision impact
- progression pacing and worst-case path
- monetization trust risks
- telemetry question and validated events
- experiment or rollout guardrails
- privacy/policy areas needing current verification
- `PASS`, `WARN`, `FAIL`, or `UNVERIFIED` for economy health, fairness, reliability, reversibility, and measurement
- smallest next simulation, test cohort, or staged rollout
