import React, { useState, useMemo, useEffect, useRef, useId } from 'react';
import type { LucideIcon } from 'lucide-react';
import { X, MapPin, Clock, ChevronLeft, Check, CircleCheck, Lock, Coins, ShieldCheck, Sparkles, ScrollText, Inbox } from 'lucide-react';
import { Quest, Profession, User } from '../types';
import { PROFESSION_CONFIG } from '../constants';
import { ElenaExpression } from '../lib/elena';
import { acceptBlock, questMagicules, type AcceptBlock } from '../lib/progression';
import { UI_STRINGS, int } from './world/ui/strings';
import { QUEST_ICON, QUEST_TONE, QUEST_TYPE_EN, toneClass } from './world/ui/questVisual';
import { ElenaAvatar } from './ElenaChat';

interface BountyBoardProps {
  quests: Quest[];
  onFocus: (quest: Quest) => void;
  onAccept: (quest: Quest, skipConfirm?: boolean) => void;
  activeQuestId: string | null;
  focusedQuestId: string | null;
  userLevel: number;
  onClose: () => void;
  lang: 'zh' | 'en';
  isSpeaking?: boolean;
  /** 当前该显示的表情，由台词决定。见 lib/elena.ts */
  expression?: ElenaExpression;
  /** 玩家的职业，用于标出「适合你」的委托 */
  userProfession?: Profession;
  /** 已完成的委托：「承接」按钮提前显示「已完成」，不让玩家点了才知道（QA-R1-08） */
  completedQuestIds?: string[];
}

type Lang = 'zh' | 'en';

/*
  契约终端自己的文案。委托标题、地名是数据，不在这里翻译。
  与聚焦卡片共用的词（紧急、现实中、需求 LvN、禁用原因…）直接取 world/ui/strings，两处说法永远一致。
  上一版是繁体（契約終端、進入契約終端、返回對話），风格指南 4 节要求统一简体。
*/
const TEXT = {
  zh: {
    title: '契约终端',
    close: '关闭契约终端',
    elenaName: '艾琳娜',
    elenaRole: '公会长',
    // 与打开终端时她说的那句 ELENA_LINES.greeting 同义（那边是语音台词、繁体）；改台词时这里跟着改
    greeting: '冒险者，你看起来很有精神呢。是想领取新的契约，还是想听听我的特别指引？',
    open: (n: number) => `开放 ${n}`,
    urgentN: (n: number) => `紧急 ${n}`,
    suitsN: (n: number) => `适合你 ${n}`,
    enter: '进入契约终端',
    back: '返回对话',
    all: '全部',
    filters: '按委托类型筛选',
    empty: '这一类暂时没有委托',
    emptyHint: '换个类型看看，或者过一会儿再来。',
    locate: '在地图上定位这个委托',
    accept: '承接',
    blocked: { active: '进行中', done: '已完成', busy: '已有委托', level: (n: number) => `Lv${n} 解锁` },
  },
  en: {
    title: 'Contract Terminal',
    close: 'Close contract terminal',
    elenaName: 'Elena',
    elenaRole: 'Guild Master',
    greeting: 'You look full of energy today, adventurer. Here for a new contract, or would you like some of my special guidance?',
    open: (n: number) => `${n} open`,
    urgentN: (n: number) => `${n} urgent`,
    suitsN: (n: number) => `${n} for you`,
    enter: 'Browse contracts',
    back: 'Back',
    all: 'All',
    filters: 'Filter by quest type',
    empty: 'No contracts of this type right now',
    emptyHint: 'Try another type, or check back later.',
    locate: 'Show this quest on the map',
    accept: 'Accept',
    blocked: { active: 'Active', done: 'Done', busy: 'Busy', level: (n: number) => `Lv${n}` },
  },
};

const TYPES: Quest['type'][] = ['物资运输', '魔物讨伐', '迷宫建设', '异界交涉', '紧急救援'];

