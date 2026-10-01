# Sources, Licenses, And Publishing Boundary

This skill is an original Codex-native coordination layer. It synthesizes user requirements and public guidance; it does not vendor external runtimes, scripts, assets, or full documentation.

## Non-Affiliation And Originality

- `gamestudio` is not affiliated with, endorsed by, or produced by Blizzard Entertainment, Activision Blizzard, Microsoft, Unity, Godot Foundation, Phaser Studio, Google, Apple, or the maintainers of referenced repositories.
- A request for a Blizzard-like or major-studio team means veteran cross-functional review quality. It does not authorize copying characters, lore, names, UI, maps, music, visual style, trade dress, proprietary tools, or internal processes.
- Produce original game direction appropriate to the user's project and audience.

## Primary Skill Inspirations

- `https://github.com/pamirtuna/gamestudio-subagents` — MIT — compact game-studio role concept
- `https://github.com/DietrichGebert/ponytail` — MIT — minimal working-change and YAGNI discipline
- `https://github.com/0x0funky/agent-sprite-forge` — MIT — asset workflow and sprite/map routing concepts

Keep these attributions in `NOTICE.md`. Do not claim that this skill runs their Claude/plugin runtimes or contains their complete instructions.

## Authoritative Public References

Use these as current reference points and verify them again when versions or policies may have changed.

### Game Design And Accessibility

- MDA framework paper: `https://www.cs.northwestern.edu/~hunicke/MDA.pdf`
- Xbox Accessibility Guidelines: `https://learn.microsoft.com/en-us/xbox/accessibility/guidelines`
- Apple designing for games: `https://developer.apple.com/design/human-interface-guidelines/designing-for-games/`
- Apple game controls: `https://developer.apple.com/design/human-interface-guidelines/game-controls`
- Apple accessibility: `https://developer.apple.com/design/human-interface-guidelines/accessibility`

The skill paraphrases general methods such as reasoning from intended experience to mechanics/dynamics and testing player barriers. It does not reproduce complete papers or guideline text.

### Godot

- Best practices: `https://docs.godotengine.org/en/stable/tutorials/best_practices/`
- Scene organization: `https://docs.godotengine.org/en/stable/tutorials/best_practices/scene_organization.html`
- Static typing: `https://docs.godotengine.org/en/stable/tutorials/scripting/gdscript/static_typing.html`
- Warning system: `https://docs.godotengine.org/en/stable/tutorials/scripting/gdscript/warning_system.html`
- Exporting projects: `https://docs.godotengine.org/en/stable/tutorials/export/exporting_projects.html`
- Command line: `https://docs.godotengine.org/en/stable/tutorials/editor/command_line_tutorial.html`

### Unity

- Profiling applications: `https://docs.unity3d.com/Manual/profiler-profiling-applications.html`
- Unity Test Framework: `https://docs.unity3d.com/Manual/com.unity.test-framework.html`
- Addressables content updates: `https://docs.unity3d.com/Packages/com.unity.addressables@latest/manual/ContentUpdateWorkflow.html`

### Phaser And Web

- Scenes: `https://docs.phaser.io/phaser/concepts/scenes`
- Input: `https://docs.phaser.io/phaser/concepts/input`
- Scale Manager: `https://docs.phaser.io/phaser/concepts/scale-manager`

### Android, Stores, And Live Services

- Android game quality: `https://developer.android.com/games/guidelines`
- Android game performance: `https://developer.android.com/games/optimize`
- Android Dynamic Performance Framework: `https://developer.android.com/games/optimize/adpf`
- Android vitals crashes: `https://developer.android.com/topic/performance/vitals/crash`
- Google Play Billing integration: `https://developer.android.com/google/play/billing/integrate`
- Google Play Billing security: `https://developer.android.com/google/play/billing/security`
- Google Play Data safety: `https://support.google.com/googleplay/android-developer/answer/10787469`
- Firebase Remote Config rollouts: `https://firebase.google.com/docs/remote-config/rollouts`
- PlayFab experiments: `https://learn.microsoft.com/en-us/gaming/playfab/live-service-management/game-configuration/experiments/`
- PlayFab analytics: `https://learn.microsoft.com/en-us/gaming/playfab/data-analytics/`

Store, privacy, billing, accessibility, SDK, and release requirements are time-sensitive. Link to current official guidance rather than freezing policy thresholds in the skill.

## Optional Open-Source Reference Projects

These are examples or optional tools, not dependencies of this skill:

- `https://github.com/godotengine/godot` — MIT
- `https://github.com/godotengine/godot-demo-projects` — MIT; check individual third-party assets where noted
- `https://github.com/bitwes/Gut` — MIT; Godot GDScript testing
- `https://github.com/godot-gdunit-labs/gdUnit4` — MIT; Godot GDScript/C# and scene testing
- `https://github.com/game-ci/unity-actions` — MIT; Unity CI testing/building, not affiliated with Unity
- `https://github.com/phaserjs/phaser` — MIT
- `https://github.com/phaserjs/examples` — source code MIT, but repository assets are not generally cleared for commercial reuse

Do not install these automatically. Inspect exact engine compatibility, maintenance state, license, transitive dependencies, setup cost, and project need first. Prefer existing project tools and native engine checks.

## Publishing Rules

- Keep the skill name `gamestudio`.
- Keep `LICENSE`, `NOTICE.md`, and this source boundary when redistributing.
- Attribute conceptual inspirations; do not imply upstream endorsement.
- Do not copy external docs, prompts, source, or assets wholesale.
- When code or assets are intentionally reused, preserve the exact upstream license and attribution separately.
- Record newly researched sources here only when they materially change the workflow.
- Keep generated game assets and user showcase media separate from third-party examples and licenses.
