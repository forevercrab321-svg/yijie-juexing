# Godot 4 Production Guidance

Load this reference for Godot 4 projects. Match the project's installed engine version and existing conventions before using newer APIs.

## Project Reading Order

1. project instructions, `CODEX_HANDOFF.md`, and `DEBUG_HANDOFF.md`
2. `project.godot`, export presets, and enabled plugins
3. owning `.tscn` scenes and attached `.gd` or C# scripts
4. autoloads/services and their initialization order
5. `.tres`/`.res`, JSON/CSV, localization, and save schemas
6. import metadata and generated assets involved in the change
7. existing tests, smoke scripts, export wrappers, and release verifiers

Use `rg` to trace node names, signals, resources, save keys, and call sites before assuming ownership.

## Scene And State Ownership

- Keep reusable scenes self-contained when practical.
- Let a parent/owner inject external context rather than requiring fragile absolute node paths.
- Use parent-child relationships for lifetime ownership, not merely spatial grouping.
- Preserve node names, types, exported properties, signal signatures, UIDs, and scene paths when other files depend on them.
- Use autoloads for isolated truly global lifetime/state, not as a default place for every system.
- Avoid duplicate authority between scene nodes, autoloads, UI caches, and save data.
- Add `_get_configuration_warnings()` only when a reusable scene has an important editor-time setup contract.

Do not refactor a working scene tree to match a generic architecture guide unless the requested change exposes a measured ownership problem.

## GDScript And Resources

- Follow local typing style. Add types to high-risk boundaries, public APIs, save/economy structures, and long-lived code when they improve detection and readability.
- Treat warnings as useful signals; do not mass-enable warnings-as-errors on an established project without assessing existing debt.
- Prefer `Resource` or established data files for tunable content when the project already separates data from runtime behavior.
- Validate resource IDs, ranges, references, duplicates, and required fields before runtime use.
- Avoid loading the same texture/resource repeatedly in hot paths; use existing preload/cache patterns.
- Keep per-frame `_process`/`_physics_process` work intentional and disable processing when inactive.

## Save And Lifecycle

- Version save data and migrate old shipped shapes explicitly.
- Validate missing/corrupt fields and preserve recoverable progress.
- Avoid granting rewards twice across retry, reload, signal duplication, or interrupted writes.
- Test scene change, pause, background, resume, force close, restart, and account/slot switch when relevant.
- Keep visual node state from becoming the sole authoritative save state.

## UI

- Use `Control` anchors/offsets and `Container` sizing consistently; parent containers own child layout.
- Avoid fighting containers with repeated manual position/size writes.
- Prefer shared `Theme` values over many per-node overrides when the project already has theme ownership.
- Check `custom_minimum_size`, size flags, clipping, scrolling, focus, mouse filters, safe areas, stretch/aspect settings, and localization expansion.
- Load `ui-ux-audit.md` for any HUD, menu, shop, inventory, mobile, readability, or release UI work.

## Game Feel And Audio

- Input responds immediately or visibly queues.
- Damage, healing, status, immunity, reward, error, and cooldown states have distinct feedback.
- Tweens and animations do not block authoritative simulation or leave stale callbacks after scene exit.
- Camera shake, particles, flashes, and audio cues remain adjustable and do not obscure critical state.
- Route detailed sound/BGM work through the installed `game-audio` skill when available.

## Performance

- Profile the exported game on representative target hardware; editor measurements are diagnostic only.
- Measure the same scene/path before and after changes.
- Check script time, rendering, draw calls, overdraw, node/process count, allocations, resource load, particles, texture memory, and shader cost as relevant.
- For mobile, verify sustained frame pacing and thermal behavior, not only a short FPS sample.
- Preserve visuals/gameplay first; reduce measured waste before changing design quality.

## Verification Ladder

Use the lowest sufficient layer, then add higher layers required by the claim:

1. parse/type/warning check for changed scripts
2. focused logic or migration test
3. headless project or owning-scene load
4. project smoke test for the player path
5. viewport/input/device check
6. export artifact check
7. installed/store-track behavior

Useful engine commands depend on the installed version. Inspect `godot --help` first. For CI/export, prefer explicit `--path`, `--headless`, preset name, and output path.

## Test Framework Selection

- Use the project's existing framework first.
- GUT supports GDScript tests and CLI/JUnit workflows; match its release to the exact Godot version.
- GdUnit4 supports GDScript/C# and scene/input testing; match its compatibility table to the exact engine version.
- Do not install either for a one-line check. Add a framework when repeated pure logic, scene, migration, or regression tests justify it.

## Export And Release

- Keep `export_presets.cfg` versioned when it contains shareable build configuration.
- Keep `.godot/export_credentials.cfg`, keystores, passwords, and service credentials out of Git.
- Use an editor binary plus installed export templates for automated exports.
- Verify output extension, package/application ID, version, architecture, contents, signature, and launch.
- For Android AAB/APK, distinguish local export success from Play-installed behavior, billing, restoration, and device/thermal verification.

## Godot Definition Of Done

- scene/script/resource wiring is valid
- changed state survives required reload/lifecycle paths
- focused checks and the intended player path pass
- target viewport/device and performance claims have evidence
- export/package claims are verified at artifact level
- untested store/service behavior is named explicitly
