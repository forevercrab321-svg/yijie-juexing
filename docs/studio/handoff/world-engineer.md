# 交接 · world-engineer → lead-engineer（M1 → M2）

| 项 | 内容 |
|---|---|
| 角色 | world-engineer（3D 世界工程师） |
| 调用的 skill | `threejs-game-director`、`threejs-gameplay-systems`、`threejs-aaa-graphics-builder`（并读了 references：visual-scorecard / technical-art / authoring-recipes / shader-cookbook / game-feel） |
| 交付 | 契约 A `WorldMap.tsx`、契约 B `worldEvents.ts`、契约 C 调试钩子（含简报 6.1 的全部新增字段），实现文件全部在 `components/world/scene/**` |
| 自查 | 临时自查台（Vite 4174 端口）上 Playwright 功能项 36 / 36 通过；V1–V4 渲染预算桌面 / 手机全部达标；`tsc` 0 错误；3D 分包 625.7 KB / 174.9 KB gzip。临时文件 `world-harness.html` / `world-harness.tsx` **已删除**，4174 端口的服务已按 PID 关闭 |

没有改 `App.tsx` 或其他角色的文件。没有新增 npm 依赖，没有任何外部资产或网络请求——城市、地标、纹理全部在运行时程序化生成。

---

## 0. 一分钟版

1. `const WorldMap = React.lazy(() => import('./components/world/scene/WorldMap'))`，挂载前先做 **WebGL2** 预检；不可用就直接进 2D，`import()` 根本不会触发，3D 分包不会下载。
2. `worldEvents` 从 `./components/world/scene/worldEvents` **静态** import（零依赖，不带 three）。`acceptQuest` 里发 `pulse`，升级时发 `celebrate`，`WorldControls` 的两个按钮发 `recenter` / `resetView`。
3. `onFallback(reason)` → App 切到 2D，并把 reason 存进 state 给 `WorldControls.fallbackReason`。
4. `quests` 请传**稳定引用**（常量或 `useMemo`）：引擎按引用判断委托是否变化，每次渲染都新建数组会让光柱每帧重建。
5. 调试钩子由 `WorldMap` 自己在 `?debug=1` 时挂载、卸载时移除，App 不用管。

---

## 1. 文件

| 文件 | 作用 |
|---|---|
| `WorldMap.tsx` | 契约 A，default export。React 外壳：创建 / 销毁引擎，把 props 同步给引擎 |
| `worldEvents.ts` | 契约 B，零依赖。另外转出 `isInWorld`、`WORLD_BOUNDS`（同样零依赖） |
| `debug.ts` | 契约 C，只在 `?debug=1` 时挂 `window.render_game_to_text` 与 `window.__world` |
| `engine.ts` | `WorldEngine`：渲染器、场景、渲染循环、镜头叙事、拾取、世界事件、尺寸 / 可见性 / 上下文丢失处理、dispose |
| `geo.ts` | 零依赖的投影与范围判定：`project` / `unproject`、`WORLD_BOUNDS`、`isInWorld`、29° 街网换算 `toGrid` / `fromGrid` |
| `land.ts` | 海岸线解码与陆地索引：`isLand`、`surfaceAt`（陆地 / 桥面 / 水面），光柱据此落地，`onLand` 由它判定 |
| `city.ts` | 程序化城市：地面与街道、两条河、曼哈顿街区（InstancedMesh 楼体）、布鲁克林 / 皇后区 / 新泽西沿岸、公园与实例化树木、屋顶水塔与灯笼 |
| `landmarks.ts` | 帝国大厦、克莱斯勒、世贸一号、时代广场（广告牌 + 一号时代广场水晶球）、布鲁克林 / 曼哈顿 / 威廉斯堡三座桥、自由女神 |
| `materials.ts` | 共享材质库：楼体程序化窗户（昼夜两套）、水面、风摆树冠、地面斑驳、灯笼光晕 |
| `textures.ts` | 运行时画的两张图集：广告牌（异世界海报）与符文 / 委托类型图标 |
| `beacons.ts` | 委托光柱：光柱 + 底部光环 + 图钉 + 漂浮符文，4 个 InstancedMesh；屏幕空间拾取 |
| `player.ts` | 玩家角色（按种族着色的斗篷）+ 真实半径的精度圈；进行中委托的发光路径 |
| `vfx.ts` | 接取冲击波、升级庆祝、环境浮光 |
| `cameraRig.ts` | Pokémon GO 式轨道相机：俯仰 35°–70°、缩放、飞行、开场、跟随、框选 |
| `input.ts` | Pointer Events 统一处理鼠标 / 触控：旋转、平移、捏合、扭转、滚轮、点击判定 |
| `atmosphere.ts` | 昼夜：太阳 / 月亮、天空、雾、曝光；天空穹顶 |
| `quality.ts` | 画质档位（高 / 低）与 `?tier=` 覆盖 |
| `geometry.ts` | 合并几何、团状树冠、带洞轮廓拉伸（代替 three/examples 的工具，省分包体积） |
| `data/shoreline.ts` | 曼哈顿 + 周边海岸线（NYC Open Data 区界与人口普查 ZCTA 预处理后编码进来，运行时不联网） |
| `data/places.ts` | 大道 / 百老汇 / 公园 / 地标 / 桥梁的坐标数据 |

