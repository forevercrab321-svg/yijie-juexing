/**
 * 委托徽章的几何（指南 5.5）：五种外形的扁平厚片合并成一个几何，供一个 InstancedMesh 画全部委托。
 *
 * 每种外形 = 白色外圈厚片（厚度 16% 宽度，≤ 指南的 20%）+ 前后两面略凸出的类型色内板（外圈留 12% 白边）
 * + 前后两面的白色圆章（直径 46%，图标在着色器里从图集取）。顶点属性 aShape 标出属于哪种外形，
 * 顶点着色器把与实例外形不符的顶点挤出裁剪空间——被裁掉的三角形几乎不花 GPU 时间，换来徽章只占 1 个 draw call。
 * 另有两张所有外形共用的面片（aShape = -1）：聚焦光晕 / 进行中进度弧（徽章背后），紧急「!」气泡（徽章上方）。
 *
 * 五种外形里没有方形：方块立在细柱上正是指南 1.2 点名的禁用结构（IP 红线）。外形与 2D 图钉 .cute-pin-* 一致：
 * 物资运输 = 扇贝圆章（12 瓣）· 魔物讨伐 = 盾 · 迷宫建设 = 六边形 · 异界交涉 = 对话气泡（左下小尾巴）· 紧急救援 = 圆角十字。
 *
 * 单位：徽章宽 1（中心在原点，y 朝上，z 是厚度方向，+z 为正面）。真实尺寸在着色器里按屏幕像素换算。
 */
import * as THREE from 'three';
import { extrudeOutline } from './geometry';

export const BADGE_PART = { RIM: 0, PLATE: 1, MEDAL_FRONT: 2, MEDAL_BACK: 3, HALO: 4, BUBBLE: 5 } as const;
/** 厚度（宽度的比例） */
export const BADGE_T = 0.16;
/** 圆章直径（宽度的比例） */
export const MEDAL_D = 0.46;

type P = [number, number];

/** 给多边形倒圆角：每个顶点用一段二次贝塞尔（控制点 = 原顶点）代替，r 为沿边退让的距离 */
function roundPolygon(pts: P[], r: number, seg = 3): P[] {
  const out: P[] = [];
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const a = pts[(i + n - 1) % n];
    const b = pts[(i + 1) % n];
    const la = Math.hypot(a[0] - p[0], a[1] - p[1]);
    const lb = Math.hypot(b[0] - p[0], b[1] - p[1]);
    const ra = Math.min(r, la * 0.45);
    const rb = Math.min(r, lb * 0.45);
    const s: P = [p[0] + ((a[0] - p[0]) / la) * ra, p[1] + ((a[1] - p[1]) / la) * ra];
    const e: P = [p[0] + ((b[0] - p[0]) / lb) * rb, p[1] + ((b[1] - p[1]) / lb) * rb];
    for (let k = 0; k <= seg; k++) {
      const t = k / seg;
      const u = 1 - t;
      out.push([u * u * s[0] + 2 * u * t * p[0] + t * t * e[0], u * u * s[1] + 2 * u * t * p[1] + t * t * e[1]]);
    }
  }
  return out;
}

/** 五种外形的轮廓（逆时针）与圆章中心（有的外形视觉重心不在原点） */
export function badgeOutlines(): { pts: P[]; medal: P; plateScale: number }[] {
  // 扇贝圆章：12 个圆鼓的瓣，瓣与瓣之间是向内的尖——邮戳 / 包裹贴纸
  const scallop: P[] = [];
  for (let i = 0; i < 48; i++) {
    const t = (i / 48) * Math.PI * 2;
    const r = 0.435 + 0.065 * Math.pow(Math.abs(Math.cos(6 * t)), 0.8);
    scallop.push([Math.cos(t) * r, Math.sin(t) * r]);
  }
  // 盾：上沿微拱，两侧直下，下半收成圆润的尖
  const shield: P[] = [];
  const q = (p0: P, c: P, p1: P, n: number, skipFirst = true) => {
    for (let i = skipFirst ? 1 : 0; i <= n; i++) {
      const t = i / n;
      const u = 1 - t;
      shield.push([u * u * p0[0] + 2 * u * t * c[0] + t * t * p1[0], u * u * p0[1] + 2 * u * t * c[1] + t * t * p1[1]]);
    }
  };
  q([0, -0.5], [0.4, -0.3], [0.44, 0.05], 8, false);
  q([0.44, 0.05], [0.45, 0.3], [0.42, 0.36], 3);
  q([0.42, 0.36], [0.38, 0.44], [0.3, 0.44], 2);
  q([0.3, 0.44], [0.12, 0.42], [0, 0.48], 3);
  q([0, 0.48], [-0.12, 0.42], [-0.3, 0.44], 3);
  q([-0.3, 0.44], [-0.38, 0.44], [-0.42, 0.36], 2);
  q([-0.42, 0.36], [-0.45, 0.3], [-0.44, 0.05], 3);
  q([-0.44, 0.05], [-0.4, -0.3], [0, -0.5], 7);
  // 六边形（尖顶朝上）：砖块 / 蜂巢
  const hex: P[] = [];
  for (let i = 0; i < 6; i++) {
    const t = Math.PI / 2 + (i / 6) * Math.PI * 2;
    hex.push([Math.cos(t) * 0.53, Math.sin(t) * 0.53]);
  }
  // 对话气泡：圆 + 左下的小尾巴
  const bubble: P[] = [];
  const cx = 0.03;
  const cy = 0.05;
  const R = 0.43;
  const a0 = (205 * Math.PI) / 180;
  const a1 = (238 * Math.PI) / 180;
  for (let i = 0; i <= 40; i++) {
    const t = a1 + (i / 40) * (Math.PI * 2 - (a1 - a0));
    bubble.push([cx + Math.cos(t) * R, cy + Math.sin(t) * R]);
  }
  bubble.push([-0.4, -0.5]);
  // 圆角十字：救护
  const w = 0.2;
  const L = 0.5;
  const cross: P[] = [
    [w, -L], [w, -w], [L, -w], [L, w], [w, w], [w, L],
    [-w, L], [-w, w], [-L, w], [-L, -w], [-w, -w], [-w, -L],
  ];
  return [
    { pts: scallop, medal: [0, 0], plateScale: 0.76 },
    { pts: shield, medal: [0, 0.03], plateScale: 0.76 },
    { pts: roundPolygon(hex, 0.09, 3), medal: [0, 0], plateScale: 0.76 },
    // 气泡的圆弧本来就是光滑的，只有尾巴两侧有角：不整圈倒角（整圈倒角会把 42 个点变成 126 个）
    { pts: bubble, medal: [cx, cy], plateScale: 0.76 },
    { pts: roundPolygon(cross, 0.07, 2), medal: [0, 0], plateScale: 0.7 },
  ];
}

