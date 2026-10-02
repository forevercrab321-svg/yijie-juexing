/**
 * 陆地判定：岸线多边形解码 + 按 z 分带的边索引，以及桥面「可站立走廊」。
 *
 * 城市生成要做上万次点在陆地内的判定（每个地块四个角），逐个多边形射线法会扫几千条边；
 * 按 40 m 一带把边分桶后，每次判定只看穿过这一带的十几条边。纯数学，不依赖 three。
 */
import { SHORE_DATA, SHORE_QUANT } from './data/shoreline';
import { BRIDGES, type BridgeSpec } from './data/places';
import { project, type XZ } from './geo';

/** 陆地顶面高度。水面在其下 3 m，堤岸侧壁由城市模块画出 */
export const LAND_Y = 0;
export const WATER_Y = -3;

export interface LandPolygon {
  /** 外环与洞，均为 [x0, z0, x1, z1, ...] */
  rings: Float64Array[];
  minX: number;
  minZ: number;
  maxX: number;
  maxZ: number;
  /** 外环面积（平方米），用于区分大陆块与小岛 */
  area: number;
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const B64_INDEX = new Int8Array(128).fill(-1);
for (let i = 0; i < B64.length; i++) B64_INDEX[B64.charCodeAt(i)] = i;

function decodeRing(s: string): Float64Array {
  const values: number[] = [];
  let v = 0;
  let shift = 0;
  for (let i = 0; i < s.length; i++) {
    const d = B64_INDEX[s.charCodeAt(i)];
    v |= (d & 31) << shift;
    if (d & 32) {
      shift += 5;
    } else {
      values.push(v & 1 ? -(v >>> 1) : v >>> 1);
      v = 0;
      shift = 0;
    }
  }
  const out = new Float64Array(values.length);
  let x = 0;
  let z = 0;
  for (let i = 0; i + 1 < values.length; i += 2) {
    x += values[i];
    z += values[i + 1];
    out[i] = x * SHORE_QUANT;
    out[i + 1] = z * SHORE_QUANT;
  }
  return out;
}

function ringArea(r: Float64Array): number {
  let s = 0;
  const n = r.length;
  for (let i = 0, j = n - 2; i < n; j = i, i += 2) s += r[j] * r[i + 1] - r[i] * r[j + 1];
  return Math.abs(s / 2);
}

export function decodeShoreline(): LandPolygon[] {
  return SHORE_DATA.split(';').map((poly) => {
    const rings = poly.split(',').map(decodeRing);
    let minX = Infinity;
    let minZ = Infinity;
    let maxX = -Infinity;
    let maxZ = -Infinity;
    const outer = rings[0];
    for (let i = 0; i < outer.length; i += 2) {
      minX = Math.min(minX, outer[i]);
      maxX = Math.max(maxX, outer[i]);
      minZ = Math.min(minZ, outer[i + 1]);
      maxZ = Math.max(maxZ, outer[i + 1]);
    }
    return { rings, minX, minZ, maxX, maxZ, area: ringArea(outer) };
  });
}

const BAND = 40;

/** 桥面走廊：中心线两端、宽度与沿线高度剖面 */
export interface DeckCorridor {
  spec: BridgeSpec;
  /** 桥中心（米） */
  cx: number;
  cz: number;
  /** 从曼哈顿指向对岸的单位向量 */
  dx: number;
  dz: number;
  halfLength: number;
  halfWidth: number;
  /** 主跨 + 边跨的一半：这一段桥面保持在通航高度，之外是引桥坡道 */
  suspendedHalf: number;
}

export class LandIndex {
  readonly polygons: LandPolygon[];
  readonly decks: DeckCorridor[];
  private readonly zMin: number;
  private readonly bands: Float64Array[];
  private readonly bandPoly: Int32Array[];
  private readonly parity: Uint8Array;
  private readonly touched: number[] = [];

