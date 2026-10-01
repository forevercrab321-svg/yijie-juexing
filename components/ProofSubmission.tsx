
import React, { useState, useEffect, useMemo } from 'react';
import { X, Scan, Search, MapPinOff, Navigation } from 'lucide-react';
import { distanceMeters, PROOF_RADIUS_METERS } from '../lib/geo';

interface ProofSubmissionProps {
  questLocation: [number, number];
  userLocation: [number, number] | null;
  /** GPS 精度（米）。精度太差时不能据此判定是否到场。 */
  locationAccuracy: number | null;
  onConfirm: () => void;
  onCancel: () => void;
}

/** 精度差于这个值时，距离判定没有意义，要求用户到开阔处重试。 */
const MAX_USABLE_ACCURACY = 120;

type Gate =
  | { kind: 'OK'; distance: number }
  | { kind: 'NO_LOCATION' }
  | { kind: 'LOW_ACCURACY'; accuracy: number }
  | { kind: 'TOO_FAR'; distance: number };

const ProofSubmission: React.FC<ProofSubmissionProps> = ({
  questLocation,
  userLocation,
  locationAccuracy,
  onConfirm,
  onCancel,
}) => {
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

  const blockedCopy: Record<Exclude<Gate['kind'], 'OK'>, { title: string; body: string }> = {
    NO_LOCATION: {
      title: '无法确认你的位置',
      body: '提交任务证明需要定位权限。请在浏览器与系统设置中允许位置访问后重试。',
    },
    LOW_ACCURACY: {
      title: '定位精度不足',
      body: `当前定位误差约 ${Math.round((gate as any).accuracy ?? 0)} 米，无法判定你是否到达现场。请移动到室外开阔处，等待信号稳定后重试。`,
    },
    TOO_FAR: {
      title: '你还没有到达现场',
      body: `你距离任务点约 ${formatDistance((gate as any).distance ?? 0)}，需要进入 ${PROOF_RADIUS_METERS} 米范围内才能提交证明。`,
    },
  };

  return (
    /*
      配色与文案（QA-R1-06）：原先是青色网格 + #22d3ee 扫描光 + PROOF_UPLOAD_PROTOCOL_V3 / Employer Neural Net 的赛博终端风，
      正是简报列为反支柱的「赛博朋克青紫」。这些颜色都是写死的任意值或色板没定义的 cyan-950，重映射过的调色板管不到。
      现在换成公会的语言：墨色底（不用纯黑）、金色网格与描边、羊皮纸色扫描光；结构与交互不变。
      「雇主」一词也一并去掉——本平台明确是社区互助、不是雇佣平台（觉醒页的声明）。
    */
    <div className="fixed inset-0 z-[1100] bg-slate-950 flex flex-col items-center justify-center font-mono">
      {/* 背景网格：金色细线，像契约纸上的格线 */}
      <div className="absolute inset-0 pointer-events-none opacity-20"
           style={{
               backgroundImage: 'linear-gradient(0deg, transparent 24%, rgba(201, 169, 97, .3) 25%, rgba(201, 169, 97, .3) 26%, transparent 27%, transparent 74%, rgba(201, 169, 97, .3) 75%, rgba(201, 169, 97, .3) 76%, transparent 77%, transparent), linear-gradient(90deg, transparent 24%, rgba(201, 169, 97, .3) 25%, rgba(201, 169, 97, .3) 26%, transparent 27%, transparent 74%, rgba(201, 169, 97, .3) 75%, rgba(201, 169, 97, .3) 76%, transparent 77%, transparent)',
               backgroundSize: '50px 50px'
           }}
      ></div>

      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-20">
          <div className="text-[10px] text-amber-400 bg-amber-950/50 px-2 py-1 border border-amber-700/60 rounded tracking-widest">
              委托证明 · PROOF OF DEED
          </div>
          <button onClick={onCancel} className="text-red-500 hover:text-red-400 p-2 border border-red-900/50 bg-red-950/20 rounded-full">
              <X className="w-5 h-5" />
          </button>
      </div>

      {gate.kind !== 'OK' ? (
        /* --- 未通过到场校验：不提供上传入口 --- */
        <div className="relative w-full max-w-sm mx-6 bg-slate-900/80 border border-amber-500/40 rounded-3xl p-8 text-center backdrop-blur-md">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-950/50 border border-amber-500/30 flex items-center justify-center mb-5">
            <MapPinOff className="w-8 h-8 text-amber-500" />
          </div>
          <h3 className="text-lg font-bold text-white font-['Cinzel'] tracking-wider mb-3">
            {blockedCopy[gate.kind].title}
          </h3>
          <p className="text-xs text-slate-400 leading-relaxed mb-6 font-sans">
            {blockedCopy[gate.kind].body}
          </p>
          {/* 扫描途中被拦：照片还在，回到现场会接着评定，不用重拍 */}
          {status !== 'IDLE' && (
            <p data-testid="proof-paused" className="text-[11px] text-amber-400/90 leading-relaxed -mt-3 mb-6 font-sans">
              证明评定已暂停，回到现场后会自动继续。
            </p>
          )}
          <button
            onClick={onCancel}
            className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold py-3 rounded-xl transition-colors active:scale-95 font-sans"
          >
            返回
          </button>
        </div>
      ) : (
      <>
      {/* Main Scanner UI */}
      <div className="relative w-full max-w-sm aspect-[3/4] border-2 border-slate-800 bg-slate-900/40 rounded-3xl overflow-hidden flex flex-col items-center justify-center p-1">
         {/* Corner Brackets */}
         <div className="absolute top-4 left-4 w-8 h-8 border-t-2 border-l-2 border-amber-500/70"></div>
         <div className="absolute top-4 right-4 w-8 h-8 border-t-2 border-r-2 border-amber-500/70"></div>
         <div className="absolute bottom-4 left-4 w-8 h-8 border-b-2 border-l-2 border-amber-500/70"></div>
         <div className="absolute bottom-4 right-4 w-8 h-8 border-b-2 border-r-2 border-amber-500/70"></div>

         {/* Image Preview Layer */}
         {preview && (
             <img
                src={preview}
                className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${status === 'SUCCESS' ? 'opacity-100' : 'opacity-60 grayscale'}`}
                alt="Scan"
             />
         )}

         {/* Scanning Overlay Animation */}
         {(status === 'SCANNING' || status === 'ANALYZING') && (
            <div className="absolute inset-0 bg-amber-500/10 z-10">
                <div className="absolute top-0 left-0 right-0 h-1 bg-amber-200 shadow-[0_0_15px_rgba(232,207,148,0.75)] animate-[scan_2s_ease-in-out_infinite]"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-48 h-48 border border-amber-500/30 rounded-full animate-[spin_4s_linear_infinite] border-t-amber-300 border-t-2"></div>
                </div>
            </div>
         )}

         {/* Grading Overlay */}
         {status === 'GRADING' && (
             <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm z-20 flex flex-col items-center justify-center animate-in fade-in">
                 <div className="text-amber-500 animate-pulse mb-4">
                     <Search className="w-12 h-12" />
                 </div>
                 <div className="text-amber-500 font-bold tracking-[0.3em] text-lg font-['Cinzel']">AWAITING EVALUATION</div>
                 <div className="text-xs text-slate-400 mt-2 font-sans">公会书记官正在登记这份委托…</div>
             </div>
         )}

         {/* IDLE State / Input Trigger */}
         {status === 'IDLE' && (
             <label className="group relative w-40 h-40 rounded-full border-2 border-dashed border-slate-600 flex items-center justify-center cursor-pointer hover:border-amber-500 hover:bg-amber-950/30 transition-all z-10 active:scale-95">
                 {/* capture 让移动端直接调起相机，减少「翻相册里的旧图」这一最简单的作弊路径 */}
                 <input type="file" accept="image/*" capture="environment" onChange={handleFileChange} className="hidden" />
                 <div className="w-32 h-32 rounded-full bg-slate-800 flex items-center justify-center group-hover:shadow-[0_0_30px_rgba(201,169,97,0.3)] transition-shadow">
                    <Scan className="w-10 h-10 text-slate-400 group-hover:text-amber-400 transition-colors" />
                 </div>
                 <div className="absolute -bottom-10 text-center w-full">
                     <div className="text-amber-400 font-bold tracking-widest text-sm animate-pulse font-sans">上传现场照片</div>
                 </div>
             </label>
         )}

         {/* Status Text HUD */}
         {status !== 'GRADING' && status !== 'IDLE' && (
            <div className="absolute bottom-12 left-0 right-0 text-center z-10">
                {status === 'SCANNING' && <div className="text-xs text-amber-300 font-bold bg-slate-950/60 inline-block px-3 py-1 rounded border border-amber-800 font-sans">正在核对现场位置…</div>}
                {status === 'ANALYZING' && <div className="text-xs text-emerald-400 font-bold bg-slate-950/60 inline-block px-3 py-1 rounded border border-emerald-900 font-sans">正在核对照片内容…</div>}
            </div>
         )}
      </div>

      {/* 到场确认条 */}
      <div className="mt-16 flex items-center gap-2 text-[11px] text-emerald-400 bg-emerald-900/40 border border-emerald-500/30 px-3 py-1.5 rounded-full">
        <Navigation className="w-3 h-3" />
        <span className="font-sans">已确认到场 · 距任务点 {formatDistance(gate.distance)}</span>
      </div>
      </>
      )}

      <style>{`
        @keyframes scan {
            0% { top: 0%; opacity: 0; }
            10% { opacity: 1; }
            90% { opacity: 1; }
            100% { top: 100%; opacity: 0; }
        }
      `}</style>
    </div>
  );
};

function formatDistance(meters: number): string {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)} 公里` : `${Math.round(meters)} 米`;
}

export default ProofSubmission;
