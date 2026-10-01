import React, { useEffect, useId, useRef } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Check, CircleCheck, Coins, Flame, Lock, MapPin, ShieldCheck, Sparkles, X } from 'lucide-react';
import type { Profession, Quest } from '../../../types';
import { PROFESSION_CONFIG } from '../../../constants';
import { UI_STRINGS, int, type UiLang } from './strings';
import './worldUi.css';

/**
 * 委托聚焦卡片，取代 Leaflet 弹窗。
 *
 * 信息顺序按「前 30 秒」里玩家要做的决定排：现实中要做什么 → 在哪、多远 → 门槛 → 给什么 → 接不接。
 * 奖励与「承接契约」固定在底部、不随内容滚动：卡片再长，主操作也始终在拇指够得到的同一个位置。
 *
 * 接取只回调 onAccept，由 App 交给 handleAccept → acceptQuest（艾琳娜确认台词与 pulse 都在那里）。
 * 卡片自己唯一的判断是「这个按钮现在能不能按、为什么」，依据全部来自 props。
 *
 * 不抢焦点：艾琳娜通过工具聚焦委托时玩家可能正在她的输入框里打字，抢走焦点会吞掉按键。
 *
 * 图标只用入口包里已经有的（加上 Coins）：每个新图标约 0.45KB，装饰性的一律换成文字或 CSS。
 */
export interface QuestFocusCardProps {
  quest: Quest | null;
  userLevel: number;
  userProfession: Profession;
  /** 这个委托就是进行中的那个 */
  isActive: boolean;
  /** 手上有任意进行中的委托（ActiveQuestHUD 此时可见，卡片会把顶边再压低一些） */
  hasActiveQuest: boolean;
  /** 「N 公尺」/「X.X 公里」，格式与艾琳娜一致；没有定位时为 null，显示「距离未知」 */
  distanceText: string | null;
  onAccept: (quest: Quest) => void;
  onClose: () => void;
  /** 已完成（completedQuestIds 里有它） */
  isCompleted?: boolean;
  /** 经验奖励，App 用 questMagicules(quest) 算好传入；不传则不显示经验一栏 */
  rewardMagicules?: number;
  /** 进行中委托的标题，用于「手上还有某某在进行」的说明；不传时用泛称 */
  activeQuestTitle?: string;
  lang?: UiLang;
}

const TYPE_EN: Record<Quest['type'], string> = {
  物资运输: 'Supply Run',
  魔物讨伐: 'Monster Hunt',
  迷宫建设: 'Dungeon Works',
  异界交涉: 'Envoy',
  紧急救援: 'Rescue',
};

/**
 * 不能接取的原因。顺序按「玩家最该先知道哪一条」排：
 * 已完成是永久的，所以排在「手上还有别的」这种暂时状态之前——
 * 否则玩家照提示先做完手上的，回来发现还是接不了。
 */
type Block = 'active' | 'done' | 'busy' | 'level' | null;

const BLOCK_ICON: Record<Exclude<Block, null>, LucideIcon> = {
  active: MapPin, // 去现场
  done: CircleCheck,
  busy: Lock,
  level: Lock,
};

const isEditable = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));

const TAG = 'wui-tag inline-flex items-center gap-1 h-6 px-2 rounded-md text-xs tracking-wide whitespace-nowrap';

