import React, { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline, Circle } from 'react-leaflet';
import { DivIcon, LatLngBounds } from 'leaflet';
import { Coins, Lock, CircleCheck, MapPin, ShieldCheck } from 'lucide-react';
import { Quest } from '../types';
import { QUEST_ICON, QUEST_TONE, toneClass, type QuestTone } from './world/ui/questVisual';
// 原先从 unpkg 加载。leaflet 本来就是 npm 依赖，样式随组件打包，不再依赖第三方 CDN
import 'leaflet/dist/leaflet.css';

/**
 * 2D 回退地图（Leaflet）。3D 不可用或玩家手动切到 2D 时用它，所以它必须和 3D 世界「是同一张地图」：
 * 明亮的草绿与水蓝底图、同形同色的委托图钉、青色流动虚线路径（风格指南第 6 节）。
 */
interface MapBoardProps {
  quests: Quest[];
  activeQuestId: string | null;
  focusedQuestId: string | null;
  onFocus: (quest: Quest) => void;
  onAccept: (quest: Quest) => void;
  userLocation: [number, number] | null;
  /** 可选：已完成的委托。传了之后图钉换灰蓝 + 勾，弹窗写明原因（与 3D 徽章的「已完成」一致） */
  completedQuestIds?: string[];
  /** 可选：玩家等级。传了之后等级不足的图钉换灰蓝 + 锁 */
  userLevel?: number;
  /** 可选：玩家头像。传了之后位置标记是头像贴纸，否则是青色圆点 */
  userAvatarUrl?: string;
  /** 可选：定位精度（米）。传了之后画精度圈 */
  userAccuracy?: number | null;
}

/** 五种外形与 3D 徽章一致（指南 5.5）。没有方形：方块立在柱上是补给站的结构（IP 红线） */
const PIN_SHAPE: Record<QuestTone, string> = {
  transport: 'scallop',
  hunt: 'shield',
  build: 'hex',
  envoy: 'bubble',
  rescue: 'cross',
};

