
import React, { useEffect, useRef, useState } from 'react';
import { X, ShieldCheck, Coins, Crown, Users, Trash2, ChevronRight, Sparkles, Star, TrendingUp, Quote, BadgeCheck } from 'lucide-react';
import { User, Quest } from '../types';
import { RACE_CONFIG, PROFESSION_CONFIG } from '../constants';
import { RACE_TONE, PROFESSION_ICON } from './VerificationModal';

interface ProfileModalProps {
  user: User;
  onClose: () => void;
  onCreateQuest: (quest: Partial<Quest>) => boolean;
  onOpenProModal: () => void;
  // Define missing onOpenFriends prop
  onOpenFriends: () => void;
  /** 清除本设备上的全部档案。用户撤回同意的出口，不能藏起来。 */
  onResetProfile: () => void;
  /** 打开可选的实名信任认证 */
  onOpenTrustVerification: () => void;
  lang: 'zh' | 'en';
}

/*
 * 文案统一简体（风格指南 4 节末）：上一版这里混着「夥伴通訊錄」「申請職業獵人執照」等繁体，
 * 以及 Level / Trust / Gold / Race & Profession 这类全大写英文小标签，一并换掉。
 */
const COPY = {
  zh: {
    title: '个人档案',
    close: '关闭个人档案',
    level: '等级',
    trust: '信任',
    gold: '金币',
    raceProfession: '种族与职业',
    realSkill: '现实中：',
    friends: '伙伴通讯录',
    friendsSub: '查看好友在线状态与共鸣度',
    verified: '已完成信任认证',
    trustTitle: '信任认证',
    optional: '可选',
    trustSub: '参加需要核实身份的线下活动时才需要',
    pro: '申请职业猎人执照',
    proSub: '解锁专属徽章与高难度任务',
    proOwned: '职业猎人',
    dataNote: '你的档案与专属形象保存在这台设备上，不会上传到服务器。清除后将回到最初的告知页，形象需要重新生成。',
    clear: '清除本设备数据',
    cancel: '取消',
    confirmClear: '确认清除',
  },
  en: {
    title: 'Profile',
    close: 'Close profile',
    level: 'Level',
    trust: 'Trust',
    gold: 'Gold',
    raceProfession: 'Race & Profession',
    realSkill: 'In real life: ',
    friends: 'Contacts',
    friendsSub: 'See who is online and your resonance',
    verified: 'Trust verified',
    trustTitle: 'Trust Verification',
    optional: 'Optional',
    trustSub: 'Only needed for offline events that check identity',
    pro: 'Apply for a Pro License',
    proSub: 'Unlock the guild badge and harder quests',
    proOwned: 'Pro',
    dataNote: 'Your profile and avatar live on this device and are never uploaded. Clearing returns you to the consent page and the avatar must be rolled again.',
    clear: 'Clear device data',
    cancel: 'Cancel',
    confirmClear: 'Confirm clear',
  },
};