const QuestFocusCard: React.FC<QuestFocusCardProps> = ({
  quest, userLevel, userProfession, isActive, hasActiveQuest, distanceText, onAccept, onClose,
  // 本项目未开 strict，带默认值的解构参数会被拓宽，需要显式标注
  isCompleted = false as boolean, rewardMagicules, activeQuestTitle, lang = 'zh' as UiLang,
}) => {
  const t = UI_STRINGS[lang];
  const uid = useId();
  const titleId = `${uid}t`;
  const reasonId = `${uid}r`;

  // Esc 关闭。onClose 每次渲染都是新函数，放进 ref，免得监听器跟着反复重挂。
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const questId = quest?.id;
  useEffect(() => {
    if (!questId) return;
    const onKey = (e: KeyboardEvent) => {
      // 正在给艾琳娜打字时按 Esc 是在收输入法候选，不是要关卡片
      if (e.key !== 'Escape' || e.defaultPrevented || isEditable(e.target)) return;
      closeRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [questId]);

  if (!quest) return null;

  const lv = int(userLevel);
  const levelShort = lv < quest.minLevel;
  const block: Block = isActive ? 'active' : isCompleted ? 'done' : hasActiveQuest ? 'busy' : levelShort ? 'level' : null;
  const reason =
    block === 'active' ? t.whyActive
    : block === 'done' ? t.whyDone
    : block === 'busy' ? t.whyBusy(activeQuestTitle)
    : block === 'level' ? t.whyLevel(quest.minLevel, lv)
    : null;
  const BlockIcon = block ? BLOCK_ICON[block] : null;
  const acceptLabel = block === 'active' ? t.acceptActive : block === 'done' ? t.acceptDone : t.accept;
  const roles = quest.neededProfessions ?? [];

  const rewards: [string, LucideIcon, string, number][] = [
    ['gold', Coins, 'text-amber-400', quest.rewardGold],
    ['trust', ShieldCheck, 'text-emerald-400', quest.trustPoints],
  ];
  if (typeof rewardMagicules === 'number') rewards.push(['xp', Sparkles, 'text-amber-200', rewardMagicules]);
  const rewardLabel: Record<string, string> = { gold: t.gold, trust: t.trust, xp: t.xp };

  return (
    <section
      key={quest.id}
      data-testid="quest-focus-card"
      data-quest-id={quest.id}
      data-block={block ?? 'none'}
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
      className={`wui-card wui-flat rune-panel parchment-noise flex flex-col overflow-hidden rounded-2xl text-slate-100${quest.isUrgent ? ' wui-urgent' : ''}${hasActiveQuest ? ' wui-hudgap' : ''}`}
    >
      <header className="flex items-start gap-2 pt-1 pr-1 pl-4">
        <div className="flex flex-1 min-w-0 flex-wrap gap-1.5 pt-3">
          <span className={TAG} data-testid="quest-type">{lang === 'en' ? TYPE_EN[quest.type] ?? quest.type : quest.type}</span>
          {/* 紧急不只靠颜色：火焰图标 + 文字，色弱玩家也读得出 */}
          {quest.isUrgent && (
            <span className={`${TAG} wui-ember`} data-testid="quest-urgent"><Flame size={13} strokeWidth={2} />{t.urgent}</span>
          )}
          {isActive && <span className={`${TAG} wui-ok`}>{t.active}</span>}
          {isCompleted && !isActive && (
            <span className={`${TAG} wui-ok`}><CircleCheck size={13} strokeWidth={2} />{t.done}</span>
          )}
        </div>
        <button
          type="button"
          data-testid="quest-close"
          className="wui-x wui-btn w-12 h-12 flex-shrink-0 flex items-center justify-center rounded-xl text-slate-300"
          onClick={onClose}
          aria-label={t.closeCard}
          title={t.closeCard}
        >
          <X size={20} strokeWidth={2} />
        </button>
      </header>

      <div className="wui-body flex flex-col gap-2.5 px-4 pb-3">
        <h2 id={titleId} className="wui-wrap fantasy-font text-lg font-bold leading-snug" data-testid="quest-title">{quest.title}</h2>
        <p className="wui-wrap text-[15px] leading-snug" data-testid="quest-real-task">
          <span className="wui-chip mr-2 rounded px-1.5 text-xs tracking-wider text-amber-400">{t.realTask}</span>
          {quest.realTask}
        </p>

        <ul className="wui-wrap flex flex-col gap-1 text-sm leading-snug text-slate-300">
          <li className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
            <span className="inline-flex items-center gap-1.5 min-w-0"><MapPin size={15} strokeWidth={2} className="flex-shrink-0 text-amber-400" />{quest.locationName}</span>
            {/* 没有定位就说不知道，不拿默认坐标假装算出一个距离 */}
            <span data-testid="quest-distance" className={distanceText ? 'wui-tnum font-bold text-amber-200' : 'text-slate-500'}>
              {distanceText ?? t.distUnknown}
            </span>
          </li>
          <li className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
            <span>{quest.difficulty}</span>
            <span>{t.minutes(quest.estimatedTime)}</span>
            <span data-testid="quest-min-level" className={levelShort ? 'inline-flex items-center gap-1 text-red-300' : undefined}>
              {levelShort && <Lock size={14} strokeWidth={2} />}
              {t.needLv(quest.minLevel)}{levelShort ? ` · ${t.youLv(lv)}` : ''}
            </span>
          </li>
        </ul>

        {roles.length > 0 && (
          <ul className="flex flex-wrap gap-1.5" aria-label={t.roles}>
            {roles.map((p) => {
              const mine = p === userProfession;
              const info = PROFESSION_CONFIG[p];
              return (
                <li
                  key={p}
                  data-testid={mine ? 'quest-suits' : undefined}
                  className={`wui-role inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[13px]${mine ? ' wui-mine' : ' text-slate-300'}`}
                >
                  <span aria-hidden="true">{info?.icon}</span>
                  {lang === 'en' ? info?.tagline ?? p : p}
                  {mine && <><Check size={13} strokeWidth={2.5} />{t.suitsYou}</>}
                </li>
              );
            })}
          </ul>
        )}

        {quest.rewardDesc && (
          <p className="wui-wrap text-sm text-slate-300" data-testid="quest-bonus">
            <span className="text-amber-400">{t.bonus}{t.colon}</span>{quest.rewardDesc}
          </p>
        )}

        <p className="wui-desc wui-wrap text-sm leading-relaxed text-slate-300">{quest.description}</p>
      </div>

      {block && reason && BlockIcon && (
        <p
          id={reasonId}
          data-testid="quest-block-reason"
          className={`wui-reason wui-wrap mx-4 mb-1 flex items-start gap-2 rounded-md px-2.5 py-2 text-sm leading-snug${block === 'active' || block === 'done' ? ' wui-calm' : ''}`}
        >
          <BlockIcon size={15} strokeWidth={2} className="flex-shrink-0 mt-0.5" />
          <span>{reason}</span>
        </p>
      )}

      <footer className="wui-foot flex items-center gap-3 px-4 pt-3 pb-4">
        {/* 三项在 390px 宽下排成一行：折成两行会让卡片高出中线、盖住被聚焦的光柱。数字特别大时允许折行 */}
        <dl className="flex flex-1 min-w-0 flex-wrap gap-2.5" aria-label={t.reward}>
          {rewards.map(([key, Icon, tone, value]) => (
            <div key={key} className="flex flex-col-reverse">
              <dt className="text-[11px] tracking-wider text-slate-500">{rewardLabel[key]}</dt>
              {/* 「+」与数字包在同一个节点里，避免被 flex 间距拆开；testid 节点只放纯数字，方便断言 */}
              <dd className="wui-tnum flex items-center gap-1 whitespace-nowrap text-[15px] font-bold leading-snug">
                <Icon size={13} strokeWidth={2.25} className={tone} />
                <span>+<span data-testid={`quest-reward-${key}`}>{int(value)}</span></span>
              </dd>
            </div>
          ))}
        </dl>

        <button
          type="button"
          data-testid="quest-accept"
          className="wui-accept wui-btn flex-shrink-0 inline-flex items-center justify-center gap-2 h-12 px-4 rounded-2xl text-base font-bold whitespace-nowrap"
          disabled={block !== null}
          aria-describedby={block ? reasonId : undefined}
          onClick={() => {
            if (block === null) onAccept(quest);
          }}
        >
          {BlockIcon && <BlockIcon size={17} strokeWidth={2} />}
          {acceptLabel}
        </button>
      </footer>
    </section>
  );
};

export default QuestFocusCard;
