/**
 * 运行时画的两张小纹理（不加载任何外部图片）：
 *  - 图标图集 512×256（4 列 × 2 行）：五种委托类型 + 勾 + 锁 + 「!」，白色遮罩，着色交给徽章着色器。
 *    图形直接用 lucide 的 SVG 路径（Path2D），与界面卡片、2D 图钉的图标是同一套线稿——
 *    玩家在卡片上看到的「锤子」和在地图徽章上看到的是同一个锤子（指南 3.9）。
 *  - 卡通渐变 4×1：MeshToonMaterial 共用，亮度按指南 5.2 的 0.60 / 0.78 / 0.92 / 1.0 再整体 ×0.95（原因见函数注释）。
 *
 * 纹理预算（指南 5.2）：总数 ≤ 6。这两张 + 高档的阴影贴图 = 3。
 */
import * as THREE from 'three';

export const ICON_COLS = 4;
export const ICON_ROWS = 2;
/** 图集格号 */
export const ICON = {
  TRANSPORT: 0,
  HUNT: 1,
  BUILD: 2,
  ENVOY: 3,
  RESCUE: 4,
  CHECK: 5,
  LOCK: 6,
  BANG: 7,
} as const;

/** 委托类型 → 图集格号 */
export const TYPE_ICON: Record<string, number> = {
  物资运输: ICON.TRANSPORT,
  魔物讨伐: ICON.HUNT,
  迷宫建设: ICON.BUILD,
  异界交涉: ICON.ENVOY,
  紧急救援: ICON.RESCUE,
};

// lucide 0.556 的路径（24×24 视框，2 px 描边）。polyline / line / rect 已改写成等价的 path
const LUCIDE: string[][] = [
  // Package
  [
    'M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z',
    'M12 22V12',
    'M3.29 7L12 12L20.71 7',
    'm7.5 4.27 9 5.15',
  ],
  // Swords
  [
    'M14.5 17.5L3 6L3 3L6 3L17.5 14.5',
    'M13 19L19 13',
    'M16 16L20 20',
    'M19 21L21 19',
    'M14.5 6.5L18 3L21 3L21 6L17.5 9.5',
    'M5 14L9 18',
    'M7 17L4 20',
    'M3 19L5 21',
  ],
  // Hammer
  [
    'm15 12-9.373 9.373a1 1 0 0 1-3.001-3L12 9',
    'm18 15 4-4',
    'm21.5 11.5-1.914-1.914A2 2 0 0 1 19 8.172v-.344a2 2 0 0 0-.586-1.414l-1.657-1.657A6 6 0 0 0 12.516 3H9l1.243 1.243A6 6 0 0 1 12 8.485V10l2 2h1.172a2 2 0 0 1 1.414.586L18.5 14.5',
  ],
  // MessageCircleHeart
  [
    'M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719',
    'M7.828 13.07A3 3 0 0 1 12 8.764a3 3 0 0 1 5.004 2.224 3 3 0 0 1-.832 2.083l-3.447 3.62a1 1 0 0 1-1.45-.001z',
  ],
  // HeartPulse（紧急救援不用 LifeBuoy：红白相间的圆环太接近禁区，指南 3.9）
  [
    'M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5',
    'M3.22 13H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27',
  ],
  // Check
  ['M20 6 9 17l-5-5'],
  // Lock
  ['M5 11h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2z', 'M7 11V7a5 5 0 0 1 10 0v4'],
];

export function createIconAtlas(): THREE.CanvasTexture {
  const size = 512;
  const cell = size / ICON_COLS;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = (size / ICON_COLS) * ICON_ROWS;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = '#ffffff';
  ctx.fillStyle = '#ffffff';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  LUCIDE.forEach((paths, i) => {
    ctx.save();
    // 24 单位视框缩到格子的 78%：圆章里留白，远看不糊成一团
    const k = (cell * 0.78) / 24;
    ctx.translate((i % ICON_COLS) * cell + cell * 0.11, Math.floor(i / ICON_COLS) * cell + cell * 0.11);
    ctx.scale(k, k);
    // 比界面的 2.25–2.5 再粗一点：徽章上的图标只有十几个像素
    ctx.lineWidth = 2.7;
    for (const d of paths) ctx.stroke(new Path2D(d));
    ctx.restore();
  });
  // 「!」：圆头粗竖 + 圆点，填充而不是描边，缩到很小也读得出
  {
    const cx = (ICON.BANG % ICON_COLS) * cell + cell / 2;
    const oy = Math.floor(ICON.BANG / ICON_COLS) * cell;
    const w = cell * 0.17;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(cx, oy + cell * 0.2);
    ctx.lineTo(cx, oy + cell * 0.56);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, oy + cell * 0.8, w * 0.6, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  // 只当遮罩用（取 alpha），不做色彩空间转换
  tex.colorSpace = THREE.NoColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/**
 * 卡通渐变：4 阶，最近邻采样。背光面落在 60–78%，再被半球光染成偏蓝的「有色阴影」。
 * 四阶的比例按指南（0.60 / 0.78 / 0.92 / 1.0），整体乘 0.95：卡通材质的受光面拿到的是整阶亮度，
 * 而 Lambert 地面只拿到 sin(55°) ≈ 0.82 的直射——不压一点，屋顶会比色板亮 6%（截图取色实测）。
 */
export function createToonGradient(): THREE.DataTexture {
  const data = new Uint8Array([146, 146, 146, 255, 189, 189, 189, 255, 223, 223, 223, 255, 242, 242, 242, 255]);
  const tex = new THREE.DataTexture(data, 4, 1, THREE.RGBAFormat);
  tex.colorSpace = THREE.NoColorSpace;
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

/** 纹理显存估算（含 mipmap 约 1.33 倍），供调试读数与预算核对 */
export function textureBytes(tex: THREE.Texture): number {
  const img = tex.image as { width?: number; height?: number } | undefined;
  if (!img || !img.width || !img.height) return 0;
  return img.width * img.height * 4 * (tex.generateMipmaps ? 4 / 3 : 1);
}
