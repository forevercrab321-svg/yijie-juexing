# 异界觉醒 · 项目规范

把纽约真实地图套上异世界设定的社区互助游戏：觉醒建档 → 在 3D 风格化纽约里接取委托 → 真实 GPS 到场 → 提交证明结算。
公会长艾琳娜是可对话的 AI NPC（MiniMax 对话 + 语音），只管委托。

技术栈：React 19 · Vite 6 · TypeScript · Three.js 0.180（3D 世界）· Leaflet（2D 回退）· Cloudflare Pages / Vercel。

## 游戏开发 Skill 路由 —— 强制

做下表任何一类工作时，**第一个动作必须是用 Skill 工具调用对应 skill**，读完再动手。
没有调用就开始写代码，视为流程违规。一项工作跨多类时，按表逐个调用。

| 工作类型 | 必须调用的 skill |
|---|---|
| 3D / Three.js 整体统筹、路由 | `threejs-game-director` |
| 3D 场景、玩法系统、相机、输入、碰撞 | `threejs-gameplay-systems` |
| 3D 画面品质、材质、光照、后处理、性能预算 | `threejs-aaa-graphics-builder` |
| 3D 调试、性能分析、白屏、资源加载 | `threejs-debug-profiler` |
| 3D 测试与发布、截图、自动化试玩 | `threejs-qa-release` |
| 界面 / HUD / 菜单 | `threejs-game-ui-designer`、`game-ui-design`、`game-ui-ux` |
| 手感、反馈、juice | `game-feel` |
| 玩法、数值、经济、成长 | `game-design-theory`、`gamestudio` |
| 网页游戏测试循环 | `develop-web-game` |
| 联机 | `multiplayer-game` |
| 3D / 图片 / 音频资产生成 | `threejs-3d-generator`、`threejs-image-generator`、`threejs-audio-generator` |
| 通用引擎与架构 | `game-engine`、`game-developer` |

团队角色与各自的 skill 定义在 `.claude/agents/`，生产流程与里程碑闸门见 `docs/studio/PIPELINE.md`。

## 不可破的项目约束

- **AI 只走 MiniMax。** 艾琳娜的对话、语音都经 `server/` 代理，API key 只存在于服务端，前端永不持有。
- **不新增数据采集。** 不接云端语音识别、不采集生物特征、不上传位置轨迹。PRIVACY.md 的承诺不能被打破。
- **艾琳娜的唯一定义来源是 `lib/elena.ts`。** 性格 `ELENA_PERSONALITY`、边界 `ELENA_SCOPE` 不要在别处复制。
- **资产生成 API 未配置。** `TRIPO_API_KEY`、`ELEVENLABS_API_KEY`、`GEMINI_API_KEY` 都没有，3D 资产一律程序化生成，不要依赖这三个服务。
- **美术方向**：大地色系（暖褐、米黄、苔绿、陶土）、低饱和、有色阴影、柔和边缘光，参照《旷野之息》。
  不要霓虹、不要赛博朋克青紫、不要粗黑描边。设计 token 在 `index.html` 的 `:root`（`--gold`、`--parchment`、`--stone-*`）。

## 协作规则

- **文件所有权。** 并行工作时只改分配给自己的文件。需要别人改的，写进 `docs/studio/handoff/<角色>.md`，由集成者统一接入。
- **子智能体不提交、不推送。** git 操作由主会话统一做。
- **交付前自检**：`npm run typecheck` 与 `npm run build` 必须通过。
- **注释风格**：中文，解释「为什么」而不是「做了什么」，密度与现有代码一致。

## QA 工具

- Playwright 装在会话 scratchpad 的 `qa-tools/`（不在仓库内），Chromium 预装于 `/opt/pw-browsers`。
- 无头浏览器跑 WebGL 需要启动参数：`--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist`。
  软件渲染下帧率远低于真机，**性能结论以 draw call、三角形数、纹理内存为准，不以 fps 为准**。
- 3D 世界在 `?debug=1` 下暴露 `window.render_game_to_text()` 与 `window.__world`，供自动化读取状态与驱动操作。
