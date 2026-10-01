/**
 * 程序化纽约：地面、水面、街区、楼群、公园、树、屋顶件。
 *
 * 全部在本地生成，不发网络请求。同一个种子每次生成同一座城，截图与回归可比。
 *
 * draw call 预算（简报 7.1）：
 *   地面 1（陆地顶面 + 堤岸 + 街道 + 人行道台基 + 公园 + 广场，全部顶点色合并）
 *   水面 1（外海 + 公园湖泊 + 纪念池合并）、岸线浅滩带 1（半透明，不进阴影 pass）
 *   楼体 1（InstancedMesh，同一材质，窗户由着色器程序化生成）
 *   水塔 1、灯笼 1、灯笼光晕 1、树 1
 * 阴影 pass 只画楼体、水塔、树（低档不画树）。
 */
import * as THREE from 'three';
import { mergeNonIndexed, smoothBlob } from './geometry';
import { LandIndex, LAND_Y, WATER_Y } from './land';
import { project, fromGrid, toGrid, GRID_YAW, STREET_PITCH, type XZ, type GridCoord } from './geo';
import {
  AVENUES,
  WIDE_STREETS,
  BROADWAY,
  CENTRAL_PARK,
  CP_WATERS,
  CP_LAWNS,
  GRID_PARKS,
  POLY_PARKS,
  TIMES_SQUARE,
  EMPIRE_STATE,
  CHRYSLER,
  ONE_WTC,
  WTC_POOLS,
  PENCIL_TOWERS,
  type GridRect,
} from './data/places';
import { STYLE, type MaterialKit } from './materials';
import type { Quality } from './quality';

// ── 工具 ─────────────────────────────────────────────────────────────

/** 确定性随机数：同一个种子生成同一座城 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const _c = new THREE.Color();
function hex(h: string): [number, number, number] {
  _c.set(h); // 自动从 sRGB 转到线性空间
  return [_c.r, _c.g, _c.b];
}

/**
 * 顶点色几何体构建器：所有地面元素合并成一个网格、一个 draw call
 *
 * 数据直接写进按需翻倍的 TypedArray。原先是三条 JS 数组 push、build() 时再整体转成 Float32Array：
 * 高档地面约 4.5 万个顶点，意味着三条十几万元素的数组反复扩容拷贝、最后再逐个转换一遍，
 * 冷启动时既慢又制造大量垃圾（QA-R1-05）。输出与原先逐位相同：
 *  · 位置存 Float64——tri() 用它判断三角形朝向，必须与原先 JS 数组里的双精度值一致；build() 时才转 Float32；
 *  · 法线、颜色原先也是在 build() 时转 Float32，直接存 Float32 得到的舍入结果完全一样；
 *  · 索引按 three 的 setIndex 规则选 16 / 32 位（任何一个值 ≥ 65535 才用 32 位）。
 */
export class MeshBuilder {
  private pos = new Float64Array(3 * 4096);
  private nor = new Float32Array(3 * 4096);
  private col: Float32Array | null;
  private idx = new Uint32Array(3 * 4096);
  private nv = 0;
  private ni = 0;

  constructor(withColor = true) {
    this.col = withColor ? new Float32Array(3 * 4096) : null;
  }

  get vertexCount(): number {
    return this.nv;
  }

  private growVertices(): void {
    const cap = this.pos.length * 2;
    const pos = new Float64Array(cap);
    pos.set(this.pos);
    this.pos = pos;
    const nor = new Float32Array(cap);
    nor.set(this.nor);
    this.nor = nor;
    if (this.col) {
      const col = new Float32Array(cap);
      col.set(this.col);
      this.col = col;
    }
  }

  vertex(x: number, y: number, z: number, nx: number, ny: number, nz: number, c?: readonly number[]): number {
    const i = this.nv;
    const o = i * 3;
    if (o + 3 > this.pos.length) this.growVertices();
    const p = this.pos;
    p[o] = x;
    p[o + 1] = y;
    p[o + 2] = z;
    const n = this.nor;
    n[o] = nx;
    n[o + 1] = ny;
    n[o + 2] = nz;
    const col = this.col;
    if (col) {
      if (c) {
        col[o] = c[0];
        col[o + 1] = c[1];
        col[o + 2] = c[2];
      } else {
        col[o] = 1;
        col[o + 1] = 1;
        col[o + 2] = 1;
      }
    }
    this.nv = i + 1;
    return i;
  }

  /** 加三角形，并保证几何正面朝向 (nx, ny, nz) 这一侧 */
  tri(a: number, b: number, c: number, nx: number, ny: number, nz: number): void {
    const p = this.pos;
    const ax = p[a * 3], ay = p[a * 3 + 1], az = p[a * 3 + 2];
    const e1x = p[b * 3] - ax, e1y = p[b * 3 + 1] - ay, e1z = p[b * 3 + 2] - az;
    const e2x = p[c * 3] - ax, e2y = p[c * 3 + 1] - ay, e2z = p[c * 3 + 2] - az;
    const cx = e1y * e2z - e1z * e2y;
    const cy = e1z * e2x - e1x * e2z;
    const cz = e1x * e2y - e1y * e2x;
    let k = this.ni;
    if (k + 3 > this.idx.length) {
      const idx = new Uint32Array(this.idx.length * 2);
      idx.set(this.idx);
      this.idx = idx;
    }
    const idx = this.idx;
    idx[k++] = a;
    if (cx * nx + cy * ny + cz * nz >= 0) {
      idx[k++] = b;
      idx[k++] = c;
    } else {
      idx[k++] = c;
      idx[k++] = b;
    }
    this.ni = k;
  }

  /** 水平矩形：中心 (cx, cz)，局部 x 轴 (ux, uz)，半宽 hw、半深 hd */
  rectXZ(cx: number, cz: number, ux: number, uz: number, hw: number, hd: number, y: number, c: readonly number[]): void {
    const vx = -uz;
    const vz = ux;
    const i0 = this.vertex(cx - ux * hw - vx * hd, y, cz - uz * hw - vz * hd, 0, 1, 0, c);
    const i1 = this.vertex(cx + ux * hw - vx * hd, y, cz + uz * hw - vz * hd, 0, 1, 0, c);
    const i2 = this.vertex(cx + ux * hw + vx * hd, y, cz + uz * hw + vz * hd, 0, 1, 0, c);
    const i3 = this.vertex(cx - ux * hw + vx * hd, y, cz - uz * hw + vz * hd, 0, 1, 0, c);
    this.tri(i0, i1, i2, 0, 1, 0);
    this.tri(i0, i2, i3, 0, 1, 0);
  }

  /** 水平多边形（可带洞），用 three 的 earcut 三角化 */
  polygonXZ(outer: XZ[], holes: XZ[][], y: number, c: readonly number[]): void {
    const contour = outer.map((p) => new THREE.Vector2(p.x, p.z));
    const holeV = holes.map((h) => h.map((p) => new THREE.Vector2(p.x, p.z)));
    const faces = THREE.ShapeUtils.triangulateShape(contour, holeV);
    const base = this.vertexCount;
    for (const p of outer) this.vertex(p.x, y, p.z, 0, 1, 0, c);
    for (const h of holes) for (const p of h) this.vertex(p.x, y, p.z, 0, 1, 0, c);
    for (const [a, b, cc] of faces) this.tri(base + a, base + b, base + cc, 0, 1, 0);
  }

  /** 竖直墙片：从 (ax, az) 到 (bx, bz)，y 从 y0 到 y1，正面朝 (nx, nz) */
  wall(ax: number, az: number, bx: number, bz: number, y0: number, y1: number, nx: number, nz: number, c: readonly number[]): void {
    const i0 = this.vertex(ax, y0, az, nx, 0, nz, c);
    const i1 = this.vertex(bx, y0, bz, nx, 0, nz, c);
    const i2 = this.vertex(bx, y1, bz, nx, 0, nz, c);
    const i3 = this.vertex(ax, y1, az, nx, 0, nz, c);
    this.tri(i0, i1, i2, nx, 0, nz);
    this.tri(i0, i2, i3, nx, 0, nz);
  }

  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    const n = this.nv * 3;
    // Float32BufferAttribute 会把传入的数组拷成恰好长度的 Float32Array（Float64 → Float32 的舍入与原先相同）
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos.subarray(0, n), 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor.subarray(0, n), 3));
    if (this.col) g.setAttribute('color', new THREE.Float32BufferAttribute(this.col.subarray(0, n), 3));
    const idx = this.idx.subarray(0, this.ni);
    let needs32 = false;
    for (let i = idx.length - 1; i >= 0; i--) {
      if (idx[i] >= 65535) {
        needs32 = true;
        break;
      }
    }
    g.setIndex(needs32 ? new THREE.Uint32BufferAttribute(idx, 1) : new THREE.Uint16BufferAttribute(idx, 1));
    g.computeBoundingSphere();
    return g;
  }
}

