
import React, { useEffect, useRef, useState } from 'react';
import { X, Search, UserPlus, MessageCircle, Shield, Phone, Sparkles, ChevronRight, UserCheck, Users } from 'lucide-react';
import { TRANSLATIONS, RACE_CONFIG } from '../constants';
import { User, Race } from '../types';
import type { ElenaLineId } from '../lib/elena';
import { RACE_TONE } from './VerificationModal';

interface FriendsBoardProps {
  onClose: () => void;
  lang: 'zh' | 'en';
  currentUser: User;
  /** 触发艾琳娜的固定台词。台词内容由 lib/elena.ts 统一管理。 */
  onSpeak: (line: ElenaLineId) => void;
}

/*
 * 简体覆盖：TRANSLATIONS.zh 里好友相关文案还是繁体（「夥伴通訊錄」…），constants.ts 不归本分工，
 * 先在这里覆盖，交接文档请集成者改好 TRANSLATIONS.zh 后删掉。英文原样使用 TRANSLATIONS.en。
 */
const ZH_SIMPLIFIED = {
  friends_title: '伙伴通讯录',
  friends_tab_mine: '我的好友',
  friends_tab_pending: '待处理',
  friends_search_placeholder: '搜索 ID 或冒险者名字…',
  friends_online: '冒险中',
  friends_offline: '冥想中',
  friends_sync_contacts: '同步灵魂连结',
};

/** 原先写死在 JSX 里的英文 / 繁体小字（Search Result、2h ago、沒有待處理…） */
const LOCAL = {
  zh: {
    close: '关闭伙伴通讯录',
    searchLabel: '搜索冒险者',
    searching: '正在搜索…',
    result: '搜索结果',
    add: '加好友',
    addLabel: (n: string) => `向 ${n} 发送好友请求`,
    resonance: '共鸣',
    message: (n: string) => `给 ${n} 发消息`,
    trust: (n: string) => `查看 ${n} 的信任徽章`,
    lastSeen: '2 小时前',
    empty: '没有待处理的契约请求哦～',
    verified: '已认证',
  },
  en: {
    close: 'Close contacts',
    searchLabel: 'Search adventurers',
    searching: 'Searching…',
    result: 'Search result',
    add: 'Add',
    addLabel: (n: string) => `Send a friend request to ${n}`,
    resonance: 'Resonance',
    message: (n: string) => `Message ${n}`,
    trust: (n: string) => `View ${n}'s trust badge`,
    lastSeen: '2h ago',
    empty: 'No pending requests right now.',
    verified: 'Verified',
  },
};

