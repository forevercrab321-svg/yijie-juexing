/**
 * 手感（juice）参数表与曲线。四个关键时刻的反馈强度集中在这一处，按事件重要性分三档，同档同强度：
 *
 *  小 · 聚焦：选中的回应。徽章弹一下（放大到 1.25×，弹簧过冲约 12%）并闪一下、停转正对相机，镜头推近、构图点移到卡片上方。不震屏、不顿帧。
 *  中 · 接取（pulse）：一次冲击。60 ms 顿帧里徽章被压扁，松开时弹起、放出类型色冲击环与星形纸屑，镜头轻震、视场外踢，
 *      停一拍后再拉远去框住「我—目标」，点状路径从脚下一路亮到徽章。
 *      完成（seal）同属中档，但主角是结算卡：徽章缩没再以灰蓝 + 白勾长回来、一道环收拢，世界不抢镜头。
 *  大 · 升级（celebrate）：高潮。先蓄力（与结算卡记账同步），在 SETTLE_BEATS.levelUp 那一拍
 *      闪曝光 + 110 ms 顿帧，松开时震屏、视场内收再回弹、三色星形纸屑炸开、暖黄环波扫过全屏。
 *
 * 震屏强度 = trauma²：小事件几乎不动，大事件才真正有冲击，而且总会自己衰减归零。
 * 减少动态效果（prefers-reduced-motion）：不震屏、不踢视场、不闪曝光、不顿帧、不挤压拉伸、路径不做生长动画；
 * 只留表达状态的亮度变化与淡入淡出——「哪根被接了、完成了、升级了」这些信息一样都不丢。
 */
import { SETTLE_BEATS } from '../ui/feelTiming';

const DEG = Math.PI / 180;

export const FEEL = {
  focus: {
    /** 推近：当前距离 × 0.72，夹在 [420, 900] m；本来就比 420 m 近时保持不动，不往回拉 */
    push: 0.72,
    minDist: 420,
    maxDist: 900,
    /** 旧版的构图偏移（NDC）。可爱版改由 cameraRig 的聚焦构图点负责（手机 36%、桌面 45%），引擎不再读它，保留给旧脚本参考 */
    lift: 0.1,
    flare: 0.35,
  },
  pulse: {
    hitStop: 0.06,
    trauma: 0.45,
    /** 视场外踢（度）：冲击波往外推，镜头被「推」了一下 */
    fovKick: 2.0,
    /** 顿帧之后再停这么久才开始拉远：先让玩家看清徽章上的冲击，再交代路径 */
    cameraHold: 0.14,
    /** 路径在镜头开始拉远之后才生长，亮头从玩家那头冲过来、在徽章处放慢落定，镜头到位时正好画完 */
    pathDelay: 0.25,
    pathDur: 0.85,
  },
  seal: { flare: 0.7, dur: 0.6 },
  celebrate: {
    /** 蓄力时长 = 结算卡的升级拍；减少动态效果时为 0（卡片也是一次性全部显示） */
    lead: SETTLE_BEATS.levelUp / 1000,
    hitStop: 0.11,
    trauma: 0.8,
    /** 视场内收（度）：镜头向玩家一扑，再自然回弹 */
    fovKick: -2.6,
    /** 曝光闪 +22%，0.35 s 缓出。白闪对光敏人群不友好，所以只用曝光、幅度克制、只闪一次 */
    flash: 0.22,
  },
  shake: {
    /** trauma = 1 时的最大偏移角（约屏高的 1.3%）与最大滚转 */
    maxAngle: 0.55 * DEG,
    maxRoll: 1.1 * DEG,
    /** 每秒衰减的 trauma */
    decay: 1.4,
  },
  /** 顿帧期间环境动画（水面波纹、徽章浮动与光圈、光点）的时间倍率 */
  hitStopScale: 0.05,
} as const;

const RESP_A = 6;
const RESP_N = 1 - (1 + RESP_A) * Math.exp(-RESP_A);
/**
 * 临界阻尼响应：起步就有速度（点下去镜头立刻动，不像 easeInOut 前 100 ms 几乎不动），落地柔和、单调、不回弹。
 * 每 100 ms 的最大位移约为全程的 23%，比 easeInOutCubic 的峰值段（约 30%）还平顺（M3-15②）。
 */
export const easeResponse = (u: number): number => {
  const x = Math.min(1, Math.max(0, u)) * RESP_A;
  return (1 - (1 + x) * Math.exp(-x)) / RESP_N;
};

/**
 * 衰减正弦「踢」：从 0 出发，约 period/4 到峰（峰值归一为 amp），随后一次反向回弹并衰减到零。
 * 闭式解而不是积分弹簧：与帧率无关，慢设备一秒一帧时读到的也是此刻的正确值。
 */
export function kick(t: number, amp: number, period: number, tau: number): number {
  if (t < 0) return 0;
  const w = (2 * Math.PI) / period;
  const tp = Math.atan(w * tau) / w;
  const peak = Math.sin(w * tp) * Math.exp(-tp / tau);
  return (amp / peak) * Math.sin(w * t) * Math.exp(-t / tau);
}

/**
 * 接取时徽章的挤压—拉伸，返回高度的相对变化（宽度按体积大致守恒反向变化；徽章着色器里再按比例缩小幅度）。
 * 顿帧期间被压扁 16%（蓄力），松开后约 90 ms 弹到 +38%，再回落约 −8%，0.8 s 内回到静止。
 */
export const SQUASH_DUR = 0.8;
export function squashStretch(t: number, hold: number): number {
  if (t < 0) return 0;
  if (t < hold) {
    const k = 1 - t / hold;
    return -0.16 * (1 - k * k);
  }
  const u = t - hold;
  return -0.16 * Math.exp(-u / 0.03) + 0.75 * Math.sin((2 * Math.PI * u) / 0.5) * Math.exp(-u / 0.16);
}

/** 完成：徽章缩没（0.32 s，越缩越快）再以「已完成」的样子长回来（0.5 s，缓出）。返回 −1…0 */
export const SEAL_DUR = 0.82;
export function sealCurve(t: number): number {
  if (t < 0 || t >= SEAL_DUR) return 0;
  if (t < 0.32) {
    const k = t / 0.32;
    return -k * k * k;
  }
  const k = 1 - (t - 0.32) / 0.5;
  return -k * k * k;
}

/** 曝光闪：瞬间到顶，0.35 s 二次缓出 */
export function flashCurve(t: number): number {
  if (t < 0 || t >= 0.35) return 0;
  const k = 1 - t / 0.35;
  return k * k;
}

/**
 * 平滑的伪噪声：两组不可通约频率的正弦叠加（约 9 Hz 与 14 Hz）。
 * 连续可导——不是每帧一个随机数（那样震出来像雪花屏一样嗡嗡抖）。
 */
export const shakeWave = (t: number, seed: number): number => 0.6 * Math.sin(t * 57 + seed * 1.7) + 0.4 * Math.sin(t * 89 + seed * 3.1);

export const easeOutCubic = (t: number): number => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
