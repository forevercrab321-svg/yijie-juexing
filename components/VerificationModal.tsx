
import React, { useState, useEffect } from 'react';
import { Race, Profession } from '../types';
import { RACE_CONFIG, PROFESSION_CONFIG, PROFESSION_TRACKS, LANDING_HERO_IMAGE } from '../constants';
import { rollAvatar, AvatarRoll } from '../lib/avatar';
import { Terminal, Check, Sparkles, ChevronLeft, User, ArrowRight, Dices, Mic } from 'lucide-react';

/**
 * 立绘展示。
 *
 * 必须定义在 VerificationModal 外面：写在组件内部的话每次渲染都是新的函数引用，
 * React 会当成不同的组件类型，卸载重建整棵子树——img 因此反复重新请求、
 * 反复触发 onError，和抽取状态搅在一起。
 *
 * 图缺失时显示种族名占位，不让破图出现在觉醒流程里。
 */
const Portrait: React.FC<{
  roll: AvatarRoll;
  missing: boolean;
  onMissing: (url: string) => void;
  className?: string;
}> = ({ roll, missing, onMissing, className = '' }) =>
  missing ? (
    <div className={`bg-gradient-to-br from-slate-800 to-slate-900 flex flex-col items-center justify-center text-center p-6 ${className}`}>
      <Sparkles className="w-10 h-10 text-amber-500/60 mb-3" />
      <div className="text-white font-bold text-lg font-['Cinzel']">{roll.race.split('·')[0]}</div>
      <div className="text-[10px] text-slate-500 mt-2 font-mono">{roll.avatarUrl}</div>
    </div>
  ) : (
    <img
      src={roll.avatarUrl}
      onError={() => onMissing(roll.avatarUrl)}
      className={`object-cover ${className}`}
      alt={roll.race}
    />
  );

interface VerificationModalProps {
  onComplete: (data: {
      name: string;
      race: Race;
      profession: Profession;
      bio: string;
      avatarUrl: string;
  }) => void;
  lang?: 'zh' | 'en';
}

/**
 * 觉醒流程。
 *
 * 相貌由系统随机分配（可以重抽），职业由玩家自己选。
 * 全程不使用摄像头、不采集任何生物特征——立绘都是现成的图片文件。
 */
