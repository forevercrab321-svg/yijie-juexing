import React, { useState, useRef, useEffect, useMemo, useId } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Users, Send, X, Heart, MessageCircle, Image as ImageIcon, Film, Plus, Camera, Crown, Search, UserPlus, Check,
  Tent, Globe, Handshake, MapPin, Clock, Coins, ShieldCheck, CircleCheck, Lock, ArrowRight, MessagesSquare, Briefcase, Inbox,
} from 'lucide-react';
import { MOCK_POSTS, BRAND_MANIFESTO, MOCK_BRAND_OPPS, MOCK_GUILDS } from '../constants';
import { CommunityPost, Quest, User, PlayerGuild } from '../types';
import type { ElenaLineId } from '../lib/elena';
import { acceptBlock, type AcceptBlock } from '../lib/progression';
import { UI_STRINGS, int } from './world/ui/strings';
import { QUEST_ICON, QUEST_TYPE_EN, toneClass } from './world/ui/questVisual';
import { GuildMark } from './BountyBoard';

interface GuildBoardProps {
  onClose: () => void;
  lang: 'zh' | 'en';
  onAcceptUrgent: (questId: string) => void;
  urgentQuests: Quest[];
  currentUser: User;
  /** 触发艾琳娜的固定台词。台词内容由 lib/elena.ts 统一管理。 */
  onSpeak: (line: ElenaLineId) => void;
}

type Tab = 'GUILD' | 'WORLD' | 'ALLIANCES' | 'SQUADS';
type ChatMsg = { author: string; text: string; role?: 'sys' | 'user' | 'me' };

/*
  公会大厅自己的文案。上一版标签与标题取自 TRANSLATIONS（繁体），按钮与说明里还夹着整句英文
  （Accept Priority Contract、Establish Squad、LIVE FEED…）；风格指南 4 节要求统一简体，英文模式给完整英文。
  公会、帖子、品牌合作这些示例内容来自 constants.ts，是数据，不在这里改。
*/
const TEXT = {
  zh: {
    title: '冒险者公会',
    close: '关闭公会大厅',
    tabs: { GUILD: '大厅', SQUADS: '公会', WORLD: '世界', ALLIANCES: '合作' } as Record<Tab, string>,
    tablist: '公会大厅分区',
    urgent: '紧急委托',
    live: '实时',
    noUrgent: '现在没有紧急委托，城里一片太平。',
    acceptUrgent: '立即承接',
    chatTitle: '公会频道',
    online: (n: number) => `${n} 人在线`,
    chatPlaceholder: '在公会频道说点什么…',
    chatSend: '发送',
    chatInput: '公会频道消息',
    sysHello: '已连接公会频道。',
    seed: [
      { author: 'Mika', text: '有人看到我的长枪吗？我把它忘在酒馆了！' },
      { author: 'Theo', text: '又忘了？队长要生气了。' },
    ],
    replies: ['真的吗？', '第七区需要一位治疗师！', '哈哈', '有人要一起去迷宫吗？'],
    search: '搜索感兴趣的公会…',
    searchLabel: '搜索公会',
    create: '新建',
    createTitle: '建立公会',
    noGuild: (q: string) => `没有找到「${q}」相关的公会`,
    noGuildHint: '换个关键词，或者自己建一个吧。',
    leader: '会长',
    members: (n: number) => `${n} 名成员`,
    join: '申请加入',
    joined: '已加入',
    feedHint: '冒险者们的日常',
    post: '发布动态',
    like: '点赞',
    unlike: '取消点赞',
    comment: '评论',
    liked: (n: number) => `${n} 位冒险者觉得很赞`,
    composerTitle: '发布动态',
    cancel: '取消',
    publish: '发布',
    postPlaceholder: '嗨～分享一下今天遇到的趣事吧…',
    postLabel: '动态内容',
    photo: '照片',
    video: '视频',
    removeMedia: '移除附件',
    justNow: '刚刚',
    allianceTitle: '公会合作',
    allianceSub: '真实信任 · 不制造影响力',
    programs: '进行中的支持计划',
    proOnly: '会员专属',
    disclaimer: ['平台不处理任何付款，不雇佣参与者，所有参与均为自愿。', '品牌合作是赞助或装备支持计划，不是广告投放。'],
    guildName: '公会名称',
    guildNamePh: '例如：夜猫巡逻队',
    guildDesc: '公会宗旨',
    guildDescPh: '你们的公会想为城市做些什么？',
    createHint: '填写名称和宗旨后就可以建立了。',
    establish: '建立公会',
    newTags: ['新人', '创立'],
  },
  en: {
    title: "Adventurers' Guild",
    close: 'Close guild hall',
    tabs: { GUILD: 'Hall', SQUADS: 'Squads', WORLD: 'World', ALLIANCES: 'Brands' } as Record<Tab, string>,
    tablist: 'Guild hall sections',
    urgent: 'Urgent quests',
    live: 'Live',
    noUrgent: 'No urgent requests. Peace prevails.',
    acceptUrgent: 'Accept now',
    chatTitle: 'Guild channel',
    online: (n: number) => `${n} online`,
    chatPlaceholder: 'Say something to the guild…',
    chatSend: 'Send',
    chatInput: 'Guild channel message',
    sysHello: 'Connected to the guild channel.',
    seed: [
      { author: 'Mika', text: 'Has anyone seen my spear? I left it at the tavern!' },
      { author: 'Theo', text: 'Again? The captain is going to be mad.' },
    ],
    replies: ['Wait, really?', 'I need a healer at Sector 7!', 'lol', 'Anyone up for a dungeon run?'],
    search: 'Search for squads…',
    searchLabel: 'Search squads',
    create: 'New',
    createTitle: 'Create Squad',
    noGuild: (q: string) => `No squads match “${q}”`,
    noGuildHint: 'Try another keyword, or start your own.',
    leader: 'Leader',
    members: (n: number) => `${n} members`,
    join: 'Join',
    joined: 'Joined',
    feedHint: "Adventurers' daily life",
    post: 'New post',
    like: 'Like',
    unlike: 'Unlike',
    comment: 'Comment',
    liked: (n: number) => `${n} adventurers liked this`,
    composerTitle: 'New post',
    cancel: 'Cancel',
    publish: 'Post',
    postPlaceholder: 'Share your journey…',
    postLabel: 'Post text',
    photo: 'Photo',
    video: 'Video',
    removeMedia: 'Remove attachment',
    justNow: 'Just now',
    allianceTitle: 'Guild Alliances',
    allianceSub: 'Real trust · No fabricated influence',
    programs: 'Active support programs',
    proOnly: 'Pro only',
    disclaimer: ['The platform does not process payments or employ participants. All participation is voluntary.', 'Brand collaborations are sponsorship or equipment support programs, not advertising placements.'],
    guildName: 'Squad name',
    guildNamePh: 'e.g. Night Owls',
    guildDesc: 'Mission statement',
    guildDescPh: "What is your squad's purpose?",
    createHint: 'Fill in a name and a mission to create it.',
    establish: 'Create squad',
    newTags: ['New', 'Founded'],
  },
};

