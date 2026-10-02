
import React, { useState, useEffect, useId, useMemo, useRef } from 'react';
import { Camera, MapPinOff, Navigation, Search, X } from 'lucide-react';
import { distanceMeters, PROOF_RADIUS_METERS } from '../lib/geo';
import { UI_STRINGS, rememberedUiLang, type UiLang } from './world/ui/strings';
import './world/ui/worldUi.css';

interface ProofSubmissionProps {
  questLocation: [number, number];
  userLocation: [number, number] | null;
  /** GPS 精度（米）。精度太差时不能据此判定是否到场。 */
  locationAccuracy: number | null;
  onConfirm: () => void;
  onCancel: () => void;
  /**
   * 界面语言（QA-R2-03：切到英文后这里原先仍是中文）。新增的可选字段，旧调用不受影响；
   * 不传时沿用 TopHud / ActiveQuestHUD 最近一次收到的语言（strings.ts 的 rememberedUiLang）。
   */
  lang?: UiLang;
}

/** 精度差于这个值时，距离判定没有意义，要求用户到开阔处重试。 */
const MAX_USABLE_ACCURACY = 120;

type Gate =
  | { kind: 'OK'; distance: number }
  | { kind: 'NO_LOCATION' }
  | { kind: 'LOW_ACCURACY'; accuracy: number }
  | { kind: 'TOO_FAR'; distance: number };

const isEditable = (el: EventTarget | null) =>
  el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));

