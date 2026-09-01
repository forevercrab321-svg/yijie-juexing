import React, { useState } from 'react';
import { X, ShieldCheck, ArrowRight } from 'lucide-react';
import { validateId, maskId } from '../lib/identity';

interface TrustVerificationProps {
  onComplete: (data: { realName: string; idCardMasked: string }) => void;
  onClose: () => void;
}

/**
 * 信任认证（可选）。
 *
 * 从入门流程里挪出来的——玩游戏、逛地图、看活动都不需要它，
 * 只有要参加需要核实身份的线下活动时才补。放在个人档案里按需触发。
 *
 * 证件号仍然只在本机校验，通过后立刻转成末四位掩码，原文不进状态、不上传。
 */
const TrustVerification: React.FC<TrustVerificationProps> = ({ onComplete, onClose }) => {
  const [realName, setRealName] = useState('');
  const [idCard, setIdCard] = useState('');
  const [idError, setIdError] = useState<string | null>(null);

  const submit = () => {
    const result = validateId(idCard);
    if (!result.valid) {
      const messages: Record<string, string> = {
        EMPTY: '请填写证件号',
        FORMAT: '证件号只能包含字母和数字',
        CHECKSUM: '身份证号校验位不正确，请检查是否输入有误',
        TOO_SHORT: '证件号长度不足',
      };
      setIdError(messages[result.reason ?? 'FORMAT'] ?? '证件号无效');
      return;
    }
    setIdError(null);
    const masked = maskId(idCard);
    setIdCard(''); // 原文到此为止
    onComplete({ realName: realName.trim(), idCardMasked: masked });
  };

  return (
    <div className="fixed inset-0 z-[1500] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        <div className="p-6 pb-4 text-center relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="w-14 h-14 mx-auto bg-slate-800 rounded-2xl flex items-center justify-center border border-amber-500/30 mb-4">
            <ShieldCheck className="w-7 h-7 text-amber-500" />
          </div>
          <h2 className="text-xl font-['Cinzel'] font-bold text-white tracking-widest">信任认证</h2>
          <p className="text-[10px] text-slate-500 mt-2 tracking-[0.2em]">OPTIONAL · TRUST BADGE</p>
        </div>

        <div className="px-6 pb-6 overflow-y-auto no-scrollbar space-y-5">
          <div className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-4 text-xs text-slate-400 leading-relaxed">
            这是可选的。日常玩耍、接委托、逛地图都不需要认证。
            只有参加需要核实身份的线下活动时，主办方才会要求你带上这枚徽章。
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-amber-400 uppercase tracking-wider ml-1">
              真实姓名 (Real Name)
            </label>
            <input
              value={realName}
              onChange={(e) => setRealName(e.target.value)}
              autoComplete="off"
              className="w-full bg-black/40 border border-slate-600 focus:border-amber-500 rounded-xl px-4 py-3 text-white placeholder-slate-600 outline-none transition-colors"
              placeholder="与证件一致"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-bold text-amber-400 uppercase tracking-wider ml-1">
              证件号 (ID Number)
            </label>
            <input
              value={idCard}
              onChange={(e) => {
                setIdCard(e.target.value);
                setIdError(null);
              }}
              autoComplete="off"
              spellCheck={false}
              className={`w-full bg-black/40 border rounded-xl px-4 py-3 text-white placeholder-slate-600 outline-none transition-colors font-mono ${
                idError ? 'border-red-500' : 'border-slate-600 focus:border-amber-500'
              }`}
              placeholder="本机校验，原文不上传、不保存"
            />
            {idError && <div className="text-[10px] text-red-400 ml-1 pt-1">{idError}</div>}
          </div>

          <div className="text-[10px] text-slate-500 leading-relaxed border-t border-slate-800 pt-3">
            证件号在你的设备上完成校验后，只保留末四位掩码；原文不会离开本机，也不会被保存。
          </div>

          <button
            disabled={!realName.trim() || !idCard}
            onClick={submit}
            className="w-full bg-amber-600 disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95"
          >
            完成认证 <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default TrustVerification;
