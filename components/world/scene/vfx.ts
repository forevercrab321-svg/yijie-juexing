/**
 * 事件驱动的特效：接取冲击波（pulse）、完成收拢（seal）、升级庆祝（celebrate）、环境浮光。
 *
 * 每种特效只有一个网格、复用几何与材质，演出期间才可见，不演出时不占 draw call。
 * 冲击波、完成收拢与升级环波共用一个网格：接取与结算不会同时发生，真撞上了就让后来的覆盖先来的。
 *
 * 时间线（强度与时长见 feel.ts）：
 *  - pulse：顿帧期间底座一团闪光 → 松开后两道环向外扩散 1.1 s（M3-15：+150 ms 与 +400 ms 都看得到，+1.4 s 前结束）。
 *  - seal：一道环从外向内收拢到底座，收到底时一闪（0.6 s）。
 *  - celebrate：蓄力（与结算卡记账同步）：符文法阵在脚下亮起、光点螺旋汇聚、角色脚下的光圈变亮；
 *      → 高潮那一拍（顿帧）：光柱整根点亮、光点聚成一团；
 *      → 松开：光柱冲天并淡出、法阵升起减速旋转、光点炸开、金色环波扫过全屏，2.2 s 内收尾。
 *    光柱、法阵、光点都不做深度测试：结算时角色常被中城的高楼挡住，而这是整局最重要的一刻。
 *    减少动态效果：没有蓄力、顿帧、光点与环波，光柱与法阵原地淡入淡出（「升级了」这件事照样看得见）。
 */
import * as THREE from 'three';
import { mulberry32 } from './city';
import { FEEL, easeOutCubic } from './feel';

const OUTPUT = /* glsl */ `
#include <tonemapping_fragment>
#include <colorspace_fragment>
`;

// 模式 0：两道环向外扩散（外环先走、内环晚 0.15 拍）；模式 1：一道环向内收拢。uFlash 是中心的一团闪光
const RING_FRAG = /* glsl */ `
uniform float uProgress;
uniform float uFlash;
uniform float uMode;
uniform vec3 uColor;
varying vec2 vUv;
float ring(float r, float c, float w, float aa) { return smoothstep(c - w - aa, c - w * 0.3, r) * (1.0 - smoothstep(c, c + aa, r)); }
void main() {
  float r = length(vUv - 0.5) * 2.0;
  if (r > 1.0) discard;
  float aa = fwidth(r) * 1.5;
  float p = uProgress;
  float k;
  if (uMode < 0.5) {
    float w = 0.035 + 0.05 * (1.0 - p);
    k = (ring(r, p, w, aa) + 0.6 * ring(r, max(p - 0.15, 0.0) * 1.1, w, aa)) * (1.0 - smoothstep(0.55, 1.0, p));
  } else {
    k = ring(r, 1.0 - p, 0.06, aa) * smoothstep(0.0, 0.3, p) * (0.5 + p);
  }
  k += uFlash * exp(-r * r * 12.0) * 1.3;
  gl_FragColor = vec4(uColor * k * 2.2, 1.0);
  ${OUTPUT}
}`;

const VUV_VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';

const GOLD = new THREE.Color('#e8cf94');
const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

interface Shock {
  t: number;
  dur: number;
  mode: 0 | 1;
  size: number;
}

interface Celebration {
  t: number;
  lead: number;
  hold: number;
  reduced: boolean;
  at: THREE.Vector3;
  s: number;
  camDist: number;
  waveFired: boolean;
}

/** 升级演出从高潮松开到收尾的时长 */
const CELEBRATE_TAIL = 2.2;

export class VfxSystem {
  readonly group = new THREE.Group();
  private readonly shockwave: THREE.Mesh;
  private readonly shockMat: THREE.ShaderMaterial;
  private shock: Shock | null = null;

  private readonly column: THREE.Mesh;
  private readonly columnMat: THREE.ShaderMaterial;
  private readonly runeRing: THREE.Mesh;
  private readonly runeRingMat: THREE.ShaderMaterial;
  private readonly burst: THREE.Points;
  private readonly burstMat: THREE.ShaderMaterial;
  private cel: Celebration | null = null;
  /** 角色脚下光圈的增益（升级蓄力与高潮时变亮），引擎每帧转给 PlayerAvatar */
  glow = 0;

  private readonly motes: THREE.Points;
  private readonly motesMat: THREE.ShaderMaterial;
  private readonly geos: THREE.BufferGeometry[] = [];