// ── 调色板（sRGB 写法，取色时转线性）───────────────────────────────────
const C = {
  field: hex('#8b8a66'),
  embankment: hex('#8a7f6c'),
  asphalt: hex('#6a6258'),
  plinth: hex('#b5a891'),
  // 草地与树冠比原先收一成饱和度：调色后的暖高光会把黄绿推得更艳，苔绿才是美术方向要的绿
  park: hex('#6f7b50'),
  lawn: hex('#8b9763'),
  plaza: hex('#c9bb9a'),
  tsPlaza: hex('#d3c4a0'),
  tkts: hex('#8e3f2e'),
  broadway: hex('#5f584f'),
};
// 石灰岩与砂岩为主，赤陶与红砖只做点缀：俯瞰时是统一的暖石色，不是拼布
const PAL_MASONRY = [
  '#d6c9ad', '#d6c9ad', '#cfc2a6', '#c8b38c', '#c8b38c', '#a39b8e', '#aaa194',
  '#e0d6bf', '#e0d6bf', '#cbbfa6', '#bf9a62', '#a5674b', '#92563f', '#b58977',
].map(hex);
const PAL_BROWN = ['#7a5141', '#8f5340', '#9b6a52', '#86604a'].map(hex);
const PAL_RIBBON = ['#c9c1b0', '#b5ad9d', '#d8cfbd', '#bdb39f'].map(hex);
const PAL_GLASS = ['#8f99a0', '#9a9384', '#a3a49b', '#8c8f8a', '#979b9c'].map(hex);
const PAL_BLANK = hex('#9d958a');
const PAL_FOLIAGE = ['#6e7a4e', '#7a8654', '#86905f', '#606d48', '#74804f'].map(hex);
const PAL_AUTUMN = ['#a8873f', '#9c6a3c', '#b39a52'].map(hex);

// ── 高度场：中城与下城金融区两个高峰，中间格林威治村低谷 ─────────────────
interface Bump {
  c: XZ;
  sx: number; // 沿网格「上城」方向的 σ（米）
  sz: number; // 横向 σ
  amp: number;
}
const BUMPS: Bump[] = [
  { c: project(40.7565, -73.9795), sx: 1250, sz: 640, amp: 172 }, // 中城
  { c: project(40.7078, -74.0102), sx: 520, sz: 520, amp: 178 }, // 金融区
  { c: project(40.7538, -74.0012), sx: 300, sz: 300, amp: 95 }, // 哈德逊园区
  { c: project(40.6935, -73.9872), sx: 450, sz: 450, amp: 90 }, // 布鲁克林市中心
  { c: project(40.7462, -73.9525), sx: 420, sz: 420, amp: 85 }, // 长岛市
  { c: project(40.7195, -74.0345), sx: 480, sz: 480, amp: 90 }, // 泽西城滨水区
];
const VILLAGE = project(40.733, -74.001);
const COS29 = Math.cos((29 * Math.PI) / 180);
const SIN29 = Math.sin((29 * Math.PI) / 180);

function bumpFactor(x: number, z: number): number {
  let h = 0;
  for (const b of BUMPS) {
    const dx = x - b.c.x;
    const dz = z - b.c.z;
    // 投到网格坐标系，让中城的高峰沿大道方向拉长
    const u = dx * SIN29 - dz * COS29;
    const v = dx * COS29 + dz * SIN29;
    h += b.amp * Math.exp(-(u * u) / (2 * b.sx * b.sx) - (v * v) / (2 * b.sz * b.sz));
  }
  return h;
}

/** 曼哈顿脊线（炮台公园 → 哈莱姆），外围铺楼密度按到它的距离衰减 */
const SPINE_A = project(40.7033, -74.015);
const SPINE_B = project(40.8, -73.955);
function spineDistance(x: number, z: number): number {
  const abx = SPINE_B.x - SPINE_A.x;
  const abz = SPINE_B.z - SPINE_A.z;
  let t = ((x - SPINE_A.x) * abx + (z - SPINE_A.z) * abz) / (abx * abx + abz * abz);
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(x - (SPINE_A.x + abx * t), z - (SPINE_A.z + abz * t));
}

// ── 排除区：公园、广场、百老汇、地标地块、桥引道 ───────────────────────
function inGridRect(g: GridCoord, r: GridRect, pad = 0): boolean {
  return g.s >= r.s0 - pad / STREET_PITCH && g.s <= r.s1 + pad / STREET_PITCH && g.a >= r.a0 - pad && g.a <= r.a1 + pad;
}

function pointInRing(ring: XZ[], x: number, z: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[j];
    const b = ring[i];
    if (a.z > z !== b.z > z && x < a.x + ((z - a.z) / (b.z - a.z)) * (b.x - a.x)) inside = !inside;
  }
  return inside;
}

function distToPolyline(pts: XZ[], x: number, z: number): number {
  let best = Infinity;
  for (let i = 0; i + 1 < pts.length; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    const abx = b.x - a.x;
    const abz = b.z - a.z;
    let t = ((x - a.x) * abx + (z - a.z) * abz) / (abx * abx + abz * abz);
    t = Math.max(0, Math.min(1, t));
    best = Math.min(best, Math.hypot(x - (a.x + abx * t), z - (a.z + abz * t)));
  }
  return best;
}

/** 百老汇在时代广场一带的网格 a 坐标（先驱广场 → 哥伦布圆环的线性段） */
export function broadwayA(s: number): number {
  return 280 + (s - 34) * 22.4;
}

/** 时代广场排除区：交给 landmarks 生成带广告牌的楼 */
export function inTimesSquareZone(g: GridCoord): boolean {
  return g.s >= TIMES_SQUARE.s0 - 0.1 && g.s <= 47.95 && g.a >= 420 && g.a <= 760;
}

// ── 城市输出 ─────────────────────────────────────────────────────────

export interface BuildingInstance {
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  d: number;
  yaw: number;
  style: number;
  color: readonly number[];
}

export interface CityResult {
  group: THREE.Group;
  buildings: THREE.InstancedMesh;
  stats: { buildings: number; trees: number; waterTowers: number; lanterns: number; blocks: number };
  /** 各生成阶段耗时（毫秒），调试读数用 */
  phases: Record<string, number>;
  /** 委托光柱附近的屋顶高度查询（光柱底座用不到，留给后续的遮挡分析） */
  dispose(): void;
}

interface CityContext {
  land: LandIndex;
  quality: Quality;
  materials: MaterialKit;
  /** 地标模块追加的楼体实例（帝国大厦、时代广场楼群等），与城市楼群合并为同一个 InstancedMesh */
  extraBuildings: BuildingInstance[];
  seed?: number;
}

