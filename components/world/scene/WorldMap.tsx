/**
 * 3D 世界地图（契约 A）：风格化纽约，玩家的真实 GPS 位置是世界里的角色，委托是立在真实坐标上的光柱。
 *
 * 只能由 App 通过 React.lazy 加载（three 只存在于这个分包里）。
 * WebGL 不可用或初始化失败时调用 onFallback(reason)，由 App 切回 2D 的 MapBoard。
 * 接取不在这里发生：点光柱只调用 onFocus，接取由 App 的卡片走 handleAccept（艾琳娜确认）。
 */
import React, { useEffect, useRef, useState } from 'react';
import type { Quest, Race } from '../../../types';
import { WorldEngine, WorldInitError } from './engine';
import { installDebugHooks } from './debug';

export interface WorldMapProps {
  quests: Quest[];
  activeQuestId: string | null;
  focusedQuestId: string | null;
  onFocus: (quest: Quest) => void;
  userLocation: [number, number] | null;
  userRace?: Race;
  onFallback?: (reason: string) => void;
  // ── 以下为契约 A 之外的可选扩展（只加不改）──
  /** 定位精度（米），画精度圈用；缺省 30 m */
  userAccuracy?: number | null;
  /** 已完成的委托：光柱变暗、图钉换成勾 */
  completedQuestIds?: string[];
  /** 玩家等级：等级不足的光柱变暗、图钉换成锁 */
  userLevel?: number;
  /** 强制减少动态效果；缺省跟随系统的 prefers-reduced-motion */
  reducedMotion?: boolean;
  /** 玩家是否在世界范围内（不在纽约时 App 禁用「回到我」） */
  onWorldStatus?: (status: { userInWorld: boolean }) => void;
}

const WorldMap: React.FC<WorldMapProps> = (props) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<WorldEngine | null>(null);
  const propsRef = useRef(props);
  propsRef.current = props;
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let fellBack = false;
    const fallback = (reason: string) => {
      if (fellBack) return;
      fellBack = true;
      const cb = propsRef.current.onFallback;
      if (cb) cb(reason);
      else setFailed(reason);
    };
    let engine: WorldEngine;
    try {
      engine = new WorldEngine(host, {
        onFocus: (q) => propsRef.current.onFocus(q),
        onFallback: fallback,
        onWorldStatus: (s) => propsRef.current.onWorldStatus?.(s),
      });
    } catch (err) {
      const reason = err instanceof WorldInitError ? err.reason : `webgl-init-failed: ${err instanceof Error ? err.message : String(err)}`;
      // 推迟一拍再通知父组件：不在 effect 的同步阶段触发父组件的 setState
      queueMicrotask(() => fallback(reason));
      return;
    }
    engineRef.current = engine;
    const p = propsRef.current;
    // 顺序有讲究：先有委托与玩家，镜头叙事（开场 / 聚焦 / 框住进行中）才知道往哪看
    engine.setReducedMotion(p.reducedMotion);
    engine.setRace(p.userRace);
    engine.setProgress(p.completedQuestIds, p.userLevel);
    engine.setQuests(p.quests);
    engine.setUserLocation(p.userLocation, p.userAccuracy);
    engine.setActive(p.activeQuestId);
    engine.setFocused(p.focusedQuestId);
    engine.start();
    const uninstall = installDebugHooks(engine);
    return () => {
      uninstall();
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    engineRef.current?.setQuests(props.quests);
  }, [props.quests]);
  useEffect(() => {
    engineRef.current?.setActive(props.activeQuestId);
  }, [props.activeQuestId]);
  useEffect(() => {
    engineRef.current?.setFocused(props.focusedQuestId);
  }, [props.focusedQuestId]);
  const lat = props.userLocation?.[0];
  const lon = props.userLocation?.[1];
  useEffect(() => {
    engineRef.current?.setUserLocation(lat !== undefined && lon !== undefined ? [lat, lon] : null, props.userAccuracy);
  }, [lat, lon, props.userAccuracy]);
  useEffect(() => {
    engineRef.current?.setRace(props.userRace);
  }, [props.userRace]);
  const completedKey = (props.completedQuestIds ?? []).join('|');
  useEffect(() => {
    engineRef.current?.setProgress(propsRef.current.completedQuestIds, props.userLevel);
  }, [completedKey, props.userLevel]);
  useEffect(() => {
    engineRef.current?.setReducedMotion(props.reducedMotion);
  }, [props.reducedMotion]);

  return (
    <div
      ref={hostRef}
      data-testid="world-map"
      role="application"
      aria-label="3D 世界地图：拖动旋转视角，双指或滚轮缩放，点击光柱查看委托"
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 0,
        overflow: 'hidden',
        background: '#1c1815',
        touchAction: 'none',
        userSelect: 'none',
        WebkitUserSelect: 'none',
      }}
    >
      {/* 边缘暗角：把视线收回画面中心、托住上方 HUD 的可读性；只压最外一圈，不碰游玩区 */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background: 'radial-gradient(ellipse at 50% 46%, transparent 58%, rgba(28,24,21,0.22) 84%, rgba(28,24,21,0.48) 100%)',
        }}
      />
      {failed && (
        <div
          role="alert"
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ede4d3',
            fontSize: 14,
            padding: 24,
            textAlign: 'center',
          }}
        >
          3D 世界无法在这台设备上启动（{failed}）。
        </div>
      )}
    </div>
  );
};

export default WorldMap;