const ProfileModal: React.FC<ProfileModalProps> = ({
  user,
  onClose,
  onCreateQuest,
  onOpenProModal,
  onOpenFriends,
  onResetProfile,
  onOpenTrustVerification,
  lang
}) => {
  const t = COPY[lang];
  const raceInfo = RACE_CONFIG[user.race];
  const professionInfo = PROFESSION_CONFIG[user.profession];
  const ProfessionIcon = PROFESSION_ICON[user.profession];
  const [confirmingReset, setConfirmingReset] = useState(false);
  // 头像加载失败（或旧存档没有头像）时退回种族色圆章 + 名字首字，不让破图出现在名片上
  const [avatarBroken, setAvatarBroken] = useState(!user.avatarUrl);
  const [raceMain, raceTitle = ''] = user.race.split('·');

  /*
   * 打开时把焦点放进弹层（关闭钮），关闭时还给打开它的按钮：
   * 键盘与读屏用户不会被留在被遮住的地图上；Esc 在弹层内按下即关闭。
   * Esc 只在焦点位于本弹层时生效，叠在上面的信任认证 / 执照弹层各管各的，不会一按全关。
   */
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    closeRef.current?.focus({ preventScroll: true });
    return () => { if (prev && document.contains(prev)) prev.focus({ preventScroll: true }); };
  }, []);

  /*
   * 一行入口卡（好友、信任认证）的公共外观：白卡 + 左侧圆章 + 右侧箭头，整行都是点击区（≥ 64px 高）。
   */
  const rowBtn =
    'flex w-full min-h-[64px] items-center gap-3 rounded-cute-card bg-cute-panel px-4 py-3 text-left shadow-cute-1 ring-1 ring-inset ring-cute-line transition-[transform,box-shadow] duration-cute-fast active:scale-[0.98] focus-visible:outline-none focus-visible:shadow-cute-focus motion-reduce:transition-none motion-reduce:active:scale-100';

  return (
    <div
      className="cute-root fixed inset-0 z-[1300]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-title"
      data-testid="profile-modal"
      onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose(); } }}
    >
      {/* 遮罩点一下就关。它不是按钮（读屏不该读到两个「关闭」），键盘用户用关闭钮或 Esc */}
      <div className="cute-scrim" onClick={onClose} aria-hidden />

      {/*
        手机贴底抽屉；≥ 640px 时原语自动变成底部居中的悬浮卡片（风格指南 7.2）。
        艾琳娜入口（z-2100）永远浮在所有弹层之上：现版在左下、底边 48–104 px，风格指南定稿位置是底边 24–80 px + 安全区。
        手机抽屉底边距取 7.5rem + 安全区，两种位置下最后一个按钮滚到底时都在入口之上、不被它压住；桌面抽屉居中，碰不到它。
      */}
      <div className="cute-sheet max-sm:pb-[calc(7.5rem_+_var(--sab,0px))]">
        {/*
          关闭钮放在 DOM 最前：它是打开后的初始焦点，也是 QA 脚本「弹层里第一个按钮」的约定。
          吸顶：抽屉内容比屏幕长时，滚到下面也随时够得着；负下外边距抵掉这一行的高度，名片照旧从顶上排（右侧留了避让）。
        */}
        <div className="pointer-events-none sticky top-3 z-10 -mb-10 flex justify-end">
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label={t.close}
            className="cute-icon-btn cute-icon-btn-sm pointer-events-auto"
          >
            <X strokeWidth={2.5} aria-hidden />
          </button>
        </div>

        {/* 名片：种族色浅底 + 贴纸头像。名字用展示字体，ID 与数字用等宽数字 */}
        <div className={`cute-tone-${RACE_TONE[user.race]} mt-1 flex items-center gap-4 rounded-cute-lg bg-[color:var(--tone-50)] p-4 pr-14`}>
          <div className="relative shrink-0">
            {avatarBroken ? (
              <span className="cute-avatar grid h-20 w-20 place-items-center border-4 bg-white text-cute-2xl font-black text-[color:var(--tone-600)]" aria-hidden>
                {[...user.name][0] ?? '?'}
              </span>
            ) : (
              <img src={user.avatarUrl} onError={() => setAvatarBroken(true)} className="cute-avatar h-20 w-20 border-4" alt={user.name} />
            )}
            {user.isProMember && (
              <span className="absolute -right-1 -top-1 grid h-7 w-7 place-items-center rounded-full border-2 border-white bg-cute-sun-400 text-cute-sun-ink shadow-cute-1" title={t.proOwned}>
                <Crown className="h-4 w-4" strokeWidth={2.5} aria-hidden />
              </span>
            )}
          </div>
          <div className="min-w-0">
            <h2 id="profile-title" className="truncate text-cute-xl text-cute-ink">{user.name}</h2>
            <div className="mt-0.5 truncate text-cute-sm font-bold text-cute-ink-2">
              {raceMain}{raceTitle && <span className="text-cute-ink-3"> · {raceTitle}</span>}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              {user.isProMember && (
                <span className="cute-chip cute-chip-sm cute-tone-sun"><Crown aria-hidden />{t.proOwned}</span>
              )}
              <span className="cute-num text-cute-sm font-bold text-cute-ink-3">ID {user.id.slice(0, 8)}</span>
            </div>
          </div>
        </div>

        {/* 三格数值：等级（天蓝）/ 信任（成功绿）/ 金币（暖黄），图标 + 文字 + 数字三重编码 */}
        <div className="mt-3 grid grid-cols-3 gap-2">
          {[
            { tone: 'cute-tone-sky', Icon: Star, label: t.level, value: user.level },
            { tone: 'cute-tone-success', Icon: ShieldCheck, label: t.trust, value: user.trustScore },
            { tone: 'cute-tone-sun', Icon: Coins, label: t.gold, value: user.goldCoins },
          ].map(({ tone, Icon, label, value }) => (
            <div key={label} className={`${tone} rounded-cute-md bg-[color:var(--tone-50)] px-2 py-2.5 text-center`}>
              <div className="flex items-center justify-center gap-1 text-cute-sm font-bold text-cute-ink-2">
                <Icon className="h-4 w-4 text-[color:var(--tone-600)]" strokeWidth={2.5} aria-hidden />
                {label}
              </div>
              <div className="cute-num mt-0.5 text-cute-xl text-[color:var(--tone-600)]">{value}</div>
            </div>
          ))}
        </div>

        <div className="mt-4 space-y-3">
          <section className="rounded-cute-card p-4 ring-1 ring-inset ring-cute-line" aria-labelledby="profile-race-heading">
            <div id="profile-race-heading" className="mb-2 text-cute-sm font-extrabold text-cute-ink-2">{t.raceProfession}</div>
            <div className="flex flex-wrap items-center gap-2">
              <span className={`cute-chip cute-chip-dot cute-tone-${RACE_TONE[user.race]}`}>{raceMain}</span>
              <span className="cute-chip cute-tone-teal">
                <ProfessionIcon aria-hidden />
                {user.profession}
              </span>
              <span className="cute-chip cute-tone-sun">
                <TrendingUp aria-hidden />
                {raceInfo.buff}
              </span>
            </div>
            <div className="mt-2 text-cute-sm font-semibold text-cute-ink-2">
              {t.realSkill}{professionInfo.realSkill}
            </div>
            {user.bio && (
              <p className="cute-panel-inset mt-2 flex gap-2 text-cute-sm font-semibold text-cute-ink-2">
                <Quote className="mt-0.5 h-4 w-4 shrink-0 text-cute-ink-3" aria-hidden />
                <span>{user.bio}</span>
              </p>
            )}
          </section>

          <button type="button" onClick={onOpenFriends} className={rowBtn}>
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-cute-sky-50 text-cute-sky-600">
              <Users className="h-6 w-6" strokeWidth={2.25} aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-cute-body font-extrabold text-cute-ink">{t.friends}</span>
              <span className="block text-cute-sm font-semibold text-cute-ink-3">{t.friendsSub}</span>
            </span>
            <ChevronRight className="h-5 w-5 shrink-0 text-cute-ink-3" aria-hidden />
          </button>

          {/* 信任认证：可选，不做也能正常玩 */}
          {user.verified ? (
            <div className="flex min-h-[64px] items-center gap-3 rounded-cute-card bg-cute-success-50 px-4 py-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white text-cute-success-600 shadow-cute-1">
                <BadgeCheck className="h-6 w-6" strokeWidth={2.25} aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-cute-body font-extrabold text-cute-success-600">{t.verified}</span>
                <span className="cute-num block truncate text-cute-sm font-bold text-cute-ink-2">
                  {user.realName} · {user.idCardMasked}
                </span>
              </span>
            </div>
          ) : (
            <button type="button" onClick={onOpenTrustVerification} className={rowBtn}>
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-cute-success-50 text-cute-success-600">
                <ShieldCheck className="h-6 w-6" strokeWidth={2.25} aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-cute-body font-extrabold text-cute-ink">{t.trustTitle}</span>
                  <span className="cute-chip cute-chip-sm cute-tone-neutral">{t.optional}</span>
                </span>
                <span className="block text-cute-sm font-semibold text-cute-ink-3">{t.trustSub}</span>
              </span>
              <ChevronRight className="h-5 w-5 shrink-0 text-cute-ink-3" aria-hidden />
            </button>
          )}

          {/*
            执照入口是「奖励」类操作：暖黄底 + 深棕字（7.7:1，黄色上永远不放白字）+ 玩具厚边。
            整行是一个按钮，直接复用奖励按钮原语（厚边、按下下沉、焦点环、减少动效都现成），只把它撑成两行高的卡片形。
          */}
          {!user.isProMember && (
            <button
              type="button"
              onClick={onOpenProModal}
              className="cute-btn cute-btn-sun cute-btn-block min-h-[64px] justify-start gap-3 whitespace-normal rounded-cute-card px-4 py-3 text-left"
            >
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-white text-cute-sun-600 shadow-cute-1">
                <Crown className="h-6 w-6" strokeWidth={2.25} aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-cute-body font-extrabold">{t.pro}</span>
                <span className="block text-cute-sm font-bold">{t.proSub}</span>
              </span>
              <Sparkles className="h-5 w-5 shrink-0" aria-hidden />
            </button>
          )}

          {/* 本地数据管理：档案与形象都存在这台设备上，必须给用户一个清除入口 */}
          <div className="border-t border-cute-line pt-4">
            <p className="mb-3 text-cute-sm font-semibold text-cute-ink-3">{t.dataNote}</p>
            {!confirmingReset ? (
              <button
                type="button"
                onClick={() => setConfirmingReset(true)}
                className="cute-btn cute-btn-ghost cute-btn-block text-cute-coral-600"
              >
                <Trash2 aria-hidden />
                {t.clear}
              </button>
            ) : (
              // 二次确认：危险按钮在右（主操作位），取消在左；两个都是 48px 高
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setConfirmingReset(false)}
                  className="cute-btn cute-btn-secondary flex-1"
                >
                  {t.cancel}
                </button>
                <button
                  type="button"
                  onClick={onResetProfile}
                  className="cute-btn cute-btn-danger flex-1"
                >
                  <Trash2 aria-hidden />
                  {t.confirmClear}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileModal;
