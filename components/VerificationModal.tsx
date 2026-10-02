
import React, { useState, useEffect } from 'react';
import { Race, Profession, ProfessionTrack } from '../types';
import { RACE_CONFIG, PROFESSION_CONFIG, PROFESSION_TRACKS } from '../constants';
import { rollAvatar, AvatarRoll } from '../lib/avatar';
import {
  Check, Sparkles, ChevronLeft, ArrowRight, Dices, Mic, PenLine, ShieldCheck, HeartHandshake, TrendingUp, Star,
  Camera, Palette, Megaphone, Languages, Ear, BookOpen, Truck, Wrench, BrickWall, Stethoscope, CookingPot, Sprout,
  Shield, Scale, Calculator, Network, Handshake, Footprints,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/**
 * 可爱风格的色调名，对应 index.css 的 .cute-tone-*（整族 safelist，可以拼接类名）。
 * 种族与职业的配色导出给档案页复用：同一个种族在觉醒页和档案页必须是同一个颜色，否则读起来像两个人。
 */
export type CuteTone =
  | 'teal' | 'sky' | 'sun' | 'coral' | 'success' | 'warn' | 'danger' | 'neutral'
  | 'transport' | 'hunt' | 'build' | 'envoy' | 'rescue';

/** 种族 → 立绘相框的衬底色。取自风格指南 5.6 各种族配件的主色，让 2D 立绘和 3D 小人的色彩印象一致 */
export const RACE_TONE: Record<Race, CuteTone> = {
  [Race.SLIME]: 'sky',
  [Race.KIJIN]: 'coral',
  [Race.DAEMON]: 'envoy',
  [Race.DRAGONNEWT]: 'hunt',
  [Race.ANGEL]: 'sun',
  [Race.ELF]: 'build',
  [Race.DWARF]: 'warn',
  [Race.BEASTKIN]: 'sun',
  [Race.FAIRY]: 'envoy',
  [Race.UNDEAD]: 'neutral',
  [Race.MERFOLK]: 'teal',
  [Race.GOLEM]: 'success',
};

/** 职业领域 → 圆章色。18 个职业靠「领域色 + 各自图标 + 名字」三重区分，不只靠颜色 */
export const TRACK_TONE: Record<ProfessionTrack, CuteTone> = {
  [ProfessionTrack.RECORD]: 'sky',
  [ProfessionTrack.LANGUAGE]: 'envoy',
  [ProfessionTrack.LOGISTICS]: 'build',
  [ProfessionTrack.CARE]: 'teal',
  [ProfessionTrack.ORDER]: 'hunt',
  [ProfessionTrack.CRAFT]: 'sun',
};

/**
 * 职业图标。constants.ts 里的 icon 是 emoji——风格指南 3.9 禁止用 emoji 作图标
 * （各平台字形不一，彩色 emoji 也会把配色带乱），这里换成 lucide 线形图标。
 * constants.ts 不在本分工的文件范围内，所以映射放在这里，emoji 字段原样保留给尚未迁移的旧组件。
 */
export const PROFESSION_ICON: Record<Profession, LucideIcon> = {
  [Profession.CHRONICLER]: Camera,
  [Profession.ILLUMINATOR]: Palette,
  [Profession.HERALD]: Megaphone,
  [Profession.LINGUIST]: Languages,
  [Profession.CONFIDANT]: Ear,
  [Profession.MENTOR]: BookOpen,
  [Profession.COURIER]: Truck,
  [Profession.ARTIFICER]: Wrench,
  [Profession.MASON]: BrickWall,
  [Profession.MENDER]: Stethoscope,
  [Profession.HEARTHKEEPER]: CookingPot,
  [Profession.CULTIVATOR]: Sprout,
  [Profession.WARDEN]: Shield,
  [Profession.ARBITER]: Scale,
  [Profession.ASSAYER]: Calculator,
  [Profession.WEAVER]: Network,
  [Profession.TRADER]: Handshake,
  [Profession.STRIDER]: Footprints,
};

/** 「利姆鲁·史莱姆」→ 主名「利姆鲁」+ 称号「史莱姆」：主名做大字，称号做小字，两段都留着 */
const splitRace = (race: Race) => {
  const [main, title = ''] = race.split('·');
  return { main, title };
};

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
    // 占位沿用相框的种族衬底色；文件路径只放进 title 供排查，不再用等宽小字展示给玩家
    <div title={roll.avatarUrl} className={`flex flex-col items-center justify-center bg-[color:var(--tone-50)] p-6 text-center ${className}`}>
      <span className="mb-3 grid h-16 w-16 place-items-center rounded-full bg-white text-[color:var(--tone-600)] shadow-cute-1">
        <Sparkles className="h-8 w-8" strokeWidth={2.25} aria-hidden />
      </span>
      <div className="font-cute-display text-cute-xl text-cute-ink">{splitRace(roll.race).main}</div>
    </div>
  ) : (
    <img
      src={roll.avatarUrl}
      onError={() => onMissing(roll.avatarUrl)}
      className={`object-cover ${className}`}
      alt={roll.race}
    />
  );

