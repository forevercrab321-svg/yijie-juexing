import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Coins, ShieldCheck, Sparkles } from 'lucide-react';
import { UI_STRINGS, int, type UiLang } from './strings';
import { useReducedMotion } from './useReducedMotion';
import { SETTLE_BEATS, landAt } from './feelTiming';
import './worldUi.css';

/**
 * 提交证明后的结算演出：金币 / 信任 / 经验逐项计数，升级时多一段专门的段落，几秒后自动收起。
 *
 * 节奏（feelTiming.ts）：卡片弹出 → 停一拍 → 三笔依次计数，每笔落账时数字「盖章」般一顿、格子闪一下
 * → 贡献浮现 → 停半拍 → 「等级提升」砸下来，卡片被震得一沉。最后这一拍与 3D 世界的 celebrate 爆发、
 * 顶栏等级数字的跳动是同一拍。数字从 0 开始数是为了让人看见「在记账」，落账那一顿是为了让每一笔都被注意到。
 *
 * 只取演出用得到的字段。lib/progression.ts 的 Settlement 多一个 user（结算后的完整档案），
 * 按结构类型可以原样传进来；不 import 它，是为了让界面层不依赖成长模块，
 * 并行开发时也不会因为对方文件还没落地而编译失败。字段名以契约 D 为准。
 */
export interface SettlementView {
  gained: { gold: number; trust: number; magicules: number; contribution: number };
  leveledUp: boolean;
  fromLevel: number;
  toLevel: number;
}

export interface SettlementToastProps {
  /** 必须是 state 里的同一个对象：每换一个新对象就重演一轮，渲染时现算会让它永远演不完 */
  settlement: SettlementView | null;
  questTitle: string;
  /** 演出结束（自动或玩家点掉）后调用一次，App 在这里清掉结算状态 */
  onDone: () => void;
  lang?: UiLang;
}

/** 第 i 笔开始计数的时刻；三笔依次落定，比同时跳完更像「一笔一笔记进账本」 */
const startAt = (i: number) => SETTLE_BEATS.countStart + i * SETTLE_BEATS.stagger;
/** 停留时长。升级多一段要读，多给 1.2 秒；最长一轮约 5.8 秒，在验收的 8 秒以内。 */
const HOLD_MS = 4400;
const HOLD_LEVELUP_MS = 5600;
const EXIT_MS = 240;
/** 节拍以 CSS 变量交给样式表：入场、贡献、升级段落都是 CSS 动画，延迟取同一张节拍表 */
const BEAT_VARS = {
  '--land2': `${landAt(2)}ms`,
  '--lvbeat': `${SETTLE_BEATS.levelUp}ms`,
} as React.CSSProperties;

const easeOutCubic = (x: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);

const CELLS = [
  ['gold', Coins, 'text-amber-400'],
  ['trust', ShieldCheck, 'text-emerald-400'],
  ['xp', Sparkles, 'text-amber-200'],
] as const;

