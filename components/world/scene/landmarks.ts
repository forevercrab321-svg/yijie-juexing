/**
 * 地标（指南 5.4「同一卡通语言」）：帝国大厦、时代广场、布鲁克林大桥（+ 曼哈顿桥、威廉斯堡桥）、
 * 克莱斯勒、世贸一号、自由女神。中央公园在 city.ts（地面 + 树）。
 *
 * 辨识度仍然靠轮廓，只是换成玩具的比例：帝国大厦 = 奶油色多级圆角退台 + 暖黄尖顶；时代广场 = 奶白广场 +
 * 四色粉彩发光色块（只有色块，不写字、不放 logo）；布鲁克林大桥 = 沙色双塔（两个尖拱）+ 白色拉索 + 奶黄桥面。
 * IP 红线（指南 1.2）：只用纽约真实建筑的卡通化版本，不做「塔形多层平台上立着角色」那类禁用结构。
 *
 * draw call：地标结构 1（顶点色合并）+ 点缀色块 1（夜里自发光）+ 桥索 1。
 * 帝国大厦、时代广场楼群等楼体作为实例并入城市的楼体 InstancedMesh，不额外占 draw call。
 */
import * as THREE from 'three';
import { mergeNonIndexed, extrudeOutline } from './geometry';
import { project, fromGrid, GRID_YAW, STREET_PITCH, type XZ } from './geo';
import { LandIndex, deckProfile, WATER_Y, LAND_Y, type DeckCorridor } from './land';
import { EMPIRE_STATE, CHRYSLER, ONE_WTC, LIBERTY, TIMES_SQUARE } from './data/places';
import type { MaterialKit } from './materials';
import { broadwayA, mulberry32, toyHeight, LAYER, type BuildingInstance } from './city';
import { LANDMARK, lin } from './palette';

const COL = {
  cream: lin(LANDMARK.cream),
  creamDeep: lin('#F6E3C2'),
  spire: lin(LANDMARK.spire),
  tower: lin(LANDMARK.bridgeTower),
  towerDeep: lin('#D9B88E'),
  deck: lin(LANDMARK.bridgeDeck),
  steel: lin(LANDMARK.steel),
  sky: lin(LANDMARK.sky),
  glass: lin('#D3E7FF'),
  mint: lin(LANDMARK.mint),
  mintDeep: lin(LANDMARK.mintDeep),
  sand: lin(LANDMARK.sand),
  white: lin(LANDMARK.white),
};

/** 把几何体转成「非索引 + 顶点色 + 无 uv」，好与其他部件合并 */
function paint(geo: THREE.BufferGeometry, c: readonly number[]): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo;
  if (g !== geo) geo.dispose();
  g.deleteAttribute('uv');
  if (!g.getAttribute('normal')) g.computeVertexNormals();
  g.clearGroups();
  const n = g.getAttribute('position').count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    col[i * 3] = c[0];
    col[i * 3 + 1] = c[1];
    col[i * 3 + 2] = c[2];
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return g;
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _up = new THREE.Vector3(0, 1, 0);

/** 世界坐标下的定向盒：底面中心 (x, y0, z)，绕 y 旋转 yaw */
function box(x: number, y0: number, z: number, w: number, h: number, d: number, yaw: number): THREE.BufferGeometry {
  const g = new THREE.BoxGeometry(w, h, d);
  _q.setFromAxisAngle(_up, yaw);
  _m.compose(new THREE.Vector3(x, y0 + h / 2, z), _q, new THREE.Vector3(1, 1, 1));
  g.applyMatrix4(_m);
  return g;
}

function cylinder(x: number, y0: number, z: number, rTop: number, rBottom: number, h: number, seg = 12): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(rTop, rBottom, h, seg);
  g.translate(x, y0 + h / 2, z);
  return g;
}

