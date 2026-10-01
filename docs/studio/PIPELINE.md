# 生产流程与里程碑闸门

参照高端 3D 游戏项目的标准阶段划分。每个阶段结束都有一道**闸门**——
不满足放行条件就打回，不带病进入下一阶段。闸门条件必须可验证：能截图、能跑命令、能读数值。

团队角色定义在 `.claude/agents/`，skill 路由在根目录 `CLAUDE.md`。

```
M0 预制作 ──▶ M1 垂直切片生产 ──▶ M2 Alpha 集成 ──▶ M3 Beta 打磨 ──▶ M4 发布候选
 总监·设计      世界·UI·设计 并行      主程            QA→调试→美术→手感→QA      发布·部署
```

## M0 预制作

| 角色 | Skill | 产出 |
|---|---|---|
| studio-director | threejs-game-director、gamestudio | `docs/studio/brief.md`：垂直切片范围、验收标准、文件所有权表 |

**闸门**：每条验收标准都写明验证方法；文件所有权无重叠；skill 调用成功（失败则整条流水线中止）。

## M1 垂直切片生产（并行，按文件所有权隔离）

| 角色 | Skill | 独占文件 |
|---|---|---|
| world-engineer | threejs-game-director、threejs-gameplay-systems、threejs-aaa-graphics-builder | `components/world/scene/**` |
| ui-designer | threejs-game-ui-designer、game-ui-design、game-ui-ux | `components/world/ui/**` |
| game-designer | game-design-theory、gamestudio | `lib/progression.ts`、`constants.ts` 委托段、`types.ts` 成长类型 |

三者都**不碰 `App.tsx`**，接入要求写进 `docs/studio/handoff/<角色>.md`。

**闸门**：各自交付的文件单独通过类型检查；交接文档完整。

## M2 Alpha 集成

| 角色 | Skill | 产出 |
|---|---|---|
| lead-engineer | game-engine、game-developer | 接入全部交接要求的 `App.tsx` |

**闸门**：`npm run typecheck` 与 `npm run build` 通过；功能完整（3D 世界、委托聚焦与接取、结算、2D 回退都能走通）。

## M3 Beta 打磨（顺序执行，避免同时改同一批文件）

| 顺序 | 角色 | Skill | 产出 |
|---|---|---|---|
| 1 | qa-engineer | threejs-qa-release、develop-web-game | 桌面与手机截图、控制台错误、按严重度排序的缺陷清单 |
| 2 | debug-engineer | threejs-debug-profiler | 逐条根因与修复；draw call / 三角形 / 纹理读数 |
| 3 | art-director | threejs-aaa-graphics-builder | 10 项画面评分卡前后对比 |
| 4 | feel-designer | game-feel | 接取 / 聚焦 / 完成 / 升级的反馈层 |
| 5 | qa-engineer | threejs-qa-release、develop-web-game | 回归验证 |

**闸门**：无 P0 / P1 缺陷；控制台无未处理异常；手机视口无溢出与遮挡。
回归仍有 P0 / P1 时追加一轮调试 + 回归，最多一轮，仍不通过则如实记入发布风险。

## M4 发布候选

| 角色 | Skill | 产出 |
|---|---|---|
| release-engineer | threejs-qa-release | `docs/studio/RELEASE.md`：构建、包体、已知问题、风险、测试指引 |

**闸门**：生产构建通过；调试钩子默认关闭；3D 代码分包不阻塞首屏。之后由主会话提交、推送、部署。

## 待命角色

| 角色 | Skill | 何时启用 |
|---|---|---|
| network-engineer | multiplayer-game | 多人同屏、服务端到场校验与奖励发放 |
| asset-artist | threejs-3d-generator、threejs-image-generator、threejs-audio-generator | 配置好 Tripo / Gemini / ElevenLabs 的 API key 之后 |

## 重新运行

整条流水线保存为工作流，见 `.claude/workflows/`。
