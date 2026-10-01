/**
 * Pokémon GO 式轨道相机。
 *
 * 状态 = 焦点 target（地面上的点）+ 距离 distance（即调试里的 camera.zoom，单位米）
 *       + 俯仰 tilt（相机视线相对地平面的俯角，35°–70°，越大越接近正俯视）+ 航向 heading（0 = 正北朝上，顺时针为正）。
 *
 * 总览：缩到最远时焦点平滑移到全部委托的中心、俯仰抬到 70°，保证任何航向下所有光柱都在屏幕里——
 * 这是发现委托的入口（简报 3.1-4「最大缩小时要能看见全部委托」）。
 *
 * 手感：飞行用定时缓动（默认 easeInOutCubic；聚焦用临界阻尼响应——点下去立刻动、落地不回弹），
 * 用户一按下就立刻交还控制；跟随玩家用指数平滑。
 * 震屏 = trauma²，沿相机自身的右 / 上轴平移再加一点滚转，用平滑的叠加正弦驱动（不是每帧随机数）；
 * 视场冲击是闭式的衰减正弦，可以延迟到顿帧结束才触发。参数见 feel.ts。
 * 减少动态效果模式下没有震屏与视场冲击，飞行缩短为 0.25 s。
 */
import * as THREE from 'three';
import { FEEL, easeResponse, kick, shakeWave } from './feel';

export const TILT_MIN = 35;
export const TILT_MAX = 70;
export const DIST_MIN = 160;
const DEG = Math.PI / 180;

export interface CameraPose {
  target: THREE.Vector3;
  distance: number;
  tilt: number;
  heading: number;
}

export interface FitMargins {
  x: number;
  yTop: number;
  yBottom: number;
}

const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const wrapDeg = (d: number) => {
  let x = ((d + 180) % 360 + 360) % 360 - 180;
  if (x === -180) x = 180;
  return x;
};

interface Flight {
  from: CameraPose;
  to: CameraPose;
  /** 已飞行时长；从负数起步表示先原地停一拍（hold）再出发 */
  t: number;
  dur: number;
  easing: (t: number) => number;
  /** 开场镜头：任意按下立即停止 */
  intro: boolean;
}

export interface FlightOptions {
  /** 'response'：临界阻尼响应（聚焦用）；缺省 easeInOutCubic */
  ease?: 'response';
  /** 出发前原地停留的秒数 */
  hold?: number;
}

interface FovKick {
  at: number;
  amp: number;
  period: number;
  tau: number;
}

export class CameraRig {
  readonly camera: THREE.PerspectiveCamera;
  readonly target = new THREE.Vector3();
  distance = 1300;
  tilt = 52;
  heading = 0;
  maxDistance = 14000;
  readonly overviewCenter = new THREE.Vector3();
  /** 默认视角（重置视角回到这里） */
  home: CameraPose = { target: new THREE.Vector3(), distance: 1300, tilt: 52, heading: 0 };
  /** 跟随目标：非空时焦点平滑追随这个点（玩家走动时镜头跟着走） */
  follow: THREE.Vector3 | null = null;
  reducedMotion = false;

  readonly effTarget = new THREE.Vector3();
  effTilt = 52;
  private flight: Flight | null = null;
  private trauma = 0;
  /** 延迟生效的 trauma（顿帧结束才开始震） */
  private pendingTrauma: { at: number; amount: number }[] = [];
  private fovKicks: FovKick[] = [];
  /** 本帧的视场冲击量（度，调试读数用） */
  fovOffset = 0;
  private baseFov = 40;
  private time = 0;
  private readonly scratch: THREE.PerspectiveCamera;
  private readonly _v = new THREE.Vector3();
  private readonly _p = new THREE.Vector3();
  private readonly _t = new THREE.Vector3();
  /** 本帧的真实帧间隔：震屏的衰减用它 */
  private frameDt = 1 / 60;

