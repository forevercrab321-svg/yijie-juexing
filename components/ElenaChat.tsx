import React, { useEffect, useReducer, useRef, useState } from 'react';
import { Mic, Send, Square, Volume2, VolumeX, X, MessageCircle, Loader2, Check } from 'lucide-react';
import { DisplayTurn } from '../lib/agent/conversation';
import { MicState } from '../hooks/useElenaAgent';
import { ElenaExpression, expressionImageUrl } from '../lib/elena';

/**
 * 与艾琳娜对话的常驻层。
 *
 * 刻意不做成 modal：玩家在看地图、在翻委托板的时候都能跟她说话，
 * 这是「她一直在那儿」和「打开一个聊天窗口」的区别。
 * 所以外层只在自己占的那块区域接收点击，其余一律穿透。
 *
 * z-index 高于 BountyBoard(2000)，因为在委托板里也要能继续聊。
 *
 * 可爱风（docs/studio/style-cute.md 4、7.1）：入口是左下角她的圆形头像贴纸，展开后是白色软糖面板；
 * 她的气泡是浅灰蓝底，玩家的气泡是品牌青底白字——一眼分得清谁在说话，不靠位置猜。
 */

interface ElenaChatProps {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  turns: DisplayTurn[];
  thinking: boolean;
  isSpeaking: boolean;
  expression: ElenaExpression;
  onSend: (text: string) => void;
  onInterrupt: () => void;
  voiceOn: boolean;
  onToggleVoice: () => void;
  micState: MicState;
  micEngineName: string | null;
  onMicDown: () => void;
  onMicUp: () => void;
}

/*
  按钮提示写给玩家看。语音输入没接上时，原因是「还没在 lib/agent/stt.ts 注册本地引擎」——
  那是给开发者的话，放在这条注释里，不放进界面（上一版把它写进了 title 与读屏名称）。
  项目不接云端语音识别，音频不离开设备（stt.ts 头部注释、PRIVACY.md）。
*/
const MIC_HINT: Record<MicState, string> = {
  unavailable: '语音输入暂未开放',
  idle: '按住说话',
  recording: '松开发送',
  transcribing: '辨识中…',
};

/** 空对话时给的几句开场白：她只管委托，所以示范的也都是委托相关的问法，顺便教玩家「可以这么问」 */
const STARTERS = ['附近有什么委托？', '有适合我的委托吗？', '紧急委托在哪里？'];

/* ── 艾琳娜头像 ───────────────────────────────────────────────────────────────
   立绘资产（public/assets/elena/*.jpg）目前缺失。上一版缺图时把内部路径当文字显示在界面上（QA-R1-13），
   这里改成一枚自绘的 Q 版头像贴纸：深棕长发、细框眼镜、深青绿西装配金色滚边与胸前的星形罗盘徽章，
   都取自 lib/elena.ts 的立绘定稿描述，换回真立绘时人设不跳。
   图片仍然先试着加载：补上素材后自动显示真立绘，不用改代码。加载失败的地址记在模块级集合里，
   同一会话不再反复请求一个注定 404 的文件（每次打开终端、每换一次表情都会重新挂载）。 */
const missingArt = new Set<string>();