export function buildCity(ctx: CityContext): CityResult {
  const { land, quality, materials } = ctx;
  const rng = mulberry32(ctx.seed ?? 20261001);
  const ground = new MeshBuilder(true);
  const waterB = new MeshBuilder(false);
  const buildings: BuildingInstance[] = [];
  const trees: { x: number; z: number; s: number; c: readonly number[]; y: number }[] = [];
  // 预算上限（简报 7.1：三角形按最差视角整帧计，阴影 pass 会把投影物再画一遍）
  const CAPS = quality.tier === 'high' ? { trees: 2600, towers: 600, lanterns: 900 } : { trees: 1100, towers: 260, lanterns: 420 };
  const keepRatio = (n: number, cap: number) => (n > cap ? cap / n : 1);
  const towers: { x: number; y: number; z: number; s: number; yaw: number }[] = [];
  const lanterns: { x: number; y: number; z: number }[] = [];
  let blocks = 0;

  const phases: Record<string, number> = {};
  let phaseT = performance.now();
  const mark = (name: string) => {
    const now = performance.now();
    phases[name] = Math.round((now - phaseT) * 10) / 10;
    phaseT = now;
  };
  const manhattanId = land.polygonAt(0, 0);
  const g: GridCoord = { s: 0, a: 0 };
  const tmp: XZ = { x: 0, z: 0 };

  // 预先投影排除区
  const broadwayPts = BROADWAY.map(([la, lo]) => project(la, lo));
  const polyParks = POLY_PARKS.map((p) => ({ ...p, pts: p.ring.map(([la, lo]) => project(la, lo)) }));
  const esb = project(EMPIRE_STATE[0], EMPIRE_STATE[1]);
  const chrysler = project(CHRYSLER[0], CHRYSLER[1]);
  const wtc = project(ONE_WTC[0], ONE_WTC[1]);
  const pools = WTC_POOLS.map(([la, lo]) => project(la, lo));
  const poolCenter = { x: (pools[0].x + pools[1].x) / 2, z: (pools[0].z + pools[1].z) / 2 };
  const pencils = PENCIL_TOWERS.map((p) => ({ ...p, xz: project(p.at[0], p.at[1]) }));

  // 排除测试每个地块都要跑一遍（上万次），先用包围盒挡掉绝大多数
  const bboxOf = (pts: XZ[]) => ({
    minX: Math.min(...pts.map((q) => q.x)),
    maxX: Math.max(...pts.map((q) => q.x)),
    minZ: Math.min(...pts.map((q) => q.z)),
    maxZ: Math.max(...pts.map((q) => q.z)),
  });
  const parkBoxes = polyParks.map((p) => ({ pts: p.pts, ...bboxOf(p.pts) }));
  const broadwaySegs = broadwayPts.slice(0, -1).map((a, i) => ({ seg: [a, broadwayPts[i + 1]], ...bboxOf([a, broadwayPts[i + 1]]) }));
  const nearBroadway = (x: number, z: number, r: number): boolean => {
    for (const b of broadwaySegs) {
      if (x < b.minX - r || x > b.maxX + r || z < b.minZ - r || z > b.maxZ + r) continue;
      if (distToPolyline(b.seg, x, z) < r) return true;
    }
    return false;
  };
  // 点状排除区（地标脚下、世贸纪念池、铅笔楼）：每个地块都要逐个比一遍，所以比平方距离而不调 Math.hypot——
  // 冷启动时代码还没被优化，hypot 的内建调用开销在上万次循环里很显眼（QA-R1-05）
  const pointExclusions = [
    { x: esb.x, z: esb.z, r: 70 },
    { x: chrysler.x, z: chrysler.z, r: 45 },
    { x: wtc.x, z: wtc.z, r: 55 },
    { x: poolCenter.x, z: poolCenter.z, r: 120 },
    ...pencils.map((p) => ({ x: p.xz.x, z: p.xz.z, r: 22 })),
  ];
  const excluded = (x: number, z: number, radius: number): boolean => {
    toGrid(x, z, g);
    if (inGridRect(g, CENTRAL_PARK, radius)) return true;
    if (inTimesSquareZone(g)) return true;
    for (const p of GRID_PARKS) if (inGridRect(g, p, radius * 0.5)) return true;
    for (const p of parkBoxes) {
      if (x < p.minX || x > p.maxX || z < p.minZ || z > p.maxZ) continue;
      if (pointInRing(p.pts, x, z)) return true;
    }
    if (nearBroadway(x, z, 13 + radius)) return true;
    for (const p of pointExclusions) {
      const dx = x - p.x;
      const dz = z - p.z;
      const rr = p.r + radius;
      if (dx * dx + dz * dz < rr * rr) return true;
    }
    for (const d of land.decks) {
      const rx = x - d.cx;
      const rz = z - d.cz;
      const t = rx * d.dx + rz * d.dz;
      if (Math.abs(t) > d.halfLength) continue;
      if (Math.abs(-rx * d.dz + rz * d.dx) < d.halfWidth + 6 + radius) return true;
    }
    return false;
  };

  mark('setup');
  // 岸线浅滩带：沿每条海岸线放一条朝水面外扩的带子（宽度在着色器里按相机距离给），见 materials.ts 的 shore
  const shorePos: number[] = [];
  const shoreOut: number[] = [];
  const shoreSide: number[] = [];
  const shoreIdx: number[] = [];
  // ── 1. 陆地顶面 + 堤岸侧壁 ───────────────────────────────────────
  for (const poly of land.polygons) {
    const rings = poly.rings.map((r) => {
      const pts: XZ[] = [];
      for (let i = 0; i < r.length; i += 2) pts.push({ x: r[i], z: r[i + 1] });
      return pts;
    });
    ground.polygonXZ(rings[0], rings.slice(1), LAND_Y, C.field);
    for (const ring of rings) {
      const segN: number[] = [];
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i];
        const b = ring[(i + 1) % ring.length];
        const ex = b.x - a.x;
        const ez = b.z - a.z;
        const len = Math.hypot(ex, ez) || 1;
        let nx = ez / len;
        let nz = -ex / len;
        // 法线朝陆地内侧就翻过来：侧壁要朝向水面
        const mx = (a.x + b.x) / 2 + nx * 2;
        const mz = (a.z + b.z) / 2 + nz * 2;
        if (land.isLand(mx, mz)) {
          nx = -nx;
          nz = -nz;
        }
        segN.push(nx, nz);
        ground.wall(a.x, a.z, b.x, b.z, WATER_Y - 4, LAND_Y, nx, nz, C.embankment);
      }
      // 每个顶点取相邻两段法线的平均（码头尖角处两段几乎反向，退回本段法线，避免带子翻折）
      const n = ring.length;
      if (n < 3) continue;
      const base = shorePos.length / 3;
      for (let i = 0; i < n; i++) {
        const j = (i + n - 1) % n;
        let ox = segN[j * 2] + segN[i * 2];
        let oz = segN[j * 2 + 1] + segN[i * 2 + 1];
        const ol = Math.hypot(ox, oz);
        if (ol < 0.2) {
          ox = segN[i * 2];
          oz = segN[i * 2 + 1];
        } else {
          ox /= ol;
          oz /= ol;
        }
        for (const side of [0, 1]) {
          // 比水面高 1 m（仍在岸顶以下 2 m）：贴得太近时近景的深度精度分不开两层，整条岸线会被水面吞掉
          shorePos.push(ring[i].x, WATER_Y + 1.0, ring[i].z);
          shoreOut.push(ox, oz);
          shoreSide.push(side);
        }
      }
      for (let i = 0; i < n; i++) {
        const i0 = base + i * 2;
        const i1 = base + ((i + 1) % n) * 2;
        shoreIdx.push(i0, i1, i0 + 1, i1, i1 + 1, i0 + 1);
      }
    }
  }

  mark('land');
  // ── 2. 水面：外海一整块 + 公园湖泊 ──────────────────────────────────
  {
    const R = 60000;
    waterB.rectXZ(0, 0, 1, 0, R, R, WATER_Y, [1, 1, 1]);
  }

  // ── 3. 楼体生成工具 ───────────────────────────────────────────────
  const yawCos = Math.cos(GRID_YAW);
  const yawSin = Math.sin(GRID_YAW);
  /** 网格局部 x 轴（横街方向，向东）在世界中的单位向量 */
  const gridUx = yawCos;
  const gridUz = -yawSin;

  const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rng() * arr.length) % arr.length];
  const jitter = (c: readonly number[], k = 0.07): number[] => {
    const f = 1 + (rng() - 0.5) * 2 * k;
    return [c[0] * f, c[1] * f, c[2] * f];
  };

  const styleFor = (h: number, residential: boolean): number => {
    const r = rng();
    if (h > 110) return r < 0.7 ? STYLE.CURTAIN : STYLE.RIBBON;
    if (h > 45) return r < 0.5 ? STYLE.PUNCHED : r < 0.85 ? STYLE.RIBBON : STYLE.CURTAIN;
    if (residential && r < 0.32) return STYLE.BROWNSTONE;
    return r < 0.88 ? STYLE.PUNCHED : STYLE.RIBBON;
  };
  const colorFor = (style: number): number[] => {
    if (style === STYLE.CURTAIN) return jitter(pick(PAL_GLASS), 0.05);
    if (style === STYLE.RIBBON) return jitter(pick(PAL_RIBBON));
    if (style === STYLE.BROWNSTONE) return jitter(pick(PAL_BROWN));
    if (style === STYLE.BLANK) return jitter(PAL_BLANK);
    return jitter(pick(PAL_MASONRY));
  };

  /** 放一栋楼（可能拆成裙楼 + 塔楼 + 冠顶三段），并按概率加屋顶件 */
  const addBuilding = (cx: number, cz: number, ux: number, uz: number, w: number, d: number, h: number, residential: boolean): void => {
    const yaw = Math.atan2(-uz, ux);
    const style = styleFor(h, residential);
    const color = colorFor(style);
    let topY = h;
    let topW = w;
    let topD = d;
    if (h > 110 && w > 18 && d > 18 && rng() < 0.6) {
      // 退台：裙楼贴满地块，塔楼收进去——纽约 1916 年区划法留下的天际线特征
      const podium = 14 + rng() * 26;
      buildings.push({ x: cx, y: 0, z: cz, w, h: podium, d, yaw, style: style === STYLE.CURTAIN ? STYLE.RIBBON : style, color: style === STYLE.CURTAIN ? colorFor(STYLE.RIBBON) : color });
      const k = 0.58 + rng() * 0.2;
      topW = w * k;
      topD = d * k;
      if (h > 165 && rng() < 0.6) {
        const mid = podium + (h - podium) * (0.62 + rng() * 0.15);
        buildings.push({ x: cx, y: podium, z: cz, w: topW, h: mid - podium, d: topD, yaw, style, color });
        topW *= 0.72;
        topD *= 0.72;
        buildings.push({ x: cx, y: mid, z: cz, w: topW, h: h - mid, d: topD, yaw, style, color });
      } else {
        buildings.push({ x: cx, y: podium, z: cz, w: topW, h: h - podium, d: topD, yaw, style, color });
      }
    } else {
      buildings.push({ x: cx, y: 0, z: cz, w, h, d, yaw, style, color });
    }
    topY = h;
    // 屋顶件：机房、水塔（砖石中层楼的纽约标志）、灯笼（异世界的暖光节点）
    const vx = -uz;
    const vz = ux;
    if (quality.tier === 'high' && h > 50 && topW > 14 && topD > 14 && rng() < 0.2) {
      const pw = topW * (0.3 + rng() * 0.2);
      const pd = topD * (0.3 + rng() * 0.2);
      const ox = (rng() - 0.5) * (topW - pw) * 0.6;
      const oz = (rng() - 0.5) * (topD - pd) * 0.6;
      buildings.push({ x: cx + ux * ox + vx * oz, y: topY, z: cz + uz * ox + vz * oz, w: pw, h: 3.5 + rng() * 4, d: pd, yaw, style: STYLE.BLANK, color: colorFor(STYLE.BLANK) });
    }
    if ((style === STYLE.PUNCHED || style === STYLE.BROWNSTONE) && h > 16 && h < 85 && topW > 9 && topD > 9 && rng() < 0.17) {
      const ox = (rng() - 0.5) * (topW - 7);
      const oz = (rng() - 0.5) * (topD - 7);
      towers.push({ x: cx + ux * ox + vx * oz, y: topY, z: cz + uz * ox + vz * oz, s: 4.2 + rng() * 1.6, yaw: rng() * Math.PI });
    }
    if (style !== STYLE.CURTAIN && h > 10 && h < 160 && rng() < 0.11) {
      const n = rng() < 0.4 ? 2 : 1;
      for (let i = 0; i < n; i++) {
        const sx = (i === 0 ? 1 : -1) * (topW / 2 - 1.2);
        const sz = (rng() < 0.5 ? 1 : -1) * (topD / 2 - 1.2);
        lanterns.push({ x: cx + ux * sx + vx * sz, y: topY + 1.6, z: cz + uz * sx + vz * sz });
      }
    }
  };

  /**
   * 一个街区：铺沥青（延伸到四周街道中心线，相邻街区正好拼满路面）与人行道台基，再切地块放楼。
   * asphalt 给出沥青矩形相对街区中心的偏移与半尺寸；街道只出现在有街区的地方，
   * 所以外围没有楼的陆地自然读成田野，城市边缘不会出现一圈孤零零的柏油。
   */
  const addBlock = (
    cx: number,
    cz: number,
    ux: number,
    uz: number,
    hw: number,
    hd: number,
    asphalt: { ox: number; oz: number; hw: number; hd: number },
    lots: (emit: (ox: number, oz: number, w: number, d: number) => void) => void,
    heightFn: (x: number, z: number, frontage: boolean) => number,
    residential: boolean,
    polyId: number,
  ): void => {
    // 必须整块落在「这个区」所属的陆地上：下城与网格的格点会越过东河，没有这一条会把楼铺进布鲁克林
    const onLand = land.rectOnPolygon(cx, cz, ux, uz, hw, hd, polyId);
    const vx = -uz;
    const vz = ux;
    if (onLand) {
      blocks++;
      const ax = cx + ux * asphalt.ox + vx * asphalt.oz;
      const az = cz + uz * asphalt.ox + vz * asphalt.oz;
      ground.rectXZ(ax, az, ux, uz, asphalt.hw, asphalt.hd, LAND_Y + 0.25, jitter(C.asphalt, 0.03));
    }
    let emitted = 0;
    lots((ox, oz, w, d) => {
      const x = cx + ux * ox + vx * oz;
      const z = cz + uz * ox + vz * oz;
      const gw = Math.max(4, w - 1.6);
      const gd = Math.max(4, d - 1.6);
      // 用窄边的一半做排除半径：长条形的地块不会因为一端靠近桥引道或百老汇就整块被删
      if (excluded(x, z, Math.min(gw, gd) * 0.5)) return;
      if (!onLand) {
        // 岸边街区：只放整个落在陆地上的地块（同一块陆地，避免楼跨河）
        if (!land.rectOnPolygon(x, z, ux, uz, gw / 2, gd / 2, polyId)) return;
        ground.rectXZ(x, z, ux, uz, gw / 2 + 0.8, gd / 2 + 0.8, LAND_Y + 0.5, jitter(C.plinth, 0.04));
      }
      const frontage = Math.abs(ox) > hw - w * 0.55;
      addBuilding(x, z, ux, uz, gw, gd, heightFn(x, z, frontage), residential);
      emitted++;
    });
    // 有楼的街区画人行道台基；楼全被排除掉的（桥引道下、广场边）画成铺地广场，不留空台基
    if (onLand) ground.rectXZ(cx, cz, ux, uz, hw, hd, LAND_Y + 0.5, jitter(emitted > 0 ? C.plinth : C.plaza, 0.04));
  };

  mark('water');
  // ── 4. 曼哈顿网格区（14 街以北；东侧到休斯顿街）────────────────────
  const dens = quality.density;
  const manhattanHeight = (x: number, z: number, frontage: boolean): number => {
    toGrid(x, z, g);
    const bump = bumpFactor(x, z);
    let base = g.s > 110 ? 17 : g.s > 59 ? 27 : 24;
    const dv = Math.hypot(x - VILLAGE.x, z - VILLAGE.z);
    if (dv < 900) base *= 0.55 + 0.45 * (dv / 900);
    let h = base * (0.55 + rng() * 0.95) + bump * (0.45 + rng() * 0.8);
    if (frontage && g.s > 59) h *= 1.4;
    if (bump > 60 && rng() < 0.16) h *= 1.45;
    return Math.max(8, Math.min(262, h));
  };

  const streetHalf = (s: number): number => (WIDE_STREETS.has(s) ? 15 : 9);
  for (let i = 0; i < AVENUES.length - 1; i++) {
    const A = AVENUES[i];
    const B = AVENUES[i + 1];
    const a0 = A.a + A.width / 2;
    const a1 = B.a - B.width / 2;
    const blockW = a1 - a0;
    if (blockW < 25) continue;
    for (let s = -2; s < 130; s++) {
      const s0 = s + streetHalf(s) / STREET_PITCH;
      const s1 = s + 1 - streetHalf(s + 1) / STREET_PITCH;
      const sc = (s0 + s1) / 2;
      const ac = (a0 + a1) / 2;
      // 网格只覆盖 14 街以北；14 街以南只有东村（列克星敦大道以东）是网格，其余交给下城区
      if (s0 < 1.2 || (s0 < 14 && a1 > -120)) continue;
      fromGrid(sc, ac, tmp);
      toGrid(tmp.x, tmp.z, g);
      if (inGridRect(g, CENTRAL_PARK)) continue;
      const hw = blockW / 2;
      const hd = ((s1 - s0) * STREET_PITCH) / 2;
      const residential = g.s > 59 || (g.s < 30 && g.a > 300);
      const wholeBlock = bumpFactor(tmp.x, tmp.z) > 70 && rng() < 0.32;
      // 沥青铺到四条街的中心线：a 方向从 A 大道中心到 B 大道中心，s 方向从 s 街到 s+1 街。
      // 局部 x 轴朝东（与 a 增大的方向相反）、局部 z 轴朝下城（与 s 增大的方向相反），所以两个偏移都取负
      const asphalt = {
        ox: -((A.a + B.a) / 2 - ac),
        oz: -((s + 0.5 - sc) * STREET_PITCH),
        hw: (B.a - A.a) / 2,
        hd: STREET_PITCH / 2,
      };
      addBlock(
        tmp.x,
        tmp.z,
        gridUx,
        gridUz,
        hw,
        hd,
        asphalt,
        (emit) => {
          if (wholeBlock || blockW < 60 || (quality.tier === 'low' && blockW < 130)) {
            // 整街区的大楼，或东侧窄街区：沿大道方向切成 1–2 栋
            if (blockW > 90 && rng() < 0.6) {
              emit(-hw / 2, 0, hw, hd * 2);
              emit(hw / 2, 0, hw, hd * 2);
            } else emit(0, 0, hw * 2, hd * 2);
            return;
          }
          // 两端临大道的地块更深更高；中段切成宽窄不一的楼，部分再分成南北两排
          const endW = Math.min(hw * 0.45, 26 + rng() * 14);
          emit(-hw + endW / 2, 0, endW, hd * 2);
          emit(hw - endW / 2, 0, endW, hd * 2);
          let x = -hw + endW;
          const xEnd = hw - endW;
          if (quality.tier === 'low') {
            // 低档：中段一栋整深的楼，整个街区 3 个实例
            const mid = xEnd - x;
            if (mid > 8) emit(x + mid / 2, 0, mid, hd * 2);
            return;
          }
          while (xEnd - x > 8) {
            let w = 50 + rng() * 40;
            if (xEnd - x - w < 24) w = xEnd - x;
            const cxl = x + w / 2;
            if (rng() < 0.3) {
              emit(cxl, -hd / 2, w, hd);
              emit(cxl, hd / 2, w, hd);
            } else emit(cxl, 0, w, hd * 2);
            x += w;
          }
        },
        manhattanHeight,
        residential,
        manhattanId,
      );
    }
  }

  mark('grid');
  // ── 5. 下城区（休斯顿街 / 14 街以南）：小街区、轻微扭转，读成老城肌理 ──
  {
    const pitchS = 92;
    const pitchA = 120;
    for (let i = -60; i < 30; i++) {
      for (let j = -40; j < 24; j++) {
        const sc = (i * pitchS) / STREET_PITCH;
        const ac = j * pitchA;
        // 与网格区互补，并且整个街区都要落在接缝的这一侧，避免两套街网的楼叠在一起
        const halfS = pitchS / 2 / STREET_PITCH;
        if (!(sc + halfS < 1.05 || (sc + halfS < 13.9 && ac - pitchA / 2 > -120))) continue;
        fromGrid(sc, ac, tmp);
        if (land.polygonAt(tmp.x, tmp.z) !== manhattanId) {
          // 让岸边的半街区也有机会落楼
          if (!land.isLand(tmp.x + 30, tmp.z) && !land.isLand(tmp.x - 30, tmp.z)) continue;
        }
        const twist = ((rng() - 0.5) * 12 * Math.PI) / 180;
        const ux = Math.cos(GRID_YAW + twist);
        const uz = -Math.sin(GRID_YAW + twist);
        const hw = pitchA / 2 - 9;
        const hd = pitchS / 2 - 8;
        addBlock(
          tmp.x,
          tmp.z,
          ux,
          uz,
          hw,
          hd,
          { ox: 0, oz: 0, hw: pitchA / 2, hd: pitchS / 2 },
          (emit) => {
            const n = Math.max(1, Math.round((1 + rng() * 1.6) * dens));
            const w = (hw * 2) / n;
            for (let k = 0; k < n; k++) {
              if (rng() < 0.3 * dens) {
                emit(-hw + w * (k + 0.5), -hd / 2, w, hd);
                emit(-hw + w * (k + 0.5), hd / 2, w, hd);
              } else emit(-hw + w * (k + 0.5), 0, w, hd * 2);
            }
          },
          (x, z) => {
            const bump = bumpFactor(x, z);
            const dv = Math.hypot(x - VILLAGE.x, z - VILLAGE.z);
            let base = 22 * (0.6 + rng() * 0.8);
            if (dv < 900) base *= 0.6 + 0.4 * (dv / 900);
            let h = base + bump * (0.45 + rng() * 0.85);
            if (bump > 80 && rng() < 0.2) h *= 1.4;
            return Math.max(8, Math.min(262, h));
          },
          true,
          manhattanId,
        );
      }
    }
  }

  mark('downtown');
  // ── 6. 外围：布鲁克林、皇后区、新泽西、布朗克斯、罗斯福岛 ─────────────
  interface OuterZone {
    origin: XZ;
    angleDeg: number;
    pitchU: number;
    pitchV: number;
    range: number;
    accept: (x: number, z: number, pid: number) => boolean;
  }
  const njId = land.polygonAt(project(40.744, -74.03).x, project(40.744, -74.03).z);
  const bkId = land.polygonAt(project(40.696, -73.994).x, project(40.696, -73.994).z);
  const bxId = land.polygonAt(project(40.82, -73.92).x, project(40.82, -73.92).z);
  const rvId = land.polygonAt(project(40.762, -73.95).x, project(40.762, -73.95).z);
  const zLatSplit = project(40.736, -73.95).z;
  const zones: OuterZone[] = [
    { origin: project(40.695, -73.99), angleDeg: 19, pitchU: 120, pitchV: 230, range: 6500, accept: (x, z, pid) => pid === bkId && pid >= 0 && z > zLatSplit },
    { origin: project(40.745, -73.945), angleDeg: 46, pitchU: 125, pitchV: 240, range: 6500, accept: (x, z, pid) => pid === bkId && pid >= 0 && z <= zLatSplit },
    { origin: project(40.74, -74.035), angleDeg: 11, pitchU: 115, pitchV: 220, range: 6500, accept: (_x, _z, pid) => pid === njId && pid >= 0 },
    { origin: project(40.81, -73.925), angleDeg: 29, pitchU: 120, pitchV: 240, range: 5000, accept: (_x, _z, pid) => pid === bxId && pid >= 0 },
    { origin: project(40.762, -73.95), angleDeg: 29, pitchU: 95, pitchV: 70, range: 2200, accept: (_x, _z, pid) => pid === rvId && pid >= 0 },
  ];
  for (const zone of zones) {
    const ang = (zone.angleDeg * Math.PI) / 180;
    // 区域网格的「上」方向与横向；楼体绕 y 轴旋转后局部 x 轴对齐横向
    const upx = Math.sin(ang);
    const upz = -Math.cos(ang);
    const ux = Math.cos(ang);
    const uz = Math.sin(ang);
    const nU = Math.ceil(zone.range / zone.pitchU);
    const nV = Math.ceil(zone.range / zone.pitchV);
    for (let i = -nU; i <= nU; i++) {
      for (let j = -nV; j <= nV; j++) {
        const x = zone.origin.x + upx * i * zone.pitchU + ux * j * zone.pitchV;
        const z = zone.origin.z + upz * i * zone.pitchU + uz * j * zone.pitchV;
        const sd = spineDistance(x, z);
        if (sd > quality.outerReach) continue;
        const fullUntil = quality.outerReach * 0.8;
        const density = sd < fullUntil ? 1 : 1 - (sd - fullUntil) / (quality.outerReach - fullUntil);
        if (rng() > density) continue;
        const pid = land.polygonAt(x, z);
        if (!zone.accept(x, z, pid)) continue;
        const hw = zone.pitchV / 2 - 9;
        const hd = zone.pitchU / 2 - 8;
        addBlock(
          x,
          z,
          ux,
          uz,
          hw,
          hd,
          { ox: 0, oz: 0, hw: zone.pitchV / 2, hd: zone.pitchU / 2 },
          (emit) => {
            // 外围以低层为主，远看是肌理：每个街区一栋连排体块就够了
            emit(0, 0, hw * 2, hd * 2);
          },
          (bx, bz) => {
            const bump = bumpFactor(bx, bz);
            let h = 10 * (0.7 + rng() * 0.9) + bump * (0.4 + rng() * 0.9);
            if (bump > 50 && rng() < 0.2) h *= 1.5;
            return Math.max(6, Math.min(200, h));
          },
          true,
          pid,
        );
      }
    }
  }

  mark('outer');
  // ── 7. 地标追加的楼体（帝国大厦、时代广场等）──────────────────────────
  for (const b of ctx.extraBuildings) buildings.push(b);
  for (const p of pencils) {
    // 亿万富翁街的铅笔楼：极细极高，撑起中央公园南缘的天际线
    buildings.push({ x: p.xz.x, y: 0, z: p.xz.z, w: p.w, h: p.height * 0.6, d: p.d, yaw: GRID_YAW, style: STYLE.CURTAIN, color: hex('#9aa0a0') });
    buildings.push({ x: p.xz.x, y: p.height * 0.6, z: p.xz.z, w: p.w * 0.86, h: p.height * 0.4, d: p.d * 0.86, yaw: GRID_YAW, style: STYLE.CURTAIN, color: hex('#a3a7a4') });
  }

  mark('extras');
  // ── 8. 公园：中央公园、网格公园、多边形公园 ───────────────────────────
  const gridRectPoly = (r: GridRect): XZ[] => [
    fromGrid(r.s0, r.a0),
    fromGrid(r.s0, r.a1),
    fromGrid(r.s1, r.a1),
    fromGrid(r.s1, r.a0),
  ];
  // 湖面与草坪不是正椭圆：半径带两道低频起伏，岸线读起来像自然水体而不是 CAD 图形
  const wobble = (t: number, seed: number) => 1 + 0.11 * Math.sin(3 * t + seed * 1.7) + 0.06 * Math.sin(5 * t + seed * 2.9);
  const ellipsePoly = (s: number, a: number, rs: number, ra: number, e: number, n = 40, seed = 0): XZ[] => {
    const pts: XZ[] = [];
    for (let k = 0; k < n; k++) {
      const t = (k / n) * Math.PI * 2;
      const c = Math.cos(t);
      const sn = Math.sin(t);
      const w = wobble(t, seed);
      const cs = Math.sign(c) * Math.pow(Math.abs(c), 2 / e) * w;
      const ss = Math.sign(sn) * Math.pow(Math.abs(sn), 2 / e) * w;
      pts.push(fromGrid(s + cs * rs, a + ss * ra));
    }
    return pts;
  };
  const inEllipse = (gc: GridCoord, w: { s: number; a: number; rs: number; ra: number; e: number }, pad = 0, seed = 0): boolean => {
    const ns = (gc.s - w.s) / w.rs;
    const na = (gc.a - w.a) / w.ra;
    const t = Math.atan2(na, ns);
    const k = wobble(t, seed) + pad / Math.min(w.ra, w.rs * STREET_PITCH);
    return Math.pow(Math.abs(ns) / k, w.e) + Math.pow(Math.abs(na) / k, w.e) <= 1;
  };

  ground.polygonXZ(gridRectPoly(CENTRAL_PARK), [], LAND_Y + 0.55, C.park);
  CP_LAWNS.forEach((l, i) => ground.polygonXZ(ellipsePoly(l.s, l.a, l.rs, l.ra, l.e, 40, 10 + i), [], LAND_Y + 0.62, C.lawn));
  CP_WATERS.forEach((w, i) => {
    // 公园湖泊进水面网格；岸边一圈浅色草坡
    ground.polygonXZ(ellipsePoly(w.s, w.a, w.rs + 0.12, w.ra + 10, w.e, 40, i), [], LAND_Y + 0.62, C.lawn);
    waterB.polygonXZ(ellipsePoly(w.s, w.a, w.rs, w.ra, w.e, 40, i), [], LAND_Y + 0.75, [1, 1, 1]);
  });
  for (const p of GRID_PARKS) {
    ground.polygonXZ(gridRectPoly(p), [], LAND_Y + 0.6, p.name === 'Union Square' || p.name === 'Bryant Park' ? C.lawn : C.park);
  }
  for (const p of polyParks) ground.polygonXZ(p.pts, [], LAND_Y + 0.6, C.park);

  // 9/11 纪念池：两个下沉方形水池，周围是铺地与树阵
  {
    const plaza: XZ[] = [];
    for (let k = 0; k < 4; k++) {
      const t = GRID_YAW + (k * Math.PI) / 2 + Math.PI / 4;
      plaza.push({ x: poolCenter.x + Math.cos(t) * 150, z: poolCenter.z - Math.sin(t) * 150 });
    }
    ground.polygonXZ(plaza, [], LAND_Y + 0.6, C.plaza);
    for (const p of pools) {
      ground.rectXZ(p.x, p.z, gridUx, gridUz, 34, 34, LAND_Y + 0.65, hex('#3d3a36'));
      waterB.rectXZ(p.x, p.z, gridUx, gridUz, 28, 28, LAND_Y + 0.7, [1, 1, 1]);
    }
  }

  // 百老汇：斜穿网格的深色街道，俯瞰时最容易认出的「破格」
  for (let i = 0; i + 1 < broadwayPts.length; i++) {
    const a = broadwayPts[i];
    const b = broadwayPts[i + 1];
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    const ux = (b.x - a.x) / len;
    const uz = (b.z - a.z) / len;
    const mx = (a.x + b.x) / 2;
    const mz = (a.z + b.z) / 2;
    toGrid(mx, mz, g);
    if (inGridRect(g, CENTRAL_PARK)) continue;
    ground.rectXZ(mx, mz, ux, uz, len / 2 + 6, 11, LAND_Y + 0.58, C.broadway);
  }

  // 时代广场：领结形步行广场 + TKTS 红色台阶
  {
    const strip: XZ[] = [];
    const strip2: XZ[] = [];
    for (let s = TIMES_SQUARE.s0; s <= TIMES_SQUARE.s1 + 1e-6; s += 0.25) {
      strip.push(fromGrid(s, Math.min(broadwayA(s), 560) - 14));
      strip2.push(fromGrid(s, Math.max(broadwayA(s), 560) + 14));
    }
    ground.polygonXZ(strip.concat(strip2.reverse()), [], LAND_Y + 0.6, C.tsPlaza);
    const tk = fromGrid(46.9, 572);
    ground.rectXZ(tk.x, tk.z, gridUx, gridUz, 9, 7, LAND_Y + 1.6, C.tkts);
  }

  mark('parks');
  // ── 9. 树 ─────────────────────────────────────────────────────────
  const treeK = quality.trees;
  const addTree = (x: number, z: number, scale: number): void => {
    const autumn = rng() < 0.09;
    trees.push({ x, z, y: LAND_Y + 0.5, s: scale, c: jitter(autumn ? pick(PAL_AUTUMN) : pick(PAL_FOLIAGE), 0.08) });
  };
  {
    // 中央公园：抖动网格，避开湖面与大草坪
    const step = 33 / Math.sqrt(treeK);
    const sStep = step / STREET_PITCH;
    for (let s = CENTRAL_PARK.s0 + sStep / 2; s < CENTRAL_PARK.s1; s += sStep) {
      for (let a = CENTRAL_PARK.a0 + step / 2; a < CENTRAL_PARK.a1; a += step) {
        const js = s + (rng() - 0.5) * sStep * 0.8;
        const ja = a + (rng() - 0.5) * step * 0.8;
        const gc = { s: js, a: ja };
        if (CP_WATERS.some((w, i) => inEllipse(gc, w, 16, i)) || CP_LAWNS.some((l, i) => inEllipse(gc, l, 6, 10 + i))) continue;
        if (rng() < 0.12) continue;
        fromGrid(js, ja, tmp);
        addTree(tmp.x, tmp.z, 30 + rng() * 12);
      }
    }
    // 其他公园
    const scatter = (inside: (x: number, z: number) => boolean, minX: number, minZ: number, maxX: number, maxZ: number, k: number): void => {
      const st = 44 / Math.sqrt(treeK * k);
      for (let x = minX; x < maxX; x += st) {
        for (let z = minZ; z < maxZ; z += st) {
          const jx = x + (rng() - 0.5) * st * 0.8;
          const jz = z + (rng() - 0.5) * st * 0.8;
          if (inside(jx, jz) && land.isLand(jx, jz)) addTree(jx, jz, 24 + rng() * 9);
        }
      }
    };
    for (const p of GRID_PARKS) {
      const poly = gridRectPoly(p);
      const xs = poly.map((q) => q.x);
      const zs = poly.map((q) => q.z);
      scatter((x, z) => pointInRing(poly, x, z), Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs), p.trees);
    }
    for (const p of polyParks) {
      const xs = p.pts.map((q) => q.x);
      const zs = p.pts.map((q) => q.z);
      scatter((x, z) => pointInRing(p.pts, x, z), Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs), p.trees);
    }
    // 河滨公园：哈德逊河岸 72 街到 125 街的一条树带
    for (let s = 72; s < 125; s += 0.6 / Math.sqrt(treeK)) {
      let shoreA = -1;
      for (let a = 1700; a < 2600; a += 12) {
        fromGrid(s, a, tmp);
        if (!land.isLand(tmp.x, tmp.z)) {
          shoreA = a;
          break;
        }
      }
      if (shoreA < 0) continue;
      for (let a = 1835; a < shoreA - 14; a += 34) {
        fromGrid(s + (rng() - 0.5) * 0.3, a + (rng() - 0.5) * 10, tmp);
        if (land.isLand(tmp.x, tmp.z)) addTree(tmp.x, tmp.z, 24 + rng() * 8);
      }
    }
    // 总督岛、兰德尔岛：整座岛是公园
    for (const [la, lo] of [
      [40.6895, -74.0165],
      [40.7925, -73.9215],
    ] as const) {
      const c = project(la, lo);
      const pid = land.polygonAt(c.x, c.z);
      if (pid < 0) continue;
      const P = land.polygons[pid];
      // 栅格合并时兰德尔岛可能和布朗克斯连成一块：只对真正的小岛撒树，否则会把整个布朗克斯种满
      if (P.area > 5e6) continue;
      scatter((x, z) => land.polygonAt(x, z) === pid, P.minX, P.minZ, P.maxX, P.maxZ, 0.45);
    }
    // 外围的异界林地：城市密度衰减之外，田野上零星的树丛
    const groves = Math.round(30 * treeK);
    for (let k = 0; k < groves * 6; k++) {
      const x = (rng() - 0.5) * 16000;
      const z = (rng() - 0.5) * 18000;
      const sd = spineDistance(x, z);
      if (sd < quality.outerReach * 0.8 || sd > 9000 || !land.isLand(x, z)) continue;
      const n = 4 + Math.floor(rng() * 8);
      for (let q = 0; q < n; q++) {
        const tx = x + (rng() - 0.5) * 90;
        const tz = z + (rng() - 0.5) * 90;
        if (land.isLand(tx, tz)) addTree(tx, tz, 26 + rng() * 10);
      }
    }
  }

  mark('trees');
  // ── 10. 组装网格 ───────────────────────────────────────────────────
  const group = new THREE.Group();
  group.name = 'city';

  const groundMesh = new THREE.Mesh(ground.build(), materials.ground);
  groundMesh.name = 'ground';
  groundMesh.receiveShadow = true;
  group.add(groundMesh);

  const waterMesh = new THREE.Mesh(waterB.build(), materials.water);
  waterMesh.name = 'water';
  waterMesh.receiveShadow = true;
  // 外海平面足够大，任何视角都在视锥内，跳过包围球测试省一点 CPU
  waterMesh.frustumCulled = false;
  group.add(waterMesh);

  if (shoreIdx.length) {
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.Float32BufferAttribute(shorePos, 3));
    sg.setAttribute('aOut', new THREE.Float32BufferAttribute(shoreOut, 2));
    sg.setAttribute('aSide', new THREE.Float32BufferAttribute(shoreSide, 1));
    sg.setIndex(shoreIdx);
    const shoreMesh = new THREE.Mesh(sg, materials.shore);
    shoreMesh.name = 'shoreline';
    // 外缘在顶点着色器里按相机距离外扩，包围球算不准；岸线遍布全图，几乎总在视锥内
    shoreMesh.frustumCulled = false;
    shoreMesh.renderOrder = 1;
    group.add(shoreMesh);
  }

  // 楼体：单位盒（底面在 y=0，没有底面），一个 InstancedMesh
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  boxGeo.translate(0, 0.5, 0);
  const boxNoBottom = removeBottomFace(boxGeo);
  boxGeo.dispose();
  const count = buildings.length;
  const styleAttr = new Float32Array(count);
  boxNoBottom.setAttribute('aStyle', new THREE.InstancedBufferAttribute(styleAttr, 1));
  const bMesh = new THREE.InstancedMesh(boxNoBottom, materials.building, count);
  bMesh.name = 'buildings';
  const m = bMesh.instanceMatrix.array as Float32Array;
  const colors = new Float32Array(count * 3);
  /*
   * 包围盒在填矩阵的同一趟循环里顺手算：每栋楼是绕 y 旋转的盒子，xz 外接范围与高度范围都能直接写出来。
   * 原先的 bMesh.computeBoundingSphere() 要对上万个实例逐个取回矩阵、变换几何包围球再合并，
   * 冷启动时是构建耗时里实打实的十几毫秒（QA-R1-05）。两种做法得到的都是包住全部楼体的球（这个由包围盒外接，略松一些）；
   * 全城的楼共用这一个 InstancedMesh，视锥与阴影剔除对它几乎总是命中，球大一点不影响任何画面。
   */
  let bx0 = Infinity, by0 = Infinity, bz0 = Infinity, bx1 = -Infinity, by1 = -Infinity, bz1 = -Infinity;
  for (let i = 0; i < count; i++) {
    const b = buildings[i];
    const c = Math.cos(b.yaw);
    const s = Math.sin(b.yaw);
    const ex = (Math.abs(c) * b.w + Math.abs(s) * b.d) / 2;
    const ez = (Math.abs(s) * b.w + Math.abs(c) * b.d) / 2;
    const y0 = b.y + LAND_Y + 0.5;
    if (b.x - ex < bx0) bx0 = b.x - ex;
    if (b.x + ex > bx1) bx1 = b.x + ex;
    if (b.z - ez < bz0) bz0 = b.z - ez;
    if (b.z + ez > bz1) bz1 = b.z + ez;
    if (y0 < by0) by0 = y0;
    if (y0 + b.h > by1) by1 = y0 + b.h;
    const o = i * 16;
    m[o] = c * b.w;
    m[o + 1] = 0;
    m[o + 2] = -s * b.w;
    m[o + 3] = 0;
    m[o + 4] = 0;
    m[o + 5] = b.h;
    m[o + 6] = 0;
    m[o + 7] = 0;
    m[o + 8] = s * b.d;
    m[o + 9] = 0;
    m[o + 10] = c * b.d;
    m[o + 11] = 0;
    m[o + 12] = b.x;
    m[o + 13] = b.y + LAND_Y + 0.5;
    m[o + 14] = b.z;
    m[o + 15] = 1;
    colors[i * 3] = b.color[0];
    colors[i * 3 + 1] = b.color[1];
    colors[i * 3 + 2] = b.color[2];
    styleAttr[i] = b.style;
  }
  bMesh.instanceColor = new THREE.InstancedBufferAttribute(colors, 3);
  bMesh.instanceMatrix.needsUpdate = true;
  if (count > 0) {
    bMesh.boundingBox = new THREE.Box3(new THREE.Vector3(bx0, by0, bz0), new THREE.Vector3(bx1, by1, bz1));
    bMesh.boundingSphere = bMesh.boundingBox.getBoundingSphere(new THREE.Sphere());
  } else {
    bMesh.computeBoundingSphere();
  }
  bMesh.castShadow = true;
  bMesh.receiveShadow = true;
  group.add(bMesh);

  // 水塔
  const towerKeep = keepRatio(towers.length, CAPS.towers);
  const towerList = towers.filter(() => towerKeep >= 1 || rng() < towerKeep);
  let towerMesh: THREE.InstancedMesh | null = null;
  if (towerList.length) {
    const geo = createWaterTowerGeometry();
    towerMesh = new THREE.InstancedMesh(geo, materials.roofProp, towerList.length);
    towerMesh.name = 'waterTowers';
    const mm = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const v = new THREE.Vector3();
    const sc = new THREE.Vector3();
    towerList.forEach((t, i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), t.yaw);
      mm.compose(v.set(t.x, t.y + LAND_Y + 0.5, t.z), q, sc.set(t.s, t.s, t.s));
      towerMesh!.setMatrixAt(i, mm);
    });
    towerMesh.computeBoundingSphere();
    // 水塔只有几米高，阴影在城市尺度上看不出来，不进阴影 pass
    towerMesh.castShadow = false;
    towerMesh.receiveShadow = true;
    group.add(towerMesh);
  }

  // 灯笼 + 光晕
  const lanternKeep = keepRatio(lanterns.length, CAPS.lanterns);
  const lanternList = lanterns.filter(() => lanternKeep >= 1 || rng() < lanternKeep);
  let lanternMesh: THREE.InstancedMesh | null = null;
  let haloMesh: THREE.InstancedMesh | null = null;
  if (lanternList.length) {
    // 八面体：8 个三角形，远看是一粒暖光，近看是一盏纸灯笼
    const lgeo = new THREE.OctahedronGeometry(0.6, 0);
    lgeo.scale(1, 1.25, 1);
    lanternMesh = new THREE.InstancedMesh(lgeo, materials.lantern, lanternList.length);
    lanternMesh.name = 'lanterns';
    const hgeo = new THREE.PlaneGeometry(1, 1);
    haloMesh = new THREE.InstancedMesh(hgeo, materials.halo, lanternList.length);
    haloMesh.name = 'lanternHalos';
    const mm = new THREE.Matrix4();
    lanternList.forEach((l, i) => {
      mm.makeScale(2.2, 3, 2.2).setPosition(l.x, l.y + LAND_Y + 0.5, l.z);
      lanternMesh!.setMatrixAt(i, mm);
      mm.makeScale(14, 14, 14).setPosition(l.x, l.y + LAND_Y + 0.5, l.z);
      haloMesh!.setMatrixAt(i, mm);
    });
    lanternMesh.computeBoundingSphere();
    haloMesh.computeBoundingSphere();
    haloMesh.renderOrder = 5;
    group.add(lanternMesh, haloMesh);
  }

  // 树：超出预算时均匀抽稀；离曼哈顿近的树投影，外围林地不投影（远看只是色块，阴影 pass 白花三角形）
  const treeKeep = keepRatio(trees.length, CAPS.trees);
  const nearTrees: typeof trees = [];
  const farTrees: typeof trees = [];
  for (const t of trees) {
    if (treeKeep < 1 && rng() > treeKeep) continue;
    (spineDistance(t.x, t.z) < 2600 ? nearTrees : farTrees).push(t);
  }
  const treeGeo = trees.length ? createTreeGeometry() : null;
  const makeTrees = (list: typeof trees, name: string, shadows: boolean): void => {
    if (!list.length || !treeGeo) return;
    const mesh = new THREE.InstancedMesh(treeGeo, materials.foliage, list.length);
    mesh.name = name;
    const mm = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const v = new THREE.Vector3();
    const sc = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    const tc = new Float32Array(list.length * 3);
    list.forEach((t, i) => {
      q.setFromAxisAngle(up, rng() * Math.PI * 2);
      const sx = t.s * (0.9 + rng() * 0.2);
      mm.compose(v.set(t.x, t.y, t.z), q, sc.set(sx, t.s, sx));
      mesh.setMatrixAt(i, mm);
      tc[i * 3] = t.c[0];
      tc[i * 3 + 1] = t.c[1];
      tc[i * 3 + 2] = t.c[2];
    });
    mesh.instanceColor = new THREE.InstancedBufferAttribute(tc, 3);
    mesh.computeBoundingSphere();
    mesh.castShadow = shadows;
    mesh.receiveShadow = true;
    group.add(mesh);
  };
  makeTrees(nearTrees, 'trees', quality.treeShadows);
  makeTrees(farTrees, 'treesFar', false);

  mark('assemble');
  return {
    group,
    buildings: bMesh,
    phases,
    stats: { buildings: count, trees: nearTrees.length + farTrees.length, waterTowers: towerList.length, lanterns: lanternList.length, blocks },
    dispose() {
      group.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const im = o as THREE.InstancedMesh;
        if (im.isInstancedMesh) im.dispose();
      });
    },
  };
}