  constructor() {
    this.camera = new THREE.PerspectiveCamera(40, 1, 2, 40000);
    this.scratch = new THREE.PerspectiveCamera(40, 1, 2, 40000);
  }

  get flying(): boolean {
    return this.flight !== null;
  }

  get inIntro(): boolean {
    return !!this.flight?.intro;
  }

  /** 不含视场冲击的垂直视场（度）：构图计算用 */
  get fov(): number {
    return this.baseFov;
  }

  /** 当前的震屏 trauma（调试读数） */
  get shakeTrauma(): number {
    return this.trauma;
  }

  /** 竖屏手机的垂直视场更宽：保持水平视场不至于窄成一条缝 */
  setViewport(width: number, height: number): void {
    const aspect = width / Math.max(1, height);
    const hfov = 46 * DEG;
    const v = 2 * Math.atan(Math.tan(hfov / 2) / aspect) / DEG;
    this.baseFov = Math.min(66, Math.max(40, v));
    this.camera.aspect = aspect;
    this.scratch.aspect = aspect;
    this.scratch.fov = this.baseFov;
    this.scratch.updateProjectionMatrix();
  }

  /** 用户按下：停止一切插值，从当前画面接手 */
  interrupt(): void {
    if (this.flight) {
      // 飞行中途打断：把插值到一半的状态当作新的用户状态
      this.flight = null;
    }
  }

  stopFollow(): void {
    this.follow = null;
  }

  rotate(dHeadingDeg: number, dTiltDeg: number): void {
    this.interrupt();
    this.heading = wrapDeg(this.heading + dHeadingDeg);
    this.tilt = Math.min(TILT_MAX, Math.max(TILT_MIN, this.tilt + dTiltDeg));
  }

  zoom(factor: number): void {
    this.interrupt();
    this.distance = Math.min(this.maxDistance, Math.max(DIST_MIN, this.distance * factor));
  }

  /** 屏幕拖动平移（像素），换算成焦点在地面上的位移 */
  pan(dxPx: number, dyPx: number, viewportH: number): void {
    this.interrupt();
    this.stopFollow();
    const mPerPx = (2 * this.distance * Math.tan((this.camera.fov * DEG) / 2)) / Math.max(1, viewportH);
    const h = this.heading * DEG;
    // 屏幕右 = (cos h, -sin h)；屏幕上（向前）= (sin h, -cos h)，均在 x 东 z 南坐标系
    const rx = Math.cos(h);
    const rz = Math.sin(h);
    const fx = Math.sin(h);
    const fz = -Math.cos(h);
    const k = 1 / Math.max(0.35, Math.sin(this.effTilt * DEG));
    this.target.x -= (rx * dxPx - fx * dyPx * k) * mPerPx;
    this.target.z -= (rz * dxPx - fz * dyPx * k) * mPerPx;
  }

  snapTo(pose: Partial<CameraPose>): void {
    this.flight = null;
    if (pose.target) this.target.copy(pose.target);
    if (pose.distance !== undefined) this.distance = pose.distance;
    if (pose.tilt !== undefined) this.tilt = pose.tilt;
    if (pose.heading !== undefined) this.heading = wrapDeg(pose.heading);
  }

  flyTo(pose: Partial<CameraPose>, duration = 1.0, intro = false, opts: FlightOptions = {}): void {
    const from: CameraPose = { target: this.target.clone(), distance: this.distance, tilt: this.tilt, heading: this.heading };
    const to: CameraPose = {
      target: pose.target ? pose.target.clone() : from.target.clone(),
      distance: Math.min(this.maxDistance, Math.max(DIST_MIN, pose.distance ?? from.distance)),
      tilt: Math.min(TILT_MAX, Math.max(TILT_MIN, pose.tilt ?? from.tilt)),
      heading: pose.heading ?? from.heading,
    };
    if (this.reducedMotion && !intro) duration = Math.min(duration, 0.25);
    const hold = this.reducedMotion ? 0 : Math.max(0, opts.hold ?? 0);
    const easing = intro ? easeOutCubic : opts.ease === 'response' ? easeResponse : easeInOutCubic;
    this.flight = { from, to, t: -hold, dur: Math.max(0.05, duration), easing, intro };
  }