const BLOCK_ICON: Record<AcceptBlock, LucideIcon> = { active: MapPin, done: CircleCheck, busy: Lock, level: Lock };
/** 原因条的色调与聚焦卡片一致：等级不足 / 手上有别的是「注意」，正在做是信息，做完了是成功 */
const BLOCK_TONE: Record<AcceptBlock, string> = {
  active: 'cute-tone-sky',
  done: 'cute-tone-success',
  busy: 'cute-tone-warn',
  level: 'cute-tone-warn',
};

/*
  只放 Tailwind 工具类表达不了的：安全区、伪元素（气泡尾巴）、滚动提示遮罩、关键帧与减少动效。bb- 前缀。
  白色顶栏 + 晴空底：类型标签是 50 档浅底，直接放在浅蓝的页面底上几乎看不出边界，所以标签条与标题同在白色顶栏里。
*/
const BB_CSS = `
.bb-top { padding-top: var(--sat); background: var(--cute-panel); box-shadow: 0 1px 0 var(--cute-line), 0 6px 16px rgba(31, 45, 68, .06); position: relative; z-index: 1; }
.bb-pad { padding-left: calc(16px + var(--sal)); padding-right: calc(16px + var(--sar)); }
@media (min-width: 640px) { .bb-pad { padding-left: calc(24px + var(--sal)); padding-right: calc(24px + var(--sar)); } }
.bb-emblem { display: grid; place-items: center; width: 36px; height: 36px; flex: none; border: 2px solid #fff; border-radius: 50%; background: radial-gradient(circle at 50% 28%, var(--cute-teal-600) 0%, var(--cute-teal-700) 52%, var(--cute-sky-600) 100%); box-shadow: 0 2px 0 var(--cute-teal-800), var(--cute-shadow-1); }
.bb-emblem > svg { width: 20px; height: 20px; }
.bb-tabs { scroll-padding-inline: 8px; }
@media (max-width: 767.98px) { .bb-tabs { -webkit-mask-image: linear-gradient(90deg, #000 calc(100% - 28px), transparent); mask-image: linear-gradient(90deg, #000 calc(100% - 28px), transparent); } }
/*
  艾琳娜的入口常驻左下（z 2100，盖在终端之上，指南 7.1：手机 left 16、bottom 24、56px）。
  手机上底部主按钮左侧让出这块（16 + 56 + 12），列表底部多留一截，最后一张卡能滚到它上方；
  桌面的主按钮居中、最宽 26rem，碰不到左下角。
*/
.bb-foot { padding-bottom: calc(16px + var(--sab)); }
.bb-list { padding-bottom: calc(96px + var(--sab)); }
@media (max-width: 639.98px) { .bb-foot { padding-left: calc(84px + var(--sal)); } }
.bb-bubble::before { content: ''; position: absolute; top: -9px; left: 50%; width: 18px; height: 18px; margin-left: -9px; background: var(--cute-panel); border-left: 1px solid var(--cute-line); border-top: 1px solid var(--cute-line); border-top-left-radius: 5px; transform: rotate(45deg); }
.bb-in { animation: cute-pop-in var(--cute-dur-pop) var(--cute-ease-spring) both; }
.bb-fade { animation: cute-fade-in var(--cute-dur-base) linear both; }
@media (prefers-reduced-motion: reduce) { .bb-in, .bb-fade { animation: cute-fade-in 150ms linear both; } }
`;

/** 委托卡自己的几条样式。BountyRail 也用这张卡，所以单独导出，由使用方各渲染一次 */
export const CARD_CSS = `
.bb-title-btn { display: flex; align-items: center; min-height: 44px; width: 100%; padding: 0; border: 0; border-radius: 8px; background: none; color: inherit; font: inherit; text-align: left; cursor: pointer; overflow-wrap: anywhere; }
.bb-title-btn:focus-visible { outline: none; box-shadow: var(--cute-focus-ring); }
.bb-desc { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; }
.cute-card-head .cute-chip.bb-urgent { padding-left: 3px; color: var(--cute-coral-600); }
`;