interface Acc {
  pos: number[];
  nor: number[];
  uv: number[];
  part: number[];
  shape: number[];
}

function push(acc: Acc, g: THREE.BufferGeometry, part: number, shape: number, uvFrom?: (x: number, y: number, back: boolean) => [number, number]): void {
  const p = g.getAttribute('position');
  const n = g.getAttribute('normal');
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    acc.pos.push(x, y, p.getZ(i));
    acc.nor.push(n.getX(i), n.getY(i), n.getZ(i));
    const uv = uvFrom ? uvFrom(x, y, n.getZ(i) < 0) : [0, 0];
    acc.uv.push(uv[0], uv[1]);
    acc.part.push(part);
    acc.shape.push(shape);
  }
}

/** 一块只有正面（或只有背面）的平板：轮廓三角化后放在 z 处 */
function cap(pts: P[], z: number, front: boolean): THREE.BufferGeometry {
  const v = pts.map((p) => new THREE.Vector2(p[0], p[1]));
  const ccw = THREE.ShapeUtils.isClockWise(v) ? v.slice().reverse() : v;
  const faces = THREE.ShapeUtils.triangulateShape(ccw, []);
  const pos: number[] = [];
  const nor: number[] = [];
  for (const [a, b, c] of faces) {
    for (const i of front ? [a, b, c] : [a, c, b]) {
      pos.push(ccw[i].x, ccw[i].y, z);
      nor.push(0, 0, front ? 1 : -1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return g;
}

function circle(cx: number, cy: number, r: number, n: number): P[] {
  const out: P[] = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    out.push([cx + Math.cos(t) * r, cy + Math.sin(t) * r]);
  }
  return out;
}

/** 一张以原点为中心、边长 1 的面片（xy 平面），uv 0–1 */
function quad(): THREE.BufferGeometry {
  const g = new THREE.PlaneGeometry(1, 1).toNonIndexed();
  return g;
}

export function createBadgeGeometry(): THREE.BufferGeometry {
  const acc: Acc = { pos: [], nor: [], uv: [], part: [], shape: [] };
  const h = BADGE_T / 2;
  // 光晕 / 进度弧：最先画（在徽章背后，深度测试让徽章盖住它）
  {
    const g = quad();
    push(acc, g, BADGE_PART.HALO, -1, (x, y) => [x + 0.5, y + 0.5]);
    g.dispose();
  }
  badgeOutlines().forEach((o, shape) => {
    const rim = extrudeOutline(
      o.pts.map((p) => new THREE.Vector2(p[0], p[1])),
      [],
      BADGE_T,
    );
    push(acc, rim, BADGE_PART.RIM, shape);
    rim.dispose();
    const s = o.plateScale;
    const plate = o.pts.map((p): P => [o.medal[0] * (1 - s) + p[0] * s, o.medal[1] * (1 - s) + p[1] * s]);
    for (const front of [true, false]) {
      const g = cap(plate, front ? h + 0.012 : -h - 0.012, front);
      push(acc, g, BADGE_PART.PLATE, shape);
      g.dispose();
    }
    const md = circle(o.medal[0], o.medal[1], MEDAL_D / 2, 22);
    for (const front of [true, false]) {
      const g = cap(md, front ? h + 0.026 : -h - 0.026, front);
      // 圆章 uv：圆章直径映射到 0–1；背面左右翻转，从背后看图标也是正的
      push(acc, g, front ? BADGE_PART.MEDAL_FRONT : BADGE_PART.MEDAL_BACK, shape, (x, y, back) => {
        const u = (x - o.medal[0]) / MEDAL_D + 0.5;
        return [back ? 1 - u : u, (y - o.medal[1]) / MEDAL_D + 0.5];
      });
      g.dispose();
    }
  });
  // 紧急「!」气泡：最后画，永远在最前
  {
    const g = quad();
    push(acc, g, BADGE_PART.BUBBLE, -1, (x, y) => [x + 0.5, y + 0.5]);
    g.dispose();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(acc.pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(acc.nor, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(acc.uv, 2));
  geo.setAttribute('aPart', new THREE.Float32BufferAttribute(acc.part, 1));
  geo.setAttribute('aShape', new THREE.Float32BufferAttribute(acc.shape, 1));
  return geo;
}

/** 细柱：6 边圆柱，单位高度（y 0–1）、单位直径，不封底 */
export function createPoleGeometry(): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(0.5, 0.5, 1, 6, 1, true);
  g.translate(0, 0.5, 0);
  return g;
}