  /** 开场：从高空落到默认视角，≤ 2.5 s */
  playIntro(): void {
    if (this.reducedMotion) {
      this.snapTo(this.home);
      return;
    }
    this.snapTo({
      target: this.home.target,
      distance: Math.min(this.maxDistance, Math.max(this.home.distance * 4, 7000)),
      tilt: 68,
      heading: this.home.heading - 30,
    });
    this.flyTo(this.home, 2.2, true);
  }

  /** 震屏：多次冲击累加（不重置），delay 秒后才生效 */
  addTrauma(amount: number, delay = 0): void {
    if (this.reducedMotion) return;
    if (delay > 0) this.pendingTrauma.push({ at: this.time + delay, amount });
    else this.trauma = Math.min(1, this.trauma + amount);
  }

  /** 视场冲击（度）：正 = 外踢（被推开），负 = 内收（向前一扑）。delay 秒后开始 */
  kickFov(amp: number, delay = 0, period = 0.36, tau = 0.14): void {
    if (this.reducedMotion) return;
    this.fovKicks.push({ at: this.time + delay, amp, period, tau });
  }

  /** 由距离推出的总览混合系数：0 = 普通，1 = 完全总览 */
  overviewBlend(distance = this.distance): number {
    // 拟合计算时 maxDistance 临时设为无穷大，此时没有总览混合（否则 Inf - Inf 会得到 NaN）
    if (!Number.isFinite(this.maxDistance)) return 0;
    const start = Math.max(2600, this.maxDistance * 0.42);
    return smoothstep(start, this.maxDistance, distance);
  }

  update(dt: number): void {
    this.time += dt;
    this.frameDt = dt;
    if (this.reducedMotion) {
      // 中途切到「减少动态效果」：正在进行的震屏与视场冲击立即归零，而不是等它衰减完
      this.trauma = 0;
      this.pendingTrauma.length = 0;
      this.fovKicks.length = 0;
    }
    if (this.pendingTrauma.length) {
      this.pendingTrauma = this.pendingTrauma.filter((p) => {
        if (p.at > this.time) return true;
        this.trauma = Math.min(1, this.trauma + p.amount);
        return false;
      });
    }
    let fov = 0;
    if (this.fovKicks.length) {
      this.fovKicks = this.fovKicks.filter((k) => this.time - k.at < k.period + k.tau * 6);
      for (const k of this.fovKicks) fov += kick(this.time - k.at, k.amp, k.period, k.tau);
    }
    this.fovOffset = Math.max(-8, Math.min(8, fov));
    if (this.flight) {
      const f = this.flight;
      f.t += dt;
      const k = f.easing(Math.min(1, Math.max(0, f.t) / f.dur));
      this.target.lerpVectors(f.from.target, f.to.target, k);
      // 距离按对数插值：从 9 km 落到 1 km 时速度感更均匀
      this.distance = Math.exp(Math.log(f.from.distance) + (Math.log(f.to.distance) - Math.log(f.from.distance)) * k);
      this.tilt = f.from.tilt + (f.to.tilt - f.from.tilt) * k;
      const dh = wrapDeg(f.to.heading - f.from.heading);
      this.heading = wrapDeg(f.from.heading + dh * k);
      if (f.t >= f.dur) this.flight = null;
    } else if (this.follow) {
      const k = 1 - Math.exp(-dt / 0.6);
      this.target.x += (this.follow.x - this.target.x) * k;
      this.target.z += (this.follow.z - this.target.z) * k;
    }
    this.apply(this.camera, this.target, this.distance, this.tilt, this.heading, true);
  }