依赖边界：只有 `worldEvents.ts`、`geo.ts`、`data/*` 不 import three；App 只允许静态 import `worldEvents.ts`。

---

## 2. App 接入

### 2.1 React.lazy 与 WebGL 预检

```tsx
import React, { Suspense, lazy, useMemo, useState } from 'react';
import { worldEvents, isInWorld } from './components/world/scene/worldEvents';

const WorldMap = lazy(() => import('./components/world/scene/WorldMap'));

// three r180 只支持 WebGL2，预检必须查 webgl2，而且用完立刻归还上下文
function canUseWebGL2(): boolean {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return false;
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch {
    return false;
  }
}
```

```tsx
const [canUse3d] = useState(canUseWebGL2);
const [mapMode, setMapMode] = useState<'3d' | '2d'>(() => (canUse3d ? '3d' : '2d'));
const [fallbackReason, setFallbackReason] = useState<string | null>(canUse3d ? null : 'webgl2-unavailable');
const [userInWorld, setUserInWorld] = useState(false);

{mapMode === '3d' ? (
  <Suspense fallback={<div data-testid="world-loading" className="absolute inset-0 z-0 bg-[#1c1815]" />}>
    <WorldMap
      quests={quests}                          // 稳定引用！
      activeQuestId={activeQuest?.id ?? null}
      focusedQuestId={focusedQuest?.id ?? null}
      onFocus={(q) => setFocusedQuest(q)}      // 只聚焦、开卡片；接取走卡片 → handleAccept
      userLocation={userLocation}
      userRace={user.race}
      onFallback={(reason) => { setFallbackReason(reason); setMapMode('2d'); }}
      // 以下为可选扩展
      completedQuestIds={user.completedQuestIds}
      userLevel={user.level}
      onWorldStatus={({ userInWorld }) => setUserInWorld(userInWorld)}
    />
  </Suspense>
) : (
  <MapBoard /* 原有 props */ />
)}
```

- `WorldMap` 根节点 `position:absolute; inset:0; z-index:0`，铺满父容器（放在原 `MapBoard` 的位置即可），自带 `data-testid="world-map"`、`role="application"`、`touch-action:none`。
- 同意页 / 觉醒页不要渲染 `WorldMap`，它们就不会请求 3D 分包；`index.html` 里也不会出现它的 script 或 modulepreload（React.lazy 的动态 import）。
- `userLocation` 每次是新数组也没关系（按经纬度数值比较）；`completedQuestIds` 按内容比较。**只有 `quests` 按引用比较。**

### 2.2 props 一览

| prop | 契约 | 说明 |
|---|---|---|
| `quests` | A | 每个委托一根光柱；`location` 必须在陆地上（见第 5 节） |
| `activeQuestId` | A | 进行中：光柱换成亮金 + 旋转准星；有定位时镜头框住玩家与目标，并画发光路径 |
| `focusedQuestId` | A | 聚焦：光柱放大变亮，镜头 0.8–1.3 s 缓动飞过去（距离夹在 420–1100 m） |
| `onFocus(quest)` | A | 点击 / 轻触光柱时调用。拖动、捏合不会触发 |
| `userLocation` | A | `null` → 不放角色，镜头以时代广场为中心。超出世界范围同样不放角色 |
| `userRace?` | A | 斗篷按种族着色（12 个种族各一个大地色调，缺省暖褐） |
| `onFallback?(reason)` | A | 见 2.3 |
| `userAccuracy?` | 扩展 | 定位精度（米），画真实半径的精度圈；缺省 30 m |
| `completedQuestIds?` | 扩展 | 已完成：光柱变暗、图钉换成勾 |
| `userLevel?` | 扩展 | 等级不足：光柱变暗、图钉换成锁（只是视觉提示，禁止接取仍由卡片负责） |
| `reducedMotion?` | 扩展 | 强制减少动态效果；缺省跟随系统 `prefers-reduced-motion` |
| `onWorldStatus?({userInWorld})` | 扩展 | 定位变化时回报玩家是否在世界范围内；App 据此给 `WorldControls.hasLocation` 传假并附提示（简报 6.4） |