/*
  divIcon 只收 HTML 字符串，React 组件放不进去，所以把要用的 lucide 图标（lucide-react 0.556，ISC 许可）
  的路径抄成字符串。与界面上同名图标完全相同：Package / Swords / Hammer / MessageCircleHeart / HeartPulse / Check / Lock。
*/
const svg = (inner: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
const PIN_ICON: Record<QuestTone | 'done' | 'locked', string> = {
  transport: svg('<path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"/><path d="M12 22V12"/><polyline points="3.29 7 12 12 20.71 7"/><path d="m7.5 4.27 9 5.15"/>'),
  hunt: svg('<polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5"/><line x1="13" x2="19" y1="19" y2="13"/><line x1="16" x2="20" y1="16" y2="20"/><line x1="19" x2="21" y1="21" y2="19"/><polyline points="14.5 6.5 18 3 21 3 21 6 17.5 9.5"/><line x1="5" x2="9" y1="14" y2="18"/><line x1="7" x2="4" y1="17" y2="20"/><line x1="3" x2="5" y1="19" y2="21"/>'),
  build: svg('<path d="m15 12-9.373 9.373a1 1 0 0 1-3.001-3L12 9"/><path d="m18 15 4-4"/><path d="m21.5 11.5-1.914-1.914A2 2 0 0 1 19 8.172v-.344a2 2 0 0 0-.586-1.414l-1.657-1.657A6 6 0 0 0 12.516 3H9l1.243 1.243A6 6 0 0 1 12 8.485V10l2 2h1.172a2 2 0 0 1 1.414.586L18.5 14.5"/>'),
  envoy: svg('<path d="M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719"/><path d="M7.828 13.07A3 3 0 0 1 12 8.764a3 3 0 0 1 5.004 2.224 3 3 0 0 1-.832 2.083l-3.447 3.62a1 1 0 0 1-1.45-.001z"/>'),
  rescue: svg('<path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5"/><path d="M3.22 13H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27"/>'),
  done: svg('<path d="M20 6 9 17l-5-5"/>'),
  locked: svg('<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>'),
};

type PinState = 'default' | 'focused' | 'active' | 'done' | 'locked';

/*
  图标按「类型 + 状态 + 紧急」缓存：每次渲染都 new 一个 DivIcon，react-leaflet 会对每个图钉调用 setIcon，
  整组图钉的 DOM 被反复替换，弹窗打开时还会闪一下。
  cute-pin 写在 html 里面而不是 divIcon 的 className 上：Leaflet 用 transform 给图标容器定位，
  聚焦态的 scale 若落在同一个元素上会把定位覆盖掉、图钉飞到地图左上角（index.css 注释）。
*/
const iconCache = new Map<string, DivIcon>();
function pinIcon(tone: QuestTone, state: PinState, urgent: boolean): DivIcon {
  const key = `${tone}|${state}|${urgent}`;
  const hit = iconCache.get(key);
  if (hit) return hit;
  const grey = state === 'done' || state === 'locked';
  const pinState = grey ? ` is-${state}` : state === 'focused' ? ' is-focused' : '';
  const glyph = state === 'done' ? PIN_ICON.done : state === 'locked' ? PIN_ICON.locked : PIN_ICON[tone];
  const html =
    `<div class="mb-marker cute-tone-${tone}${state === 'active' ? ' is-active' : ''}${grey ? ' is-grey' : ''}">` +
    '<span class="mb-ground"></span>' +
    `<div class="cute-pin cute-pin-${PIN_SHAPE[tone]}${pinState}"><span class="cute-pin-core">${glyph}</span>` +
    // 紧急不只靠颜色：与 3D 徽章头顶同一个「!」；做完了就不再催
    (urgent && state !== 'done' ? '<span class="cute-badge-bang">!</span>' : '') +
    '</div></div>';
  const icon = new DivIcon({
    html,
    className: 'mb-icon',
    iconSize: [44, 44],
    // 锚点在图钉底部正中：底边就是委托所在的那一点
    iconAnchor: [22, 44],
    popupAnchor: [0, -46],
  });
  iconCache.set(key, icon);
  return icon;
}

const escapeAttr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function meIcon(avatarUrl?: string): DivIcon {
  const inner = avatarUrl
    ? `<img class="cute-avatar mb-me-ava" src="${escapeAttr(avatarUrl)}" alt="" draggable="false">`
    : '<span class="mb-me-dot"></span>';
  return new DivIcon({ html: `<div class="mb-me"><span class="mb-me-ring"></span>${inner}</div>`, className: 'mb-icon', iconSize: [40, 40], iconAnchor: [20, 20] });
}

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const MapController: React.FC<{
    destination: [number, number] | null;
    activeQuestLocation: [number, number] | null;
    userLocation: [number, number] | null;
}> = ({ destination, activeQuestLocation, userLocation }) => {
  const map = useMap();

  /*
   * 容器尺寸变化后必须让 Leaflet 重算，否则它只会按初始化时的尺寸请求瓦片，
   * 剩下的区域一片空白。移动端尤其容易触发——旋转屏幕、地址栏收起/展开
   * 都会改变视口高度。
   */
  useEffect(() => {
    const container = map.getContainer();
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(container);
    // 挂载后补一次：首帧布局未稳定时拿到的尺寸可能是错的
    const raf = requestAnimationFrame(() => map.invalidateSize());
    return () => {
      observer.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [map]);

  useEffect(() => {
    // 减少动效时不飞行，直接切过去（指南 3.8：相机飞行改为直接切换）
    const still = prefersReducedMotion();
    if (activeQuestLocation && userLocation) {
        const bounds = new LatLngBounds(userLocation, activeQuestLocation);
        if (still) map.fitBounds(bounds, { padding: [120, 120], animate: false });
        else map.flyToBounds(bounds, { padding: [120, 120], duration: 1.5 });
    } else if (destination) {
      if (still) map.setView(destination, 16, { animate: false });
      else map.flyTo(destination, 16, { duration: 1.2 });
    }
  }, [destination, activeQuestLocation, userLocation, map]);
  return null;
};

/*
  组件样式。只覆盖 Leaflet 自带的皮与图钉的少量附件，前缀 mb-；图钉本体用 index.css 的 .cute-pin 原语。
  瓦片滤镜按指南第 6 节：去掉上一版的 sepia 做旧，读成明亮的草绿与水蓝。
  地图底色用指南给的晴空色 #EAF7FF（与 3D 的雾色相同）：瓦片没加载出来时是一片晴空，而不是全局规则里的深色。
*/
const MAP_CSS = `
.mb-map.leaflet-container { background: #EAF7FF; font-family: var(--cute-font); }
.mb-map .leaflet-tile-pane { filter: saturate(1.35) brightness(1.04) contrast(0.96) hue-rotate(-6deg); }
.mb-labels { pointer-events: none; }
.mb-icon { background: none; border: 0; }
.mb-icon:focus { outline: none; }
.mb-marker { position: relative; width: 44px; height: 44px; }
.mb-marker .cute-pin { transform-origin: 50% 100%; transition: transform var(--cute-dur-base) var(--cute-ease-spring); }
.mb-ground { position: absolute; left: 50%; bottom: -6px; width: 24px; height: 10px; margin-left: -12px; border-radius: 50%; background: var(--tone-400); opacity: .45; box-shadow: 0 0 0 4px rgba(255, 255, 255, .45); }
.mb-marker.is-grey .mb-ground { background: rgba(31, 45, 68, .2); box-shadow: none; }
.mb-marker.is-active .mb-ground { width: 34px; height: 14px; margin-left: -17px; bottom: -8px; opacity: 1; background: rgba(44, 197, 176, .18); border: 2px dashed var(--cute-teal-400); box-shadow: none; }
.mb-icon:focus-visible .mb-marker::after { content: ''; position: absolute; inset: -5px; border-radius: 50%; box-shadow: var(--cute-focus-ring); }
.mb-me { position: relative; width: 40px; height: 40px; display: grid; place-items: center; }
.mb-me-dot { width: 20px; height: 20px; border-radius: 50%; background: var(--cute-teal-600); border: 3px solid #fff; box-shadow: var(--cute-shadow-float); }
.mb-me-ava { width: 36px; height: 36px; }
.mb-me-ring { position: absolute; inset: 0; border-radius: 50%; background: var(--cute-teal-400); opacity: .35; animation: cute-pulse-ring 2.4s ease-out infinite; }
.mb-acc { fill: var(--cute-teal-400); fill-opacity: .14; stroke: #fff; stroke-width: 2; }
.mb-route-base { stroke: #fff; }
.mb-route { stroke: var(--cute-teal-400); animation: mb-flow .45s linear infinite; }
@keyframes mb-flow { to { stroke-dashoffset: -18; } }
.mb-map .leaflet-popup-content-wrapper { padding: 0; border-radius: var(--cute-r-card); background: transparent; box-shadow: var(--cute-shadow-3); }
.mb-map .leaflet-popup-content { margin: 0; line-height: 1.5; font-size: var(--cute-fs-body); }
.mb-map .leaflet-popup-content p { margin: 0; }
.mb-map .leaflet-popup-tip { background: var(--cute-panel); box-shadow: var(--cute-shadow-1); }
.mb-pop .cute-card-head { min-height: 56px; padding-top: 8px; padding-bottom: 8px; }
.mb-pop .cute-card-head .cute-chip.mb-urgent { padding-left: 3px; color: var(--cute-coral-600); }
.mb-clamp { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 3; overflow: hidden; }
@media (prefers-reduced-motion: reduce) {
  .mb-marker .cute-pin { transition: none; }
  .mb-me-ring, .mb-route { animation: none; }
}
`;

const MapBoard: React.FC<MapBoardProps> = ({
  quests, activeQuestId, focusedQuestId, onFocus, onAccept, userLocation,
  completedQuestIds, userLevel, userAvatarUrl, userAccuracy,
}) => {
  const centerPosition: [number, number] = [40.7580, -73.9855];
  const activeQuest = quests.find(q => q.id === activeQuestId);
  const targetQuest = quests.find(q => q.id === (focusedQuestId || activeQuestId));
  const me = useMemo(() => meIcon(userAvatarUrl), [userAvatarUrl]);

  /** 图钉状态的优先级与 3D 徽章一致：进行中 → 已完成 → 等级不足 → 聚焦 → 默认 */
  const pinState = (q: Quest): PinState => {
    if (q.id === activeQuestId) return 'active';
    if (completedQuestIds?.includes(q.id)) return 'done';
    if (typeof userLevel === 'number' && userLevel < q.minLevel) return 'locked';
    if (q.id === focusedQuestId) return 'focused';
    return 'default';
  };

  return (
    <div className="absolute inset-0 w-full h-full z-0 overflow-hidden" style={{ background: '#EAF7FF' }}>
      <style>{MAP_CSS}</style>

      <MapContainer center={centerPosition} zoom={15} className="w-full h-full mb-map aethel-map" zoomControl={false}>
        {/*
          Carto Voyager 栅格：与上一版同一个 basemaps.cartocdn.com 主机，不新增域名、不新增数据采集。
          Voyager 的绿地与水面本身有颜色，配合滤镜才读得出「草绿 + 水蓝」；Positron（light）是灰白的，滤镜也救不回来。
        */}
        <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png" />

        {/*
          街道标签层。
          opacity 必须走 TileLayer 的 prop——Leaflet 会给图层写内联 opacity，
          CSS class 里的 opacity 会被内联样式压过去，改了也没反应。
        */}
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png"
          className="mb-labels"
          opacity={0.7}
        />

        <MapController
            destination={targetQuest ? targetQuest.location : null}
            activeQuestLocation={activeQuest ? activeQuest.location : null}
            userLocation={userLocation}
        />

        {/* 进行中路径：白色衬底 + 青色流动虚线，与 3D 的路径同一种画法 */}
        {activeQuest && userLocation && (
          <>
            <Polyline
              positions={[userLocation, activeQuest.location]}
              interactive={false}
              pathOptions={{ className: 'mb-route-base', color: '#fff', weight: 10, opacity: 1, lineCap: 'round' }}
            />
            <Polyline
              positions={[userLocation, activeQuest.location]}
              interactive={false}
              pathOptions={{ className: 'mb-route', color: '#2CC5B0', weight: 6, opacity: 1, dashArray: '10 8', lineCap: 'butt' }}
            />
          </>
        )}

        {userLocation && typeof userAccuracy === 'number' && userAccuracy > 0 && (
          <Circle center={userLocation} radius={userAccuracy} interactive={false} pathOptions={{ className: 'mb-acc' }} />
        )}
        {userLocation && (
          <Marker position={userLocation} icon={me} interactive={false} keyboard={false} zIndexOffset={-1000} />
        )}

        {quests.map((quest) => {
          const state = pinState(quest);
          const tone = QUEST_TONE[quest.type] ?? 'transport';
          const TypeIcon = QUEST_ICON[quest.type] ?? MapPin;
          const done = state === 'done';
          const locked = state === 'locked';
          const reason = done
            ? '你已完成这个委托，同一委托不会重复发放报酬。'
            : locked ? `等级不足：需要 Lv${quest.minLevel}，你现在 Lv${userLevel}。` : null;
          return (
            <Marker
              key={quest.id}
              position={quest.location}
              icon={pinIcon(tone, state, !!quest.isUrgent)}
              title={quest.title}
              zIndexOffset={state === 'focused' ? 1000 : state === 'active' ? 500 : 0}
              eventHandlers={{ click: () => onFocus(quest) }}
            >
              <Popup
                closeButton={false}
                minWidth={264}
                maxWidth={280}
                // 顶部留出 TopHud、底部留出世界控件与公会徽章，自动平移时弹窗不会钻到它们底下
                autoPanPaddingTopLeft={[16, 128]}
                autoPanPaddingBottomRight={[16, 136]}
              >
                <div className={`cute-root cute-card mb-pop ${toneClass(quest.type)}${done ? ' is-done' : locked ? ' is-locked' : ''}`} data-testid="map-popup" data-quest-id={quest.id}>
                  <div className="cute-card-head gap-2.5">
                    <span className="cute-card-medal" aria-hidden="true"><TypeIcon strokeWidth={2.5} /></span>
                    <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                      <span className="cute-chip">{quest.type}</span>
                      {quest.isUrgent && !done && (
                        <span className="cute-chip mb-urgent gap-1.5"><span className="cute-badge-bang" aria-hidden="true">!</span>紧急</span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 px-4 py-3">
                    <h3 className="m-0 text-cute-lg text-cute-ink [overflow-wrap:anywhere]">{quest.title}</h3>
                    <p className="mb-clamp text-cute-sm font-semibold text-cute-ink-2">{quest.description}</p>
                    <p className="flex items-center gap-1 text-cute-sm text-cute-ink-3">
                      <MapPin size={16} strokeWidth={2.5} className="shrink-0" aria-hidden="true" />{quest.locationName}
                    </p>
                    {reason && (
                      <p className={`flex items-start gap-2 rounded-cute-sm px-3 py-2 text-cute-sm font-extrabold ${done ? 'cute-tone-success' : 'cute-tone-warn'} bg-[var(--tone-50)] text-[color:var(--tone-600)]`}>
                        {done ? <CircleCheck size={16} strokeWidth={2.5} className="mt-0.5 shrink-0" aria-hidden="true" /> : <Lock size={16} strokeWidth={2.5} className="mt-0.5 shrink-0" aria-hidden="true" />}
                        <span>{reason}</span>
                      </p>
                    )}
                  </div>
                  {/* 弹窗只有 264–280px 宽：报酬用小号标签，放不下时按钮折到下一行，而不是撑出卡片 */}
                  <div className="cute-card-foot flex-wrap gap-2">
                    <span className="cute-chip cute-chip-sm cute-num cute-tone-success" title="信任"><ShieldCheck strokeWidth={2.5} aria-hidden="true" />+{quest.trustPoints}</span>
                    <span className="cute-chip cute-chip-sm cute-num cute-tone-sun" title="金币"><Coins strokeWidth={2.5} aria-hidden="true" />+{quest.rewardGold}</span>
                    {quest.id !== activeQuestId ? (
                      // 接取只回调 onAccept → App 的 handleAccept（艾琳娜确认、等级与已完成的兜底都在那里）。
                      // 已完成 / 等级不足时按钮仍可点：2D 没有聚焦卡片，App 会用告知条说明原因
                      <button
                        type="button"
                        data-testid="map-popup-accept"
                        data-blocked={reason ? 'true' : 'false'}
                        onClick={(e) => { e.stopPropagation(); onAccept(quest); }}
                        className="cute-btn cute-btn-primary ml-auto min-h-[44px] rounded-cute-md px-4 text-cute-body"
                      >
                        承接契约
                      </button>
                    ) : (
                      <span className="cute-chip cute-tone-teal ml-auto"><MapPin strokeWidth={2.5} aria-hidden="true" />进行中</span>
                    )}
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
};

export default MapBoard;