/*
  颜色全部来自风格指南：头发 sun-ink（深棕）、西装 teal-700、滚边与徽章 sun-400、镜框与五官 ink / ink-2；
  肤色 #FFE1CC 与腮红 #FF9AA2 是指南 5.6 给 Q 版角色定的值，与 3D 世界里的小人同一套。
*/
const ElenaChibi: React.FC = () => (
  <svg viewBox="0 0 64 64" className="absolute inset-0 h-full w-full" aria-hidden="true">
    <path d="M14.5 32C13.5 18.5 21.5 10.5 32 10.5S50.5 18.5 49.5 32l1 17.5c.2 4-2.6 6.5-6 6.5H19.5c-3.4 0-6.2-2.5-6-6.5z" fill="var(--cute-sun-ink)" />
    <path d="M7 64c1.2-9.5 8.4-15.2 17-16.2l8 6.4 8-6.4c8.6 1 15.8 6.7 17 16.2z" fill="var(--cute-teal-700)" />
    <path d="M25.6 48.2 32 57l6.4-8.8L32 53.4z" fill="#fff" />
    <path d="M24.2 48.2 32 58M39.8 48.2 32 58" stroke="var(--cute-sun-400)" strokeWidth="1.7" strokeLinecap="round" />
    <path d="M45.5 53.2l1.1 2.5 2.5 1.1-2.5 1.1-1.1 2.5-1.1-2.5-2.5-1.1 2.5-1.1z" fill="var(--cute-sun-400)" />
    <rect x="28.4" y="40" width="7.2" height="9.5" rx="3.2" fill="#FFE1CC" />
    <ellipse cx="32" cy="31.2" rx="13" ry="12.6" fill="#FFE1CC" />
    <path d="M18.7 30.4C18 20.6 24 14.6 32 14.6s14 6 13.3 15.8c-2.8-1.6-4.9-4.3-5.8-8-3.3 4.4-9.6 6.6-16.4 6.1-1.8 0-3.3.6-4.4 1.9z" fill="var(--cute-sun-ink)" />
    <ellipse cx="23.2" cy="36.6" rx="2.8" ry="1.7" fill="#FF9AA2" opacity=".65" />
    <ellipse cx="40.8" cy="36.6" rx="2.8" ry="1.7" fill="#FF9AA2" opacity=".65" />
    <ellipse cx="26.6" cy="32.4" rx="1.9" ry="2.5" fill="var(--cute-ink)" />
    <ellipse cx="37.4" cy="32.4" rx="1.9" ry="2.5" fill="var(--cute-ink)" />
    <circle cx="27.3" cy="31.5" r=".75" fill="#fff" />
    <circle cx="38.1" cy="31.5" r=".75" fill="#fff" />
    <rect x="21.6" y="29" width="10" height="7" rx="2.4" fill="none" stroke="var(--cute-ink-2)" strokeWidth="1.25" />
    <rect x="32.4" y="29" width="10" height="7" rx="2.4" fill="none" stroke="var(--cute-ink-2)" strokeWidth="1.25" />
    <path d="M31.6 31.6h.8" stroke="var(--cute-ink-2)" strokeWidth="1.25" strokeLinecap="round" />
    <path d="M29.6 39.2q2.4 1.9 4.8 0" fill="none" stroke="var(--cute-ink-2)" strokeWidth="1.35" strokeLinecap="round" />
  </svg>
);

export interface ElenaAvatarProps {
  expression: ElenaExpression;
  /** 尺寸由调用方用 Tailwind 宽高类给（w-14 h-14 …） */
  className?: string;
  /** 她在说话时外面一圈青色脉冲；减少动效时变成贴着头像的静止圈，仍然看得出「是她在出声」 */
  speaking?: boolean;
}

/** 契约终端与对话框共用的头像。白色 3px 贴纸圈 + 天色底，与玩家头像（.cute-avatar）同一种质感 */
export const ElenaAvatar: React.FC<ElenaAvatarProps> = ({ expression, className = '', speaking = false as boolean }) => {
  const url = expressionImageUrl(expression);
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  return (
    <span className={`relative inline-block shrink-0 ${className}`}>
      {/*
        脉冲圈垫在头像下面、从 76% 大小起跳：被不透明的头像挡住的部分看不见，只在边缘外露出一圈，
        最大约外扩 18%。直接用 1.8 倍的原语脉冲会在大头像上扩到两百多像素，盖住下面的名字签。
      */}
      {speaking && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-[12%] rounded-full border-[3px] border-cute-teal-400 motion-safe:animate-[cute-pulse-ring_1.6s_ease-out_infinite] motion-reduce:inset-[-4px]"
        />
      )}
      <span
        className="absolute inset-0 overflow-hidden rounded-full border-[3px] border-white shadow-cute-1"
        style={{ background: 'radial-gradient(circle at 50% 30%, var(--cute-sky-50), var(--cute-teal-50) 70%)' }}
      >
        {/* 占位一直垫在下面：图片加载中不会出现一块空白圆 */}
        <ElenaChibi />
        {!missingArt.has(url) && (
          <img
            key={url}
            src={url}
            alt=""
            draggable={false}
            onError={() => { missingArt.add(url); rerender(); }}
            className="absolute inset-0 h-full w-full object-cover object-top"
          />
        )}
      </span>
    </span>
  );
};

