import React, { useEffect, useId, useRef } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Check, CircleCheck, Clock, Coins, Lock, MapPin, ShieldCheck, Sparkles, X } from 'lucide-react';
import type { Profession, Quest } from '../../../types';
import { PROFESSION_CONFIG } from '../../../constants';
import { UI_STRINGS, int, type UiLang } from './strings';
import { QUEST_ICON, QUEST_TYPE_EN, toneClass } from './questVisual';
import './worldUi.css';

/**
 * 委托聚焦卡片，取代 Leaflet 弹窗。可爱风格的委托卡：类型色铺头部（白色圆章 + 类型标签），白色正文。
 *
 * 信息顺序按「前 30 秒」里玩家要做的决定排：现实中要做什么 → 在哪、多远 → 门槛 → 给什么 → 接不接。
 * 奖励与「承接契约」固定在底部、不随内容滚动：卡片再长，主操作也始终在拇指够得到的同一个位置。
 *
 * 接取只回调 onAccept，由 App 交给 handleAccept → acceptQuest（艾琳娜确认台词与 pulse 都在那里）。
 * 卡片自己唯一的判断是「这个按钮现在能不能按、为什么」，依据全部来自 props。
 *
 * 不抢焦点：艾琳娜通过工具聚焦委托时玩家可能正在她的输入框里打字，抢走焦点会吞掉按键。
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

/** 原因条的色调：等级不足 / 手上有别的是「注意」；正在做是信息，做完了是成功——这两种不该让人以为自己做错了什么 */
const BLOCK_TONE: Record<Exclude<Block, null>, string> = {
  active: 'cute-tone-sky',
  done: 'cute-tone-success',
  busy: 'cute-tone-warn',
  level: 'cute-tone-warn',
};