/** 公会徽记：与主界面底部的公会徽章按钮同一枚（风格指南附录 B），白盾 + 暖黄四角星 */
export const GuildMark: React.FC = () => (
  <svg viewBox="0 0 32 32" aria-hidden="true">
    <path d="M16 3.5c3.6 2.2 7.3 3.2 11 3.3v8.3c0 6.4-4.3 11.2-11 13.6C9.3 26.3 5 21.5 5 15.1V6.8c3.7-.1 7.4-1.1 11-3.3z" fill="#fff" />
    <path d="M16 9.2l1.9 4.7 4.7 1.9-4.7 1.9L16 22.4l-1.9-4.7-4.7-1.9 4.7-1.9z" fill="var(--cute-sun-400)" stroke="var(--cute-sun-lip)" strokeWidth="0.8" strokeLinejoin="round" />
  </svg>
);

export interface BountyQuestCardProps {
  quest: Quest;
  lang: Lang;
  /** acceptBlock 的结果：null 表示能接 */
  block: AcceptBlock | null;
  userLevel: number;
  userProfession?: Profession;
  /** 进行中委托的标题，用于「手上还有某某在进行」 */
  activeTitle?: string;
  /** 就是 App 的 focusedQuestId：地图上正聚焦的那一个，卡片加类型色外圈 */
  selected: boolean;
  onSelect: (quest: Quest) => void;
  onAccept: (quest: Quest) => void;
}

/**
 * 契约终端与委托侧栏共用的委托卡：类型 400 色铺头部 + 白色圆章图标，白色正文，底部报酬与承接。
 *
 * 接不了的委托（已完成 / 进行中 / 手上有别的 / 等级不足）提前说清楚（QA-R1-08）：按钮换成原因短语，卡片里写出完整原因。
 * 按钮仍然可以点——点了照样走 App 的 handleAccept，由它关掉终端、聚焦这个委托、在 3D 卡片上写明原因；
 * 这里只是不再让一个接不了的委托看起来「随时可以承接」。
 */
