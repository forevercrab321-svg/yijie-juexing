import React, { useState, useMemo } from 'react';
import { Check } from 'lucide-react';
import { Quest, User } from '../types';
import { TRANSLATIONS } from '../constants';
import { acceptBlock } from '../lib/progression';
import { QUEST_TONE, QUEST_TYPE_EN } from './world/ui/questVisual';
import { BountyQuestCard, CARD_CSS } from './BountyBoard';

/**
 * 底部横向委托侧栏（地图上的一排委托卡）。
 *
 * 目前 App 没有挂载它——3D 世界里由聚焦卡片与契约终端承担同样的事。保留是因为接口还在、
 * 将来 2D 模式可能重新用上；换皮时与契约终端共用同一张委托卡（BountyQuestCard），两处长得一样、规则一样。
 */
interface BountyRailProps {
  quests: Quest[];
  onFocus: (quest: Quest) => void;
  onAccept: (quest: Quest, skipConfirm?: boolean) => void;
  activeQuestId: string | null;
  focusedQuestId: string | null;
  userLevel: number;
  lang: 'zh' | 'en';
}

const TYPES: Quest['type'][] = ['物资运输', '魔物讨伐', '迷宫建设', '异界交涉', '紧急救援'];
// 侧栏的等级档 → 数据里的难度前缀（沿用上一版的对应关系）
const RANK_PREFIX: Record<string, string> = { D: 'F级', C: 'B级', B: 'A级', A: 'S级', S: 'SS级' };
const RANKS = ['ALL', 'D', 'C', 'B', 'A', 'S'];

const BountyRail: React.FC<BountyRailProps> = ({
  quests, onFocus, onAccept, activeQuestId, focusedQuestId, userLevel, lang
}) => {
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterRank, setFilterRank] = useState<string>('ALL');
  const t = TRANSLATIONS[lang];
  const allLabel = lang === 'zh' ? '全部' : 'All';

  const filteredQuests = useMemo(() => quests.filter((q) => {
    const typeMatch = filterType === 'ALL' || q.type === filterType;
    const rankMatch = filterRank === 'ALL' || q.difficulty.startsWith(RANK_PREFIX[filterRank] ?? '\u0000');
    return typeMatch && rankMatch;
  }), [quests, filterType, filterRank]);

  // 侧栏拿不到已完成列表，只按等级与进行中判断；真正的拦截仍在 App 的 acceptQuest（同一个 acceptBlock）
  const user = { level: userLevel, completedQuestIds: [] } as Pick<User, 'level' | 'completedQuestIds'> as User;
  const blockOf = (q: Quest) => acceptBlock(user, q, activeQuestId);

  return (
    <div className="cute-root pointer-events-none absolute bottom-0 left-0 right-0 z-[1000] flex flex-col justify-end pb-[var(--sab)]">
      <style>{CARD_CSS}</style>
      {/* 筛选：类型（带类型色点）+ 难度档。标签 44px 高，满足触控下限 */}
      <div className="pointer-events-auto mx-auto mb-3 w-full max-w-3xl px-4">
        <div className="no-scrollbar flex items-center gap-2 overflow-x-auto pb-1" role="group" aria-label={t.filter_all}>
          {(['ALL', ...TYPES] as string[]).map((type) => {
            const on = filterType === type;
            const tone = type === 'ALL' ? '' : ` cute-tone-${QUEST_TONE[type as Quest['type']]}`;
            return (
              <button
                key={type}
                type="button"
                aria-pressed={on}
                onClick={() => setFilterType(type)}
                className={`cute-chip h-11 shrink-0 px-4 shadow-cute-float${tone}${on ? '' : ' cute-chip-dot'}`}
              >
                {on && <Check strokeWidth={3} aria-hidden="true" />}
                {type === 'ALL' ? allLabel : lang === 'en' ? QUEST_TYPE_EN[type as Quest['type']] : type}
              </button>
            );
          })}
          <span className="mx-1 h-6 w-0.5 shrink-0 rounded-full bg-cute-line-strong" aria-hidden="true" />
          {RANKS.map((rank) => (
            <button
              key={rank}
              type="button"
              aria-pressed={filterRank === rank}
              onClick={() => setFilterRank(rank)}
              className="cute-chip h-11 min-w-[44px] shrink-0 justify-center px-3 shadow-cute-float"
            >
              {rank === 'ALL' ? allLabel : rank}
            </button>
          ))}
        </div>
      </div>

      {/* 横向卡片列表；双击卡片仍是「快速承接」的捷径，等级不够时不触发 */}
      <ul className="pointer-events-auto no-scrollbar m-0 flex list-none snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-6 pt-1">
        {filteredQuests.length === 0 && (
          <li className="cute-panel-float mx-auto text-center text-cute-sm text-cute-ink-3">
            {lang === 'zh' ? '没有符合筛选条件的委托' : 'No quests match these filters'}
          </li>
        )}
        {filteredQuests.map((q) => {
          const block = blockOf(q);
          return (
            <li
              key={q.id}
              className="w-[85vw] max-w-[22rem] shrink-0 snap-center"
              onDoubleClick={() => block !== 'level' && onAccept(q, true)}
            >
              <BountyQuestCard
                quest={q}
                lang={lang}
                block={block}
                userLevel={userLevel}
                selected={q.id === focusedQuestId}
                onSelect={onFocus}
                onAccept={(x) => onAccept(x)}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default BountyRail;
