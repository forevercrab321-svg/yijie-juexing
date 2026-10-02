/**
 * 程序化纽约（可爱风，指南 5.1–5.4）：地面、水面、街区、圆润粉彩楼群、公园、棒棒糖树、贴地软影。
 *
 * 全部在本地生成，不发网络请求。同一个种子每次生成同一座城，截图与回归可比。
 *
 * 造型语言：楼是「玩具城」——高度压缩到 8–72 m（中城自然更高，但不再是峡谷）、竖向棱倒角、顶上一圈白色压顶 +
 * 粉彩枕形屋顶帽；每个街区高档 ≤ 3 栋、低档 ≤ 2 栋，楼间留 ≥ 4 m 缝、离街道退 3 m，露出奶白的人行道。
 * 总楼数是上一版的约四成：画面干净、一眼看懂，也给棒棒糖树和徽章让出三角形预算。
 *
 * draw call（指南 5.10 账本）：
 *   地面 1（陆地 / 城区 / 公园 / 道路 / 堤岸全部合并，顶点只存分类号）
 *   水面 1、岸线 1（半透明，不进阴影 pass）
 *   楼体 1–2（InstancedMesh；高档按高度拆成「投影」与「不投影」两份——矮楼在 35° 以上的太阳下影子只有几米，
 *            省下的阴影 pass 三角形比多出的一个 draw call 值钱得多；低档没有实时阴影，合成一份）
 *   树 1、树的软影 1
 */
import * as THREE from 'three';
import { mergeNonIndexed } from './geometry';
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
import { GROUND } from './palette';
import type { MaterialKit } from './materials';
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

/** 地面顶点属性：(分类号, 明暗系数, 0) */
export const G = (cls: number, shade = 1): readonly number[] => [cls, shade, 0];

/** 地面各层的高度（米）。层间至少 0.1 m：总览时近平面在几百米外，更小的间隔会在深度缓冲里打架 */
export const LAYER = {
  street: 0.3,
  curb: 0.5,
  city: 0.7,
  ao: 0.8,
  avenueEdge: 0.9,
  avenue: 1.0,
  park: 1.0,
  lawn: 1.15,
  path: 1.3,
} as const;

/**
 * 真实楼高 → 玩具城楼高（指南 5.4）：h ≤ 40 m 时 8 + 0.45h，> 40 m 时 26 + 14·ln(h/40)，上限 72 m。
 * 对数段让中城仍然最高、但只高出一截，不再把街道夹成峡谷，GO 式低视角下也看得到地平线。
 */
export function toyHeight(h: number): number {
  return h <= 40 ? 8 + 0.45 * h : Math.min(72, 26 + 14 * Math.log(h / 40));
}

/**
 * 地面网格构建器：所有地面元素合并成一个网格、一个 draw call。
 * 数据直接写进按需翻倍的 TypedArray（QA-R1-05：冷启动时不制造大量垃圾）。位置存 Float64，tri() 判断朝向时与原先一致。
 * 第三个属性默认叫 aG（地面分类号 + 明暗），也可以不要（水面）。
 */
export class MeshBuilder {
  private pos = new Float64Array(3 * 4096);
  private nor = new Float32Array(3 * 4096);
  private col: Float32Array | null;
  private idx = new Uint32Array(3 * 4096);
  private nv = 0;
  private ni = 0;