export const BountyQuestCard: React.FC<BountyQuestCardProps> = ({
  quest, lang, block, userLevel, userProfession, activeTitle, selected, onSelect, onAccept,
}) => {
  const tx = TEXT[lang];
  const t = UI_STRINGS[lang];
  const TypeIcon = QUEST_ICON[quest.type] ?? MapPin;
  const BlockIcon = block ? BLOCK_ICON[block] : null;
  const lv = int(userLevel);
  const levelShort = lv < quest.minLevel;
  const done = block === 'done';
  const stateClass = done ? ' is-done' : block === 'level' ? ' is-locked' : '';
  const sm = lang === 'zh' ? ' cute-chip-sm' : '';
  const reason =
    block === 'active' ? t.whyActive
    : block === 'done' ? t.whyDone
    : block === 'busy' ? t.whyBusy(activeTitle)
    : block === 'level' ? t.whyLevel(quest.minLevel, lv)
    : null;
  const blockedLabel =
    block === 'active' ? tx.blocked.active
    : block === 'done' ? tx.blocked.done
    : block === 'busy' ? tx.blocked.busy
    : block === 'level' ? tx.blocked.level(quest.minLevel)
    : null;
  const rewards: [string, LucideIcon, string, number, string][] = [
    ['gold', Coins, 'cute-tone-sun', quest.rewardGold, t.gold],
    ['trust', ShieldCheck, 'cute-tone-success', quest.trustPoints, t.trust],
    ['xp', Sparkles, 'cute-tone-sky', questMagicules(quest), t.xp],
  ];
  const roles = quest.neededProfessions ?? [];
  const reasonId = `bb-why-${quest.id}`;

  return (
    // 整张卡可点（指针用户的便利），键盘则落在标题按钮上；标题按钮的点击会冒泡到这里，所以只挂一处处理
    <article
      data-testid="bounty-card"
      data-quest-id={quest.id}
      onClick={() => onSelect(quest)}
      className={`cute-card cute-card-interactive flex flex-col ${toneClass(quest.type)}${stateClass}${selected ? ' is-selected' : ''}`}
    >
      <header className="cute-card-head gap-2.5">
        <span className="cute-card-medal" aria-hidden="true"><TypeIcon strokeWidth={2.5} /></span>
        <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
          <span className="cute-chip">{lang === 'en' ? QUEST_TYPE_EN[quest.type] ?? quest.type : quest.type}</span>
          {/* 紧急不只靠颜色：弹跳的「!」+ 文字，与 3D 徽章头顶的「!」气泡是同一个符号 */}
          {quest.isUrgent && (
            <span className="cute-chip bb-urgent gap-1.5"><span className="cute-badge-bang" aria-hidden="true">!</span>{t.urgent}</span>
          )}
          {done && <span className="cute-chip"><CircleCheck strokeWidth={2.5} aria-hidden="true" />{t.done}</span>}
        </div>
      </header>

      <div className="cute-card-body flex flex-1 flex-col gap-2.5">
        <h3 className="m-0 text-cute-xl">
          <button type="button" className="bb-title-btn" aria-pressed={selected} title={tx.locate}>
            {quest.title}
          </button>
        </h3>
        <p className="m-0 text-cute-body font-bold [overflow-wrap:anywhere]">
          <span className={`cute-chip cute-tone-teal mr-2 align-[2px]${sm}`}>{t.realTask}</span>
          {quest.realTask}
        </p>
        <ul className="m-0 flex list-none flex-wrap items-center gap-x-3 gap-y-1 p-0 text-cute-sm text-cute-ink-2">
          <li className="inline-flex min-w-0 items-center gap-1"><MapPin size={16} strokeWidth={2.5} className="shrink-0 text-cute-ink-3" aria-hidden="true" />{quest.locationName}</li>
          <li className="inline-flex items-center gap-1"><Clock size={16} strokeWidth={2.5} className="shrink-0 text-cute-ink-3" aria-hidden="true" />{t.minutes(quest.estimatedTime)}</li>
          <li>{quest.difficulty}</li>
          <li>
            {levelShort
              ? <span className="cute-chip cute-tone-warn"><Lock strokeWidth={2.5} aria-hidden="true" />{t.needLv(quest.minLevel)} · {t.youLv(lv)}</span>
              : t.needLv(quest.minLevel)}
          </li>
        </ul>
        {/* 需要的职业。匹配到玩家的那个会被标出来——职业因此有了实际重量。emoji 图标不再显示（指南 3.9） */}
        {roles.length > 0 && (
          <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0" aria-label={t.roles}>
            {roles.map((p) => {
              const mine = p === userProfession;
              return (
                <li key={p} className={`cute-chip${sm}${mine ? ' cute-chip-solid cute-tone-teal' : ' cute-chip-dot'}`}>
                  {lang === 'en' ? PROFESSION_CONFIG[p]?.tagline ?? p : p}
                  {mine && <><Check strokeWidth={3} aria-hidden="true" />{t.suitsYou}</>}
                </li>
              );
            })}
          </ul>
        )}
        <p className="bb-desc m-0 text-cute-sm font-semibold text-cute-ink-3">{quest.description}</p>
        {reason && BlockIcon && block && (
          <p id={reasonId} className={`m-0 flex items-start gap-2 rounded-cute-sm px-3 py-2.5 text-cute-sm font-extrabold ${BLOCK_TONE[block]} bg-[var(--tone-50)] text-[color:var(--tone-600)]`}>
            <BlockIcon size={16} strokeWidth={2.5} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>{reason}</span>
          </p>
        )}
      </div>

      <footer className="cute-card-foot flex-wrap gap-y-2.5">
        <dl className="m-0 flex flex-1 flex-wrap gap-1.5" aria-label={t.reward}>
          {rewards.map(([key, Icon, tone, value, label]) => (
            // 三枚报酬用小号标签（数字 ≤ 6 个字符，可以用 12px 角标）：常规号在手机上会把承接按钮挤到第二行
            <div key={key} className={`cute-chip cute-chip-sm cute-num ${tone}`} title={label}>
              <dt className="sr-only">{label}</dt>
              <dd className="m-0 inline-flex items-center gap-1">
                <Icon strokeWidth={2.5} aria-hidden="true" />
                <span>+{int(value)}</span>
              </dd>
            </div>
          ))}
        </dl>
        <button
          type="button"
          data-testid="bounty-accept"
          data-blocked={block ? 'true' : 'false'}
          aria-describedby={block ? reasonId : undefined}
          onClick={(e) => { e.stopPropagation(); onAccept(quest); }}
          className={block
            ? 'cute-btn cute-btn-secondary ml-auto px-4 text-cute-ink-2'
            : 'cute-btn cute-btn-primary ml-auto min-h-[48px] rounded-cute-md px-6 text-cute-body'}
        >
          {BlockIcon && <BlockIcon strokeWidth={2.5} aria-hidden="true" />}
          {blockedLabel ?? tx.accept}
        </button>
      </footer>
    </article>
  );
};

