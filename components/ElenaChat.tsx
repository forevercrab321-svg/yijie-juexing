import React, { useEffect, useRef, useState } from 'react';
import { Mic, Send, Square, Volume2, VolumeX, X, MessageCircle, Loader2 } from 'lucide-react';
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

const MIC_HINT: Record<MicState, string> = {
  unavailable: '语音输入未接入 —— 在 lib/agent/stt.ts 注册本地引擎后启用',
  idle: '按住说话',
  recording: '松开发送',
  transcribing: '辨识中…',
};

const ElenaChat: React.FC<ElenaChatProps> = ({
  open, onOpen, onClose, turns, thinking, isSpeaking, expression,
  onSend, onInterrupt, voiceOn, onToggleVoice,
  micState, micEngineName, onMicDown, onMicUp,
}) => {
  const [draft, setDraft] = useState('');
  const [artMissing, setArtMissing] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

  // 新内容进来就贴着底部。流式输出时每个字都会触发，所以用 auto 不用 smooth——
  // smooth 会让滚动一直追不上文字，看起来像在抖。
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [turns]);

  const submit = () => {
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    onSend(text);
  };

  if (!open) {
    return (
      <button
        onClick={onOpen}
        className="fixed bottom-12 left-6 z-[2100] w-14 h-14 rounded-full flex items-center justify-center active:scale-90 transition-transform duration-300"
        style={{
          background: 'radial-gradient(circle at 50% 35%, #3d3123 0%, #241d15 70%)',
          border: '1px solid rgba(201,169,97,0.55)',
          boxShadow: '0 0 24px rgba(201,169,97,0.16), 0 8px 24px rgba(0,0,0,0.55)',
        }}
        aria-label="与艾琳娜说话"
      >
        <MessageCircle className="w-6 h-6 text-amber-300/90" />
        {/* 她还在说话时给个呼吸提示，让人知道声音是从这儿来的 */}
        {isSpeaking && (
          <span className="absolute inset-0 rounded-full border border-amber-400/40 animate-ping" />
        )}
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-[2100] pointer-events-none flex items-end justify-start p-4 sm:p-6">
      <div
        className="pointer-events-auto w-full sm:w-[24rem] max-w-full flex flex-col rounded-2xl overflow-hidden"
        style={{
          maxHeight: 'min(32rem, calc(100vh - 8rem))',
          background: 'linear-gradient(180deg, rgba(36,32,27,0.97) 0%, rgba(26,22,19,0.98) 100%)',
          border: '1px solid rgba(201,169,97,0.34)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.65)',
          backdropFilter: 'blur(12px)',
        }}
      >
        {/* ── 抬头：她的脸 + 开关 ───────────────────── */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-amber-900/30">
          <div className="relative w-10 h-10 rounded-xl overflow-hidden bg-slate-800 flex-shrink-0 border border-amber-700/30">
            {artMissing ? (
              <div className="w-full h-full flex items-center justify-center text-[9px] text-amber-600/70 font-bold">
                ELENA
              </div>
            ) : (
              <img
                src={expressionImageUrl(expression)}
                onError={() => setArtMissing(true)}
                className="w-full h-full object-cover object-top"
                alt=""
              />
            )}
            {isSpeaking && (
              <span className="absolute inset-0 border-2 border-amber-400/60 rounded-xl animate-pulse" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="text-slate-100 text-sm font-bold font-['Cinzel'] tracking-wide">艾琳娜</div>
            <div className="text-[10px] text-amber-500/70 tracking-widest uppercase">
              {isSpeaking ? '说话中' : thinking ? '思考中' : '公会柜台'}
            </div>
          </div>

          <button
            onClick={onToggleVoice}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-amber-400 transition-colors"
            aria-label={voiceOn ? '关闭语音' : '开启语音'}
            title={voiceOn ? '关闭语音' : '开启语音'}
          >
            {voiceOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-200 transition-colors"
            aria-label="收起"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── 对话 ───────────────────────────────── */}
        <div ref={scroller} className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3 min-h-[8rem]">
          {turns.length === 0 && (
            <p className="text-[12.5px] text-slate-500 leading-relaxed py-6 text-center">
              她只管委托——想知道有什么任务、在哪、能不能接，问她就好。
            </p>
          )}

          {turns.map((turn) =>
            turn.who === 'player' ? (
              <div key={turn.id} className="self-end max-w-[85%]">
                <div className="px-3 py-2 rounded-xl rounded-br-sm bg-amber-900/25 border border-amber-700/25 text-[13.5px] text-amber-50/90 leading-relaxed">
                  {turn.text}
                </div>
              </div>
            ) : (
              <div key={turn.id} className="self-start max-w-[92%]">
                {/* 她做了什么，玩家该看得见——尤其是「签下契约」这种改状态的 */}
                {turn.actions.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-1.5">
                    {turn.actions.map((a, i) => (
                      <span
                        key={i}
                        className="text-[10px] px-2 py-0.5 rounded border border-emerald-700/40 text-emerald-400/90 tracking-wide"
                      >
                        {a}
                      </span>
                    ))}
                  </div>
                )}
                <div className="px-3 py-2 rounded-xl rounded-bl-sm bg-slate-800/50 border border-slate-700/40 text-[13.5px] text-slate-200 leading-relaxed whitespace-pre-wrap">
                  {turn.text}
                  {turn.streaming && (
                    <span className="inline-block w-1.5 h-4 ml-0.5 -mb-0.5 bg-amber-400/70 animate-pulse" />
                  )}
                </div>
              </div>
            ),
          )}

          {thinking && turns[turns.length - 1]?.text === '' && (
            <Loader2 className="w-4 h-4 text-amber-500/60 animate-spin self-start ml-1" />
          )}
        </div>

        {/* ── 输入 ───────────────────────────────── */}
        <div className="px-3 py-3 border-t border-amber-900/30 flex items-end gap-2">
          <button
            onMouseDown={onMicDown}
            onMouseUp={onMicUp}
            onMouseLeave={() => micState === 'recording' && onMicUp()}
            onTouchStart={(e) => { e.preventDefault(); onMicDown(); }}
            onTouchEnd={(e) => { e.preventDefault(); onMicUp(); }}
            disabled={micState === 'unavailable' || micState === 'transcribing'}
            title={micEngineName ? `${MIC_HINT[micState]}（${micEngineName}）` : MIC_HINT[micState]}
            aria-label={MIC_HINT[micState]}
            className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border transition-colors ${
              micState === 'recording'
                ? 'bg-red-900/40 border-red-600/50 text-red-300'
                : micState === 'unavailable'
                  ? 'bg-slate-900/60 border-slate-800 text-slate-700 cursor-not-allowed'
                  : 'bg-slate-800/60 border-slate-700/50 text-slate-300 hover:text-amber-400'
            }`}
          >
            {micState === 'transcribing'
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Mic className="w-4 h-4" />}
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
            placeholder="想接什么样的委托？"
            className="flex-1 resize-none bg-slate-900/70 border border-slate-700/50 rounded-xl px-3 py-2.5 text-[13.5px] text-slate-100 placeholder:text-slate-600 outline-none focus:border-amber-700/50 max-h-24"
          />

          {/* 她在说话时，这个键变成「停」——打断是对话的一部分，不该藏起来 */}
          {isSpeaking || thinking ? (
            <button
              onClick={onInterrupt}
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-slate-800/60 border border-slate-700/50 text-slate-300 hover:text-red-300 transition-colors"
              aria-label="打断"
              title="打断"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
            </button>
          ) : (
            <button
              onClick={submit}
              disabled={!draft.trim()}
              className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-amber-900/30 border border-amber-700/40 text-amber-300 disabled:text-slate-700 disabled:bg-slate-900/60 disabled:border-slate-800 transition-colors"
              aria-label="送出"
            >
              <Send className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ElenaChat;
