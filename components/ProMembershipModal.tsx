
import React, { useEffect, useRef, useState } from 'react';
import { TRANSLATIONS, PROFESSION_CONFIG } from '../constants';
import { User } from '../types';
import { X, Crown, ShieldCheck, Zap, Eye, CircleCheck, Info, Lock, Sparkles, Hourglass } from 'lucide-react';

interface ProMembershipModalProps {
  onClose: () => void;
  onUpgrade: () => void;
  lang: 'zh' | 'en';
  user: User;
}

/*
 * 简体覆盖。constants.ts 的 TRANSLATIONS.zh 里执照相关文案还是繁体（「職業獵人執照」…），
 * 风格指南要求全站统一简体，但 constants.ts 不在本分工的文件范围内——先在这里覆盖，
 * 交接文档请集成者把 TRANSLATIONS.zh 改成简体后删掉这张表。英文原样使用 TRANSLATIONS.en。
 */
const ZH_SIMPLIFIED = {
  pro_title: '职业猎人执照',
  pro_subtitle: '成为传说中的存在',
  pro_def_is: '这代表你的身份已经被公会认证啦！',
  pro_def_not: '这不是工作合约，而是一种荣耀。',
  pro_benefit_1: '专属公会徽章',
  pro_benefit_desc_1: '你的名字旁边会有闪亮亮的星星哦！',
  pro_benefit_2: '优先接取任务',
  pro_benefit_desc_2: '好的委托当然要留给最厉害的你～',
  pro_benefit_3: '特殊装备支援',
  pro_benefit_desc_3: '可以申请赞助商提供的强力装备！',
  pro_crit_title: '申请条件确认',
  pro_crit_1: '至少完成过 3 次委托',
  pro_crit_2: '获得 2 次以上的推荐',
  pro_crit_3: '选择你的专长领域',
  pro_crit_4: '完成实名认证',
  pro_disclaimer: '这只是公会内部的身份认证，不代表劳雇关系哦，记得哦。',
  pro_action_check: '检查我的资格',
  pro_action_apply: '立即申请执照',
  pro_price: '免费',
  pro_status_review: '资料审核中…',
};

/** 本组件自己的小字：原先写死的英文（Eligibility Not Met / Select Area...）在中文界面里也是英文 */
const LOCAL = {
  zh: {
    close: '关闭执照申请',
    met: '已满足',
    unmet: '未满足',
    progress: (n: number) => `已满足 ${n} / 4 项，需要 2 项`,
    notMet: '资格未满足',
    notMetHint: '至少满足 2 项条件才能申请',
    selectArea: '请选择专长领域…',
    prefilled: (p: string) => `已按你的职业「${p}」预填`,
  },
  en: {
    close: 'Close license application',
    met: 'Met',
    unmet: 'Not yet',
    progress: (n: number) => `${n} of 4 met · 2 needed`,
    notMet: 'Eligibility Not Met',
    notMetHint: 'Meet at least 2 conditions to apply',
    selectArea: 'Select Area...',
    prefilled: (p: string) => `Pre-filled from your profession “${p}”`,
  },
};