const BountyBoard: React.FC<BountyBoardProps> = ({
  quests, onFocus, onAccept, activeQuestId, focusedQuestId, userLevel, onClose, lang,
  // 默认值需要显式标注：本项目未开 strict，带默认值的解构参数会被拓宽成 string
  isSpeaking = false, expression = 'neutral' as ElenaExpression, userProfession, completedQuestIds
}) => {
  const [viewState, setViewState] = useState<'GREETING' | 'TERMINAL'>('GREETING');
  const [filter, setFilter] = useState<'ALL' | Quest['type']>('ALL');
  const tx = TEXT[lang];
  const titleId = useId();

  /*
    接不接得了，规则只有一份：lib/progression 的 acceptBlock（App 的 acceptQuest 兜底用的也是它）。
    终端只拿到等级与已完成列表，所以拼一个只含这两项的 User——acceptBlock 只读这两个字段。
  */
  const blockOf = useMemo(() => {
    const u = { level: userLevel, completedQuestIds: completedQuestIds ?? [] } as Pick<User, 'level' | 'completedQuestIds'> as User;
    return (q: Quest) => acceptBlock(u, q, activeQuestId);
  }, [userLevel, completedQuestIds, activeQuestId]);

  const filteredQuests = useMemo(() => quests.filter(q => filter === 'ALL' || q.type === filter), [quests, filter]);
  const activeTitle = quests.find((q) => q.id === activeQuestId)?.title;

  /*
    进入列表或换分类时，让地图聚焦列表里的第一个（上一版翻到哪张就聚焦哪张，关掉终端时卡片停在「刚才看的那个」）。
    已经聚焦的委托还在列表里就不动它。onFocus 与 focusedQuestId 放进 ref：App 每次渲染都传一个新的 onFocus，
    挂进依赖会让这段在每次渲染时重跑。
  */
  const onFocusRef = useRef(onFocus);
  onFocusRef.current = onFocus;
  const focusedRef = useRef(focusedQuestId);
  focusedRef.current = focusedQuestId;
  useEffect(() => {
    if (viewState !== 'TERMINAL') return;
    const first = filteredQuests[0];
    if (!first || filteredQuests.some((q) => q.id === focusedRef.current)) return;
    onFocusRef.current(first);
  }, [viewState, filteredQuests]);

  /*
    Esc 关闭：全屏面板只有一个关闭钮，键盘用户需要一个不用找的退出方式。正在打字（艾琳娜的输入框）时不拦。
    挂在捕获阶段并 preventDefault：终端背后可能开着聚焦卡片，它也听 Esc；不先拦下，一次 Esc 会把两层一起关掉。
  */
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (e.key !== 'Escape' || e.defaultPrevented || (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      e.preventDefault();
      closeRef.current();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  /*
    初始焦点：问候页落在「进入契约终端」，列表页落在当前选中的分类上——手柄 / 键盘打开面板后马上有东西可按。
    关闭时把焦点还给打开前的元素（还在页面上的话）。鼠标打开时浏览器不会给程序设置的焦点画焦点环，不影响观感。
  */
  const enterRef = useRef<HTMLButtonElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    return () => { if (prev && prev.isConnected) prev.focus({ preventScroll: true }); };
  }, []);
  useEffect(() => {
    if (viewState === 'GREETING') enterRef.current?.focus({ preventScroll: true });
    else tabsRef.current?.querySelector<HTMLElement>('[aria-pressed="true"]')?.focus({ preventScroll: true });
  }, [viewState]);

  const openCount = quests.filter((q) => blockOf(q) !== 'done').length;
  const urgentCount = quests.filter((q) => q.isUrgent && blockOf(q) !== 'done').length;
  const suitsCount = userProfession ? quests.filter((q) => q.neededProfessions?.includes(userProfession) && blockOf(q) !== 'done').length : 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      data-testid="bounty-board"
      data-view={viewState === 'GREETING' ? 'greeting' : 'list'}
      className="cute-root cute-page fixed inset-0 z-[2000] flex flex-col overflow-hidden select-none"
    >
      <style>{BB_CSS + CARD_CSS}</style>

      {/* ── 顶栏：标题 + 关闭。关闭是整个面板 DOM 里的第一个按钮（QA 脚本据此关闭终端） ── */}
      <div className="bb-top shrink-0">
        <div className="bb-pad mx-auto flex h-14 w-full max-w-5xl items-center gap-3">
          <span className="bb-emblem" aria-hidden="true"><GuildMark /></span>
          <h2 id={titleId} className="m-0 min-w-0 flex-1 truncate text-cute-xl">{tx.title}</h2>
          <button type="button" data-testid="bounty-close" onClick={onClose} className="cute-icon-btn" aria-label={tx.close} title={tx.close}>
            <X strokeWidth={2.5} aria-hidden="true" />
          </button>
        </div>

        {viewState === 'TERMINAL' && (
          /*
            分类导航。五种委托类型都要有标签（QA-R1-07）；「返回对话」放在同一行、在滚动区之外，
            不会压在分类标签上（QA-R1-08）。标签做到 44px 高，满足触控下限。
          */
          <div className="bb-pad mx-auto flex w-full max-w-5xl items-center gap-2 pb-2.5">
            <div ref={tabsRef} className="bb-tabs no-scrollbar flex min-w-0 flex-1 gap-2 overflow-x-auto py-1" role="group" aria-label={tx.filters}>
              {(['ALL', ...TYPES] as const).map((type) => {
                const on = filter === type;
                const n = type === 'ALL' ? quests.length : quests.filter((q) => q.type === type).length;
                return (
                  <button
                    key={type}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setFilter(type)}
                    className={`cute-chip h-11 shrink-0 px-4${type === 'ALL' ? '' : ` cute-tone-${QUEST_TONE[type]}`}${on ? '' : ' cute-chip-dot'}`}
                  >
                    {on && <Check strokeWidth={3} aria-hidden="true" />}
                    {type === 'ALL' ? tx.all : lang === 'en' ? QUEST_TYPE_EN[type] : type}
                    <span className="cute-num opacity-80">{n}</span>
                  </button>
                );
              })}
            </div>
            <button type="button" data-testid="bounty-back" onClick={() => setViewState('GREETING')} className="cute-btn cute-btn-ghost shrink-0 px-3">
              <ChevronLeft strokeWidth={2.5} aria-hidden="true" />
              {tx.back}
            </button>
          </div>
        )}
      </div>

      {viewState === 'GREETING' ? (
        <>
          {/* ── 问候：她的头像 + 白色对话气泡（尾巴指向头像）。气泡里顺带给出「现在有什么」的三个数 ── */}
          {/*
            手机：问候居中、主按钮钉在底部拇指区。桌面：问候与按钮作为一组整体垂直居中（上下 margin:auto），
            按钮紧跟气泡——大屏上按钮孤零零贴在最底下，视线要从中间跳到底边。
          */}
          <main className="min-h-0 flex-1 overflow-y-auto sm:mt-auto sm:flex-[0_1_auto]">
            <div className="bb-pad mx-auto flex min-h-full w-full max-w-[26rem] flex-col items-center justify-center gap-3 py-6 sm:max-w-[30rem] sm:pb-2">
              <ElenaAvatar expression={expression} speaking={isSpeaking} className="h-28 w-28 sm:h-40 sm:w-40" />
              <span className="cute-chip bg-cute-panel shadow-cute-1">
                <span className="text-cute-ink">{tx.elenaName}</span>
                <span aria-hidden="true">·</span>
                {tx.elenaRole}
              </span>
              <div className="bb-bubble bb-in cute-panel relative mt-2 w-full">
                <p className="m-0 text-cute-body font-bold text-cute-ink sm:text-cute-lg">{tx.greeting}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <span className="cute-chip cute-tone-teal"><ScrollText strokeWidth={2.5} aria-hidden="true" /><span className="cute-num">{tx.open(openCount)}</span></span>
                  {urgentCount > 0 && (
                    <span className="cute-chip cute-tone-coral"><span className="cute-badge-bang" aria-hidden="true">!</span><span className="cute-num">{tx.urgentN(urgentCount)}</span></span>
                  )}
                  {suitsCount > 0 && (
                    <span className="cute-chip cute-tone-sky"><Check strokeWidth={3} aria-hidden="true" /><span className="cute-num">{tx.suitsN(suitsCount)}</span></span>
                  )}
                </div>
              </div>
            </div>
          </main>
          {/* 主按钮钉在底部拇指区，内容再多也不会被挤出屏幕 */}
          <div className="bb-foot bb-pad shrink-0 pt-2 sm:mb-auto">
            <button
              ref={enterRef}
              type="button"
              data-testid="bounty-enter"
              onClick={() => setViewState('TERMINAL')}
              className="cute-btn cute-btn-primary cute-btn-block mx-auto max-w-[26rem] sm:max-w-[30rem]"
            >
              <ScrollText strokeWidth={2.5} aria-hidden="true" />
              {tx.enter}
            </button>
          </div>
        </>
      ) : (
        /* ── 委托列表：一张委托一张卡，桌面两列 ── */
        <main className="min-h-0 flex-1 overflow-y-auto">
          {filteredQuests.length > 0 ? (
            <ul key={filter} className="bb-list bb-fade bb-pad m-0 mx-auto grid w-full max-w-5xl list-none items-start gap-4 pt-4 lg:grid-cols-2">
              {filteredQuests.map((q) => (
                <li key={q.id} className="min-w-0">
                  <BountyQuestCard
                    quest={q}
                    lang={lang}
                    block={blockOf(q)}
                    userLevel={userLevel}
                    userProfession={userProfession}
                    activeTitle={activeTitle}
                    selected={q.id === focusedQuestId}
                    onSelect={onFocus}
                    onAccept={onAccept}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <div className="bb-pad flex flex-col items-center gap-3 py-16 text-center">
              <span className="grid h-16 w-16 place-items-center rounded-full bg-cute-panel text-cute-ink-3 shadow-cute-1"><Inbox size={28} strokeWidth={2.25} aria-hidden="true" /></span>
              <p className="m-0 text-cute-lg text-cute-ink">{tx.empty}</p>
              <p className="m-0 text-cute-sm text-cute-ink-3">{tx.emptyHint}</p>
            </div>
          )}
        </main>
      )}
    </div>
  );
};

export default BountyBoard;