/*
  组件自己的样式。只放 Tailwind 工具类表达不了的：安全区定位、只在可悬停设备上的悬停、关键帧、减少动效。
  用 ec- 前缀，不会碰到别的组件。
*/
const CHAT_CSS = `
.ec-entry { position: fixed; z-index: 2100; left: calc(16px + var(--sal)); bottom: calc(24px + var(--sab)); width: 56px; height: 56px; padding: 0; border: 0; border-radius: 50%; background: transparent; box-shadow: var(--cute-shadow-float); cursor: pointer; -webkit-tap-highlight-color: transparent; touch-action: manipulation; transition: transform var(--cute-dur-fast) var(--cute-ease-spring); }
@media (min-width: 640px) { .ec-entry { left: calc(24px + var(--sal)); bottom: calc(32px + var(--sab)); width: 64px; height: 64px; } }
.ec-entry:active { transform: scale(0.9); transition-duration: var(--cute-dur-tap); }
.ec-entry:focus-visible { outline: none; box-shadow: var(--cute-shadow-float), var(--cute-focus-ring); }
.ec-wrap { position: fixed; inset: 0; z-index: 2100; pointer-events: none; display: flex; align-items: flex-end; justify-content: flex-start; padding: 0 calc(12px + var(--sar)) calc(12px + var(--sab)) calc(12px + var(--sal)); }
@media (min-width: 640px) { .ec-wrap { padding: 0 24px calc(32px + var(--sab)) calc(24px + var(--sal)); } }
.ec-panel { pointer-events: auto; width: 100%; max-height: min(34rem, calc(100dvh - 6rem - var(--sat) - var(--sab))); transform-origin: 0 100%; animation: cute-pop-in var(--cute-dur-pop) var(--cute-ease-spring) both; }
@media (min-width: 640px) { .ec-panel { width: 24rem; } }
.ec-dots > i { width: 7px; height: 7px; border-radius: 50%; background: var(--cute-ink-3); animation: ec-dot 1.1s ease-in-out infinite; }
.ec-dots > i:nth-child(2) { animation-delay: .15s; }
.ec-dots > i:nth-child(3) { animation-delay: .3s; }
@keyframes ec-dot { 0%, 60%, 100% { transform: translateY(0); opacity: .5; } 30% { transform: translateY(-4px); opacity: 1; } }
.ec-caret { display: inline-block; width: 3px; height: 1em; margin-left: 2px; vertical-align: -2px; border-radius: 2px; background: var(--cute-teal-400); animation: ec-blink 1s steps(2, start) infinite; }
@keyframes ec-blink { to { visibility: hidden; } }
.ec-mic[data-rec='true'] { background: var(--cute-coral-50); color: var(--cute-coral-600); box-shadow: inset 0 0 0 2px var(--cute-coral-400), var(--cute-shadow-float); }
@media (hover: hover) { .ec-entry:hover { transform: scale(1.06); } }
@media (prefers-reduced-motion: reduce) {
  .ec-entry, .ec-entry:active, .ec-entry:hover { transition: none; transform: none; }
  .ec-panel { animation: cute-fade-in 150ms linear both; }
  .ec-dots > i, .ec-caret { animation: none; }
}
`;

