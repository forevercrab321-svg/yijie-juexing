import React, { useEffect, useRef, useState } from 'react';
import { Coins, ShieldCheck } from 'lucide-react';
import type { Race } from '../../../types';
import { RACE_CONFIG } from '../../../constants';
import { UI_STRINGS, int, rememberUiLang, type UiLang } from './strings';
import { SETTLE_BEATS, landAt } from './feelTiming';
import './worldUi.css';

/** 结算节拍以 CSS 变量交给样式表（feelTiming.ts）：金币、信任、经验条、等级各在自己那一拍动 */
const HUD_BEATS = {
  '--land0': `${landAt(0)}ms`,
  '--land1': `${landAt(1)}ms`,
  '--land2': `${landAt(2)}ms`,
  '--lvbeat': `${SETTLE_BEATS.levelUp}ms`,
} as React.CSSProperties;

/**
 * 左上角的档案铭牌：白色软糖面板，头像是一枚贴纸，等级角标斜贴在贴纸右下角。
 *
 * 屏幕层级里它排第三（委托徽章与角色 → 卡片 / 进行中 → 等级经验 → 金币信任），
 * 所以等级角标与经验条最醒目，金币和信任收成右侧两枚小读数，不做成三张并排的数据卡。
 * 整块是一个按钮：手机上点哪儿都能打开档案，触控面积远大于只有头像可点。
 *
 * 不自己定位——放进 App 顶栏的左槽，由顶栏的 justify-between 管左右关系。
 */
export interface TopHudProps {
  name: string;
  race: Race;
  avatarUrl?: string;
  level: number;
  /** 当前等级内的经验进度 [0, 1)，App 用 levelProgress(magicules).ratio 算好传入 */
  progressRatio: number;
  trustScore: number;
  goldCoins: number;
  onOpenProfile: () => void;
  lang?: UiLang;
}

const clamp01 = (n: number) => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);

/** 中文显示完整种族名；英文没有现成译名，用立绘文件名前缀（kijin → Kijin）凑一个可读的。 */
function raceLabel(race: Race, lang: UiLang): string {
  if (lang === 'zh') return race;
  const key = RACE_CONFIG[race]?.key ?? String(race);
  return key.charAt(0).toUpperCase() + key.slice(1);
}

const TopHud: React.FC<TopHudProps> = ({
  name, race, avatarUrl, level, progressRatio, trustScore, goldCoins, onOpenProfile,
  // 本项目未开 strict，带默认值的解构参数会被拓宽成 string，需要显式标注
  lang = 'zh' as UiLang,
}) => {
  // 主界面里它一直挂着，且渲染顺序排在提交证明面板之前：顺手把当前语言记下，给还没接上 lang 的面板兜底（strings.ts）
  rememberUiLang(lang);
  const t = UI_STRINGS[lang];
  const ratio = clamp01(progressRatio);
  const pct = Math.round(ratio * 100);
  const lv = int(level);
  const trust = int(trustScore);
  const gold = int(goldCoins);
  const raceText = raceLabel(race, lang);

  // 头像是本地 data URI 或立绘路径，存档瘦身时可能被丢掉；坏图显示种族首字，不留一个破图标
  const [imgFailed, setImgFailed] = useState(false);
  useEffect(() => setImgFailed(false), [avatarUrl]);

  /*
   * 结算入账：与结算卡同一张节拍表——卡片上金币 / 信任那一笔落账时，这里对应的数字跳一下；经验条在经验落账时涨；
   * 等级角标在升级拍上蹦一下（与 3D 世界的 celebrate 爆发同拍）。奖励「流进」常驻的顶栏，玩家才知道成长记在哪里。
   * 数值本身立即更新（读屏与自动化读到的永远是真值），按节拍延后的只有动画。
   * 只在「变大」时触发：初次挂载、读档迁移都不该闪。
   */
  const prev = useRef({ lv, gold, trust });
  const [gain, setGain] = useState({ lv: false, gold: false, trust: false });
  useEffect(() => {
    const p = prev.current;
    const grew = { lv: lv > p.lv, gold: gold > p.gold, trust: trust > p.trust };
    prev.current = { lv, gold, trust };
    const any = grew.lv || grew.gold || grew.trust;
    // 什么都没涨（初次挂载、或数值变小）时只在有残留动画时清掉，免得白白多渲染一次
    setGain((g) => (any || g.lv || g.gold || g.trust ? grew : g));
    if (!any) return;
    const id = setTimeout(() => setGain({ lv: false, gold: false, trust: false }), SETTLE_BEATS.levelUp + 1400);
    return () => clearTimeout(id);
  }, [lv, gold, trust]);

  return (
    <button
      type="button"
      data-testid="top-hud"
      onClick={onOpenProfile}
      aria-label={t.hudLabel(name, raceText, lv, pct, trust, gold)}
      style={HUD_BEATS}
      className={`cute-root cute-panel-float wui-hud pointer-events-auto flex items-center gap-2.5 h-16 min-w-0 py-1.5 pl-1.5 pr-3 rounded-cute-card text-left${gain.lv ? ' wui-lvup' : ''}${gain.gold ? ' wui-gain-g' : ''}${gain.trust ? ' wui-gain-t' : ''}`}
    >
      <span className="relative shrink-0">
        {avatarUrl && !imgFailed ? (
          <img src={avatarUrl} alt="" draggable={false} className="cute-avatar" onError={() => setImgFailed(true)} />
        ) : (
          <span aria-hidden="true" className="cute-avatar grid place-items-center font-cute-display text-cute-xl text-cute-sky-600">{Array.from(raceText)[0]}</span>
        )}
        {/* 「Lv」与数字分开放：测试与读屏取到的等级是纯数字，视觉上仍读作 Lv3 */}
        <span className="wui-lv cute-num"><span>Lv</span><span data-testid="top-hud-level">{lv}</span></span>
      </span>

      {/* 两列网格：左列名字 / 种族，右列金币 / 信任（跨两行），经验条横跨底部 */}
      <span className="wui-hud-g grid flex-1 min-w-0 items-center gap-x-2.5">
        <span className="truncate text-cute-body font-extrabold leading-5" data-testid="top-hud-name" title={name}>{name}</span>
        <span className="truncate text-cute-sm leading-4 text-cute-ink-3" data-testid="top-hud-race" title={raceText}>{raceText}</span>

        {/* 图标用 600 档（白底上的独立图标不能用 400），数值等宽并预留最小宽度——99 涨到 100 时整块不该左右跳 */}
        <span className="wui-hud-s cute-num flex flex-col items-end text-cute-sm">
          <span className="flex items-center gap-1" title={t.gold}>
            <Coins size={16} strokeWidth={2.5} className="text-cute-sun-600" aria-hidden="true" />
            <b className="wui-g" data-testid="top-hud-gold">{gold}</b>
          </span>
          <span className="flex items-center gap-1" title={t.trust}>
            <ShieldCheck size={16} strokeWidth={2.5} className="text-cute-success-600" aria-hidden="true" />
            <b className="wui-t" data-testid="top-hud-trust">{trust}</b>
          </span>
        </span>

        <span
          className="cute-progress wui-xp"
          role="progressbar"
          data-testid="top-hud-xp"
          aria-label={t.xp}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          aria-valuetext={`${pct}%`}
        >
          {/* 以等级为 key：升级时经验从高位归零，换一个节点直接落到新值，不播一段倒退的动画 */}
          <span key={lv} className="cute-progress-fill block" data-empty={pct === 0 ? 'true' : undefined} style={{ width: `${pct}%` }} />
        </span>
      </span>
    </button>
  );
};

export default TopHud;