### 2.3 onFallback 的时机

| 情况 | reason | 何时调用 |
|---|---|---|
| 拿不到 WebGL2 上下文 | `webgl2-unavailable` | 挂载后的下一个微任务（不在渲染或 effect 的同步阶段调父组件 setState） |
| 渲染器创建时抛错 | `webgl-init-failed: <message>` | 同上 |
| 运行中上下文丢失，2 s 内没恢复 | `webgl-context-lost` | 丢失后 2 s；2 s 内恢复则继续渲染，不回退 |

- 每次挂载最多调用一次。没传 `onFallback` 时 `WorldMap` 自己显示一行说明文字。
- App 收到后切到 2D 即可。卸载会释放全部 GPU 资源（几何、材质、纹理、渲染器、监听器，并立即 `forceContextLoss` 归还上下文），所以 2D ↔ 3D 来回切是安全的：自测来回 10 次，始终只有 1 个 WebGL canvas，geometries / textures 与首次挂载相同（M3-05）。
- 正常的手动 2D / 3D 切换不需要 `onFallback`，直接卸载 / 挂载 `WorldMap`。

### 2.4 worldEvents 用法

```ts
import { worldEvents } from './components/world/scene/worldEvents';

// acceptQuest 内部（这样艾琳娜 silent 接取时也有演出，简报 5.3）
worldEvents.emit({ type: 'pulse', questId: quest.id });

// 提交证明结算后
if (settlement.leveledUp) worldEvents.emit({ type: 'celebrate' });

// WorldControls
onRecenter={() => worldEvents.emit({ type: 'recenter' })}
onResetView={() => worldEvents.emit({ type: 'resetView' })}
```

| 事件 | 场景里的演出 |
|---|---|
| `recenter` | 有定位且在世界内：飞到玩家并开始跟随；否则飞回时代广场 |
| `resetView` | 俯仰回 52°、航向回正北、距离回默认（焦点不动） |
| `pulse` | 该光柱闪光 + 地面冲击波（1.1 s）+ 轻微震屏与 FOV 冲击；减少动态效果时不震屏，相机位置完全不动 |
| `celebrate` | 玩家位置升起光柱、符文环与光点爆发（2.4 s）+ 轻微震屏 |

- 2D 模式下没有订阅者，事件直接丢弃，不报错。监听者抛错会被吞掉并 `console.warn`，不会打断 App 的接取流程。
- 世界范围判定：`isInWorld(userLocation)` 与 `WORLD_BOUNDS` 从同一个文件转出，和场景内部用的是同一份判定。

### 2.5 镜头与交互（给 UI 与 QA 的行为说明）

- **开场**：没有聚焦 / 进行中委托时，2.2 s 的开场镜头（从约 4 倍高度、偏转 30° 的俯视缓落到默认视角）；任何按下都会立刻停止插值；减少动态效果时直接落在默认视角。
- **默认视角（V1）**：俯仰 52°、航向正北。有定位时以玩家为中心，距离刚好框住玩家与最近的 3 个委托；没有定位时以时代广场为中心，1300 m。
- **总览（V2）**：拉远到最大距离时，焦点平滑移向全部委托的中心、俯仰抬到 70°，任何航向下都能看到全部光柱。
- **拖动**：单指 / 左键 = 旋转（横向改航向、纵向改俯仰，俯仰夹在 35°–70°）；右键 / 中键 / Shift + 左键 = 平移；双指 = 捏合缩放 + 扭转 + 平移；滚轮 = 缩放（`passive:false`，页面不滚动）。iOS 的 `gesturestart` 已拦截。
- **点击判定**：位移 < 8 px 且按下时长 < 450 ms（按事件时间戳）。从光柱上开始拖动不会聚焦。拾取是屏幕空间的「底座—图钉」线段（图钉本身按其屏幕半径另算），容差鼠标 20 px、触控 30 px，照顾手指。
- **卡片关闭**（`focusedQuestId` 回到 null）：有进行中委托就回到「框住玩家与目标」，否则镜头停在原地。

---

