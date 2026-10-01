
import React, { useState, useEffect, useCallback, useRef, Suspense, lazy } from 'react';
import { Quest, User } from './types';
import { INITIAL_QUESTS } from './constants';
import BountyBoard from './components/BountyBoard';
import VerificationModal from './components/VerificationModal';
import ConsentGate, { ConsentState } from './components/ConsentGate';
import ActiveQuestHUD from './components/ActiveQuestHUD';
import ProofSubmission from './components/ProofSubmission';
import ProfileModal from './components/ProfileModal';
import GuildBoard from './components/GuildBoard';
import ProMembershipModal from './components/ProMembershipModal';
import FriendsBoard from './components/FriendsBoard';
import TrustVerification from './components/TrustVerification';
import ElenaChat from './components/ElenaChat';
import TopHud from './components/world/ui/TopHud';
import WorldControls from './components/world/ui/WorldControls';
import QuestFocusCard from './components/world/ui/QuestFocusCard';
import SettlementToast from './components/world/ui/SettlementToast';
import { UI_STRINGS } from './components/world/ui/strings';
import { useReducedMotion } from './components/world/ui/useReducedMotion';
// scene/ 里只有 worldEvents 允许静态 import：它零依赖、不带 three。其余一律走下面的 React.lazy
import { worldEvents, isInWorld } from './components/world/scene/worldEvents';
import { Terminal as TerminalIcon, Users, MapPinOff, Lock } from 'lucide-react';
import { useElenaVoice } from './hooks/useElenaVoice';
import { useElenaAgent } from './hooks/useElenaAgent';
import type { ToolContext } from './lib/agent/tools';
import { watchLocation, distanceMeters, GeoStatus, GeoFix } from './lib/geo';
import { loadSession, saveSession, clearSession } from './lib/storage';
import {
  normalizeProgress,
  settleQuest,
  levelProgress,
  questMagicules,
  acceptBlock,
  type AcceptBlock,
  type Settlement,
} from './lib/progression';

/*
 * 两张地图都按需加载。
 * 3D 世界整体是一个分包，three 只存在于那里：同意页、觉醒页不渲染它，也就不会请求它。
 * 2D 回退（Leaflet 约 47 KB gzip）同样拆出去——只有 WebGL 不可用或玩家手动切 2D 时才用得上，
 * 而且不拆的话，加上新界面与成长逻辑，入口包会超出 520 KB 的预算。
 */
const WorldMap = lazy(() => import('./components/world/scene/WorldMap'));
const MapBoard = lazy(() => import('./components/MapBoard'));

type Lang = 'zh' | 'en';
type MapMode = '3d' | '2d';

/**
 * WebGL2 预检。three r180 只支持 WebGL2，所以查 webgl2 而不是 webgl；用完立刻归还上下文，
 * 不占浏览器的上下文名额。结果缓存在模块里，并且只在主界面第一次渲染时才做——
 * 同意页与觉醒页用不到 3D，没必要为它在首屏起一个图形上下文。
 */
let webgl2Probe: boolean | null = null;
function canUseWebGL2(): boolean {
  if (webgl2Probe !== null) return webgl2Probe;
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    webgl2Probe = !!gl;
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    webgl2Probe = false;
  }
  return webgl2Probe;
}

/** 回退原因码 → 给玩家看的一句话。原因码本身只进日志与调试，不上界面。 */
function fallbackText(reason: string, lang: Lang): string {
  const zh = lang === 'zh';
  if (reason === 'webgl2-unavailable') {
    return zh ? '此设备不支持 WebGL2，已使用 2D 地图' : 'WebGL2 is not available on this device; using the 2D map';
  }
  if (reason === 'webgl-context-lost') {
    return zh ? '图形上下文丢失，已切换到 2D 地图' : 'The graphics context was lost; switched to the 2D map';
  }
  return zh ? '3D 世界启动失败，已切换到 2D 地图' : 'The 3D world failed to start; switched to the 2D map';
}

/** 与艾琳娜（lib/agent/tools.ts）同一个格式，玩家在卡片上和在对话里听到的距离是同一个数 */
function formatDistance(meters: number, lang: Lang): string {
  const m = Math.round(meters);
  if (lang === 'en') return m < 1000 ? `${m} m` : `${(m / 1000).toFixed(1)} km`;
  return m < 1000 ? `${m} 公尺` : `${(m / 1000).toFixed(1)} 公里`;
}