const VerificationModal: React.FC<VerificationModalProps> = ({ onComplete, lang = 'zh' }) => {
  // 0: 起名, 1: 抽相貌, 2: 选职业, 3: 确认, 4: 载入
  const [step, setStep] = useState<number>(0);

  const [name, setName] = useState('');
  const [bio, setBio] = useState('');
  const [isListening, setIsListening] = useState(false);

  const [roll, setRoll] = useState<AvatarRoll>(() => rollAvatar());
  const [isRolling, setIsRolling] = useState(false);
  /**
   * 加载失败过的立绘路径。
   *
   * 记成集合而不是一个 boolean：boolean 需要在每次重抽时手动复位，
   * 而复位和 setRoll 之间隔着动画延迟，两个状态会互相追赶。
   * 记路径就没有这个时序问题——当前这张有没有挂，直接查一下就知道。
   */
  const [failedArt, setFailedArt] = useState<Set<string>>(() => new Set());
  const artMissing = failedArt.has(roll.avatarUrl);

  const markArtMissing = (url: string) =>
    setFailedArt((prev) => (prev.has(url) ? prev : new Set(prev).add(url)));

  const [profession, setProfession] = useState<Profession | null>(null);
  const [loadingText, setLoadingText] = useState('LINKING SOUL...');

  const raceInfo = RACE_CONFIG[roll.race];

  // Voice Input Logic
  const handleVoiceInput = (setter: React.Dispatch<React.SetStateAction<string>>) => {
    if (isListening) return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = lang === 'zh' ? 'zh-TW' : 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onresult = (e: any) => {
        const text = e.results[0][0].transcript;
        setter((prev: string) => prev ? prev + ' ' + text : text);
    };
    recognition.onerror = () => setIsListening(false);

    recognition.start();
  };

  /**
   * 重抽。短暂的动画让结果有被"掷"出来的感觉，而不是瞬间跳变。
   *
   * 注意结果是在这里先算好、再塞进 setState 的。
   * 不能写成 `setRoll(prev => rollAvatar(prev))`——updater 必须是纯函数，
   * 而 rollAvatar 里有 Math.random()；React 在开发模式下会双调用 updater
   * 来检测这种不纯，结果就是抽到的相貌每两次才变一次。
   */
  const reroll = () => {
    if (isRolling) return;
    const next = rollAvatar(roll);
    setIsRolling(true);
    window.setTimeout(() => {
      setRoll(next);
      setIsRolling(false);
    }, 420);
  };

  useEffect(() => {
    if (step !== 4) return;

    const texts = [
        'VERIFYING TRUST SIGNALS...',
        'ESTABLISHING COMMUNITY LINK...',
        'RECONSTRUCTING SOUL...',
        'SYNC COMPLETE.'
    ];
    let i = 0;
    const interval = setInterval(() => {
        setLoadingText(texts[i]);
        i++;
        if (i >= texts.length) {
            clearInterval(interval);
            setTimeout(() => {
                onComplete({
                    name,
                    race: roll.race,
                    profession: profession ?? Profession.CHRONICLER,
                    bio,
                    avatarUrl: roll.avatarUrl,
                });
            }, 800);
        }
    }, 800);
    return () => clearInterval(interval);
  }, [step, onComplete, name, roll, profession, bio]);

  const goBack = () => {
      if (step > 0) setStep(s => s - 1);
  };

  return (
    <div className="fixed inset-0 z-[2000] flex flex-col items-center justify-center bg-black font-sans">
      {/* Hero Background Image */}
      <div className="absolute inset-0 z-0">
          <img
            src={LANDING_HERO_IMAGE}
            alt=""
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
            className="w-full h-full object-cover opacity-90 animate-in fade-in duration-1000"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/80 to-transparent"></div>
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]"></div>
      </div>

      <div className="w-full h-full max-w-md relative flex flex-col z-10">

        {/* Navigation Header */}
        <div className="pt-12 px-6 flex items-center justify-between z-20">
            {step > 0 && step < 4 ? (
                <button onClick={goBack} className="text-white/80 hover:text-white flex items-center gap-1 bg-black/20 px-3 py-1 rounded-full backdrop-blur-md border border-white/10">
                    <ChevronLeft className="w-4 h-4" />
                    <span className="text-xs font-bold">BACK</span>
                </button>
            ) : <div></div>}

            {step < 4 && (
                <div className="flex gap-1">
                    {[0,1,2,3].map(i => (
                        <div key={i} className={`h-1.5 w-6 rounded-full transition-colors ${i <= step ? 'bg-amber-500' : 'bg-slate-700'}`}></div>
                    ))}
                </div>
            )}
        </div>

        {/* STEP 0: 起名 */}
        {step === 0 && (
          <div className="flex-1 flex flex-col p-6 animate-in slide-in-from-right duration-500">
            <div className="mt-4 mb-8 text-center">
                <div className="w-16 h-16 mx-auto bg-slate-800/80 backdrop-blur rounded-2xl flex items-center justify-center border border-cyan-500/30 mb-4 shadow-[0_0_20px_rgba(6,182,212,0.2)]">
                    <User className="w-8 h-8 text-cyan-500" />
                </div>
                <h1 className="text-3xl font-['Cinzel'] font-bold text-white tracking-widest">灵魂重构</h1>
                <p className="text-xs text-slate-400 mt-2">CHOOSE YOUR NAME</p>
            </div>

            <div className="space-y-5 bg-slate-900/80 p-6 rounded-2xl border border-slate-700 backdrop-blur-md shadow-xl">
                <div className="space-y-1">
                    <label className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider ml-1">转生代号 (Agent Name)</label>
                    <input
                        value={name}
                        onChange={e => setName(e.target.value)}
                        className="w-full bg-black/40 border border-slate-600 focus:border-cyan-500 rounded-xl px-4 py-3 text-white placeholder-slate-600 outline-none transition-colors"
                        placeholder="请输入你在异世界的名字"
                    />
                </div>

                <div className="space-y-1 relative">
                    <label className="text-[10px] font-bold text-cyan-400 uppercase tracking-wider ml-1">志愿宣言 (Bio)</label>
                    <div className="relative">
                        <input
                            value={bio}
                            onChange={e => setBio(e.target.value)}
                            className="w-full bg-black/40 border border-slate-600 focus:border-cyan-500 rounded-xl px-4 py-3 text-white placeholder-slate-600 outline-none transition-colors italic pr-12"
                            placeholder="例如：乐于助人的史莱姆"
                        />
                        <button
                            onClick={() => handleVoiceInput(setBio)}
                            className={`absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center transition-colors ${isListening ? 'bg-red-500/80 text-white animate-pulse' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
                        >
                            <Mic className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                <div className="text-[10px] text-slate-400 leading-relaxed border-t border-slate-700 pt-3 space-y-1.5">
                    <p>* 不需要真实姓名或证件号。想参加需要实名的线下活动时，再到个人档案里补充即可。</p>
                    <p>* 本平台为社区互助系统，非雇佣平台，不经手任何资金，不提供收入担保。</p>
                </div>
            </div>

            <div className="mt-auto">
                <button
                    disabled={!name}
                    onClick={() => setStep(1)}
                    className="w-full bg-cyan-600 disabled:bg-slate-700 disabled:text-slate-500 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg"
                >
                    继续 <ArrowRight className="w-4 h-4" />
                </button>
            </div>
          </div>
        )}

        {/* STEP 1: 抽相貌 */}
        {step === 1 && (
            <div className="flex-1 flex flex-col p-6 animate-in slide-in-from-right duration-500">
                <div className="mt-4 mb-4 text-center">
                    <div className="w-16 h-16 mx-auto bg-slate-800/80 backdrop-blur rounded-2xl flex items-center justify-center border border-amber-500/30 mb-4 shadow-[0_0_20px_rgba(245,158,11,0.2)]">
                        <Dices className="w-8 h-8 text-amber-500" />
                    </div>
                    <h1 className="text-3xl font-['Cinzel'] font-bold text-white tracking-widest">转生抽选</h1>
                    <p className="text-xs text-slate-400 mt-2">你无法选择转生成什么，但可以再赌一次</p>
                </div>

                <div className={`relative w-full aspect-[3/4] bg-slate-900 rounded-2xl overflow-hidden border-2 border-amber-500/40 shadow-2xl mb-4 transition-all duration-300 ${isRolling ? 'opacity-40 scale-95' : 'opacity-100 scale-100'}`}>
                    <Portrait roll={roll} missing={artMissing} onMissing={markArtMissing} className="w-full h-full" />

                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent pointer-events-none"></div>

                    <div className="absolute bottom-0 left-0 right-0 p-5">
                        <div className="text-[10px] font-bold text-amber-400 uppercase tracking-widest mb-1">
                            {raceInfo.buff}
                        </div>
                        <h3 className="text-2xl font-bold text-white font-['Cinzel'] mb-2">
                            {roll.race.split('·')[0]}
                        </h3>
                        <p className="text-xs text-slate-300 leading-relaxed">{raceInfo.desc}</p>
                    </div>
                </div>

                <button
                    onClick={reroll}
                    disabled={isRolling}
                    className="w-full mb-3 bg-slate-900/80 border border-slate-700 hover:border-amber-500/50 text-slate-300 font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                >
                    <Dices className={`w-4 h-4 ${isRolling ? 'animate-spin' : ''}`} />
                    重新转生
                </button>

                <div className="mt-auto">
                    <button
                        onClick={() => setStep(2)}
                        className="w-full bg-amber-600 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg"
                    >
                        就是这个我 <ArrowRight className="w-4 h-4" />
                    </button>
                </div>
            </div>
        )}

        {/* STEP 2: 选职业 */}
        {step === 2 && (
          <div className="flex-1 flex flex-col p-6 animate-in slide-in-from-right duration-500 overflow-hidden">
             <div className="mt-4 mb-4 text-center">
                <h1 className="text-3xl font-['Cinzel'] font-bold text-white tracking-widest">选择职业</h1>
                <p className="text-xs text-slate-400 mt-2">这决定你在活动中能承担什么</p>
             </div>

             {/* 18 个职业按领域分组。平铺会变成一条读不完的长列表 */}
             <div className="flex-1 overflow-y-auto no-scrollbar space-y-4 pr-0.5">
                {PROFESSION_TRACKS.map(({ track, hint }) => (
                  <div key={track}>
                    <div className="flex items-baseline gap-2 mb-1.5 px-1">
                      <h3 className="text-[11px] font-bold text-amber-400 tracking-[0.15em]">{track}</h3>
                      <span className="text-[9px] text-slate-500">{hint}</span>
                    </div>
                    <div className="space-y-1.5">
                      {Object.values(Profession)
                        .filter((p) => PROFESSION_CONFIG[p].track === track)
                        .map((p) => {
                          const info = PROFESSION_CONFIG[p];
                          const active = profession === p;
                          return (
                            <button
                              key={p}
                              onClick={() => setProfession(p)}
                              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-colors ${active ? 'bg-slate-900 border-amber-500' : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'}`}
                            >
                              <span className="text-lg leading-none">{info.icon}</span>
                              <span className="text-sm font-bold text-slate-100">{p}</span>
                              <span className="text-[10px] text-slate-500 ml-auto text-right leading-tight">{info.realSkill}</span>
                              {active && <Check className="w-4 h-4 text-amber-500 flex-shrink-0" />}
                            </button>
                          );
                        })}
                    </div>
                  </div>
                ))}
             </div>

             {/* 选中后才展开说明，列表本身保持紧凑 */}
             {profession && (
               <div className="mt-3 rune-panel rounded-xl p-3.5 animate-in fade-in duration-300">
                 <div className="flex items-center gap-2 mb-1">
                   <span className="text-base">{PROFESSION_CONFIG[profession].icon}</span>
                   <span className="text-sm font-bold text-slate-100">{profession}</span>
                   <span className="text-[9px] text-amber-500/70 uppercase tracking-widest font-mono">{PROFESSION_CONFIG[profession].tagline}</span>
                 </div>
                 <p className="text-[11px] text-slate-400 leading-relaxed">{PROFESSION_CONFIG[profession].desc}</p>
               </div>
             )}

             <div className="mt-3">
                <button
                    disabled={!profession}
                    onClick={() => setStep(3)}
                    className="w-full bg-amber-600 disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg"
                >
                    确定 <ArrowRight className="w-4 h-4" />
                </button>
             </div>
          </div>
        )}

        {/* STEP 3: 确认 */}
        {step === 3 && profession && (
          <div className="flex-1 flex flex-col h-full animate-in slide-in-from-right duration-500 bg-slate-950/90 backdrop-blur-md p-6">
             <div className="pt-6 mb-4 text-center z-10">
                 <h2 className="text-2xl font-['Cinzel'] font-bold text-white tracking-widest mb-1">转生鉴定书</h2>
                 <p className="text-[10px] text-amber-500 font-mono tracking-widest uppercase">SOUL RECORD</p>
             </div>

             <div className="flex-1 flex flex-col items-center justify-center">
                 <div className="relative w-full max-w-sm rounded-3xl overflow-hidden border-2 border-amber-500 shadow-[0_0_50px_rgba(245,158,11,0.4)] bg-black">
                    <Portrait roll={roll} missing={artMissing} onMissing={markArtMissing} className="w-full h-80" />

                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent"></div>

                    <div className="absolute bottom-0 left-0 right-0 p-6">
                        <div className="flex items-center gap-2 mb-2">
                            <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
                            <div className="text-xs font-bold text-amber-400 uppercase tracking-widest">{name}</div>
                        </div>
                        <h3 className="text-2xl font-bold text-white font-['Cinzel'] mb-1">{roll.race.split('·')[0]}</h3>
                        <div className="text-sm text-cyan-400 font-bold mb-3">
                            {PROFESSION_CONFIG[profession].icon} {profession}
                        </div>

                        <div className="bg-slate-900/80 backdrop-blur p-3 rounded-xl border border-slate-700 text-xs text-slate-300 leading-relaxed mb-3">
                            {PROFESSION_CONFIG[profession].desc}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-emerald-400 font-mono bg-emerald-950/50 px-2 py-1 rounded w-fit border border-emerald-500/30">
                            <span>▲</span> {raceInfo.buff}
                        </div>
                    </div>
                 </div>

                 <div className="mt-6 text-center text-slate-500 text-xs italic">
                     * 相貌由转生抽选决定，职业由你自己选择
                 </div>
             </div>

             <div className="mt-auto pt-6">
                <button
                    onClick={() => setStep(4)}
                    className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-bold py-4 rounded-xl shadow-[0_0_25px_rgba(147,51,234,0.4)] transform active:scale-95 transition-all font-['Cinzel'] tracking-[0.2em] flex items-center justify-center gap-2 border border-purple-400/30"
                >
                    <Sparkles className="w-4 h-4" />
                    <span>加入互助社区</span>
                </button>
             </div>
          </div>
        )}

        {/* STEP 4: 载入 */}
        {step === 4 && (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-500 backdrop-blur-xl bg-black/60">
                <div className="relative w-32 h-32 mb-8">
                    <div className="absolute inset-0 border-4 border-amber-900/30 rounded-full"></div>
                    <div className="absolute inset-0 border-t-4 border-amber-500 rounded-full animate-spin"></div>
                    <div className="absolute inset-4 border-4 border-cyan-900/30 rounded-full"></div>
                    <div className="absolute inset-4 border-b-4 border-cyan-500 rounded-full animate-spin direction-reverse duration-1000"></div>
                </div>
                <h2 className="text-2xl font-['Cinzel'] text-white tracking-widest mb-2 animate-pulse">SYSTEM SYNC</h2>
                <div className="flex items-center gap-2 text-amber-500/80 font-mono text-xs">
                    <Terminal className="w-3 h-3" />
                    <span>{loadingText}</span>
                </div>
            </div>
        )}

      </div>
    </div>
  );
};

export default VerificationModal;
