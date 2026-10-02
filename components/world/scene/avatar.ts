/**
 * Q 版大头角色的几何工厂（指南 5.6）：头身 1 : 1（头直径 1.0、略扁 0.94；躯干 0.62；腿 0.38；总高 2 个头单位）。
 *
 * 所有部件按「部件号」写进顶点属性 aPart，合并成一个几何；动画在 CPU 上算出每个部件的矩阵（player.ts），
 * 顶点着色器按 aPart 取矩阵摆位——不透明部件 1 个 draw call，半透明部件（史莱姆身体、妖精翅膀）另 1 个。
 * 12 个种族靠轮廓区分（角、光环、耳、尾、翅、胡子、整体形态），不只靠颜色（指南 5.6 末句）。
 * 只用通用奇幻元素；不做任何现有作品的角色形象与配色组合（IP 红线，指南 1.2）。
 *
 * 坐标：角色面朝 +z，y 朝上，脚底在 y = 0。+x 是角色的左手边。
 */
import * as THREE from 'three';
import { Race } from '../../../types';

/** 部件号（与 player.ts 的矩阵数组下标一致） */
export const PART = {
  ROOT: 0,
  HEAD: 1,
  EYES: 2,
  ARM_L: 3,
  ARM_R: 4,
  LEG_L: 5,
  LEG_R: 6,
  TAIL: 7,
  WING_L: 8,
  WING_R: 9,
  HALO: 10,
  EAR_L: 11,
  EAR_R: 12,
  BEARD: 13,
  SPARK: 14,
  RIBBON: 15,
} as const;
export const PART_COUNT = 16;

/** 各部件的转轴（单位空间） */
export const PIVOT: Record<number, [number, number, number]> = {
  [PART.ROOT]: [0, 0.38, 0],
  [PART.HEAD]: [0, 1.02, 0],
  [PART.EYES]: [0, 1.45, 0.44],
  [PART.ARM_L]: [0.3, 0.9, 0],
  [PART.ARM_R]: [-0.3, 0.9, 0],
  [PART.LEG_L]: [0.12, 0.38, 0],
  [PART.LEG_R]: [-0.12, 0.38, 0],
  [PART.TAIL]: [0, 0.55, -0.22],
  [PART.WING_L]: [0.1, 0.88, -0.2],
  [PART.WING_R]: [-0.1, 0.88, -0.2],
  [PART.HALO]: [0, 2.2, 0],
  [PART.EAR_L]: [0.4, 1.62, 0],
  [PART.EAR_R]: [-0.4, 1.62, 0],
  [PART.BEARD]: [0, 1.24, 0.36],
  [PART.SPARK]: [0, 1.2, 0],
  [PART.RIBBON]: [0, 1.6, -0.44],
};

export interface RaceLook {
  hair: string;
  skin: string;
  clothes: string;
  /** 裤子 / 鞋的颜色（缺省由衣服色压暗） */
  pants?: string;
  /** 动画参数 */
  anim: {
    /** 走路改为蹦（史莱姆） */
    hop?: boolean;
    /** 走路更顿、更重（傀儡） */
    heavy?: boolean;
    /** 翅膀扇动频率（Hz）与幅度（弧度） */
    wingHz?: number;
    wingAmp?: number;
    /** 整体缩放（妖精 0.9） */
    scale?: number;
    /** 悬浮高度（单位） */
    hover?: number;
  };
}

