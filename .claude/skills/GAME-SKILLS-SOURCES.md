# 游戏开发 Skill 来源清单

本目录下的游戏开发类 skill 均为第三方内容，**原样引入、未做修改**（含上游的 CRLF 行尾）。
每个来源钉到具体提交，便于复现与审计。引入日期：2026-10-01。

更新某个 skill 时：到对应仓库拉取新提交、整目录替换、更新本表的提交号与许可证。

## 清单

| Skill | 来源仓库 | 上游路径 | 提交 | 许可证 | 许可证文件 |
|---|---|---|---|---|---|
| `threejs-3d-generator` | [majidmanzarpour/threejs-game-skills](https://github.com/majidmanzarpour/threejs-game-skills) | `skills/threejs-3d-generator` | `8286774b22a2` | MIT | `../THREEJS-GAME-SKILLS-LICENSE` |
| `threejs-aaa-graphics-builder` | 同上 | `skills/threejs-aaa-graphics-builder` | `8286774b22a2` | MIT | `../THREEJS-GAME-SKILLS-LICENSE` |
| `threejs-audio-generator` | 同上 | `skills/threejs-audio-generator` | `8286774b22a2` | MIT | `../THREEJS-GAME-SKILLS-LICENSE` |
| `threejs-debug-profiler` | 同上 | `skills/threejs-debug-profiler` | `8286774b22a2` | MIT | `../THREEJS-GAME-SKILLS-LICENSE` |
| `threejs-game-director` | 同上 | `skills/threejs-game-director` | `8286774b22a2` | MIT | `../THREEJS-GAME-SKILLS-LICENSE` |
| `threejs-game-ui-designer` | 同上 | `skills/threejs-game-ui-designer` | `8286774b22a2` | MIT | `../THREEJS-GAME-SKILLS-LICENSE` |
| `threejs-gameplay-systems` | 同上 | `skills/threejs-gameplay-systems` | `8286774b22a2` | MIT | `../THREEJS-GAME-SKILLS-LICENSE` |
| `threejs-image-generator` | 同上 | `skills/threejs-image-generator` | `8286774b22a2` | MIT | `../THREEJS-GAME-SKILLS-LICENSE` |
| `threejs-qa-release` | 同上 | `skills/threejs-qa-release` | `8286774b22a2` | MIT | `../THREEJS-GAME-SKILLS-LICENSE` |
| `game-feel` | [gamedev-skills/awesome-gamedev-agent-skills](https://github.com/gamedev-skills/awesome-gamedev-agent-skills) | `skills/disciplines/game-feel` | `d4b0e35550c5` | Apache-2.0 | `game-feel/LICENSE` |
| `game-ui-ux` | 同上 | `skills/disciplines/game-ui-ux` | `d4b0e35550c5` | Apache-2.0 | `game-ui-ux/LICENSE` |
| `gamestudio` | [guangyuspace/codex-gamestudio-skill](https://github.com/guangyuspace/codex-gamestudio-skill) | 仓库根目录（**不含** `assets/`，那是 56MB 宣传图，skill 本身不引用） | `42838f2a4df9` | MIT | `gamestudio/LICENSE`（另有 `NOTICE.md`） |
| `game-engine` | [github/awesome-copilot](https://github.com/github/awesome-copilot) | `skills/game-engine` | `d6131471b85f` | MIT | `game-engine/LICENSE` |
| `game-developer` | [Jeffallan/claude-skills](https://github.com/Jeffallan/claude-skills) | `skills/game-developer` | `882ef55e377d` | MIT | `game-developer/LICENSE` |
| `game-ui-design` | [omer-metin/skills-for-antigravity](https://github.com/omer-metin/skills-for-antigravity) | `skills/game-ui-design` | `e8dcf4e87379` | Apache-2.0 | `game-ui-design/LICENSE` |
| `game-design-theory` | [pluginagentmarketplace/custom-plugin-game-developer](https://github.com/pluginagentmarketplace/custom-plugin-game-developer) | `skills/game-design-theory` | `aa7edfe267b3` | **自定义许可证** ⚠️ | `game-design-theory/LICENSE` |
| `develop-web-game` | [openai/skills](https://github.com/openai/skills) | `skills/.curated/develop-web-game`（上游已删除） | `30444aed500c`（删除提交 `11c643813b46` 的父提交） | Apache-2.0 | `develop-web-game/LICENSE.txt` |
| `multiplayer-game` | [rivet-dev/skills](https://github.com/rivet-dev/skills) | `multiplayer-game`（上游已删除） | `ba5d3db3d748`（删除提交 `a3ed65300694` 的父提交） | **无许可证** ⚠️ | — |

## 需要留意的许可证

### `game-design-theory` —— 自定义许可证

版权归 Dr. Umit Kacar & Muhsin Elcicek 所有（All Rights Reserved），以有限、可撤销的许可授权使用。

- 第 3c 条：**允许分发，前提是附带该许可证**。
- 第 4a 条：**禁止删除或改动版权声明与许可证**。
- 第 13 条：违反条款时许可自动终止，须销毁全部副本。

因此 `game-design-theory/LICENSE` **必须保留、不得修改**。删除这个 skill 时连同 LICENSE 一起删即可。

### `multiplayer-game` —— 上游没有许可证

rivet-dev/skills 仓库在整个提交历史中从未包含任何许可证文件，README 中也未声明。
按著作权法的默认规则，**没有许可证即保留所有权利**，严格来说不授予再分发的权利。

内容由 [rivet-dev/website](https://github.com/rivet-dev/website) 的文档自动生成；
Rivet 主仓库 [rivet-dev/rivet](https://github.com/rivet-dev/rivet) 采用 Apache-2.0，但那份许可证并不自动覆盖这个 skill 仓库。

**如果本仓库是公开的**，建议二选一：向 Rivet 确认许可，或把这个 skill 从仓库移除、改为只在本地使用。

## 需要 API key 的脚本

以下 threejs skill 的脚本会调用第三方接口，没有对应的 key 时脚本会报缺失，属于正常情况：

| 环境变量 | 服务 | 用到的 skill |
|---|---|---|
| `TRIPO_API_KEY` | Tripo（`api.tripo3d.ai`，3D 模型生成） | `threejs-3d-generator` |
| `ELEVENLABS_API_KEY` | ElevenLabs（`api.elevenlabs.io`，音频生成） | `threejs-audio-generator` |
| `GEMINI_API_KEY` | Gemini（图片生成） | `threejs-image-generator` |

`threejs-game-director/scripts/probe_asset_credentials.sh` 只输出 `KEY=SET` / `KEY=MISSING`，不会打印密钥值；
它会 `source` 当前用户的 `~/.zshrc` / `~/.bashrc` 来读取环境变量。

这些 key 与项目本身无关——艾琳娜的对话和语音只走 MiniMax，见 `docs/elena-agent.md`。

## 刻意未引入

- `higgsfield-game-generation`：需要付费账号，已决定不用。