const SettlementToast: React.FC<SettlementToastProps> = ({
  settlement, questTitle, onDone,
  // 本项目未开 strict，带默认值的解构参数会被拓宽，需要显式标注
  lang = 'zh' as UiLang,
}) => {
  const t = UI_STRINGS[lang];
  const reduced = useReducedMotion();
  const [shown, setShown] = useState<SettlementView | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const timers = useRef<number[]>([]);
  const clearTimers = () => {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
  };

  const dismiss = useCallback(() => {
    clearTimers();
    setLeaving(true);
    timers.current.push(
      window.setTimeout(() => {
        setShown(null);
        setLeaving(false);
        doneRef.current();
      }, EXIT_MS),
    );
  }, []);

  // 每来一份新的结算（新对象）重新演一轮；同一个对象重复传入不会重播。
  // App 若忘了在 onDone 里清状态，演出结束后也会自己收起，不会一直挂在屏幕上。
  useEffect(() => {
    clearTimers();
    setLeaving(false);
    setElapsed(0);
    setShown(settlement);
    if (!settlement) return;
    timers.current.push(window.setTimeout(dismiss, settlement.leveledUp ? HOLD_LEVELUP_MS : HOLD_MS));
    return clearTimers;
  }, [settlement, dismiss]);

  // 计数逐帧推进。减少动态效果时不跑，直接显示最终值。
  useEffect(() => {
    if (!shown || reduced) return;
    const start = performance.now();
    const total = landAt(CELLS.length - 1);
    let raf = requestAnimationFrame(function tick(now) {
      const e = now - start;
      setElapsed(e);
      if (e < total) raf = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(raf);
  }, [shown, reduced]);

  // Esc 也能收起；正在输入框里打字时不拦
  useEffect(() => {
    if (!shown) return;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target;
      const typing = el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
      if (e.key === 'Escape' && !e.defaultPrevented && !typing) dismiss();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [shown, dismiss]);

  const g = shown?.gained;
  const finals = g ? [int(g.gold), int(g.trust), int(g.magicules)] : [0, 0, 0];
  const contribution = g ? int(g.contribution) : 0;
  const labels = [t.gold, t.trust, t.xp];
  // 同一委托二次结算时收益全为 0：照实说「已记录、不重复发放」，而不是摆出一排 +0 假装庆祝
  const repeat = !!shown && !shown.leveledUp && contribution === 0 && finals.every((v) => v === 0);
  const counting = (i: number) => !reduced && !leaving && !repeat && elapsed < landAt(i);
  const valueAt = (i: number) => Math.round(finals[i] * easeOutCubic((elapsed - startAt(i)) / SETTLE_BEATS.countMs));
  // 落账：数到终值的那一帧起，这一格「盖章」并闪一下（CSS 动画只在类名加上时播一次）。+0 那一格不盖章：没有入账就不庆祝
  const landed = (i: number) => !reduced && !repeat && finals[i] > 0 && elapsed >= landAt(i);

  return (
    <>
      {/*
        读屏播报走一个常驻的 live region：它必须先存在、内容后变化才会被播报。
        视觉层整体 aria-hidden，避免计数中的数字被逐个念出来。
      */}
      <p className="wui-sr" role="status" aria-live="polite">
        {!shown ? '' : repeat ? `${t.settledRepeat}${t.colon}${t.repeatNote}` : t.settleSummary(questTitle, finals[0], finals[1], finals[2], shown.leveledUp ? int(shown.toLevel) : null)}
      </p>

      {shown && (
        <div
          data-testid="settlement-toast"
          aria-hidden="true"
          onClick={dismiss}
          style={BEAT_VARS}
          className={`wui-st wui-flat rune-panel parchment-noise cursor-pointer rounded-2xl p-4 text-center text-slate-100${shown.leveledUp ? ' wui-lvl' : ''}${leaving ? ' wui-out' : ''}`}
        >
          <div className="wui-crest"><i /></div>
          <p className="mt-1.5 fantasy-font text-xl font-bold tracking-widest text-amber-200">{repeat ? t.settledRepeat : t.settled}</p>
          <p className="wui-wrap mt-1 text-sm leading-snug text-slate-300" title={questTitle}>{questTitle}</p>
          {repeat && <p className="mt-1 text-sm text-slate-300">{t.repeatNote}</p>}

          <div className="mt-3 grid grid-cols-3 gap-2">
            {CELLS.map(([key, Icon, tone], i) => (
              <div key={key} className={`wui-cell flex flex-col items-center gap-1 rounded-xl bg-black/20 px-1 py-2${landed(i) ? ' wui-land' : ''}`}>
                <Icon size={18} strokeWidth={2} className={tone} />
                <span className="wui-amt wui-tnum flex items-baseline fantasy-font text-2xl font-bold leading-tight">
                  <span className="text-base text-slate-300">+</span>
                  <span className="wui-num">
                    <span data-testid={`settle-${key}`} data-value={finals[i]} className={counting(i) ? 'wui-hide' : undefined}>
                      {finals[i]}
                    </span>
                    {counting(i) && <span>{valueAt(i)}</span>}
                  </span>
                </span>
                <span className="text-xs tracking-wider text-slate-500">{labels[i]}</span>
              </div>
            ))}
          </div>

          {contribution > 0 && (
            <p className="wui-contrib mt-2 text-[13px] text-slate-300" data-testid="settle-contribution">{t.contribution} +{contribution}</p>
          )}

          {shown.leveledUp && (
            <div
              className="wui-band mt-3 rounded-xl px-3 py-2.5"
              data-testid="settle-levelup"
              data-from={int(shown.fromLevel)}
              data-to={int(shown.toLevel)}
            >
              <span className="block text-xs tracking-widest text-amber-400">{t.levelUp}</span>
              <span className="wui-tnum fantasy-font text-2xl font-bold text-amber-200">
                Lv{int(shown.fromLevel)} → Lv{int(shown.toLevel)}
              </span>
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default SettlementToast;