  constructor(time: THREE.IUniform, night: THREE.IUniform, camDist: THREE.IUniform, atlas: THREE.Texture) {
    this.group.name = 'vfx';
    const flat = new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2);
    this.geos.push(flat);
    this.shockMat = new THREE.ShaderMaterial({
      uniforms: { uProgress: { value: 0 }, uFlash: { value: 0 }, uMode: { value: 0 }, uColor: { value: GOLD.clone() } },
      vertexShader: VUV_VERT,
      fragmentShader: RING_FRAG,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      fog: false,
    });
    this.shockwave = new THREE.Mesh(flat, this.shockMat);
    this.shockwave.name = 'shockwave';
    this.shockwave.visible = false;
    this.shockwave.renderOrder = 15;
    this.shockwave.frustumCulled = false;

    // 升级光柱：绕竖轴朝向相机的面片 + 横向高斯亮度（与委托光柱同一种画法）。
    // 原先是一根实心圆柱，整根一样亮，远看像一截发白的管子；面片还能直接复用上面的平面几何
    this.columnMat = new THREE.ShaderMaterial({
      uniforms: { uAlpha: { value: 0 }, uRise: { value: 1 }, uW: { value: 40 }, uH: { value: 240 }, uT: { value: 0 } },
      vertexShader: /* glsl */ `
uniform float uW;
uniform float uH;
varying vec2 vUv;
void main() {
  vUv = uv;
  vec3 base = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  vec3 cr = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 right = normalize(vec3(cr.x, 0.0, cr.z) + vec3(1e-5, 0.0, 0.0));
  gl_Position = projectionMatrix * viewMatrix * vec4(base + right * (uv.x - 0.5) * uW + vec3(0.0, uv.y * uH, 0.0), 1.0);
}`,
      fragmentShader: /* glsl */ `
uniform float uAlpha;
uniform float uRise;
uniform float uT;
varying vec2 vUv;
void main() {
  float x = abs(vUv.x - 0.5) * 2.0;
  float y = vUv.y;
  float core = exp(-x * x * 18.0);
  float glow = exp(-x * x * 3.5) * 0.55;
  float body = pow(1.0 - y, 0.9) * (1.0 - smoothstep(uRise - 0.12, uRise, y));
  float bands = 0.78 + 0.22 * sin(y * 36.0 - uT * 16.0);
  vec3 c = mix(vec3(0.95, 0.7, 0.36), vec3(1.0, 0.88, 0.66), core);
  gl_FragColor = vec4(c * (core * 1.3 + glow) * body * bands * uAlpha, 1.0);
  ${OUTPUT}
}`,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      fog: false,
    });
    this.column = new THREE.Mesh(flat, this.columnMat);
    this.column.visible = false;
    this.column.renderOrder = 15;
    this.column.frustumCulled = false;

    this.runeRingMat = new THREE.ShaderMaterial({
      uniforms: { uProgress: { value: 0 }, uAlpha: { value: 0 }, uAtlas: { value: atlas } },
      vertexShader: VUV_VERT,
      // 环带里排一圈符文：从图集第 8–15 格取字形
      fragmentShader: /* glsl */ `
uniform float uProgress;
uniform float uAlpha;
uniform sampler2D uAtlas;
varying vec2 vUv;
void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float r = length(p);
  if (r > 1.0) discard;
  float aa = fwidth(r) * 1.5;
  float ang = atan(p.y, p.x) / 6.28318 + 0.5;
  float band = smoothstep(0.72 - aa, 0.74, r) * (1.0 - smoothstep(0.96, 0.98 + aa, r));
  float k = ang * 16.0 + uProgress * 2.0;
  float cell = floor(mod(k, 8.0)) + 8.0;
  vec2 g = vec2(fract(k), (r - 0.74) / 0.22);
  float col = mod(cell, 4.0);
  float row = floor(cell / 4.0);
  float glyph = texture2D(uAtlas, vec2((col + g.x) / 4.0, 1.0 - (row + 1.0 - g.y) / 4.0)).a;
  float edge = smoothstep(0.98 - aa, 0.98, r) * (1.0 - smoothstep(1.0 - aa, 1.0, r));
  gl_FragColor = vec4(vec3(1.0, 0.85, 0.55) * (glyph * band * 1.6 + edge) * uAlpha, 1.0);
  ${OUTPUT}
}`,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      fog: false,
    });
    this.runeRing = new THREE.Mesh(flat, this.runeRingMat);
    this.runeRing.visible = false;
    this.runeRing.renderOrder = 16;
    this.runeRing.frustumCulled = false;