  /** 由状态计算相机姿态。live=false 时用于拟合计算，不加震屏 */
  private apply(cam: THREE.PerspectiveCamera, target: THREE.Vector3, distance: number, tilt: number, heading: number, live: boolean): void {
    const b = this.overviewBlend(distance);
    const t = this._t.lerpVectors(target, this.overviewCenter, b);
    const tl = tilt + (TILT_MAX - tilt) * b;
    if (live) {
      this.effTarget.copy(t);
      this.effTilt = tl;
    }
    const h = heading * DEG;
    const e = tl * DEG;
    cam.position.set(t.x - Math.sin(h) * Math.cos(e) * distance, t.y + Math.sin(e) * distance, t.z + Math.cos(h) * Math.cos(e) * distance);
    cam.up.set(0, 1, 0);
    cam.lookAt(t);
    cam.near = Math.max(2, distance * 0.035);
    cam.far = distance * 8 + 9000;
    if (live) {
      if (this.trauma > 0) {
        this.trauma = Math.max(0, this.trauma - FEEL.shake.decay * this.frameDt);
        const s = this.trauma * this.trauma;
        // 偏移按「角度」给：同样的 trauma 在任何缩放下震出来的屏幕像素都一样
        const off = distance * Math.tan(FEEL.shake.maxAngle) * s;
        const t = this.time;
        // 沿相机自己的右 / 上轴平移：画面整体错动，而不是一部分变成推拉（沿视线方向的分量看不出来）
        this._v.set(1, 0, 0).applyQuaternion(cam.quaternion);
        this._p.set(0, 1, 0).applyQuaternion(cam.quaternion);
        cam.position.addScaledVector(this._v, off * shakeWave(t, 1)).addScaledVector(this._p, off * shakeWave(t, 2));
        cam.rotateZ(FEEL.shake.maxRoll * s * shakeWave(t, 3));
      }
      cam.fov = this.baseFov + this.fovOffset;
    } else {
      cam.fov = this.baseFov;
    }
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
  }

  /**
   * 拟合距离：给定焦点、俯仰、若干航向，求让所有点都落在安全框内的最小距离（二分）。
   * 安全框避开顶部 HUD 与底部按钮 / 卡片。
   */
  fitDistance(center: THREE.Vector3, points: THREE.Vector3[], tilt: number, headings: number[], margins: FitMargins, ignoreOverview = true): number {
    if (points.length === 0) return DIST_MIN;
    const saveMax = this.maxDistance;
    if (ignoreOverview) this.maxDistance = Infinity; // 拟合时不要让总览混合干扰
    const fits = (d: number, heading: number): boolean => {
      this.apply(this.scratch, center, d, tilt, heading, false);
      for (const p of points) {
        this._v.copy(p).applyMatrix4(this.scratch.matrixWorldInverse);
        if (this._v.z > -1) return false;
        this._p.copy(this._v).applyMatrix4(this.scratch.projectionMatrix);
        if (Math.abs(this._p.x) > margins.x || this._p.y > margins.yTop || this._p.y < -margins.yBottom) return false;
      }
      return true;
    };
    let worst = DIST_MIN;
    for (const heading of headings) {
      let lo = DIST_MIN;
      let hi = 80000;
      if (fits(lo, heading)) continue;
      for (let i = 0; i < 26; i++) {
        const mid = Math.sqrt(lo * hi);
        if (fits(mid, heading)) hi = mid;
        else lo = mid;
      }
      worst = Math.max(worst, hi);
    }
    this.maxDistance = saveMax;
    return worst;
  }

  /** 调试读数 */
  snapshot(): { position: THREE.Vector3; target: THREE.Vector3; tilt: number; heading: number; zoom: number } {
    return { position: this.camera.position, target: this.effTarget, tilt: this.effTilt, heading: wrapDeg(this.heading), zoom: this.distance };
  }
}