/** 圆角矩形色块（立在立面上的「发光广告色块」）：法线朝 (nx, nz)，中心 (x, y, z)，宽 w 高 h，薄薄 0.6 m 厚 */
function roundedPanel(x: number, y: number, z: number, w: number, h: number, nx: number, nz: number): THREE.BufferGeometry {
  const r = Math.min(w, h) * 0.22;
  const pts: THREE.Vector2[] = [];
  const corners: [number, number, number][] = [
    [w / 2 - r, h / 2 - r, 0],
    [-w / 2 + r, h / 2 - r, Math.PI / 2],
    [-w / 2 + r, -h / 2 + r, Math.PI],
    [w / 2 - r, -h / 2 + r, (3 * Math.PI) / 2],
  ];
  for (const [cx, cy, a0] of corners) for (let k = 0; k <= 3; k++) pts.push(new THREE.Vector2(cx + Math.cos(a0 + (k / 3) * (Math.PI / 2)) * r, cy + Math.sin(a0 + (k / 3) * (Math.PI / 2)) * r));
  const g = extrudeOutline(pts, [], 0.6);
  // 板在 xy 平面、厚度沿 z：转到法线方向，再挪到立面外 0.4 m
  g.rotateY(Math.atan2(nx, nz));
  g.translate(x + nx * 0.4, y, z + nz * 0.4);
  return g;
}

export interface LandmarkResult {
  group: THREE.Group;
  /** 并入城市楼体 InstancedMesh 的实例 */
  buildings: BuildingInstance[];
  /** 地标位置（世界坐标），供调试与盲认截图 */
  anchors: Record<string, XZ>;
  dispose(): void;
}

