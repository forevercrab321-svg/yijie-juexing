
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Quest, Profession } from '../types';
import { PROFESSION_CONFIG } from '../constants';
import { ElenaExpression, expressionImageUrl } from '../lib/elena';
import { X, MapPin, Zap, Terminal, ChevronRight, ChevronLeft, MessageSquare, Sparkles, Shield } from 'lucide-react';

interface BountyBoardProps {
  quests: Quest[];
  onFocus: (quest: Quest) => void;
  onAccept: (quest: Quest, skipConfirm?: boolean) => void;
  activeQuestId: string | null;
  focusedQuestId: string | null;
  userLevel: number;
  onClose: () => void;
  lang: 'zh' | 'en';
  isSpeaking?: boolean;
  /** 当前该显示的表情，由台词决定。见 lib/elena.ts */
  expression?: ElenaExpression;
  /** 玩家的职业，用于标出「适合你」的委托 */
  userProfession?: Profession;
}

const BountyBoard: React.FC<BountyBoardProps> = ({
  quests, onFocus, onAccept, activeQuestId, focusedQuestId, userLevel, onClose, lang,
  // 默认值需要显式标注：本项目未开 strict，带默认值的解构参数会被拓宽成 string
  isSpeaking = false, expression = 'neutral' as ElenaExpression, userProfession
}) => {
  const [viewState, setViewState] = useState<'GREETING' | 'TERMINAL'>('GREETING');
  const [currentIdx, setCurrentIdx] = useState(0);
  const [filter, setFilter] = useState('ALL');
  /** 立绘文件缺失时显示占位，不让整块空白出现在画面里 */
  const [artMissing, setArtMissing] = useState(false);

  /** 上一个表情，用于交叉淡入，避免切换时硬切 */
  const [prevExpression, setPrevExpression] = useState<ElenaExpression | null>(null);
  const lastExpression = useRef(expression);
  useEffect(() => {
    if (lastExpression.current !== expression) {
      setPrevExpression(lastExpression.current);
      lastExpression.current = expression;
      setArtMissing(false);
      const id = setTimeout(() => setPrevExpression(null), 520);
      return () => clearTimeout(id);
    }
  }, [expression]);

  const filteredQuests = useMemo(() => quests.filter(q => filter === 'ALL' || q.type === filter), [quests, filter]);
  const activeQuest = filteredQuests[currentIdx];

  useEffect(() => {
    if (activeQuest && viewState === 'TERMINAL') onFocus(activeQuest);
  }, [currentIdx, viewState, activeQuest, onFocus]);

  return (
    <div className="fixed inset-0 z-[2000] bg-[#020617] flex flex-col font-sans overflow-hidden select-none">
      
      {/* --- 艾琳娜 立繪層 --- */}
      <div className="absolute inset-0 z-0">
        <div
          className={`relative h-full w-full transition-all duration-1000 ${viewState === 'TERMINAL' ? 'scale-110 brightness-[0.25] blur-lg' : 'scale-100'}`}
          style={{ transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)' }}
        >
          {/*
            表情用整张立绘切换，不再往单张图上叠模拟眨眼与口型。
            立绘之间姿势不同，五官位置对不齐，硬编码坐标必然错位；
            换一张真实绘制的表情，表现力也远好过让一张图假装在眨眼。

            两层交叉淡入：下层是上一个表情，上层淡入新的，避免硬切。
          */}
          {prevExpression && prevExpression !== expression && (
            <img
              key={prevExpression}
              src={expressionImageUrl(prevExpression)}
              className="absolute inset-0 h-full w-full object-cover object-center md:object-right-bottom"
              alt=""
            />
          )}
          <img
            key={expression}
            src={expressionImageUrl(expression)}
            onError={() => setArtMissing(true)}
            className={`absolute inset-0 h-full w-full object-cover object-center md:object-right-bottom animate-[elena-breathe_8s_ease-in-out_infinite] transition-opacity duration-500 ${artMissing ? 'opacity-0' : 'opacity-100'}`}
            alt="Elena"
          />

          {/* 说话时的轻微起伏。不依赖任何五官坐标，换图也不会错位 */}
          {isSpeaking && !artMissing && (
            <div className="absolute inset-0 animate-[elena-speak_1.4s_ease-in-out_infinite] pointer-events-none" />
          )}

          {/* 立绘缺失时的占位，避免觉醒流程里出现整块空白 */}
          {artMissing && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-8">
              <Sparkles className="w-10 h-10 text-amber-500/50 mb-4" />
              <div className="text-slate-300 font-['Cinzel'] text-lg mb-1">艾琳娜</div>
              <div className="text-[10px] text-slate-500 font-mono">{expressionImageUrl(expression)}</div>
            </div>
          )}

          {/* 氛圍光影 */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#1c1815] via-transparent to-transparent"></div>
          <div className="absolute inset-0 bg-amber-400/5 mix-blend-overlay"></div>
        </div>
      </div>

      {/* --- UI 控制層 --- */}
      <div className="relative z-20 pt-10 px-8 flex justify-between items-start pointer-events-none">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] text-[#D4AF37] font-black tracking-[0.4em] uppercase opacity-40">System_ELENA_Core</span>
          <div className="h-0.5 w-12 bg-[#D4AF37] shadow-[0_0_15px_#D4AF37]"></div>
        </div>
        <button onClick={onClose} className="pointer-events-auto w-10 h-10 bg-white/5 hover:bg-white/10 rounded-full flex items-center justify-center text-white/30 border border-white/5 backdrop-blur-xl transition-all active:scale-90">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* --- 交互區 --- */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6">
        
        {viewState === 'GREETING' ? (
          /* --- 對話模式：對話框移至底部，縮小文字，不遮擋人物 --- */
          <div className="absolute bottom-10 w-full max-w-sm animate-in fade-in slide-in-from-bottom-10 duration-700">
            <div className="bg-black/40 backdrop-blur-3xl border border-white/10 p-5 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] relative">
              <div className="flex items-center gap-2 mb-3">
                 <div className="w-6 h-6 bg-[#D4AF37] rounded-full flex items-center justify-center text-black shadow-lg">
                    <MessageSquare className="w-3 h-3" />
                 </div>
                 <h2 className="text-[10px] font-black text-[#D4AF37] tracking-[0.2em] uppercase font-['Cinzel']">艾琳娜 (ELENA)</h2>
              </div>
              <p className="text-xs text-white/80 font-serif leading-relaxed italic mb-5 pl-2 border-l border-[#D4AF37]/30">
                「你看起來比上次更強壯了。想看看我為你準備的那些... 『特別契約』嗎？」
              </p>
              <button 
                onClick={() => setViewState('TERMINAL')}
                className="w-full bg-[#D4AF37] hover:bg-white text-black font-black py-3.5 rounded-2xl flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95 group overflow-hidden"
              >
                <Terminal className="w-3.5 h-3.5 group-hover:rotate-12 transition-transform" />
                <span className="text-[10px] tracking-[0.3em] uppercase">進入契約終端</span>
              </button>
            </div>
          </div>
        ) : (
          /* --- 任務終端：清晰、無雜亂排版 --- */
          <div className="w-full max-w-xl bg-black/60 backdrop-blur-3xl border border-[#D4AF37]/20 rounded-[3rem] overflow-hidden shadow-[0_40px_100px_rgba(0,0,0,1)] flex flex-col h-[650px] animate-in zoom-in-95 duration-500 relative">
            
            {/* 分類導航：簡約化 */}
            <div className="flex gap-2 p-6 overflow-x-auto no-scrollbar border-b border-white/5 bg-white/5">
              {['ALL', '物资运输', '魔物讨伐', '迷宫建设', '紧急救援'].map(t => (
                <button
                  key={t}
                  onClick={() => { setFilter(t); setCurrentIdx(0); }}
                  className={`px-4 py-2 rounded-xl text-[9px] font-black tracking-widest uppercase transition-all whitespace-nowrap ${filter === t ? 'bg-[#D4AF37] text-black shadow-lg' : 'bg-white/5 text-white/30 hover:text-white'}`}
                >
                  {t === 'ALL' ? '全部委託' : t}
                </button>
              ))}
            </div>

            {/* 任務核心內容：清晰垂直排版 */}
            <div className="flex-1 flex flex-col p-10 relative">
              {activeQuest ? (
                <div className="flex-1 flex flex-col animate-in fade-in duration-500" key={activeQuest.id}>
                  <div className="flex justify-between items-center mb-6">
                     <div className="flex items-center gap-2 bg-red-600/20 px-3 py-1 rounded-full border border-red-600/30">
                        <span className="w-1 h-1 rounded-full bg-red-500 animate-pulse"></span>
                        <span className="text-red-500 text-[8px] font-black uppercase tracking-widest">{activeQuest.difficulty}</span>
                     </div>
                     <span className="text-[9px] text-white/20 font-mono tracking-widest">ID_{activeQuest.id}</span>
                  </div>

                  <h3 className="text-3xl font-black text-white font-['Cinzel'] tracking-wider mb-4 leading-tight drop-shadow-lg">
                    {activeQuest.title}
                  </h3>

                  <div className="flex items-center gap-4 text-[9px] font-bold text-[#D4AF37] mb-8">
                    <div className="flex items-center gap-1.5 bg-white/5 px-2.5 py-1.5 rounded-lg border border-white/5">
                      <MapPin className="w-3 h-3" /> {activeQuest.locationName}
                    </div>
                    <div className="text-white/40 tracking-widest uppercase">⏱ {activeQuest.estimatedTime} MINS</div>
                  </div>

                  <p className="text-base text-white/70 leading-relaxed font-serif italic mb-6 pl-6 border-l-2 border-amber-500/50">
                    "{activeQuest.description}"
                  </p>

                  {/* 需要的职业。匹配到玩家的那个会被标出来——职业因此有了实际重量 */}
                  {activeQuest.neededProfessions?.length ? (
                    <div className="mb-6">
                      <div className="text-[8px] text-white/40 font-black tracking-widest mb-2 uppercase">需要的职业 / Roles</div>
                      <div className="flex flex-wrap gap-2">
                        {activeQuest.neededProfessions.map((p) => {
                          const info = PROFESSION_CONFIG[p];
                          const isMine = p === userProfession;
                          return (
                            <span
                              key={p}
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-bold border ${
                                isMine
                                  ? 'bg-amber-500/15 border-amber-500/60 text-amber-200'
                                  : 'bg-white/5 border-white/10 text-white/50'
                              }`}
                            >
                              <span className="text-xs leading-none">{info.icon}</span>
                              {p}
                              {isMine && <span className="text-[9px] text-amber-400/90">· 适合你</span>}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-auto flex items-center gap-4 p-5 bg-white/5 rounded-3xl border border-white/5">
                    <div className="flex flex-col flex-1">
                       <span className="text-[8px] text-white/40 font-black tracking-widest mb-1 uppercase">報酬 / REWARD</span>
                       <div className="text-xl font-black text-emerald-400 font-mono flex items-center gap-1.5">
                          <Sparkles className="w-4 h-4" /> +{activeQuest.trustPoints}P
                       </div>
                    </div>
                    <button 
                      onClick={() => onAccept(activeQuest)}
                      className="bg-[#D4AF37] hover:bg-white text-black px-8 h-14 rounded-2xl font-black text-[11px] tracking-[0.3em] uppercase transition-all shadow-xl active:scale-95"
                    >
                      承接
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center opacity-20 text-[10px] tracking-[0.5em] uppercase">Scan Error: No Contract Found</div>
              )}

              {/* 切換導航 */}
              {filteredQuests.length > 1 && (
                <>
                  <button onClick={() => setCurrentIdx(p => (p - 1 + filteredQuests.length) % filteredQuests.length)} className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white/40 hover:text-white transition-all active:scale-90">
                    <ChevronLeft className="w-6 h-6" />
                  </button>
                  <button onClick={() => setCurrentIdx(p => (p + 1) % filteredQuests.length)} className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-white/40 hover:text-white transition-all active:scale-90">
                    <ChevronRight className="w-6 h-6" />
                  </button>
                </>
              )}
            </div>

            <button onClick={() => setViewState('GREETING')} className="absolute top-6 right-8 text-[8px] font-black text-[#D4AF37]/40 hover:text-[#D4AF37] transition-all flex items-center gap-1 uppercase tracking-widest">
              <ChevronLeft className="w-2 h-2" /> 返回對話
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes elena-breathe { 
          0%, 100% { transform: scale(1.0); } 
          50% { transform: scale(1.01) translateY(-4px); } 
        }
        /* 说话时整体极轻微的起伏。幅度必须很小，大了就成了摇晃 */
        @keyframes elena-speak {
          0%, 100% { transform: translateY(0) scale(1); }
          50%      { transform: translateY(-1.5px) scale(1.004); }
        }
      `}</style>
    </div>
  );
};

export default BountyBoard;
