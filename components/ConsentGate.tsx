import React, { useState } from 'react';
import { ShieldCheck, MapPin, Check, FileText, Info } from 'lucide-react';

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
    // 原先这里是全大写的 DATA PROCESSING NOTICE——终端腔的英文小标签，可爱风格里换成一句人话
    subtitle: '开始冒险之前，先把两件事说清楚',
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
    optional: '可选',
    needIdentity: '先勾选「账号与档案」才能开始',
    readPrivacy: '完整隐私说明见 PRIVACY.md',
  },
  en: {
    title: 'Data Processing Notice & Consent',
    subtitle: 'Two things to settle before the adventure',
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
    optional: 'Optional',
    needIdentity: 'Tick “Account & Profile” to start',
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

  /*
   * 两个授权项做成「选择卡」：左侧圆章说明是什么，右侧开关说明开没开。
   * 圆章的色调与全站语义一致——档案 = 信任（青绿），位置 = 信息（天蓝）。
   */
  const items = [
    {
      key: 'identity' as const,
      Icon: ShieldCheck,
      medal: 'bg-cute-teal-50 text-cute-teal-600',
      title: t.identityTitle,
      body: t.identityBody,
      required: true,
    },
    {
      key: 'location' as const,
      Icon: MapPin,
      medal: 'bg-cute-sky-50 text-cute-sky-600',
      title: t.locationTitle,
      body: t.locationBody,
      required: false,
    },
  ];

  return (
    <div className="cute-root cute-page fixed inset-0 z-[2100] flex flex-col">
      <div className="mx-auto flex h-full w-full max-w-md flex-col">
        <div className="shrink-0 px-4 pb-4 pt-[calc(1.75rem+env(safe-area-inset-top))] text-center sm:px-6 [@media(max-height:700px)]:pt-[calc(1rem+env(safe-area-inset-top))]">
          {/* 装饰圆章：矮视口（笔记本内容区）收起，把高度留给授权项 */}
          <div className="relative mx-auto mb-3 grid h-16 w-16 place-items-center rounded-full border-4 border-white bg-cute-teal-50 text-cute-teal-600 shadow-cute-2 [@media(max-height:700px)]:hidden">
            <FileText className="h-8 w-8" strokeWidth={2.25} aria-hidden />
          </div>
          <h1 className="cute-title">{t.title}</h1>
          <p className="mt-1 text-cute-sm text-cute-ink-2">{t.subtitle}</p>
        </div>

        {/*
          滚动区底边 24px 渐隐：隐藏了滚动条，内容被底栏截住时靠这道渐隐提示「下面还有」；
          底部内边距同样留 24px，滚到底时最后一行不会落在渐隐里。
        */}
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto no-scrollbar px-4 pb-6 pt-1 sm:px-6 [mask-image:linear-gradient(to_bottom,#000_calc(100%_-_24px),transparent)]">
          <p className="text-cute-sm font-semibold text-cute-ink-2">{t.intro}</p>

          {items.map((item) => {
            const checked = consent[item.key];
            return (
              <button
                type="button"
                key={item.key}
                onClick={() => setConsent((c) => ({ ...c, [item.key]: !c[item.key] }))}
                aria-pressed={checked}
                // 选中 = 青色内圈 + 开关推到右侧并出现勾：形状、位置、颜色三条线索同时变化
                className={`flex w-full items-start gap-3 rounded-cute-card bg-cute-panel p-4 text-left shadow-cute-2 ring-inset transition-[box-shadow,transform] duration-cute-fast active:scale-[0.98] focus-visible:outline-none focus-visible:shadow-cute-focus motion-reduce:transition-none motion-reduce:active:scale-100 ${
                  checked ? 'ring-2 ring-cute-teal-400' : 'ring-1 ring-cute-line'
                }`}
              >
                <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${item.medal}`}>
                  <item.Icon className="h-6 w-6" strokeWidth={2.25} aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="mb-1 flex flex-wrap items-center gap-2">
                    <span className="text-cute-body font-extrabold text-cute-ink">{item.title}</span>
                    <span className={`cute-chip cute-chip-sm ${item.required ? 'cute-tone-teal' : 'cute-tone-neutral'}`}>
                      {item.required ? t.required : t.optional}
                    </span>
                  </span>
                  <span className="block text-cute-sm font-semibold text-cute-ink-2">{item.body}</span>
                </span>
                {/* 开关：关 = 浅槽 + 灰色圆点（槽边用输入框描边色，对白底 ≥ 3:1）；开 = 青色槽 + 白点里一个勾 */}
                <span
                  className={`relative mt-1 inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors duration-cute-fast motion-reduce:transition-none ${
                    checked ? 'bg-cute-teal-600' : 'bg-cute-panel-3 ring-2 ring-inset ring-cute-line-input'
                  }`}
                  aria-hidden
                >
                  <span
                    className={`absolute left-0.5 grid h-6 w-6 place-items-center rounded-full transition-transform duration-cute-base ease-cute-spring motion-reduce:transition-none ${
                      checked ? 'translate-x-5 bg-white text-cute-teal-600 shadow-cute-1' : 'translate-x-0 bg-cute-line-input text-transparent'
                    }`}
                  >
                    <Check className="h-4 w-4" strokeWidth={3} />
                  </span>
                </span>
              </button>
            );
          })}

          <div className="cute-panel-inset space-y-2 text-cute-sm font-semibold text-cute-ink-2">
            <p className="flex gap-2">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-cute-sky-600" aria-hidden />
              <span>{t.retention}</span>
            </p>
            <p className="border-t border-cute-line pt-2 text-cute-ink-3">{t.notEmployment}</p>
            <p className="text-cute-ink-3">{t.readPrivacy}</p>
          </div>
        </div>

        {/* 主按钮钉底，不进滚动区；底边距含安全区，并给玩具按钮的厚边留位置 */}
        <div className="shrink-0 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 sm:px-6">
          {!canProceed && (
            <p id="consent-need-identity" className="mb-2 text-center text-cute-sm font-bold text-cute-ink-3">
              {t.needIdentity}
            </p>
          )}
          <button
            type="button"
            disabled={!canProceed}
            onClick={() => onAccept(consent)}
            aria-describedby={canProceed ? undefined : 'consent-need-identity'}
            // 原语默认不换行；英文文案有 46 个字符，手机上一行放不下，允许折成两行而不是溢出按钮
            className="cute-btn cute-btn-primary cute-btn-block whitespace-normal py-2 text-center"
          >
            {t.agree}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConsentGate;