export function buildLandmarks(land: LandIndex, materials: MaterialKit): LandmarkResult {
  const solid: THREE.BufferGeometry[] = [];
  const glow: THREE.BufferGeometry[] = [];
  const cablePts: number[] = [];
  const buildings: BuildingInstance[] = [];
  const rng = mulberry32(42);
  const yaw = GRID_YAW;
  const ux = Math.cos(yaw);
  const uz = -Math.sin(yaw);
  const vx = -uz;
  const vz = ux;
  const at = (c: XZ, ox: number, oz: number): XZ => ({ x: c.x + ux * ox + vx * oz, z: c.z + uz * ox + vz * oz });
  const tier = (c: XZ, y: number, w: number, h: number, d: number, pal: number) => buildings.push({ x: c.x, y, z: c.z, w, h, d, yaw, pal });
  const base = LAYER.city;

  // ── 帝国大厦：奶油色五段圆角退台 + 两段圆柱冠 + 暖黄尖顶，总高 ≤ 95 m（指南 5.4）────────────
  const esb = project(EMPIRE_STATE[0], EMPIRE_STATE[1]);
  {
    // 退台顶在 68 m，冠 + 尖顶到约 93 m（地标上限 95 m）
    tier(esb, 0, 104, 12, 54, 0);
    tier(esb, 12, 80, 9, 44, 0);
    tier(esb, 21, 54, 37, 36, 0);
    tier(esb, 58, 40, 6, 28, 0);
    tier(esb, 64, 30, 4, 22, 0);
    const y0 = 68 + base + 2.4;
    solid.push(paint(cylinder(esb.x, y0 - 1, esb.z, 9, 10, 5, 16), COL.creamDeep));
    solid.push(paint(cylinder(esb.x, y0 + 4, esb.z, 6.2, 7.2, 4, 16), COL.cream));
    glow.push(paint(new THREE.ConeGeometry(4.8, 12, 12).translate(esb.x, y0 + 8 + 6, esb.z), COL.spire));
    glow.push(paint(new THREE.SphereGeometry(2, 12, 8).translate(esb.x, y0 + 20.5, esb.z), COL.spire));
  }

  // ── 克莱斯勒：天青色楼身 + 阶梯拱冠（四段车床 = 方锥）+ 针尖 ───────────────────
  const chrysler = project(CHRYSLER[0], CHRYSLER[1]);
  {
    tier(chrysler, 0, 56, 22, 54, 3);
    tier(chrysler, 22, 40, 36, 40, 3);
    const by = 58 + base + 2.2;
    const profile: THREE.Vector2[] = [new THREE.Vector2(0.01, 0)];
    const steps = [27, 22, 17, 12.5, 8.5, 5];
    let y = 0;
    for (const r of steps) {
      profile.push(new THREE.Vector2(r, y));
      y += 3.2;
      profile.push(new THREE.Vector2(r * 0.88, y));
    }
    profile.push(new THREE.Vector2(1.4, y));
    profile.push(new THREE.Vector2(0.3, y + 13));
    profile.push(new THREE.Vector2(0.01, y + 13.4));
    const crown = new THREE.LatheGeometry(profile, 4);
    crown.rotateY(Math.PI / 4 + yaw);
    crown.translate(chrysler.x, by, chrysler.z);
    solid.push(paint(crown, COL.steel));
  }

  // ── 世贸一号：方座收分成旋转 45° 的方顶（八个三角面），浅天蓝玻璃色 + 白色桅杆 ─────────────
  const wtc = project(ONE_WTC[0], ONE_WTC[1]);
  {
    tier(wtc, 0, 60, 12, 60, 3);
    const y0 = 12 + base + 2;
    const y1 = 82 + base;
    const hb = 27;
    const ht = 24;
    const B: THREE.Vector3[] = [];
    const T: THREE.Vector3[] = [];
    for (let k = 0; k < 4; k++) {
      const a = yaw + Math.PI / 4 + (k * Math.PI) / 2;
      B.push(new THREE.Vector3(wtc.x + Math.cos(a) * hb * Math.SQRT2, y0, wtc.z - Math.sin(a) * hb * Math.SQRT2));
      const at2 = yaw + Math.PI / 2 + (k * Math.PI) / 2;
      T.push(new THREE.Vector3(wtc.x + Math.cos(at2) * ht, y1, wtc.z - Math.sin(at2) * ht));
    }
    const pos: number[] = [];
    const pushTri = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => {
      const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
      const mid = new THREE.Vector3().add(a).add(b).add(c).multiplyScalar(1 / 3);
      if (n.dot(new THREE.Vector3(mid.x - wtc.x, 0, mid.z - wtc.z)) < 0) [b, c] = [c, b];
      for (const p of [a, b, c]) pos.push(p.x, p.y, p.z);
    };
    for (let k = 0; k < 4; k++) {
      pushTri(B[k], B[(k + 1) % 4], T[k]);
      pushTri(T[k], T[(k + 3) % 4], B[k]);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    solid.push(paint(g, COL.glass));
    const cap = new THREE.CylinderGeometry(ht * 1.02, ht * 1.02, 2.4, 4);
    cap.rotateY(yaw + Math.PI / 2);
    cap.translate(wtc.x, y1 + 1.2, wtc.z);
    solid.push(paint(cap, COL.white));
    solid.push(paint(cylinder(wtc.x, y1 + 2.4, wtc.z, 0.8, 1.6, 10, 8), COL.white));
    glow.push(paint(new THREE.SphereGeometry(1.4, 10, 6).translate(wtc.x, y1 + 13, wtc.z), COL.spire));
  }

  // ── 时代广场：围着领结广场的楼 + 面向广场的四色粉彩色块（夜里自发光）──────────────────────
  const anchors: Record<string, XZ> = { esb, chrysler, oneWtc: wtc };
  {
    const east = { x: ux, z: uz };
    const west = { x: -ux, z: -uz };
    const blockColors = LANDMARK.tsBlocks.map(lin);
    let cell = 0;
    for (let s = 42; s < 48; s++) {
      const sh0 = s === 42 || s === 47 ? 15 : 9;
      const sh1 = s + 1 === 42 || s + 1 === 47 ? 15 : 9;
      const s0 = s + sh0 / STREET_PITCH;
      const s1 = s + 1 - sh1 / STREET_PITCH;
      const sc = (s0 + s1) / 2;
      const depthAlongS = (s1 - s0) * STREET_PITCH - 6;
      const westFace = Math.max(578, broadwayA(sc) + 17);
      const westEdge = Math.min(westFace + 55 + rng() * 35, 755);
      const hW = toyHeight(85 + rng() * 85);
      tier(fromGrid(sc, (westFace + westEdge) / 2), 0, westEdge - westFace, hW, depthAlongS, Math.floor(rng() * 5) % 5);
      const eastFace = Math.min(542, broadwayA(sc) - 17);
      const eastEdge = Math.max(eastFace - 50 - rng() * 35, 425);
      const hE = toyHeight(80 + rng() * 80);
      tier(fromGrid(sc, (eastFace + eastEdge) / 2), 0, eastFace - eastEdge, hE, depthAlongS, Math.floor(rng() * 5) % 5);
      // 每个朝广场的立面挂 1–2 块圆角色块，四色轮换；高度错落
      const fW = fromGrid(sc, westFace);
      const fE = fromGrid(sc, eastFace);
      const bw = Math.min(depthAlongS * 0.7, 30);
      for (const [f, n, hh] of [
        [fW, east, hW],
        [fE, west, hE],
      ] as const) {
        const count = hh > 34 ? 2 : 1;
        for (let k = 0; k < count; k++) {
          const bh = 9 + rng() * 5;
          const y = base + 8 + k * (bh + 4) + rng() * 3;
          if (y + bh > base + hh - 3) break;
          glow.push(paint(roundedPanel(f.x, y + bh / 2, f.z, bw * (0.75 + rng() * 0.25), bh, n.x, n.z), blockColors[cell++ % 4]));
        }
      }
    }
    // 一号时代广场：领结南端的窄楼，北立面一列四色色块，楼顶一颗暖黄的跨年球
    const ots = fromGrid(42.55, 515);
    tier(ots, 0, 28, 46, 36, 0);
    const north = { x: -vx, z: -vz };
    const face = at(ots, 0, -18);
    for (let n = 0; n < 4; n++) glow.push(paint(roundedPanel(face.x, base + 9 + n * 9, face.z, 22, 7.5, north.x, north.z), blockColors[n]));
    glow.push(paint(new THREE.SphereGeometry(3.2, 14, 10).translate(ots.x, base + 46 + 6.5, ots.z), COL.spire));
    solid.push(paint(cylinder(ots.x, base + 46 + 2, ots.z, 0.7, 0.7, 2.4, 6), COL.white));
    anchors.timesSquare = fromGrid((TIMES_SQUARE.s0 + TIMES_SQUARE.s1) / 2, 545);
  }

  // ── 三座东河大桥 ─────────────────────────────────────────────────────
  for (const d of land.decks) buildBridge(d, solid, glow, cablePts);
  anchors.brooklynBridge = { x: land.decks[0].cx, z: land.decks[0].cz };

  // ── 自由女神像：沙色星形堡垒 + 奶油基座 + 薄荷色雕像 + 暖黄火炬 ───────────────────────
  const lib = project(LIBERTY[0], LIBERTY[1]);
  {
    const star: THREE.Vector2[] = [];
    const n = 11;
    for (let k = 0; k < n * 2; k++) {
      const r = k % 2 === 0 ? 62 : 46;
      const a = (k / (n * 2)) * Math.PI * 2;
      star.push(new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r));
    }
    const fort = extrudeOutline(star, [], 8);
    fort.rotateX(-Math.PI / 2);
    fort.translate(lib.x, LAND_Y + 4, lib.z);
    solid.push(paint(fort, COL.sand));
    const ped = new THREE.CylinderGeometry(12, 15.5, 24, 4);
    ped.rotateY(Math.PI / 4);
    ped.translate(lib.x, 8 + 12, lib.z);
    solid.push(paint(ped, COL.cream));
    const robe = new THREE.LatheGeometry(
      [
        new THREE.Vector2(0.01, 0),
        new THREE.Vector2(8, 0),
        new THREE.Vector2(7.2, 9),
        new THREE.Vector2(6, 20),
        new THREE.Vector2(5.4, 25),
        new THREE.Vector2(2.6, 28),
        new THREE.Vector2(0.01, 28.5),
      ],
      12,
    );
    robe.translate(lib.x, 32, lib.z);
    solid.push(paint(robe, COL.mint));
    // Q 版大头：头比真实比例大一圈
    solid.push(paint(new THREE.SphereGeometry(4.6, 14, 10).translate(lib.x, 32 + 32, lib.z), COL.mint));
    for (let k = 0; k < 7; k++) {
      const a = (-0.5 + k / 6) * Math.PI * 0.9;
      const spike = new THREE.ConeGeometry(0.9, 4, 6);
      spike.rotateZ(-Math.PI / 2);
      spike.rotateY(a + Math.PI / 2);
      spike.translate(lib.x + Math.sin(a) * 5, 32 + 34.5, lib.z + Math.cos(a) * 5);
      solid.push(paint(spike, COL.mintDeep));
    }
    const arm = new THREE.CylinderGeometry(1.4, 1.8, 13, 8);
    arm.rotateZ(-0.18);
    arm.translate(lib.x + 6, 32 + 30, lib.z + 1);
    solid.push(paint(arm, COL.mint));
    solid.push(paint(cylinder(lib.x + 7.2, 32 + 36, lib.z + 1, 2, 1.2, 2.4, 10), COL.mintDeep));
    glow.push(paint(new THREE.SphereGeometry(2.2, 10, 8).translate(lib.x + 7.2, 32 + 39.6, lib.z + 1), COL.spire));
    anchors.liberty = lib;
  }

  // ── 组装 ─────────────────────────────────────────────────────────────
  const group = new THREE.Group();
  group.name = 'landmarks';
  const solidGeo = solid.length ? mergeNonIndexed(solid) : null;
  for (const g of solid) g.dispose();
  if (solidGeo) {
    const mesh = new THREE.Mesh(solidGeo, materials.structure);
    mesh.name = 'landmarkStructure';
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  const glowGeo = glow.length ? mergeNonIndexed(glow) : null;
  for (const g of glow) g.dispose();
  if (glowGeo) {
    const mesh = new THREE.Mesh(glowGeo, materials.glow);
    mesh.name = 'landmarkGlow';
    mesh.castShadow = true;
    group.add(mesh);
  }
  if (cablePts.length) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(cablePts, 3));
    const lines = new THREE.LineSegments(g, materials.cables);
    lines.name = 'bridgeCables';
    group.add(lines);
  }

  return {
    group,
    buildings,
    anchors,
    dispose() {
      group.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
      });
    },
  };
}

