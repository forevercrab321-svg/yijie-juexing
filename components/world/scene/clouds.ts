/**
 * 卡通云（指南 5.9）：16 朵（低档 12 朵），每朵 4 个合并的低面数球，一个 InstancedMesh、1 个 draw call。
 *
 * 云环绕在远景雾带附近（相机焦点为圆心、半径随视距变化）、高度在相机高度上下一点——GO 式低视角下它们正好浮在地平线上，
 * 「地图是一块漂在晴空里的桌面」。云跟着焦点平移、各自缓慢漂移（不随镜头旋转，转动视角时云在天边经过）。
 * 拉远进入总览时淡出：俯视整座城时云会挡住委托徽章。不受雾影响（它们本来就在雾带里）。
 */
import * as THREE from 'three';
import { mulberry32 } from './city';

interface Puff {
  angle: number;
  /** 半径系数（相对视距的雾带） */
  ring: number;
  /** 高度系数（相对相机高度） */
  lift: number;
  scale: number;
  drift: number;
  yaw: number;
}

export class CloudLayer {
  readonly mesh: THREE.InstancedMesh;
  private readonly puffs: Puff[] = [];
  private readonly geo: THREE.BufferGeometry;
  private readonly _m = new THREE.Matrix4();
  private readonly _q = new THREE.Quaternion();
  private readonly _p = new THREE.Vector3();
  private readonly _s = new THREE.Vector3();
  private readonly _up = new THREE.Vector3(0, 1, 0);

  constructor(material: THREE.ShaderMaterial, count: number) {
    // 一朵云：中间大、两侧小的四个圆团，底部压平——卡通云的剪影
    const parts: [number, number, number, number][] = [
      [0, 0.35, 0, 1],
      [-1.05, 0.05, 0.1, 0.72],
      [1.0, 0.0, -0.05, 0.78],
      [0.35, 0.62, 0.2, 0.62],
    ];
    const pos: number[] = [];
    const nor: number[] = [];
    for (const [x, y, z, r] of parts) {
      // 多面体几何本来就是非索引的（再调 toNonIndexed 会打 THREE. 警告）
      const s = new THREE.IcosahedronGeometry(r, 1);
      const p = s.getAttribute('position');
      for (let i = 0; i < p.count; i++) {
        const px = p.getX(i);
        let py = p.getY(i);
        const pz = p.getZ(i);
        const n = new THREE.Vector3(px, py, pz).normalize();
        // 底部压平：卡通云的底是一条平线
        if (py + y < -0.15) py = -0.15 - y;
        pos.push(px + x, py + y, pz * 0.8 + z);
        nor.push(n.x, n.y, n.z);
      }
      s.dispose();
    }
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    this.geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    this.mesh = new THREE.InstancedMesh(this.geo, material, count);
    this.mesh.name = 'clouds';
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -5;
    const rng = mulberry32(11);
    for (let i = 0; i < count; i++) {
      this.puffs.push({
        angle: (i / count) * Math.PI * 2 + rng() * 0.3,
        ring: 2.6 + rng() * 1.6,
        lift: 0.3 + rng() * 0.55,
        scale: 0.8 + rng() * 0.7,
        drift: (rng() - 0.5) * 0.012,
        yaw: rng() * Math.PI,
      });
    }
  }

  /**
   * center：镜头焦点；dist：视距；camHeight：相机离地高度；fade：0–1（总览淡出）；time：环境时钟。
   * 云的尺寸跟着视距走：任何缩放下天边的云都是大致相同的屏幕大小。
   */
  update(center: THREE.Vector3, dist: number, camHeight: number, fade: number, time: number): void {
    const mat = this.mesh.material as THREE.ShaderMaterial;
    mat.uniforms.uFade.value = fade;
    this.mesh.visible = fade > 0.01;
    if (!this.mesh.visible) return;
    const base = Math.max(400, dist);
    this.puffs.forEach((c, i) => {
      const a = c.angle + time * c.drift;
      const R = base * c.ring;
      this._p.set(center.x + Math.cos(a) * R, Math.max(120, camHeight * c.lift) + 40, center.z + Math.sin(a) * R);
      const s = base * 0.075 * c.scale;
      this._q.setFromAxisAngle(this._up, c.yaw + a);
      this._m.compose(this._p, this._q, this._s.set(s * 1.25, s * 0.85, s));
      this.mesh.setMatrixAt(i, this._m);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    this.geo.dispose();
    this.mesh.dispose();
  }
}