/** 去掉盒体的底面（从下往上永远看不见），每栋楼省 2 个三角形 */
function removeBottomFace(geo: THREE.BoxGeometry): THREE.BufferGeometry {
  const src = geo.toNonIndexed();
  const pos = src.getAttribute('position');
  const nor = src.getAttribute('normal');
  const keepP: number[] = [];
  const keepN: number[] = [];
  for (let i = 0; i < pos.count; i += 3) {
    if (nor.getY(i) < -0.5) continue;
    for (let k = 0; k < 3; k++) {
      keepP.push(pos.getX(i + k), pos.getY(i + k), pos.getZ(i + k));
      keepN.push(nor.getX(i + k), nor.getY(i + k), nor.getZ(i + k));
    }
  }
  src.dispose();
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(keepP, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(keepN, 3));
  return g;
}

function colorize(geo: THREE.BufferGeometry, c: readonly number[], shade?: (y: number) => number): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo;
  if (g !== geo) geo.dispose();
  g.deleteAttribute('uv');
  const pos = g.getAttribute('position');
  const col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const k = shade ? shade(pos.getY(i)) : 1;
    col[i * 3] = c[0] * k;
    col[i * 3 + 1] = c[1] * k;
    col[i * 3 + 2] = c[2] * k;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

/** 纽约屋顶的木制水塔：桶身 + 锥顶 + 四条腿。单位尺寸，实例缩放 */
function createWaterTowerGeometry(): THREE.BufferGeometry {
  // 桶身与锥顶都不封口（看不见），支架合成一个收窄的方墩：一共 30 个三角形
  const tank = new THREE.CylinderGeometry(0.5, 0.5, 0.75, 6, 1, true);
  tank.translate(0, 0.5 + 0.375, 0);
  const roof = new THREE.ConeGeometry(0.56, 0.36, 6, 1, true);
  roof.translate(0, 1.25 + 0.18, 0);
  const stand = new THREE.BoxGeometry(0.62, 0.5, 0.62);
  stand.translate(0, 0.25, 0);
  const parts = [
    colorize(tank, hex('#7d5b3d'), (y) => 0.85 + 0.25 * (y - 0.5)),
    colorize(roof, hex('#4a3b30')),
    colorize(stand, hex('#3b342e')),
  ];
  const merged = mergeNonIndexed(parts);
  for (const p of parts) p.dispose();
  return merged;
}

/** 旷野之息式的圆润树冠：两团平滑的二十面体 + 树干。单位高度 1，实例缩放 */
function createTreeGeometry(): THREE.BufferGeometry {
  const trunk = new THREE.CylinderGeometry(0.035, 0.05, 0.42, 5, 1, true);
  trunk.translate(0, 0.21, 0);
  // 一团平滑的树冠（20 个三角形）+ 不封口的树干（10 个）：树多的时候树冠彼此连成林冠，单团就够
  const blobA = smoothBlob(0.4, 0.84, 0, 0.62, 0);
  const parts = [
    colorize(trunk, hex('#5c4632')),
    // 冠底偏暗、冠顶偏亮：不靠贴图也有体积
    colorize(blobA, [1, 1, 1], (y) => 0.6 + 0.6 * Math.max(0, y - 0.3)),
  ];
  const merged = mergeNonIndexed(parts);
  for (const p of parts) p.dispose();
  return merged;
}
