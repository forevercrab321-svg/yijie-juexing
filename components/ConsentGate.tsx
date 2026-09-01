import React, { useState } from 'react';
import { ShieldCheck, MapPin, FileText, Check } from 'lucide-react';

/**
 * 需要独立同意的数据处理。
 *
 * 相貌改为从现成图库随机抽取后，应用不再采集任何生物特征，
 * 原先的 biometric 项已整项移除——摄像头权限也不再申请。
 */
export interface ConsentState {
  identity: boolean;
  location: boolean;
}

interface ConsentGateProps {
  onAccept: (consent: ConsentState) => void;
  lang: 'zh' | 'en';
}

const COPY = {
  zh: {
    title: '数据处理告知与同意',
    subtitle: 'DATA PROCESSING NOTICE',
    intro:
      '在你开始之前，我们需要就两类数据分别取得你的同意。你可以只同意其中一部分，但未同意的功能将不可用。',
    identityTitle: '账号与档案',
    identityBody:
      '我们会保存你的代号、简介与专属形象，用于在社区中辨识你。现在不需要真实姓名或证件号——' +
      '只有当你主动去做「信任认证」（参加需要核实身份的线下活动时才用得上）才会填写，' +
      '届时证件号仅在你的设备上完成校验，只保留末四位掩码，原文不会被保存、也不会离开你的设备。',
    locationTitle: '精确位置',
    locationBody:
      '任务需要确认你确实到达了现场。我们在你打开应用期间读取 GPS 位置，仅用于计算你与任务点的距离，不生成轨迹记录，不与第三方共享。',
    retention:
      '留存政策：以上数据均不写入服务器数据库。你的档案与专属形象保存在这台设备的本地存储中，' +
      '这样形象只需生成一次、下次打开还是同一个你。数据不会离开本机，你可以随时在「个人档案 → 清除本设备数据」中一键删除。',
    notEmployment:
      '本平台是社区志愿互助系统，不是雇佣平台，不经手任何资金，不提供收入担保。',
    agree: '我已阅读并同意所勾选的项目',
    required: '必选',
    readPrivacy: '完整隐私说明见 PRIVACY.md',
  },
  en: {
    title: 'Data Processing Notice & Consent',
    subtitle: 'DATA PROCESSING NOTICE',
    intro:
      'Before you begin, we need your consent for two categories of data, separately. You may consent to only some of them; features you decline will be unavailable.',
    identityTitle: 'Account & Profile',
    identityBody:
      'We store your handle, bio, and avatar so the community can recognise you. No legal name or ID number is required now — ' +
      'those are only collected if you choose to complete Trust Verification (needed only for offline events that verify identity), ' +
      'and even then the ID is validated locally, reduced to a last-four mask, never stored, and never leaves your device.',
    locationTitle: 'Precise Location',
    locationBody:
      'Quests require confirming that you actually reached the site. We read your GPS position while the app is open, solely to compute your distance to the quest location. No movement history is created and nothing is shared with third parties.',
    retention:
      'Retention: none of this is written to a server database. Your profile and avatar are stored locally on this device, ' +
      'so the avatar is generated once and stays the same next time. The data never leaves this machine, and you can delete it at any time via Profile → Clear device data.',
    notEmployment:
      'This platform is a voluntary community mutual-aid system. It is not an employer, handles no funds, and guarantees no income.',
    agree: 'I have read and consent to the items I checked',
    required: 'Required',
    readPrivacy: 'Full notice: PRIVACY.md',
  },
};

const ConsentGate: React.FC<ConsentGateProps> = ({ onAccept, lang }) => {
  const t = COPY[lang];
  const [consent, setConsent] = useState<ConsentState>({
    identity: false,
    location: false,
  });

  // 身份信息是进入流程的最低要求；人脸与定位都可以拒绝，功能相应降级。
  const canProceed = consent.identity;

  const items = [
    {
      key: 'identity' as const,
      icon: <ShieldCheck className="w-5 h-5 text-amber-500" />,
      title: t.identityTitle,
      body: t.identityBody,
      required: true,
    },
    {
      key: 'location' as const,
      icon: <MapPin className="w-5 h-5 text-emerald-500" />,
      title: t.locationTitle,
      body: t.locationBody,
      required: false,
    },
  ];

  return (
    <div className="fixed inset-0 z-[2100] bg-slate-950 flex flex-col font-sans">
      <div className="w-full max-w-md mx-auto flex flex-col h-full">
        <div className="pt-[calc(3rem+env(safe-area-inset-top))] px-6 pb-4 text-center">
          <div className="w-14 h-14 mx-auto bg-slate-900 rounded-2xl flex items-center justify-center border border-amber-500/30 mb-4">
            <FileText className="w-7 h-7 text-amber-500" />
          </div>
          <h1 className="text-xl font-['Cinzel'] font-bold text-white tracking-widest">
            {t.title}
          </h1>
          <p className="text-[10px] text-slate-500 mt-2 tracking-[0.2em]">{t.subtitle}</p>
        </div>

        <div className="flex-1 overflow-y-auto px-6 space-y-3 no-scrollbar">
          <p className="text-xs text-slate-400 leading-relaxed">{t.intro}</p>

          {items.map((item) => {
            const checked = consent[item.key];
            return (
              <button
                key={item.key}
                onClick={() => setConsent((c) => ({ ...c, [item.key]: !c[item.key] }))}
                className={`w-full text-left p-4 rounded-2xl border transition-colors ${
                  checked
                    ? 'bg-slate-900 border-amber-500/50'
                    : 'bg-slate-900/40 border-slate-800'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex-shrink-0">{item.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-bold text-white">{item.title}</h3>
                      {item.required && (
                        <span className="text-[9px] text-amber-500 border border-amber-500/40 px-1.5 py-0.5 rounded">
                          {t.required}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">{item.body}</p>
                  </div>
                  <div
                    className={`w-6 h-6 rounded-lg flex-shrink-0 flex items-center justify-center border transition-colors ${
                      checked
                        ? 'bg-amber-500 border-amber-400 text-black'
                        : 'border-slate-600 text-transparent'
                    }`}
                  >
                    <Check className="w-4 h-4" />
                  </div>
                </div>
              </button>
            );
          })}

          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 space-y-2">
            <p className="text-[10px] text-slate-400 leading-relaxed">{t.retention}</p>
            <p className="text-[10px] text-slate-500 leading-relaxed border-t border-slate-800 pt-2">
              {t.notEmployment}
            </p>
            <p className="text-[10px] text-slate-600">{t.readPrivacy}</p>
          </div>
        </div>

        <div className="p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
          <button
            disabled={!canProceed}
            onClick={() => onAccept(consent)}
            className="w-full bg-amber-600 disabled:bg-slate-800 disabled:text-slate-600 text-white font-bold py-4 rounded-xl transition-all active:scale-95"
          >
            {t.agree}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConsentGate;