export const RACE_LOOK: Record<Race, RaceLook> = {
  [Race.SLIME]: { hair: '#6EC8FF', skin: '#6EC8FF', clothes: '#6EC8FF', anim: { hop: true } },
  [Race.KIJIN]: { hair: '#3B3F58', skin: '#FFE1CC', clothes: '#FF8C8C', anim: {} },
  [Race.DAEMON]: { hair: '#4B4F6E', skin: '#FFE6D8', clothes: '#3B3F58', anim: { wingHz: 1.4, wingAmp: 0.22 } },
  [Race.DRAGONNEWT]: { hair: '#FF8C42', skin: '#FFE1CC', clothes: '#68C34A', anim: { wingHz: 1.0, wingAmp: 0.25 } },
  [Race.ANGEL]: { hair: '#FFE08A', skin: '#FFE1CC', clothes: '#FFFFFF', anim: { wingHz: 0.9, wingAmp: 0.2 } },
  [Race.ELF]: { hair: '#7A5236', skin: '#FFE1CC', clothes: '#4FB359', anim: {} },
  [Race.DWARF]: { hair: '#E8A86E', skin: '#FFE1CC', clothes: '#FF8C42', anim: {} },
  [Race.BEASTKIN]: { hair: '#E8A86E', skin: '#FFE1CC', clothes: '#FFC83D', pants: '#B5784A', anim: {} },
  [Race.FAIRY]: { hair: '#FFB4D4', skin: '#FFE1CC', clothes: '#CDEFDD', anim: { wingHz: 6, wingAmp: 0.16, scale: 0.9, hover: 0.18 } },
  [Race.UNDEAD]: { hair: '#5F6E84', skin: '#DDEFE6', clothes: '#3B4F7E', anim: {} },
  [Race.MERFOLK]: { hair: '#3BA4F5', skin: '#FFE1CC', clothes: '#2CC5B0', anim: {} },
  [Race.GOLEM]: { hair: '#C9C2B5', skin: '#C9C2B5', clothes: '#C9C2B5', anim: { heavy: true } },
};
/** 没有种族（未觉醒的调试场景）：teal 衣服的普通旅人 */
export const DEFAULT_LOOK: RaceLook = { hair: '#7A5236', skin: '#FFE1CC', clothes: '#2CC5B0', anim: {} };

const INK = '#1F2D44';
const BLUSH = '#FFB3B8';

interface Acc {
  pos: number[];
  nor: number[];
  col: number[];
  part: number[];
  glow: number[];
}
const newAcc = (): Acc => ({ pos: [], nor: [], col: [], part: [], glow: [] });

const _c = new THREE.Color();
function add(acc: Acc, geo: THREE.BufferGeometry, part: number, hex: string, alpha = 1, glow = 0, flat = false): void {
  let g = geo.index ? geo.toNonIndexed() : geo;
  if (g !== geo) geo.dispose();
  if (flat) g.computeVertexNormals();
  const p = g.getAttribute('position');
  const n = g.getAttribute('normal');
  _c.set(hex);
  for (let i = 0; i < p.count; i++) {
    acc.pos.push(p.getX(i), p.getY(i), p.getZ(i));
    acc.nor.push(n.getX(i), n.getY(i), n.getZ(i));
    acc.col.push(_c.r, _c.g, _c.b, alpha);
    acc.part.push(part);
    acc.glow.push(glow);
  }
  g.dispose();
}

const sphere = (r: number, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1, ws = 14, hs = 10) =>
  new THREE.SphereGeometry(r, ws, hs).scale(sx, sy, sz).translate(x, y, z);
const cyl = (rt: number, rb: number, h: number, x: number, y: number, z: number, seg = 10) => new THREE.CylinderGeometry(rt, rb, h, seg).translate(x, y + h / 2, z);
const cone = (r: number, h: number, seg = 8) => new THREE.ConeGeometry(r, h, seg);