  constructor(withAttr = true, private readonly attrName = 'aG') {
    this.col = withAttr ? new Float32Array(3 * 4096) : null;
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
      col[o] = c ? c[0] : 0;
      col[o + 1] = c ? c[1] : 1;
      col[o + 2] = c ? c[2] : 0;
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

  /**
   * 矩形「光环」：内框 (hw, hd) 的顶点取 inner，外扩 pad 的外框取 outer，四条梯形带（8 个三角形）。
   * 用来把楼脚的环境光遮蔽烘进地面：内圈深一点、向外渐隐到地面本色，没有硬边。
   */
  ringXZ(cx: number, cz: number, ux: number, uz: number, hw: number, hd: number, pad: number, y: number, inner: readonly number[], outer: readonly number[]): void {
    const vx = -uz;
    const vz = ux;
    const ids: number[] = [];
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      ids.push(this.vertex(cx + ux * hw * sx + vx * hd * sz, y, cz + uz * hw * sx + vz * hd * sz, 0, 1, 0, inner));
      ids.push(this.vertex(cx + ux * (hw + pad) * sx + vx * (hd + pad) * sz, y, cz + uz * (hw + pad) * sx + vz * (hd + pad) * sz, 0, 1, 0, outer));
    }
    for (let k = 0; k < 4; k++) {
      const a = ids[k * 2];
      const ao = ids[k * 2 + 1];
      const b = ids[((k + 1) % 4) * 2];
      const bo = ids[((k + 1) % 4) * 2 + 1];
      this.tri(a, b, bo, 0, 1, 0);
      this.tri(a, bo, ao, 0, 1, 0);
    }
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

  /** 沿折线的等宽带（公园小径、百老汇）：每段一个矩形，段与段在拐点处自然重叠 */
  stripXZ(pts: XZ[], halfW: number, y: number, c: readonly number[], extend = 0): void {
    for (let i = 0; i + 1 < pts.length; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      if (len < 0.5) continue;
      const ux = (b.x - a.x) / len;
      const uz = (b.z - a.z) / len;
      this.rectXZ((a.x + b.x) / 2, (a.z + b.z) / 2, ux, uz, len / 2 + extend, halfW, y, c);
    }
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
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos.subarray(0, n), 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor.subarray(0, n), 3));
    if (this.col) g.setAttribute(this.attrName, new THREE.Float32BufferAttribute(this.col.subarray(0, n), 3));
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

// ── 高度场：中城与下城金融区两个高峰，中间格林威治村低谷（真实米数，之后再压缩成玩具楼高）──────
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

/** 时代广场排除区：交给 landmarks 生成广场与色块楼 */
export function inTimesSquareZone(g: GridCoord): boolean {
  return g.s >= TIMES_SQUARE.s0 - 0.1 && g.s <= 47.95 && g.a >= 420 && g.a <= 760;
}

// ── 城市输出 ─────────────────────────────────────────────────────────

export interface BuildingInstance {
  x: number;
  /** 底面离地高度（叠在别的楼顶上的退台用） */
  y: number;
  z: number;
  w: number;
  h: number;
  d: number;
  yaw: number;
  /** 五色之一（0–4），对应 palette.ts 的 WALLS_* / ROOFS_* */
  pal: number;
}

export interface CityResult {
  group: THREE.Group;
  stats: { buildings: number; buildingsCastingShadow: number; trees: number; blocks: number };
  /** 各生成阶段耗时（毫秒），调试读数用 */
  phases: Record<string, number>;
  dispose(): void;
}

interface CityContext {
  land: LandIndex;
  quality: Quality;
  materials: MaterialKit;
  /** 地标模块追加的楼体实例（帝国大厦、时代广场楼群等），与城市楼群合并进同一套 InstancedMesh */
  extraBuildings: BuildingInstance[];
  seed?: number;
}

/** 高档里楼高 ≥ 这个值才投实时阴影（玩具楼高，米） */
const SHADOW_MIN_H = 26;

export function buildCity(ctx: CityContext): CityResult {
  const { land, quality, materials } = ctx;
  const rng = mulberry32(ctx.seed ?? 20261002);
  const ground = new MeshBuilder(true);
  const waterB = new MeshBuilder(false);
  const buildings: BuildingInstance[] = [];
  const trees: { x: number; z: number; s: number; pal: number; y: number; pri: number }[] = [];
  const CAPS = quality.tier === 'high' ? { trees: 1350 } : { trees: 600 };
  const shadows = quality.shadowMapSize > 0;
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
    if (nearBroadway(x, z, 16 + radius)) return true;
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
  // ── 1. 陆地顶面 + 沙色堤岸 ───────────────────────────────────────
  const landC = G(GROUND.LAND);
  const beachC = G(GROUND.BEACH);
  for (const poly of land.polygons) {
    const rings = poly.rings.map((r) => {
      const pts: XZ[] = [];
      for (let i = 0; i < r.length; i += 2) pts.push({ x: r[i], z: r[i + 1] });
      return pts;
    });
    ground.polygonXZ(rings[0], rings.slice(1), LAND_Y, landC);
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
        const mx = (a.x + b.x) / 2 + nx * 2;
        const mz = (a.z + b.z) / 2 + nz * 2;
        if (land.isLand(mx, mz)) {
          nx = -nx;
          nz = -nz;
        }
        segN.push(nx, nz);
        // 堤岸是沙色：GO 式低视角下水陆交界先读到一道暖黄的岸，再读到白浪
        ground.wall(a.x, a.z, b.x, b.z, WATER_Y - 4, LAND_Y, nx, nz, beachC);
      }
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
  // ── 2. 水面：外海一整块 ──────────────────────────────────────────
  waterB.rectXZ(0, 0, 1, 0, 60000, 60000, WATER_Y, [1, 1, 1]);

  // ── 3. 楼体生成工具 ───────────────────────────────────────────────
  const gridUx = Math.cos(GRID_YAW);
  const gridUz = -Math.sin(GRID_YAW);
  /** 每栋楼随机取五色之一，同一序列里相邻同色不超过 2 栋（指南 5.4） */
  let lastPal = -1;
  let runPal = 0;
  const pickPal = (): number => {
    let p = Math.floor(rng() * 5) % 5;
    if (p === lastPal && runPal >= 2) p = (p + 1 + Math.floor(rng() * 4)) % 5;
    runPal = p === lastPal ? runPal + 1 : 1;
    lastPal = p;
    return p;
  };
  const cityC = G(GROUND.CITY);
  const aoIn = G(GROUND.CITY, 0.84);
  const aoOut = G(GROUND.CITY, 1);

  /** 放一栋楼：真实高度先压缩成玩具楼高；高楼偶尔做一段退台（窄塔叠在宽裙楼上），天际线仍有层次 */
  const addBuilding = (cx: number, cz: number, ux: number, uz: number, w: number, d: number, hReal: number, ao: boolean): void => {
    const yaw = Math.atan2(-uz, ux);
    const pal = pickPal();
    const h = toyHeight(hReal);
    if (h > 36 && w > 22 && d > 22 && rng() < 0.3) {
      const podium = 12 + rng() * 6;
      buildings.push({ x: cx, y: 0, z: cz, w, h: podium, d, yaw, pal });
      const k = 0.6 + rng() * 0.15;
      buildings.push({ x: cx, y: podium, z: cz, w: w * k, h: h - podium, d: d * k, yaw, pal: (pal + 2) % 5 });
    } else {
      buildings.push({ x: cx, y: 0, z: cz, w, h, d, yaw, pal });
    }
    // 楼脚一圈环境光遮蔽，烘进地面：内圈 84% 亮度，3 m 内渐隐到街区地面本色。
    // 只给不投实时阴影的楼（低档全部、高档的矮楼）：投影的楼脚下已经有真影子，再叠一圈只是白花 8 个三角形
    if (ao && (!shadows || h < SHADOW_MIN_H)) ground.ringXZ(cx, cz, ux, uz, w / 2, d / 2, 3, LAYER.ao, aoIn, aoOut);
  };

  /**
   * 一个街区：街道层铺到四周街道中心线（相邻街区正好拼满路面），一圈浅色路缘，街区地面，再在退线之内放楼。
   * lots 回调给出「可建范围」（街区退 3 m 之后）里的地块；地块之间自己留 ≥ 4 m 的缝。
   */
  const addBlock = (
    cx: number,
    cz: number,
    ux: number,
    uz: number,
    hw: number,
    hd: number,
    street: { ox: number; oz: number; hw: number; hd: number },
    lots: (emit: (ox: number, oz: number, w: number, d: number) => void, iw: number, id: number) => void,
    heightFn: (x: number, z: number, frontage: boolean) => number,
    polyId: number,
    ao = true,
  ): void => {
    // 必须整块落在「这个区」所属的陆地上：下城与网格的格点会越过东河
    const onLand = land.rectOnPolygon(cx, cz, ux, uz, hw, hd, polyId);
    const vx = -uz;
    const vz = ux;
    if (onLand) {
      blocks++;
      const sx = cx + ux * street.ox + vx * street.oz;
      const sz = cz + uz * street.ox + vz * street.oz;
      ground.rectXZ(sx, sz, ux, uz, street.hw, street.hd, LAYER.street, G(GROUND.STREET));
      ground.rectXZ(cx, cz, ux, uz, hw + 1.4, hd + 1.4, LAYER.curb, G(GROUND.CURB));
      ground.rectXZ(cx, cz, ux, uz, hw, hd, LAYER.city, cityC);
    }
    const iw = hw - 3;
    const id = hd - 3;
    if (iw < 3 || id < 3) return;
    lots(
      (ox, oz, w, d) => {
        const x = cx + ux * ox + vx * oz;
        const z = cz + uz * ox + vz * oz;
        if (w < 7 || d < 7) return;
        if (excluded(x, z, Math.min(w, d) * 0.5)) return;
        if (!onLand) {
          // 岸边街区：只放整个落在陆地上的楼，脚下补一块街区地面
          if (!land.rectOnPolygon(x, z, ux, uz, w / 2 + 2, d / 2 + 2, polyId)) return;
          ground.rectXZ(x, z, ux, uz, w / 2 + 3, d / 2 + 3, LAYER.city, cityC);
        }
        const frontage = Math.abs(ox) > iw - w * 0.55;
        addBuilding(x, z, ux, uz, w, d, heightFn(x, z, frontage), ao);
      },
      iw,
      id,
    );
  };

  /** 把可建范围沿局部 x 切成 n 段（缝 4 m），每段的进深在 62%–95% 之间随机、靠向较近的街道 */
  const splitLots = (emit: (ox: number, oz: number, w: number, d: number) => void, iw: number, id: number, n: number): void => {
    const gap = 4;
    const seg = (iw * 2 - gap * (n - 1)) / n;
    if (seg < 8) {
      emit(0, 0, iw * 2, id * 2 * (0.7 + rng() * 0.25));
      return;
    }
    for (let k = 0; k < n; k++) {
      const ox = -iw + seg / 2 + k * (seg + gap);
      const dd = id * 2 * (0.62 + rng() * 0.33);
      const oz = (rng() < 0.5 ? -1 : 1) * (id - dd / 2) * rng();
      emit(ox, oz, seg * (0.86 + rng() * 0.14), dd);
    }
  };

  mark('water');
  // ── 4. 曼哈顿网格区（14 街以北；东侧到休斯顿街）────────────────────
  const high = quality.tier === 'high';
  const manhattanHeight = (x: number, z: number, frontage: boolean): number => {
    toGrid(x, z, g);
    const bump = bumpFactor(x, z);
    let base = g.s > 110 ? 17 : g.s > 59 ? 27 : 24;
    const dv = Math.hypot(x - VILLAGE.x, z - VILLAGE.z);
    if (dv < 900) base *= 0.55 + 0.45 * (dv / 900);
    let h = base * (0.55 + rng() * 0.95) + bump * (0.45 + rng() * 0.8);
    if (frontage && g.s > 59) h *= 1.3;
    if (bump > 60 && rng() < 0.16) h *= 1.4;
    return Math.max(8, Math.min(262, h));
  };

  const avenueC = G(GROUND.AVENUE);
  const avenueEdgeC = G(GROUND.AVENUE_EDGE);
  const streetHalf = (s: number): number => (WIDE_STREETS.has(s) ? 15 : 9);
  const lastAvenue = AVENUES.length - 1;
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
      if (s0 < 1.2 || (s0 < 14 && a1 > -120)) continue;
      fromGrid(sc, ac, tmp);
      toGrid(tmp.x, tmp.z, g);
      if (inGridRect(g, CENTRAL_PARK)) continue;
      const hw = blockW / 2;
      const hd = ((s1 - s0) * STREET_PITCH) / 2;
      const bx = tmp.x;
      const bz = tmp.z;
      // 街道层铺到四条街的中心线：局部 x 轴朝东（与 a 增大相反）、局部 z 轴朝下城（与 s 增大相反），所以偏移取负
      const street = {
        ox: -((A.a + B.a) / 2 - ac),
        oz: -((s + 0.5 - sc) * STREET_PITCH),
        hw: (B.a - A.a) / 2,
        hd: STREET_PITCH / 2,
      };
      addBlock(
        bx,
        bz,
        gridUx,
        gridUz,
        hw,
        hd,
        street,
        (emit, iw, id) => {
          // 高档每街区 1–3 栋、低档 1–2 栋（指南 5.4 的密度上限）；平均下来总楼数约为上一版的四成
          const n = high ? (iw > 70 ? (rng() < 0.3 ? 3 : 2) : rng() < 0.45 ? 2 : 1) : iw > 70 ? (rng() < 0.25 ? 2 : 1) : 1;
          splitLots(emit, iw, id, n);
        },
        manhattanHeight,
        manhattanId,
      );
      // 大道：主路宽度取真实路面的约 1.5 倍（= 路宽 0.9），两侧一道浅金路缘；宽街同样画成主路
      if (land.isLand(bx, bz)) {
        const avenueStrip = (av: (typeof AVENUES)[number]) => {
          const p = fromGrid((s + s + 1) / 2, av.a);
          const half = (av.width * 0.9) / 2;
          ground.rectXZ(p.x, p.z, gridUx, gridUz, half + 1.4, STREET_PITCH / 2 + 0.5, LAYER.avenueEdge, avenueEdgeC);
          ground.rectXZ(p.x, p.z, gridUx, gridUz, half, STREET_PITCH / 2 + 0.5, LAYER.avenue, avenueC);
        };
        avenueStrip(A);
        if (i + 1 === lastAvenue) avenueStrip(B);
        if (WIDE_STREETS.has(s)) {
          const p = fromGrid(s, ac);
          ground.rectXZ(p.x, p.z, gridUx, gridUz, (B.a - A.a) / 2, 13 * 0.9 + 1.4, LAYER.avenueEdge, avenueEdgeC);
          ground.rectXZ(p.x, p.z, gridUx, gridUz, (B.a - A.a) / 2, 13 * 0.9, LAYER.avenue, avenueC);
        }
      }
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
        const halfS = pitchS / 2 / STREET_PITCH;
        if (!(sc + halfS < 1.05 || (sc + halfS < 13.9 && ac - pitchA / 2 > -120))) continue;
        fromGrid(sc, ac, tmp);
        if (land.polygonAt(tmp.x, tmp.z) !== manhattanId) {
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
          (emit, iw, id) => splitLots(emit, iw, id, high ? (rng() < 0.35 ? 2 : 1) : 1),
          (x, z) => {
            const bump = bumpFactor(x, z);
            const dv = Math.hypot(x - VILLAGE.x, z - VILLAGE.z);
            let base = 22 * (0.6 + rng() * 0.8);
            if (dv < 900) base *= 0.6 + 0.4 * (dv / 900);
            let h = base + bump * (0.45 + rng() * 0.85);
            if (bump > 80 && rng() < 0.2) h *= 1.4;
            return Math.max(8, Math.min(262, h));
          },
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
        const fullUntil = quality.outerReach * 0.5;
        const density = sd < fullUntil ? 0.7 : 0.7 * (1 - (sd - fullUntil) / (quality.outerReach - fullUntil));
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
          // 外围以低层为主，远看是肌理：一个街区一栋（低档一半街区留空，露出草地）
          (emit, iw, id) => {
            if (!high && rng() < 0.62) return;
            splitLots(emit, iw, id, 1);
          },
          (bx, bz) => {
            const bump = bumpFactor(bx, bz);
            let h = 10 * (0.7 + rng() * 0.9) + bump * (0.4 + rng() * 0.9);
            if (bump > 50 && rng() < 0.2) h *= 1.5;
            return Math.max(6, Math.min(200, h));
          },
          pid,
          // 外围（布鲁克林 / 皇后区 / 新泽西）只作远景背景：不烘楼脚环境光遮蔽，省下的三角形留给曼哈顿
          false,
        );
      }
    }
  }

  mark('outer');
  // ── 7. 地标追加的楼体（帝国大厦、时代广场等）与铅笔楼 ─────────────────
  for (const b of ctx.extraBuildings) buildings.push(b);
  for (const p of pencils) {
    // 亿万富翁街的细高楼：压缩后仍是中央公园南缘最高的一排，撑起天际线的节奏
    const h = toyHeight(p.height);
    buildings.push({ x: p.xz.x, y: 0, z: p.xz.z, w: p.w, h: h * 0.7, d: p.d, yaw: GRID_YAW, pal: 3 });
    buildings.push({ x: p.xz.x, y: h * 0.7, z: p.xz.z, w: p.w * 0.8, h: h * 0.3, d: p.d * 0.8, yaw: GRID_YAW, pal: 3 });
  }

  mark('extras');
  // ── 8. 公园：中央公园、网格公园、多边形公园 ───────────────────────────
  const gridRectPoly = (r: GridRect): XZ[] => [fromGrid(r.s0, r.a0), fromGrid(r.s0, r.a1), fromGrid(r.s1, r.a1), fromGrid(r.s1, r.a0)];
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

  const parkC = G(GROUND.PARK);
  const lawnC = G(GROUND.LAWN);
  const pathC = G(GROUND.PATH);
  ground.polygonXZ(gridRectPoly(CENTRAL_PARK), [], LAYER.park, parkC);
  CP_LAWNS.forEach((l, i) => ground.polygonXZ(ellipsePoly(l.s, l.a, l.rs, l.ra, l.e, 40, 10 + i), [], LAYER.lawn, lawnC));
  CP_WATERS.forEach((w, i) => {
    // 公园湖泊进水面网格；岸边一圈沙色
    ground.polygonXZ(ellipsePoly(w.s, w.a, w.rs + 0.1, w.ra + 8, w.e, 40, i), [], LAYER.lawn, beachC);
    waterB.polygonXZ(ellipsePoly(w.s, w.a, w.rs, w.ra, w.e, 40, i), [], LAYER.lawn + 0.1, [1, 1, 1]);
  });
  // 中央公园的奶黄小径：一圈环园路 + 两条斜穿的步道（指南 5.4：「鲜绿草地 + 水库 + 密集棒棒糖树 + 奶黄小径」）
  {
    const ring: XZ[] = [];
    const s0 = CENTRAL_PARK.s0 + 1.1;
    const s1 = CENTRAL_PARK.s1 - 1.1;
    const a0 = CENTRAL_PARK.a0 + 70;
    const a1 = CENTRAL_PARK.a1 - 70;
    const N = 48;
    for (let k = 0; k <= N; k++) {
      const t = (k / N) * Math.PI * 2;
      const c = Math.cos(t);
      const sn = Math.sin(t);
      const cs = Math.sign(c) * Math.pow(Math.abs(c), 0.35);
      const ss = Math.sign(sn) * Math.pow(Math.abs(sn), 0.35);
      ring.push(fromGrid((s0 + s1) / 2 + cs * (s1 - s0) * 0.5, (a0 + a1) / 2 + ss * (a1 - a0) * 0.5 + 18 * Math.sin(t * 7)));
    }
    ground.stripXZ(ring, 5, LAYER.path, pathC, 1.5);
    const walks: [number, number][][] = [
      [[60, 120], [66, 300], [72.6, 330], [78, 520], [86, 640], [96, 600], [104, 420], [109.5, 300]],
      [[59.5, 700], [64, 560], [70, 420], [72.6, 330], [80, 200], [94, 160], [108, 260]],
    ];
    for (const w of walks) ground.stripXZ(w.map(([s, a]) => fromGrid(s, a)), 3.5, LAYER.path, pathC, 1);
  }
  for (const p of GRID_PARKS) {
    ground.polygonXZ(gridRectPoly(p), [], LAYER.park, p.name === 'Union Square' || p.name === 'Bryant Park' ? lawnC : parkC);
  }
  for (const p of polyParks) ground.polygonXZ(p.pts, [], LAYER.park, parkC);

  // 9/11 纪念池：两个下沉方形水池，周围是铺地
  {
    const plaza: XZ[] = [];
    for (let k = 0; k < 4; k++) {
      const t = GRID_YAW + (k * Math.PI) / 2 + Math.PI / 4;
      plaza.push({ x: poolCenter.x + Math.cos(t) * 150, z: poolCenter.z - Math.sin(t) * 150 });
    }
    ground.polygonXZ(plaza, [], LAYER.park, G(GROUND.PLAZA));
    for (const p of pools) {
      ground.rectXZ(p.x, p.z, gridUx, gridUz, 34, 34, LAYER.lawn, G(GROUND.POOL_RIM));
      waterB.rectXZ(p.x, p.z, gridUx, gridUz, 28, 28, LAYER.lawn + 0.1, [1, 1, 1]);
    }
  }

  // 百老汇：斜穿网格的主路，俯瞰时最容易认出的「破格」
  {
    const segs: XZ[][] = [];
    let cur: XZ[] = [];
    for (const p of broadwayPts) {
      toGrid(p.x, p.z, g);
      if (inGridRect(g, CENTRAL_PARK)) {
        if (cur.length > 1) segs.push(cur);
        cur = [];
      } else cur.push(p);
    }
    if (cur.length > 1) segs.push(cur);
    for (const s of segs) {
      ground.stripXZ(s, 12.4, LAYER.avenueEdge + 0.05, avenueEdgeC, 6);
      ground.stripXZ(s, 11, LAYER.avenue + 0.05, avenueC, 6);
    }
  }

  // 时代广场：领结形奶白步行广场（色块楼与广告牌由 landmarks 负责）
  {
    const strip: XZ[] = [];
    const strip2: XZ[] = [];
    for (let s = TIMES_SQUARE.s0; s <= TIMES_SQUARE.s1 + 1e-6; s += 0.25) {
      strip.push(fromGrid(s, Math.min(broadwayA(s), 560) - 14));
      strip2.push(fromGrid(s, Math.max(broadwayA(s), 560) + 14));
    }
    ground.polygonXZ(strip.concat(strip2.reverse()), [], LAYER.path, G(GROUND.PLAZA));
  }

  mark('parks');
  // ── 9. 棒棒糖树 ───────────────────────────────────────────────────
  const treeK = quality.trees;
  /** pri：超预算时先抽稀低优先级的（0 外围田野 · 1 行道树 / 河岸 · 2 小公园 · 3 中央公园） */
  const addTree = (x: number, z: number, scale: number, y: number, pri = 2): void => {
    trees.push({ x, z, y, s: scale, pal: Math.floor(rng() * 3) % 3, pri });
  };
  {
    // 中央公园：成簇的树林（低频噪声做林地遮罩）+ 开阔的草坪。树冠夸张地大（直径 20–28 m），挨在一起读成「一片林子」
    const step = 24 / Math.sqrt(treeK);
    const sStep = step / STREET_PITCH;
    for (let s = CENTRAL_PARK.s0 + sStep / 2; s < CENTRAL_PARK.s1; s += sStep) {
      for (let a = CENTRAL_PARK.a0 + step / 2; a < CENTRAL_PARK.a1; a += step) {
        const js = s + (rng() - 0.5) * sStep * 0.8;
        const ja = a + (rng() - 0.5) * step * 0.8;
        const grove = Math.sin(js * 0.9 + 1.3) * Math.cos(ja * 0.012 + 0.4) + Math.sin(js * 0.37 - ja * 0.007) * 0.6;
        if (grove < 0.25) continue;
        const gc = { s: js, a: ja };
        if (CP_WATERS.some((w, i) => inEllipse(gc, w, 14, i)) || CP_LAWNS.some((l, i) => inEllipse(gc, l, 8, 10 + i))) continue;
        fromGrid(js, ja, tmp);
        addTree(tmp.x, tmp.z, 1.6 + rng() * 0.6, LAYER.park, 3);
      }
    }
    const scatter = (inside: (x: number, z: number) => boolean, minX: number, minZ: number, maxX: number, maxZ: number, k: number, y: number): void => {
      const st = 30 / Math.sqrt(treeK * k);
      for (let x = minX; x < maxX; x += st) {
        for (let z = minZ; z < maxZ; z += st) {
          const jx = x + (rng() - 0.5) * st * 0.8;
          const jz = z + (rng() - 0.5) * st * 0.8;
          if (inside(jx, jz) && land.isLand(jx, jz)) addTree(jx, jz, 0.95 + rng() * 0.3, y);
        }
      }
    };
    for (const p of GRID_PARKS) {
      const poly = gridRectPoly(p);
      const xs = poly.map((q) => q.x);
      const zs = poly.map((q) => q.z);
      scatter((x, z) => pointInRing(poly, x, z), Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs), p.trees, LAYER.park);
    }
    for (const p of polyParks) {
      const xs = p.pts.map((q) => q.x);
      const zs = p.pts.map((q) => q.z);
      scatter((x, z) => pointInRing(p.pts, x, z), Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs), p.trees * 0.6, LAYER.park);
    }
    // 几条大道两侧稀疏成排的行道树：公园大道、中央公园西 / 第五大道沿公园一侧
    const rowAve = (a: number, s0: number, s1: number, side: number) => {
      for (let s = s0; s < s1; s += 0.55 / Math.sqrt(treeK)) {
        fromGrid(s, a + side, tmp);
        if (!land.isLand(tmp.x, tmp.z)) continue;
        toGrid(tmp.x, tmp.z, g);
        if (inTimesSquareZone(g)) continue;
        addTree(tmp.x, tmp.z, 0.72 + rng() * 0.12, LAYER.avenue, 1);
      }
    };
    rowAve(-250, 46, 96, -6);
    rowAve(-250, 46, 96, 6);
    rowAve(840, 60, 109, 20);
    rowAve(0, 60, 109, -20);
    // 河滨公园：哈德逊河岸 72 街到 125 街的一条树带
    for (let s = 72; s < 125; s += 0.9 / Math.sqrt(treeK)) {
      let shoreA = -1;
      for (let a = 1700; a < 2600; a += 12) {
        fromGrid(s, a, tmp);
        if (!land.isLand(tmp.x, tmp.z)) {
          shoreA = a;
          break;
        }
      }
      if (shoreA < 0) continue;
      for (let a = 1850; a < shoreA - 14; a += 40) {
        fromGrid(s + (rng() - 0.5) * 0.3, a + (rng() - 0.5) * 10, tmp);
        if (land.isLand(tmp.x, tmp.z)) addTree(tmp.x, tmp.z, 0.95 + rng() * 0.25, LAND_Y, 1);
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
      if (P.area > 5e6) continue;
      scatter((x, z) => land.polygonAt(x, z) === pid, P.minX, P.minZ, P.maxX, P.maxZ, 0.3, LAND_Y);
    }
    // 外围田野上零星的小树丛：总览时城外不是一整块平涂的绿
    const groves = Math.round(18 * treeK);
    for (let k = 0; k < groves * 6; k++) {
      const x = (rng() - 0.5) * 16000;
      const z = (rng() - 0.5) * 18000;
      const sd = spineDistance(x, z);
      if (sd < quality.outerReach * 0.8 || sd > 9000 || !land.isLand(x, z)) continue;
      const n = 3 + Math.floor(rng() * 5);
      for (let q = 0; q < n; q++) {
        const tx = x + (rng() - 0.5) * 70;
        const tz = z + (rng() - 0.5) * 70;
        if (land.isLand(tx, tz)) addTree(tx, tz, 1.1 + rng() * 0.4, LAND_Y, 0);
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
  // 外海平面足够大，任何视角都在视锥内，跳过包围球测试
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
    shoreMesh.frustumCulled = false;
    shoreMesh.renderOrder = 1;
    group.add(shoreMesh);
  }

  // 楼体：高档按高度拆成两份（投影 / 不投影），低档一份
  const tall = shadows ? buildings.filter((b) => b.y + b.h >= SHADOW_MIN_H) : buildings;
  const low = shadows ? buildings.filter((b) => b.y + b.h < SHADOW_MIN_H) : [];
  const buildingGeo = createBuildingGeometry(high);
  const makeBuildings = (list: BuildingInstance[], name: string, cast: boolean) => {
    if (!list.length) return;
    const geo = buildingGeo.clone();
    const count = list.length;
    const styleAttr = new Float32Array(count);
    geo.setAttribute('aStyle', new THREE.InstancedBufferAttribute(styleAttr, 1));
    const mesh = new THREE.InstancedMesh(geo, materials.building, count);
    mesh.name = name;
    mesh.customDepthMaterial = materials.buildingDepth;
    const m = mesh.instanceMatrix.array as Float32Array;
    // 包围盒在填矩阵的同一趟循环里顺手算（QA-R1-05：不对上万个实例逐个 computeBoundingSphere）。屋顶帽最多高出 3.2 m
    let bx0 = Infinity, by0 = Infinity, bz0 = Infinity, bx1 = -Infinity, by1 = -Infinity, bz1 = -Infinity;
    for (let i = 0; i < count; i++) {
      const b = list[i];
      const c = Math.cos(b.yaw);
      const s = Math.sin(b.yaw);
      const ex = (Math.abs(c) * b.w + Math.abs(s) * b.d) / 2;
      const ez = (Math.abs(s) * b.w + Math.abs(c) * b.d) / 2;
      const y0 = b.y + LAYER.city;
      if (b.x - ex < bx0) bx0 = b.x - ex;
      if (b.x + ex > bx1) bx1 = b.x + ex;
      if (b.z - ez < bz0) bz0 = b.z - ez;
      if (b.z + ez > bz1) bz1 = b.z + ez;
      if (y0 < by0) by0 = y0;
      if (y0 + b.h + 3.2 > by1) by1 = y0 + b.h + 3.2;
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
      m[o + 13] = y0;
      m[o + 14] = b.z;
      m[o + 15] = 1;
      styleAttr[i] = b.pal;
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.boundingBox = new THREE.Box3(new THREE.Vector3(bx0, by0, bz0), new THREE.Vector3(bx1, by1, bz1));
    mesh.boundingSphere = mesh.boundingBox.getBoundingSphere(new THREE.Sphere());
    mesh.castShadow = cast;
    mesh.receiveShadow = true;
    group.add(mesh);
  };
  makeBuildings(tall, 'buildings', shadows);
  makeBuildings(low, 'buildingsLow', false);
  buildingGeo.dispose();

  // 树：超出预算时从低优先级开始抽稀（中央公园最后才动）；不投实时阴影，脚下一块软影（同一个 InstancedMesh）
  let kept = trees;
  if (trees.length > CAPS.trees) {
    const byPri = [0, 0, 0, 0];
    for (const t of trees) byPri[t.pri]++;
    let excess = trees.length - CAPS.trees;
    const keep = [1, 1, 1, 1];
    for (let p = 0; p < 4 && excess > 0; p++) {
      const drop = Math.min(byPri[p], excess);
      keep[p] = byPri[p] ? 1 - drop / byPri[p] : 1;
      excess -= drop;
    }
    kept = trees.filter((t) => keep[t.pri] >= 1 || rng() < keep[t.pri]);
  }
  if (kept.length) {
    const treeGeo = createTreeGeometry();
    const pal = new Float32Array(kept.length);
    treeGeo.setAttribute('aTree', new THREE.InstancedBufferAttribute(pal, 1));
    const mesh = new THREE.InstancedMesh(treeGeo, materials.foliage, kept.length);
    mesh.name = 'trees';
    const blobGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    const blobs = new THREE.InstancedMesh(blobGeo, materials.blob, kept.length);
    blobs.name = 'treeShadows';
    blobs.renderOrder = 2;
    const mm = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const v = new THREE.Vector3();
    const sc = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    kept.forEach((t, i) => {
      q.setFromAxisAngle(up, rng() * Math.PI * 2);
      mm.compose(v.set(t.x, t.y, t.z), q, sc.set(t.s, t.s * (0.92 + rng() * 0.16), t.s));
      mesh.setMatrixAt(i, mm);
      pal[i] = t.pal;
      // 软影略偏向太阳的反方向（正午太阳在南，影子落向北 = -z）
      mm.makeScale(t.s * 17, 1, t.s * 17).setPosition(t.x, t.y + 0.25, t.z - t.s * 2.5);
      blobs.setMatrixAt(i, mm);
    });
    mesh.computeBoundingSphere();
    blobs.computeBoundingSphere();
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    group.add(mesh, blobs);
  }

  mark('assemble');
  return {
    group,
    phases,
    stats: { buildings: buildings.length, buildingsCastingShadow: shadows ? tall.length : 0, trees: kept.length, blocks },
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

/**
 * 编码的圆角楼几何（摆位在 materials.ts 的顶点着色器里，见 BUILDING_VERT_COMMON）。
 *
 * 每个角两个点：A 在朝 x 的立面上、B 在朝 z 的立面上，A–B 之间是倒角面。倒角面两端的法线分别取相邻立面的法线，
 * 插值出来就是一道圆滑的明暗过渡——卡通渐变把它量化成一两条色带，读成「圆角」，不需要更多三角形。
 * 屋顶是两圈的枕形：外圈从墙顶起坡（外缘画成白色压顶），内圈收进 32%，中心最高。
 * 一栋楼 40 个三角形：墙 16 + 枕面外圈 16 + 内圈扇形 8。低档省掉内圈，枕面是一圈扇形（24 个三角形）：
 * 手机上一栋楼十来个像素，两圈与一圈的差别看不出来，省下的三角形让低档守住 250k 的预算。
 *
 * position 只是一个近似的单位盒（包围盒与调试用），真实米数全在着色器里算。
 */
function createBuildingGeometry(twoRing: boolean): THREE.BufferGeometry {
  const pos: number[] = [];
  const aB: number[] = [];
  const aBN: number[] = [];
  const aBR: number[] = [];
  const index: number[] = [];
  const LEVEL_Y = [0, 1, 1, 1.04, 1.06];
  const LEVEL_IN = [0, 0, 0, 0.16, 0.5];
  const vert = (sx: number, sz: number, pick: number, level: number, n: [number, number, number], role: number, face: number): number => {
    const hx = 0.5 - LEVEL_IN[level];
    const hz = 0.5 - LEVEL_IN[level];
    const c = Math.min(0.15, Math.min(hx, hz) * 0.9);
    const x = pick === 0 ? sx * hx : pick === 1 ? sx * (hx - c) : 0;
    const z = pick === 0 ? sz * (hz - c) : pick === 1 ? sz * hz : 0;
    pos.push(x, LEVEL_Y[level], z);
    aB.push(sx, sz, pick, level);
    aBN.push(n[0], n[1], n[2]);
    aBR.push(role, face);
    return pos.length / 3 - 1;
  };
  // 绕一圈的 8 个点（逆时针俯视）：每个角先 A 后 B 或先 B 后 A，保证相邻点构成立面或倒角
  const LOOP: [number, number, number][] = [
    [1, 1, 0], [1, 1, 1], [-1, 1, 1], [-1, 1, 0], [-1, -1, 0], [-1, -1, 1], [1, -1, 1], [1, -1, 0],
  ];
  const outward = (sx: number, sz: number, pick: number): [number, number, number] => {
    const v = pick === 0 ? [sx, 0, sz * 0.414] : [sx * 0.414, 0, sz];
    const l = Math.hypot(v[0], v[2]);
    return [v[0] / l, 0, v[2] / l];
  };
  const faceNormal = (sx: number, sz: number, pick: number): [number, number, number] => (pick === 0 ? [sx, 0, 0] : [0, 0, sz]);
  const triOut = (a: number, b: number, c: number, nx: number, ny: number, nz: number) => {
    const ax = pos[a * 3], ay = pos[a * 3 + 1], az = pos[a * 3 + 2];
    const e1 = [pos[b * 3] - ax, pos[b * 3 + 1] - ay, pos[b * 3 + 2] - az];
    const e2 = [pos[c * 3] - ax, pos[c * 3 + 1] - ay, pos[c * 3 + 2] - az];
    const cx = e1[1] * e2[2] - e1[2] * e2[1];
    const cy = e1[2] * e2[0] - e1[0] * e2[2];
    const cz = e1[0] * e2[1] - e1[1] * e2[0];
    if (cx * nx + cy * ny + cz * nz >= 0) index.push(a, b, c);
    else index.push(a, c, b);
  };
  // 墙：每段独立的 4 个顶点（立面法线恒定；倒角两端取相邻立面法线）
  for (let k = 0; k < 8; k++) {
    const [sx0, sz0, p0] = LOOP[k];
    const [sx1, sz1, p1] = LOOP[(k + 1) % 8];
    const chamfer = sx0 === sx1 && sz0 === sz1;
    let n0: [number, number, number];
    let n1: [number, number, number];
    let face = 0;
    if (chamfer) {
      n0 = faceNormal(sx0, sz0, p0);
      n1 = faceNormal(sx1, sz1, p1);
    } else {
      // 主立面：两点在同一条边上；p0 = 1（B 点）说明是朝 z 的立面，p0 = 0 是朝 x 的立面
      n0 = n1 = p0 === 1 ? [0, 0, sz0] : [sx0, 0, 0];
      face = p0 === 1 ? 2 : 1;
    }
    const a = vert(sx0, sz0, p0, 0, n0, 0, face);
    const b = vert(sx1, sz1, p1, 0, n1, 0, face);
    const c = vert(sx1, sz1, p1, 1, n1, 0, face);
    const d = vert(sx0, sz0, p0, 1, n0, 0, face);
    const mx = (n0[0] + n1[0]) / 2;
    const mz = (n0[2] + n1[2]) / 2;
    triOut(a, b, c, mx, 0, mz);
    triOut(a, c, d, mx, 0, mz);
  }
  // 枕形屋顶：外圈（层 2）→ 内圈（层 3）→ 顶点（层 4）。外圈法线向外倾得多、内圈倾得少，卡通渐变量化出两三条色带
  const rim: number[] = [];
  const mid: number[] = [];
  for (const [sx, sz, p] of LOOP) {
    const o = outward(sx, sz, p);
    const tilt = (k: number): [number, number, number] => {
      const v = [o[0] * k, 1, o[2] * k];
      const l = Math.hypot(v[0], v[1], v[2]);
      return [v[0] / l, v[1] / l, v[2] / l];
    };
    rim.push(vert(sx, sz, p, 2, tilt(0.85), 3, 0));
    mid.push(vert(sx, sz, p, 3, tilt(0.3), 3, 0));
  }
  const top = vert(0, 0, 2, 4, [0, 1, 0], 3, 0);
  for (let k = 0; k < 8; k++) {
    const k1 = (k + 1) % 8;
    if (twoRing) {
      triOut(rim[k], rim[k1], mid[k1], 0, 1, 0);
      triOut(rim[k], mid[k1], mid[k], 0, 1, 0);
      triOut(mid[k], mid[k1], top, 0, 1, 0);
    } else triOut(rim[k], rim[k1], top, 0, 1, 0);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aB', new THREE.Float32BufferAttribute(aB, 4));
  g.setAttribute('aBN', new THREE.Float32BufferAttribute(aBN, 3));
  g.setAttribute('aBR', new THREE.Float32BufferAttribute(aBR, 2));
  // three 的程序里 normal 属性仍会被声明；给它真实法线的近似值，避免缺属性时取到 0 向量
  g.setAttribute('normal', new THREE.Float32BufferAttribute(aBN, 3));
  g.setIndex(index);
  return g;
}

/**
 * 棒棒糖树（指南 5.4）：圆球树冠 + 6 边圆柱树干，单位是米，实例只做 0.7–1.6 倍的整体缩放。
 * 树冠半径 6.2 m、树干 5 m 高 1.1 m 粗——比真树夸张：默认视距下一棵树十几个像素，要一眼读成「一颗圆球」。
 * 一棵树 58 个三角形（树冠 48 + 不封口的树干 10）：树冠十几到几十个像素，平滑法线 + 卡通渐变下 8×4 分段已经读成圆球。
 * aT：0 树干；1 + 归一高度 树冠（风摆权重）。
 */
function createTreeGeometry(): THREE.BufferGeometry {
  const trunk = new THREE.CylinderGeometry(0.9, 1.15, 5.4, 5, 1, true).toNonIndexed();
  trunk.translate(0, 2.7, 0);
  const crown = new THREE.SphereGeometry(6.2, 8, 4).toNonIndexed();
  crown.scale(1, 0.94, 1);
  crown.translate(0, 10.6, 0);
  const tag = (geo: THREE.BufferGeometry, crownPart: boolean) => {
    geo.deleteAttribute('uv');
    const p = geo.getAttribute('position');
    const t = new Float32Array(p.count);
    for (let i = 0; i < p.count; i++) t[i] = crownPart ? 1 + Math.min(0.99, Math.max(0, (p.getY(i) - 4.8) / 12)) : 0;
    geo.setAttribute('aT', new THREE.BufferAttribute(t, 1));
    return geo;
  };
  const merged = mergeNonIndexed([tag(trunk, false), tag(crown, true)]);
  trunk.dispose();
  crown.dispose();
  merged.computeBoundingSphere();
  return merged;
}
