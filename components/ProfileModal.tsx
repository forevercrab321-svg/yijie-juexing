
import React, { useState } from 'react';
import { X, ShieldCheck, Zap, Rotate3d, CheckCircle2, Coins, Fingerprint, UserCircle2, FilePlus2, ChevronLeft, Eye, HeartHandshake, Repeat, Crown, Mic, Users, Trash2 } from 'lucide-react';
// Import missing types
import { User, Quest, Race } from '../types';
import { RACE_CONFIG, PROFESSION_CONFIG, WORLD_HERO_IMAGE } from '../constants';

interface ProfileModalProps {
  user: User;
  onClose: () => void;
  onCreateQuest: (quest: Partial<Quest>) => boolean;
  onOpenProModal: () => void;
  // Define missing onOpenFriends prop
  onOpenFriends: () => void;
  /** 清除本设备上的全部档案。用户撤回同意的出口，不能藏起来。 */
  onResetProfile: () => void;
  /** 打开可选的实名信任认证 */
  onOpenTrustVerification: () => void;
  lang: 'zh' | 'en';
}

const ProfileModal: React.FC<ProfileModalProps> = ({ 
  user, 
  onClose, 
  onCreateQuest, 
  onOpenProModal,
  onOpenFriends,
  onResetProfile,
  onOpenTrustVerification,
  lang
}) => {
  const raceInfo = RACE_CONFIG[user.race];
  const professionInfo = PROFESSION_CONFIG[user.profession];
  const [confirmingReset, setConfirmingReset] = useState(false);

  return (
    <div className="fixed inset-0 z-[1300] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 font-sans text-white">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header Background */}
        {/* 横幅用本地资产。原先那张 Unsplash 的紫粉渐变与暖石板色调完全冲突 */}
        <div className="relative h-32 bg-slate-800">
           <img
             src={WORLD_HERO_IMAGE}
             className="w-full h-full object-cover opacity-45"
             alt=""
             onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
           />
           <div className="absolute inset-0 bg-gradient-to-t from-slate-900 to-transparent"></div>
           <button onClick={onClose} className="absolute top-4 right-4 bg-black/40 p-2 rounded-full text-white hover:bg-black/60 transition-colors">
             <X className="w-5 h-5" />
           </button>
        </div>

        {/* User Info Section */}
        <div className="px-6 pb-6 -mt-12 relative flex-1 overflow-y-auto">
            <div className="flex items-end gap-4 mb-4">
                <div className="w-24 h-24 rounded-2xl border-4 border-slate-900 overflow-hidden bg-slate-800 shadow-xl">
                    <img src={user.avatarUrl} className="w-full h-full object-cover" alt="avatar" />
                </div>
                <div className="pb-2">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        {user.name}
                        {user.isProMember && <Crown className="w-4 h-4 text-amber-500" />}
                    </h2>
                    <div className="text-slate-400 text-xs font-mono">ID: {user.id.slice(0, 8)}</div>
                </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-3 gap-2 mb-6">
                <div className="bg-slate-800/50 p-2 rounded-xl border border-slate-700 text-center">
                    <div className="text-[10px] text-slate-500 uppercase font-bold">Level</div>
                    <div className="text-lg font-bold text-indigo-400">{user.level}</div>
                </div>
                <div className="bg-slate-800/50 p-2 rounded-xl border border-slate-700 text-center">
                    <div className="text-[10px] text-slate-500 uppercase font-bold">Trust</div>
                    <div className="text-lg font-bold text-emerald-400">{user.trustScore}</div>
                </div>
                <div className="bg-slate-800/50 p-2 rounded-xl border border-slate-700 text-center">
                    <div className="text-[10px] text-slate-500 uppercase font-bold">Gold</div>
                    <div className="text-lg font-bold text-amber-500">{user.goldCoins}</div>
                </div>
            </div>

            <div className="space-y-4">
                <div className="bg-slate-800/30 p-4 rounded-2xl border border-slate-700/50">
                    <div className="text-xs font-bold text-slate-500 uppercase mb-2">Race & Profession</div>
                    <div className="flex items-center gap-2 flex-wrap">
                         <div className="text-sm text-white font-bold">{user.race}</div>
                         <div className="text-[10px] bg-amber-900/40 text-amber-300 px-2 py-0.5 rounded border border-amber-500/30">
                            {professionInfo.icon} {user.profession}
                         </div>
                         <div className="text-[10px] bg-indigo-900/50 text-indigo-300 px-2 py-0.5 rounded border border-indigo-500/30">{raceInfo.buff}</div>
                    </div>
                    <div className="text-[10px] text-cyan-400/80 mt-2">现实中：{professionInfo.realSkill}</div>
                    <p className="text-xs text-slate-400 mt-2 italic">"{user.bio}"</p>
                </div>

                {/* Action Grid */}
                <div className="grid grid-cols-1 gap-4">
                     {/* Friends Button */}
                     <button 
                        onClick={onOpenFriends}
                        className="bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 p-4 rounded-xl flex items-center justify-center gap-3 transition-all active:scale-95 group"
                    >
                        <div className="p-2 bg-slate-800 rounded-full">
                             <Users className="w-5 h-5 text-indigo-400" />
                        </div>
                        <div className="text-left flex-1">
                             <div className="text-sm font-bold text-white group-hover:text-indigo-400 transition-colors">夥伴通訊錄</div>
                             <div className="text-[10px] text-slate-500">查看好友在線狀態與共鳴度</div>
                        </div>
                    </button>

                    {/* 信任认证：可选，不做也能正常玩 */}
                    {user.verified ? (
                        <div className="bg-emerald-950/30 border border-emerald-500/30 p-4 rounded-xl flex items-center gap-3">
                            <div className="p-2 bg-emerald-950/50 rounded-full">
                                <ShieldCheck className="w-5 h-5 text-emerald-400" />
                            </div>
                            <div className="text-left flex-1">
                                <div className="text-sm font-bold text-emerald-300">已完成信任认证</div>
                                <div className="text-[10px] text-slate-500">
                                    {user.realName} · {user.idCardMasked}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <button
                            onClick={onOpenTrustVerification}
                            className="bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 p-4 rounded-xl flex items-center gap-3 transition-all active:scale-95 group"
                        >
                            <div className="p-2 bg-slate-800 rounded-full">
                                <ShieldCheck className="w-5 h-5 text-amber-500" />
                            </div>
                            <div className="text-left flex-1">
                                <div className="text-sm font-bold text-white group-hover:text-amber-400 transition-colors">
                                    信任认证 <span className="text-[10px] font-normal text-slate-500">（可选）</span>
                                </div>
                                <div className="text-[10px] text-slate-500">参加需要核实身份的线下活动时才需要</div>
                            </div>
                        </button>
                    )}

                    {/* Pro Member Upgrade Button */}
                    {!user.isProMember && (
                         <button
                            onClick={onOpenProModal}
                            className="bg-gradient-to-r from-amber-600 to-yellow-600 text-white p-4 rounded-xl flex items-center gap-3 shadow-lg shadow-amber-900/20 active:scale-95"
                         >
                            <Crown className="w-6 h-6" />
                            <div className="text-left">
                                <div className="text-sm font-bold">申請職業獵人執照</div>
                                <div className="text-[10px] opacity-80">解鎖專屬徽章與高難度任務</div>
                            </div>
                         </button>
                    )}
                </div>

                {/* 本地数据管理：档案与形象都存在这台设备上，必须给用户一个清除入口 */}
                <div className="mt-6 pt-4 border-t border-slate-800">
                    <div className="text-[10px] text-slate-500 leading-relaxed mb-3">
                        你的档案与专属形象保存在这台设备上，不会上传到服务器。清除后将回到最初的告知页，形象需要重新生成。
                    </div>
                    {!confirmingReset ? (
                        <button
                            onClick={() => setConfirmingReset(true)}
                            className="w-full flex items-center justify-center gap-2 text-slate-500 hover:text-red-400 border border-slate-800 hover:border-red-900/60 rounded-xl py-3 transition-colors text-xs font-bold"
                        >
                            <Trash2 className="w-4 h-4" />
                            清除本设备数据
                        </button>
                    ) : (
                        <div className="flex gap-2">
                            <button
                                onClick={() => setConfirmingReset(false)}
                                className="flex-1 bg-slate-800 text-slate-300 rounded-xl py-3 text-xs font-bold active:scale-95 transition-transform"
                            >
                                取消
                            </button>
                            <button
                                onClick={onResetProfile}
                                className="flex-1 bg-red-900/60 border border-red-700 text-red-100 rounded-xl py-3 text-xs font-bold active:scale-95 transition-transform"
                            >
                                确认清除
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileModal;