/** 公会徽记（白盾 + 暖黄四角星），与主界面的公会徽章按钮同一套图形（风格指南附录 B） */
const GuildMark: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 32 32" className={className} aria-hidden>
    <path d="M16 3.5c3.6 2.2 7.3 3.2 11 3.3v8.3c0 6.4-4.3 11.2-11 13.6C9.3 26.3 5 21.5 5 15.1V6.8c3.7-.1 7.4-1.1 11-3.3z" fill="#fff" />
    <path d="M16 9.2l1.9 4.7 4.7 1.9-4.7 1.9L16 22.4l-1.9-4.7-4.7-1.9 4.7-1.9z" fill="var(--cute-sun-400)" stroke="var(--cute-sun-lip)" strokeWidth="0.8" strokeLinejoin="round" />
  </svg>
);

/** 白色卡通云（纯装饰）。用 SVG 而不是位图：零请求、任意缩放都是圆润的边 */
const Cloud: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 120 56" className={className} aria-hidden>
    <path d="M24 52a20 20 0 0 1-2-39.9A26 26 0 0 1 70 9a18 18 0 0 1 28 10 17 17 0 0 1-2 33z" fill="#fff" />
  </svg>
);

/**
 * 觉醒页的晴空背景。
 *
 * 原先垫的是 hero-landing.jpg——一张偏暗的森林油画。可爱风格下有两条路：给它盖浅色遮罩，或者干脆不用。
 * 选了后者：暗图盖白雾只会变成灰蒙蒙的一层（正是要摆脱的「浑浊」），还要为一张看不清的图多下载几百 KB。
 * .cute-page 的天色渐变 + 几朵会飘的云 + 星点，是零请求的「晴天」，和 3D 世界的天空同一种语言。
 */
