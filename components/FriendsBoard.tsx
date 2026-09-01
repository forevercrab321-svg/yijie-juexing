
import React, { useState, useEffect } from 'react';
import { X, Search, UserPlus, MessageCircle, Shield, Phone, Mail, Link2, Sparkles, ChevronRight, UserCheck } from 'lucide-react';
import { TRANSLATIONS, RACE_CONFIG } from '../constants';
import { User, Race } from '../types';
import type { ElenaLineId } from '../lib/elena';

interface FriendsBoardProps {
  onClose: () => void;
  lang: 'zh' | 'en';
  currentUser: User;
  /** 触发艾琳娜的固定台词。台词内容由 lib/elena.ts 统一管理。 */
  onSpeak: (line: ElenaLineId) => void;
}

const FriendsBoard: React.FC<FriendsBoardProps> = ({ onClose, lang, currentUser, onSpeak }) => {
  const t = TRANSLATIONS[lang];
  const [activeTab, setActiveTab] = useState<'MINE' | 'PENDING'>('MINE');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<any>(null);

  // 模擬好友數據
  const [friends] = useState([
    { id: 'f1', name: '影之獵人', race: Race.KIJIN, level: 25, status: 'online', resonance: 88, avatarUrl: RACE_CONFIG[Race.KIJIN].img },
    { id: 'f2', name: '喵喵指揮官', race: Race.SLIME, level: 12, status: 'offline', resonance: 45, lastSeen: '2h ago', avatarUrl: RACE_CONFIG[Race.SLIME].img },
    { id: 'f3', name: '紐約大賢者', race: Race.DAEMON, level: 50, status: 'online', resonance: 100, avatarUrl: RACE_CONFIG[Race.DAEMON].img },
  ]);

  const handleSearch = () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    setSearchResult(null);
    
    // 模擬搜尋邏輯
    setTimeout(() => {
        setIsSearching(false);
        // 模擬找到一個路人
        if (searchQuery.includes('123') || searchQuery.includes('@')) {
            setSearchResult({
                id: 's1',
                name: '神秘冒險者',
                race: Race.DRAGONNEWT,
                level: 5,
                isVerified: true
            });
            onSpeak('friend_found');
        } else {
            onSpeak('friend_not_found');
        }
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-[1100] bg-slate-950 flex flex-col font-sans animate-in slide-in-from-bottom-5 duration-300">
        {/* Header */}
        <div className="pt-[calc(1rem+env(safe-area-inset-top))] bg-slate-900/90 backdrop-blur-md border-b border-slate-800 p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-cyan-600 rounded-xl flex items-center justify-center shadow-lg shadow-cyan-500/20">
                    <Link2 className="w-5 h-5 text-white" />
                </div>
                <div>
                    <h2 className="text-lg font-['Cinzel'] font-bold text-white tracking-widest leading-none">{t.friends_title}</h2>
                    <div className="flex gap-4 mt-2">
                        <button onClick={() => setActiveTab('MINE')} className={`text-[10px] font-bold tracking-wider uppercase transition-colors ${activeTab === 'MINE' ? 'text-cyan-400 border-b border-cyan-500' : 'text-slate-500'}`}>
                            {t.friends_tab_mine}
                        </button>
                        <button onClick={() => setActiveTab('PENDING')} className={`text-[10px] font-bold tracking-wider uppercase transition-colors ${activeTab === 'PENDING' ? 'text-cyan-400 border-b border-cyan-500' : 'text-slate-500'}`}>
                            {t.friends_tab_pending} (0)
                        </button>
                    </div>
                </div>
            </div>
            <button onClick={onClose} className="w-9 h-9 bg-slate-800 rounded-full flex items-center justify-center text-slate-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
            </button>
        </div>

        {/* Search Bar */}
        <div className="p-4 bg-slate-900/50 border-b border-slate-800">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input 
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    placeholder={t.friends_search_placeholder}
                    className="w-full bg-black border border-slate-700 rounded-xl py-3 pl-10 pr-4 text-xs text-white placeholder-slate-600 outline-none focus:border-cyan-500 transition-all"
                />
                {isSearching && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <div className="w-4 h-4 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin"></div>
                    </div>
                )}
            </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-950 scroll-touch">
            
            {/* Search Results */}
            {searchResult && (
                <div className="animate-in fade-in slide-in-from-top-2">
                    <div className="text-[10px] text-cyan-500 font-bold uppercase tracking-[0.2em] mb-2 ml-1">Search Result</div>
                    <div className="bg-slate-900 border border-cyan-500/50 rounded-2xl p-4 flex items-center gap-4 shadow-[0_0_20px_rgba(6,182,212,0.1)]">
                        <div className="w-12 h-12 bg-slate-800 rounded-xl border border-slate-700 flex items-center justify-center text-cyan-400 font-bold text-xl">
                            {searchResult.name[0]}
                        </div>
                        <div className="flex-1">
                            <h4 className="text-white font-bold text-sm flex items-center gap-1">
                                {searchResult.name}
                                {searchResult.isVerified && <UserCheck className="w-3 h-3 text-emerald-400" />}
                            </h4>
                            <div className="text-[10px] text-slate-500 font-mono">Lv.{searchResult.level} {searchResult.race.split('·')[0]}</div>
                        </div>
                        <button 
                            onClick={() => { onSpeak('friend_request_sent'); setSearchResult(null); }}
                            className="bg-cyan-600 hover:bg-cyan-500 text-white p-2 rounded-lg transition-all active:scale-90"
                        >
                            <UserPlus className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            )}

            {/* Friends List */}
            {activeTab === 'MINE' && (
                <div className="space-y-3">
                    {friends.map(friend => (
                        <div key={friend.id} className="bg-slate-900/60 border border-slate-800 hover:border-slate-700 rounded-2xl p-4 flex items-center gap-4 transition-all group">
                            {/* Avatar with Status */}
                            <div className="relative">
                                <div className="w-14 h-14 rounded-2xl overflow-hidden border border-slate-700 bg-slate-800">
                                    <img src={friend.avatarUrl} className="w-full h-full object-cover" alt="avatar" />
                                </div>
                                <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-slate-900 shadow-sm ${friend.status === 'online' ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'}`}></div>
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-1">
                                    <h4 className="text-white font-bold text-sm truncate">{friend.name}</h4>
                                    <span className="text-[10px] text-slate-500 font-mono">Lv.{friend.level}</span>
                                </div>
                                <div className="flex items-center gap-2 mb-2">
                                    <span className={`text-[10px] font-bold uppercase ${friend.status === 'online' ? 'text-emerald-400' : 'text-slate-500'}`}>
                                        {friend.status === 'online' ? t.friends_online : t.friends_offline}
                                    </span>
                                    {friend.status === 'offline' && <span className="text-[9px] text-slate-600 italic">{friend.lastSeen}</span>}
                                </div>
                                {/* Resonance Bar */}
                                <div className="flex items-center gap-2">
                                    <div className="flex-1 h-1 bg-slate-800 rounded-full overflow-hidden">
                                        <div className="h-full bg-gradient-to-r from-cyan-600 to-emerald-500" style={{width: `${friend.resonance}%`}}></div>
                                    </div>
                                    <span className="text-[9px] text-cyan-400 font-bold font-mono">{friend.resonance}%</span>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="flex flex-col gap-2">
                                <button className="p-2 bg-slate-800 hover:bg-indigo-900/50 text-slate-400 hover:text-indigo-400 rounded-xl transition-all active:scale-90">
                                    <MessageCircle className="w-4 h-4" />
                                </button>
                                <button className="p-2 bg-slate-800 hover:bg-emerald-900/50 text-slate-400 hover:text-emerald-400 rounded-xl transition-all active:scale-90">
                                    <Shield className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {activeTab === 'PENDING' && (
                <div className="flex flex-col items-center justify-center py-20 text-slate-600">
                    <Sparkles className="w-12 h-12 mb-4 opacity-20" />
                    <p className="text-sm italic">沒有待處理的契約請求喔～</p>
                </div>
            )}

            {/* Sync Contacts Button */}
            <div className="pt-6">
                <button className="w-full py-4 border border-dashed border-slate-700 rounded-2xl flex items-center justify-center gap-3 text-slate-500 hover:text-cyan-400 hover:border-cyan-500/50 transition-all bg-slate-900/20 active:scale-95">
                    <Phone className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase tracking-widest">{t.friends_sync_contacts}</span>
                    <ChevronRight className="w-4 h-4" />
                </button>
            </div>

            <div className="h-20"></div>
        </div>
    </div>
  );
};

export default FriendsBoard;
