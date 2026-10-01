/**
 * 程序化画布纹理（不加载任何外部图片）。
 *
 * - 广告牌图集：时代广场的「发光广告牌」改写成异世界公会的告示——暖色灯泡框、羊皮纸与金色纹章。
 *   刻意不用高饱和霓虹：底色是赭褐、苔绿、牛血红，点缀色只取 index.html 的 token。
 * - 符文图集：委托类型图标 + 状态图标 + 装饰符文，白色线稿，着色交给着色器。
 *
 * 尺寸受简报预算约束：桌面单张 ≤ 1024²，手机 ≤ 512²。
 */
import * as THREE from 'three';

const TOKENS = {
  gold: '#c9a961',
  goldBright: '#e8cf94',
  ember: '#c87a45',
  verdigris: '#6d9b87',
  parchment: '#ede4d3',
};

function makeCanvas(w: number, h: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  return { canvas, ctx };
}

type Painter = (ctx: CanvasRenderingContext2D, s: number) => void;

/** 广告牌：每格一张告示。s 是格子边长 */
const POSTERS: { bg: [string, string]; paint: Painter }[] = [
  {
    bg: ['#4a2219', '#2a120d'],
    paint: (c, s) => {
      c.fillStyle = TOKENS.goldBright;
      c.font = `700 ${s * 0.36}px "Noto Serif SC", "Songti SC", serif`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText('公会', s / 2, s * 0.44);
      c.fillStyle = TOKENS.parchment;
      c.font = `600 ${s * 0.1}px "Cinzel", serif`;
      c.fillText('GUILD', s / 2, s * 0.72);
    },
  },
  {
    bg: ['#2b2018', '#17110c'],
    paint: (c, s) => {
      c.fillStyle = TOKENS.goldBright;
      c.beginPath();
      c.arc(s * 0.66, s * 0.34, s * 0.16, 0, Math.PI * 2);
      c.fill();
      // 龙的剪影：两翼 + 长颈
      c.fillStyle = TOKENS.ember;
      c.beginPath();
      c.moveTo(s * 0.18, s * 0.62);
      c.quadraticCurveTo(s * 0.32, s * 0.3, s * 0.5, s * 0.52);
      c.quadraticCurveTo(s * 0.62, s * 0.24, s * 0.86, s * 0.38);
      c.quadraticCurveTo(s * 0.66, s * 0.5, s * 0.6, s * 0.66);
      c.quadraticCurveTo(s * 0.44, s * 0.74, s * 0.3, s * 0.7);
      c.closePath();
      c.fill();
    },
  },
  {
    bg: ['#2c3a25', '#162012'],
    paint: (c, s) => {
      // 药瓶
      c.fillStyle = TOKENS.verdigris;
      c.beginPath();
      c.arc(s / 2, s * 0.6, s * 0.2, 0, Math.PI * 2);
      c.fill();
      c.fillRect(s * 0.44, s * 0.22, s * 0.12, s * 0.24);
      c.strokeStyle = TOKENS.parchment;
      c.lineWidth = s * 0.025;
      c.beginPath();
      c.arc(s / 2, s * 0.6, s * 0.2, 0, Math.PI * 2);
      c.stroke();
      c.fillStyle = TOKENS.goldBright;
      c.fillRect(s * 0.41, s * 0.18, s * 0.18, s * 0.06);
    },
  },
  {
    bg: ['#262b33', '#13161b'],
    paint: (c, s) => {
      // 盾与交叉双剑
      c.strokeStyle = TOKENS.parchment;
      c.lineWidth = s * 0.04;
      c.lineCap = 'round';
      c.beginPath();
      c.moveTo(s * 0.22, s * 0.22);
      c.lineTo(s * 0.78, s * 0.78);
      c.moveTo(s * 0.78, s * 0.22);
      c.lineTo(s * 0.22, s * 0.78);
      c.stroke();
      c.fillStyle = TOKENS.gold;
      c.beginPath();
      c.moveTo(s * 0.32, s * 0.3);
      c.lineTo(s * 0.68, s * 0.3);
      c.lineTo(s * 0.68, s * 0.52);
      c.quadraticCurveTo(s * 0.5, s * 0.8, s * 0.32, s * 0.52);
      c.closePath();
      c.fill();
    },
  },
  {
    bg: ['#30251a', '#1a140d'],
    paint: (c, s) => {
      // 法阵
      c.strokeStyle = TOKENS.goldBright;
      c.lineWidth = s * 0.02;
      for (const r of [0.34, 0.26]) {
        c.beginPath();
        c.arc(s / 2, s / 2, s * r, 0, Math.PI * 2);
        c.stroke();
      }
      c.beginPath();
      for (let i = 0; i <= 5; i++) {
        const a = -Math.PI / 2 + (i * 4 * Math.PI) / 5;
        const x = s / 2 + Math.cos(a) * s * 0.26;
        const y = s / 2 + Math.sin(a) * s * 0.26;
        if (i === 0) c.moveTo(x, y);
        else c.lineTo(x, y);
      }
      c.stroke();
    },
  },
  {
    bg: ['#1f2630', '#10141a'],
    paint: (c, s) => {
      // 灯笼
      const g = c.createRadialGradient(s / 2, s / 2, s * 0.05, s / 2, s / 2, s * 0.42);
      g.addColorStop(0, 'rgba(232,170,90,0.9)');
      g.addColorStop(1, 'rgba(232,170,90,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, s, s);
      c.fillStyle = TOKENS.ember;
      c.beginPath();
      c.ellipse(s / 2, s / 2, s * 0.17, s * 0.22, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = TOKENS.goldBright;
      c.fillRect(s * 0.42, s * 0.24, s * 0.16, s * 0.05);
      c.fillRect(s * 0.42, s * 0.71, s * 0.16, s * 0.05);
    },
  },
  {
    bg: ['#2a3624', '#141c11'],
    paint: (c, s) => {
      c.fillStyle = TOKENS.parchment;
      c.font = `700 ${s * 0.3}px "Noto Serif SC", "Songti SC", serif`;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText('異界', s / 2, s * 0.5);
      c.fillStyle = TOKENS.goldBright;
      for (let i = 0; i < 7; i++) {
        c.beginPath();
        c.arc(s * (0.15 + 0.12 * i), s * (0.18 + 0.05 * (i % 2)), s * 0.012, 0, Math.PI * 2);
        c.fill();
      }
    },
  },
  {
    bg: ['#43231a', '#24120c'],
    paint: (c, s) => {
      // 太阳纹章
      c.strokeStyle = TOKENS.gold;
      c.lineWidth = s * 0.03;
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        c.beginPath();
        c.moveTo(s / 2 + Math.cos(a) * s * 0.18, s / 2 + Math.sin(a) * s * 0.18);
        c.lineTo(s / 2 + Math.cos(a) * s * 0.32, s / 2 + Math.sin(a) * s * 0.32);
        c.stroke();
      }
      c.fillStyle = TOKENS.goldBright;
      c.beginPath();
      c.arc(s / 2, s / 2, s * 0.13, 0, Math.PI * 2);
      c.fill();
    },
  },
];

export const BILLBOARD_COLS = 4;
export const BILLBOARD_ROWS = 2;

export function createBillboardAtlas(maxSize: number): THREE.CanvasTexture {
  const w = Math.min(1024, maxSize);
  const h = w / 2;
  const s = w / BILLBOARD_COLS;
  const { canvas, ctx } = makeCanvas(w, h);
  POSTERS.forEach((p, i) => {
    const ox = (i % BILLBOARD_COLS) * s;
    const oy = Math.floor(i / BILLBOARD_COLS) * s;
    ctx.save();
    ctx.translate(ox, oy);
    const g = ctx.createLinearGradient(0, 0, 0, s);
    g.addColorStop(0, p.bg[0]);
    g.addColorStop(1, p.bg[1]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
    p.paint(ctx, s);
    // 金色细框 + 一圈暖色灯泡：百老汇剧院招牌的语汇，而不是 LED 屏
    ctx.strokeStyle = TOKENS.gold;
    ctx.lineWidth = s * 0.018;
    ctx.strokeRect(s * 0.05, s * 0.05, s * 0.9, s * 0.9);
    ctx.fillStyle = '#ffd99a';
    const n = 9;
    for (let k = 0; k < n; k++) {
      const t = s * (0.08 + (0.84 * k) / (n - 1));
      for (const [x, y] of [
        [t, s * 0.025],
        [t, s * 0.975],
        [s * 0.025, t],
        [s * 0.975, t],
      ]) {
        ctx.beginPath();
        ctx.arc(x, y, s * 0.011, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  });
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// ── 符文图集 ──────────────────────────────────────────────────────────
export const RUNE_COLS = 4;
/** 图集格子编号 */
export const GLYPH = {
  SUPPLY: 0,
  HUNT: 1,
  BUILD: 2,
  PARLEY: 3,
  RESCUE: 4,
  LOCK: 5,
  CHECK: 6,
  STAR: 7,
  RUNE0: 8, // 8..15 为装饰符文
} as const;

/** 委托类型 → 图标 */
export const TYPE_GLYPH: Record<string, number> = {
  物资运输: GLYPH.SUPPLY,
  魔物讨伐: GLYPH.HUNT,
  迷宫建设: GLYPH.BUILD,
  异界交涉: GLYPH.PARLEY,
  紧急救援: GLYPH.RESCUE,
};

const GLYPH_PAINTERS: Painter[] = [
  // 物资：木箱
  (c, s) => {
    c.strokeRect(s * 0.24, s * 0.3, s * 0.52, s * 0.44);
    c.beginPath();
    c.moveTo(s * 0.24, s * 0.44);
    c.lineTo(s * 0.76, s * 0.44);
    c.moveTo(s * 0.5, s * 0.3);
    c.lineTo(s * 0.5, s * 0.74);
    c.stroke();
  },
  // 讨伐：剑
  (c, s) => {
    c.beginPath();
    c.moveTo(s * 0.5, s * 0.16);
    c.lineTo(s * 0.5, s * 0.7);
    c.moveTo(s * 0.32, s * 0.62);
    c.lineTo(s * 0.68, s * 0.62);
    c.moveTo(s * 0.5, s * 0.7);
    c.lineTo(s * 0.5, s * 0.84);
    c.stroke();
  },
  // 建设：塔楼
  (c, s) => {
    c.beginPath();
    c.moveTo(s * 0.32, s * 0.8);
    c.lineTo(s * 0.36, s * 0.34);
    c.lineTo(s * 0.64, s * 0.34);
    c.lineTo(s * 0.68, s * 0.8);
    c.closePath();
    c.moveTo(s * 0.32, s * 0.34);
    c.lineTo(s * 0.32, s * 0.22);
    c.lineTo(s * 0.42, s * 0.22);
    c.lineTo(s * 0.42, s * 0.28);
    c.lineTo(s * 0.58, s * 0.28);
    c.lineTo(s * 0.58, s * 0.22);
    c.lineTo(s * 0.68, s * 0.22);
    c.lineTo(s * 0.68, s * 0.34);
    c.stroke();
  },
  // 交涉：卷轴对话
  (c, s) => {
    c.beginPath();
    c.ellipse(s * 0.5, s * 0.46, s * 0.28, s * 0.2, 0, 0, Math.PI * 2);
    c.moveTo(s * 0.38, s * 0.64);
    c.lineTo(s * 0.3, s * 0.8);
    c.lineTo(s * 0.5, s * 0.66);
    c.moveTo(s * 0.38, s * 0.42);
    c.lineTo(s * 0.62, s * 0.42);
    c.moveTo(s * 0.38, s * 0.52);
    c.lineTo(s * 0.56, s * 0.52);
    c.stroke();
  },
  // 救援：十字
  (c, s) => {
    c.beginPath();
    c.moveTo(s * 0.5, s * 0.22);
    c.lineTo(s * 0.5, s * 0.78);
    c.moveTo(s * 0.22, s * 0.5);
    c.lineTo(s * 0.78, s * 0.5);
    c.stroke();
  },
  // 锁
  (c, s) => {
    c.strokeRect(s * 0.3, s * 0.46, s * 0.4, s * 0.32);
    c.beginPath();
    c.arc(s * 0.5, s * 0.46, s * 0.13, Math.PI, 0);
    c.stroke();
  },
  // 已完成
  (c, s) => {
    c.beginPath();
    c.moveTo(s * 0.26, s * 0.52);
    c.lineTo(s * 0.44, s * 0.7);
    c.lineTo(s * 0.76, s * 0.32);
    c.stroke();
  },
  // 星
  (c, s) => {
    c.beginPath();
    for (let i = 0; i <= 5; i++) {
      const a = -Math.PI / 2 + (i * 4 * Math.PI) / 5;
      const x = s / 2 + Math.cos(a) * s * 0.3;
      const y = s / 2 + Math.sin(a) * s * 0.3;
      if (i === 0) c.moveTo(x, y);
      else c.lineTo(x, y);
    }
    c.stroke();
  },
];

/** 装饰符文：仿古北欧字母的直线笔画，作漂浮符文与法阵用 */
const RUNE_STROKES: number[][][] = [
  [[0.5, 0.15, 0.5, 0.85], [0.5, 0.3, 0.75, 0.15], [0.5, 0.5, 0.75, 0.35]],
  [[0.35, 0.15, 0.35, 0.85], [0.35, 0.15, 0.68, 0.5], [0.68, 0.5, 0.35, 0.85]],
  [[0.3, 0.15, 0.3, 0.85], [0.7, 0.15, 0.7, 0.85], [0.3, 0.5, 0.7, 0.3]],
  [[0.5, 0.15, 0.5, 0.85], [0.25, 0.4, 0.5, 0.15], [0.75, 0.4, 0.5, 0.15]],
  [[0.3, 0.2, 0.7, 0.8], [0.7, 0.2, 0.3, 0.8], [0.5, 0.15, 0.5, 0.85]],
  [[0.3, 0.15, 0.3, 0.85], [0.3, 0.15, 0.7, 0.35], [0.3, 0.55, 0.7, 0.35]],
  [[0.5, 0.15, 0.25, 0.5], [0.25, 0.5, 0.5, 0.85], [0.5, 0.85, 0.75, 0.5], [0.75, 0.5, 0.5, 0.15]],
  [[0.5, 0.15, 0.5, 0.85], [0.28, 0.6, 0.5, 0.85], [0.72, 0.6, 0.5, 0.85]],
];

export function createRuneAtlas(maxSize: number): THREE.CanvasTexture {
  const size = Math.min(512, maxSize >= 1024 ? 512 : 256);
  const s = size / RUNE_COLS;
  const { canvas, ctx } = makeCanvas(size, size);
  ctx.clearRect(0, 0, size, size);
  ctx.strokeStyle = '#ffffff';
  ctx.fillStyle = '#ffffff';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const draw = (i: number, paint: Painter) => {
    ctx.save();
    ctx.translate((i % RUNE_COLS) * s, Math.floor(i / RUNE_COLS) * s);
    ctx.lineWidth = s * 0.085;
    paint(ctx, s);
    ctx.restore();
  };
  GLYPH_PAINTERS.forEach((p, i) => draw(i, p));
  RUNE_STROKES.forEach((strokes, k) =>
    draw(GLYPH.RUNE0 + k, (c, sz) => {
      c.beginPath();
      for (const [x0, y0, x1, y1] of strokes) {
        c.moveTo(x0 * sz, y0 * sz);
        c.lineTo(x1 * sz, y1 * sz);
      }
      c.stroke();
    }),
  );
  const tex = new THREE.CanvasTexture(canvas);
  // 只当遮罩用（取 alpha），不做色彩空间转换
  tex.colorSpace = THREE.NoColorSpace;
  return tex;
}

/** 纹理显存估算（含 mipmap 约 1.33 倍），供调试读数与预算核对 */
export function textureBytes(tex: THREE.Texture): number {
  const img = tex.image as { width?: number; height?: number } | undefined;
  if (!img || !img.width || !img.height) return 0;
  return img.width * img.height * 4 * (tex.generateMipmaps ? 4 / 3 : 1);
}
