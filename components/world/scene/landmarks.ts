/**
 * 地标：帝国大厦、克莱斯勒、世贸一号楼、时代广场、三座东河大桥、自由女神像。
 *
 * 辨识度靠轮廓，不靠发光：帝国大厦的退台 + 系泊桅杆、布鲁克林大桥的哥特双尖拱、
 * 克莱斯勒的阶梯拱冠、世贸一号楼由方变八角的收分。夜灯只是锦上添花。
 *
 * draw call：地标结构 1（顶点色合并）+ 夜灯 1 + 桥索 1 + 广告牌 1 + 世贸玻璃 1。
 * 楼体部分（帝国大厦、时代广场楼群等）作为实例并入城市的楼体 InstancedMesh，不额外占 draw call。
 */
import * as THREE from 'three';
import { mergeNonIndexed, extrudeOutline } from './geometry';
import { project, fromGrid, GRID_YAW, STREET_PITCH, type XZ } from './geo';
import { LandIndex, deckProfile, WATER_Y, LAND_Y, type DeckCorridor } from './land';
import { EMPIRE_STATE, CHRYSLER, ONE_WTC, LIBERTY, TIMES_SQUARE } from './data/places';
import { STYLE, type MaterialKit } from './materials';
import { broadwayA, mulberry32, type BuildingInstance } from './city';
import { BILLBOARD_COLS, BILLBOARD_ROWS } from './textures';

const _c = new THREE.Color();
const hex = (h: string): [number, number, number] => {
  _c.set(h);
  return [_c.r, _c.g, _c.b];
};

const COL = {
  limestone: hex('#d9ccb0'),
  granite: hex('#b7a993'),
  graniteDark: hex('#8f8371'),
  steel: hex('#7f7b72'),
  steelLight: hex('#bdb9b0'),
  deck: hex('#5e574c'),
  verdigris: hex('#6d9b87'),
  verdigrisDark: hex('#557d6c'),
  stoneLight: hex('#c9bca3'),
  ball: hex('#e8cf94'),
};