const isEditable = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));

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
  const TypeIcon = QUEST_ICON[quest.type] ?? MapPin;
  // 已完成 / 等级不足时头部换成冷灰蓝（原语 is-done / is-locked）：一眼看出「这张现在接不了」，原因仍写在卡里
  const stateClass = isCompleted && !isActive ? ' is-done' : block === 'level' ? ' is-locked' : '';

  // 12px 小标签只给 ≤ 6 个字的中文角标（指南 3.4）；英文词更长，用 14px 的常规标签
  const sm = lang === 'zh' ? ' cute-chip-sm' : '';

  const rewards: [string, LucideIcon, string, number][] = [
    ['gold', Coins, 'cute-tone-sun', quest.rewardGold],
    ['trust', ShieldCheck, 'cute-tone-success', quest.trustPoints],
  ];
  if (typeof rewardMagicules === 'number') rewards.push(['xp', Sparkles, 'cute-tone-sky', rewardMagicules]);
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
      className={`cute-root cute-card wui-card fixed flex flex-col ${toneClass(quest.type)}${stateClass}${quest.isUrgent ? ' wui-urgent' : ''}${hasActiveQuest ? ' wui-hudgap' : ''}`}
    >
      <header className="cute-card-head shrink-0 gap-2.5 py-2 pl-3.5 pr-2">
        <span className="cute-card-medal" aria-hidden="true"><TypeIcon strokeWidth={2.5} /></span>
        <div className="flex flex-1 min-w-0 flex-wrap gap-1.5">
          <span className="cute-chip" data-testid="quest-type">{lang === 'en' ? QUEST_TYPE_EN[quest.type] ?? quest.type : quest.type}</span>
          {/* 紧急不只靠颜色：弹跳的「!」+ 文字，色弱玩家也读得出；与 3D 徽章头顶的「!」气泡是同一个符号 */}
          {quest.isUrgent && (
            <span className="cute-chip wui-chip-urgent gap-1.5" data-testid="quest-urgent">
              <span className="cute-badge-bang" aria-hidden="true">!</span>{t.urgent}
            </span>
          )}
          {isActive && <span className="cute-chip"><MapPin strokeWidth={2.5} aria-hidden="true" />{t.active}</span>}
          {isCompleted && !isActive && (
            <span className="cute-chip wui-chip-ok"><CircleCheck strokeWidth={2.5} aria-hidden="true" />{t.done}</span>
          )}
        </div>
        <button
          type="button"
          data-testid="quest-close"
          className="cute-icon-btn"
          onClick={onClose}
          aria-label={t.closeCard}
          title={t.closeCard}
        >
          <X strokeWidth={2.5} aria-hidden="true" />
        </button>
      </header>

      <div className="wui-body flex flex-1 flex-col gap-2.5 min-h-0 overflow-y-auto px-4 pt-3.5 pb-3">
        <h2 id={titleId} className="m-0 text-cute-xl wui-wrap" data-testid="quest-title">{quest.title}</h2>
        <p className="wui-task m-0 text-cute-body font-bold wui-wrap" data-testid="quest-real-task">
          <span className={`cute-chip cute-tone-teal${sm}`}>{t.realTask}</span>
          {quest.realTask}
        </p>

        <ul className="m-0 p-0 list-none flex flex-col gap-1 text-cute-sm text-cute-ink-2 wui-wrap">
          <li className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="inline-flex items-center gap-1 min-w-0"><MapPin size={16} strokeWidth={2.5} className="shrink-0 text-cute-ink-3" aria-hidden="true" />{quest.locationName}</span>
            {/* 没有定位就说不知道，不拿默认坐标假装算出一个距离 */}
            <span data-testid="quest-distance" className={distanceText ? 'cute-num text-cute-ink' : 'text-cute-ink-3'}>
              {distanceText ?? t.distUnknown}
            </span>
          </li>
          <li className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>{quest.difficulty}</span>
            <span className="inline-flex items-center gap-1"><Clock size={16} strokeWidth={2.5} className="shrink-0 text-cute-ink-3" aria-hidden="true" />{t.minutes(quest.estimatedTime)}</span>
            {levelShort ? (
              <span data-testid="quest-min-level" className="cute-chip cute-tone-warn">
                <Lock strokeWidth={2.5} aria-hidden="true" />
                {t.needLv(quest.minLevel)} · {t.youLv(lv)}
              </span>
            ) : (
              <span data-testid="quest-min-level">{t.needLv(quest.minLevel)}</span>
            )}
          </li>
        </ul>

        {roles.length > 0 && (
          <ul className="m-0 p-0 list-none flex flex-wrap gap-1.5" aria-label={t.roles}>
            {roles.map((p) => {
              const mine = p === userProfession;
              const info = PROFESSION_CONFIG[p];
              return (
                <li
                  key={p}
                  data-testid={mine ? 'quest-suits' : undefined}
                  className={`cute-chip${sm}${mine ? ' cute-chip-solid cute-tone-teal' : ' cute-chip-dot'}`}
                >
                  {/* 职业的 emoji 图标不再显示（指南 3.9：不用 emoji 作图标），文字本身就够 */}
                  {lang === 'en' ? info?.tagline ?? p : p}
                  {mine && <><Check strokeWidth={3} aria-hidden="true" />{t.suitsYou}</>}
                </li>
              );
            })}
          </ul>
        )}

        {quest.rewardDesc && (
          <p className="m-0 text-cute-sm text-cute-ink-2 wui-wrap" data-testid="quest-bonus">
            <b className="font-black text-cute-sun-600">{t.bonus}{t.colon}</b>{quest.rewardDesc}
          </p>
        )}

        <p className="wui-desc m-0 text-cute-sm font-semibold text-cute-ink-3 wui-wrap">{quest.description}</p>
      </div>

      {block && reason && BlockIcon && (
        <p id={reasonId} data-testid="quest-block-reason" className={`wui-tint wui-why wui-wrap flex items-start gap-2 mx-4 mb-1 px-3 py-2.5 rounded-cute-sm text-cute-sm font-extrabold ${BLOCK_TONE[block]}`}>
          <BlockIcon size={16} strokeWidth={2.5} className="shrink-0 mt-0.5" aria-hidden="true" />
          <span>{reason}</span>
        </p>
      )}

      <footer className="cute-card-foot shrink-0 flex-wrap gap-y-2.5">
        {/* 图标与 TopHud 同一套（金币 Coins / 信任 ShieldCheck / 经验 Sparkles），名称给读屏与悬停 */}
        <dl className="m-0 flex flex-wrap gap-1.5" aria-label={t.reward}>
          {rewards.map(([key, Icon, tone, value]) => (
            <div key={key} className={`cute-chip cute-num text-cute-body font-black h-8 ${tone}`} title={rewardLabel[key]}>
              <dt className="wui-sr">{rewardLabel[key]}</dt>
              {/* 「+」与数字包在同一个节点里，避免被 flex 间距拆开；testid 节点只放纯数字，方便断言 */}
              <dd className="m-0 inline-flex items-center gap-1">
                <Icon size={16} strokeWidth={2.5} aria-hidden="true" />
                <span>+<span data-testid={`quest-reward-${key}`}>{int(value)}</span></span>
              </dd>
            </div>
          ))}
        </dl>

        <button
          type="button"
          data-testid="quest-accept"
          className="cute-btn cute-btn-primary wui-accept"
          disabled={block !== null}
          aria-describedby={block ? reasonId : undefined}
          onClick={() => {
            if (block === null) onAccept(quest);
          }}
        >
          {BlockIcon && <BlockIcon strokeWidth={2.5} aria-hidden="true" />}
          {acceptLabel}
        </button>
      </footer>
    </section>
  );
};

export default QuestFocusCard;
