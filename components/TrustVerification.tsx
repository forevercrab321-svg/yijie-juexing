import React, { useEffect, useRef, useState } from 'react';
import { X, ShieldCheck, ArrowRight, Lock, Info } from 'lucide-react';
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
  /** 每报一次错加一：作为输入框的 key 重新挂载，让「摇头」动画在连续出错时也能再播一次 */
  const [errorNonce, setErrorNonce] = useState(0);

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
      setErrorNonce((n) => n + 1);
      return;
    }
    setIdError(null);
    const masked = maskId(idCard);
    setIdCard(''); // 原文到此为止
    onComplete({ realName: realName.trim(), idCardMasked: masked });
  };

  const canSubmit = !!realName.trim() && !!idCard;

  // 初始焦点放在关闭钮而不是第一个输入框：手机上自动聚焦输入框会立刻弹出键盘，盖住还没读的说明
  const closeRef = useRef<HTMLButtonElement>(null);
  const idRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    closeRef.current?.focus({ preventScroll: true });
    return () => { if (prev && document.contains(prev)) prev.focus({ preventScroll: true }); };
  }, []);
  // 报错后输入框因 key 变化重新挂载，焦点会丢——补回去，玩家可以直接改
  useEffect(() => { if (errorNonce > 0) idRef.current?.focus({ preventScroll: true }); }, [errorNonce]);

  return (
    <div
      className="cute-root fixed inset-0 z-[1500]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="trust-title"
      data-testid="trust-verification"
      onKeyDown={(e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose(); } }}
    >
      <div className="cute-scrim" onClick={onClose} aria-hidden />

      {/*
        表单包一层：在输入框里按回车即提交，行为与点「完成认证」一致。
        手机底边距加到 7.5rem + 安全区：避开永远浮在最上层的艾琳娜入口；关闭钮吸顶。理由都见 ProfileModal。
      */}
      <form
        className="cute-sheet max-sm:pb-[calc(7.5rem_+_var(--sab,0px))]"
        onSubmit={(e) => { e.preventDefault(); if (canSubmit) submit(); }}
        noValidate
      >
        <div className="pointer-events-none sticky top-3 z-10 -mb-10 flex justify-end">
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="关闭信任认证"
            className="cute-icon-btn cute-icon-btn-sm pointer-events-auto"
          >
            <X strokeWidth={2.5} aria-hidden />
          </button>
        </div>

        <div className="px-6 pb-4 pt-2 text-center">
          <div className="mx-auto mb-3 grid h-16 w-16 place-items-center rounded-full border-4 border-white bg-cute-success-50 text-cute-success-600 shadow-cute-2">
            <ShieldCheck className="h-8 w-8" strokeWidth={2.25} aria-hidden />
          </div>
          <h2 id="trust-title" className="cute-title">信任认证</h2>
          {/* 原先这里是 OPTIONAL · TRUST BADGE 的全大写英文小字，换成「可选」标签 + 一句人话 */}
          <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
            <span className="cute-chip cute-chip-sm cute-tone-neutral">可选</span>
            <span className="text-cute-sm font-semibold text-cute-ink-2">线下活动核实身份时才需要</span>
          </div>
        </div>

        <div className="space-y-4">
          <p className="cute-panel-inset flex gap-2 text-cute-sm font-semibold text-cute-ink-2">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-cute-sky-600" aria-hidden />
            <span>
              这是可选的。日常玩耍、接委托、逛地图都不需要认证。
              只有参加需要核实身份的线下活动时，主办方才会要求你带上这枚徽章。
            </span>
          </p>

          <div>
            <label htmlFor="trust-real-name" className="cute-field-label">真实姓名</label>
            <input
              id="trust-real-name"
              value={realName}
              onChange={(e) => setRealName(e.target.value)}
              autoComplete="off"
              className="cute-input"
              placeholder="与证件一致"
            />
          </div>

          <div>
            <label htmlFor="trust-id-card" className="cute-field-label">证件号</label>
            <input
              key={errorNonce}
              ref={idRef}
              id="trust-id-card"
              value={idCard}
              onChange={(e) => {
                setIdCard(e.target.value);
                setIdError(null);
              }}
              autoComplete="off"
              spellCheck={false}
              aria-invalid={idError ? true : undefined}
              aria-describedby={idError ? 'trust-id-error' : 'trust-id-hint'}
              // 证件号用等宽数字（不是等宽字体）对齐；出错时摇一下头，比单纯变红更像游戏的反馈
              className={`cute-input tabular-nums ${idError ? 'animate-cute-wiggle motion-reduce:animate-none' : ''}`}
              placeholder="本机校验，原文不上传、不保存"
            />
            {idError
              ? <p id="trust-id-error" className="cute-field-error" role="alert">{idError}</p>
              : <p id="trust-id-hint" className="cute-field-hint">只保留末四位掩码</p>}
          </div>

          <p className="flex gap-2 border-t border-cute-line pt-3 text-cute-sm font-semibold text-cute-ink-3">
            <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>证件号在你的设备上完成校验后，只保留末四位掩码；原文不会离开本机，也不会被保存。</span>
          </p>

          <div className="pb-1">
            {!canSubmit && (
              <p id="trust-need-fields" className="mb-2 text-center text-cute-sm font-bold text-cute-ink-3">
                填好姓名与证件号就可以提交
              </p>
            )}
            <button
              type="submit"
              disabled={!canSubmit}
              aria-describedby={canSubmit ? undefined : 'trust-need-fields'}
              className="cute-btn cute-btn-primary cute-btn-block"
            >
              完成认证 <ArrowRight aria-hidden />
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default TrustVerification;
