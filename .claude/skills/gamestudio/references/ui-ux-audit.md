# Mobile Game UI/UX Quality Gate

Use this reference as a senior mobile game UI/UX designer with extensive F2P RPG, idle game, MMORPG, and roguelike experience. Optimize for comprehension, touch reliability, retention, accessibility, and commercial trust before decoration.

## Mandatory Triggers

Load this reference before any of the following:

- design, modification, or review of UI, HUD, menus, shops, or inventories
- any phone or tablet interface work
- player feedback about small text, clutter, or hard-to-tap controls
- a new feature that adds screen information
- game release or update preparation

Do not approve or implement a new UI surface before completing the readability gate. New features must not increase permanent battle-screen information. If they would, first propose consolidation, contextual reveal, folding, replacement, or a separate detail view.

## Audit Order

### 1. Typography and Readability

Treat this as the highest-priority gate.

Check:

- effective size on a six-inch phone, not only the desktop editor preview
- readable body, labels, values, descriptions, and combat messages
- dense Chinese/English mixing and CJK line breaking
- outline, shadow, or backing plate strength on busy backgrounds
- line spacing, paragraph width, truncation, and overflow
- Chinese, English, Japanese, and Korean at realistic longest-string lengths

Use 16sp-equivalent body text and 18sp-equivalent primary actions as starting points, not universal constants. Avoid persistent combat fine print below 14sp-equivalent. Validate the rendered physical result. Do not fix overflow by shrinking text; reflow, wrap, shorten, scroll, paginate, or change the layout.

Report:

```text
★★★★★
可讀性：2/5

問題：
- HP 字體過小
- 技能說明難閱讀
- 掉落訊息太密集

建議：
- 字體約 +25%，再以實機驗證
- 忙碌背景加約 2px 等效描邊或高對比底板
- 增加行距並限制同時顯示的訊息
```

### 2. HUD Information Load

For every visible item, ask:

- Is it needed during combat?
- Is it duplicated elsewhere?
- Does it require permanent visibility?
- Can it be folded, faded, made contextual, or moved to a detail view?

Prefer a combat HUD centered on player HP, boss or target HP, immediate skills/actions, and at most one key resource or reward. Fold secondary currencies, pet details, buffs, FPS, time, wave details, and progression breakdowns unless the genre makes one of them immediately actionable.

Reject a new feature if it adds permanent HUD information without a replacement or hiding plan.

### 3. Visual Hierarchy

Name what the player sees first, second, third, and fourth. Rate each focus with stars.

Example:

```text
★★★★★ Boss / current threat
★★★★☆ Player state
★★☆☆☆ Skills
★☆☆☆☆ Mission progress
```

Fail the hierarchy if the first impression is a row of numbers, currencies, debug values, or equally loud panels. A battle screen should have no more than three primary visual focuses.

### 4. Touch Controls

Check:

- targets smaller than roughly 48dp on Android or 44pt on iOS
- spacing between adjacent destructive or high-frequency controls
- accidental-tap risk and one-handed thumb reach
- safe-area, gesture-bar, camera cutout, and device-edge conflicts
- pressed, disabled, selected, cooldown, loading, and error states

Do not judge touch safety from a mouse-only desktop pass.

### 5. Color and Contrast

Check:

- text and icon contrast against their actual gameplay background
- color-only communication without shape, icon, label, or pattern backup
- more than six simultaneous emphasis colors
- rarity, danger, success, selection, and disabled colors that conflict

Use 4.5:1 contrast for normal text and 3:1 for large text as practical accessibility targets. When stylized art prevents this, use an outline, shadow, scrim, or backing plate and verify on-device.

### 6. First-Time Experience

Simulate the first 0-30 seconds without relying on developer knowledge. Report whether a new player knows:

- how to perform the primary action or attack
- the immediate goal
- how or when progression/upgrades happen
- where idle/auto-play controls are, when relevant
- where the shop or inventory is, when relevant
- what feedback confirms success or failure

Mark each item with `✔`, `△`, or `✘` and name the smallest correction.

### 7. Retention Risk

Answer:

```text
30 秒後是否想繼續？
⭐⭐☆☆☆ 2/5

原因：
- ...
```

Assess clarity of goal, immediacy of feedback, visible progress, reward anticipation, interruption cost, and cognitive load. Treat this as a heuristic product review, not measured retention data.

### 8. Google Play Review Risk

Estimate the chance that UI/UX issues trigger complaints such as:

- 「字太小」
- 「畫面太亂」
- 「找不到按鈕」
- 「UI 很廉價」
- 「按鈕很難按」

Output a 0-100% estimated risk with evidence. Label it as an estimate, not an actual store-rating prediction.

### 9. Godot UI Inspection

When the project uses Godot, inspect the relevant scenes, scripts, and themes:

- `Control` anchors, offsets, layout direction, focus neighbors, and mouse filters
- `MarginContainer` padding and safe-area responsibility
- `VBoxContainer` and `HBoxContainer` separation, wrapping, alignment, and size flags
- parent `Container` ownership versus conflicting manual position/size writes
- `custom_minimum_size`, content-driven sizing, clipping, and scroll ownership
- shared `Theme`, font sizes, font fallback, constants, colors, and excessive per-node overrides
- stretch mode, viewport size, aspect behavior, localization expansion, and notches

Prefer shared theme values and container-driven layout when the project already uses them. Do not perform a broad scene-tree refactor just to satisfy style preferences. Preserve gameplay behavior, signals, save compatibility, billing, and progression contracts.

### 10. Verification Matrix

Verify at minimum:

- 720x1280
- 1080x2400
- one low-resolution or small-screen profile
- safe areas, camera cutouts, and gesture/navigation bars
- Chinese, English, Japanese, and Korean overflow where those locales are supported
- a six-inch physical device or equivalent physical-size preview

Capture screenshots or comparable visual evidence when tools allow. State any matrix row that was not tested.

## Required Audit Report

Always report issues before praise. Use concrete screen/node evidence when available. Keep priority tied to player harm:

- `P0`: blocks reading, primary action, progression, purchase comprehension, or safe interaction
- `P1`: major clutter, hierarchy, spacing, localization, or onboarding failure
- `P2`: touch comfort, consistency, and accessibility improvements
- `P3`: color and secondary visual polish
- `P4`: optional animation and delight after all higher priorities pass

End every UI/UX audit with this structure:

```text
==========

UI Score

Readable
8/10

UX
7/10

Accessibility
6/10

Commercial
9/10

Retention
8/10

Google Play Risk
4/10

==========

Priority

P0
修正字體

P1
整理 HUD

P2
放大按鈕

P3
改善顏色

P4
新增動畫
```

Use `Google Play Risk` as severity, where `10/10` is highest risk. Do not assign high scores without tested evidence. If the audit is based only on screenshots, say which runtime interactions remain unverified.