/** 把几何体转成「非索引 + 顶点色 + 无 uv」，好与其他部件合并 */
function paint(geo: THREE.BufferGeometry, c: readonly number[]): THREE.BufferGeometry {
  let g = geo.index ? geo.toNonIndexed() : geo;
  if (g !== geo) geo.dispose();
  g.deleteAttribute('uv');
  if (!g.getAttribute('normal')) g.computeVertexNormals();
  // 部分内置几何体带分组，合并前清掉
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

function bare(geo: THREE.BufferGeometry): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo;
  if (g !== geo) geo.dispose();
  g.deleteAttribute('uv');
  g.clearGroups();
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

function cylinder(x: number, y0: number, z: number, rTop: number, rBottom: number, h: number, seg = 10): THREE.BufferGeometry {
  const g = new THREE.CylinderGeometry(rTop, rBottom, h, seg);
  g.translate(x, y0 + h / 2, z);
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

export function buildLandmarks(land: LandIndex, materials: MaterialKit, billboardTexture: THREE.Texture): LandmarkResult {
  const solid: THREE.BufferGeometry[] = [];
  const lights: THREE.BufferGeometry[] = [];
  const cablePts: number[] = [];
  const buildings: BuildingInstance[] = [];
  const rng = mulberry32(42);
  const yaw = GRID_YAW;
  const ux = Math.cos(yaw);
  const uz = -Math.sin(yaw);
  const vx = -uz;
  const vz = ux;
  /** 网格局部偏移 → 世界坐标 */
  const at = (c: XZ, ox: number, oz: number): XZ => ({ x: c.x + ux * ox + vx * oz, z: c.z + uz * ox + vz * oz });
  const tier = (c: XZ, y: number, w: number, h: number, d: number, style: number, color: readonly number[]) =>
    buildings.push({ x: c.x, y, z: c.z, w, h, d, yaw, style, color });

  // ── 帝国大厦：五段退台 + 系泊桅杆 + 天线 ─────────────────────────────
  const esb = project(EMPIRE_STATE[0], EMPIRE_STATE[1]);
  {
    const lime = COL.limestone;
    tier(esb, 0, 118, 26, 56, STYLE.PUNCHED, lime);
    tier(esb, 26, 86, 56, 48, STYLE.PUNCHED, lime);
    tier(esb, 82, 58, 206, 40, STYLE.PUNCHED, lime);
    tier(esb, 288, 46, 28, 32, STYLE.PUNCHED, lime);
    tier(esb, 316, 34, 14, 24, STYLE.PUNCHED, lime);
    tier(esb, 330, 24, 14, 18, STYLE.BLANK, lime);
    const y0 = 344 + LAND_Y + 0.5;
    solid.push(paint(cylinder(esb.x, y0, esb.z, 7.2, 8.4, 16, 12), COL.stoneLight));
    solid.push(paint(cylinder(esb.x, y0 + 16, esb.z, 5.2, 6.4, 18, 12), COL.stoneLight));
    solid.push(paint(cylinder(esb.x, y0 + 34, esb.z, 3.4, 4.6, 10, 10), COL.steelLight));
    solid.push(paint(cylinder(esb.x, y0 + 44, esb.z, 0.7, 1.4, 52, 6), COL.steel));
    // 夜里冠顶的泛光：两段整圈亮起的冠顶 + 顶端航空灯。
    // 原先是两道 2 m 高的灯带，默认视角里不到两个像素，夜里认不出帝国大厦；现在冠顶两段整体泛光（约十个像素高），
    // 白天这两段是石色（lights 材质的底色），读起来仍是石砌冠顶
    lights.push(bare(cylinder(esb.x, y0 + 2, esb.z, 8.7, 8.7, 13.5, 14)));
    lights.push(bare(cylinder(esb.x, y0 + 18, esb.z, 6.7, 6.7, 15, 14)));
    lights.push(bare(new THREE.SphereGeometry(1.6, 8, 6).translate(esb.x, y0 + 97, esb.z)));
  }

  // ── 克莱斯勒：阶梯拱冠 + 针尖 ─────────────────────────────────────────
  const chrysler = project(CHRYSLER[0], CHRYSLER[1]);
  {
    const stone = hex('#cfc8bb');
    tier(chrysler, 0, 58, 64, 56, STYLE.PUNCHED, stone);
    tier(chrysler, 64, 42, 138, 42, STYLE.PUNCHED, stone);
    const base = 202 + LAND_Y + 0.5;
    // 四段车床（四个径向分段 = 方锥），旋转 45° 让面与楼体对齐；半径是外接圆半径
    const profile: THREE.Vector2[] = [];
    const steps = [29, 24, 19.5, 15, 11, 7.5, 4.5];
    let y = 0;
    profile.push(new THREE.Vector2(0.01, 0));
    for (const r of steps) {
      profile.push(new THREE.Vector2(r, y));
      y += 9;
      profile.push(new THREE.Vector2(r * 0.9, y));
    }
    profile.push(new THREE.Vector2(1.2, y));
    profile.push(new THREE.Vector2(0.25, y + 46));
    profile.push(new THREE.Vector2(0.01, y + 46.5));
    const crown = new THREE.LatheGeometry(profile, 4);
    crown.rotateY(Math.PI / 4 + yaw);
    crown.translate(chrysler.x, base, chrysler.z);
    solid.push(paint(crown, COL.steelLight));
    // 夜灯：每一级拱的檐口一圈暖光，读出阶梯轮廓（2.4 m 高：默认视角下也有两个像素，阶梯冠在夜里认得出）
    let ly = 0;
    for (const r of steps.slice(0, 6)) {
      ly += 9;
      const ring = new THREE.CylinderGeometry(r * 0.93, r * 0.93, 2.4, 4, 1, true);
      ring.rotateY(Math.PI / 4 + yaw);
      ring.translate(chrysler.x, base + ly - 1.1, chrysler.z);
      lights.push(bare(ring));
    }
  }

  // ── 世贸一号楼：方形基座收分成旋转 45° 的方形顶，八个三角面 ───────────────
  const wtc = project(ONE_WTC[0], ONE_WTC[1]);
  let wtcMesh: THREE.Mesh;
  {
    tier(wtc, 0, 62, 56, 62, STYLE.RIBBON, hex('#b3b1a8'));
    const y0 = 56 + LAND_Y + 0.5;
    const y1 = 405 + LAND_Y + 0.5;
    const hb = 31;
    const ht = 28.3;
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
      // 保证法线朝外（远离楼心）
      const n = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a));
      const mid = new THREE.Vector3().add(a).add(b).add(c).multiplyScalar(1 / 3);
      const out = new THREE.Vector3(mid.x - wtc.x, 0, mid.z - wtc.z);
      if (n.dot(out) < 0) [b, c] = [c, b];
      // 窗户着色器用局部坐标：几何体以楼心为原点、底面在 y=0
      for (const p of [a, b, c]) pos.push(p.x - wtc.x, p.y - LAND_Y - 0.5, p.z - wtc.z);
    };
    // B[k] 与 B[k+1] 之间的边中点方向正对 T[k]（顶部方形的角）
    for (let k = 0; k < 4; k++) {
      const k1 = (k + 1) % 4;
      pushTri(B[k], B[k1], T[k]);
      pushTri(T[k], T[(k + 3) % 4], B[k]);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    g.setAttribute('aStyle', new THREE.Float32BufferAttribute(new Float32Array(pos.length / 3).fill(STYLE.CURTAIN), 1));
    wtcMesh = new THREE.Mesh(g, materials.landmarkGlass);
    wtcMesh.position.set(wtc.x, LAND_Y + 0.5, wtc.z);
    wtcMesh.castShadow = true;
    wtcMesh.receiveShadow = true;
    wtcMesh.name = 'oneWtc';
    // 顶盖、桅杆环与天线
    const cap = new THREE.CylinderGeometry(ht, ht, 3, 4);
    cap.rotateY(yaw + Math.PI / 4 + Math.PI / 4);
    cap.translate(wtc.x, y1 + 1.5, wtc.z);
    solid.push(paint(cap, COL.steelLight));
    solid.push(paint(cylinder(wtc.x, y1 + 3, wtc.z, 7, 9, 8, 12), COL.steelLight));
    solid.push(paint(cylinder(wtc.x, y1 + 11, wtc.z, 0.9, 2.2, 108, 8), COL.steel));
    lights.push(bare(new THREE.SphereGeometry(2, 8, 6).translate(wtc.x, y1 + 120, wtc.z)));
  }

  // ── 时代广场：围合领结广场的高楼 + 面向广场的广告牌 ──────────────────────
  const boardPos: number[] = [];
  const boardNor: number[] = [];
  const boardUv: number[] = [];
  const addBoard = (c: XZ, y: number, w: number, h: number, nx: number, nz: number, cell: number) => {
    // 观察者面对广告牌时的「右」方向 = (nz, -nx)
    const rx = nz;
    const rz = -nx;
    const col = cell % BILLBOARD_COLS;
    const row = Math.floor(cell / BILLBOARD_COLS) % BILLBOARD_ROWS;
    const u0 = col / BILLBOARD_COLS;
    const u1 = (col + 1) / BILLBOARD_COLS;
    const v1 = 1 - row / BILLBOARD_ROWS;
    const v0 = 1 - (row + 1) / BILLBOARD_ROWS;
    const px = c.x + nx * 0.6;
    const pz = c.z + nz * 0.6;
    const corners = [
      [px - rx * w / 2, y, pz - rz * w / 2, u0, v0],
      [px + rx * w / 2, y, pz + rz * w / 2, u1, v0],
      [px + rx * w / 2, y + h, pz + rz * w / 2, u1, v1],
      [px - rx * w / 2, y + h, pz - rz * w / 2, u0, v1],
    ];
    for (const i of [0, 1, 2, 0, 2, 3]) {
      const [x, yy, z, u, v] = corners[i];
      boardPos.push(x, yy, z);
      boardNor.push(nx, 0, nz);
      boardUv.push(u, v);
    }
  };
  const anchors: Record<string, XZ> = { esb, chrysler, oneWtc: wtc };
  {
    // 朝东（朝 a 减小方向）的法线就是网格局部 +x；朝西是 -x
    const east = { x: ux, z: uz };
    const west = { x: -ux, z: -uz };
    const masonry = ['#cbbfa6', '#bfa98a', '#a39b8e', '#b58977', '#d6c9ad'].map(hex);
    let cell = 0;
    for (let s = 42; s < 48; s++) {
      const sh0 = s === 42 || s === 47 ? 15 : 9;
      const sh1 = s + 1 === 42 || s + 1 === 47 ? 15 : 9;
      const s0 = s + sh0 / STREET_PITCH;
      const s1 = s + 1 - sh1 / STREET_PITCH;
      const halves = rng() < 0.5 ? 1 : 2;
      for (let k = 0; k < halves; k++) {
        const ss0 = s0 + ((s1 - s0) * k) / halves;
        const ss1 = s0 + ((s1 - s0) * (k + 1)) / halves;
        const sc = (ss0 + ss1) / 2;
        const depthAlongS = (ss1 - ss0) * STREET_PITCH - 1.6;
        // 西侧：广场西沿（第七大道或百老汇的西路缘）往西
        const westFace = Math.max(575, broadwayA(sc) + 14);
        const dW = 55 + rng() * 40;
        const hW = 85 + rng() * 85;
        const westEdge = Math.min(westFace + dW, 758);
        const cW = fromGrid(sc, (westFace + westEdge) / 2);
        tier(cW, 0, westEdge - westFace, hW, depthAlongS, rng() < 0.5 ? STYLE.RIBBON : STYLE.CURTAIN, masonry[cell % masonry.length]);
        // 东侧：广场东沿（百老汇或第七大道的东路缘）往东
        const eastFace = Math.min(545, broadwayA(sc) - 14);
        const dE = 50 + rng() * 40;
        const hE = 80 + rng() * 80;
        const eastEdge = Math.max(eastFace - dE, 422);
        const cE = fromGrid(sc, (eastFace + eastEdge) / 2);
        tier(cE, 0, eastFace - eastEdge, hE, depthAlongS, rng() < 0.5 ? STYLE.RIBBON : STYLE.PUNCHED, masonry[(cell + 2) % masonry.length]);
        // 广告牌：每个立面 2–3 块，自下而上错落
        const fW = fromGrid(sc, westFace);
        const fE = fromGrid(sc, eastFace);
        const bw = Math.min(depthAlongS * 0.82, 34);
        for (let n = 0, y = 9; n < 3 && y < hW - 22; n++) {
          const bh = 12 + rng() * 10;
          addBoard(fW, y + LAND_Y + 0.5, bw * (0.75 + rng() * 0.25), bh, east.x, east.z, cell++);
          y += bh + 4 + rng() * 6;
        }
        for (let n = 0, y = 8; n < 3 && y < hE - 22; n++) {
          const bh = 12 + rng() * 10;
          addBoard(fE, y + LAND_Y + 0.5, bw * (0.75 + rng() * 0.25), bh, west.x, west.z, cell++);
          y += bh + 4 + rng() * 6;
        }
      }
    }
    // 一号时代广场：领结南端的窄塔，北立面挂满招牌，楼顶是跨年的水晶球
    const ots = fromGrid(42.55, 515);
    tier(ots, 0, 30, 112, 40, STYLE.BLANK, hex('#b9ae9a'));
    const north = { x: -vx, z: -vz }; // 局部 -z 指向上城
    const face = at(ots, 0, -20);
    for (let n = 0; n < 4; n++) addBoard(face, 10 + n * 19 + LAND_Y + 0.5, 26, 16, north.x, north.z, (n * 3 + 1) % 8);
    lights.push(bare(new THREE.SphereGeometry(3.4, 12, 8).translate(ots.x, 112 + 7 + LAND_Y + 0.5, ots.z)));
    solid.push(paint(cylinder(ots.x, 112 + LAND_Y + 0.5, ots.z, 0.8, 0.8, 4, 6), COL.steel));
    anchors.timesSquare = fromGrid((TIMES_SQUARE.s0 + TIMES_SQUARE.s1) / 2, 545);
  }

  // ── 三座东河大桥 ─────────────────────────────────────────────────────
  for (const d of land.decks) buildBridge(d, solid, cablePts);
  anchors.brooklynBridge = { x: land.decks[0].cx, z: land.decks[0].cz };

  // ── 自由女神像：十一角星形堡垒 + 基座 + 铜绿雕像 + 火炬 ──────────────────
  const lib = project(LIBERTY[0], LIBERTY[1]);
  {
    const star: THREE.Vector2[] = [];
    const n = 11;
    for (let k = 0; k < n * 2; k++) {
      const r = k % 2 === 0 ? 62 : 44;
      const a = (k / (n * 2)) * Math.PI * 2;
      star.push(new THREE.Vector2(Math.cos(a) * r, Math.sin(a) * r));
    }
    // 板厚 8 m：拉伸方向转到竖直，底面贴着岛面
    const fort = extrudeOutline(star, [], 8);
    fort.rotateX(-Math.PI / 2);
    fort.translate(lib.x, LAND_Y + 4, lib.z);
    solid.push(paint(fort, COL.granite));
    const ped = new THREE.CylinderGeometry(12, 15.5, 27, 4);
    ped.rotateY(Math.PI / 4);
    ped.translate(lib.x, 8 + 13.5, lib.z);
    solid.push(paint(ped, COL.stoneLight));
    solid.push(paint(box(lib.x, 35, lib.z, 18, 12, 18, 0), COL.granite));
    const robe = new THREE.LatheGeometry(
      [
        new THREE.Vector2(0.01, 0),
        new THREE.Vector2(7.5, 0),
        new THREE.Vector2(6.6, 10),
        new THREE.Vector2(5.4, 24),
        new THREE.Vector2(5.2, 30),
        new THREE.Vector2(2.4, 34),
        new THREE.Vector2(0.01, 34.5),
      ],
      10,
    );
    robe.translate(lib.x, 47, lib.z);
    solid.push(paint(robe, COL.verdigris));
    solid.push(paint(new THREE.SphereGeometry(3, 10, 8).translate(lib.x, 47 + 37, lib.z), COL.verdigris));
    // 王冠的七道光芒
    for (let k = 0; k < 7; k++) {
      const a = (-0.5 + k / 6) * Math.PI * 0.9;
      const spike = new THREE.ConeGeometry(0.6, 4.5, 4);
      spike.rotateZ(-Math.PI / 2);
      spike.rotateY(a + Math.PI / 2);
      spike.translate(lib.x + Math.sin(a) * 3.6, 47 + 38.5, lib.z + Math.cos(a) * 3.6);
      solid.push(paint(spike, COL.verdigrisDark));
    }
    // 高举的右臂与火炬
    const arm = new THREE.CylinderGeometry(1.1, 1.5, 15, 6);
    arm.rotateZ(-0.18);
    arm.translate(lib.x + 5.5, 47 + 36, lib.z + 1);
    solid.push(paint(arm, COL.verdigris));
    solid.push(paint(cylinder(lib.x + 6.9, 47 + 43, lib.z + 1, 1.8, 1.0, 2.4, 8), COL.verdigrisDark));
    lights.push(bare(new THREE.SphereGeometry(1.9, 8, 6).translate(lib.x + 6.9, 47 + 46.5, lib.z + 1)));
    // 左手的法典
    solid.push(paint(box(lib.x - 5.8, 47 + 18, lib.z + 1.5, 2, 9, 6, 0.3), COL.verdigrisDark));
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
  const lightGeo = lights.length ? mergeNonIndexed(lights) : null;
  for (const g of lights) g.dispose();
  if (lightGeo) {
    const mesh = new THREE.Mesh(lightGeo, materials.lights);
    mesh.name = 'landmarkLights';
    group.add(mesh);
  }
  if (cablePts.length) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(cablePts, 3));
    const lines = new THREE.LineSegments(g, materials.cables);
    lines.name = 'bridgeCables';
    group.add(lines);
  }
  if (boardPos.length) {
    materials.billboard.map = billboardTexture;
    materials.billboard.needsUpdate = true;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(boardPos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(boardNor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(boardUv, 2));
    const mesh = new THREE.Mesh(g, materials.billboard);
    mesh.name = 'billboards';
    group.add(mesh);
  }
  group.add(wtcMesh);

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

/** 一座悬索桥：桥面（沿剖面分段）、两座塔、锚碇、主缆、吊索与（布鲁克林大桥独有的）斜拉索 */
function buildBridge(d: DeckCorridor, solid: THREE.BufferGeometry[], cables: number[]): void {
  const spec = d.spec;
  const yaw = Math.atan2(-d.dz, d.dx) - Math.PI / 2;
  // 桥轴方向 (dx, dz)；横向 (px, pz)
  const px = -d.dz;
  const pz = d.dx;
  const pt = (t: number, side: number, y: number): [number, number, number] => [d.cx + d.dx * t + px * side, y, d.cz + d.dz * t + pz * side];
  const deckColor = spec.style === 'stone' ? COL.deck : hex('#625d55');
  // 桥面：20 m 一段，跟随剖面起伏
  const seg = 20;
  for (let t = -d.halfLength; t < d.halfLength; t += seg) {
    const tm = t + seg / 2;
    const y = deckProfile(d, tm);
    if (y <= LAND_Y + 0.6) continue;
    const g = new THREE.BoxGeometry(spec.width, 3, seg + 0.6);
    g.rotateY(yaw);
    const [x, , z] = pt(tm, 0, 0);
    g.translate(x, y - 1.5, z);
    solid.push(paint(g, deckColor));
  }
  const towerTop = WATER_Y + spec.towerHeight;
  const half = spec.mainSpan / 2;
  const across = spec.width + 12;
  for (const sgn of [-1, 1]) {
    const [tx, , tz] = pt(sgn * half, 0, 0);
    if (spec.style === 'stone') {
      // 哥特式花岗岩塔：一块挖出两个尖拱的厚板，桥面从拱下穿过
      const hw = across / 2;
      const H = spec.towerHeight;
      const outline = [new THREE.Vector2(-hw, 0), new THREE.Vector2(hw, 0), new THREE.Vector2(hw * 0.9, H), new THREE.Vector2(-hw * 0.9, H)];
      const archW = across * 0.24;
      const archY0 = spec.deckHeight - WATER_Y - 1;
      const archY1 = archY0 + 26;
      const holes: THREE.Vector2[][] = [];
      for (const cxA of [-across * 0.22, across * 0.22]) {
        // 尖拱：两侧直墙 + 两段二次曲线在顶点相交，每段取 6 个点
        const hole = [new THREE.Vector2(cxA - archW / 2, archY0), new THREE.Vector2(cxA + archW / 2, archY0), new THREE.Vector2(cxA + archW / 2, archY1)];
        const quad = (p0: THREE.Vector2, c: THREE.Vector2, p1: THREE.Vector2) => {
          for (let i = 1; i <= 6; i++) {
            const t = i / 6;
            const u = 1 - t;
            hole.push(new THREE.Vector2(u * u * p0.x + 2 * u * t * c.x + t * t * p1.x, u * u * p0.y + 2 * u * t * c.y + t * t * p1.y));
          }
        };
        const apex = new THREE.Vector2(cxA, archY1 + archW * 0.95);
        quad(new THREE.Vector2(cxA + archW / 2, archY1), new THREE.Vector2(cxA + archW / 2, archY1 + archW * 0.55), apex);
        quad(apex, new THREE.Vector2(cxA - archW / 2, archY1 + archW * 0.55), new THREE.Vector2(cxA - archW / 2, archY1));
        // 两段曲线都从 i = 1 开始取点，接缝处不会出现重复顶点；最后一点是左拱脚，与起点之间是竖直的墙
        holes.push(hole);
      }
      const depth = 17;
      const g = extrudeOutline(outline, holes, depth);
      g.rotateY(yaw);
      g.translate(tx, WATER_Y, tz);
      solid.push(paint(g, COL.granite));
      // 塔基与檐口
      solid.push(paint(box(tx, WATER_Y - 2, tz, across + 8, 8, depth + 10, yaw), COL.graniteDark));
      solid.push(paint(box(tx, towerTop - 1, tz, across * 0.95, 4, depth + 3, yaw), COL.stoneLight));
    } else {
      // 钢塔：两根立柱 + 三道横梁
      for (const side of [-1, 1]) {
        const [lx, , lz] = pt(sgn * half, (side * across) / 2, 0);
        solid.push(paint(box(lx, WATER_Y, lz, 6, spec.towerHeight, 7, yaw), COL.steel));
      }
      for (const fy of [0.48, 0.72, 0.98]) {
        solid.push(paint(box(tx, WATER_Y + spec.towerHeight * fy - 3, tz, across, 4.5, 5, yaw), COL.steel));
      }
      solid.push(paint(box(tx, WATER_Y - 2, tz, across + 10, 7, 16, yaw), COL.graniteDark));
    }
  }
  // 锚碇：两端压在陆地上的石砌大块
  for (const sgn of [-1, 1]) {
    const [ax, , az] = pt(sgn * d.suspendedHalf, 0, 0);
    solid.push(paint(box(ax, LAND_Y, az, spec.width + 10, spec.deckHeight + 4, 36, yaw), COL.granite));
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
    // 吊索
    for (let t = -d.suspendedHalf + 10; t < d.suspendedHalf - 6; t += 11) {
      if (Math.abs(Math.abs(t) - half) < 9) continue;
      cables.push(...pt(t, side, cableAt(t)), ...pt(t, side, deckY(t)));
    }
    // 布鲁克林大桥的放射状斜拉索：从塔顶斜向桥面，是它独一无二的「网」
    if (spec.style === 'stone') {
      for (const sgn of [-1, 1]) {
        for (let k = 1; k <= 9; k++) {
          for (const dir of [-1, 1]) {
            const t = sgn * half + dir * k * 22;
            if (Math.abs(t) > d.suspendedHalf - 10) continue;
            cables.push(...pt(sgn * half, side, towerTop - 6), ...pt(t, side, deckY(t)));
          }
        }
      }
    }
  }
}