/** 带厚度的平面轮廓（翅膀、鳍耳）：xy 平面上的多边形，沿 z 挤出 */
function slab(pts: [number, number][], depth: number): THREE.BufferGeometry {
  const v = pts.map((p) => new THREE.Vector2(p[0], p[1]));
  const ccw = THREE.ShapeUtils.isClockWise(v) ? v.slice().reverse() : v;
  const faces = THREE.ShapeUtils.triangulateShape(ccw, []);
  const pos: number[] = [];
  const nor: number[] = [];
  const h = depth / 2;
  for (const [a, b, c] of faces) {
    for (const i of [a, b, c]) pos.push(ccw[i].x, ccw[i].y, h), nor.push(0, 0, 1);
    for (const i of [a, c, b]) pos.push(ccw[i].x, ccw[i].y, -h), nor.push(0, 0, -1);
  }
  for (let i = 0; i < ccw.length; i++) {
    const p = ccw[i];
    const q = ccw[(i + 1) % ccw.length];
    const ex = q.x - p.x;
    const ey = q.y - p.y;
    const l = Math.hypot(ex, ey) || 1;
    const nx = ey / l;
    const ny = -ex / l;
    for (const [x, y, z] of [[p.x, p.y, h], [p.x, p.y, -h], [q.x, q.y, -h], [p.x, p.y, h], [q.x, q.y, -h], [q.x, q.y, h]]) pos.push(x, y, z), nor.push(nx, ny, 0);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return g;
}

function ellipsePts(rx: number, ry: number, n = 14, cx = 0, cy = 0): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    out.push([cx + Math.cos(t) * rx, cy + Math.sin(t) * ry]);
  }
  return out;
}

const darken = (hex: string, k: number) => '#' + _c.set(hex).multiplyScalar(k).getHexString();

/** 脸：竖椭圆大黑眼 + 白色高光点 + 腮红 + 小嘴微笑。眼睛是压扁的深色小球（不用纹理），单独一个部件好眨眼 */
function face(acc: Acc, eyeZ: number, eyeY: number, skin: string, mouth = true): void {
  for (const sx of [1, -1]) {
    add(acc, sphere(0.068, sx * 0.18, eyeY, eyeZ, 0.82, 1.1, 0.5, 12, 8), PART.EYES, INK);
    add(acc, sphere(0.022, sx * 0.18 + 0.025, eyeY + 0.035, eyeZ + 0.03, 1, 1, 0.6, 8, 6), PART.EYES, '#FFFFFF');
    add(acc, sphere(0.07, sx * 0.3, eyeY - 0.12, eyeZ - 0.07, 1.2, 0.6, 0.35, 10, 6), PART.HEAD, BLUSH);
  }
  if (mouth) {
    const m = new THREE.TorusGeometry(0.045, 0.013, 6, 10, Math.PI);
    m.rotateZ(Math.PI);
    m.translate(0, eyeY - 0.15, eyeZ - 0.02);
    add(acc, m, PART.HEAD, darken(skin, 0.45));
  }
}

/**
 * 按种族生成几何。返回不透明与半透明两份（半透明那份可能为空）。
 * 每个种族的配件都放在动起来最有意义的部件上：耳朵在 EAR_*、尾巴在 TAIL、翅膀在 WING_*、光环在 HALO。
 */
