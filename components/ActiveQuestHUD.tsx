
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
        
        <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></div>
                <h3 className="font-['Cinzel'] font-bold text-white text-sm truncate max-w-[150px]">{quest.title}</h3>
                <span className="text-[9px] font-mono text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">{timeString}</span>
            </div>
            
            <div className="flex items-center gap-1">
                <button onClick={onAbort} className="p-1.5 rounded-lg bg-slate-800 text-slate-500 hover:text-red-400 transition-colors">
                    <X className="w-4 h-4" />
                </button>
            </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
            <button 
                onClick={isAutoNavigating ? onStopAutoNav : onStartAutoNav}
                className={`py-2 rounded-xl text-[10px] font-bold flex items-center justify-center gap-1.5 border transition-all active:scale-95
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
                className="bg-slate-800/50 border border-slate-700 text-slate-400 py-2 rounded-xl text-[10px] font-bold flex items-center justify-center gap-1.5 active:scale-95"
            >
                <ExternalLink className="w-3 h-3" />
                MAPS
            </button>

            <button 
                onClick={onSubmitProof}
                className="bg-indigo-600 text-white py-2 rounded-xl text-[10px] font-bold flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-900/30 active:scale-95 border border-white/10"
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
