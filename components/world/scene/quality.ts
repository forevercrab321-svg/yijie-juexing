/**
 * 画质档位。简报 7.1：手机或 hardwareConcurrency ≤ 4 判为低档。
 *
 * 低档：DPR ≤ 1.5、**不开实时阴影**（贴地软影 + 烘进地面的楼脚环境光遮蔽代替，指南 5.3——可爱风格里软影片比实时阴影更「对」，
 *       还省掉整个阴影 pass）、帧率上限 30（户外步行、GPS 常开、屏幕常亮，省电优先）。
 * 高档：DPR ≤ 2、阴影 2048（只有较高的楼、地标、玩家投影）、画布 MSAA。
 * MSAA 只在实际像素比 < 2 时开：视网膜屏上锯齿本来就只有半个 CSS 像素，而 2880×1800 的 4 倍多重采样
 * 颜色 + 深度缓冲要多占约 160 MB 显存和对应的带宽，换来的画质几乎看不出来。
 *
 * 两档都不开后处理（指南 5.2：手机 0 pass）。徽章光晕、夜间窗灯都是材质自己画的柔光，不靠 bloom；
 * 上一版实测 bloom + FXAA 要多约 15 个 draw call、约 31 MB 渲染目标，还要多打 25 KB 的 three/examples 进 3D 分包。
 *
 * URL 覆盖（只影响画质，不影响玩法，方便 QA 在 4 核沙箱里测高档）：?tier=high|low
 */

export type Tier = 'high' | 'low';

export interface Quality {
  tier: Tier;
  /** 渲染器像素比上限 */
  dprCap: number;
  /** 太阳阴影贴图边长，0 表示关闭实时阴影 */
  shadowMapSize: number;
  /** 画布自带 MSAA */
  antialias: boolean;
  /** 帧率上限，0 表示跟随显示器 */
  fpsCap: number;
  /** 外围（布鲁克林 / 皇后区 / 新泽西）铺楼的半径上限（米，自曼哈顿脊线起算） */
  outerReach: number;
  /** 树木数量系数 */
  trees: number;
  /** 飘浮光点数量（指南 5.9：桌面 60、手机 30） */
  motes: number;
  /** 卡通云朵数 */
  clouds: number;
}

function readParam(name: string): string | null {
  try {
    return new URLSearchParams(window.location.search).get(name);
  } catch {
    return null;
  }
}

export function detectTier(): Tier {
  const forced = readParam('tier');
  if (forced === 'high' || forced === 'low') return forced;
  const ua = navigator.userAgent || '';
  const mobileUA = /Android|iPhone|iPad|iPod|Mobile|Silk|Kindle|Opera Mini/i.test(ua);
  // iPadOS 13+ 伪装成 Mac，靠多点触控识别
  const iPadOS = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
  let coarse = false;
  try {
    coarse = window.matchMedia('(pointer: coarse)').matches && navigator.maxTouchPoints > 0;
  } catch {
    coarse = false;
  }
  const cores = navigator.hardwareConcurrency || 8;
  return mobileUA || iPadOS || coarse || cores <= 4 ? 'low' : 'high';
}

function deviceDpr(): number {
  try {
    return window.devicePixelRatio || 1;
  } catch {
    return 1;
  }
}

export function resolveQuality(tier: Tier = detectTier()): Quality {
  if (tier === 'low') {
    return {
      tier,
      dprCap: 1.5,
      shadowMapSize: 0,
      antialias: true,
      fpsCap: 30,
      outerReach: 2700,
      trees: 0.55,
      motes: 30,
      clouds: 12,
    };
  }
  return {
    tier,
    dprCap: 2,
    shadowMapSize: 2048,
    antialias: Math.min(deviceDpr(), 2) < 2,
    fpsCap: 0,
    outerReach: 4200,
    trees: 1,
    motes: 60,
    clouds: 16,
  };
}