  constructor(polygons: LandPolygon[] = decodeShoreline()) {
    this.polygons = polygons;
    let zMin = Infinity;
    let zMax = -Infinity;
    for (const p of polygons) {
      zMin = Math.min(zMin, p.minZ);
      zMax = Math.max(zMax, p.maxZ);
    }
    this.zMin = zMin;
    const bandCount = Math.max(1, Math.ceil((zMax - zMin) / BAND) + 1);
    const tmp: number[][] = Array.from({ length: bandCount }, () => []);
    const tmpPoly: number[][] = Array.from({ length: bandCount }, () => []);
    polygons.forEach((p, pid) => {
      for (const r of p.rings) {
        const n = r.length;
        for (let i = 0, j = n - 2; i < n; j = i, i += 2) {
          const za = r[j + 1];
          const zb = r[i + 1];
          const b0 = Math.floor((Math.min(za, zb) - zMin) / BAND);
          const b1 = Math.floor((Math.max(za, zb) - zMin) / BAND);
          for (let b = b0; b <= b1; b++) {
            tmp[b].push(r[j], za, r[i], zb);
            tmpPoly[b].push(pid);
          }
        }
      }
    });
    this.bands = tmp.map((a) => Float64Array.from(a));
    this.bandPoly = tmpPoly.map((a) => Int32Array.from(a));
    this.parity = new Uint8Array(polygons.length);
    this.decks = BRIDGES.map((spec) => {
      const c = project(spec.center[0], spec.center[1]);
      const b = (spec.bearing * Math.PI) / 180;
      const deck: DeckCorridor = {
        spec,
        cx: c.x,
        cz: c.z,
        dx: Math.sin(b),
        dz: -Math.cos(b),
        halfLength: spec.mainSpan / 2 + spec.sideSpan + spec.approach,
        halfWidth: spec.width / 2,
        suspendedHalf: spec.mainSpan / 2 + spec.sideSpan,
      };
      this.recenterOnRiver(deck);
      return deck;
    });
  }

  /**
   * 资料里的桥坐标只精确到几十米，而塔必须立在两岸水边。
   * 沿桥轴找最长的一段水面，把桥中心挪到这段水面的中点（只沿轴向挪，不改变桥的走向）。
   */
  private recenterOnRiver(d: DeckCorridor): void {
    const step = 8;
    let bestStart = 0;
    let bestLen = 0;
    let runStart = Infinity;
    for (let t = -d.halfLength; t <= d.halfLength + step; t += step) {
      const water = t <= d.halfLength && !this.isLand(d.cx + d.dx * t, d.cz + d.dz * t);
      if (water && runStart === Infinity) runStart = t;
      if (!water && runStart !== Infinity) {
        if (t - runStart > bestLen) {
          bestLen = t - runStart;
          bestStart = runStart;
        }
        runStart = Infinity;
      }
    }
    if (bestLen < 60) return;
    const mid = bestStart + bestLen / 2;
    // 河面比主跨宽时，塔会落在水里离岸一段距离——真实的布鲁克林大桥曼哈顿塔就是这样
    d.cx += d.dx * mid;
    d.cz += d.dz * mid;
  }

  /**
   * 落在桥附近（离桥轴 margin 米以内）的点吸附到桥面中心线上。
   * 公开资料里「某座桥」的坐标常常偏离桥面二三十米，委托的意思显然是「在桥上」。
   */
  snapToDeck(p: XZ, margin = 40): { x: number; z: number; y: number } | null {
    for (const d of this.decks) {
      const rx = p.x - d.cx;
      const rz = p.z - d.cz;
      const t = rx * d.dx + rz * d.dz;
      const perp = Math.abs(-rx * d.dz + rz * d.dx);
      if (perp > margin || Math.abs(t) > d.suspendedHalf) continue;
      return { x: d.cx + d.dx * t, z: d.cz + d.dz * t, y: deckProfile(d, t) };
    }
    return null;
  }

  /** 点所在的陆地多边形序号；在水里返回 -1 */
  polygonAt(x: number, z: number): number {
    const b = Math.floor((z - this.zMin) / BAND);
    if (b < 0 || b >= this.bands.length) return -1;
    const e = this.bands[b];
    const ids = this.bandPoly[b];
    const parity = this.parity;
    const touched = this.touched;
    for (let k = 0, q = 0; k < e.length; k += 4, q++) {
      const za = e[k + 1];
      const zb = e[k + 3];
      if (za > z !== zb > z) {
        const xa = e[k];
        const xi = xa + ((z - za) / (zb - za)) * (e[k + 2] - xa);
        if (x < xi) {
          const pid = ids[q];
          if (parity[pid] === 0 && touched.indexOf(pid) < 0) touched.push(pid);
          parity[pid] ^= 1;
        }
      }
    }
    let found = -1;
    for (const pid of touched) {
      if (parity[pid] === 1) found = pid;
      parity[pid] = 0;
    }
    touched.length = 0;
    return found;
  }

