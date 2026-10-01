# Game Studio Roles And Decision Rights

Use only the roles needed for the task. A role is a review lens with an owned decision and required evidence, not a fictional meeting or extra output section.

## Direction And Production

### Creative Director

- Owns player fantasy, emotional target, originality, tone, and coherent creative direction.
- Resolves conflicts between art, narrative, systems, and audience promise.
- Rejects imitation of protected IP or famous-studio surface style.

### Game Director

- Owns design pillars, core loop, feature coherence, and final player-experience tradeoffs.
- Uses play evidence to keep, change, test, or cut mechanics.
- Protects clarity and depth from feature accumulation.

### Producer

- Owns phase, scope, non-goals, dependencies, risk, acceptance evidence, cut order, and milestone readiness.
- Breaks goals into playable slices and prevents hidden cross-discipline work.
- Does not call a milestone complete without the required gate evidence.

## Design

### Systems And Combat Designer

- Owns rules, player verbs, combat rhythm, tuning model, counterplay, difficulty, progression interaction, and exploit analysis.
- Maps intended experience to mechanics and verifies actual dynamics through playtests.
- Produces data-shaped rules and edge cases engineers and QA can test.

### Level, Quest, And Content Designer

- Owns encounter/space pacing, objectives, navigation, teach-test-twist flow, checkpoints, content grammar, and recovery from sequence breaks.
- Estimates authoring and validation cost before scaling content.
- Keeps quest, world, reward, and save states consistent.

### Economy And Live Ops Designer

- Owns currency/item sources and sinks, rewards, shop value clarity, progression pacing, events, seasons, and remote tuning intent.
- Protects fairness, player trust, non-paying viability, and reversible rollout.
- Uses simulations and cohort evidence rather than intuition alone.

### Narrative Designer

- Owns interactive narrative intent, dialogue/quest state, character voice, lore consistency, localization context, and skip/replay behavior.
- Makes narrative support player action instead of blocking it.

## Engineering

### Gameplay Engineer

- Owns gameplay state, deterministic rules where useful, scene/runtime integration, save-facing behavior, and focused tests.
- Fits existing project patterns and avoids speculative frameworks.
- Keeps presentation and authoritative state from silently diverging.

### Platform And Online Engineer

- Owns lifecycle, accounts, cloud/backend authority, networking, purchases, ads, achievements, permissions, privacy boundaries, retries, and offline behavior.
- Treats external callbacks as duplicated, delayed, cancelled, or reordered until proven otherwise.
- Keeps secrets and authoritative grants off untrusted clients.

### Build And Release Engineer

- Owns reproducible builds, CI, versions, packages, signing, artifacts, environments, rollout, monitoring, and rollback.
- Distinguishes source checks, runtime checks, package checks, and store/device checks.
- Publishes only named artifacts from named commits.

## Player Experience

### Game Feel Engineer

- Owns responsiveness, timing, anticipation, contact, recovery, camera, haptics, VFX/audio feedback, and input feel.
- Tunes feedback to clarify state and consequence without obscuring play.
- Measures effect cost on target hardware.

### Senior Game UI/UX Designer

- Owns information architecture, HUD, menus, interaction flows, mobile ergonomics, onboarding, accessibility, and responsive/localized layouts.
- Requires complete empty, loading, disabled, selected, pending, error, success, and recovery states.
- Loads `ui-ux-audit.md` and treats readability as the first gate.

### Art Director And Technical Artist

- Own visual language, silhouette, palette, animation direction, asset consistency, import settings, materials, shaders, VFX, lighting, and visual performance.
- Separate original art direction from requests to imitate protected style.
- Define asset/runtime contracts and debug views before high-volume production.

### Audio Director And Technical Audio

- Own audio identity, mix hierarchy, cues, music states, ambience, loops, implementation, loudness consistency, accessibility alternatives, and runtime budget.
- Ensure critical information is not audio-only.
- Route detailed audio work through the installed game-audio skill when available.

### Accessibility And Localization

- Own player barriers across vision, hearing, mobility, cognition, input, language, reading order, text expansion, subtitles, motion, and difficulty options.
- Review early enough to shape mechanics and data, not only final UI polish.
- Require supported-locale and assistive-option evidence at release.

## Evidence And Product

### QA

- Owns repro, risk-based coverage, state/lifecycle cases, regression boundaries, device matrix, artifact verification, and release recommendation.
- Turns acceptance criteria into runnable checks or explicit manual evidence.
- Reports unverified areas instead of converting them to assumptions.

### User Research

- Owns research question, participant fit, unbiased observation, study limitations, and synthesis of player behavior.
- Separates usability, comprehension, balance, defect, and preference findings.

### Analytics

- Owns metric definitions, event schema, data quality, funnels, cohorts, experiments, guardrails, and uncertainty.
- Refuses conclusions from missing, invalid, or insufficient data.

### Security And Privacy

- Owns trust boundaries, abuse cases, secret handling, least privilege, data minimization, consent/declarations, retention, and incident implications.
- Reviews purchases, accounts, online authority, telemetry, ads, mods, and user-generated content when relevant.

### Market And Product

- Owns audience/genre expectations, platform fit, commercial promise, positioning, competitor evidence, and product risk.
- Does not override player experience with trend imitation.

## Handoff Rule

For non-trivial implementation, make four ownership handoffs explicit:

- Producer: scope, non-goals, phase gate, and evidence
- Designer/Director: player intent and rules
- Engineer/Craft owner: implementation path and contracts
- QA: verification and remaining risk

Add other roles only when their owned surface is touched. One person or Codex may hold several roles; the decisions must still be distinct.
