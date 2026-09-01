
import React, { useState, useMemo } from 'react';
import { Quest, QuestDifficulty } from '../types';
import { MapPin, Coins, Filter, Lock, ShieldAlert, Flame, Sparkles, ShieldCheck } from 'lucide-react';
import { TRANSLATIONS } from '../constants';

interface BountyRailProps {
  quests: Quest[];
  onFocus: (quest: Quest) => void;
  onAccept: (quest: Quest, skipConfirm?: boolean) => void;
  activeQuestId: string | null;
  focusedQuestId: string | null;
  userLevel: number;
  lang: 'zh' | 'en';
}

const BountyRail: React.FC<BountyRailProps> = ({ 
  quests, onFocus, onAccept, activeQuestId, focusedQuestId, userLevel, lang 
}) => {
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterRank, setFilterRank] = useState<string>('ALL');

  const t = TRANSLATIONS[lang];

  // Unique types and ranks for filters
  const types = ['ALL', '物资运输', '魔物讨伐', '迷宫建设', '异界交涉', '紧急救援'];
  const ranks = ['ALL', 'D', 'C', 'B', 'A', 'S'];

  const filteredQuests = useMemo(() => {
    return quests.filter(q => {
      const typeMatch = filterType === 'ALL' || q.type === filterType;
      let rankMatch = true;
      if (filterRank !== 'ALL') {
          const rankMap: Record<string, string> = { 'D': 'F级', 'C': 'B级', 'B': 'A级', 'A': 'S级', 'S': 'SS级' };
          rankMatch = q.difficulty.startsWith(rankMap[filterRank] || 'XYZ');
      }
      return typeMatch && rankMatch;
    });
  }, [quests, filterType, filterRank]);

  return (
    <div className="absolute bottom-0 left-0 right-0 z-[1000] flex flex-col justify-end pointer-events-none pb-[env(safe-area-inset-bottom)]">
      
      {/* Filters & Handle */}
      <div className="mx-auto w-full max-w-3xl pointer-events-auto mb-4 px-4 animate-in slide-in-from-bottom-4">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar scroll-touch pb-2">
            <div className="glass-panel rounded-full px-3 py-1.5 flex items-center gap-2 text-xs text-slate-300 flex-shrink-0 backdrop-blur-md bg-slate-900/60">
                <Filter className="w-3 h-3 text-cyan-500" />
                <span className="font-bold font-['Cinzel'] tracking-wider">{t.filter_all}</span>
            </div>

            {/* Type Filters */}
            {types.map(type => (
                <button
                    key={type}
                    onClick={() => setFilterType(type)}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all border shadow-lg ${
                        filterType === type 
                        ? 'bg-cyan-600 border-cyan-400 text-white shadow-cyan-500/30' 
                        : 'bg-slate-900/60 border-slate-700 text-slate-400 hover:bg-slate-800'
                    }`}
                >
                    {type === 'ALL' ? t.filter_all : t[type as keyof typeof t] || type}
                </button>
            ))}

             <div className="w-[1px] h-6 bg-slate-700 mx-1 flex-shrink-0"></div>

             {/* Rank Filters */}
             {ranks.map(rank => (
                <button
                    key={rank}
                    onClick={() => setFilterRank(rank)}
                    className={`w-8 h-8 rounded-full text-[10px] font-bold flex items-center justify-center transition-all border flex-shrink-0 shadow-lg ${
                        filterRank === rank
                        ? 'bg-purple-600 border-purple-400 text-white shadow-purple-500/30' 
                        : 'bg-slate-900/60 border-slate-700 text-slate-400 hover:bg-slate-800'
                    }`}
                >
                    {rank === 'ALL' ? 'ALL' : rank}
                </button>
            ))}
        </div>
      </div>

      {/* Horizontal Scroll Card List */}
      <div className="flex gap-4 overflow-x-auto px-4 pb-8 snap-x snap-mandatory pointer-events-auto no-scrollbar scroll-touch">
        {filteredQuests.length === 0 && (
            <div className="w-full text-center py-8 text-slate-500 text-sm italic glass-panel rounded-2xl mx-4">
                NO REQUESTS MATCH FILTERS
            </div>
        )}

        {filteredQuests.map((quest) => {
            const isActive = quest.id === activeQuestId;
            const isFocused = quest.id === focusedQuestId;
            const isLocked = userLevel < quest.minLevel;
            const isUrgent = quest.isUrgent;
            
            return (
              <div 
                key={quest.id}
                onClick={() => onFocus(quest)}
                onDoubleClick={() => !isLocked && onAccept(quest, true)}
                className={`
                  snap-center flex-shrink-0 w-[85vw] sm:w-[340px] h-[480px] rounded-[2rem] transition-all relative overflow-hidden active:scale-95 duration-300 cursor-pointer select-none group
                  ${isFocused ? 'scale-[1.02] shadow-[0_20px_50px_-10px_rgba(0,0,0,0.5)]' : 'scale-100 shadow-xl'}
                  ${isLocked ? 'grayscale' : ''}
                `}
              >
                {/* 1. Full Background Image with Zoom Effect */}
                <div className="absolute inset-0 bg-slate-900">
                    {quest.imageUrl ? (
                        <img 
                            src={quest.imageUrl} 
                            className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
                            alt="Quest BG"
                        />
                    ) : (
                        <div className="w-full h-full bg-slate-800 flex items-center justify-center text-slate-600">
                            NO IMAGE
                        </div>
                    )}
                    
                    {/* Cinematic Gradient Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent"></div>
                    <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-transparent opacity-80"></div>
                </div>

                {/* 2. Focused Border Glow */}
                {isFocused && (
                     <div className={`absolute inset-0 border-[3px] rounded-[2rem] z-20 pointer-events-none transition-colors duration-300 ${isActive ? 'border-purple-500 shadow-[inset_0_0_20px_rgba(168,85,247,0.5)]' : 'border-cyan-400 shadow-[inset_0_0_20px_rgba(34,211,238,0.5)]'}`}></div>
                )}
                
                {/* 3. Locked Overlay */}
                {isLocked && (
                    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm">
                        <div className="w-16 h-16 bg-slate-800/80 rounded-full flex items-center justify-center border-2 border-slate-600 mb-4 shadow-lg">
                            <Lock className="w-8 h-8 text-slate-400" />
                        </div>
                        <div className="text-red-500 font-bold text-sm uppercase tracking-[0.2em] border border-red-900/50 bg-red-950/80 px-4 py-2 rounded-lg backdrop-blur">
                            {t.req_level} {quest.minLevel}
                        </div>
                    </div>
                )}
                
                {/* 4. Top Badges */}
                <div className="absolute top-4 left-4 right-4 z-20 flex justify-between items-start">
                     {/* Difficulty Rank */}
                     <div className={`
                        flex items-center gap-2 px-3 py-1.5 rounded-xl border backdrop-blur-md shadow-lg
                        ${quest.difficulty === QuestDifficulty.S 
                           ? 'bg-purple-950/80 border-purple-500 text-purple-300' 
                           : 'bg-slate-900/80 border-slate-700 text-slate-300'
                        }
                     `}>
                        <span className="text-[10px] font-bold tracking-wider uppercase">{quest.difficulty.split('·')[0]}</span>
                        <div className="w-[1px] h-3 bg-white/20"></div>
                        <span className="text-[10px] font-bold">Lv.{quest.minLevel}</span>
                     </div>

                     {/* Status Indicators */}
                     <div className="flex flex-col gap-2 items-end">
                        {isUrgent && (
                            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-600/90 text-white text-[10px] font-bold shadow-lg shadow-red-900/50 animate-pulse border border-red-400">
                                <Flame className="w-3 h-3 fill-white" />
                                <span>URGENT</span>
                            </div>
                        )}
                        {isActive && (
                            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-purple-600/90 text-white text-[10px] font-bold shadow-lg shadow-purple-900/50 border border-purple-400">
                                <Sparkles className="w-3 h-3 fill-white" />
                                <span>ACTIVE</span>
                            </div>
                        )}
                     </div>
                </div>

                {/* 5. Content Body (Bottom Aligned) */}
                <div className="absolute bottom-0 left-0 right-0 p-6 z-20 flex flex-col gap-1">
                     {/* Location Pin */}
                     <div className="flex items-center gap-1.5 text-cyan-300 text-xs font-bold mb-1 opacity-90">
                         <MapPin className="w-3 h-3" />
                         <span className="tracking-wide truncate">{quest.locationName}</span>
                     </div>

                     {/* Title */}
                     <h3 className={`font-['Cinzel'] font-bold text-2xl leading-tight mb-2 drop-shadow-md ${isActive ? 'text-purple-200' : 'text-white'}`}>
                        {quest.title}
                     </h3>
                     
                     {/* Description */}
                     <p className="text-slate-300 text-xs mb-5 line-clamp-2 leading-relaxed opacity-80 border-l-2 border-slate-500 pl-3">
                         {quest.description}
                     </p>
                     
                     {/* Rewards Bar */}
                     <div className="flex items-center justify-between bg-slate-900/60 backdrop-blur-md rounded-xl p-3 border border-slate-700/50">
                          <div className="flex flex-col">
                              <span className="text-[9px] text-emerald-500 font-bold uppercase tracking-wider mb-0.5">Trust Pts</span>
                              <div className="text-xl font-mono font-bold text-emerald-300 flex items-center gap-1">
                                  <ShieldCheck className="w-4 h-4" />{quest.trustPoints}
                              </div>
                          </div>
                          
                          <div className="h-6 w-[1px] bg-slate-700"></div>

                          <div className="flex flex-col items-end">
                               <span className="text-[9px] text-amber-500 font-bold uppercase tracking-wider mb-0.5">Appreciation</span>
                               <div className="flex items-center gap-1 text-amber-300 font-bold text-[10px] max-w-[100px] truncate">
                                   {quest.rewardDesc || 'Voluntary'}
                               </div>
                          </div>
                     </div>
                </div>

                {/* Double click hint */}
                {isFocused && !isActive && !isLocked && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-30">
                         <div className="bg-black/70 backdrop-blur text-cyan-400 text-xs px-4 py-2 rounded-full border border-cyan-500/50 font-bold tracking-widest uppercase shadow-2xl transform translate-y-4">
                            Double Tap to Volunteer
                         </div>
                    </div>
                )}
              </div>
            );
        })}
        {/* Spacer for scroll */}
        <div className="w-2 flex-shrink-0"></div>
      </div>
    </div>
  );
};

export default BountyRail;