  isLand(x: number, z: number): boolean {
    return this.polygonAt(x, z) >= 0;
  }

  /** 矩形四角与中心都在陆地上（用于建筑落位，防止楼伸进河里） */
  rectOnLand(cx: number, cz: number, ux: number, uz: number, hw: number, hd: number): boolean {
    // u 是矩形局部 x 轴的单位向量；绕 y 旋转时局部 z 轴就是 (-uz, ux)（与 three 的约定一致）
    const vx = -uz;
    const vz = ux;
    if (!this.isLand(cx, cz)) return false;
    for (let i = 0; i < 4; i++) {
      const sx = i & 1 ? 1 : -1;
      const sz = i & 2 ? 1 : -1;
      if (!this.isLand(cx + ux * hw * sx + vx * hd * sz, cz + uz * hw * sx + vz * hd * sz)) return false;
    }
    return true;
  }

  /**
   * 矩形整块落在指定的那块陆地上：与 `rectOnLand(...) && polygonAt(cx, cz) === polyId` 完全等价，但更便宜。
   * 先问中心属于哪块陆地——不是这一块就直接返回，四角都不用查；命中时中心必然是陆地，只再查四角。
   * 原写法中心要查两次，而且中心落在水里或别的区时仍会先把四角查完。
   * 城市生成的每个街区、每个岸边地块都要问一次（高档约 9 万次点查询），冷启动时这是构建耗时里最大的一块（QA-R1-05）。
   */
  rectOnPolygon(cx: number, cz: number, ux: number, uz: number, hw: number, hd: number, polyId: number): boolean {
    if (polyId < 0 || this.polygonAt(cx, cz) !== polyId) return false;
    const vx = -uz;
    const vz = ux;
    for (let i = 0; i < 4; i++) {
      const sx = i & 1 ? 1 : -1;
      const sz = i & 2 ? 1 : -1;
      if (!this.isLand(cx + ux * hw * sx + vx * hd * sz, cz + uz * hw * sx + vz * hd * sz)) return false;
    }
    return true;
  }

  /** 桥面走廊命中：返回桥面高度，不在任何桥面上返回 null */
  deckHeightAt(x: number, z: number): number | null {
    for (const d of this.decks) {
      const rx = x - d.cx;
      const rz = z - d.cz;
      const t = rx * d.dx + rz * d.dz;
      const perp = Math.abs(-rx * d.dz + rz * d.dx);
      if (perp > d.halfWidth || Math.abs(t) > d.halfLength) continue;
      return deckProfile(d, t);
    }
    return null;
  }

  /**
   * 站立面：陆地优先，其次桥面，否则是水面。
   * 委托若落在桥面上（例如布鲁克林大桥中段），徽章就立在桥面上——那是真实可走到的地方。
   */
  surfaceAt(p: XZ): { kind: 'land' | 'deck' | 'water'; x: number; z: number; y: number } {
    if (this.isLand(p.x, p.z)) {
      const deck = this.deckHeightAt(p.x, p.z);
      // 引桥压在陆地上方时，站在桥上的读法更合理（高于 6 m 才算在桥上）
      if (deck !== null && deck > 6) return { kind: 'deck', x: p.x, z: p.z, y: deck };
      return { kind: 'land', x: p.x, z: p.z, y: LAND_Y };
    }
    const deck = this.deckHeightAt(p.x, p.z);
    if (deck !== null) return { kind: 'deck', x: p.x, z: p.z, y: deck };
    const snapped = this.snapToDeck(p);
    if (snapped) return { kind: 'deck', ...snapped };
    return { kind: 'water', x: p.x, z: p.z, y: WATER_Y };
  }
}

/** 桥面沿线高度：悬索段保持通航净空，略微起拱；引桥线性落回地面 */
export function deckProfile(d: DeckCorridor, t: number): number {
  const at = Math.abs(t);
  const h = d.spec.deckHeight;
  if (at <= d.suspendedHalf) {
    const k = at / d.suspendedHalf;
    return h + 3 * (1 - k * k);
  }
  const ramp = 1 - (at - d.suspendedHalf) / d.spec.approach;
  return Math.max(LAND_Y, h * Math.max(0, ramp));
}