export function buildAvatar(race: Race | undefined): { opaque: THREE.BufferGeometry; translucent: THREE.BufferGeometry | null; look: RaceLook } {
  const look = race ? RACE_LOOK[race] ?? DEFAULT_LOOK : DEFAULT_LOOK;
  const op = newAcc();
  const tr = newAcc();
  const { hair, skin, clothes } = look;
  const pants = look.pants ?? darken(clothes, 0.72);
  const shoe = '#8A5A3C';

  if (race === Race.SLIME) {
    // 水滴形身体（半透明）+ 头顶一个小尖；眼睛贴在身体表面外侧，透明身体盖不住
    const prof: THREE.Vector2[] = [];
    for (let i = 0; i <= 14; i++) {
      const t = i / 14;
      const y = t * 1.55;
      const r = t < 0.62 ? 0.62 * Math.sin(Math.acos(1 - t / 0.62)) : 0.62 * Math.pow(1 - (t - 0.62) / 0.38, 1.6) + 0.02;
      prof.push(new THREE.Vector2(Math.max(0.01, r), y));
    }
    prof[0].x = 0.01;
    add(tr, new THREE.LatheGeometry(prof, 18), PART.ROOT, '#6EC8FF', 0.78);
    add(op, sphere(0.1, -0.22, 0.95, 0.38, 1, 1.3, 0.5), PART.ROOT, '#FFFFFF');
    add(op, sphere(0.05, -0.12, 1.12, 0.33, 1, 1, 0.5), PART.ROOT, '#FFFFFF');
    face(op, 0.6, 0.62, '#2C8FD0');
    return { opaque: build(op), translucent: build(tr), look };
  }

  const golem = race === Race.GOLEM;
  // ── 头与头发 ────────────────────────────────────────────────
  if (golem) {
    add(op, new THREE.IcosahedronGeometry(0.5, 1).scale(1, 0.94, 0.96).translate(0, 1.5, 0), PART.HEAD, skin, 1, 0, true);
    add(op, new THREE.BoxGeometry(0.42, 0.14, 0.34).translate(0.06, 1.96, -0.04).rotateZ(0.08), PART.HEAD, '#8FD16F', 1, 0, true);
    add(op, new THREE.BoxGeometry(0.18, 0.1, 0.2).translate(-0.24, 1.9, 0.08), PART.HEAD, '#8FD16F', 1, 0, true);
  } else {
    add(op, sphere(0.5, 0, 1.5, 0, 1, 0.94, 1, 18, 14), PART.HEAD, skin);
    // 头发：盖住头顶与后脑的帽 + 前额刘海
    const cap = new THREE.SphereGeometry(0.535, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.52).scale(1, 0.96, 1.02).translate(0, 1.5, -0.02);
    add(op, cap, PART.HEAD, hair);
    const back = new THREE.SphereGeometry(0.52, 14, 8, Math.PI * 0.62, Math.PI * 0.76, Math.PI * 0.4, Math.PI * 0.32).translate(0, 1.5, -0.03);
    add(op, back, PART.HEAD, hair);
    add(op, sphere(0.2, 0.17, 1.83, 0.33, 1.3, 0.5, 0.6, 10, 6), PART.HEAD, hair);
    add(op, sphere(0.17, -0.2, 1.85, 0.31, 1.2, 0.48, 0.6, 10, 6), PART.HEAD, hair);
  }
  face(op, golem ? 0.47 : 0.45, 1.45, skin, race !== Race.DWARF);

  // ── 躯干、手脚 ──────────────────────────────────────────────
  if (golem) {
    add(op, new THREE.DodecahedronGeometry(0.34, 0).scale(1.05, 0.95, 0.85).translate(0, 0.7, 0), PART.ROOT, skin, 1, 0, true);
    add(op, new THREE.OctahedronGeometry(0.08, 0).translate(0, 0.74, 0.29), PART.ROOT, '#2CC5B0', 1, 1);
    for (const sx of [1, -1]) add(op, new THREE.BoxGeometry(0.16, 0.08, 0.16).translate(sx * 0.27, 0.98, 0), PART.ROOT, '#8FD16F', 1, 0, true);
  } else {
    const torso = new THREE.LatheGeometry(
      [
        new THREE.Vector2(0.01, 0.36),
        new THREE.Vector2(0.27, 0.38),
        new THREE.Vector2(0.3, 0.52),
        new THREE.Vector2(0.26, 0.8),
        new THREE.Vector2(0.2, 0.98),
        new THREE.Vector2(0.01, 1.04),
      ],
      14,
    );
    add(op, torso, PART.ROOT, clothes);
  }
  for (const [part, sx] of [[PART.ARM_L, 1], [PART.ARM_R, -1]] as const) {
    if (golem) {
      add(op, new THREE.BoxGeometry(0.15, 0.32, 0.15).translate(sx * 0.34, 0.74, 0), part, skin, 1, 0, true);
      add(op, new THREE.IcosahedronGeometry(0.1, 0).translate(sx * 0.35, 0.55, 0), part, skin, 1, 0, true);
    } else {
      add(op, cyl(0.075, 0.085, 0.3, sx * 0.33, 0.6, 0, 8), part, clothes);
      add(op, sphere(0.085, sx * 0.33, 0.57, 0.01, 1, 1, 1, 10, 8), part, skin);
    }
  }
  for (const [part, sx] of [[PART.LEG_L, 1], [PART.LEG_R, -1]] as const) {
    add(op, golem ? new THREE.BoxGeometry(0.17, 0.3, 0.17).translate(sx * 0.12, 0.2, 0) : cyl(0.09, 0.1, 0.3, sx * 0.12, 0.06, 0, 8), part, golem ? skin : pants, 1, 0, golem);
    add(op, sphere(0.1, sx * 0.12, 0.06, 0.05, 1, 0.65, 1.4, 10, 6), part, golem ? darken(skin, 0.85) : shoe, 1, 0, golem);
  }

  // ── 种族配件 ────────────────────────────────────────────────
  switch (race) {
    case Race.KIJIN: {
      // 额前两只象牙色小角 + 珊瑚头带，头带后面拖一条飘带
      for (const sx of [1, -1]) add(op, cone(0.075, 0.28).rotateZ(-sx * 0.25).translate(sx * 0.17, 2.06, 0.18), PART.HEAD, '#FFF3DE');
      add(op, new THREE.TorusGeometry(0.505, 0.035, 6, 24).rotateX(Math.PI / 2).translate(0, 1.66, 0), PART.HEAD, '#FF8C8C');
      add(op, new THREE.BoxGeometry(0.12, 0.34, 0.03).translate(0, -0.17, 0).translate(0, 1.6, -0.5), PART.RIBBON, '#FF8C8C');
      break;
    }
    case Race.DAEMON: {
      // 卷曲小角（两段弯锥）、小蝙蝠翅、尾巴末端一颗爱心
      for (const sx of [1, -1]) {
        add(op, cone(0.07, 0.16).rotateZ(-sx * 0.9).translate(sx * 0.3, 1.9, 0.05), PART.HEAD, '#5B6080');
        add(op, cone(0.05, 0.13).rotateZ(-sx * 0.1).translate(sx * 0.4, 2.0, 0.05), PART.HEAD, '#5B6080');
      }
      add(op, new THREE.TorusGeometry(0.29, 0.03, 6, 12).rotateX(Math.PI / 2).translate(0, 0.42, 0), PART.ROOT, '#FFC83D');
      const bat: [number, number][] = [[0, 0], [0.34, 0.12], [0.42, -0.02], [0.33, -0.08], [0.28, -0.02], [0.2, -0.1], [0.14, -0.03], [0.06, -0.08]];
      for (const [part, sx] of [[PART.WING_L, 1], [PART.WING_R, -1]] as const) add(op, slab(bat.map(([x, y]) => [x * sx, y]), 0.03).rotateY(sx * 0.5).translate(sx * 0.1, 0.88, -0.22), part, '#5B6080');
      const tail = new THREE.CylinderGeometry(0.025, 0.03, 0.42, 6).rotateX(-1.1).translate(0, 0.45, -0.38);
      add(op, tail, PART.TAIL, '#4B4F6E');
      const heart = slab([[0, -0.08], [0.08, 0.0], [0.07, 0.06], [0.03, 0.07], [0, 0.04], [-0.03, 0.07], [-0.07, 0.06], [-0.08, 0.0]], 0.04).translate(0, 0.58, -0.6);
      add(op, heart, PART.TAIL, '#FF5F5A');
      break;
    }
    case Race.DRAGONNEWT: {
      for (const sx of [1, -1]) add(op, cone(0.085, 0.34).rotateX(-0.45).rotateZ(-sx * 0.35).translate(sx * 0.24, 2.06, -0.06), PART.HEAD, '#FFF3DE');
      const memb: [number, number][] = [[0, 0], [0.3, 0.2], [0.38, 0.04], [0.26, -0.04], [0.16, -0.12]];
      for (const [part, sx] of [[PART.WING_L, 1], [PART.WING_R, -1]] as const) {
        add(op, slab(memb.map(([x, y]) => [x * sx, y]), 0.03).rotateY(sx * 0.6).translate(sx * 0.1, 0.9, -0.22), part, '#CDEFDD');
        add(op, cyl(0.02, 0.02, 0.36, 0, 0, 0, 5).rotateZ(-sx * 1.0).translate(sx * 0.1, 0.9, -0.24), part, '#68C34A');
      }
      const tail = new THREE.ConeGeometry(0.1, 0.5, 8).rotateX(-1.9).translate(0, 0.4, -0.42);
      add(op, tail, PART.TAIL, '#68C34A');
      for (let k = 0; k < 3; k++) add(op, cone(0.035, 0.07, 4).translate(0, 0.47 - k * 0.04, -0.3 - k * 0.12), PART.TAIL, '#FFC83D');
      break;
    }
    case Race.ANGEL: {
      // 暖黄光环（夜里微发光）+ 一对白色羽翼，每侧 3 片圆羽
      add(op, new THREE.TorusGeometry(0.26, 0.035, 8, 28).rotateX(Math.PI / 2).translate(0, 2.2, 0), PART.HALO, '#FFC83D', 1, 0.8);
      add(op, new THREE.TorusGeometry(0.29, 0.03, 6, 14).rotateX(Math.PI / 2).translate(0, 0.42, 0), PART.ROOT, '#3BA4F5');
      for (const [part, sx] of [[PART.WING_L, 1], [PART.WING_R, -1]] as const) {
        for (let k = 0; k < 3; k++) {
          const f = sphere(0.15 - k * 0.025, sx * (0.16 + k * 0.12), 0.96 - k * 0.1, -0.26 - k * 0.03, 1.35, 0.7, 0.32, 10, 6);
          add(op, f, part, '#FFFFFF');
        }
      }
      break;
    }
    case Race.ELF: {
      // 长尖耳（肤色）+ 叶子发夹
      // 尖耳从头发两侧斜向上伸出：比真实比例长得多，缩到几十像素时仍是一眼可认的轮廓
      for (const [part, sx] of [[PART.EAR_L, 1], [PART.EAR_R, -1]] as const) add(op, cone(0.09, 0.5, 6).scale(1, 1, 0.45).rotateZ(-sx * 0.95).translate(sx * 0.66, 1.66, -0.02), part, skin);
      add(op, slab([[0, 0], [0.09, 0.05], [0.15, 0.0], [0.09, -0.05]], 0.03).rotateZ(0.6).translate(0.28, 1.86, 0.3), PART.HEAD, '#68C34A');
      add(op, new THREE.TorusGeometry(0.29, 0.03, 6, 14).rotateX(Math.PI / 2).translate(0, 0.44, 0), PART.ROOT, '#B57D55');
      break;
    }
    case Race.DWARF: {
      // 蓬松圆胡子（盖住嘴）+ 额上暖黄护目镜
      for (const [x, y, z, r] of [[0, 1.27, 0.36, 0.2], [0.13, 1.31, 0.32, 0.15], [-0.13, 1.31, 0.32, 0.15], [0, 1.16, 0.32, 0.15]] as const) add(op, sphere(r, x, y, z, 1, 0.9, 0.8, 10, 8), PART.BEARD, hair);
      for (const sx of [1, -1]) add(op, new THREE.TorusGeometry(0.09, 0.03, 6, 14).translate(sx * 0.13, 1.75, 0.43), PART.HEAD, '#FFC83D');
      add(op, new THREE.TorusGeometry(0.29, 0.03, 6, 14).rotateX(Math.PI / 2).translate(0, 0.44, 0), PART.ROOT, '#8A5A3C');
      break;
    }
    case Race.BEASTKIN: {
      // 头顶三角兽耳（内侧粉）+ 白尖蓬松尾巴
      for (const [part, sx] of [[PART.EAR_L, 1], [PART.EAR_R, -1]] as const) {
        add(op, cone(0.14, 0.28, 4).rotateY(Math.PI / 4).scale(1, 1, 0.55).rotateZ(-sx * 0.3).translate(sx * 0.27, 1.98, -0.02), part, hair);
        add(op, cone(0.08, 0.18, 4).rotateY(Math.PI / 4).scale(1, 1, 0.3).rotateZ(-sx * 0.3).translate(sx * 0.26, 1.96, 0.04), part, '#FFB4BC');
      }
      add(op, sphere(0.16, 0, 0.52, -0.42, 0.8, 0.8, 1.5, 10, 8), PART.TAIL, hair);
      add(op, sphere(0.1, 0, 0.6, -0.62, 1, 1, 1, 8, 6), PART.TAIL, '#FFFFFF');
      break;
    }
    case Race.FAIRY: {
      // 两对半透明蝶翼 + 身边几颗暖黄闪光点（夜里发光）
      for (const [part, sx] of [[PART.WING_L, 1], [PART.WING_R, -1]] as const) {
        add(tr, slab(ellipsePts(0.2, 0.15, 14, sx * 0.2, 0.1), 0.02).rotateY(sx * 0.35).translate(sx * 0.06, 0.9, -0.22), part, '#BFE9FF', 0.6);
        add(tr, slab(ellipsePts(0.14, 0.1, 12, sx * 0.15, -0.1), 0.02).rotateY(sx * 0.35).translate(sx * 0.06, 0.9, -0.22), part, '#BFE9FF', 0.6);
      }
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * Math.PI * 2;
        add(op, new THREE.OctahedronGeometry(0.045, 0).translate(Math.cos(a) * 0.7, 1.0 + 0.25 * Math.sin(a * 2), Math.sin(a) * 0.7), PART.SPARK, '#FFE38A', 1, 1);
      }
      break;
    }
    case Race.UNDEAD: {
      // 脸颊一道缝线（深线 + 3 个小横杠）+ 头上一圈白绷带。可爱不吓人：不做骷髅、不做血色
      add(op, new THREE.BoxGeometry(0.16, 0.014, 0.02).rotateZ(0.35).translate(-0.27, 1.38, 0.42), PART.HEAD, '#5F6E84');
      for (let k = 0; k < 3; k++) add(op, new THREE.BoxGeometry(0.012, 0.06, 0.02).rotateZ(0.35).translate(-0.33 + k * 0.05, 1.36 + k * 0.018, 0.42), PART.HEAD, '#5F6E84');
      add(op, new THREE.TorusGeometry(0.51, 0.045, 6, 24).rotateX(Math.PI / 2 - 0.25).translate(0, 1.72, 0), PART.HEAD, '#FFFFFF');
      break;
    }
    case Race.MERFOLK: {
      // 扇形鳍耳（浅水蓝 + 白边）取代耳朵 + 贝壳发夹
      const fan: [number, number][] = [[0, 0]];
      for (let k = 0; k <= 6; k++) {
        const a = -0.9 + (k / 6) * 1.8;
        const r = k % 2 === 0 ? 0.34 : 0.29;
        fan.push([Math.cos(a) * r, Math.sin(a) * r]);
      }
      for (const [part, sx] of [[PART.EAR_L, 1], [PART.EAR_R, -1]] as const) {
        add(op, slab(fan.map(([x, y]) => [x * sx, y]), 0.03).rotateY(-sx * 0.3).translate(sx * 0.5, 1.6, 0), part, '#A6E3FA');
        add(op, slab(fan.map(([x, y]) => [x * sx * 1.1, y * 1.1]), 0.02).rotateY(-sx * 0.3).translate(sx * 0.5, 1.6, -0.02), part, '#FFFFFF');
      }
      add(op, sphere(0.08, 0.26, 1.88, 0.3, 1.2, 0.8, 0.5, 8, 6), PART.HEAD, '#FFD6C7');
      break;
    }
    default:
      break;
  }
  return { opaque: build(op), translucent: tr.pos.length ? build(tr) : null, look };
}

function build(acc: Acc): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(acc.pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(acc.nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(acc.col, 4));
  g.setAttribute('aPart', new THREE.Float32BufferAttribute(acc.part, 1));
  g.setAttribute('aGlow', new THREE.Float32BufferAttribute(acc.glow, 1));
  // 动画只在 ±0.6 单位内摆动：包围球给宽一点，视锥剔除不会误伤
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 1.1, 0), 1.9);
  return g;
}
