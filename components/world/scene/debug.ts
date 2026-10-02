/**
 * 调试钩子（契约 C）：只在 URL 带 ?debug=1 时挂载，生产默认关闭，WorldMap 卸载时移除。
 *
 * window.render_game_to_text() → JSON 字符串，字段见 docs/studio/handoff/world-engineer.md
 * window.__world → tapBeacon(id) / focusQuest(id) / setHour(h) / recenter() / stats()（另有 setView、breakdown 两个 QA 用的额外方法）
 */
import type { WorldEngine } from './engine';

export interface WorldDebugApi {
  /** 与真实点击徽章同一条路径：触发 App 的 onFocus */
  tapBeacon(id: string): boolean;
  /** 只移动镜头去看某个委托（测量视角 V3），不改 App 状态 */
  focusQuest(id: string): boolean;
  /** 固定场景时间（0–24）；传 null 恢复跟随本地时间 */
  setHour(h: number | null): void;
  recenter(): void;
  stats(): ReturnType<WorldEngine['statsWithBuild']>;
  /** 额外：直接设定镜头（tilt/heading/zoom/target），QA 复现视角用 */
  setView(v: Parameters<WorldEngine['setView']>[0]): void;
  /** 额外：逐网格的三角形 / 实例数 / 是否投影，定位预算大头用 */
  breakdown(): ReturnType<WorldEngine['breakdown']>;
}

declare global {
  interface Window {
    render_game_to_text?: () => string;
    __world?: WorldDebugApi;
  }
}

export function debugEnabled(): boolean {
  try {
    return new URLSearchParams(window.location.search).get('debug') === '1';
  } catch {
    return false;
  }
}

export function installDebugHooks(engine: WorldEngine): () => void {
  if (!debugEnabled()) return () => {};
  const render = () => JSON.stringify(engine.debugState());
  const api: WorldDebugApi = {
    tapBeacon: (id) => engine.tapBeacon(id),
    focusQuest: (id) => engine.focusQuest(id),
    setHour: (h) => engine.setHour(h),
    recenter: () => engine.recenterNow(),
    stats: () => engine.statsWithBuild(),
    setView: (v) => engine.setView(v),
    breakdown: () => engine.breakdown(),
  };
  window.render_game_to_text = render;
  window.__world = api;
  return () => {
    // StrictMode 下可能先挂新的再卸旧的：只移除属于自己的那一份
    if (window.render_game_to_text === render) delete window.render_game_to_text;
    if (window.__world === api) delete window.__world;
  };
}