const ProMembershipModal: React.FC<ProMembershipModalProps> = ({ onClose, onUpgrade, lang, user }) => {
  const t = lang === 'zh' ? { ...TRANSLATIONS.zh, ...ZH_SIMPLIFIED } : TRANSLATIONS.en;
  const l = LOCAL[lang];
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
  const metCount = [hasTaskHistory, hasRecommendations, hasExpertise, isVerified].filter(Boolean).length;
  const conditionsMet = metCount >= 2;

  const handleApply = () => {
    setStep('APPLYING');
    // Simulate manual review process
    setTimeout(() => {
      onUpgrade();
      onClose();
    }, 2500);
  };

  // 初始焦点进弹层、关闭后还给打开它的按钮；理由见 ProfileModal
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    closeRef.current?.focus({ preventScroll: true });
    return () => { if (prev && document.contains(prev)) prev.focus({ preventScroll: true }); };
  }, []);

  const benefits = [
    { Icon: ShieldCheck, title: t.pro_benefit_1, desc: t.pro_benefit_desc_1 },
    { Icon: Eye, title: t.pro_benefit_2, desc: t.pro_benefit_desc_2 },
    { Icon: Zap, title: t.pro_benefit_3, desc: t.pro_benefit_desc_3 },
  ];

  /*
   * 条件行：满足 = 成功绿浅底 + 实心勾 +「已满足」；未满足 = 白底描边 + 空心圈 +「未满足」。
   * 上一版未满足的行只是整体变淡（opacity-50），靠「淡」暗示状态，色弱与强光下都读不出——现在写成文字。
   */
  const criteria = [
    { ok: hasTaskHistory, label: t.pro_crit_1 },
    { ok: hasRecommendations, label: t.pro_crit_2 },
    { ok: isVerified, label: t.pro_crit_4 },
  ];

  return (
    <div
      className="cute-root fixed inset-0 z-[1400]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pro-title"
      data-testid="pro-modal"
      onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose(); } }}
    >
      <div className="cute-scrim" onClick={onClose} aria-hidden />

      {/* 手机底边距加到 7.5rem + 安全区：避开永远浮在最上层的艾琳娜入口；关闭钮吸顶。理由都见 ProfileModal */}
      <div className="cute-sheet max-sm:pb-[calc(7.5rem_+_var(--sab,0px))]">
        <div className="pointer-events-none sticky top-3 z-10 -mb-10 flex justify-end">
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label={l.close}
            className="cute-icon-btn cute-icon-btn-sm pointer-events-auto"
          >
            <X strokeWidth={2.5} aria-hidden />
          </button>
        </div>

        {/* 标题区：暖黄皇冠章（黄底深棕图标）微微歪着，像刚盖上去的印 */}
        <div className="px-6 pb-4 pt-2 text-center">
          <div className="mx-auto mb-3 grid h-16 w-16 rotate-6 place-items-center rounded-cute-lg border-4 border-white bg-cute-sun-400 text-cute-sun-ink shadow-[0_4px_0_var(--cute-sun-lip),var(--cute-shadow-2)]">
            <Crown className="h-8 w-8" strokeWidth={2.25} aria-hidden />
          </div>
          <h2 id="pro-title" className="cute-title">{t.pro_title}</h2>
          <p className="mt-1 text-cute-sm text-cute-ink-2">{t.pro_subtitle}</p>
        </div>

        {/* 是什么 / 不是什么：一条成功色、一条提示色，各配图标，不只靠颜色区分 */}
        <div className="space-y-2">
          <div className="flex items-start gap-2 rounded-cute-md bg-cute-success-50 px-3 py-2.5 text-cute-sm font-bold text-cute-success-600">
            <CircleCheck className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.5} aria-hidden />
            <span>{t.pro_def_is}</span>
          </div>
          <div className="flex items-start gap-2 rounded-cute-md bg-cute-warn-50 px-3 py-2.5 text-cute-sm font-bold text-cute-warn-600">
            <Info className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2.5} aria-hidden />
            <span>{t.pro_def_not}</span>
          </div>
        </div>

        {/* TAB: INFO */}
        {step === 'INFO' && (
          <ul className="mt-4 space-y-2">
            {benefits.map(({ Icon, title, desc }) => (
              <li key={title} className="flex items-start gap-3 rounded-cute-card p-3 ring-1 ring-inset ring-cute-line">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-cute-sun-50 text-cute-sun-600">
                  <Icon className="h-5 w-5" strokeWidth={2.25} aria-hidden />
                </span>
                <div className="min-w-0">
                  <div className="text-cute-body font-extrabold text-cute-ink">{title}</div>
                  <p className="text-cute-sm font-semibold text-cute-ink-2">{desc}</p>
                </div>
              </li>
            ))}
          </ul>
        )}

        {/* TAB: ELIGIBILITY CHECK */}
        {(step === 'CHECK' || step === 'APPLYING') && (
          <div className="mt-4 space-y-2 animate-cute-pop motion-reduce:animate-none">
            <div className="flex items-baseline justify-between gap-2">
              <div className="text-cute-body font-extrabold text-cute-ink">{t.pro_crit_title}</div>
              <div className="cute-num text-cute-sm font-bold text-cute-ink-3">{l.progress(metCount)}</div>
            </div>
            {/* 进度条：满 2 项就够了，所以按「4 项中满足几项」填，2 项处正好过半 */}
            <div
              className="cute-progress cute-tone-success"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={4}
              aria-valuenow={metCount}
              aria-label={l.progress(metCount)}
            >
              <div className="cute-progress-fill" style={{ width: `${(metCount / 4) * 100}%` }} data-empty={metCount === 0 ? 'true' : undefined} />
            </div>

            {criteria.map(({ ok, label }) => (
              <div
                key={label}
                className={`flex min-h-[52px] items-center gap-3 rounded-cute-md px-3 py-2 ${
                  ok ? 'bg-cute-success-50' : 'bg-cute-panel ring-1 ring-inset ring-cute-line-strong'
                }`}
              >
                {ok
                  ? <CircleCheck className="h-6 w-6 shrink-0 text-cute-success-600" strokeWidth={2.5} aria-hidden />
                  : <span className="h-6 w-6 shrink-0 rounded-full ring-2 ring-inset ring-cute-line-input" aria-hidden />}
                <span className="min-w-0 flex-1 text-cute-body font-bold text-cute-ink">{label}</span>
                <span className={`cute-chip cute-chip-sm ${ok ? 'cute-tone-success' : 'cute-tone-neutral'}`}>{ok ? l.met : l.unmet}</span>
              </div>
            ))}

            <div className={`rounded-cute-md px-3 py-3 ${hasExpertise ? 'bg-cute-success-50' : 'bg-cute-panel ring-1 ring-inset ring-cute-line-strong'}`}>
              <label htmlFor="pro-expertise" className="cute-field-label flex items-center justify-between gap-2">
                <span className="text-cute-body text-cute-ink">{t.pro_crit_3}</span>
                <span className={`cute-chip cute-chip-sm ${hasExpertise ? 'cute-tone-success' : 'cute-tone-neutral'}`}>{hasExpertise ? l.met : l.unmet}</span>
              </label>
              <select
                id="pro-expertise"
                className="cute-input"
                value={expertise}
                onChange={(e) => setExpertise(e.target.value)}
                aria-describedby="pro-expertise-hint"
                disabled={step === 'APPLYING'}
              >
                <option value="">{l.selectArea}</option>
                {/* 选项里不再带 emoji 图标（风格指南 3.9），职业名 + 现实技能已足够辨认 */}
                {Object.entries(PROFESSION_CONFIG).map(([name, info]) => (
                  <option key={info.expertise} value={info.expertise}>
                    {name} · {info.realSkill}
                  </option>
                ))}
              </select>
              <p id="pro-expertise-hint" className="cute-field-hint">{l.prefilled(user.profession)}</p>
            </div>
          </div>
        )}

        {/* Disclaimer Footer - Always Visible */}
        <p className="cute-panel-inset mt-4 text-cute-sm font-semibold text-cute-ink-3">
          {t.pro_disclaimer}
        </p>

        {/* Action Bar：底部留 4px 给玩具按钮的厚边 */}
        <div className="pb-1 pt-4">
          {step === 'INFO' && (
            <button
              type="button"
              onClick={() => setStep('CHECK')}
              className="cute-btn cute-btn-primary cute-btn-block"
            >
              <span>{t.pro_action_check}</span>
            </button>
          )}

          {step === 'CHECK' && (
            conditionsMet ? (
              // 申请执照是「领奖」类操作：暖黄奖励按钮，价格用竖线隔开
              <button type="button" onClick={handleApply} className="cute-btn cute-btn-sun cute-btn-block min-h-[56px] text-cute-lg">
                <Sparkles aria-hidden />
                <span>{t.pro_action_apply}</span>
                <span className="mx-1 h-4 w-0.5 rounded-full bg-cute-sun-ink/40" aria-hidden />
                <span>{t.pro_price}</span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  disabled
                  aria-describedby="pro-not-met"
                  className="cute-btn cute-btn-primary cute-btn-block"
                >
                  <Lock aria-hidden />
                  <span>{l.notMet}</span>
                </button>
                <p id="pro-not-met" className="mt-2 text-center text-cute-sm font-bold text-cute-ink-3">{l.notMetHint}</p>
              </>
            )
          )}

          {/*
            审核中是状态而不是操作：做成浅青色的状态条，而不是一枚禁用按钮——
            禁用态的灰字只有 3:1，「审核中」恰恰是这时最需要读清楚的一句话。
            减少动效时沙漏不转，文字照样说明状态。
          */}
          {step === 'APPLYING' && (
            <div role="status" className="flex min-h-[56px] items-center justify-center gap-2 rounded-cute-btn bg-cute-teal-50 text-cute-lg text-cute-teal-600">
              <Hourglass className="h-5 w-5 animate-spin [animation-duration:1.6s] motion-reduce:animate-none" strokeWidth={2.5} aria-hidden />
              <span>{t.pro_status_review}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProMembershipModal;
