
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

  useEffect(() => {
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
  }, [status, onConfirm]);

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
    <div className="fixed inset-0 z-[1100] bg-black flex flex-col items-center justify-center font-mono">
      {/* Background HUD Grid */}
      <div className="absolute inset-0 pointer-events-none opacity-20"
           style={{
               backgroundImage: 'linear-gradient(0deg, transparent 24%, rgba(6, 182, 212, .3) 25%, rgba(6, 182, 212, .3) 26%, transparent 27%, transparent 74%, rgba(6, 182, 212, .3) 75%, rgba(6, 182, 212, .3) 76%, transparent 77%, transparent), linear-gradient(90deg, transparent 24%, rgba(6, 182, 212, .3) 25%, rgba(6, 182, 212, .3) 26%, transparent 27%, transparent 74%, rgba(6, 182, 212, .3) 75%, rgba(6, 182, 212, .3) 76%, transparent 77%, transparent)',
               backgroundSize: '50px 50px'
           }}
      ></div>

      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-20">
          <div className="text-[10px] text-cyan-500 bg-cyan-950/50 px-2 py-1 border border-cyan-800 rounded">
              PROOF_UPLOAD_PROTOCOL_V3
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
         <div className="absolute top-4 left-4 w-8 h-8 border-t-2 border-l-2 border-cyan-500"></div>
         <div className="absolute top-4 right-4 w-8 h-8 border-t-2 border-r-2 border-cyan-500"></div>
         <div className="absolute bottom-4 left-4 w-8 h-8 border-b-2 border-l-2 border-cyan-500"></div>
         <div className="absolute bottom-4 right-4 w-8 h-8 border-b-2 border-r-2 border-cyan-500"></div>

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
            <div className="absolute inset-0 bg-cyan-500/10 z-10">
                <div className="absolute top-0 left-0 right-0 h-1 bg-cyan-400 shadow-[0_0_15px_#22d3ee] animate-[scan_2s_ease-in-out_infinite]"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-48 h-48 border border-cyan-500/30 rounded-full animate-[spin_4s_linear_infinite] border-t-cyan-400 border-t-2"></div>
                </div>
            </div>
         )}

         {/* Grading Overlay */}
         {status === 'GRADING' && (
             <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-20 flex flex-col items-center justify-center animate-in fade-in">
                 <div className="text-amber-500 animate-pulse mb-4">
                     <Search className="w-12 h-12" />
                 </div>
                 <div className="text-amber-500 font-bold tracking-[0.3em] text-lg font-['Cinzel']">AWAITING EVALUATION</div>
                 <div className="text-xs text-slate-400 mt-2">Connecting to Employer Neural Net...</div>
             </div>
         )}

         {/* IDLE State / Input Trigger */}
         {status === 'IDLE' && (
             <label className="group relative w-40 h-40 rounded-full border-2 border-dashed border-slate-600 flex items-center justify-center cursor-pointer hover:border-cyan-500 hover:bg-cyan-950/30 transition-all z-10 active:scale-95">
                 {/* capture 让移动端直接调起相机，减少「翻相册里的旧图」这一最简单的作弊路径 */}
                 <input type="file" accept="image/*" capture="environment" onChange={handleFileChange} className="hidden" />
                 <div className="w-32 h-32 rounded-full bg-slate-800 flex items-center justify-center group-hover:shadow-[0_0_30px_rgba(6,182,212,0.3)] transition-shadow">
                    <Scan className="w-10 h-10 text-slate-400 group-hover:text-cyan-400 transition-colors" />
                 </div>
                 <div className="absolute -bottom-10 text-center w-full">
                     <div className="text-cyan-500 font-bold tracking-widest text-sm animate-pulse">INITIATE SCAN</div>
                 </div>
             </label>
         )}

         {/* Status Text HUD */}
         {status !== 'GRADING' && status !== 'IDLE' && (
            <div className="absolute bottom-12 left-0 right-0 text-center z-10">
                {status === 'SCANNING' && <div className="text-xs text-cyan-400 font-bold bg-black/50 inline-block px-3 py-1 rounded border border-cyan-900">ACQUIRING GEOSPATIAL DATA...</div>}
                {status === 'ANALYZING' && <div className="text-xs text-emerald-400 font-bold bg-black/50 inline-block px-3 py-1 rounded border border-emerald-900">VERIFYING CONTENTS...</div>}
            </div>
         )}
      </div>

      {/* 到场确认条 */}
      <div className="mt-16 flex items-center gap-2 text-[11px] text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 px-3 py-1.5 rounded-full">
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