/** 一座悬索桥：奶黄桥面（沿剖面分段）、两座塔、锚碇、白色主缆、吊索与（布鲁克林大桥独有的）斜拉索 */
function buildBridge(d: DeckCorridor, solid: THREE.BufferGeometry[], glow: THREE.BufferGeometry[], cables: number[]): void {
  const spec = d.spec;
  const yaw = Math.atan2(-d.dz, d.dx) - Math.PI / 2;
  const px = -d.dz;
  const pz = d.dx;
  const pt = (t: number, side: number, y: number): [number, number, number] => [d.cx + d.dx * t + px * side, y, d.cz + d.dz * t + pz * side];
  const stone = spec.style === 'stone';
  // 桥面：20 m 一段，跟随剖面起伏；两侧一道白色护栏让桥面在水面上「浮」起来
  const seg = 20;
  for (let t = -d.halfLength; t < d.halfLength; t += seg) {
    const tm = t + seg / 2;
    const y = deckProfile(d, tm);
    if (y <= LAND_Y + 0.6) continue;
    const g = new THREE.BoxGeometry(spec.width, 3, seg + 0.6);
    g.rotateY(yaw);
    const [x, , z] = pt(tm, 0, 0);
    g.translate(x, y - 1.5, z);
    solid.push(paint(g, COL.deck));
    for (const side of [-1, 1]) {
      const r = new THREE.BoxGeometry(1.2, 1.4, seg + 0.6);
      r.rotateY(yaw);
      const [rx, , rz] = pt(tm, (side * (spec.width - 1.2)) / 2, 0);
      r.translate(rx, y + 0.7, rz);
      solid.push(paint(r, COL.white));
    }
  }
  const towerH = Math.min(spec.towerHeight, 92);
  const towerTop = WATER_Y + towerH;
  const half = spec.mainSpan / 2;
  const across = spec.width + 12;
  for (const sgn of [-1, 1]) {
    const [tx, , tz] = pt(sgn * half, 0, 0);
    if (stone) {
      // 沙色石塔：一块挖出两个尖拱的厚板，桥面从拱下穿过；拱改得更圆胖一点，读成玩具城门
      const hw = across / 2;
      const outline = [new THREE.Vector2(-hw, 0), new THREE.Vector2(hw, 0), new THREE.Vector2(hw * 0.9, towerH), new THREE.Vector2(-hw * 0.9, towerH)];
      const archW = across * 0.26;
      const archY0 = spec.deckHeight - WATER_Y - 1;
      const archY1 = archY0 + 22;
      const holes: THREE.Vector2[][] = [];
      for (const cxA of [-across * 0.22, across * 0.22]) {
        const hole = [new THREE.Vector2(cxA - archW / 2, archY0), new THREE.Vector2(cxA + archW / 2, archY0), new THREE.Vector2(cxA + archW / 2, archY1)];
        const quad = (p0: THREE.Vector2, c: THREE.Vector2, p1: THREE.Vector2) => {
          for (let i = 1; i <= 6; i++) {
            const t = i / 6;
            const u = 1 - t;
            hole.push(new THREE.Vector2(u * u * p0.x + 2 * u * t * c.x + t * t * p1.x, u * u * p0.y + 2 * u * t * c.y + t * t * p1.y));
          }
        };
        const apex = new THREE.Vector2(cxA, archY1 + archW * 0.8);
        quad(new THREE.Vector2(cxA + archW / 2, archY1), new THREE.Vector2(cxA + archW / 2, archY1 + archW * 0.6), apex);
        quad(apex, new THREE.Vector2(cxA - archW / 2, archY1 + archW * 0.6), new THREE.Vector2(cxA - archW / 2, archY1));
        holes.push(hole);
      }
      const depth = 17;
      const g = extrudeOutline(outline, holes, depth);
      g.rotateY(yaw);
      g.translate(tx, WATER_Y, tz);
      solid.push(paint(g, COL.tower));
      solid.push(paint(box(tx, WATER_Y - 2, tz, across + 8, 8, depth + 10, yaw), COL.towerDeep));
      solid.push(paint(box(tx, towerTop - 1, tz, across * 0.98, 4, depth + 3, yaw), COL.cream));
    } else {
      // 钢塔：两根粉蓝立柱 + 三道横梁
      for (const side of [-1, 1]) {
        const [lx, , lz] = pt(sgn * half, (side * across) / 2, 0);
        solid.push(paint(box(lx, WATER_Y, lz, 6, towerH, 7, yaw), COL.sky));
      }
      for (const fy of [0.48, 0.72, 0.98]) solid.push(paint(box(tx, WATER_Y + towerH * fy - 3, tz, across, 4.5, 5, yaw), COL.steel));
      solid.push(paint(box(tx, WATER_Y - 2, tz, across + 10, 7, 16, yaw), COL.towerDeep));
    }
    // 塔顶两盏暖黄小灯：夜里桥的轮廓靠它们与白索读出来
    for (const side of [-1, 1]) {
      const [lx, , lz] = pt(sgn * half, (side * across) / 2.6, 0);
      glow.push(paint(new THREE.SphereGeometry(1.6, 8, 6).translate(lx, towerTop + 3, lz), COL.spire));
    }
  }
  for (const sgn of [-1, 1]) {
    const [ax, , az] = pt(sgn * d.suspendedHalf, 0, 0);
    solid.push(paint(box(ax, LAND_Y, az, spec.width + 10, spec.deckHeight + 4, 36, yaw), COL.tower));
  }
  // 主缆（两侧）：主跨抛物线下垂到桥面上方，边跨从塔顶直落锚碇
  const deckY = (t: number) => deckProfile(d, t);
  const cableAt = (t: number): number => {
    const at = Math.abs(t);
    if (at <= half) {
      const k = at / half;
      const low = deckY(0) + 4;
      return low + (towerTop - 2 - low) * k * k;
    }
    const k = (at - half) / (d.suspendedHalf - half);
    return towerTop - 2 + (deckY(d.suspendedHalf) + 2 - (towerTop - 2)) * k;
  };
  const sideOff = spec.width / 2 - 1;
  for (const side of [-sideOff, sideOff]) {
    const N = 48;
    for (let i = 0; i < N; i++) {
      const t0 = -d.suspendedHalf + (2 * d.suspendedHalf * i) / N;
      const t1 = -d.suspendedHalf + (2 * d.suspendedHalf * (i + 1)) / N;
      cables.push(...pt(t0, side, cableAt(t0)), ...pt(t1, side, cableAt(t1)));
    }
    for (let t = -d.suspendedHalf + 10; t < d.suspendedHalf - 6; t += 14) {
      if (Math.abs(Math.abs(t) - half) < 9) continue;
      cables.push(...pt(t, side, cableAt(t)), ...pt(t, side, deckY(t)));
    }
    // 布鲁克林大桥的放射状斜拉索：从塔顶斜向桥面，是它独一无二的「网」
    if (stone) {
      for (const sgn of [-1, 1]) {
        for (let k = 1; k <= 8; k++) {
          for (const dir of [-1, 1]) {
            const t = sgn * half + dir * k * 24;
            if (Math.abs(t) > d.suspendedHalf - 10) continue;
            cables.push(...pt(sgn * half, side, towerTop - 6), ...pt(t, side, deckY(t)));
          }
        }
      }
    }
  }
}