const ProofSubmission: React.FC<ProofSubmissionProps> = ({
  questLocation,
  userLocation,
  locationAccuracy,
  onConfirm,
  onCancel,
  lang,
}) => {
  const t = UI_STRINGS[lang ?? rememberedUiLang()];
  const titleId = useId();
  const [status, setStatus] = useState<'IDLE' | 'SCANNING' | 'ANALYZING' | 'GRADING' | 'SUCCESS'>('IDLE');
  const [preview, setPreview] = useState<string | null>(null);

  /**
   * 到场校验。原先这里没有任何校验——传张图跑完动画就能升级拿币，
   * 刷分零成本。现在提交入口由真实 GPS 距离把守。
   *
   * 注意这仍是客户端判定，能被改过的客户端绕过。真正可信的校验必须在服务端
   * 复核位置与照片元数据，见 PRIVACY.md 与改造说明中的"仍未闭合"部分。
   */
  const gate = useMemo<Gate>(() => {
    if (!userLocation) return { kind: 'NO_LOCATION' };
    if (locationAccuracy !== null && locationAccuracy > MAX_USABLE_ACCURACY) {
      return { kind: 'LOW_ACCURACY', accuracy: locationAccuracy };
    }
    const distance = distanceMeters(userLocation, questLocation);
    return distance <= PROOF_RADIUS_METERS
      ? { kind: 'OK', distance }
      : { kind: 'TOO_FAR', distance };
  }, [userLocation, locationAccuracy, questLocation]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (gate.kind !== 'OK') return;
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setPreview(url);
      setStatus('SCANNING');
    }
  };

  // 预览 URL 用完必须回收，否则每提交一次就泄漏一份文件引用
  useEffect(() => {
    return () => { if (preview) URL.revokeObjectURL(preview); };
  }, [preview]);

  /*
   * 扫描 → 核对 → 评定 → 结算的计时链。
   *
   * 每一段都以「此刻仍在现场」为前提：原先这条链只看 status，上传那一刻过了校验，
   * 之后离开现场、定位丢失或精度变差，界面已经改口说「你还没有到达现场」，结算却照常完成并发奖（QA-R1-03）。
   * 现在 gate 不是 OK 时整条链暂停（依赖里有 gateOk，flip 的那一刻 cleanup 就清掉待触发的计时器），
   * 回到现场后从当前这一段重新计时。选择暂停而不是作废：曼哈顿楼群里定位精度瞬间跳到 120 m 以上很常见，
   * 抖一下就要重拍照片太苛刻；而「只有在现场时才会结算」这条不变量同样成立。
   */
  const gateOk = gate.kind === 'OK';
  useEffect(() => {
    if (!gateOk) return;
    if (status === 'SCANNING') {
        const id = setTimeout(() => setStatus('ANALYZING'), 1500);
        return () => clearTimeout(id);
    }
    if (status === 'ANALYZING') {
        const id = setTimeout(() => setStatus('GRADING'), 2000);
        return () => clearTimeout(id);
    }
    if (status === 'GRADING') {
        const id = setTimeout(() => onConfirm(), 1000);
        return () => clearTimeout(id);
    }
  }, [status, onConfirm, gateOk]);

  /*
   * 打开时把焦点放到面板上：读屏先念标题，键盘玩家下一个 Tab 就是关闭 / 上传，不会还停在地图后面的按钮上。
   * Esc 等同右上角的关闭（正在输入框里时不拦——上传控件本身就是 input，这里只认面板与按钮上的 Esc）。
   */
  const rootRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef(onCancel);
  cancelRef.current = onCancel;
  useEffect(() => {
    rootRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented && !isEditable(e.target)) cancelRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const distText = (m: number) => t.meters(m);
  const blockedCopy: Record<Exclude<Gate['kind'], 'OK'>, { title: string; body: string }> = {
    NO_LOCATION: { title: t.proofNoLocTitle, body: t.proofNoLocBody },
    LOW_ACCURACY: {
      title: t.proofLowAccTitle,
      body: t.proofLowAccBody(Math.round(gate.kind === 'LOW_ACCURACY' ? gate.accuracy : 0)),
    },
    TOO_FAR: {
      title: t.proofFarTitle,
      body: t.proofFarBody(distText(gate.kind === 'TOO_FAR' ? gate.distance : 0), PROOF_RADIUS_METERS),
    },
  };

  return (
    /*
      可爱风格（style-cute.md）：整页晴空底（.cute-page），中间一张白色「相框」卡，主操作是一枚青色的大圆相机钮。
      上一轮的墨色底、金色网格、全大写英文「AWAITING EVALUATION」一并去掉；「雇主」一词早已去掉——本平台是社区互助、不是雇佣平台。
      根节点保留 fixed inset-0 z-[1100]：叠层顺序与上一版一致（高于聚焦卡片 1050，低于结算卡 1250）。
    */
    <div
      ref={rootRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      data-testid="proof-submission"
      className="fixed inset-0 z-[1100] cute-root cute-page wui-proof flex flex-col items-center overflow-y-auto outline-none"
    >
      <header className="flex shrink-0 items-center gap-3 w-full max-w-lg min-h-[56px]">
        <h2 id={titleId} className="flex-1 m-0 text-cute-xl">{t.proofTitle}</h2>
        <button type="button" onClick={onCancel} className="cute-icon-btn" aria-label={t.proofCancel} title={t.proofCancel}>
          <X strokeWidth={2.5} aria-hidden="true" />
        </button>
      </header>

      <div className="flex grow shrink-0 flex-col items-center justify-center gap-4 w-full py-2">
      {gate.kind !== 'OK' ? (
        /* --- 未通过到场校验：不提供上传入口 --- */
        <div data-testid="proof-blocked" className="cute-panel cute-tone-warn w-full max-w-sm px-6 pt-7 pb-6 text-center">
          <div className="wui-tint grid place-items-center w-16 h-16 mx-auto mb-4 rounded-full" aria-hidden="true">
            <MapPinOff size={30} strokeWidth={2.5} />
          </div>
          <h3 className="mt-0 mb-2 text-cute-xl">{blockedCopy[gate.kind].title}</h3>
          <p className="mt-0 mb-5 text-cute-body text-cute-ink-2">{blockedCopy[gate.kind].body}</p>
          {/* 扫描途中被拦：照片还在，回到现场会接着评定，不用重拍 */}
          {status !== 'IDLE' && (
            <p data-testid="proof-paused" className="-mt-2 mb-5 text-cute-sm font-extrabold text-cute-warn-600">{t.proofPaused}</p>
          )}
          <button type="button" onClick={onCancel} className="cute-btn cute-btn-secondary cute-btn-block">
            {t.proofBack}
          </button>
        </div>
      ) : (
      <>
      <div className="wui-frame">
         {preview && <img src={preview} alt="" />}

         {/* 扫描：一道青色的光从上到下扫过照片；减少动态效果时光条不动，只看下面的状态字 */}
         {(status === 'SCANNING' || status === 'ANALYZING') && (
            <div className="wui-scan absolute inset-0 z-[1]" data-testid="proof-scanning">
                <i />
                <span className="absolute inset-x-0 bottom-7 flex justify-center">
                  {status === 'SCANNING'
                    ? <span className="cute-chip cute-tone-teal">{t.proofScanning}</span>
                    : <span className="cute-chip cute-tone-success">{t.proofAnalyzing}</span>}
                </span>
            </div>
         )}

         {status === 'GRADING' && (
             <div className="wui-grade absolute inset-0 z-[2] flex flex-col items-center justify-center gap-1.5 p-6 text-center" role="status">
                 <div className="grid place-items-center w-[72px] h-[72px] mb-2 rounded-full bg-cute-sky-50 text-cute-sky-600" aria-hidden="true"><Search size={32} strokeWidth={2.5} /></div>
                 <b className="font-cute-display text-cute-xl">{t.proofGradingTitle}</b>
                 <span className="text-cute-sm text-cute-ink-2">{t.proofGradingBody}</span>
             </div>
         )}

         {status === 'IDLE' && (
             <label className="wui-cam relative z-[1] flex flex-col items-center gap-3 max-w-[80%] text-center cursor-pointer">
                 {/*
                   capture 让移动端直接调起相机，减少「翻相册里的旧图」这一最简单的作弊路径。
                   input 只做视觉隐藏（不是 display:none）：键盘玩家仍能 Tab 到它、按空格打开相机，焦点环画在圆钮上。
                 */}
                 <input type="file" accept="image/*" capture="environment" onChange={handleFileChange} className="wui-sr" />
                 <span className="wui-cam-disc grid place-items-center w-32 h-32 border-4 rounded-full text-white" aria-hidden="true"><Camera size={44} strokeWidth={2.25} /></span>
                 <b className="text-cute-lg text-cute-teal-600">{t.proofUpload}</b>
                 <span className="text-cute-sm text-cute-ink-3">{t.proofUploadHint}</span>
             </label>
         )}
      </div>

      {/* 到场确认条 */}
      <p className="cute-chip cute-tone-success h-auto min-h-[34px] m-0 px-3.5 py-1.5 leading-5 whitespace-normal text-center">
        <Navigation strokeWidth={2.5} aria-hidden="true" />
        <span>{t.proofArrived(distText(gate.distance))}</span>
      </p>
      </>
      )}
      </div>
    </div>
  );
};

export default ProofSubmission;