## 3. 调试钩子（契约 C + 简报 6.1）

只在 URL 带 `?debug=1` 时挂载，`WorldMap` 卸载时移除（StrictMode 下只移除属于自己的那一份）。生产构建不带参数时两个全局都是 `undefined`。

### 3.1 `window.render_game_to_text()` 字段

| 字段 | 说明 |
|---|---|
| `mode` | 挂载期间恒为 `'3d'` |
| `camera.position` | `{x,y,z}`，世界坐标（米）：原点时代广场，x 向东、y 向上、z 向南 |
| `camera.target` | `{x,y,z,lat,lon}`：镜头焦点（地面上） |
| `camera.tilt` | **俯角**（度）：视线相对地平面的夹角，35–70，越大越接近正俯视 |
| `camera.heading` | 航向（度）：0 = 正北朝上，顺时针为正 |
| `camera.zoom` | **相机到焦点的距离（米）**，即轨道半径。范围 160 m – `maxZoom` |
| `focusedQuestId` / `activeQuestId` | 场景当前收到的值 |
| `beacons[]` | `{id, screen:{x,y}, onScreen, onLand, urgent}`。`screen` 是光柱**底座**的视口坐标（CSS px，可直接 `page.mouse.click`） |
| `player` | `{screen, onScreen}`；没有定位或不在世界内时为 `null` |
| `renderer.drawCalls` / `triangles` | 最近一次**含阴影 pass 的整帧**读数（预算口径）。`info.autoReset=false`，每帧开始手动 reset，整帧渲染完再读 |
| `renderer.drawCallsLive` / `trianglesLive` | 当前帧的实际读数。阴影贴图有缓存：视角、太阳、玩家都没变时跳过阴影 pass，所以静止时这两个数更小 |
| `renderer.shadowCached` | 当前帧是否复用了阴影贴图 |
| `renderer.geometries` / `textures` / `programs` | `renderer.info.memory` 与程序数 |
| `renderer.fps` | 只作参考（软件渲染远低于真机） |
| `renderer.tier` | `'high' \| 'low'` |
| `renderer.dpr` | 实际像素比 |
| `renderer.postPasses` | 恒为 0（不开后处理，见 4.3） |
| `renderer.shadowMapSize` | 2048（高档）/ 1024（低档） |
| `renderer.textureMB` | 纹理显存估算（两张图集含 mipmap + 阴影贴图）。不含画布默认帧缓冲 |
| `renderer.frames` | 累计渲染帧数 |
| `lastWorldEvent` | `{type, questId?, at}` 或 `null` |
| `hour` | 场景当前小时（`setHour` 固定后为固定值） |
| `userInWorld` | 玩家是否在世界范围内 |
| 额外 | `intro`、`flying`（镜头动画中）、`reducedMotion`、`vfx:{shockwave, celebrate}`、`maxZoom`、`homeZoom` |

读数前会先同步一次画布尺寸与模拟时间，所以刚改完视口尺寸就读也是准的。

### 3.2 `window.__world`

| 方法 | 说明 |
|---|---|
| `tapBeacon(id)` | 与真实点击同一条路径：调用 App 的 `onFocus`。返回是否找到该光柱 |
| `focusQuest(id)` | **只移动镜头**飞到该委托（测量视角 V3 用），不改 App 状态 |
| `setHour(h)` | 固定场景时间（0–24），传 `null` 恢复跟随本地时间。QA：`setHour(13)` / `setHour(22)` |
| `recenter()` | 等同 `worldEvents.emit({type:'recenter'})` |
| `stats()` | 与 `renderer` 相同的对象，外加 `buildMs`（程序化城市构建耗时）与 `city`（楼 / 树 / 水塔 / 灯笼 / 街区数量） |
| `setView(v)` | 额外：直接设定镜头 `{tilt?, heading?, zoom?, target?: {lat,lon} \| {x,z}}`，QA 复现视角用。`zoom` 超出上限会被夹到上限，所以 `setView({zoom: 999999})` 就是总览 |

---

## 4. 性能（实测）与取舍

### 4.1 渲染预算（无头 Chromium + SwiftShader，`m1-budget` 脚本）

