
import React, { useState, useEffect } from 'react';
import { TRANSLATIONS, PROFESSION_CONFIG } from '../constants';
import { User } from '../types';
import { X, Crown, ShieldCheck, Zap, Eye, CheckCircle2, AlertTriangle, Briefcase, Lock, Check } from 'lucide-react';

interface ProMembershipModalProps {
  onClose: () => void;
  onUpgrade: () => void;
  lang: 'zh' | 'en';
  user: User;
}

const ProMembershipModal: React.FC<ProMembershipModalProps> = ({ onClose, onUpgrade, lang, user }) => {
  const t = TRANSLATIONS[lang];
  const [step, setStep] = useState<'INFO' | 'CHECK' | 'APPLYING'>('INFO');
  // 职业已经表达了专长领域，不必再问一遍——直接以它作为默认值
  const [expertise, setExpertise] = useState(() => PROFESSION_CONFIG[user.profession].expertise);
  
  // Eligibility State (Simulated)
  // Condition 1: Completed 3 tasks (Simulate with level > 2)
  const hasTaskHistory = user.level >= 2; 
  // Condition 2: Recommended 2 times (Simulate with trust > 110)
  const hasRecommendations = user.trustScore > 110; 
  // Condition 3: Expertise (User selection)
  const hasExpertise = expertise.length > 0;
  // Condition 4: Verified ID
  const isVerified = user.verified;

  // Need 2 out of 4 conditions
  const conditionsMet = [hasTaskHistory, hasRecommendations, hasExpertise, isVerified].filter(Boolean).length >= 2;

  const handleApply = () => {
    setStep('APPLYING');
    // Simulate manual review process
    setTimeout(() => {
      onUpgrade();
      onClose();
    }, 2500);
  };

  return (
    <div className="fixed inset-0 z-[1400] flex items-center justify-center bg-black/95 backdrop-blur-md p-6 animate-in fade-in duration-300 font-sans">
      <div className="relative w-full max-w-sm rounded-[2rem] overflow-hidden border border-amber-500/30 shadow-[0_0_50px_rgba(245,158,11,0.2)] bg-slate-950 flex flex-col max-h-[90vh]">
        
        {/* Header Background */}
        <div className="absolute top-0 inset-x-0 h-48 bg-gradient-to-b from-amber-900/20 to-transparent pointer-events-none"></div>
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-amber-500/10 rounded-full blur-3xl"></div>

        {/* Close Button */}
        <button 
            onClick={onClose}
            className="absolute top-4 right-4 z-20 w-8 h-8 rounded-full bg-slate-900/50 flex items-center justify-center text-slate-400 hover:text-white border border-slate-700 hover:border-amber-500/50 transition-colors"
        >
            <X className="w-4 h-4" />
        </button>

        {/* Content */}
        <div className="relative z-10 flex flex-col h-full overflow-y-auto no-scrollbar">
            
            {/* Title Section */}
            <div className="pt-10 pb-4 px-6 text-center">
                <div className="w-16 h-16 mx-auto bg-gradient-to-br from-amber-400 to-amber-700 rounded-2xl flex items-center justify-center shadow-lg shadow-amber-900/50 mb-4 rotate-3 border-2 border-amber-200">
                    <Crown className="w-8 h-8 text-black" />
                </div>
                <h2 className="text-2xl font-['Cinzel'] font-bold text-white tracking-widest mb-1 bg-clip-text text-transparent bg-gradient-to-r from-amber-200 via-amber-400 to-amber-200">
                    {t.pro_title}
                </h2>
                <p className="text-[10px] text-amber-500/80 uppercase tracking-[0.2em] font-bold mb-4">
                    {t.pro_subtitle}
                </p>
                
                {/* What IS / IS NOT Cards */}
                <div className="space-y-2 mb-6">
                    <div className="bg-emerald-950/30 border border-emerald-500/30 p-2 rounded-lg text-[10px] text-emerald-100 font-bold flex items-center gap-2">
                        {t.pro_def_is}
                    </div>
                    <div className="bg-red-950/30 border border-red-500/30 p-2 rounded-lg text-[10px] text-red-100 font-bold flex items-center gap-2">
                        {t.pro_def_not}
                    </div>
                </div>
            </div>

            {/* TAB: INFO */}
            {step === 'INFO' && (
                <div className="px-6 space-y-4 mb-6 flex-1">
                    <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-xl flex gap-4 items-start group hover:border-amber-500/30 transition-colors">
                        <div className="w-10 h-10 rounded-lg bg-amber-950/30 flex items-center justify-center flex-shrink-0">
                            <ShieldCheck className="w-5 h-5 text-amber-500" />
                        </div>
                        <div>
                            <h3 className="text-white font-bold text-sm mb-1">{t.pro_benefit_1}</h3>
                            <p className="text-slate-400 text-xs leading-relaxed">{t.pro_benefit_desc_1}</p>
                        </div>
                    </div>

                    <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-xl flex gap-4 items-start group hover:border-amber-500/30 transition-colors">
                        <div className="w-10 h-10 rounded-lg bg-amber-950/30 flex items-center justify-center flex-shrink-0">
                            <Eye className="w-5 h-5 text-amber-500" />
                        </div>
                        <div>
                            <h3 className="text-white font-bold text-sm mb-1">{t.pro_benefit_2}</h3>
                            <p className="text-slate-400 text-xs leading-relaxed">{t.pro_benefit_desc_2}</p>
                        </div>
                    </div>

                    <div className="bg-slate-900/50 border border-slate-800 p-4 rounded-xl flex gap-4 items-start group hover:border-amber-500/30 transition-colors">
                        <div className="w-10 h-10 rounded-lg bg-amber-950/30 flex items-center justify-center flex-shrink-0">
                            <Zap className="w-5 h-5 text-amber-500" />
                        </div>
                        <div>
                            <h3 className="text-white font-bold text-sm mb-1">{t.pro_benefit_3}</h3>
                            <p className="text-slate-400 text-xs leading-relaxed">{t.pro_benefit_desc_3}</p>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB: ELIGIBILITY CHECK */}
            {step === 'CHECK' && (
                <div className="px-6 space-y-4 mb-6 flex-1 animate-in slide-in-from-right">
                    <div className="text-xs text-slate-400 uppercase tracking-widest font-bold mb-2">{t.pro_crit_title}</div>
                    
                    <div className={`p-3 rounded-xl border flex items-center justify-between ${hasTaskHistory ? 'bg-emerald-950/30 border-emerald-500/30' : 'bg-slate-900 border-slate-800 opacity-50'}`}>
                        <div className="text-sm text-white">{t.pro_crit_1}</div>
                        {hasTaskHistory ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <div className="w-5 h-5 rounded-full border-2 border-slate-600"></div>}
                    </div>

                    <div className={`p-3 rounded-xl border flex items-center justify-between ${hasRecommendations ? 'bg-emerald-950/30 border-emerald-500/30' : 'bg-slate-900 border-slate-800 opacity-50'}`}>
                        <div className="text-sm text-white">{t.pro_crit_2}</div>
                        {hasRecommendations ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <div className="w-5 h-5 rounded-full border-2 border-slate-600"></div>}
                    </div>

                    <div className={`p-3 rounded-xl border flex items-center justify-between ${isVerified ? 'bg-emerald-950/30 border-emerald-500/30' : 'bg-slate-900 border-slate-800 opacity-50'}`}>
                        <div className="text-sm text-white">{t.pro_crit_4}</div>
                        {isVerified ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <div className="w-5 h-5 rounded-full border-2 border-slate-600"></div>}
                    </div>

                    <div className={`p-3 rounded-xl border bg-slate-900 border-slate-800`}>
                        <div className="text-sm text-white mb-2">{t.pro_crit_3}</div>
                        <select
                            className="w-full bg-black text-white text-xs p-2 rounded border border-slate-700 outline-none focus:border-amber-500"
                            value={expertise}
                            onChange={(e) => setExpertise(e.target.value)}
                        >
                            <option value="">Select Area...</option>
                            {Object.entries(PROFESSION_CONFIG).map(([name, info]) => (
                                <option key={info.expertise} value={info.expertise}>
                                    {info.icon} {name} · {info.realSkill}
                                </option>
                            ))}
                        </select>
                        <div className="text-[9px] text-slate-500 mt-1.5">已按你的职业「{user.profession}」预填</div>
                    </div>
                </div>
            )}

            {/* Disclaimer Footer - Always Visible */}
            <div className="px-6 mt-auto">
                <div className="bg-slate-900 border border-slate-700 p-3 rounded-lg text-[9px] text-slate-500 leading-relaxed mb-4 text-justify">
                    {t.pro_disclaimer}
                </div>
            </div>

            {/* Action Bar */}
            <div className="p-6 pt-0">
                {step === 'INFO' && (
                    <button 
                        onClick={() => setStep('CHECK')}
                        className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all border border-slate-600"
                    >
                        <span>{t.pro_action_check}</span>
                    </button>
                )}

                {step === 'CHECK' && (
                    <button 
                        onClick={handleApply}
                        disabled={!conditionsMet}
                        className={`w-full font-bold py-4 rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all ${conditionsMet ? 'bg-gradient-to-r from-amber-600 to-yellow-600 text-white shadow-[0_0_20px_rgba(245,158,11,0.3)]' : 'bg-slate-800 text-slate-500 cursor-not-allowed'}`}
                    >
                        {conditionsMet ? (
                            <>
                                <span>{t.pro_action_apply}</span>
                                <span className="w-[1px] h-4 bg-white/20 mx-1"></span>
                                <span className="font-mono">{t.pro_price}</span>
                            </>
                        ) : (
                            <span className="flex items-center gap-2"><Lock className="w-4 h-4" /> Eligibility Not Met</span>
                        )}
                    </button>
                )}

                {step === 'APPLYING' && (
                    <button disabled className="w-full bg-slate-900 text-amber-500 font-bold py-4 rounded-xl flex items-center justify-center gap-3 border border-amber-900/50">
                        <div className="w-5 h-5 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin"></div>
                        {t.pro_status_review}
                    </button>
                )}
            </div>

        </div>
      </div>
    </div>
  );
};

export default ProMembershipModal;