const TABS: Tab[] = ['GUILD', 'SQUADS', 'WORLD', 'ALLIANCES'];
const TAB_ICON: Record<Tab, LucideIcon> = { GUILD: Users, SQUADS: Tent, WORLD: Globe, ALLIANCES: Handshake };
/** 公会卡片横幅按顺序轮换的色调：只用界面强调色与委托色，横幅图片加载不出来时也是一块好看的波点布 */
const BANNER_TONES = ['cute-tone-teal', 'cute-tone-sky', 'cute-tone-sun', 'cute-tone-envoy', 'cute-tone-build', 'cute-tone-hunt'];
/** 世界动态顶部的玩具小镇：楼的位置、高度与配色（委托色的 50 / 400 档做墙与屋顶），纯 CSS，不用图片 */
const TOWN: [left: number, h: number, w: number, tone: string][] = [
  [6, 46, 30, 'cute-tone-sun'], [15, 64, 26, 'cute-tone-envoy'], [24, 38, 34, 'cute-tone-sky'],
  [62, 58, 28, 'cute-tone-build'], [71, 74, 24, 'cute-tone-hunt'], [80, 44, 32, 'cute-tone-teal'], [90, 56, 26, 'cute-tone-sun'],
];
const BLOCK_ICON: Record<'done' | 'level', LucideIcon> = { done: CircleCheck, level: Lock };

/*
  只放 Tailwind 工具类表达不了的：安全区、分段标签的状态、横幅与小镇的图形、行数截断、关键帧与减少动效。gb- 前缀。
  艾琳娜的入口常驻左下（z 2100，高于本面板），手机上滚动区底部多留一截、钉底按钮左侧让出它的位置。
*/
const GB_CSS = `
.gb-top { padding-top: var(--sat); background: var(--cute-panel); box-shadow: 0 1px 0 var(--cute-line), 0 6px 16px rgba(31, 45, 68, .06); position: relative; z-index: 1; }
.gb-pad { padding-left: calc(16px + var(--sal)); padding-right: calc(16px + var(--sar)); }
@media (min-width: 640px) { .gb-pad { padding-left: calc(24px + var(--sal)); padding-right: calc(24px + var(--sar)); } }
.gb-body { padding-top: 16px; padding-bottom: calc(96px + var(--sab)); }
@media (min-width: 640px) { .gb-body { padding-bottom: calc(40px + var(--sab)); } }
.gb-emblem { display: grid; place-items: center; width: 36px; height: 36px; flex: none; border: 2px solid #fff; border-radius: 50%; background: radial-gradient(circle at 50% 28%, var(--cute-teal-600) 0%, var(--cute-teal-700) 52%, var(--cute-sky-600) 100%); box-shadow: 0 2px 0 var(--cute-teal-800), var(--cute-shadow-1); }
.gb-emblem > svg { width: 20px; height: 20px; }
.gb-tabs { background: var(--cute-panel-3); border-radius: 999px; padding: 4px; }
.gb-tab { display: flex; align-items: center; justify-content: center; gap: 6px; min-height: 44px; min-width: 0; padding: 0 8px; border: 0; border-radius: 999px; background: transparent; color: var(--cute-ink-2); font: 800 var(--cute-fs-sm)/1 var(--cute-font); white-space: nowrap; cursor: pointer; -webkit-tap-highlight-color: transparent; transition: background-color var(--cute-dur-fast) linear, color var(--cute-dur-fast) linear, box-shadow var(--cute-dur-fast) linear; }
.gb-tab > svg { width: 18px; height: 18px; flex: none; }
.gb-tab[aria-selected='true'] { background: var(--cute-panel); color: var(--cute-teal-600); box-shadow: var(--cute-shadow-1); }
.gb-tab:focus-visible { outline: none; box-shadow: var(--cute-focus-ring); }
@media (hover: hover) { .gb-tab:hover:not([aria-selected='true']) { color: var(--cute-ink); background: rgba(255, 255, 255, .6); } }
/* 窄屏放不下「图标 + 词」时先去掉图标：中文两个字在 360px 以下才挤，英文单词更长，420px 以下就去掉 */
@media (max-width: 359.98px) { .gb-tab > svg { display: none; } }
@media (max-width: 419.98px) { .gb-tabs-en .gb-tab > svg { display: none; } }
.gb-banner { position: relative; height: 88px; overflow: hidden; background-color: var(--tone-400); background-image: radial-gradient(circle, rgba(255, 255, 255, .28) 1.6px, transparent 2.2px); background-size: 14px 14px; }
.gb-banner > img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.gb-crest { display: grid; place-items: center; width: 56px; height: 56px; margin-top: -28px; border: 4px solid #fff; border-radius: 50%; background: var(--tone-50); color: var(--tone-600); font: 900 22px/1 var(--cute-font-display); box-shadow: var(--cute-shadow-1); position: relative; }
.gb-hero { position: relative; height: 172px; overflow: hidden; border-radius: 0 0 var(--cute-r-xl) var(--cute-r-xl); background:
  radial-gradient(34px 16px at 16% 26%, #fff 96%, transparent), radial-gradient(26px 18px at 22% 20%, #fff 96%, transparent), radial-gradient(30px 14px at 27% 28%, #fff 96%, transparent),
  radial-gradient(40px 18px at 72% 18%, #fff 96%, transparent), radial-gradient(28px 18px at 79% 12%, #fff 96%, transparent),
  linear-gradient(180deg, var(--cute-sky-400) 0%, var(--cute-sky-50) 92%); }
.gb-hero::after { content: ''; position: absolute; left: -12%; right: -12%; bottom: -46px; height: 96px; border-radius: 50% 50% 0 0; background: var(--quest-build-400); box-shadow: 0 -10px 0 rgba(255, 255, 255, .35); }
.gb-house { position: absolute; bottom: 28px; z-index: 1; border-radius: 10px 10px 4px 4px; background: var(--tone-50); box-shadow: inset 0 -6px 0 rgba(31, 45, 68, .06); }
.gb-house::before { content: ''; position: absolute; left: -3px; right: -3px; top: -8px; height: 14px; border-radius: 8px; background: var(--tone-400); }
.gb-house::after { content: ''; position: absolute; left: 50%; top: 14px; width: 8px; height: 10px; margin-left: -4px; border-radius: 4px; background: var(--cute-sky-400); opacity: .7; }
.gb-clamp2 { display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; }
.gb-foot { padding-bottom: calc(16px + var(--sab)); }
@media (max-width: 639.98px) { .gb-foot { padding-left: calc(84px + var(--sal)); } }
.gb-fade { animation: cute-fade-in var(--cute-dur-base) linear both; }
.gb-overlay { animation: cute-sheet-up var(--cute-dur-sheet) var(--cute-ease-out) both; }
.cute-card-head .cute-chip.gb-urgent { padding-left: 3px; color: var(--cute-coral-600); }
.gb-like[aria-pressed='true'] { color: var(--cute-coral-600); }
.gb-like[aria-pressed='true'] svg { fill: currentColor; }
@media (prefers-reduced-motion: reduce) { .gb-fade, .gb-overlay { animation: cute-fade-in 150ms linear both; } .gb-tab { transition: none; } }
`;

