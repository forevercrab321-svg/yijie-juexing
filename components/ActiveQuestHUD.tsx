
import React, { useEffect, useState } from 'react';
import { Quest } from '../types';
import { Camera, X, Timer, Zap, Navigation, ExternalLink } from 'lucide-react';
import { TRANSLATIONS } from '../constants';

interface ActiveQuestHUDProps {
  quest: Quest;
  startTime: number | null;
  isAutoNavigating: boolean;
  onStartAutoNav: () => void;
  onStopAutoNav: () => void;
  onSubmitProof: () => void;
  onAbort: () => void;
  onRecenter: () => void;
  lang: 'zh' | 'en';
}

const ActiveQuestHUD: React.FC<ActiveQuestHUDProps> = ({ 
  quest, startTime, isAutoNavigating, onStartAutoNav, onStopAutoNav, onSubmitProof, onAbort, onRecenter, lang
}) => {
  const [elapsed, setElapsed] = useState(0);
  const t = TRANSLATIONS[lang];
  /*
   * 放弃要点两次（QA-R1-09）：原先右上角的 X 一碰就清掉进行中的委托、计时归零，
   * 走路时手机在口袋里或单手操作很容易误触。第一次点只「上膛」并写明后果，3 秒内再点才真的放弃。
   * 用行内确认而不是弹窗：不挡地图，也不多一层要关的界面。
   */
  const [abortArmed, setAbortArmed] = useState(false);
  useEffect(() => {
    if (!abortArmed) return;
    const id = setTimeout(() => setAbortArmed(false), 3000);
    return () => clearTimeout(id);
  }, [abortArmed]);
  useEffect(() => setAbortArmed(false), [quest.id]);

  useEffect(() => {
    if (!startTime) return;
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  return (
    <div className="absolute top-[calc(5rem+env(safe-area-inset-top))] left-4 right-4 z-[900] pointer-events-none">
      <div className="glass-panel rounded-2xl p-3 w-full max-w-lg mx-auto pointer-events-auto flex flex-col gap-2 animate-in slide-in-from-top-4 border-l-4 border-l-indigo-500 shadow-xl bg-black/60">
        
        {/* 标题组可以收缩（标题本来就截断成省略号）：放弃按钮展开成「确认放弃？」时不会把整行挤出面板 */}
        <div className="flex justify-between items-center gap-2">
            <div className="flex items-center gap-2 min-w-0">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse shrink-0"></div>
                <h3 className="font-['Cinzel'] font-bold text-white text-sm truncate max-w-[150px] min-w-0">{quest.title}</h3>
                <span className="shrink-0 text-[9px] font-mono text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">{timeString}</span>
            </div>
            
            <div className="flex items-center gap-1 shrink-0">
                {/*
                  按钮本身是 44×44 的触控目标（QA-R1-09），四周 -8 px 外边距让它在布局里仍只占 28 px，
                  标题行不变高；看得见的仍是里面那块小方块，位置与原来完全相同。
                */}
                <button
                  data-testid="aqh-abort"
                  data-armed={abortArmed ? 'true' : 'false'}
                  onClick={() => (abortArmed ? onAbort() : setAbortArmed(true))}
                  aria-label={abortArmed ? (lang === 'zh' ? '再点一次确认放弃委托' : 'Tap again to abandon the quest') : (lang === 'zh' ? '放弃委托' : 'Abandon quest')}
                  className="group -m-2 min-w-[44px] h-11 px-2 flex items-center justify-end"
                >
                  <span
                    data-testid="aqh-abort-chip"
                    className={`rounded-lg transition-colors flex items-center gap-1 ${abortArmed ? 'px-2 py-1.5 bg-red-950/60 border border-red-400/40 text-red-300' : 'p-1.5 bg-slate-800 text-slate-500 group-hover:text-red-400'}`}
                  >
                    <X className="w-4 h-4" />
                    {abortArmed && <span className="text-[10px] font-bold whitespace-nowrap">{lang === 'zh' ? '确认放弃？' : 'Abandon?'}</span>}
                  </span>
                </button>
            </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
            <button 
                onClick={isAutoNavigating ? onStopAutoNav : onStartAutoNav}
                className={`min-h-[44px] py-2 rounded-xl text-[10px] font-bold flex items-center justify-center gap-1.5 border transition-all active:scale-95
                  ${isAutoNavigating 
                    ? 'bg-indigo-900/40 border-indigo-500 text-indigo-300' 
                    : 'bg-slate-800/50 border-slate-700 text-slate-400'
                  }`}
            >
                {isAutoNavigating ? <Zap className="w-3 h-3 fill-current" /> : <Navigation className="w-3 h-3" />}
                {isAutoNavigating ? 'STOP' : 'AUTO'}
            </button>

            <button 
                onClick={() => {
                  const [lat, lng] = quest.location;
                  window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
                }}
                className="min-h-[44px] bg-slate-800/50 border border-slate-700 text-slate-400 py-2 rounded-xl text-[10px] font-bold flex items-center justify-center gap-1.5 active:scale-95"
            >
                <ExternalLink className="w-3 h-3" />
                MAPS
            </button>

            <button 
                onClick={onSubmitProof}
                className="min-h-[44px] bg-indigo-600 text-white py-2 rounded-xl text-[10px] font-bold flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-900/30 active:scale-95 border border-white/10"
            >
                <Camera className="w-3 h-3" />
                SUBMIT
            </button>
        </div>
      </div>
    </div>
  );
};

export default ActiveQuestHUD;
