/**
 * 几何小工具。代替 three/examples 的 BufferGeometryUtils：这里只需要「合并非索引几何」与「带洞轮廓拉伸」，
 * 自己写几十行，3D 分包少打约 5 KB（分包体积预算 720 KB）。
 */
import * as THREE from 'three';

/**
 * 合并若干非索引几何体。所有输入的属性名与 itemSize 必须一致（调用方保证：都先转成非索引、删掉 uv、补齐顶点色）。
 */
export function mergeNonIndexed(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const out = new THREE.BufferGeometry();
  if (geos.length === 0) return out;
  for (const name of Object.keys(geos[0].attributes)) {
    const itemSize = geos[0].getAttribute(name).itemSize;
    let total = 0;
    for (const g of geos) {
      const a = g.getAttribute(name);
      if (!a || a.itemSize !== itemSize || g.index) throw new Error(`mergeNonIndexed: attribute "${name}" mismatch`);
      total += a.count * itemSize;
    }
    const arr = new Float32Array(total);
    let offset = 0;
    for (const g of geos) {
      const a = g.getAttribute(name) as THREE.BufferAttribute;
      arr.set(a.array as ArrayLike<number>, offset);
      offset += a.count * itemSize;
    }
    out.setAttribute(name, new THREE.BufferAttribute(arr, itemSize));
  }
  return out;
}

/**
 * 把一个平面轮廓（可带洞）沿 z 轴拉伸成厚板：前后两面 + 外轮廓与洞的侧壁。
 * 代替 ExtrudeGeometry——它会连带打包 Shape / Path 与整套曲线类（约 25 KB），这里只需要折线轮廓。
 * 轮廓在 xy 平面上，板从 z = -depth/2 到 +depth/2。返回非索引几何（position + normal）。
 */
export function extrudeOutline(outline: THREE.Vector2[], holes: THREE.Vector2[][], depth: number): THREE.BufferGeometry {
  const pos: number[] = [];
  const nor: number[] = [];
  const h = depth / 2;
  const push = (x: number, y: number, z: number, nx: number, ny: number, nz: number) => {
    pos.push(x, y, z);
    nor.push(nx, ny, nz);
  };
  // 轮廓统一成逆时针、洞统一成顺时针，三角化与侧壁朝向就都确定了
  const ccw = (r: THREE.Vector2[], want: boolean) => (THREE.ShapeUtils.isClockWise(r) === want ? r.slice().reverse() : r);
  const outer = ccw(outline, true);
  const inner = holes.map((r) => ccw(r, false));
  const all = outer.concat(...inner);
  const faces = THREE.ShapeUtils.triangulateShape(outer, inner);
  for (const [a, b, c] of faces) {
    // 前面朝 +z，后面朝 -z（顶点顺序相反）
    for (const i of [a, b, c]) push(all[i].x, all[i].y, h, 0, 0, 1);
    for (const i of [a, c, b]) push(all[i].x, all[i].y, -h, 0, 0, -1);
  }
  const walls = (ring: THREE.Vector2[]) => {
    for (let i = 0; i < ring.length; i++) {
      const p = ring[i];
      const q = ring[(i + 1) % ring.length];
      const ex = q.x - p.x;
      const ey = q.y - p.y;
      const len = Math.hypot(ex, ey) || 1;
      // 逆时针外轮廓的外法线在右手边；洞是顺时针，同一公式正好朝向洞内（板的外侧）
      const nx = ey / len;
      const ny = -ex / len;
      push(p.x, p.y, h, nx, ny, 0);
      push(p.x, p.y, -h, nx, ny, 0);
      push(q.x, q.y, -h, nx, ny, 0);
      push(p.x, p.y, h, nx, ny, 0);
      push(q.x, q.y, -h, nx, ny, 0);
      push(q.x, q.y, h, nx, ny, 0);
    }
  };
  walls(outer);
  for (const r of inner) walls(r);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  return g;
}