    // 种子随机：同一帧截图每次都一样，视觉回归可比
    const rand = mulberry32(7);
    const N = 90;
    const seeds = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      seeds[i * 3] = rand() * Math.PI * 2;
      seeds[i * 3 + 1] = 0.5 + rand() * 0.5;
      seeds[i * 3 + 2] = rand();
    }
    const burstGeo = new THREE.BufferGeometry();
    burstGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    burstGeo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 3));
    this.geos.push(burstGeo);
    // uProgress < 0：蓄力，光点沿螺线向中心汇聚（−1 → 0）；≥ 0：炸开并在重力下回落
    this.burstMat = new THREE.ShaderMaterial({
      uniforms: { uProgress: { value: 0 }, uScale: { value: 100 }, uPixel: { value: 1 } },
      vertexShader: /* glsl */ `
attribute vec3 aSeed;
uniform float uProgress;
uniform float uScale;
uniform float uPixel;
varying float vA;
void main() {
  float p = uProgress;
  vec3 pos;
  if (p < 0.0) {
    float q = -p;
    float ang = aSeed.x + q * 5.0;
    float rr = q * uScale * (0.7 + 0.6 * aSeed.y);
    pos = vec3(cos(ang) * rr, uScale * (0.04 + 0.3 * aSeed.z * q), sin(ang) * rr);
    vA = pow(1.0 - q, 1.5) * (0.5 + 0.5 * aSeed.z);
  } else {
    float rr = p * aSeed.y * uScale * 1.1;
    pos = vec3(cos(aSeed.x) * rr, (p * 2.2 - p * p * 1.4) * aSeed.y * uScale + aSeed.z * uScale * 0.2, sin(aSeed.x) * rr);
    vA = (1.0 - smoothstep(0.5, 1.0, p)) * (0.6 + 0.4 * aSeed.z);
  }
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = clamp(uScale * 0.09 * uPixel * 300.0 / max(-mv.z, 1.0), 2.0, 26.0);
}`,
      fragmentShader: /* glsl */ `
varying float vA;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float a = pow(max(1.0 - d, 0.0), 2.0) * vA;
  gl_FragColor = vec4(vec3(1.0, 0.84, 0.52) * a * 1.8, 1.0);
  ${OUTPUT}
}`,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      fog: false,
    });
    this.burst = new THREE.Points(burstGeo, this.burstMat);
    this.burst.visible = false;
    this.burst.frustumCulled = false;
    this.burst.renderOrder = 17;

    // 环境浮光：焦点周围缓慢上升的暖色光点，异世界的「空气里有魔素」。拉远到总览时淡出：浮光是近景氛围，铺满整座城就成了满屏噪点
    const M = 220;
    const mp = new Float32Array(M * 3);
    for (let i = 0; i < M; i++) {
      mp[i * 3] = rand() * 2 - 1;
      mp[i * 3 + 1] = rand();
      mp[i * 3 + 2] = rand() * 2 - 1;
    }
    const moteGeo = new THREE.BufferGeometry();
    moteGeo.setAttribute('position', new THREE.BufferAttribute(mp, 3));
    this.geos.push(moteGeo);
    this.motesMat = new THREE.ShaderMaterial({
      uniforms: { uTime: time, uNight: night, uCamDist: camDist, uCenter: { value: new THREE.Vector3() }, uPixel: { value: 1 } },
      vertexShader: /* glsl */ `
uniform float uTime;
uniform float uCamDist;
uniform vec3 uCenter;
uniform float uPixel;
varying float vA;
void main() {
  float span = clamp(uCamDist * 1.6, 600.0, 9000.0);
  vec3 p = position;
  float y = fract(p.y + uTime * 0.012);
  vec3 w = uCenter + vec3(p.x * span, 20.0 + y * span * 0.22, p.z * span);
  w.x += sin(uTime * 0.3 + p.z * 9.0) * span * 0.01;
  vec4 mv = viewMatrix * vec4(w, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = clamp(span * 0.005 * uPixel * 900.0 / max(-mv.z, 1.0), 1.5, 7.0);
  vA = smoothstep(0.0, 0.2, y) * (1.0 - smoothstep(0.7, 1.0, y)) * (1.0 - smoothstep(3500.0, 8000.0, uCamDist));
}`,
      fragmentShader: /* glsl */ `
uniform float uNight;
varying float vA;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float a = pow(max(1.0 - d, 0.0), 2.0) * vA * (0.12 + 0.88 * uNight);
  gl_FragColor = vec4(vec3(1.0, 0.8, 0.5) * a, 1.0);
  ${OUTPUT}
}`,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
    });
    this.motes = new THREE.Points(moteGeo, this.motesMat);
    this.motes.frustumCulled = false;
    this.motes.renderOrder = 7;

    this.group.add(this.shockwave, this.column, this.runeRing, this.burst, this.motes);
  }

  /** 预热：所有特效网格可见，但参数停在「完全看不见」——画了等于没画，只为编译着色器与上传几何 */
  setPrewarm(on: boolean): void {
    if (on) {
      this.shockMat.uniforms.uProgress.value = 1;
      this.shockMat.uniforms.uFlash.value = 0;
      this.columnMat.uniforms.uAlpha.value = 0;
      this.runeRingMat.uniforms.uAlpha.value = 0;
      this.burstMat.uniforms.uProgress.value = 1;
      this.shockwave.visible = this.column.visible = this.runeRing.visible = this.burst.visible = true;
    } else {
      this.shockwave.visible = this.shock !== null;
      this.column.visible = this.runeRing.visible = this.burst.visible = this.cel !== null;
    }
  }

  setPixelRatio(dpr: number): void {
    this.burstMat.uniforms.uPixel.value = dpr;
    this.motesMat.uniforms.uPixel.value = dpr;
  }

  private startShock(at: THREE.Vector3, color: THREE.Color, shock: Shock): void {
    this.shock = shock;
    this.shockwave.position.set(at.x, at.y + 2, at.z);
    (this.shockMat.uniforms.uColor.value as THREE.Color).copy(color);
    this.shockMat.uniforms.uMode.value = shock.mode;
    this.shockwave.visible = true;
  }

  /** 接取冲击波。hold：顿帧时长，这段时间里只有底座的一团闪光 */
  pulse(at: THREE.Vector3, color: THREE.Color, camDist: number, hold = 0): void {
    this.startShock(at, color, { t: -hold, dur: 1.1, mode: 0, size: Math.max(420, camDist * 0.55) });
  }

  /** 完成：一道环从外向内收拢到底座 */
  seal(at: THREE.Vector3, color: THREE.Color, camDist: number): void {
    this.startShock(at, color, { t: 0, dur: FEEL.seal.dur, mode: 1, size: Math.max(160, camDist * 0.22) });
  }

  /** 升级。lead：蓄力时长（与结算卡的升级拍对齐）；reduced：减少动态效果 */
  celebrate(at: THREE.Vector3, camDist: number, lead: number, reduced: boolean): void {
    const s = Math.max(60, camDist * 0.09);
    this.cel = { t: 0, lead: reduced ? 0 : lead, hold: reduced ? 0 : FEEL.celebrate.hitStop, reduced, at: at.clone(), s, camDist, waveFired: false };
    this.column.position.set(at.x, at.y, at.z);
    this.columnMat.uniforms.uH.value = s * 4;
    this.columnMat.uniforms.uW.value = s * 0.9;
    this.runeRing.position.set(at.x, at.y + 2, at.z);
    this.runeRing.scale.setScalar(s * 1.6);
    this.burst.position.set(at.x, at.y, at.z);
    this.burstMat.uniforms.uScale.value = s * 2.2;
    this.column.visible = this.runeRing.visible = true;
    this.burst.visible = !reduced;
    this.columnMat.uniforms.uAlpha.value = 0;
    this.runeRingMat.uniforms.uAlpha.value = 0;
  }

  /** 冲击波（接取或升级环波）是否正在播放——含顿帧那一段（调试 / 测试用） */
  get shockwaveActive(): boolean {
    return this.shock !== null && this.shock.mode === 0;
  }

  get sealActive(): boolean {
    return this.shock !== null && this.shock.mode === 1;
  }

  /** 升级演出是否在进行——从收到事件起算，含蓄力段 */
  get celebrateActive(): boolean {
    return this.cel !== null;
  }

  /** 升级演出所处的段落（调试读数） */
  get celebratePhase(): 'charge' | 'climax' | 'release' | null {
    const c = this.cel;
    if (!c) return null;
    if (c.t < c.lead) return 'charge';
    return c.t < c.lead + c.hold ? 'climax' : 'release';
  }

  update(dt: number, center: THREE.Vector3): void {
    const sh = this.shock;
    if (sh) {
      sh.t += dt;
      const u = this.shockMat.uniforms;
      if (sh.t >= sh.dur) {
        this.shock = null;
        this.shockwave.visible = false;
      } else if (sh.mode === 0) {
        // 缓出：开头冲得快，结尾慢慢散；中心闪光在松开后 120 ms 内熄灭
        const e = 1 - Math.pow(1 - Math.max(0, sh.t) / sh.dur, 2.2);
        u.uProgress.value = e;
        u.uFlash.value = sh.t < 0 ? 1 : Math.max(0, 1 - sh.t / 0.12);
        const s = 40 + sh.size * Math.max(e, 0.12);
        this.shockwave.scale.set(s, 1, s);
      } else {
        const p = sh.t / sh.dur;
        u.uProgress.value = Math.min(1, p / 0.7);
        u.uFlash.value = smooth(0.55, 0.7, p) * (1 - smooth(0.7, 1, p));
        this.shockwave.scale.set(sh.size, 1, sh.size);
      }
    }
    this.glow = 0;
    if (this.cel) this.updateCelebration(dt);
    (this.motesMat.uniforms.uCenter.value as THREE.Vector3).copy(center);
  }

  private updateCelebration(dt: number): void {
    const c = this.cel!;
    c.t += dt;
    const col = this.columnMat.uniforms;
    const rr = this.runeRingMat.uniforms;
    const t = c.t;
    col.uT.value = t;
    rr.uProgress.value = t * 0.5;
    if (c.reduced) {
      // 原地淡入淡出：没有上升、旋转、光点与环波
      const a = smooth(0, 0.3, t) * (1 - smooth(1.2, 1.8, t));
      col.uRise.value = 1;
      col.uAlpha.value = a * 0.8;
      rr.uAlpha.value = a * 0.8;
      this.glow = a;
      if (t >= 1.8) this.endCelebration();
      return;
    }
    if (t < c.lead) {
      // 蓄力：法阵从暗到亮、慢慢转；光点螺旋汇聚；角色脚下的光圈跟着变亮
      const k = t / c.lead;
      rr.uAlpha.value = 0.15 + 0.6 * k * k;
      this.runeRing.rotation.y += dt * 0.6;
      this.runeRing.position.y = c.at.y + 2;
      col.uAlpha.value = 0;
      this.burstMat.uniforms.uProgress.value = -(1 - k);
      this.glow = 0.3 + 0.7 * k * k;
      return;
    }
    const r = t - c.lead;
    col.uRise.value = 1;
    if (r < c.hold) {
      // 顿帧：整根光柱瞬间点亮、光点聚成一团——这是「打中」的那一帧，静止才看得清
      col.uAlpha.value = 1.25;
      rr.uAlpha.value = 1.2;
      this.burstMat.uniforms.uProgress.value = 0;
      this.glow = 1.6;
      return;
    }
    const q = (r - c.hold) / CELEBRATE_TAIL;
    if (!c.waveFired) {
      c.waveFired = true;
      // 金色环波：尺寸按镜头距离给，保证扫过整个屏幕——结算卡挡住了画面中央，环波在卡片四周都看得见
      this.startShock(c.at, GOLD, { t: 0, dur: 1.2, mode: 0, size: Math.max(700, c.camDist * 1.0) });
    }
    if (q >= 1) {
      this.endCelebration();
      return;
    }
    col.uAlpha.value = (1 - smooth(0.35, 1, q)) * (1 + 0.25 * (1 - q));
    col.uW.value = c.s * 0.9 * (1 + 0.6 * Math.exp(-q * 8));
    rr.uAlpha.value = 1 - smooth(0.5, 1, q);
    this.runeRing.position.y = c.at.y + 2 + easeOutCubic(q * 1.6) * c.s * 4 * 0.45;
    this.runeRing.rotation.y += dt * (6 * Math.exp(-q * 4) + 0.4);
    this.burstMat.uniforms.uProgress.value = easeOutCubic(q * 1.4);
    this.glow = 1.6 * (1 - smooth(0, 0.6, q));
  }

  private endCelebration(): void {
    this.cel = null;
    this.column.visible = this.runeRing.visible = this.burst.visible = false;
  }

  dispose(): void {
    for (const g of this.geos) g.dispose();
    this.shockMat.dispose();
    this.columnMat.dispose();
    this.runeRingMat.dispose();
    this.burstMat.dispose();
    this.motesMat.dispose();
  }
}