/** 头像：有图用图，没有图就是首字母贴纸（上一版的占位图来自 via.placeholder.com，第三方请求且常常打不开） */
const Avatar: React.FC<{ src?: string; name: string; className?: string }> = ({ src, name, className = 'h-11 w-11' }) => {
  const [bad, setBad] = useState(false);
  return src && !bad ? (
    <img src={src} alt="" onError={() => setBad(true)} className={`cute-avatar ${className}`} />
  ) : (
    <span aria-hidden="true" className={`cute-avatar grid place-items-center bg-cute-teal-50 font-black text-cute-teal-600 ${className}`}>
      {[...name][0] ?? '?'}
    </span>
  );
};

/** 公会横幅：图片能加载就显示，加载失败（或根本没有）就露出底下的色调波点布 */
const Banner: React.FC<{ src?: string; tone: string }> = ({ src, tone }) => {
  const [bad, setBad] = useState(false);
  return (
    <div className={`gb-banner ${tone}`} aria-hidden="true">
      {src && !bad && <img src={src} alt="" loading="lazy" onError={() => setBad(true)} />}
    </div>
  );
};

const GuildBoard: React.FC<GuildBoardProps> = ({ onClose, lang, onAcceptUrgent, urgentQuests, currentUser, onSpeak }) => {
  const [activeTab, setActiveTab] = useState<Tab>('GUILD');
  const [posts, setPosts] = useState<CommunityPost[]>(MOCK_POSTS);
  const tx = TEXT[lang];
  const t = UI_STRINGS[lang];
  const uid = useId();

  // Guilds State
  const [guildList, setGuildList] = useState<PlayerGuild[]>(MOCK_GUILDS);
  const [guildSearch, setGuildSearch] = useState('');
  const [joinedGuilds, setJoinedGuilds] = useState<string[]>(MOCK_GUILDS.filter(g => g.isJoined).map(g => g.id));

  // Create Guild Modal State
  const [showCreateGuild, setShowCreateGuild] = useState(false);
  const [newGuildName, setNewGuildName] = useState('');
  const [newGuildDesc, setNewGuildDesc] = useState('');

  // Create Post State
  const [showComposer, setShowComposer] = useState(false);
  const [newPostText, setNewPostText] = useState('');
  const [newPostMedia, setNewPostMedia] = useState<{type: 'image' | 'video', url: string} | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Chat State
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>(() => [
    { author: 'System', text: tx.sysHello, role: 'sys' },
    ...tx.seed.map((m) => ({ ...m, role: 'user' as const })),
  ]);
  // 在线人数只在打开时取一次：上一版写在渲染里，每打一个字都跳一次数字
  const [onlineCount] = useState(() => Math.floor(Math.random() * 5000) + 1000);
  const chatBox = useRef<HTMLDivElement>(null);

  /*
    聊天贴底。上一版用 scrollIntoView，它会连带滚动外层的整页滚动区——一打开大厅，页面就被拽到聊天室底部。
    直接改聊天框自己的 scrollTop，只动它一个。
  */
  useEffect(() => {
    const el = chatBox.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chatMessages, activeTab]);

  /*
    语音输入去掉了。上一版这里用浏览器的 webkitSpeechRecognition：Chrome 会把录音传到云端识别，
    违反项目「不接云端语音识别、音频不离开设备」的约束（CLAUDE.md、lib/agent/stt.ts）。
    要恢复语音输入，应接 lib/agent/stt.ts 里注册的本地引擎，与艾琳娜对话框用同一条路。
  */

  const triggerFileUpload = (type: 'image' | 'video') => {
      if (fileInputRef.current) {
          fileInputRef.current.accept = type === 'video' ? 'video/*' : 'image/*';
          fileInputRef.current.click();
      }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          const type = file.type.startsWith('video') ? 'video' : 'image';
          const url = URL.createObjectURL(file);
          setNewPostMedia({ type, url });
          setShowComposer(true); // Ensure composer is open
      }
      // 允许连续选同一个文件：不清空的话第二次选择不会触发 change
      e.target.value = '';
  };

  const closeComposer = () => { setShowComposer(false); setNewPostMedia(null); setNewPostText(''); };

  const handleCreatePost = () => {
      if (!newPostText.trim() && !newPostMedia) return;

      const post: CommunityPost = {
          id: Date.now().toString(),
          author: currentUser.name || 'Anonymous',
          avatar: currentUser.avatarUrl,
          content: newPostText,
          timestamp: tx.justNow,
          likes: 0,
          isUrgent: false,
          mediaType: newPostMedia?.type,
          mediaUrl: newPostMedia?.url,
          comments: []
      };

      setPosts([post, ...posts]);
      setNewPostText('');
      setNewPostMedia(null);
      setShowComposer(false);
      setActiveTab('WORLD');
  };

  const handleLike = (postId: string) => {
      setPosts(prev => prev.map(p => {
          if (p.id === postId) {
              return {
                  ...p,
                  likes: p.isLiked ? p.likes - 1 : p.likes + 1,
                  isLiked: !p.isLiked
              };
          }
          return p;
      }));
  };

  const handleSendChat = () => {
      if(!chatInput.trim()) return;
      setChatMessages(prev => [...prev, { author: currentUser.name || 'Me', text: chatInput, role: 'me' }]);
      setChatInput('');

      // 模拟其他成员的回应（示例数据，名字是通用的冒险者名）
      setTimeout(() => {
           const randomResp = tx.replies[Math.floor(Math.random() * tx.replies.length)];
           const randomUser = ['Rin', 'Juno', 'Kai', 'Noa'][Math.floor(Math.random() * 4)];
           setChatMessages(prev => [...prev, { author: randomUser, text: randomResp, role: 'user' }]);
      }, 2000);
  };

  const toggleGuildJoin = (guildId: string) => {
      if (joinedGuilds.includes(guildId)) {
          setJoinedGuilds(prev => prev.filter(id => id !== guildId));
          onSpeak('guild_left');
      } else {
          setJoinedGuilds(prev => [...prev, guildId]);
          onSpeak('guild_joined');
      }
  };

  const createGuild = () => {
      if (!newGuildName || !newGuildDesc) return;
      const newGuild: PlayerGuild = {
          id: `new-${Date.now()}`,
          name: newGuildName,
          description: newGuildDesc,
          leader: currentUser.name,
          memberCount: 1,
          level: 1,
          isJoined: true,
          tags: tx.newTags,
          // 不再给新公会挂一张第三方图床的横幅：横幅退到色调波点布，不产生额外的外部请求
          bannerUrl: undefined,
      };
      setGuildList([newGuild, ...guildList]);
      setJoinedGuilds([...joinedGuilds, newGuild.id]);
      setShowCreateGuild(false);
      setNewGuildName('');
      setNewGuildDesc('');
      onSpeak('guild_created');
  };

  /*
    紧急委托能不能接，规则只有一份：lib/progression 的 acceptBlock（App 的 acceptQuest 兜底用的也是它）。
    大厅拿不到进行中的委托，所以这里只会得到「已完成 / 等级不足」；手上有别的委托时，App 点下去会拦并说明。
  */
  const blockOf = (q: Quest): AcceptBlock | null => acceptBlock(currentUser, q, null);

  // ── 焦点与键盘 ──────────────────────────────────────────────
  // 打开时焦点落在当前标签上，关闭时还给打开前的元素；Esc 先关最上层的弹层，再关大厅
  const tabRefs = useRef<Partial<Record<Tab, HTMLButtonElement | null>>>({});
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    tabRefs.current[activeTab]?.focus({ preventScroll: true });
    return () => { if (prev && prev.isConnected) prev.focus({ preventScroll: true }); };
    // 只在挂载时取一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const escRef = useRef<() => void>(() => {});
  escRef.current = () => {
    if (showComposer) closeComposer();
    else if (showCreateGuild) setShowCreateGuild(false);
    else onClose();
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (e.key !== 'Escape' || e.defaultPrevented || (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      e.preventDefault();
      escRef.current();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);
  /** 标签页的方向键导航（WAI-ARIA tabs）：左右切换、Home / End 到两端 */
  const onTabKey = (e: React.KeyboardEvent) => {
    const i = TABS.indexOf(activeTab);
    const next =
      e.key === 'ArrowRight' ? TABS[(i + 1) % TABS.length]
      : e.key === 'ArrowLeft' ? TABS[(i - 1 + TABS.length) % TABS.length]
      : e.key === 'Home' ? TABS[0]
      : e.key === 'End' ? TABS[TABS.length - 1]
      : null;
    if (!next) return;
    e.preventDefault();
    setActiveTab(next);
    tabRefs.current[next]?.focus();
  };

  const filteredGuilds = useMemo(
    () => guildList.filter(g => g.name.toLowerCase().includes(guildSearch.trim().toLowerCase())),
    [guildList, guildSearch],
  );
  const sm = lang === 'zh' ? ' cute-chip-sm' : '';
  const panelId = `${uid}-panel`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={`${uid}-title`}
      data-testid="guild-board"
      className="cute-root cute-page fixed inset-0 z-[1100] flex flex-col overflow-hidden"
    >
      <style>{GB_CSS}</style>

      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        onChange={handleFileUpload}
        aria-hidden="true"
        tabIndex={-1}
      />

      {/* ── 顶栏：公会徽记 + 标题 + （世界页）发帖 + 关闭；下面是四个分区的分段标签 ── */}
      <div className="gb-top shrink-0">
        <div className="gb-pad mx-auto flex h-14 w-full max-w-3xl items-center gap-3">
          <span className="gb-emblem" aria-hidden="true"><GuildMark /></span>
          <h2 id={`${uid}-title`} className="m-0 min-w-0 flex-1 truncate text-cute-xl">{tx.title}</h2>
          {activeTab === 'WORLD' && (
            <button type="button" data-testid="guild-compose" onClick={() => setShowComposer(true)} className="cute-icon-btn" aria-label={tx.post} title={tx.post}>
              <Plus strokeWidth={2.5} aria-hidden="true" />
            </button>
          )}
          <button type="button" data-testid="guild-close" onClick={onClose} className="cute-icon-btn" aria-label={tx.close} title={tx.close}>
            <X strokeWidth={2.5} aria-hidden="true" />
          </button>
        </div>
        <div className="gb-pad mx-auto w-full max-w-3xl pb-3">
          <div role="tablist" aria-label={tx.tablist} onKeyDown={onTabKey} className={`gb-tabs grid grid-cols-4 gap-1${lang === 'en' ? ' gb-tabs-en' : ''}`}>
            {TABS.map((id) => {
              const Icon = TAB_ICON[id];
              const on = activeTab === id;
              return (
                <button
                  key={id}
                  ref={(el) => { tabRefs.current[id] = el; }}
                  type="button"
                  role="tab"
                  id={`${uid}-tab-${id}`}
                  aria-selected={on}
                  aria-controls={panelId}
                  tabIndex={on ? 0 : -1}
                  data-testid={`guild-tab-${id.toLowerCase()}`}
                  onClick={() => setActiveTab(id)}
                  className="gb-tab"
                >
                  <Icon strokeWidth={2.5} aria-hidden="true" />
                  {tx.tabs[id]}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── 内容区 ── */}
      <div
        data-testid="guild-scroll"
        id={panelId}
        role="tabpanel"
        aria-labelledby={`${uid}-tab-${activeTab}`}
        className="scroll-touch min-h-0 flex-1 overflow-y-auto"
      >

          {/* --- 大厅：紧急委托 + 公会频道 --- */}
          {activeTab === 'GUILD' && (
              <div key="GUILD" className="gb-pad gb-body gb-fade mx-auto flex w-full max-w-3xl flex-col gap-6">
                  <section aria-labelledby={`${uid}-urgent`}>
                      <div className="mb-3 flex items-center justify-between gap-2">
                          <h3 id={`${uid}-urgent`} className="m-0 flex items-center gap-2 text-cute-xl">
                            {/* 标题里的「!」不跳：每张紧急卡上已经有一个在跳，满屏都跳就成了噪音 */}
                            <span className="cute-badge-bang [animation:none]" aria-hidden="true">!</span>
                            {tx.urgent}
                            <span className="cute-chip cute-tone-coral cute-num">{urgentQuests.length}</span>
                          </h3>
                          <span className="cute-chip cute-chip-sm cute-chip-dot cute-tone-success">{tx.live}</span>
                      </div>

                      {urgentQuests.length === 0 ? (
                          <div className="cute-panel flex items-center gap-3 text-cute-sm text-cute-ink-3">
                              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-cute-success-50 text-cute-success-600"><Check strokeWidth={3} size={20} aria-hidden="true" /></span>
                              {tx.noUrgent}
                          </div>
                      ) : (
                          <ul className="m-0 grid list-none gap-4 p-0 sm:grid-cols-2">
                              {urgentQuests.map(quest => {
                                  const block = blockOf(quest);
                                  const TypeIcon = QUEST_ICON[quest.type] ?? MapPin;
                                  const BlockIcon = block === 'done' || block === 'level' ? BLOCK_ICON[block] : null;
                                  const reason = block === 'done' ? t.whyDone : block === 'level' ? t.whyLevel(quest.minLevel, int(currentUser.level)) : null;
                                  const reasonId = `${uid}-why-${quest.id}`;
                                  return (
                                    <li key={quest.id} className="min-w-0">
                                      <article
                                        data-testid="guild-urgent-card"
                                        data-quest-id={quest.id}
                                        className={`cute-card flex h-full flex-col ${toneClass(quest.type)}${block === 'done' ? ' is-done' : block === 'level' ? ' is-locked' : ''}`}
                                      >
                                          <div className="cute-card-head gap-2.5">
                                              <span className="cute-card-medal" aria-hidden="true"><TypeIcon strokeWidth={2.5} /></span>
                                              <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
                                                  <span className="cute-chip">{lang === 'en' ? QUEST_TYPE_EN[quest.type] ?? quest.type : quest.type}</span>
                                                  {block !== 'done' && (
                                                    <span className="cute-chip gb-urgent gap-1.5"><span className="cute-badge-bang" aria-hidden="true">!</span>{t.urgent}</span>
                                                  )}
                                              </div>
                                          </div>
                                          <div className="cute-card-body flex flex-1 flex-col gap-2">
                                              <h4 className="m-0 text-cute-lg text-cute-ink [overflow-wrap:anywhere]">{quest.title}</h4>
                                              <p className="gb-clamp2 m-0 text-cute-sm font-semibold text-cute-ink-2">{quest.description}</p>
                                              <p className="m-0 flex flex-wrap items-center gap-x-3 gap-y-1 text-cute-sm text-cute-ink-3">
                                                  <span className="inline-flex min-w-0 items-center gap-1"><MapPin size={16} strokeWidth={2.5} className="shrink-0" aria-hidden="true" />{quest.locationName}</span>
                                                  <span className="inline-flex items-center gap-1"><Clock size={16} strokeWidth={2.5} className="shrink-0" aria-hidden="true" />{t.minutes(quest.estimatedTime)}</span>
                                              </p>
                                              {reason && BlockIcon && (
                                                <p id={reasonId} className={`m-0 flex items-start gap-2 rounded-cute-sm px-3 py-2.5 text-cute-sm font-extrabold ${block === 'done' ? 'cute-tone-success' : 'cute-tone-warn'} bg-[var(--tone-50)] text-[color:var(--tone-600)]`}>
                                                  <BlockIcon size={16} strokeWidth={2.5} className="mt-0.5 shrink-0" aria-hidden="true" />
                                                  <span>{reason}</span>
                                                </p>
                                              )}
                                          </div>
                                          <div className="cute-card-foot flex-wrap gap-y-2.5">
                                              <span className="cute-chip cute-chip-sm cute-num cute-tone-sun" title={t.gold}><Coins strokeWidth={2.5} aria-hidden="true" />+{int(quest.rewardGold)}</span>
                                              <span className="cute-chip cute-chip-sm cute-num cute-tone-success" title={t.trust}><ShieldCheck strokeWidth={2.5} aria-hidden="true" />+{int(quest.trustPoints)}</span>
                                              {/*
                                                接取走 App 的 handleAccept（onAcceptUrgent → handleAccept），这里不做任何判断。
                                                接不了的照样能点：App 会关掉大厅、聚焦这个委托、在卡片上写明原因；这里只提前把原因摆出来。
                                              */}
                                              <button
                                                  type="button"
                                                  data-testid="guild-urgent-accept"
                                                  data-blocked={block ? 'true' : 'false'}
                                                  aria-describedby={reason ? reasonId : undefined}
                                                  onClick={() => { onAcceptUrgent(quest.id); onClose(); }}
                                                  className={block
                                                    ? 'cute-btn cute-btn-secondary ml-auto px-4 text-cute-ink-2'
                                                    : 'cute-btn cute-btn-primary ml-auto min-h-[48px] rounded-cute-md px-5 text-cute-body'}
                                              >
                                                  {BlockIcon ? <BlockIcon strokeWidth={2.5} aria-hidden="true" /> : null}
                                                  {block === 'done' ? t.done : block === 'level' ? t.needLv(quest.minLevel) : tx.acceptUrgent}
                                                  {!block && <ArrowRight strokeWidth={2.5} aria-hidden="true" />}
                                              </button>
                                          </div>
                                      </article>
                                    </li>
                                  );
                              })}
                          </ul>
                      )}
                  </section>

                  {/* 公会频道 */}
                  <section className="cute-card flex h-[26rem] flex-col" aria-labelledby={`${uid}-chat`}>
                      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-cute-line px-4 py-3">
                          <h3 id={`${uid}-chat`} className="m-0 flex items-center gap-2 text-cute-lg font-black">
                              <MessagesSquare size={20} strokeWidth={2.5} className="text-cute-teal-600" aria-hidden="true" /> {tx.chatTitle}
                          </h3>
                          <span className="cute-chip cute-chip-dot cute-tone-success cute-num">{tx.online(onlineCount)}</span>
                      </div>

                      <div ref={chatBox} className="flex flex-1 flex-col gap-3 overflow-y-auto bg-cute-panel-2 px-3 py-3">
                          {chatMessages.map((msg, idx) => msg.role === 'sys' ? (
                              <p key={idx} className="m-0 self-center rounded-full bg-cute-panel-3 px-3 py-1 text-cute-sm text-cute-ink-3">{msg.text}</p>
                          ) : (
                              <div key={idx} className={`flex max-w-[85%] flex-col ${msg.role === 'me' ? 'items-end self-end' : 'items-start self-start'}`}>
                                  <span className={`mb-1 px-1 text-cute-sm ${msg.role === 'me' ? 'text-cute-teal-600' : 'text-cute-ink-2'}`}>{msg.author}</span>
                                  <div className={`whitespace-pre-wrap break-words rounded-[20px] px-3.5 py-2 text-cute-body ${
                                      msg.role === 'me'
                                      ? 'rounded-tr-md bg-cute-teal-600 font-bold text-white'
                                      : 'rounded-tl-md border border-cute-line bg-cute-panel text-cute-ink'
                                  }`}>
                                      {msg.text}
                                  </div>
                              </div>
                          ))}
                      </div>

                      <div className="flex shrink-0 items-end gap-2 border-t border-cute-line p-3 pb-3.5">
                          <input
                             value={chatInput}
                             onChange={(e) => setChatInput(e.target.value)}
                             onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && handleSendChat()}
                             className="cute-input flex-1"
                             placeholder={tx.chatPlaceholder}
                             aria-label={tx.chatInput}
                          />
                          <button
                             type="button"
                             onClick={handleSendChat}
                             disabled={!chatInput.trim()}
                             className="cute-btn cute-btn-primary h-12 min-h-[48px] w-12 shrink-0 rounded-cute-md px-0"
                             aria-label={tx.chatSend}
                          >
                              <Send strokeWidth={2.5} aria-hidden="true" />
                          </button>
                      </div>
                  </section>
              </div>
          )}

          {/* --- 公会列表 --- */}
          {activeTab === 'SQUADS' && (
              <div key="SQUADS" className="gb-pad gb-body gb-fade mx-auto flex w-full max-w-3xl flex-col gap-4">
                  <div className="flex gap-2">
                      <label className="relative min-w-0 flex-1">
                          <span className="sr-only">{tx.searchLabel}</span>
                          <Search size={20} strokeWidth={2.5} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-cute-ink-3" aria-hidden="true" />
                          <input
                              type="search"
                              value={guildSearch}
                              onChange={(e) => setGuildSearch(e.target.value)}
                              placeholder={tx.search}
                              className="cute-input pl-11"
                          />
                      </label>
                      <button
                        type="button"
                        data-testid="guild-create-open"
                        onClick={() => setShowCreateGuild(true)}
                        className="cute-btn cute-btn-primary min-h-[48px] shrink-0 rounded-cute-md px-4 text-cute-body"
                      >
                          <Plus strokeWidth={2.5} aria-hidden="true" />{tx.create}
                      </button>
                  </div>

                  {filteredGuilds.length === 0 ? (
                      <div className="flex flex-col items-center gap-2 py-10 text-center">
                          <span className="grid h-16 w-16 place-items-center rounded-full bg-cute-panel text-cute-ink-3 shadow-cute-1"><Inbox size={28} strokeWidth={2.25} aria-hidden="true" /></span>
                          <p className="m-0 text-cute-lg text-cute-ink">{tx.noGuild(guildSearch.trim())}</p>
                          <p className="m-0 text-cute-sm text-cute-ink-3">{tx.noGuildHint}</p>
                      </div>
                  ) : (
                      <ul className="m-0 grid list-none gap-4 p-0 sm:grid-cols-2">
                          {filteredGuilds.map((guild) => {
                              const isJoined = joinedGuilds.includes(guild.id);
                              const tone = BANNER_TONES[Math.max(0, guildList.indexOf(guild)) % BANNER_TONES.length];
                              return (
                                  <li key={guild.id} className={`cute-card flex flex-col ${tone}`}>
                                      <Banner src={guild.bannerUrl} tone={tone} />
                                      <div className="flex flex-1 flex-col gap-2 px-4 pb-4">
                                          <span className="gb-crest" aria-hidden="true">{[...guild.name][0]}</span>
                                          <h3 className="m-0 text-cute-xl [overflow-wrap:anywhere]">{guild.name}</h3>
                                          <div className="flex flex-wrap gap-1.5">
                                              <span className="cute-chip cute-tone-sun cute-num">Lv{int(guild.level)}</span>
                                              <span className="cute-chip cute-num"><Users strokeWidth={2.5} aria-hidden="true" />{tx.members(int(guild.memberCount))}</span>
                                          </div>
                                          <p className="gb-clamp2 m-0 text-cute-sm font-semibold text-cute-ink-2">{guild.description}</p>
                                          <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0">
                                              {guild.tags.map(tag => (
                                                  <li key={tag} className={`cute-chip${sm}`}>#{tag}</li>
                                              ))}
                                          </ul>
                                      </div>
                                      <div className="cute-card-foot flex-wrap gap-y-2">
                                          <span className="min-w-0 truncate text-cute-sm text-cute-ink-3">
                                              {tx.leader} <b className="font-extrabold text-cute-ink">{guild.leader}</b>
                                          </span>
                                          <button
                                              type="button"
                                              aria-pressed={isJoined}
                                              onClick={() => toggleGuildJoin(guild.id)}
                                              className={isJoined
                                                ? 'cute-btn cute-btn-secondary ml-auto px-4'
                                                : 'cute-btn cute-btn-primary ml-auto min-h-[48px] rounded-cute-md px-5 text-cute-body'}
                                          >
                                              {isJoined
                                                ? <><Check strokeWidth={3} aria-hidden="true" />{tx.joined}</>
                                                : <><UserPlus strokeWidth={2.5} aria-hidden="true" />{tx.join}</>}
                                          </button>
                                      </div>
                                  </li>
                              );
                          })}
                      </ul>
                  )}
              </div>
          )}

          {/* --- 品牌合作 --- */}
          {activeTab === 'ALLIANCES' && (
              <div key="ALLIANCES" className="gb-pad gb-body gb-fade mx-auto flex w-full max-w-3xl flex-col gap-5">
                  <div className="cute-panel flex flex-col items-center gap-2 text-center">
                      <span className="grid h-14 w-14 place-items-center rounded-full bg-cute-sun-50 text-cute-sun-600"><Handshake size={28} strokeWidth={2.25} aria-hidden="true" /></span>
                      <h3 className="m-0 text-cute-2xl">{tx.allianceTitle}</h3>
                      <p className="m-0 text-cute-sm text-cute-ink-3">{tx.allianceSub}</p>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                      {BRAND_MANIFESTO.map((item, idx) => (
                          <div
                            key={idx}
                            className={item.highlight
                              ? 'cute-tone-sun rounded-cute-lg border-2 border-[color:var(--tone-400)] bg-[var(--tone-50)] p-5'
                              : 'cute-panel'}
                          >
                              <h4 className={`m-0 mb-2 text-cute-sm font-black ${item.highlight ? 'text-cute-sun-600' : 'text-cute-ink-2'}`}>{item.title}</h4>
                              <p className="m-0 text-cute-body text-cute-ink">{item.content}</p>
                          </div>
                      ))}
                  </div>

                  <section aria-labelledby={`${uid}-programs`}>
                      <h3 id={`${uid}-programs`} className="m-0 mb-3 flex items-center gap-2 text-cute-lg font-black">
                          <ShieldCheck size={20} strokeWidth={2.5} className="text-cute-success-600" aria-hidden="true" />
                          {tx.programs}
                      </h3>
                      <ul className="m-0 flex list-none flex-col gap-3 p-0">
                          {MOCK_BRAND_OPPS.map(opp => (
                              <li key={opp.id} className="cute-panel flex gap-4 !p-4">
                                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-cute-teal-50 text-cute-teal-600">
                                      {opp.type === 'EQUIPMENT' ? <Camera size={24} strokeWidth={2.25} aria-hidden="true" /> : <Briefcase size={24} strokeWidth={2.25} aria-hidden="true" />}
                                  </span>
                                  <div className="min-w-0 flex-1">
                                      <div className="flex flex-wrap items-center justify-between gap-2">
                                          <span className="text-cute-sm font-black text-cute-teal-600">{opp.brandName}</span>
                                          {opp.isProOnly && (
                                              <span className={`cute-chip cute-tone-sun${sm}`}><Crown strokeWidth={2.5} aria-hidden="true" />{tx.proOnly}</span>
                                          )}
                                      </div>
                                      <h4 className="m-0 mb-1 mt-0.5 text-cute-body font-black text-cute-ink">{opp.title}</h4>
                                      <p className="gb-clamp2 m-0 text-cute-sm font-semibold text-cute-ink-2">{opp.description}</p>
                                  </div>
                              </li>
                          ))}
                      </ul>
                  </section>

                  <div className="cute-panel-inset flex flex-col gap-1.5 text-center text-cute-sm text-cute-ink-3">
                      {tx.disclaimer.map((line) => <p key={line} className="m-0">{line}</p>)}
                  </div>
              </div>
          )}

          {/* --- 世界动态 --- */}
          {activeTab === 'WORLD' && (
              <div key="WORLD" className="gb-fade">
                  {/* 顶部是一座纯 CSS 的玩具小镇（晴空 + 云 + 草坡 + 粉彩小楼），与 3D 世界同一种天气；上一版这里是一张暗色的哥特城堡夜景图 */}
                  <div className="mx-auto w-full max-w-3xl sm:px-6">
                      <div className="gb-hero" aria-hidden="true">
                          {TOWN.map(([left, h, w, tone], i) => (
                              <span key={i} className={`gb-house ${tone}`} style={{ left: `${left}%`, height: h, width: w }} />
                          ))}
                      </div>
                  </div>
                  <div className="gb-pad gb-body mx-auto flex w-full max-w-3xl flex-col gap-4 !pt-0">
                      {/* 头像探进横幅下沿（-36px），名字整块落在横幅之下：压在草坡上的深色字读不清 */}
                      <div className="relative z-[2] -mt-9 flex items-start gap-3">
                          <Avatar src={currentUser.avatarUrl} name={currentUser.name || '?'} className="h-[72px] w-[72px] !border-4" />
                          <div className="min-w-0 pt-[42px]">
                              <div className="flex items-center gap-2">
                                  <span className="truncate text-cute-lg text-cute-ink">{currentUser.name}</span>
                                  <span className="cute-chip cute-chip-sm cute-tone-sun cute-num shrink-0">Lv{int(currentUser.level)}</span>
                              </div>
                              <p className="m-0 text-cute-sm text-cute-ink-3">{tx.feedHint}</p>
                          </div>
                      </div>

                      <ul className="m-0 flex list-none flex-col gap-4 p-0">
                          {posts.map(post => (
                              <li key={post.id} className="cute-panel flex gap-3 !p-4">
                                  <Avatar src={post.avatar} name={post.author} />
                                  <div className="min-w-0 flex-1">
                                      <div className="flex items-baseline justify-between gap-2">
                                          <span className="truncate text-cute-body font-black text-cute-ink">{post.author}</span>
                                          <span className="shrink-0 text-cute-sm text-cute-ink-3">{post.timestamp}</span>
                                      </div>
                                      <p className="m-0 mt-1 whitespace-pre-wrap break-words text-cute-body text-cute-ink">{post.content}</p>

                                      {post.mediaUrl && (
                                          <div className="mt-3 max-w-sm overflow-hidden rounded-cute-md border border-cute-line bg-cute-panel-2">
                                              {post.mediaType === 'video' ? (
                                                  <video src={post.mediaUrl} controls className="block h-auto max-h-64 w-full object-cover" />
                                              ) : (
                                                  <img src={post.mediaUrl} alt="" loading="lazy" className="block h-auto max-h-64 w-full object-cover" />
                                              )}
                                          </div>
                                      )}

                                      <div className="-ml-3 mt-1 flex items-center gap-1">
                                           <button
                                              type="button"
                                              aria-pressed={!!post.isLiked}
                                              aria-label={post.isLiked ? tx.unlike : tx.like}
                                              onClick={() => handleLike(post.id)}
                                              className="gb-like cute-btn cute-btn-ghost min-h-[44px] px-3"
                                           >
                                               <Heart strokeWidth={2.5} aria-hidden="true" />
                                               {post.likes > 0 && <span className="cute-num">{post.likes}</span>}
                                           </button>
                                           <button type="button" className="cute-btn cute-btn-ghost min-h-[44px] px-3" aria-label={tx.comment}>
                                               <MessageCircle strokeWidth={2.5} aria-hidden="true" />
                                               {post.comments.length > 0 && <span className="cute-num">{post.comments.length}</span>}
                                           </button>
                                      </div>

                                      {(post.comments.length > 0 || post.likes > 0) && (
                                          <div className="cute-panel-inset mt-1 text-cute-sm">
                                              {post.likes > 0 && (
                                                  <div className={`flex items-center gap-1.5 font-extrabold text-cute-coral-600 ${post.comments.length ? 'mb-2 border-b border-cute-line pb-2' : ''}`}>
                                                      <Heart size={16} strokeWidth={2.5} className="fill-current" aria-hidden="true" />
                                                      <span>{tx.liked(post.likes)}</span>
                                                  </div>
                                              )}
                                              <div className="flex flex-col gap-1.5">
                                                  {post.comments.map(comment => (
                                                      <p key={comment.id} className="m-0">
                                                          <b className="font-extrabold text-cute-teal-600">{comment.author}{t.colon}</b>
                                                          <span className="text-cute-ink-2">{comment.content}</span>
                                                      </p>
                                                  ))}
                                              </div>
                                          </div>
                                      )}
                                  </div>
                              </li>
                          ))}
                      </ul>
                  </div>
              </div>
          )}
      </div>

      {/* ── 发帖（全屏弹层）── */}
      {showComposer && (
          <div data-testid="guild-composer" role="dialog" aria-modal="true" aria-labelledby={`${uid}-composer`} className="cute-page gb-overlay absolute inset-0 z-[1200] flex flex-col">
              <div className="gb-top shrink-0">
                  <div className="gb-pad mx-auto flex h-14 w-full max-w-3xl items-center gap-2">
                      <button type="button" data-testid="guild-composer-cancel" onClick={closeComposer} className="cute-btn cute-btn-ghost shrink-0 px-3">{tx.cancel}</button>
                      <h3 id={`${uid}-composer`} className="m-0 min-w-0 flex-1 truncate text-center text-cute-lg font-black">{tx.composerTitle}</h3>
                      <button
                        type="button"
                        onClick={handleCreatePost}
                        disabled={!newPostText.trim() && !newPostMedia}
                        className="cute-btn cute-btn-primary min-h-[44px] shrink-0 rounded-cute-md px-5 text-cute-body"
                      >
                          {tx.publish}
                      </button>
                  </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto">
                  <div className="gb-pad gb-body mx-auto flex w-full max-w-3xl flex-col gap-3">
                      <textarea
                        value={newPostText}
                        onChange={e => setNewPostText(e.target.value)}
                        className="cute-input !min-h-[160px]"
                        placeholder={tx.postPlaceholder}
                        aria-label={tx.postLabel}
                        autoFocus
                      />
                      {/* 附件按钮放在输入框正下方而不是贴底的工具栏：屏幕左下角常驻着艾琳娜的入口，贴底会被她挡住 */}
                      <div className="flex gap-2">
                          <button type="button" onClick={() => triggerFileUpload('image')} className="cute-btn cute-btn-secondary">
                              <ImageIcon strokeWidth={2.5} aria-hidden="true" />{tx.photo}
                          </button>
                          <button type="button" onClick={() => triggerFileUpload('video')} className="cute-btn cute-btn-secondary">
                              <Film strokeWidth={2.5} aria-hidden="true" />{tx.video}
                          </button>
                      </div>

                      {newPostMedia && (
                          <div className="relative w-fit max-w-full overflow-hidden rounded-cute-md border border-cute-line bg-cute-panel-2">
                              {newPostMedia.type === 'video' ? (
                                  <video src={newPostMedia.url} className="block h-40 w-auto max-w-full" controls />
                              ) : (
                                  <img src={newPostMedia.url} alt="" className="block h-40 w-auto max-w-full" />
                              )}
                              <button
                                type="button"
                                onClick={() => setNewPostMedia(null)}
                                className="cute-icon-btn cute-icon-btn-sm absolute right-2 top-2"
                                aria-label={tx.removeMedia}
                              >
                                  <X strokeWidth={2.5} aria-hidden="true" />
                              </button>
                          </div>
                      )}
                  </div>
              </div>
          </div>
      )}

      {/* ── 建立公会（全屏弹层）── */}
      {showCreateGuild && (
          <div data-testid="guild-create" role="dialog" aria-modal="true" aria-labelledby={`${uid}-create`} className="cute-page gb-overlay absolute inset-0 z-[1200] flex flex-col">
              <div className="gb-top shrink-0">
                  <div className="gb-pad mx-auto flex h-14 w-full max-w-3xl items-center gap-3">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-cute-sky-50 text-cute-sky-600"><Tent size={20} strokeWidth={2.5} aria-hidden="true" /></span>
                      <h3 id={`${uid}-create`} className="m-0 min-w-0 flex-1 truncate text-cute-xl">{tx.createTitle}</h3>
                      <button type="button" data-testid="guild-create-close" onClick={() => setShowCreateGuild(false)} className="cute-icon-btn" aria-label={tx.cancel} title={tx.cancel}>
                          <X strokeWidth={2.5} aria-hidden="true" />
                      </button>
                  </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto">
                  <div className="gb-pad mx-auto flex w-full max-w-xl flex-col gap-5 py-6">
                      <div>
                          <label htmlFor={`${uid}-gname`} className="cute-field-label">{tx.guildName}</label>
                          <input
                              id={`${uid}-gname`}
                              value={newGuildName}
                              onChange={e => setNewGuildName(e.target.value)}
                              className="cute-input"
                              placeholder={tx.guildNamePh}
                              autoFocus
                          />
                      </div>
                      <div>
                          <label htmlFor={`${uid}-gdesc`} className="cute-field-label">{tx.guildDesc}</label>
                          <textarea
                              id={`${uid}-gdesc`}
                              value={newGuildDesc}
                              onChange={e => setNewGuildDesc(e.target.value)}
                              className="cute-input"
                              placeholder={tx.guildDescPh}
                          />
                      </div>
                  </div>
              </div>

              {/* 主按钮钉底；不能点时在它上方写出原因，而不只是变灰 */}
              <div className="gb-foot gb-pad shrink-0 pt-2">
                  <div className="mx-auto w-full max-w-xl">
                      {(!newGuildName || !newGuildDesc) && <p className="cute-field-hint m-0 mb-2 text-center">{tx.createHint}</p>}
                      <button
                          type="button"
                          data-testid="guild-create-submit"
                          onClick={createGuild}
                          disabled={!newGuildName || !newGuildDesc}
                          className="cute-btn cute-btn-primary cute-btn-block"
                      >
                          {tx.establish}
                      </button>
                  </div>
              </div>
          </div>
      )}

    </div>
  );
};

export default GuildBoard;