| 设置 | 视角 | drawCalls | 三角形 | 几何体 | 纹理 | textureMB | dpr | 阴影 | post |
|---|---|---|---|---|---|---|---|---|---|
| 桌面 1440×900 DSF1 `?tier=high` | V1 / V2 / V3 / V4 | 27 / 30 / 27 / 32 | 405k | 27 | 3 | 36 | 1 | 2048 | 0 |
| 桌面 1440×900 DSF2 `?tier=high` | V1 / V2 / V3 / V4 | 27 / 27 / 27 / 32 | 405k | 27 | 3 | 36 | 2 | 2048 | 0 |
| 桌面 1440×900 自动档（4 核沙箱 → low） | V1 / V2 / V3 / V4 | 26 / 29 / 26 / 31 | 188k | 27 | 3 | 9 | 1 | 1024 | 0 |
| 手机 390×844 DSF3（触屏 UA） | V1 / V2 / V3 / V4 | 26 / 29 / 26 / 31 | 188k | 27 | 3 | 9 | 1.5 | 1024 | 0 |

预算：桌面 ≤160 / ≤500k / ≤150 / ≤32 / ≤128 MB；手机 ≤100 / ≤250k / ≤120 / ≤16 / ≤32 MB。V2 下 13 / 13 光柱在屏内；V4（接最远的入门委托 q3）玩家与目标同屏。

`buildMs`：桌面高档 179–192 ms（预算 250），低档 161 ms，手机 context 131 ms。城市规模：高档 10 792 栋楼、2 622 棵树、898 盏灯笼；低档 5 526 栋、1 118 棵、419 盏。

### 4.2 JS 体积

| chunk | raw | gzip | 预算 |
|---|---|---|---|
| 3D 分包（`WorldMap-*.js`，含 three r180） | 625.7 KB | 174.9 KB | ≤650 KB / ≤190 KB |

three/examples 打进来 0 字节；不含 three 的入口 chunk 里 `THREE.WebGLRenderer` 0 处命中。余量约 24 KB raw——后续往 `scene/` 加代码时要留意，尤其别引入 three/examples 的大模块（BufferGeometryUtils、ExtrudeGeometry 连带的曲线类都已用 `geometry.ts` 代替）。

### 4.3 取舍

- **不开后处理（postPasses = 0）**，按简报砍序第 4 条砍掉 bloom / FXAA。实测加上后：多约 15 个 draw call、约 31 MB 渲染目标、合成必须压到 DPR 1.5、FXAA 把窗格抹糊，而且 3D 分包涨到 676 KB，超出 650 KB 预算。光柱、灯笼光晕、冲击波本身就是叠加混合，不靠 bloom 也会发光。
- **画质档位**：手机 UA / iPadOS / 粗指针 / `hardwareConcurrency ≤ 4` 判为低档。低档 DPR ≤1.5、阴影 1024、帧率上限 30、楼与树约一半、树不投影；高档 DPR ≤2、阴影 2048、不限帧率。URL `?tier=high|low` 可覆盖（只影响画质，不影响玩法）。
- **MSAA 只在实际像素比 < 2 时开**：视网膜屏上锯齿本来只有半个 CSS 像素，而 2880×1800 的 4 倍多重采样要多占约 160 MB 显存。
- **阴影缓存**：只有视角、太阳或玩家变了才重画阴影贴图，静止时每帧约 22 个 draw call。
- **标签页隐藏**停止渲染循环（`visibilitychange`）；恢复时继续。容器尺寸变化（ResizeObserver + window resize / orientationchange）时重算画布与相机。
- **模拟与渲染解耦**：动画按真实时间推进，帧率再低，开场 2.2 s、飞行 0.8–1.3 s、冲击波 1.1 s 的时长也不变。

---

## 5. 世界与坐标

- **投影**：以时代广场 (40.7580, -73.9855) 为原点的局部等距圆柱投影，x 向东、z 向南，**1 单位 = 1 米**。理由：楼高、相机距离、GPS 精度圈都用同一个单位，彼此能直接比较；世界只有十几公里宽，经度按原点纬度的 cos 缩放，边缘误差 < 0.1%。
- **世界范围**（`WORLD_BOUNDS`，与简报 5.1 一致）：纬度 40.695–40.805、经度 -74.03 – -73.92。超出即 `userInWorld=false`：不放角色、镜头以时代广场为中心。可见陆地比这更大（布鲁克林、皇后区、新泽西沿岸），只作背景。
- **街网**：曼哈顿街网顺时针偏 29°，以第五大道 × 59 街为锚点，街距 80.4 m；大道、百老汇斜线、中央公园、时代广场「领结」都按真实位置排布。
- **委托落地**：交付前用最终版 `constants.ts`（13 个委托）逐个核对，13 / 13 在陆地上；q3（布鲁克林大桥）落在桥面上，光柱底座高 44 m。离时代广场最近的 3 个是 q1 / q4 / q5。新增委托若在水面上，`beacons[].onLand` 会是 `false`，QA 的 M2-04 会直接抓到。
- **地标**：帝国大厦（退台 + 尖顶 + 夜间冠灯）、克莱斯勒（拱形冠顶）、世贸一号（切角玻璃塔）、时代广场（两侧广告牌 + 一号时代广场水晶球）、中央公园（草坪、水库与湖、成片的实例化树木）、布鲁克林大桥（两座哥特拱石塔 + 桥面 + 主缆与斜拉索）、曼哈顿桥、威廉斯堡桥、自由女神。

