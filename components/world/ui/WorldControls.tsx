import React, { useEffect, useId, useState } from 'react';
import { Compass, Layers, LocateFixed, LocateOff } from 'lucide-react';
import { UI_STRINGS, type UiLang } from './strings';
import './worldUi.css';

/**
 * 世界控件：2D/3D 切换、视角重置、回到我。右下竖排的白色圆钮（风格指南 7.1）。
 *
 * 纯展示：按钮只回调，由 App 发 worldEvents（ui/ 不得 import scene/）。
 *
 * 2D 模式下只保留切换按钮。冻结的 MapBoard 不订阅世界事件，「重置 / 回到我」在 2D 里按了没有反应——
 * 看起来能按、按了却什么都不发生的控件比没有更糟，所以直接收起。
 *
 * 不可用的按钮（QA-R2-02）：上一版把原因常驻摆在按钮旁，结果在没定位 / 不在纽约时（大多数测试者）
 * 那块提示一直盖着默认视角里的委托徽章。现在改成「灰掉的按钮 + 右上一枚小问号」，点按才弹出原因、几秒后自己收起。
 * 所以不可用用的是 aria-disabled 而不是原生 disabled：原生禁用的按钮收不到点击，「点我看原因」就做不出来。
 * 读屏与自动化照样认得出它不可用（aria-disabled 等同禁用），原因节点始终在 DOM 里、经 aria-describedby 关联。
 */
export interface WorldControlsProps {
  mode: '3d' | '2d';
  onToggleMode: () => void;
  onRecenter: () => void;
  onResetView: () => void;
  /** 有可用定位且玩家在世界范围内。为假时「回到我」不可用 */
  hasLocation: boolean;
  /** WebGL 可用。为假且处于 2D 时切换按钮不可用 */
  canUse3d: boolean;
  /** 3D 不可用的原因，例如 WebGL 初始化失败的说明 */
  fallbackReason?: string;
  /** 「回到我」不可用的原因，例如「你目前不在纽约范围内」 */
  locationHint?: string;
  /**
   * 聚焦卡片是否打开。窄屏（< 640px）下卡片横跨全宽，与右下的控件列必然重叠，
   * 打开期间控件淡出让位；宽屏两者左右分开，不受影响。
   */
  cardOpen?: boolean;
  lang?: UiLang;
}

/** 原因气泡停留多久。够读完一句两行的中文，又不会一直挡着地图 */
const NOTE_MS = 4200;

const WorldControls: React.FC<WorldControlsProps> = ({
  mode, onToggleMode, onRecenter, onResetView, hasLocation, canUse3d,
  fallbackReason, locationHint,
  // 本项目未开 strict，带默认值的解构参数会被拓宽，需要显式标注
  cardOpen = false as boolean, lang = 'zh' as UiLang,
}) => {
  const t = UI_STRINGS[lang];
  const noteId = useId();
  const is3d = mode === '3d';

  // 3D 模式下永远可以切去 2D；只有「已在 2D 且 3D 不可用」时切换才锁住
  const toggleLocked = !is3d && !canUse3d;
  const recenterLocked = is3d && !hasLocation;

  // 两种锁不会同时出现在界面上（2D 下没有「回到我」），所以只需要一条原因
  const note = toggleLocked ? fallbackReason || t.no3d : recenterLocked ? locationHint || t.noLocation : null;
  const noteFor = toggleLocked ? 'toggle' : 'recenter';
  const toggleLabel = toggleLocked ? t.no3dLabel : is3d ? t.to2d : t.to3d;

  // 气泡只在点了不可用的按钮之后展开；原因变了（拿到定位、切了语言）或卡片打开时收起，避免显示过期的话
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [note, cardOpen]);
  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => setOpen(false), NOTE_MS);
    return () => window.clearTimeout(id);
  }, [open]);

  const explain = () => setOpen((v) => !v);
  const why = (
    <span className="wui-q absolute -right-1 -top-1 grid place-items-center w-5 h-5 border-2 rounded-full text-white text-cute-cap font-black pointer-events-none" aria-hidden="true">?</span>
  );

  return (
    <div data-testid="world-controls" role="group" aria-label={t.controls} className={`cute-root wui-wc${cardOpen ? ' wui-yield' : ''}`}>
      <div className="wui-rail">
        {/* 显示的是「切过去之后」的模式，和地图类应用的惯例一致 */}
        <button
          type="button"
          data-testid="wc-toggle-mode"
          className="cute-icon-btn wui-mode"
          onClick={toggleLocked ? explain : onToggleMode}
          aria-disabled={toggleLocked ? 'true' : undefined}
          aria-label={toggleLabel}
          aria-describedby={toggleLocked ? noteId : undefined}
          title={toggleLocked ? `${note ?? ''} · ${t.tapWhy}` : toggleLabel}
        >
          <Layers strokeWidth={2.5} aria-hidden="true" />
          <span aria-hidden="true">{is3d ? '2D' : '3D'}</span>
          {toggleLocked && why}
        </button>

        {is3d && (
          <>
            <button type="button" data-testid="wc-reset" className="cute-icon-btn" onClick={onResetView} aria-label={t.resetView} title={t.resetView}>
              <Compass strokeWidth={2.5} aria-hidden="true" />
            </button>
            <button
              type="button"
              data-testid="wc-recenter"
              className="cute-icon-btn"
              onClick={recenterLocked ? explain : onRecenter}
              aria-disabled={recenterLocked ? 'true' : undefined}
              aria-label={recenterLocked ? t.recenterOff : t.recenter}
              aria-describedby={recenterLocked ? noteId : undefined}
              title={recenterLocked ? `${note ?? ''} · ${t.tapWhy}` : t.recenter}
            >
              {/* 不可用时换成划掉的定位图标：不点开气泡也看得出「是定位的问题」 */}
              {recenterLocked ? <LocateOff strokeWidth={2.5} aria-hidden="true" /> : <LocateFixed strokeWidth={2.5} aria-hidden="true" />}
              {recenterLocked && why}
            </button>
          </>
        )}
      </div>

      {note && (
        <p
          id={noteId}
          data-testid="wc-hint"
          data-for={noteFor}
          data-open={open ? 'true' : 'false'}
          role="status"
          className={open ? 'wui-note' : 'wui-sr'}
          onClick={() => setOpen(false)}
        >
          {note}
        </p>
      )}
    </div>
  );
};

export default WorldControls;
