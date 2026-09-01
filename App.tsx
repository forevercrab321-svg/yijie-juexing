
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Quest, User } from './types';
import { INITIAL_QUESTS } from './constants';
import MapBoard from './components/MapBoard';
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
import { Terminal as TerminalIcon, Users, MapPinOff } from 'lucide-react';
import { useElenaVoice } from './hooks/useElenaVoice';
import { watchLocation, GeoStatus, GeoFix } from './lib/geo';
import { loadSession, saveSession, clearSession } from './lib/storage';

const App: React.FC = () => {
  // 档案存在本设备上。专属形象一次生成、长期保留，不会每次打开都重画。
  const [restored] = useState(() => loadSession());
  const [consent, setConsent] = useState<ConsentState | null>(restored?.consent ?? null);
  const [user, setUser] = useState<User | null>(restored?.user ?? null);
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
  const [lang, setLang] = useState<'zh' | 'en'>('zh');
  const [startTime, setStartTime] = useState<number | null>(null);
  const [isAutoNav, setIsAutoNav] = useState(false);

  // 真实定位。不再使用写死的坐标——任务到场校验依赖它。
  const [geoFix, setGeoFix] = useState<GeoFix | null>(null);
  const [geoStatus, setGeoStatus] = useState<GeoStatus>('idle');

  // 語音：固定台词走预生成音频，动态内容才实时合成。见 lib/elena.ts
  const { isSpeaking: isElenaSpeaking, expression: elenaExpression, speakLine } = useElenaVoice();

  useEffect(() => {
    if (!user || !consent?.location) return;
    setGeoStatus('watching');
    return watchLocation(
      (fix) => setGeoFix(fix),
      (status) => {
        setGeoStatus(status);
        setGeoFix(null);
      },
    );
  }, [user, consent?.location]);

  // 档案有变动就落盘。形象、等级、金币都在这里被记住。
  useEffect(() => {
    if (consent && user) saveSession(consent, user);
  }, [consent, user]);

  useEffect(() => {
    if (showBountyBoard) speakLine('greeting');
  }, [showBountyBoard, speakLine]);

  /** 清除本设备档案并回到最初的告知页。这是用户撤回同意的唯一出口，必须始终可达。 */
  const handleResetProfile = () => {
    clearSession();
    setUser(null);
    setConsent(null);
    setActiveQuestId(null);
    setShowProfile(false);
  };

  const handleAccept = (quest: Quest) => {
    setActiveQuestId(quest.id);
    setStartTime(Date.now());
    setShowBountyBoard(false);
    speakLine('contract_signed');
  };

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
            guildContribution: 0
          });
        }}
        lang={lang}
      />
    );
  }

  const activeQuest = quests.find(q => q.id === activeQuestId) ?? null;

  return (
    <div className="relative w-full h-screen bg-slate-950 overflow-hidden">
      <MapBoard
        quests={quests}
        activeQuestId={activeQuestId}
        focusedQuestId={focusedQuestId}
        onFocus={(q) => setFocusedQuestId(q.id)}
        onAccept={handleAccept}
        userLocation={geoFix?.coords ?? null}
      />

      <div className="absolute top-[env(safe-area-inset-top)] left-0 right-0 p-4 z-[1000] pointer-events-none flex justify-between items-start">
         <div className="pointer-events-auto flex items-center gap-3 rune-panel p-2 rounded-2xl">
            <button onClick={() => setShowProfile(true)} className="w-12 h-12 rounded-xl overflow-hidden rune-edge bg-slate-800 active:scale-95 transition-transform duration-300">
               <img
                 src={user.avatarUrl}
                 className="w-full h-full object-cover"
                 alt=""
                 onError={(e) => { (e.currentTarget as HTMLImageElement).style.opacity = '0'; }}
               />
            </button>
            <div className="pr-4">
               <div className="text-[10px] text-amber-400 font-bold tracking-[0.18em] uppercase">{user.race.split('·')[0]}</div>
               <div className="text-slate-100 font-bold text-sm tracking-wide font-['Cinzel']">{user.name}</div>
            </div>
         </div>
         <div className="flex flex-col gap-2">
           <button onClick={() => setShowGuildBoard(true)} className="pointer-events-auto w-12 h-12 rune-panel rounded-xl flex items-center justify-center text-amber-400 active:scale-95 transition-all duration-300">
              <Users className="w-5 h-5" />
           </button>
           <button className="pointer-events-auto w-12 h-12 rune-panel rounded-xl flex items-center justify-center text-slate-400 active:scale-95 transition-all duration-300" onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}>
              <span className="text-xs font-bold uppercase tracking-widest">{lang}</span>
           </button>
         </div>
      </div>

      {/* 定位不可用时明确告知：到场校验依赖它，不能让用户以为任务能正常提交 */}
      {(!consent.location || geoStatus === 'denied' || geoStatus === 'unavailable') && (
        <div className="absolute top-[calc(5.5rem+env(safe-area-inset-top))] left-4 right-4 z-[960] pointer-events-none">
          <div className="mx-auto max-w-lg rune-panel rounded-xl px-3 py-2.5 flex items-center gap-2.5" style={{ borderColor: 'rgba(200,122,69,0.42)' }}>
            <MapPinOff className="w-4 h-4 text-red-300 flex-shrink-0" />
            <span className="text-[11px] text-slate-200 leading-snug">
              {!consent.location
                ? '你未授权位置访问，无法验证是否到达任务现场，任务证明将无法提交。'
                : geoStatus === 'denied'
                  ? '浏览器拒绝了定位权限，请在系统设置中开启后重试。'
                  : '当前无法获取定位信号。'}
            </span>
          </div>
        </div>
      )}

      {activeQuest && (
        <ActiveQuestHUD
          quest={activeQuest}
          startTime={startTime}
          isAutoNavigating={isAutoNav}
          onStartAutoNav={() => setIsAutoNav(true)}
          onStopAutoNav={() => setIsAutoNav(false)}
          onSubmitProof={() => setShowProof(true)}
          onAbort={() => setActiveQuestId(null)}
          onRecenter={() => {}}
          lang={lang}
        />
      )}

      {!activeQuestId && (
        <div className="absolute bottom-12 right-8 z-[950] flex flex-col items-end gap-3 pointer-events-none">
            {/*
              发光收敛成一圈柔和的暖晕，而不是霓虹光环。
              塞尔达的可交互物件靠"微微透光的暖色"提示，不靠高饱和辉光。
            */}
            <button
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

      {showProof && activeQuest && (
        <ProofSubmission
          questLocation={activeQuest.location}
          userLocation={geoFix?.coords ?? null}
          locationAccuracy={geoFix?.accuracy ?? null}
          onConfirm={() => {
            setShowProof(false);
            setActiveQuestId(null);
            setUser({ ...user, level: user.level + 1, goldCoins: user.goldCoins + 100 });
            speakLine('mission_complete');
          }}
          onCancel={() => setShowProof(false)}
        />
      )}
    </div>
  );
};

export default App;