---

## 6. QA 须知（环境相关）

- 沙箱 `hardwareConcurrency = 4`，自动档会判为**低档**。M3-01（桌面高档预算）请在 URL 加 `?tier=high`。
- SwiftShader 下桌面高档约 1 fps（GPU 侧瓶颈），一张 1440×900 全屏截图要 15–20 s，截图超时请给到 120 s 以上。动画按真实时间走，等待时长照常即可，只是采样帧少。
- CDP 触屏事件请带上 `timestamp`（点击判定按事件时间戳，主线程忙时不带时间戳会被当成长按）。
- 尺寸变化按帧同步：读 `canvas.width` 前先调一次 `render_game_to_text()`（会强制同步尺寸），或等 ≥2.5 s。
- M2-02 的 grep：仓库内 `grep -rl "from 'three"`（排除 node_modules）除了 `components/world/scene/` 还会命中 `.claude/skills/threejs-gameplay-systems/assets/…`——那是 vendored 的 skill 脚手架模板，不参与构建。应用源码里只有 `scene/` 命中。

---

## 7. 已知限制与风险

- **真机帧率与发热未验证（UNVERIFIED）**：沙箱只有软件渲染，性能结论以 draw call / 三角形 / 纹理为准。
- 3D 分包余量约 24 KB（raw），见 4.2。
- 夜里帝国大厦的冠灯偏含蓄，远景里不如白天好认；地标盲认（M3-13）建议用白天截图。
- 海岸线是 15 m 栅格化后简化的多边形，码头、小岛的细节有取舍；布鲁克林 / 皇后区 / 新泽西是按街区铺的体块，不是真实建筑。
- 2D 回退地图的 Carto 瓦片在沙箱里被拦（环境限制），与 3D 无关。

---

## 8. 自查记录

| 检查 | 命令 / 方式 | 结果 |
|---|---|---|
| 类型检查 | `npx tsc --noEmit -p .` | 0 错误 |
| 功能 | 临时自查台 + Playwright（桌面 1440×900、手机 390×844 DSF3 触屏） | 36 / 36：光柱数与 id 一致、全部 onLand、V1 最近 3 个在屏、真实点击聚焦与飞行单调趋近、拖动不误触、滚轮不滚页、俯仰受限、reset / recenter、pulse 与冲击波（+150 / +400 ms）、celebrate、隐藏停渲染、横竖屏尺寸、10 次重挂载无泄漏、上下文丢失回退、无定位 / 上海定位、减少动态效果、手机单指 / 捏合 / 轻触、禁用 WebGL 回退、控制台 0 错误 0 `THREE.` 警告 |
| 渲染预算 | V1–V4 × 桌面 DSF1 / DSF2 / 自动档 / 手机 | 全部达标（4.1） |
| 分包体积 | 以自查台为入口的 `vite build` | 625.7 KB / 174.9 KB gzip |
| 昼夜 | `setHour(13)` / `setHour(22)` 截图解码 | 夜 / 昼平均亮度：桌面 0.40、手机 0.30、总览 0.15（要求 ≤0.75）；青色 / 紫色高饱和像素 0 |
| 委托落地 | 最终版 `constants.ts` 13 个委托 | 13 / 13 在陆地（q3 在桥面） |

截图（`scratchpad/qa-shots/m1-world/`）：`desktop-day.png`、`desktop-night.png`、`mobile-day.png`、`mobile-night.png`、`desktop-overview-day.png`、`desktop-overview-night.png`，地标：`desktop-ts-day.png`、`desktop-ts-night.png`、`desktop-esb-day.png`、`desktop-esb-night.png`、`desktop-cpark-day.png`、`desktop-bridge-day.png`、`desktop-liberty-day.png`、`desktop-focus-q1-day.png`。

临时文件 `world-harness.html`、`world-harness.tsx` 已从仓库根目录删除。
