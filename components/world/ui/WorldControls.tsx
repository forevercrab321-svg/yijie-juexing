import React, { useId } from 'react';
import { Compass, LocateFixed } from 'lucide-react';
import { UI_STRINGS, type UiLang } from './strings';
import './worldUi.css';

/**
 * 世界控件：2D/3D 切换、视角重置、回到我。
 *
 * 纯展示：按钮只回调，由 App 发 worldEvents（ui/ 不得 import scene/）。
 * 自上而下：2D/3D → 视角重置 → 回到我，最常用的「回到我」离右手拇指最近。
 *
 * 2D 模式下只保留切换按钮。冻结的 MapBoard 不订阅世界事件，「重置 / 回到我」在 2D 里按了没有反应——
 * 看起来能按、按了却什么都不发生的控件比没有更糟，所以直接收起。
 *
 * 不可用时用原生 disabled（自动化与读屏都能识别），原因以常驻文字摆在按钮旁：
 * 禁用按钮收不到点击，手机上也没有悬停提示，「显示原因」只能靠直接可见的字。
 */
export interface WorldControlsProps {
  mode: '3d' | '2d';
  onToggleMode: () => void;
  onRecenter: () => void;
  onResetView: () => void;
  /** 有可用定位且玩家在世界范围内。为假时「回到我」禁用 */
  hasLocation: boolean;
  /** WebGL 可用。为假且处于 2D 时切换按钮禁用 */
  canUse3d: boolean;
  /** 3D 不可用的原因，例如 WebGL 初始化失败的说明 */
  fallbackReason?: string;
  /** 「回到我」不可用的原因，例如「你目前不在纽约范围内」 */
  locationHint?: string;
  /**
   * 聚焦卡片是否打开。窄屏（< 640px）下卡片是全宽底部抽屉，与竖排控件必然重叠，
   * 打开期间控件淡出让位；宽屏两者左右分开，不受影响。
   */
  cardOpen?: boolean;
  lang?: UiLang;
}

const BTN = 'wui-wcb wui-btn w-12 h-12 flex items-center justify-center rounded-xl text-amber-400';
const ICON = { size: 22, strokeWidth: 1.75 } as const;

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

  // 两种锁不会同时出现在界面上（2D 下没有「回到我」），所以只需要一条提示
  const note = toggleLocked ? fallbackReason || t.no3d : recenterLocked ? locationHint || t.noLocation : null;
  const toggleLabel = toggleLocked ? t.no3dLabel : is3d ? t.to2d : t.to3d;

  return (
    <div data-testid="world-controls" role="group" aria-label={t.controls} className={`wui-wc${cardOpen ? ' wui-yield' : ''}`}>
      {note && (
        <p
          id={noteId}
          data-testid="wc-hint"
          role="status"
          className="wui-note wui-flat rune-panel flex items-start gap-1.5 rounded-xl px-2.5 py-1.5 text-xs leading-snug text-slate-100"
        >
          {note}
        </p>
      )}

      <div className="wui-rail wui-flat rune-panel flex flex-col gap-1 p-1 rounded-2xl pointer-events-auto">
        {/* 显示的是「切过去之后」的模式，和地图类应用的惯例一致 */}
        <button
          type="button"
          data-testid="wc-toggle-mode"
          className={`${BTN} fantasy-font text-sm font-bold`}
          onClick={onToggleMode}
          disabled={toggleLocked}
          aria-label={toggleLabel}
          aria-describedby={toggleLocked ? noteId : undefined}
          title={toggleLocked ? note ?? undefined : toggleLabel}
        >
          {is3d ? '2D' : '3D'}
        </button>

        {is3d && (
          <>
            <button type="button" data-testid="wc-reset" className={BTN} onClick={onResetView} aria-label={t.resetView} title={t.resetView}>
              <Compass {...ICON} />
            </button>
            <button
              type="button"
              data-testid="wc-recenter"
              className={BTN}
              onClick={onRecenter}
              disabled={recenterLocked}
              aria-label={recenterLocked ? t.recenterOff : t.recenter}
              aria-describedby={recenterLocked ? noteId : undefined}
              title={recenterLocked ? note ?? undefined : t.recenter}
            >
              <LocateFixed {...ICON} />
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default WorldControls;