const ElenaChat: React.FC<ElenaChatProps> = ({
  open, onOpen, onClose, turns, thinking, isSpeaking, expression,
  onSend, onInterrupt, voiceOn, onToggleVoice,
  micState, micEngineName, onMicDown, onMicUp,
}) => {
  const [draft, setDraft] = useState('');
  const scroller = useRef<HTMLDivElement>(null);

  // 新内容进来就贴着底部。流式输出时每个字都会触发，所以用 auto 不用 smooth——
  // smooth 会让滚动一直追不上文字，看起来像在抖。
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [turns, thinking]);

  const submit = () => {
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    onSend(text);
  };

  if (!open) {
    return (
      <>
        <style>{CHAT_CSS}</style>
        <button onClick={onOpen} className="ec-entry cute-root" aria-label="与艾琳娜说话">
          <ElenaAvatar expression={expression} speaking={isSpeaking} className="h-full w-full" />
          {/* 右下角的小气泡说明「点这里是聊天」：只有一张脸的话，新玩家不一定知道能点 */}
          <span
            aria-hidden="true"
            className="absolute -bottom-0.5 -right-0.5 grid h-6 w-6 place-items-center rounded-full border-2 border-white bg-cute-teal-600 text-white shadow-cute-1"
          >
            <MessageCircle size={13} strokeWidth={2.75} />
          </span>
        </button>
      </>
    );
  }

  const status = isSpeaking ? '说话中' : thinking ? '思考中' : '公会柜台';
  const statusTone = isSpeaking ? 'cute-tone-teal' : thinking ? 'cute-tone-sky' : 'cute-tone-neutral';
  const lastTurn = turns[turns.length - 1];
  const waiting = thinking && (!lastTurn || (lastTurn.who === 'elena' && lastTurn.text === ''));

  return (
    <div className="fixed inset-0 z-[2100] ec-wrap">
      <style>{CHAT_CSS}</style>
      <section
        role="dialog"
        aria-modal="false"
        aria-label="与艾琳娜的对话"
        className="ec-panel cute-root flex flex-col overflow-hidden rounded-cute-xl border border-cute-line bg-cute-panel shadow-cute-3"
      >
        {/* ── 抬头：她的脸 + 开关 ───────────────────── */}
        <header className="flex shrink-0 items-center gap-3 border-b border-cute-line bg-cute-panel-2 py-2.5 pl-3 pr-2">
          <ElenaAvatar expression={expression} speaking={isSpeaking} className="h-11 w-11" />
          <div className="min-w-0 flex-1">
            <div className="text-cute-lg leading-6 text-cute-ink">艾琳娜</div>
            <span className={`cute-chip cute-chip-sm cute-chip-dot ${statusTone}`}>{status}</span>
          </div>
          <button
            onClick={onToggleVoice}
            className="cute-icon-btn cute-icon-btn-sm"
            aria-label={voiceOn ? '关闭语音' : '开启语音'}
            title={voiceOn ? '关闭语音' : '开启语音'}
          >
            {voiceOn ? <Volume2 strokeWidth={2.5} aria-hidden="true" /> : <VolumeX strokeWidth={2.5} aria-hidden="true" />}
          </button>
          <button onClick={onClose} className="cute-icon-btn cute-icon-btn-sm" aria-label="收起" title="收起">
            <X strokeWidth={2.5} aria-hidden="true" />
          </button>
        </header>

        {/* ── 对话 ───────────────────────────────── */}
        <div ref={scroller} className="flex min-h-[8rem] flex-1 flex-col gap-3 overflow-y-auto px-4 py-4">
          {turns.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-3 text-center">
              <p className="m-0 max-w-[18rem] text-cute-sm font-bold text-cute-ink-3">
                她只管委托——想知道有什么任务、在哪、能不能接，问她就好。
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {STARTERS.map((s) => (
                  <button key={s} type="button" onClick={() => onSend(s)} className="cute-chip cute-tone-teal h-11 px-4">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {turns.map((turn) =>
            turn.who === 'player' ? (
              <div key={turn.id} className="max-w-[85%] self-end">
                <div className="whitespace-pre-wrap break-words rounded-[20px] rounded-br-md bg-cute-teal-600 px-3.5 py-2.5 text-cute-body font-bold text-white">
                  {turn.text}
                </div>
              </div>
            ) : (
              <div key={turn.id} className="max-w-[92%] self-start">
                {/* 她做了什么，玩家该看得见——尤其是「签下契约」这种改状态的 */}
                {turn.actions.length > 0 && (
                  <div className="mb-1.5 flex flex-wrap gap-1.5">
                    {turn.actions.map((a, i) => (
                      <span key={i} className="cute-chip cute-tone-success h-auto min-h-[30px] whitespace-normal py-1 leading-5">
                        <Check strokeWidth={3} aria-hidden="true" />
                        {a}
                      </span>
                    ))}
                  </div>
                )}
                {(turn.text !== '' || !turn.streaming) && (
                  <div className="whitespace-pre-wrap break-words rounded-[20px] rounded-bl-md border border-cute-line bg-cute-panel-2 px-3.5 py-2.5 text-cute-body text-cute-ink">
                    {turn.text}
                    {turn.streaming && <span className="ec-caret" aria-hidden="true" />}
                  </div>
                )}
              </div>
            ),
          )}

          {/* 她还没吐出第一个字时，用「正在输入」的三个点代替转圈：聊天里的等待就该长这样 */}
          {waiting && (
            <div role="status" className="self-start rounded-[20px] rounded-bl-md border border-cute-line bg-cute-panel-2 px-4 py-3.5">
              <span className="sr-only">思考中</span>
              <span className="ec-dots flex items-center gap-1.5" aria-hidden="true"><i /><i /><i /></span>
            </div>
          )}
        </div>

        {/* ── 输入 ───────────────────────────────── */}
        <div className="flex shrink-0 items-end gap-2 border-t border-cute-line px-3 pb-3.5 pt-3">
          <button
            onMouseDown={onMicDown}
            onMouseUp={onMicUp}
            onMouseLeave={() => micState === 'recording' && onMicUp()}
            onTouchStart={(e) => { e.preventDefault(); onMicDown(); }}
            onTouchEnd={(e) => { e.preventDefault(); onMicUp(); }}
            // 来电、系统手势会取消触摸而不发 touchend；不补这一下，录音会卡在「按住」状态
            onTouchCancel={() => micState === 'recording' && onMicUp()}
            disabled={micState === 'unavailable' || micState === 'transcribing'}
            data-rec={micState === 'recording' ? 'true' : 'false'}
            title={micEngineName ? `${MIC_HINT[micState]}（${micEngineName}）` : MIC_HINT[micState]}
            aria-label={MIC_HINT[micState]}
            className="ec-mic cute-icon-btn"
          >
            {micState === 'transcribing'
              ? <Loader2 className="motion-safe:animate-spin" strokeWidth={2.5} aria-hidden="true" />
              : <Mic strokeWidth={2.5} aria-hidden="true" />}
          </button>

          <textarea
            id="elena-chat-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              // Enter 送出，Shift+Enter 换行。手机上不拦，让键盘的换行照常工作。
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                submit();
              }
            }}
            rows={1}
            aria-label="对艾琳娜说"
            placeholder="想接什么样的委托？"
            // textarea.cute-input 自带 96px 最小高与可拖动，特异性比工具类高，只能用 ! 压回单行
            className="cute-input max-h-24 flex-1 !min-h-[48px] !resize-none"
          />

          {/* 她在说话时，这个键变成「停」——打断是对话的一部分，不该藏起来 */}
          {isSpeaking || thinking ? (
            <button
              onClick={onInterrupt}
              className="cute-btn cute-btn-secondary h-12 w-12 shrink-0 px-0"
              aria-label="打断"
              title="打断"
            >
              <Square className="fill-current" strokeWidth={2.5} aria-hidden="true" />
            </button>
          ) : (
            <button
              onClick={submit}
              disabled={!draft.trim()}
              className="cute-btn cute-btn-primary h-12 min-h-[48px] w-12 shrink-0 rounded-cute-md px-0"
              aria-label="送出"
            >
              <Send strokeWidth={2.5} aria-hidden="true" />
            </button>
          )}
        </div>
      </section>
    </div>
  );
};

export default ElenaChat;