const FriendsBoard: React.FC<FriendsBoardProps> = ({ onClose, lang, currentUser, onSpeak }) => {
  const t = lang === 'zh' ? { ...TRANSLATIONS.zh, ...ZH_SIMPLIFIED } : TRANSLATIONS.en;
  const l = LOCAL[lang];
  const [activeTab, setActiveTab] = useState<'MINE' | 'PENDING'>('MINE');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<any>(null);

  // 模拟好友数据（名字统一简体）
  const [friends] = useState([
    { id: 'f1', name: '影之猎人', race: Race.KIJIN, level: 25, status: 'online', resonance: 88, avatarUrl: RACE_CONFIG[Race.KIJIN].img },
    { id: 'f2', name: '喵喵指挥官', race: Race.SLIME, level: 12, status: 'offline', resonance: 45, lastSeen: true, avatarUrl: RACE_CONFIG[Race.SLIME].img },
    { id: 'f3', name: '纽约大贤者', race: Race.DAEMON, level: 50, status: 'online', resonance: 100, avatarUrl: RACE_CONFIG[Race.DAEMON].img },
  ]);

  const handleSearch = () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    setSearchResult(null);

    // 模拟搜索逻辑
    setTimeout(() => {
        setIsSearching(false);
        // 模拟找到一个路人
        if (searchQuery.includes('123') || searchQuery.includes('@')) {
            setSearchResult({
                id: 's1',
                name: '神秘冒险者',
                race: Race.DRAGONNEWT,
                level: 5,
                isVerified: true
            });
            onSpeak('friend_found');
        } else {
            onSpeak('friend_not_found');
        }
    }, 1500);
  };

  // 初始焦点进弹层、关闭后还给打开它的按钮；理由见 ProfileModal
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    closeRef.current?.focus({ preventScroll: true });
    return () => { if (prev && document.contains(prev)) prev.focus({ preventScroll: true }); };
  }, []);

  const tabs = [
    { id: 'MINE' as const, label: t.friends_tab_mine },
    { id: 'PENDING' as const, label: `${t.friends_tab_pending} (0)` },
  ];

  return (
    /*
      z-1350：好友页是从个人档案（1300）里打开的，档案并不会随之关闭。
      上一版这里是 1100，整页好友被压在档案弹层下面，要先关掉档案才看得见。
      现在夹在档案（1300）与执照（1400）之间，叠层表其余各层不变。
    */
    <div
      className="cute-root fixed inset-0 z-[1350]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="friends-title"
      data-testid="friends-board"
      onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose(); } }}
    >
      <div className="cute-scrim" onClick={onClose} aria-hidden />

      {/*
        固定高度的抽屉：标题、页签、搜索框钉在上面，只有列表滚动。
        高度固定而不是随内容伸缩，切页签时抽屉不会忽高忽低。
      */}
      <div className="cute-sheet flex h-[min(46rem,calc(100dvh_-_64px_-_var(--sat,0px)))] flex-col overflow-hidden">
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label={l.close}
          className="cute-icon-btn cute-icon-btn-sm absolute right-4 top-4 z-10"
        >
          <X strokeWidth={2.5} aria-hidden />
        </button>

        {/* Header */}
        <div className="shrink-0 pr-14">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full border-4 border-white bg-cute-sky-50 text-cute-sky-600 shadow-cute-1">
              <Users className="h-6 w-6" strokeWidth={2.25} aria-hidden />
            </span>
            <h2 id="friends-title" className="text-cute-xl text-cute-ink">{t.friends_title}</h2>
          </div>

          {/* 页签：可选标签做成分段控件，选中 = 实底白字；补到 44px 高满足触控下限 */}
          <div className="mt-3 flex gap-2" role="tablist" aria-label={t.friends_title}>
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                id={`friends-tab-${tab.id}`}
                aria-selected={activeTab === tab.id}
                aria-controls="friends-panel"
                onClick={() => setActiveTab(tab.id)}
                className="cute-chip cute-tone-teal h-11 px-4"
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative mt-3 shrink-0">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-cute-ink-3" aria-hidden />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder={t.friends_search_placeholder}
            aria-label={l.searchLabel}
            enterKeyHint="search"
            className="cute-input pl-12 pr-12"
          />
          {isSearching && (
            <span className="absolute right-4 top-1/2 -translate-y-1/2" role="status" aria-label={l.searching}>
              <span className="block h-5 w-5 animate-spin rounded-full border-[3px] border-cute-teal-50 border-t-cute-teal-600 motion-reduce:animate-none" />
            </span>
          )}
        </div>

        {/* Content：唯一的滚动区。手机上底部多留 7rem，最后一项能滚到左下艾琳娜入口之上（理由见 ProfileModal） */}
        <div id="friends-panel" role="tabpanel" aria-labelledby={`friends-tab-${activeTab}`} className="-mx-1 mt-3 min-h-0 flex-1 space-y-3 overflow-y-auto px-1 pb-2 scroll-touch max-sm:pb-28">

            {/* Search Results */}
            {searchResult && (
                <div className="animate-cute-pop motion-reduce:animate-none">
                    <div className="mb-2 ml-1 text-cute-sm font-extrabold text-cute-teal-600">{l.result}</div>
                    <div className={`cute-tone-${RACE_TONE[searchResult.race as Race]} flex items-center gap-3 rounded-cute-card bg-cute-teal-50 p-3 ring-2 ring-inset ring-cute-teal-400`}>
                        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full border-[3px] border-white bg-[color:var(--tone-50)] text-cute-xl font-black text-[color:var(--tone-600)] shadow-cute-1">
                            {searchResult.name[0]}
                        </span>
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1 text-cute-body font-extrabold text-cute-ink">
                                <span className="truncate">{searchResult.name}</span>
                                {searchResult.isVerified && (
                                  <UserCheck className="h-4 w-4 shrink-0 text-cute-success-600" strokeWidth={2.5} aria-label={l.verified} role="img" />
                                )}
                            </div>
                            <div className="cute-num text-cute-sm font-bold text-cute-ink-3">Lv.{searchResult.level} {searchResult.race.split('·')[0]}</div>
                        </div>
                        <button
                            type="button"
                            onClick={() => { onSpeak('friend_request_sent'); setSearchResult(null); }}
                            aria-label={l.addLabel(searchResult.name)}
                            className="cute-btn cute-btn-primary min-h-[48px] shrink-0 px-4 text-cute-body"
                        >
                            <UserPlus aria-hidden />
                            {l.add}
                        </button>
                    </div>
                </div>
            )}

            {/* Friends List */}
            {activeTab === 'MINE' && (
                <ul className="space-y-3">
                    {friends.map(friend => {
                        const online = friend.status === 'online';
                        return (
                        <li key={friend.id} className="flex items-center gap-3 rounded-cute-card bg-cute-panel p-3 shadow-cute-1 ring-1 ring-inset ring-cute-line">
                            {/* 头像贴纸 + 在线点：在线 = 成功绿实心点，离线 = 灰点；旁边另写状态文字，不只靠颜色 */}
                            <div className="relative shrink-0">
                                <img src={friend.avatarUrl} className="cute-avatar h-14 w-14" alt="" />
                                <span
                                  className={`absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full border-2 border-white ${online ? 'bg-cute-success-400' : 'bg-cute-line-input'}`}
                                  aria-hidden
                                />
                            </div>

                            {/* Info */}
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                    <span className="truncate text-cute-body font-extrabold text-cute-ink">{friend.name}</span>
                                    <span className="cute-chip cute-chip-sm cute-tone-sky shrink-0 cute-num">Lv.{friend.level}</span>
                                </div>
                                <div className="text-cute-sm font-bold">
                                    <span className={online ? 'text-cute-success-600' : 'text-cute-ink-3'}>
                                        {online ? t.friends_online : t.friends_offline}
                                    </span>
                                    {!online && friend.lastSeen && <span className="text-cute-ink-3"> · {l.lastSeen}</span>}
                                </div>
                                {/* 共鸣度：果冻进度条 + 等宽百分比 */}
                                <div className="mt-1 flex items-center gap-2">
                                    <span className="text-cute-sm font-bold text-cute-ink-3">{l.resonance}</span>
                                    <div
                                      className="cute-progress cute-tone-teal flex-1"
                                      role="progressbar"
                                      aria-valuemin={0}
                                      aria-valuemax={100}
                                      aria-valuenow={friend.resonance}
                                      aria-label={`${l.resonance} ${friend.resonance}%`}
                                    >
                                        <div className="cute-progress-fill" style={{ width: `${friend.resonance}%` }} />
                                    </div>
                                    <span className="cute-num w-10 text-right text-cute-sm text-cute-ink-2">{friend.resonance}%</span>
                                </div>
                            </div>

                            {/* Actions：视觉 40px，::after 把点击区撑到 48px */}
                            <div className="flex shrink-0 flex-col gap-2">
                                <button type="button" className="cute-icon-btn cute-icon-btn-sm shadow-cute-1" aria-label={l.message(friend.name)}>
                                    <MessageCircle aria-hidden />
                                </button>
                                <button type="button" className="cute-icon-btn cute-icon-btn-sm shadow-cute-1" aria-label={l.trust(friend.name)}>
                                    <Shield aria-hidden />
                                </button>
                            </div>
                        </li>
                        );
                    })}
                </ul>
            )}

            {activeTab === 'PENDING' && (
                <div className="flex flex-col items-center justify-center py-14 text-center">
                    <span className="mb-3 grid h-16 w-16 place-items-center rounded-full bg-cute-panel-2 text-cute-ink-3">
                        <Sparkles className="h-8 w-8" strokeWidth={2.25} aria-hidden />
                    </span>
                    <p className="text-cute-body font-bold text-cute-ink-2">{l.empty}</p>
                </div>
            )}

            {/* Sync Contacts Button：虚线边的次按钮，读成「可选的附加操作」 */}
            <div className="pb-1 pt-3">
                <button type="button" className="cute-btn cute-btn-secondary cute-btn-block border-dashed">
                    <Phone aria-hidden />
                    <span>{t.friends_sync_contacts}</span>
                    <ChevronRight aria-hidden />
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default FriendsBoard;