/**
 * 「回到我」不可用的原因。按玩家能做什么来分：没授权 → 去授权；被拒 → 去系统设置；
 * 没信号 → 等一等；不在纽约 → 世界只覆盖曼哈顿一带（大多数测试者都在这一档）。
 */
function locationHintText(
  lang: Lang,
  consentLocation: boolean,
  geoStatus: GeoStatus,
  hasFix: boolean,
  inWorld: boolean,
): string | undefined {
  const zh = lang === 'zh';
  if (!consentLocation) return zh ? '未授权定位，无法回到你的位置' : 'Location not authorized';
  if (geoStatus === 'denied') return zh ? '定位权限被拒绝，无法回到你的位置' : 'Location permission denied';
  if (geoStatus === 'unavailable') return zh ? '暂无定位信号，无法回到你的位置' : 'No location signal';
  if (!hasFix) return zh ? '正在获取定位…' : 'Locating…';
  if (!inWorld) return zh ? '你目前不在纽约范围内' : 'You are outside the New York area';
  return undefined;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

interface LazyBoundaryProps {
  onError?: (err: unknown) => void;
  fallback?: React.ReactNode;
  children?: React.ReactNode;
}

/**
 * 分包加载失败（断网、发版后旧文件名失效）或地图渲染期抛错时的兜底。
 * React.lazy 的失败会一路抛到最近的错误边界；没有边界，整个 App 会被卸载成白屏——
 * 对伴随地图来说，「3D 起不来就退回 2D」远好过「什么都没有」。
 */
class LazyBoundary extends React.Component {
  declare props: LazyBoundaryProps;
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(err: unknown) {
    this.props.onError?.(err);
  }

  render() {
    return this.state.failed ? this.props.fallback ?? null : this.props.children;
  }
}

/**
 * 3D 分包下载期间的加载画面。底色与世界画布同一块墨色，切过去没有白闪；
 * 纸纹 + 慢转的金色符文环是界面已有的语言，不另造一套。
 */
const WorldLoading: React.FC<{ lang: Lang }> = ({ lang }) => {
  const reduced = useReducedMotion();
  return (
    <div
      data-testid="world-loading"
      role="status"
      aria-live="polite"
      className="absolute inset-0 z-0 flex flex-col items-center justify-center gap-5 parchment-noise"
      style={{ background: 'radial-gradient(ellipse at 50% 46%, #2e2820 0%, #1c1815 72%)' }}
    >
      <svg
        width="72"
        height="72"
        viewBox="0 0 72 72"
        aria-hidden="true"
        className={reduced ? undefined : 'animate-[spin_4s_linear_infinite]'}
        style={{ color: 'var(--gold)' }}
      >
        <circle cx="36" cy="36" r="31" fill="none" stroke="currentColor" strokeOpacity="0.32" strokeWidth="1" />
        <circle cx="36" cy="36" r="23" fill="none" stroke="currentColor" strokeWidth="1.25" strokeDasharray="2 5" />
        {[0, 90, 180, 270].map((deg) => (
          <rect key={deg} x="33.5" y="2.5" width="5" height="5" fill="currentColor" transform={`rotate(${deg} 36 36) rotate(45 36 5)`} />
        ))}
      </svg>
      <p className="fantasy-font text-sm tracking-widest" style={{ color: 'var(--parchment-dim)' }}>
        {lang === 'zh' ? '世界正在苏醒…' : 'The world is awakening…'}
      </p>
    </div>
  );
};

const App: React.FC = () => {
  // 档案存在本设备上。专属形象一次生成、长期保留，不会每次打开都重画。
  const [restored] = useState(() => loadSession());
  const [consent, setConsent] = useState<ConsentState | null>(restored?.consent ?? null);
  /*
   * 读档时整理一次成长字段：老档案魔素恒为 0、等级却可能 > 1（旧逻辑每次 +1 级），也没有已完成记录。
   * 迁移结果由下面「档案有变动就落盘」的 effect 在挂载时存回去，所以迁移只发生一次；
   * 已规范的档案原样返回同一个引用，不会引起额外渲染。
   */
  const [user, setUser] = useState<User | null>(() => (restored?.user ? normalizeProgress(restored.user) : null));
  // 必须是稳定引用：3D 引擎按引用判断委托是否变化，每次渲染都新建数组会让光柱每帧重建
  const [quests] = useState<Quest[]>(INITIAL_QUESTS);
  const [activeQuestId, setActiveQuestId] = useState<string | null>(null);
  const [focusedQuestId, setFocusedQuestId] = useState<string | null>(null);
  const [showBountyBoard, setShowBountyBoard] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showGuildBoard, setShowGuildBoard] = useState(false);
  const [showProModal, setShowProModal] = useState(false);
  const [showFriends, setShowFriends] = useState(false);
  const [showProof, setShowProof] = useState(false);
  const [showTrustVerification, setShowTrustVerification] = useState(false);
  const [showElenaChat, setShowElenaChat] = useState(false);
  const [lang, setLang] = useState<Lang>('zh');
  const [startTime, setStartTime] = useState<number | null>(null);
  const [isAutoNav, setIsAutoNav] = useState(false);

  // 地图模式。默认 3D；WebGL2 预检不通过、或 3D 运行中失败时落到 2D。手动选择不跨刷新记忆（简报 3.2）
  const [mapMode, setMapMode] = useState<MapMode>('3d');
  /**
   * 3D 为什么不可用（原因码）。retryable 只给上下文丢失这类瞬时故障：手机切后台、GPU 重置之后，
   * 玩家可以再点一次 3D 试试；初始化失败、分包加载失败重试也没用，切换按钮就锁住并写明原因。
   */
  const [worldFailure, setWorldFailure] = useState<{ reason: string; retryable: boolean } | null>(null);
  /**
   * 本次结算，交给 SettlementToast 演出。必须放在 state 里：组件按对象引用判断「是不是新的一次结算」，
   * 渲染时现算会让它每次渲染都重演、永远收不起来。标题要当场记下——结算后进行中的委托就清空了。
   */
  const [settled, setSettled] = useState<{ settlement: Settlement; title: string } | null>(null);
  // 2D 下接取被拦时的一句说明（3D 下由聚焦卡片说明，不需要它）
  const [notice, setNotice] = useState<string | null>(null);

  // 真实定位。不再使用写死的坐标——任务到场校验依赖它。
  const [geoFix, setGeoFix] = useState<GeoFix | null>(null);
  const [geoStatus, setGeoStatus] = useState<GeoStatus>('idle');

  /*
   * 这几个值会在异步回调里被读到：提交证明的计时器、艾琳娜对话流中途的工具调用、同一帧里的连点。
   * 闭包快照会读到旧值（例如连点两次「承接」时第二次还以为手上没有委托），所以经 ref 读最新的。
   */
  const userRef = useRef(user);
  userRef.current = user;
  const activeIdRef = useRef(activeQuestId);
  activeIdRef.current = activeQuestId;
  const modeRef = useRef<MapMode>('3d');

  // 語音：固定台词走预生成音频，动态内容才实时合成。见 lib/elena.ts
  const {
    isSpeaking: isElenaSpeaking,
    expression: elenaExpression,
    speakLine,
    enqueueSpeech,
    stop: stopElenaSpeech,
    setExpression: setElenaExpression,
  } = useElenaVoice();
  const speakLineRef = useRef(speakLine);
  speakLineRef.current = speakLine;

  useEffect(() => {
    if (!user || !consent?.location) return;
    setGeoStatus('watching');
    return watchLocation(
      (fix) => {
        // 拿到定位就说明信号恢复了：超时（曼哈顿楼群里很常见）之后 watchPosition 会继续回报，
        // 不把状态复位，「当前无法获取定位信号」的告知条就会和实时距离同时挂在屏幕上，永远不消失（QA-R1-04）
        setGeoStatus('watching');
        setGeoFix(fix);
      },
      (status) => {
        setGeoStatus(status);
        setGeoFix(null);
      },
    );
    // 只关心「有没有档案」，不关心档案内容：结算会换一个 user 对象，不该因此重启定位监听
  }, [!!user, consent?.location]);

  // 档案有变动就落盘。形象、等级、金币、已完成的委托都在这里被记住。
  useEffect(() => {
    if (consent && user) saveSession(consent, user);
  }, [consent, user]);

  useEffect(() => {
    if (showBountyBoard) speakLine('greeting');
  }, [showBountyBoard, speakLine]);

  useEffect(() => {
    if (!notice) return;
    const id = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(id);
  }, [notice]);

  /** 清除本设备档案并回到最初的告知页。这是用户撤回同意的唯一出口，必须始终可达。 */
  const handleResetProfile = () => {
    clearSession();
    setUser(null);
    setConsent(null);
    setActiveQuestId(null);
    setFocusedQuestId(null);
    setStartTime(null);
    setShowProof(false);
    setSettled(null);
    setNotice(null);
    setShowProfile(false);
  };

  /** 接取被拦时给玩家的说明，与聚焦卡片的禁用原因同一套文案 */
  const blockReasonText = (block: AcceptBlock, quest: Quest, u: User): string => {
    const t = UI_STRINGS[lang];
    if (block === 'active') return t.whyActive;
    if (block === 'done') return t.whyDone;
    if (block === 'busy') return t.whyBusy(quests.find((q) => q.id === activeIdRef.current)?.title);
    return t.whyLevel(quest.minLevel, u.level);
  };

  /**
   * 签下契约。所有接取入口（聚焦卡片、2D 弹窗、契约终端、公会紧急委托、艾琳娜的工具）都只走这一条路。
   *
   * silent 是给艾琳娜自己用的：她通过 accept_quest 工具接取时，会用自己的话
   * 说明接了什么、在哪、多远。这时候再插一句预生成的固定台词，
   * 等于把她说到一半的话掐断，听起来像两个人在抢麦。
   */
  const acceptQuest = (quest: Quest, opts?: { silent?: boolean }) => {
    const u = userRef.current;
    if (!u) return;

    // 兜底：契约终端、公会紧急委托、2D 弹窗的「承接」按钮自己都不校验门槛。
    // 结算变成真的之后，绕过等级门槛接到高阶委托就等于绕过了可靠性门槛，接已完成的委托则白跑一趟。
    const block = acceptBlock(u, quest, activeIdRef.current);
    if (block) {
      // 关掉终端、把它设为聚焦委托：3D 下卡片会写明原因；2D 没有卡片，补一句说明
      setShowBountyBoard(false);
      setFocusedQuestId(quest.id);
      if (modeRef.current === '2d') setNotice(blockReasonText(block, quest, u));
      return;
    }

    activeIdRef.current = quest.id;
    setActiveQuestId(quest.id);
    setStartTime(Date.now());
    setIsAutoNav(false);
    setShowBountyBoard(false);
    setNotice(null);
    // 接取后关卡片：镜头随之回到「框住玩家与目标」，顶部出现进行中的委托
    setFocusedQuestId(null);
    if (!opts?.silent) speakLine('contract_signed');
    // 放在这里而不是卡片的回调里：艾琳娜用工具接取（silent）时，光柱同样有冲击波（简报 5.3）
    worldEvents.emit({ type: 'pulse', questId: quest.id });
  };

  const handleAccept = (quest: Quest) => acceptQuest(quest);

  /**
   * 提交证明通过后的结算。
   *
   * 引用保持稳定：ProofSubmission 的「评定 → 结算」计时器以 onConfirm 为依赖，
   * 每次渲染都换一个新函数，计时器就会被重置——定位一更新、App 一重绘，结算就一直往后推。
   * 数据经 ref 读最新值，所以稳定引用也不会读到旧档案。
   */
  const handleProofConfirmed = useCallback(() => {
    const u = userRef.current;
    const quest = quests.find((q) => q.id === activeIdRef.current);
    if (!u || !quest) return;

    const s = settleQuest(u, quest);
    // 先改 ref：万一同一帧里被调用两次，第二次找不到进行中的委托，不会再演一次结算
    userRef.current = s.user;
    activeIdRef.current = null;

    setShowProof(false);
    setActiveQuestId(null);
    setStartTime(null);
    setIsAutoNav(false);
    // s.user 已经带上金币、信任、魔素、贡献、等级与 completedQuestIds，不要再手动改任何成长字段
    setUser(s.user);
    setSettled({ settlement: s, title: quest.title });
    if (s.leveledUp) worldEvents.emit({ type: 'celebrate' });
    speakLineRef.current('mission_complete');
  }, [quests]);

  /** 3D 世界报告自己起不来（或运行中丢了上下文）：切到 2D，并记住原因给世界控件展示 */
  const handleWorldFallback = useCallback((reason: string) => {
    console.warn('[world] 3D 世界不可用，切换到 2D 地图：', reason);
    setWorldFailure({ reason, retryable: reason === 'webgl-context-lost' });
    setMapMode('2d');
  }, []);

  /**
   * 工具执行时看到的世界。
   *
   * 放进 ref 每次渲染刷新，而不是靠 useCallback 的依赖数组——
   * 工具是在异步的对话流中途被调用的，闭包快照会让她读到几秒前的等级和任务状态。
   */
  const worldRef = useRef<ToolContext | null>(null);
  worldRef.current = user
    ? {
        quests,
        user,
        activeQuestId,
        userLocation: geoFix?.coords ?? null,
        // 已完成的 + 进行中的。她对已完成的委托会回答「已经不在了」，不会再推荐一次
        closedQuestIds: [...(user.completedQuestIds ?? []), ...(activeQuestId ? [activeQuestId] : [])],
        onFocus: (q) => setFocusedQuestId(q.id),
        onAccept: (q) => acceptQuest(q, { silent: true }),
      }
    : null;

  const elena = useElenaAgent({
    getWorld: useCallback(() => worldRef.current!, []),
    enqueueSpeech,
    stopSpeech: stopElenaSpeech,
    setExpression: setElenaExpression,
  });

  if (!consent) {
    return <ConsentGate lang={lang} onAccept={setConsent} />;
  }

  if (!user) {
    return (
      <VerificationModal
        onComplete={(data) => {
          setUser({
            id: 'u-' + crypto.randomUUID().slice(0, 9),
            name: data.name,
            race: data.race,
            profession: data.profession,
            level: 1,
            magicules: 0,
            bio: data.bio,
            // 实名认证不再是入门条件，需要时在个人档案里补
            verified: false,
            avatarUrl: data.avatarUrl,
            trustScore: 100,
            goldCoins: 0,
            guildContribution: 0,
            // 从第一天起就带着完成记录，存档一开始就是完整的
            completedQuestIds: [],
          });
        }}
        lang={lang}
      />
    );
  }

  // ── 主界面 ──────────────────────────────────────────────────────────────

  const webgl2 = canUseWebGL2();
  const canUse3d = webgl2 && !(worldFailure && !worldFailure.retryable);
  const mode: MapMode = canUse3d ? mapMode : '2d';
  modeRef.current = mode;
  const fallbackReason = !webgl2 ? 'webgl2-unavailable' : worldFailure?.reason ?? null;

  const toggleMode = () => {
    if (mode === '3d') {
      setMapMode('2d');
      return;
    }
    if (!canUse3d) return;
    setWorldFailure(null);
    setMapMode('3d');
  };

  const activeQuest = quests.find((q) => q.id === activeQuestId) ?? null;
  const focusedQuest = focusedQuestId ? quests.find((q) => q.id === focusedQuestId) ?? null : null;
  const completedIds = user.completedQuestIds ?? [];
  const userLocation = geoFix?.coords ?? null;
  // 与场景内部用的是同一个判定：不在世界范围内就不放角色，「回到我」也随之禁用
  const inWorld = isInWorld(userLocation);
  const cardOpen = mode === '3d' && focusedQuest !== null;
  const showLocationBanner = !consent.location || geoStatus === 'denied' || geoStatus === 'unavailable';

  return (
    // 高度用 dvh：手机浏览器地址栏展开时 100vh 比可见区域高，右下的契约终端会沉到工具栏底下
    <div className="relative w-full h-screen bg-slate-950 overflow-hidden" style={{ height: '100dvh' }}>
      {mode === '3d' ? (
        <LazyBoundary key="world-3d" onError={(err) => handleWorldFallback(`world-load-failed: ${errorMessage(err)}`)}>
          <Suspense fallback={<WorldLoading lang={lang} />}>
            <WorldMap
              quests={quests}
              activeQuestId={activeQuestId}
              focusedQuestId={focusedQuestId}
              // 点光柱只聚焦、开卡片；接取由卡片走 handleAccept（艾琳娜确认）
              onFocus={(q: Quest) => setFocusedQuestId(q.id)}
              userLocation={userLocation}
              userRace={user.race}
              onFallback={handleWorldFallback}
              userAccuracy={geoFix?.accuracy ?? null}
              completedQuestIds={user.completedQuestIds}
              userLevel={user.level}
            />
          </Suspense>
        </LazyBoundary>
      ) : (
        <LazyBoundary
          key="map-2d"
          fallback={
            <div role="alert" className="absolute inset-0 z-0 flex items-center justify-center p-6 text-center text-sm text-slate-300">
              {lang === 'zh' ? '2D 地图加载失败，请检查网络后刷新页面。' : 'The 2D map failed to load. Check your connection and reload.'}
            </div>
          }
        >
          <Suspense fallback={<div data-testid="map-loading" className="absolute inset-0 z-0" style={{ background: '#d9cbb0' }} />}>
            <MapBoard
              quests={quests}
              activeQuestId={activeQuestId}
              focusedQuestId={focusedQuestId}
              onFocus={(q: Quest) => setFocusedQuestId(q.id)}
              onAccept={handleAccept}
              userLocation={userLocation}
            />
          </Suspense>
        </LazyBoundary>
      )}

      {/*
        顶栏：左边是档案铭牌（取代原先只有头像 + 名字的档案块），右边是公会与语言。
        叠在 3D 画布上的面板都加 wui-flat 关掉 backdrop-filter：画布每帧重绘，毛玻璃就要每帧重算一次模糊，
        而面板本身约 95% 不透明，模糊几乎看不出来，白白耗电（简报支柱 P4）。
      */}
      <div className="absolute top-[env(safe-area-inset-top)] left-0 right-0 p-4 z-[1000] pointer-events-none flex justify-between items-start">
         <TopHud
           name={user.name}
           race={user.race}
           avatarUrl={user.avatarUrl}
           level={user.level}
           progressRatio={levelProgress(user.magicules).ratio}
           trustScore={user.trustScore}
           goldCoins={user.goldCoins}
           onOpenProfile={() => setShowProfile(true)}
           lang={lang}
         />
         <div className="flex flex-col gap-2">
           <button
             onClick={() => setShowGuildBoard(true)}
             aria-label={lang === 'zh' ? '公会' : 'Guild'}
             className="pointer-events-auto w-12 h-12 rune-panel wui-flat rounded-xl flex items-center justify-center text-amber-400 active:scale-95 transition-all duration-300"
           >
              <Users className="w-5 h-5" />
           </button>
           <button
             aria-label={lang === 'zh' ? '切换语言' : 'Switch language'}
             className="pointer-events-auto w-12 h-12 rune-panel wui-flat rounded-xl flex items-center justify-center text-slate-400 active:scale-95 transition-all duration-300"
             onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}
           >
              <span className="text-xs font-bold uppercase tracking-widest">{lang}</span>
           </button>
         </div>
      </div>

      {/*
        顶部告知区：定位告知条 + 2D 下接取被拦的说明，纵向堆叠。
        有进行中的委托时整体挪到 ActiveQuestHUD 下方——原先告知条（5.5rem）与 HUD（5rem 起）会叠在一起。
        HUD 的按钮加高到 44 px 触控目标之后（QA-R1-09），HUD 底边约在 11.6rem，这里随之下移到 12.25rem。
      */}
      {(showLocationBanner || notice) && (
        <div
          className="absolute left-4 right-4 z-[960] pointer-events-none flex flex-col gap-2"
          style={{ top: `calc(${activeQuest ? '12.25rem' : '5.5rem'} + env(safe-area-inset-top))` }}
        >
          {/* 定位不可用时明确告知：到场校验依赖它，不能让用户以为任务能正常提交 */}
          {showLocationBanner && (
            <div className="mx-auto max-w-lg rune-panel wui-flat rounded-xl px-3 py-2.5 flex items-center gap-2.5" style={{ borderColor: 'rgba(200,122,69,0.42)' }}>
              <MapPinOff className="w-4 h-4 text-red-300 flex-shrink-0" />
              <span className="text-[11px] text-slate-200 leading-snug">
                {/* 跟随语言切换：新组件都切成英文了，只有这一条还是写死的中文（QA-R1-14） */}
                {!consent.location
                  ? lang === 'zh'
                    ? '你未授权位置访问，无法验证是否到达任务现场，任务证明将无法提交。'
                    : 'Location access is not authorized, so arrival at a quest site cannot be verified and proofs cannot be submitted.'
                  : geoStatus === 'denied'
                    ? lang === 'zh'
                      ? '浏览器拒绝了定位权限，请在系统设置中开启后重试。'
                      : 'The browser denied location access. Enable it in your system settings and try again.'
                    : lang === 'zh'
                      ? '当前无法获取定位信号。'
                      : 'No location signal right now.'}
              </span>
            </div>
          )}
          {notice && (
            <div
              role="status"
              data-testid="accept-notice"
              className="mx-auto max-w-lg rune-panel wui-flat rounded-xl px-3 py-2.5 flex items-center gap-2.5"
              style={{ borderColor: 'rgba(200,122,69,0.42)' }}
            >
              <Lock className="w-4 h-4 text-red-300 flex-shrink-0" />
              <span className="text-[11px] text-slate-200 leading-snug">{notice}</span>
            </div>
          )}
        </div>
      )}

      {activeQuest && (
        // 手机上 HUD 横跨全宽，右端会压在右上的公会 / 语言按钮列底下。套一层收窄的定位容器，
        // HUD 自己的 left-4 right-4 就相对它计算；宽屏时 HUD 居中限宽，本来就碰不到按钮列。
        <div className="absolute inset-y-0 left-0 right-14 sm:right-0 z-[900] pointer-events-none">
          <ActiveQuestHUD
            quest={activeQuest}
            startTime={startTime}
            isAutoNavigating={isAutoNav}
            onStartAutoNav={() => setIsAutoNav(true)}
            onStopAutoNav={() => setIsAutoNav(false)}
            onSubmitProof={() => setShowProof(true)}
            onAbort={() => {
              setActiveQuestId(null);
              setStartTime(null);
              setIsAutoNav(false);
            }}
            onRecenter={() => worldEvents.emit({ type: 'recenter' })}
            lang={lang}
          />
        </div>
      )}

      {/* 聚焦卡片打开时让位：手机上卡片横跨全宽，契约终端会被压在卡片底下（简报 5.5） */}
      {!activeQuestId && !cardOpen && (
        <div className="absolute bottom-12 right-8 z-[950] flex flex-col items-end gap-3 pointer-events-none">
            {/*
              发光收敛成一圈柔和的暖晕，而不是霓虹光环。
              塞尔达的可交互物件靠"微微透光的暖色"提示，不靠高饱和辉光。
            */}
            <button
                data-testid="bounty-open"
                aria-label={lang === 'zh' ? '打开契约终端' : 'Open contract terminal'}
                onClick={() => setShowBountyBoard(true)}
                className="pointer-events-auto relative w-20 h-20 rounded-full flex flex-col items-center justify-center text-amber-200 active:scale-90 transition-all duration-500 group overflow-hidden"
                style={{
                  background: 'radial-gradient(circle at 50% 35%, #3d3123 0%, #241d15 70%)',
                  border: '1px solid rgba(201,169,97,0.55)',
                  boxShadow: '0 0 28px rgba(201,169,97,0.18), inset 0 1px 0 rgba(232,207,148,0.16), 0 10px 28px rgba(0,0,0,0.6)',
                }}
            >
                <div className="absolute inset-0 bg-gradient-to-tr from-amber-400/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <TerminalIcon className="w-7 h-7 mb-1 group-hover:scale-110 transition-transform duration-500" />
                <span className="text-[8px] font-bold tracking-[0.25em] uppercase text-amber-300/90">契約終端</span>
            </button>
        </div>
      )}

      {/* 世界控件：2D/3D 切换、视角重置、回到我。按钮只回调，事件由 App 发到世界总线 */}
      <WorldControls
        mode={mode}
        onToggleMode={toggleMode}
        onRecenter={() => worldEvents.emit({ type: 'recenter' })}
        onResetView={() => worldEvents.emit({ type: 'resetView' })}
        hasLocation={inWorld}
        canUse3d={canUse3d}
        fallbackReason={fallbackReason ? fallbackText(fallbackReason, lang) : undefined}
        locationHint={locationHintText(lang, consent.location, geoStatus, geoFix !== null, inWorld)}
        cardOpen={cardOpen}
        lang={lang}
      />

      {/* 3D 下取代 Leaflet 弹窗；2D 仍由弹窗承担，避免同一个委托出现两个接取入口 */}
      {mode === '3d' && (
        <QuestFocusCard
          quest={focusedQuest}
          userLevel={user.level}
          userProfession={user.profession}
          isActive={focusedQuest !== null && focusedQuest.id === activeQuestId}
          hasActiveQuest={activeQuestId !== null}
          isCompleted={focusedQuest !== null && completedIds.includes(focusedQuest.id)}
          // 没有定位就是 null，卡片显示「距离未知」——不拿默认坐标假装算出一个距离。
          // 不在纽约（多数测试者）时也不报「11854.7 公里」：数字没错但毫无意义，说法与世界控件的提示一致（QA-R1-10）
          distanceText={
            focusedQuest && userLocation
              ? inWorld
                ? formatDistance(distanceMeters(userLocation, focusedQuest.location), lang)
                : lang === 'zh' ? '你目前不在纽约范围内' : 'You are outside the New York area'
              : null
          }
          rewardMagicules={focusedQuest ? questMagicules(focusedQuest) : undefined}
          activeQuestTitle={activeQuest?.title}
          onAccept={handleAccept}
          onClose={() => setFocusedQuestId(null)}
          lang={lang}
        />
      )}

      {showBountyBoard && (
        <BountyBoard
          quests={quests}
          onFocus={(q) => setFocusedQuestId(q.id)}
          onAccept={handleAccept}
          activeQuestId={activeQuestId}
          focusedQuestId={focusedQuestId}
          userLevel={user.level}
          onClose={() => setShowBountyBoard(false)}
          lang={lang}
          isSpeaking={isElenaSpeaking}
          expression={elenaExpression}
          userProfession={user.profession}
          completedQuestIds={user.completedQuestIds}
        />
      )}

      {showProfile && (
        <ProfileModal
          user={user}
          onClose={() => setShowProfile(false)}
          onCreateQuest={() => false}
          onOpenProModal={() => setShowProModal(true)}
          onOpenFriends={() => setShowFriends(true)}
          onResetProfile={handleResetProfile}
          onOpenTrustVerification={() => setShowTrustVerification(true)}
          lang={lang}
        />
      )}

      {showGuildBoard && (
        <GuildBoard
          onClose={() => setShowGuildBoard(false)}
          lang={lang}
          currentUser={user}
          onAcceptUrgent={(id) => {
            const q = quests.find(quest => quest.id === id);
            if (q) handleAccept(q);
          }}
          urgentQuests={quests.filter(q => q.isUrgent)}
          onSpeak={speakLine}
        />
      )}

      {showProModal && (
        <ProMembershipModal
          user={user}
          lang={lang}
          onClose={() => setShowProModal(false)}
          onUpgrade={() => {
              setUser({...user, isProMember: true});
              speakLine('pro_granted');
          }}
        />
      )}

      {showFriends && (
        <FriendsBoard
          currentUser={user}
          lang={lang}
          onClose={() => setShowFriends(false)}
          onSpeak={speakLine}
        />
      )}

      {showTrustVerification && (
        <TrustVerification
          onClose={() => setShowTrustVerification(false)}
          onComplete={({ realName, idCardMasked }) => {
            setUser({ ...user, realName, idCardMasked, verified: true });
            setShowTrustVerification(false);
          }}
        />
      )}

      {/*
        艾琳娜的对话层。挂在最外层、z-index 高于委托板，
        所以在地图上和在任务大厅里都能继续跟她说话——她不是一个要「打开」的功能。
      */}
      <ElenaChat
        open={showElenaChat}
        onOpen={() => setShowElenaChat(true)}
        onClose={() => { elena.interrupt(); setShowElenaChat(false); }}
        turns={elena.turns}
        thinking={elena.thinking}
        isSpeaking={isElenaSpeaking}
        expression={elenaExpression}
        onSend={elena.send}
        onInterrupt={elena.interrupt}
        voiceOn={elena.voiceOn}
        onToggleVoice={() => elena.setVoiceOn(!elena.voiceOn)}
        micState={elena.micState}
        micEngineName={elena.micEngineName}
        onMicDown={elena.startListening}
        onMicUp={elena.stopListening}
      />

      {showProof && activeQuest && (
        <ProofSubmission
          questLocation={activeQuest.location}
          userLocation={userLocation}
          locationAccuracy={geoFix?.accuracy ?? null}
          onConfirm={handleProofConfirmed}
          onCancel={() => setShowProof(false)}
        />
      )}

      {/* 结算演出常驻挂载：平时只是一个不可见的读屏播报区，结算来了才出现视觉层 */}
      <SettlementToast
        settlement={settled?.settlement ?? null}
        questTitle={settled?.title ?? ''}
        onDone={() => setSettled(null)}
        lang={lang}
      />
    </div>
  );
};

export default App;