const AwakenSky: React.FC = () => (
  <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
    {/* 云只放在顶部的标题带：压到内容后面会在卡片边上鼓出一块白，读起来像卡片变形 */}
    <Cloud className="absolute -left-8 top-[7%] w-32 opacity-90 animate-[cute-float_6s_ease-in-out_infinite] motion-reduce:animate-none" />
    <Cloud className="absolute -right-10 top-[2%] w-40 opacity-80 animate-[cute-float_7.5s_ease-in-out_infinite] motion-reduce:animate-none" />
    <Sparkles className="absolute right-[14%] top-[12%] h-6 w-6" fill="var(--cute-sun-400)" color="var(--cute-sun-lip)" strokeWidth={1.5} />
    <Sparkles className="absolute left-[9%] top-[19%] h-5 w-5" fill="var(--cute-sun-400)" color="var(--cute-sun-lip)" strokeWidth={1.5} />
  </div>
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

const LOADING_TEXTS = ['正在核对信任信号…', '正在接入互助社区…', '正在重构你的灵魂…', '同步完成！'];

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
  const [loadingText, setLoadingText] = useState('正在链接灵魂…');

  const raceInfo = RACE_CONFIG[roll.race];
  const raceTone = RACE_TONE[roll.race];
  const raceName = splitRace(roll.race);

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

    let i = 0;
    const interval = setInterval(() => {
        setLoadingText(LOADING_TEXTS[i]);
        i++;
        if (i >= LOADING_TEXTS.length) {
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

  /*
   * 视口适配（QA-R1-01）：整页 fixed + body overflow:hidden，页面本身永远不会滚动。
   * 所以每一步都拆成「可滚动的内容区 + 钉在底部的主按钮」：
   *   · 内容区 flex-1 min-h-0 —— 没有 min-h-0 时 flex 子项的最小高度等于内容高度，
   *     内容一高就把主按钮挤出屏幕，而且没有任何地方可以滚；
   *   · 主按钮不参与滚动 —— 新玩家第一眼就要看到「下一步」在哪，不能藏在滚动后面。
   * 第 1 步的立绘卡另外随剩余高度等比收缩，常见的桌面与手机尺寸下根本不需要滚动；
   * 滚动只是极矮视口（手机横屏）的兜底。
   * 可爱风格换皮只换外观，这套钉底结构一行没动。
   * 唯一的补充：滚动区用负外边距 + 同宽内边距向两侧各撑出一个 --aw-pad。滚动容器会裁掉子元素的投影，
   * 不撑开的话卡片的软阴影在卡边被齐刷刷切断，看起来像卡片后面垫了一块灰色矩形；内容宽度不变，立绘槽公式照旧成立。
   */
  const stepBody = 'flex-1 min-h-0 overflow-y-auto no-scrollbar -mx-[var(--aw-pad)] px-[var(--aw-pad)]';
  /*
   * 每一步的外框：左右边距走 --aw-pad（手机 16、桌面 24，风格指南 3.7），
   * 底边距含安全区，并给玩具按钮的 4px 厚边留出位置——厚边是 box-shadow，贴着容器底会被裁掉。
   */
  const stepFrame = 'flex-1 min-h-0 flex flex-col px-[var(--aw-pad)] pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))]';
  // 步骤切换的进场：弹一下而不是从右侧滑入（滑入是「位移型」动效，减少动效时整段去掉）
  const stepEnter = 'animate-cute-pop motion-reduce:animate-none';

  const ProfessionIcon = profession ? PROFESSION_ICON[profession] : null;

  return (
    <div className="cute-root cute-page fixed inset-0 z-[2000] flex flex-col items-center overflow-hidden">
      <AwakenSky />

      <div className="relative z-10 flex h-full w-full max-w-md flex-col [--aw-pad:1rem] sm:[--aw-pad:1.5rem]">

        {/* 顶栏：返回 + 步骤点 + 「2 / 4」。步骤点的当前步是拉长的胶囊（形状差异），旁边写数字，不只靠颜色 */}
        <div className="grid shrink-0 grid-cols-[48px_1fr_48px] items-center gap-2 px-[var(--aw-pad)] pt-[calc(0.75rem+env(safe-area-inset-top))]">
            {step > 0 && step < 4 ? (
                <button type="button" onClick={goBack} className="cute-icon-btn" aria-label="返回上一步">
                    <ChevronLeft strokeWidth={2.5} aria-hidden />
                </button>
            ) : <span className="h-12 w-12" aria-hidden />}

            {step < 4 ? (
                <div className="flex items-center justify-center gap-3">
                    <ol className="cute-steps" aria-label="觉醒进度">
                        {[0, 1, 2, 3].map(i => (
                            <li
                                key={i}
                                className={`cute-step ${i < step ? 'is-done' : ''} ${i === step ? 'is-current' : ''}`}
                                aria-current={i === step ? 'step' : undefined}
                            />
                        ))}
                    </ol>
                    <span className="cute-steps-label">{step + 1} / 4</span>
                </div>
            ) : <span aria-hidden />}
            <span aria-hidden />
        </div>

        {/* STEP 0: 起名 */}
        {step === 0 && (
          // 表单包一层：在输入框里按回车就能「继续」，键盘玩家不用再摸鼠标
          <form
            className={`${stepFrame} ${stepEnter}`}
            onSubmit={(e) => { e.preventDefault(); if (name) setStep(1); }}
          >
           <div className={stepBody}>
            <div className="mb-5 mt-3 text-center">
                {/* 视口矮于 820 px（笔记本浏览器的内容区多在 630–790）时隐藏这枚装饰圆章，把高度让给表单 */}
                <div className="mx-auto mb-3 grid h-16 w-16 place-items-center rounded-full border-4 border-white bg-cute-teal-50 text-cute-teal-600 shadow-cute-2 [@media(max-height:820px)]:hidden">
                    <PenLine className="h-8 w-8" strokeWidth={2.25} aria-hidden />
                </div>
                <h1 className="cute-title">灵魂重构</h1>
                <p className="mt-1 text-cute-sm text-cute-ink-2">给异世界的你起个名字</p>
            </div>

            <div className="cute-panel space-y-4">
                <div>
                    <label htmlFor="awaken-name" className="cute-field-label">转生代号</label>
                    <input
                        id="awaken-name"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        className="cute-input"
                        placeholder="请输入你在异世界的名字"
                        autoComplete="off"
                        enterKeyHint="next"
                        aria-describedby="awaken-name-hint"
                    />
                    <p id="awaken-name-hint" className="cute-field-hint">起好名字才能继续，之后在档案里也看得到。</p>
                </div>

                <div>
                    <label htmlFor="awaken-bio" className="cute-field-label">志愿宣言</label>
                    <div className="relative">
                        <input
                            id="awaken-bio"
                            value={bio}
                            onChange={e => setBio(e.target.value)}
                            className="cute-input pr-14"
                            placeholder="例如：乐于助人的史莱姆"
                            autoComplete="off"
                        />
                        {/*
                          视觉 40px，cute-icon-btn-sm 用 ::after 把点击区撑到 48px；收音中走原语的「开」态（浅青底 + 青圈）。
                          用 top-1 定位而不是 translate 居中：原语的按下 / 悬停会改写 transform，translate 会被冲掉、按钮跳位。
                        */}
                        <button
                            type="button"
                            onClick={() => handleVoiceInput(setBio)}
                            aria-label={isListening ? '正在听…' : '语音输入志愿宣言'}
                            aria-pressed={isListening}
                            className="cute-icon-btn cute-icon-btn-sm absolute right-1 top-1 shadow-cute-1"
                        >
                            <Mic aria-hidden />
                        </button>
                    </div>
                </div>

                <ul className="space-y-2 border-t border-cute-line pt-3 text-cute-sm font-semibold text-cute-ink-3">
                    <li className="flex gap-2">
                        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-cute-teal-600" aria-hidden />
                        <span>不需要真实姓名或证件号。想参加需要实名的线下活动时，再到个人档案里补充即可。</span>
                    </li>
                    <li className="flex gap-2">
                        <HeartHandshake className="mt-0.5 h-4 w-4 shrink-0 text-cute-teal-600" aria-hidden />
                        <span>本平台为社区互助系统，非雇佣平台，不经手任何资金，不提供收入担保。</span>
                    </li>
                </ul>
            </div>
           </div>

            <div className="shrink-0 pt-4">
                <button
                    type="submit"
                    disabled={!name}
                    aria-describedby="awaken-name-hint"
                    className="cute-btn cute-btn-primary cute-btn-block"
                >
                    继续 <ArrowRight aria-hidden />
                </button>
            </div>
          </form>
        )}

        {/* STEP 1: 抽相貌 */}
        {step === 1 && (
            <div className={`${stepFrame} ${stepEnter}`}>
              <div className={`${stepBody} flex flex-col`}>
                <div className="mb-4 mt-2 shrink-0 text-center [@media(max-height:640px)]:mb-2 [@media(max-height:640px)]:mt-0">
                    {/* 矮视口隐藏装饰圆章：这一步的主角是立绘，每省下 80 px 都还给卡片 */}
                    <div className="mx-auto mb-3 grid h-16 w-16 place-items-center rounded-full border-4 border-white bg-cute-sun-50 text-cute-sun-600 shadow-cute-2 [@media(max-height:820px)]:hidden">
                        <Dices className="h-8 w-8" strokeWidth={2.25} aria-hidden />
                    </div>
                    <h1 className="cute-title [@media(max-height:640px)]:text-cute-xl">转生抽选</h1>
                    <p className="mt-1 text-cute-sm text-cute-ink-2 [@media(max-height:640px)]:hidden">你无法选择转生成什么，但可以再赌一次</p>
                </div>

                {/*
                  立绘槽。原先卡片是 w-full aspect-[3/4]：列宽 400 px 时固定 533 px 高，不随视口高度变化，
                  1366×657、1440×789 这类常见的笔记本内容区里主按钮整个落在屏幕外（QA-R1-01）。
                  现在槽的基准高度就是原来的自然高度（列宽 × 4/3），只收缩不放大（flex: 0 1）；
                  卡片高度跟着槽走、宽度按 3:4 反推，所以收缩时仍是同一比例的竖卡，不会被压扁。
                  列宽 = min(视口, 28rem) − 两侧 --aw-pad，与外框的内边距同源，改边距时公式自动跟着变。
                  下限 14rem 保证底部的种族名与说明不被裁掉，再矮就交给外层滚动兜底。
                */}
                <div className="relative min-h-[14rem]" style={{ flex: '0 1 calc((min(100vw, 28rem) - 2 * var(--aw-pad)) * 4 / 3)' }}>
                  {/*
                    立绘卡：8px 白边 + 28 圆角的「贴纸相框」，衬底是种族色的浅档。
                    重抽时整张卡绕竖轴翻到侧面（几乎看不见）再弹回来——像翻开一张新卡；减少动效时只做淡出淡入。
                  */}
                  <div
                    data-testid="awaken-portrait-card"
                    className={`cute-tone-${raceTone} relative mx-auto h-full max-w-full aspect-[3/4] overflow-hidden rounded-cute-xl border-8 border-white bg-[color:var(--tone-50)] shadow-cute-2 transition-[transform,opacity] motion-reduce:transition-opacity motion-reduce:[transform:none] ${
                      isRolling
                        ? 'opacity-50 duration-[380ms] ease-cute-in [transform:perspective(900px)_rotateY(84deg)_scale(0.96)]'
                        : 'opacity-100 duration-cute-pop ease-cute-spring [transform:perspective(900px)_rotateY(0deg)]'
                    }`}
                  >
                    <Portrait roll={roll} missing={artMissing} onMissing={markArtMissing} className="h-full w-full" />

                    {/* 加成写在白色标签里贴在左上角：白底 + 600 深色字，压在任何立绘上都清楚 */}
                    <span className="cute-chip absolute left-2 top-2 bg-white shadow-cute-1">
                        <TrendingUp aria-hidden />
                        {raceInfo.buff}
                    </span>

                    {/*
                      种族名与说明放进底部的白色铭牌，不再直接叠在立绘上：
                      天使、史莱姆这类浅色立绘上，靠渐变压暗的白字依旧会糊（QA-R2-01），
                      实底铭牌让文字对比与立绘无关，换皮后不会退化。
                    */}
                    <div className="absolute inset-x-2 bottom-2 rounded-cute-card bg-white/95 px-3 py-2.5 shadow-cute-1">
                        <h3 className="truncate text-cute-xl text-cute-ink">
                            {raceName.main}
                            {raceName.title && <span className="ml-2 font-cute text-cute-sm text-cute-ink-3">{raceName.title}</span>}
                        </h3>
                        <p className="mt-0.5 line-clamp-2 text-cute-sm font-semibold text-cute-ink-2">{raceInfo.desc}</p>
                    </div>
                  </div>
                </div>

              </div>

                {/*
                  两个按钮并排钉在底部，都不进滚动区。
                  原先「重新转生」跟着立绘一起滚动，极矮视口（1000×546）下被滚动区的下缘裁掉一半，
                  看起来像被主按钮压住了。次要动作放在主按钮旁边是标准做法，
                  还省下一整行高度还给立绘——常见尺寸下从此完全不需要滚动。
                  次按钮补到 56px 与主按钮同高；窄屏（< 360px）收起骰子图标，免得文字被挤出按钮。
                */}
                <div className="flex shrink-0 gap-3 pt-3">
                    <button
                        type="button"
                        onClick={reroll}
                        disabled={isRolling}
                        className="cute-btn cute-btn-secondary min-h-[56px] min-w-0 flex-1 px-3"
                    >
                        <Dices className={`max-[359px]:hidden ${isRolling ? 'animate-spin motion-reduce:animate-none' : ''}`} aria-hidden />
                        重新转生
                    </button>
                    <button
                        type="button"
                        onClick={() => setStep(2)}
                        className="cute-btn cute-btn-primary min-w-0 flex-[1.4] px-4"
                    >
                        就是这个我 <ArrowRight aria-hidden />
                    </button>
                </div>
            </div>
        )}

        {/* STEP 2: 选职业 */}
        {step === 2 && (
          <div className={`${stepFrame} ${stepEnter} overflow-hidden`}>
             <div className="mb-1 mt-2 shrink-0 text-center">
                <h1 className="cute-title [@media(max-height:640px)]:text-cute-xl">选择职业</h1>
                <p className="mt-1 text-cute-sm text-cute-ink-2">这决定你在活动中能承担什么</p>
             </div>

             {/*
               18 个职业按领域分组。平铺会变成一条读不完的长列表。
               两侧各撑出 8px：滚动区会裁掉 5.5px 的焦点环。上下边 14px 渐隐：滚动条是隐藏的，
               列表被标题与说明截住时靠渐隐提示「还能滚」；上下内边距同宽，滚到头时首尾两项不落在渐隐里。
             */}
             <div className="-mx-2 min-h-0 flex-1 space-y-4 overflow-y-auto no-scrollbar px-2 py-3.5 [mask-image:linear-gradient(to_bottom,transparent,#000_14px,#000_calc(100%_-_14px),transparent)]">
                {PROFESSION_TRACKS.map(({ track, hint }) => (
                  <section key={track} aria-label={track} className={`cute-tone-${TRACK_TONE[track]}`}>
                    <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 px-1">
                      <span className="cute-chip cute-chip-sm cute-chip-dot">{track}</span>
                      <span className="text-cute-sm font-semibold text-cute-ink-3">{hint}</span>
                    </div>
                    <div className="space-y-2">
                      {Object.values(Profession)
                        .filter((p) => PROFESSION_CONFIG[p].track === track)
                        .map((p) => {
                          const info = PROFESSION_CONFIG[p];
                          const active = profession === p;
                          const Icon = PROFESSION_ICON[p];
                          return (
                            <button
                              type="button"
                              key={p}
                              onClick={() => setProfession(p)}
                              aria-pressed={active}
                              // 选中 = 浅青底 + 青色内圈 + 右侧实心勾（与图标按钮的「开」态同一套语言），不只是换色
                              className={`flex min-h-[60px] w-full items-center gap-3 rounded-cute-md px-3 py-2 text-left shadow-cute-1 ring-inset transition-[background-color,box-shadow,transform] duration-cute-fast active:scale-[0.98] focus-visible:outline-none focus-visible:shadow-cute-focus motion-reduce:transition-none motion-reduce:active:scale-100 ${
                                active ? 'bg-cute-teal-50 ring-2 ring-cute-teal-400' : 'bg-cute-panel ring-1 ring-cute-line'
                              }`}
                            >
                              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[color:var(--tone-50)] text-[color:var(--tone-600)]">
                                <Icon className="h-5 w-5" strokeWidth={2.25} aria-hidden />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block text-cute-body font-extrabold text-cute-ink">{p}</span>
                                <span className="block truncate text-cute-sm font-semibold text-cute-ink-3">{info.realSkill}</span>
                              </span>
                              <span
                                className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${
                                  active ? 'bg-cute-teal-600 text-white' : 'text-transparent ring-2 ring-inset ring-cute-line-strong'
                                }`}
                                aria-hidden
                              >
                                <Check className="h-4 w-4" strokeWidth={3} />
                              </span>
                            </button>
                          );
                        })}
                    </div>
                  </section>
                ))}
             </div>

             {/* 选中后才展开说明，列表本身保持紧凑；没选时这里写明「为什么还不能确定」 */}
             {profession && ProfessionIcon ? (
               <div
                 key={profession}
                 id="awaken-profession-detail"
                 className={`cute-panel-inset cute-tone-${TRACK_TONE[PROFESSION_CONFIG[profession].track]} mt-3 flex shrink-0 gap-3 ${stepEnter}`}
                 aria-live="polite"
               >
                 <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-[color:var(--tone-600)] shadow-cute-1">
                   <ProfessionIcon className="h-5 w-5" strokeWidth={2.25} aria-hidden />
                 </span>
                 <div className="min-w-0">
                   <div className="text-cute-body font-extrabold text-cute-ink">{profession}</div>
                   <p className="text-cute-sm font-semibold text-cute-ink-2">{PROFESSION_CONFIG[profession].desc}</p>
                 </div>
               </div>
             ) : (
               <p id="awaken-profession-detail" className="mt-3 shrink-0 text-center text-cute-sm font-semibold text-cute-ink-3">
                 点选一个职业，看看它在活动里能做什么
               </p>
             )}

             <div className="shrink-0 pt-3">
                <button
                    type="button"
                    disabled={!profession}
                    onClick={() => setStep(3)}
                    aria-describedby="awaken-profession-detail"
                    className="cute-btn cute-btn-primary cute-btn-block"
                >
                    确定 <ArrowRight aria-hidden />
                </button>
             </div>
          </div>
        )}

        {/* STEP 3: 确认 */}
        {step === 3 && profession && ProfessionIcon && (
          // 原先这里多一个 h-full：flex 子项的最小高度取「指定高度」与内容高度的较小者，
          // h-full 让它最少有一整屏高，再叠在顶栏下面，1280×633 下主按钮被裁掉 2 px（QA-R1-01）
          <div className={`${stepFrame} ${stepEnter}`}>
           <div className={`${stepBody} flex flex-col`}>
             <div className="mb-3 mt-2 shrink-0 text-center">
                 <h2 className="cute-title [@media(max-height:640px)]:text-cute-xl">转生鉴定书</h2>
                 <p className="mt-1 text-cute-sm text-cute-ink-2">最后确认一下，这就是异世界的你</p>
             </div>

             <div className="flex flex-1 flex-col items-center justify-center">
                 {/*
                   鉴定书：上半是立绘，下半是白底档案。文字全部放在白底上，不再叠进立绘——
                   浅色立绘（天使、史莱姆）上的字因此永远清楚（QA-R2-01 的根治，而不是加深遮罩）。
                   立绘高度随视口高度收缩（30vh，夹在 8.5–17rem），矮屏也能一眼看全、主按钮照样钉底。
                 */}
                 <div
                   data-testid="awaken-confirm-card"
                   className={`cute-tone-${raceTone} relative w-full max-w-sm overflow-hidden rounded-cute-xl bg-cute-panel shadow-cute-2 ring-1 ring-cute-line`}
                 >
                    <div className="relative h-[clamp(8.5rem,30vh,17rem)] border-8 border-b-0 border-white bg-[color:var(--tone-50)]">
                        {/* 横幅框里竖向裁切：焦点偏上 25%，立绘的脸多在上半部，居中裁会只剩胸口 */}
                        <Portrait roll={roll} missing={artMissing} onMissing={markArtMissing} className="h-full w-full rounded-t-[20px] object-[50%_25%]" />
                        <span className="cute-chip absolute left-2 top-2 bg-white shadow-cute-1">
                            <Sparkles aria-hidden />
                            转生鉴定
                        </span>
                        {/* 暖黄星章：鉴定书的「盖章」。黄底深棕星（7.7:1），压在立绘与档案的交界上 */}
                        <span
                          className="absolute -bottom-6 right-4 grid h-14 w-14 -rotate-12 place-items-center rounded-full border-4 border-white bg-cute-sun-400 text-cute-sun-ink shadow-cute-2"
                          aria-hidden
                        >
                            <Star className="h-7 w-7" fill="currentColor" strokeWidth={2} />
                        </span>
                    </div>

                    <div className="px-5 pb-5 pt-3">
                        <div className="flex items-center gap-1.5 pr-14 text-cute-sm font-extrabold text-[color:var(--tone-600)]">
                            <Sparkles className="h-4 w-4 shrink-0" aria-hidden />
                            <span className="truncate">{name}</span>
                        </div>
                        <h3 className="mt-0.5 text-cute-2xl text-cute-ink">
                            {raceName.main}
                            {raceName.title && <span className="ml-2 font-cute text-cute-sm text-cute-ink-3">{raceName.title}</span>}
                        </h3>

                        <div className="mt-2 flex flex-wrap gap-2">
                            <span className="cute-chip cute-tone-teal">
                                <ProfessionIcon aria-hidden />
                                {profession}
                            </span>
                            <span className="cute-chip cute-tone-sun">
                                <TrendingUp aria-hidden />
                                {raceInfo.buff}
                            </span>
                        </div>

                        <p className="cute-panel-inset mt-3 text-cute-sm font-semibold text-cute-ink-2">
                            {PROFESSION_CONFIG[profession].desc}
                        </p>
                    </div>
                 </div>

                 <p className="mt-3 text-center text-cute-sm font-semibold text-cute-ink-3">
                     相貌由转生抽选决定，职业由你自己选择
                 </p>
             </div>
           </div>

             <div className="shrink-0 pt-4">
                {/*
                  觉醒的最后一步：页面里唯一的主按钮，用品牌青绿的玩具按钮。
                  仪式感交给鉴定书本身（相框、星章、闪光），按钮不再做渐变光晕——光晕会把白字对比冲淡。
                */}
                <button
                    type="button"
                    onClick={() => setStep(4)}
                    className="cute-btn cute-btn-primary cute-btn-block"
                >
                    <Sparkles aria-hidden />
                    <span>加入互助社区</span>
                </button>
             </div>
          </div>
        )}

        {/* STEP 4: 载入 */}
        {step === 4 && (
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-[var(--aw-pad)] pb-[calc(2rem+env(safe-area-inset-bottom))] text-center animate-[cute-fade-in_300ms_linear_both]">
                {/* 公会徽记圆盘轻轻浮动，背后一圈青色脉冲——「正在连接」的意思靠动态表达；减少动效时两者都静止 */}
                <div className="relative mb-7 grid h-28 w-28 place-items-center">
                    <span className="absolute inset-0 rounded-full bg-cute-teal-400/40 animate-[cute-pulse-ring_1.6s_ease-out_infinite] motion-reduce:animate-none" aria-hidden />
                    <div className="relative grid h-24 w-24 place-items-center rounded-full border-4 border-white bg-[radial-gradient(circle_at_50%_28%,var(--cute-teal-600)_0%,var(--cute-teal-700)_52%,var(--cute-sky-600)_100%)] shadow-cute-3 animate-cute-float motion-reduce:animate-none">
                        <span className="absolute inset-[5px] rounded-full border-2 border-dashed border-white/70" aria-hidden />
                        <GuildMark className="relative h-12 w-12" />
                    </div>
                </div>
                <h2 className="cute-title">正在加入社区</h2>
                <p className="mt-2 text-cute-body font-bold text-cute-ink-2" role="status" aria-live="polite">{loadingText}</p>
                <div className="mt-5 flex gap-2" aria-hidden>
                    {[0, 1, 2].map((i) => (
                        <span
                            key={i}
                            className="h-3 w-3 rounded-full bg-cute-teal-600 animate-cute-bounce motion-reduce:animate-none"
                            style={{ animationDelay: `${i * 150}ms` }}
                        />
                    ))}
                </div>
            </div>
        )}

      </div>
    </div>
  );
};

export default VerificationModal;
