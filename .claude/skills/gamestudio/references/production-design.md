# Production And Game Design Review

Load this reference for a new game, milestone, vertical slice, mechanic, combat system, level, quest, tutorial, progression change, balance pass, or major-studio review.

## Contents

- Decision frame
- Vision and pillars
- Core loop and vertical slice
- Mechanics and combat
- Levels, quests, progression, and onboarding
- Content production and playtesting
- Required review output

## Decision Frame

Start with five questions:

1. What should the player feel, understand, and decide?
2. What mechanic creates that experience?
3. What repeatable dynamic should emerge after several minutes?
4. What is the smallest playable proof?
5. What evidence would cause the team to keep, change, or cut it?

Use Mechanics-Dynamics-Aesthetics as a reasoning tool: design backward from the intended player experience, then verify the actual dynamics through play rather than assuming mechanics produce the intended result.

Do not approve a feature because it sounds deep, supports lore, or matches a competitor. It must strengthen a game pillar, solve a player problem, or create measurable production value.

## Vision And Pillars

Define:

- target player and play context
- one-sentence player fantasy
- core promise and primary emotion
- three to five design pillars
- anti-pillars: experiences the game must avoid
- platform, session-length, input, content, and business constraints

Every substantial feature must name the pillar it serves. If it serves none, cut or reshape it.

Use original genre language. A request for a famous-studio style is a request for craft quality, not permission to copy protected expression.

## Core Loop And Goal Horizons

Map the loop as:

```text
Goal -> Decide -> Act -> Read feedback -> Earn/change state -> Choose next goal
```

Review three horizons:

- immediate: the next useful decision in seconds
- session: a meaningful objective completed this play session
- long-term: visible mastery, collection, story, social, or progression aspiration

Fail the loop when rewards arrive without decisions, decisions lack readable consequences, waiting replaces play without intention, or progress exists only as hidden numbers.

## Vertical Slice Gate

A vertical slice is representative quality, not a tiny prototype and not a large content dump. Require one end-to-end path containing:

- representative input and core mechanic
- one meaningful decision and one failure/recovery case
- representative enemy, challenge, or puzzle
- final-quality direction for UI, feedback, audio, and art
- save/reload or session-resume behavior when the shipping game needs it
- target-device performance evidence
- one repeatable content-authoring path
- a cut list and known risks

Do not scale content until the slice proves the loop and the team can produce another unit predictably.

## Mechanics Review

For each mechanic, document:

- player verb and target
- preconditions, cost, timing, cooldown, and cancellation
- success, partial success, failure, and recovery
- readable feedback before, during, and after the action
- interactions with other mechanics
- dominant strategy and exploit risks
- skill expression, accessibility options, and input alternatives
- tunable data owner and verification method

Prefer a small set of mechanics with combinatorial depth over many isolated buttons.

## Combat Review

Check this sequence:

```text
Intent -> Telegraph -> Decision window -> Action -> Contact -> Consequence -> Recovery -> Next decision
```

Require:

- threats and targets readable before punishment
- response time appropriate to platform, camera, input, and audience
- hit, miss, block, heal, status, immunity, and death feedback distinguishable
- recovery and interruption rules consistent
- player choices with tradeoffs, not one mathematically dominant answer
- enemies that ask different questions rather than only adding health/damage
- difficulty that changes decisions or execution, not only stat inflation
- combat log/debug evidence separated from player-facing clarity

For bosses, test learnability, phase readability, checkpoint cost, failure explanation, build viability, accessibility, and repeated-run fatigue.

## Level And Quest Review

Use a teach-test-twist-mastery rhythm when appropriate:

1. Teach one idea safely.
2. Test it with clear stakes.
3. Combine or twist it.
4. Let the player demonstrate mastery.

Check:

- landmarks, routes, goals, hazards, and interactables are readable
- critical path and optional rewards are distinguishable
- backtracking and dead time have purpose
- checkpoints respect expected failure frequency
- soft locks, missed triggers, disconnects, reloads, and sequence breaks recover safely
- objectives update from authoritative state and cannot silently desynchronize
- quest text, world state, reward grant, and save state agree

## Progression And Rewards

Review:

- visible growth in capability, choice, expression, or access
- short, medium, and long reward horizons
- meaningful choices with understandable comparison
- pacing after failure, absence, return, or late entry
- upgrade reversibility or protection from irreversible traps
- duplicate, overflow, full-inventory, and maximum-level behavior
- reward source, destination, grant idempotency, and save compatibility

Avoid progression that only increases numbers while encounters and decisions remain unchanged.

## Onboarding

Teach by asking the player to act, then verify the action before advancing. Introduce one new concept at a time, delay nonessential menus, and keep help replayable.

Review the first 30 seconds, first session, first loss, first upgrade, first return session, and first purchase-facing moment. Never use forced friction to teach where clear feedback would work.

## Difficulty And Accessibility

Treat difficulty as the relationship between player ability and game barriers. Consider independent assists for timing, input complexity, information, navigation, damage, resource pressure, motion, and sensory cues instead of a single opaque easy/hard multiplier.

Never remove the core fantasy when adding assists. Communicate what an option changes and allow players to revise it.

## Content Production

Before approving content scale, estimate:

- authored units and variants
- dependencies across design, writing, art, audio, engineering, localization, and QA
- time to create, review, integrate, and repair one unit
- reusable rules versus handcrafted exceptions
- validation and preview tools already available
- memory, package, streaming, and localization cost
- cut order if capacity falls

Prefer data validation and reusable encounter grammar over undocumented manual steps. Do not build a custom editor until repeated authoring pain is measured.

## Playtest Loop

Use observation before explanation:

1. Define the question and target player.
2. Capture build/version, device, settings, and test path.
3. Observe behavior, confusion, recovery, and completion without coaching.
4. Separate defects, usability failures, balance problems, and preference.
5. Prioritize repeated player harm over isolated suggestions.
6. Change one coherent variable set and retest.

Do not treat developer play, screenshots, or anecdotal praise as retention evidence.

## Required Review Output

Report:

- player fantasy and intended emotion
- loop and decision quality
- top three strengths supported by evidence
- top three player risks
- production/content cost risk
- accessibility and onboarding risk
- `KEEP`, `CHANGE`, `CUT`, or `TEST` decisions
- smallest next playable proof
- acceptance criteria and test plan

Rate each gate `PASS`, `WARN`, `FAIL`, or `UNVERIFIED`. Do not hide an unverified area behind an average score.
