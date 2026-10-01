/**
 * 3D 世界的地理投影与世界范围。
 *
 * ⚠️ 本文件必须保持零依赖（不得 import three，也不得 import 任何会间接引入 three 的模块）：
 * worldEvents.ts 会把这里的 isInWorld / WORLD_BOUNDS 转出给 App 静态使用，
 * 一旦这里引入 three，three 就会被打进入口包。
 *
 * 投影：以时代广场 (40.7580, -73.9855) 为原点的局部等距矩形投影，x 向东、z 向南、y 向上，
 * 单位是米。选米而不是缩放单位的理由：
 *  1. 委托距离、精度圈半径、到场校验（200 m）、楼高都直接是米，换算链越短越不容易错；
 *  2. 世界只有约 30 km 见方，float32 在这个量级仍有毫米级精度；
 *  3. 深度精度靠相机按距离动态调 near/far 保证，与单位无关。
 * 在 ±15 km 范围内，等距矩形与球面距离的误差 < 0.1%，远小于 GPS 本身的误差。
 */

export const ORIGIN_LAT = 40.758;
export const ORIGIN_LON = -73.9855;

/** 与 lib/geo.ts 的 Haversine 用同一个地球半径，保证两边算出的距离一致 */
const EARTH_R = 6_371_000;
const RAD = Math.PI / 180;
const COS0 = Math.cos(ORIGIN_LAT * RAD);
export const M_PER_DEG_LAT = EARTH_R * RAD;
export const M_PER_DEG_LON = EARTH_R * RAD * COS0;

export interface XZ {
  x: number;
  z: number;
}

/** 经纬度 → 局部平面（米）。out 可复用，避免热路径上分配对象 */
export function project(lat: number, lon: number, out: XZ = { x: 0, z: 0 }): XZ {
  out.x = (lon - ORIGIN_LON) * M_PER_DEG_LON;
  out.z = -(lat - ORIGIN_LAT) * M_PER_DEG_LAT;
  return out;
}

/** 局部平面（米）→ 经纬度 */
export function unproject(x: number, z: number): { lat: number; lon: number } {
  return { lat: ORIGIN_LAT - z / M_PER_DEG_LAT, lon: ORIGIN_LON + x / M_PER_DEG_LON };
}

/**
 * 玩家可被放进世界的范围（简报 5.1）。超出即视为「不在世界内」：
 * 不放角色，相机以时代广场为中心，「回到我」禁用。大多数测试者不在纽约，这条必须成立。
 */
export const WORLD_BOUNDS = {
  latMin: 40.695,
  latMax: 40.805,
  lonMin: -74.03,
  lonMax: -73.92,
} as const;

export function isInWorld(loc: readonly [number, number] | null | undefined): boolean {
  if (!loc) return false;
  const [lat, lon] = loc;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
  return (
    lat >= WORLD_BOUNDS.latMin &&
    lat <= WORLD_BOUNDS.latMax &&
    lon >= WORLD_BOUNDS.lonMin &&
    lon <= WORLD_BOUNDS.lonMax
  );
}

// ── 曼哈顿街网 ──────────────────────────────────────────────────────────
// 1811 年委员会规划的网格相对正北顺时针偏约 29°。用两个真实路口标定：
// 第五大道 × 59 街（中央公园东南角）为网格原点，往上城每条街约 80.4 m。

export const GRID_ANGLE_DEG = 29;
const GA = GRID_ANGLE_DEG * RAD;
/** 沿大道指向上城的单位向量（x 东、z 南） */
export const GRID_UP = { x: Math.sin(GA), z: -Math.cos(GA) } as const;
/** 沿横街指向西（哈德逊河一侧）的单位向量 */
export const GRID_WEST = { x: -Math.cos(GA), z: -Math.sin(GA) } as const;
/** 相邻两条横街中心线的间距（200 ft 街区 + 60 ft 街道，摊入宽街后约 80.4 m） */
export const STREET_PITCH = 80.4;
const GRID_ORIGIN = project(40.7644, -73.9731); // 第五大道 × 59 街
const GRID_ORIGIN_STREET = 59;

/** 网格坐标：s = 街号（可为小数），a = 距第五大道中心线向西的米数（东侧为负） */
export interface GridCoord {
  s: number;
  a: number;
}

export function toGrid(x: number, z: number, out: GridCoord = { s: 0, a: 0 }): GridCoord {
  const dx = x - GRID_ORIGIN.x;
  const dz = z - GRID_ORIGIN.z;
  out.s = GRID_ORIGIN_STREET + (dx * GRID_UP.x + dz * GRID_UP.z) / STREET_PITCH;
  out.a = dx * GRID_WEST.x + dz * GRID_WEST.z;
  return out;
}

export function fromGrid(s: number, a: number, out: XZ = { x: 0, z: 0 }): XZ {
  const u = (s - GRID_ORIGIN_STREET) * STREET_PITCH;
  out.x = GRID_ORIGIN.x + GRID_UP.x * u + GRID_WEST.x * a;
  out.z = GRID_ORIGIN.z + GRID_UP.z * u + GRID_WEST.z * a;
  return out;
}

/** 网格建筑在世界里绕 y 轴的旋转角：让盒体的局部 x 轴对齐横街方向、局部 z 轴对齐大道方向 */
export const GRID_YAW = -GA;

/** 两点平面距离（米） */
export function planarDistance(a: XZ, b: XZ): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

/** 与 lib/agent/tools.ts 一致的距离文案，调试与交接文档引用 */
export function formatDistance(m: number): string {
  return m < 1000 ? `${Math.round(m)} 公尺` : `${(m / 1000).toFixed(1)} 公里`;
}
