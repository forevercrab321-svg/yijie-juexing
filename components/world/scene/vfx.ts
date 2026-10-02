/**
 * 事件驱动的特效（指南 5.5 事件特效、5.9 飘浮光点）：接取冲击（pulse）、完成收拢（seal）、升级庆祝（celebrate）、
 * 角色出场的尘雾（puff）、环境光点（白天像花粉、夜里像萤火虫）。
 *
 * 每种特效只有一个网格、复用几何与材质，演出期间才可见，不演出时不占 draw call（光点除外，常驻 1 个）。
 * 冲击环与完成收拢共用一个网格：接取与结算不会同时发生，真撞上了就让后来的覆盖先来的。
 *
 * 时间线（强度与时长见 feel.ts）：
 *  - pulse：顿帧期间底座一团白光 → 松开后类型色的两道环向外扩散 1.1 s + 一把类型色 / 白 / 暖黄的星形纸屑。
 *  - seal：一道灰蓝的环从外向内收拢到底座，收到底时一闪（0.6 s）。
 *  - celebrate：蓄力（与结算卡记账同步）：脚下一圈暖黄星环亮起、纸屑螺旋汇聚；
 *      → 高潮那一拍（顿帧）：纸屑聚成一团、星环最亮；
 *      → 松开：sun / teal / envoy 三色星形纸屑炸开并飘落、星环升起减速旋转、暖黄环波扫过全屏，2.2 s 内收尾。
 *    纸屑、星环不做深度测试：结算时角色常被楼挡住，而这是整局最重要的一刻。
 *    减少动态效果：没有蓄力、顿帧与纸屑，星环原地淡入淡出（「升级了」这件事照样看得见）。
 * 颜色都用预乘 alpha 叠在画面上，不用加法混合：明亮的白天里加法会把一切冲成白色。
 */
import * as THREE from 'three';
import { mulberry32 } from './city';
import { FEEL, easeOutCubic } from './feel';
import { UI } from './palette';

const OUTPUT = /* glsl */ `
#include <colorspace_fragment>
`;

// 模式 0：两道环向外扩散（外环先走、内环晚 0.15 拍）；模式 1：一道环向内收拢。uFlash 是中心的一团白光
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
    float w = 0.03 + 0.04 * (1.0 - p);
    k = (ring(r, p, w, aa) + 0.7 * ring(r, max(p - 0.15, 0.0) * 1.1, w, aa)) * (1.0 - smoothstep(0.5, 1.0, p));
  } else {
    k = ring(r, 1.0 - p, 0.05, aa) * smoothstep(0.0, 0.3, p) * (0.5 + p);
  }
  float flash = uFlash * exp(-r * r * 14.0);
  float a = clamp(k * 0.9 + flash, 0.0, 1.0);
  vec3 col = mix(uColor, vec3(1.0), clamp(flash * 1.5, 0.0, 1.0));
  if (a < 0.003) discard;
  gl_FragColor = vec4(col * a, a);
  ${OUTPUT}
}`;

const VUV_VERT = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }';

/** 五角星的有符号距离近似（gl_PointCoord 空间），纸屑用 */
const STAR_GLSL = /* glsl */ `
float yjStar(vec2 p, float spin) {
  float a = atan(p.y, p.x) + spin;
  float r = length(p);
  float k = cos(floor(0.5 + a * 0.7958) * 1.2566 - a);
  return r * (0.62 + 0.38 * k) - 0.42;
}`;

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

interface Confetti {
  t: number;
  dur: number;
}

/** 升级演出从高潮松开到收尾的时长 */
const CELEBRATE_TAIL = 2.2;
const SUN = new THREE.Color(UI.sun400);
const TEAL = new THREE.Color(UI.teal400);
const ENVOY = new THREE.Color(UI.envoy400);
const WHITE = new THREE.Color('#ffffff');

export class VfxSystem {
  readonly group = new THREE.Group();
  private readonly shockwave: THREE.Mesh;
  private readonly shockMat: THREE.ShaderMaterial;
  private shock: Shock | null = null;

  private readonly starRing: THREE.Mesh;
  private readonly starRingMat: THREE.ShaderMaterial;
  private readonly burst: THREE.Points;
  private readonly burstMat: THREE.ShaderMaterial;
  private cel: Celebration | null = null;
  private confetti: Confetti | null = null;
  /** 精度圈的增益（升级蓄力与高潮时变亮），引擎每帧转给 PlayerAvatar */
  glow = 0;

  private readonly puff: THREE.Points;
  private readonly puffMat: THREE.ShaderMaterial;
  private puffT = -1;

  private readonly motes: THREE.Points;
  private readonly motesMat: THREE.ShaderMaterial;
  private readonly geos: THREE.BufferGeometry[] = [];

  constructor(time: THREE.IUniform, night: THREE.IUniform, motesCount: number) {
    this.group.name = 'vfx';
    const flat = new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2);
    this.geos.push(flat);
    this.shockMat = new THREE.ShaderMaterial({
      uniforms: { uProgress: { value: 0 }, uFlash: { value: 0 }, uMode: { value: 0 }, uColor: { value: SUN.clone() } },
      vertexShader: VUV_VERT,
      fragmentShader: RING_FRAG,
      transparent: true,
      premultipliedAlpha: true,
      depthWrite: false,
      depthTest: false,
      fog: false,
    });
    this.shockwave = new THREE.Mesh(flat, this.shockMat);
    this.shockwave.name = 'shockwave';
    this.shockwave.visible = false;
    this.shockwave.renderOrder = 15;
    this.shockwave.frustumCulled = false;

    // 星环：脚下一圈暖黄的小星星（12 颗），蓄力时亮起、松开时升起旋转
    this.starRingMat = new THREE.ShaderMaterial({
      uniforms: { uAlpha: { value: 0 }, uSun: { value: SUN.clone() } },
      vertexShader: VUV_VERT,
      fragmentShader: /* glsl */ `
uniform float uAlpha;
uniform vec3 uSun;
varying vec2 vUv;
${STAR_GLSL}
void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float r = length(p);
  if (r > 1.0) discard;
  float aa = fwidth(r) * 1.5;
  float ang = atan(p.y, p.x);
  float cell = floor((ang / 6.28318 + 0.5) * 12.0);
  float ca = (cell + 0.5) / 12.0 * 6.28318 - 3.14159;
  vec2 c = vec2(cos(ca), sin(ca)) * 0.82;
  float d = yjStar((p - c) / 0.13, 0.0);
  float star = 1.0 - smoothstep(-0.04, 0.04, d);
  float band = smoothstep(0.62 - aa, 0.64, r) * (1.0 - smoothstep(0.66, 0.68 + aa, r)) * 0.55;
  float a = max(star, band) * uAlpha;
  if (a < 0.003) discard;
  gl_FragColor = vec4(mix(uSun, vec3(1.0), star * 0.25) * a, a);
  ${OUTPUT}
}`,
      transparent: true,
      premultipliedAlpha: true,
      depthWrite: false,
      depthTest: false,
      side: THREE.DoubleSide,
      fog: false,
    });
    this.starRing = new THREE.Mesh(flat, this.starRingMat);
    this.starRing.visible = false;
    this.starRing.renderOrder = 16;
    this.starRing.frustumCulled = false;

    // 星形纸屑：种子随机，同一帧截图每次都一样，视觉回归可比
    const rand = mulberry32(7);
    const N = 90;
    const seeds = new Float32Array(N * 4);
    for (let i = 0; i < N; i++) {
      seeds[i * 4] = rand() * Math.PI * 2;
      seeds[i * 4 + 1] = 0.5 + rand() * 0.5;
      seeds[i * 4 + 2] = rand();
      seeds[i * 4 + 3] = Math.floor(rand() * 3);
    }
    const burstGeo = new THREE.BufferGeometry();
    burstGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    burstGeo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4));
    this.geos.push(burstGeo);
    // uProgress < 0：蓄力，纸屑沿螺线向中心汇聚（−1 → 0）；≥ 0：炸开并在重力下飘落
    this.burstMat = new THREE.ShaderMaterial({
      uniforms: {
        uProgress: { value: 0 },
        uScale: { value: 100 },
        uPixel: { value: 1 },
        uC0: { value: SUN.clone() },
        uC1: { value: TEAL.clone() },
        uC2: { value: ENVOY.clone() },
      },
      vertexShader: /* glsl */ `
attribute vec4 aSeed;
uniform float uProgress;
uniform float uScale;
uniform float uPixel;
uniform vec3 uC0;
uniform vec3 uC1;
uniform vec3 uC2;
varying float vA;
varying vec3 vC;
varying float vSpin;
void main() {
  float p = uProgress;
  vec3 pos;
  if (p < 0.0) {
    float q = -p;
    float ang = aSeed.x + q * 5.0;
    float rr = q * uScale * (0.7 + 0.6 * aSeed.y);
    pos = vec3(cos(ang) * rr, uScale * (0.06 + 0.3 * aSeed.z * q), sin(ang) * rr);
    vA = pow(1.0 - q, 1.5);
  } else {
    float rr = p * aSeed.y * uScale * 1.1;
    pos = vec3(cos(aSeed.x) * rr, (p * 2.2 - p * p * 1.8) * aSeed.y * uScale + aSeed.z * uScale * 0.2, sin(aSeed.x) * rr);
    pos.x += sin(p * 9.0 + aSeed.z * 6.0) * uScale * 0.05 * p;
    vA = 1.0 - smoothstep(0.55, 1.0, p);
  }
  vC = aSeed.w < 0.5 ? uC0 : (aSeed.w < 1.5 ? uC1 : uC2);
  vSpin = aSeed.z * 6.28 + p * (4.0 + aSeed.y * 6.0);
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = clamp(uScale * 0.18 * uPixel * 300.0 / max(-mv.z, 1.0), 10.0 * uPixel, 34.0 * uPixel);
}`,
      fragmentShader: /* glsl */ `
varying float vA;
varying vec3 vC;
varying float vSpin;
${STAR_GLSL}
void main() {
  vec2 p = (gl_PointCoord - 0.5) * 2.0;
  float d = yjStar(p, vSpin);
  float a = (1.0 - smoothstep(-0.06, 0.06, d)) * vA;
  if (a < 0.01) discard;
  gl_FragColor = vec4(vC * a, a);
  ${OUTPUT}
}`,
      transparent: true,
      premultipliedAlpha: true,
      depthWrite: false,
      depthTest: false,
      fog: false,
    });
    this.burst = new THREE.Points(burstGeo, this.burstMat);
    this.burst.visible = false;
    this.burst.frustumCulled = false;
    this.burst.renderOrder = 17;

    // 出场尘雾：一小团白色的软圆点，向外散开、略微上浮后淡出（0.5 s）
    const P = 12;
    const puffSeeds = new Float32Array(P * 3);
    for (let i = 0; i < P; i++) {
      puffSeeds[i * 3] = (i / P) * Math.PI * 2 + rand() * 0.4;
      puffSeeds[i * 3 + 1] = 0.6 + rand() * 0.4;
      puffSeeds[i * 3 + 2] = rand();
    }
    const puffGeo = new THREE.BufferGeometry();
    puffGeo.setAttribute('position', new THREE.BufferAttribute(puffSeeds, 3));
    this.geos.push(puffGeo);
    this.puffMat = new THREE.ShaderMaterial({
      uniforms: { uT: { value: 0 }, uScale: { value: 30 }, uPixel: { value: 1 } },
      vertexShader: /* glsl */ `
uniform float uT;
uniform float uScale;
uniform float uPixel;
varying float vA;
void main() {
  vec3 s = position;
  float e = 1.0 - pow(1.0 - uT, 3.0);
  vec3 pos = vec3(cos(s.x) * s.y * uScale * 0.5 * e, uScale * (0.05 + 0.12 * e * s.z), sin(s.x) * s.y * uScale * 0.5 * e);
  vA = (1.0 - uT) * 0.85;
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = clamp(uScale * (0.25 + 0.2 * e) * uPixel * 300.0 / max(-mv.z, 1.0), 3.0, 40.0 * uPixel);
}`,
      fragmentShader: /* glsl */ `
varying float vA;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float a = (1.0 - smoothstep(0.55, 1.0, d)) * vA;
  if (a < 0.01) discard;
  gl_FragColor = vec4(vec3(a), a);
  ${OUTPUT}
}`,
      transparent: true,
      premultipliedAlpha: true,
      depthWrite: false,
      fog: false,
    });
    this.puff = new THREE.Points(puffGeo, this.puffMat);
    this.puff.visible = false;
    this.puff.frustumCulled = false;
    this.puff.renderOrder = 8;

    // 环境光点：玩家（或焦点）周围 150 m 内缓慢上升并淡出；白天 #FFF6C8 像花粉，夜里 #FFE38A 像萤火虫。拉远时淡出
    const M = Math.max(1, motesCount);
    const mp = new Float32Array(M * 3);
    for (let i = 0; i < M; i++) {
      const a = rand() * Math.PI * 2;
      const r = Math.sqrt(rand());
      mp[i * 3] = Math.cos(a) * r;
      mp[i * 3 + 1] = rand();
      mp[i * 3 + 2] = Math.sin(a) * r;
    }
    const moteGeo = new THREE.BufferGeometry();
    moteGeo.setAttribute('position', new THREE.BufferAttribute(mp, 3));
    this.geos.push(moteGeo);
    this.motesMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: time,
        uNight: night,
        uCenter: { value: new THREE.Vector3() },
        uSpan: { value: 150 },
        uFade: { value: 1 },
        uPixel: { value: 1 },
        uDay: { value: new THREE.Color('#FFF6C8') },
        uNightC: { value: new THREE.Color('#FFE38A') },
      },
      vertexShader: /* glsl */ `
uniform float uTime;
uniform vec3 uCenter;
uniform float uSpan;
uniform float uPixel;
varying float vA;
void main() {
  vec3 p = position;
  float y = fract(p.y + uTime * 0.03);
  vec3 w = uCenter + vec3(p.x * uSpan, 4.0 + y * uSpan * 0.35, p.z * uSpan);
  w.x += sin(uTime * 0.4 + p.z * 9.0) * uSpan * 0.03;
  w.z += cos(uTime * 0.33 + p.x * 7.0) * uSpan * 0.03;
  vec4 mv = viewMatrix * vec4(w, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = clamp(uSpan * 0.05 * uPixel * 300.0 / max(-mv.z, 1.0), 2.0 * uPixel, 7.0 * uPixel);
  vA = smoothstep(0.0, 0.2, y) * (1.0 - smoothstep(0.7, 1.0, y));
}`,
      fragmentShader: /* glsl */ `
uniform float uNight;
uniform float uFade;
uniform vec3 uDay;
uniform vec3 uNightC;
varying float vA;
void main() {
  float d = length(gl_PointCoord - 0.5) * 2.0;
  float a = (1.0 - smoothstep(0.35, 1.0, d)) * vA * uFade * mix(0.5, 1.0, uNight);
  if (a < 0.01) discard;
  vec3 c = mix(uDay, uNightC, uNight);
  gl_FragColor = vec4(c * a, a * (1.0 - uNight));
  ${OUTPUT}
}`,
      transparent: true,
      premultipliedAlpha: true,
      depthWrite: false,
      fog: false,
    });
    this.motes = new THREE.Points(moteGeo, this.motesMat);
    this.motes.frustumCulled = false;
    this.motes.renderOrder = 7;

    this.group.add(this.shockwave, this.starRing, this.burst, this.puff, this.motes);
  }

  /** 预热：所有特效网格可见，但参数停在「完全看不见」——画了等于没画，只为编译着色器与上传几何 */
  setPrewarm(on: boolean): void {
    if (on) {
      this.shockMat.uniforms.uProgress.value = 1;
      this.shockMat.uniforms.uFlash.value = 0;
      this.starRingMat.uniforms.uAlpha.value = 0;
      this.burstMat.uniforms.uProgress.value = 1;
      this.puffMat.uniforms.uT.value = 1;
      this.shockwave.visible = this.starRing.visible = this.burst.visible = this.puff.visible = true;
    } else {
      this.shockwave.visible = this.shock !== null;
      this.starRing.visible = this.cel !== null;
      this.burst.visible = this.cel !== null || this.confetti !== null;
      this.puff.visible = this.puffT >= 0;
    }
  }

  setPixelRatio(dpr: number): void {
    this.burstMat.uniforms.uPixel.value = dpr;
    this.motesMat.uniforms.uPixel.value = dpr;
    this.puffMat.uniforms.uPixel.value = dpr;
  }

  /** 减少动态效果时光点整个关掉（指南 5.9） */
  setMotesEnabled(on: boolean): void {
    this.motes.visible = on;
  }

  private startShock(at: THREE.Vector3, color: THREE.Color, shock: Shock): void {
    this.shock = shock;
    this.shockwave.position.set(at.x, at.y + 2, at.z);
    (this.shockMat.uniforms.uColor.value as THREE.Color).copy(color);
    this.shockMat.uniforms.uMode.value = shock.mode;
    this.shockwave.visible = true;
  }

  /** 接取冲击：类型色的扩散环 + 一把纸屑（类型色 / 白 / 暖黄）。hold：顿帧时长，这段时间里只有底座的一团白光 */
  pulse(at: THREE.Vector3, color: THREE.Color, camDist: number, hold = 0): void {
    this.startShock(at, color, { t: -hold, dur: 1.1, mode: 0, size: Math.max(260, camDist * 0.45) });
    if (this.cel) return;
    const s = Math.max(40, camDist * 0.07);
    this.burst.position.set(at.x, at.y + s * 0.6, at.z);
    this.burstMat.uniforms.uScale.value = s;
    (this.burstMat.uniforms.uC0.value as THREE.Color).copy(color);
    (this.burstMat.uniforms.uC1.value as THREE.Color).copy(WHITE);
    (this.burstMat.uniforms.uC2.value as THREE.Color).copy(SUN);
    this.burstMat.uniforms.uProgress.value = 0;
    this.confetti = { t: -hold, dur: 1.1 };
    this.burst.visible = true;
  }

  /** 完成：一道环从外向内收拢到底座 */
  seal(at: THREE.Vector3, color: THREE.Color, camDist: number): void {
    this.startShock(at, color, { t: 0, dur: FEEL.seal.dur, mode: 1, size: Math.max(120, camDist * 0.2) });
  }

  /** 出场 / 回到我：脚下一小团白色尘雾 */
  spawnPuff(at: THREE.Vector3, height: number): void {
    this.puff.position.copy(at);
    this.puffMat.uniforms.uScale.value = height * 1.3;
    this.puffMat.uniforms.uT.value = 0;
    this.puffT = 0;
    this.puff.visible = true;
  }

  /** 升级。lead：蓄力时长（与结算卡的升级拍对齐）；reduced：减少动态效果 */
  celebrate(at: THREE.Vector3, camDist: number, lead: number, reduced: boolean): void {
    const s = Math.max(50, camDist * 0.08);
    this.cel = { t: 0, lead: reduced ? 0 : lead, hold: reduced ? 0 : FEEL.celebrate.hitStop, reduced, at: at.clone(), s, camDist, waveFired: false };
    this.confetti = null;
    this.starRing.position.set(at.x, at.y + 2, at.z);
    this.starRing.scale.setScalar(s * 1.5);
    this.burst.position.set(at.x, at.y, at.z);
    this.burstMat.uniforms.uScale.value = s * 2.2;
    (this.burstMat.uniforms.uC0.value as THREE.Color).copy(SUN);
    (this.burstMat.uniforms.uC1.value as THREE.Color).copy(TEAL);
    (this.burstMat.uniforms.uC2.value as THREE.Color).copy(ENVOY);
    this.starRing.visible = true;
    this.burst.visible = !reduced;
    this.starRingMat.uniforms.uAlpha.value = 0;
  }

  /** 冲击环（接取或升级环波）是否正在播放——含顿帧那一段（调试 / 测试用） */
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

  /** center：光点围绕的位置（玩家，或没有玩家时的镜头焦点）；camDist：拉远时光点淡出 */
  update(dt: number, center: THREE.Vector3, camDist: number): void {
    const sh = this.shock;
    if (sh) {
      sh.t += dt;
      const u = this.shockMat.uniforms;
      if (sh.t >= sh.dur) {
        this.shock = null;
        this.shockwave.visible = false;
      } else if (sh.mode === 0) {
        const e = 1 - Math.pow(1 - Math.max(0, sh.t) / sh.dur, 2.2);
        u.uProgress.value = e;
        u.uFlash.value = sh.t < 0 ? 1 : Math.max(0, 1 - sh.t / 0.12);
        const s = 30 + sh.size * Math.max(e, 0.12);
        this.shockwave.scale.set(s, 1, s);
      } else {
        const p = sh.t / sh.dur;
        u.uProgress.value = Math.min(1, p / 0.7);
        u.uFlash.value = smooth(0.55, 0.7, p) * (1 - smooth(0.7, 1, p));
        this.shockwave.scale.set(sh.size, 1, sh.size);
      }
    }
    const cf = this.confetti;
    if (cf) {
      cf.t += dt;
      this.burstMat.uniforms.uProgress.value = Math.min(1, Math.max(0, cf.t) / cf.dur);
      if (cf.t >= cf.dur) {
        this.confetti = null;
        if (!this.cel) this.burst.visible = false;
      }
    }
    if (this.puffT >= 0) {
      this.puffT += dt / 0.5;
      this.puffMat.uniforms.uT.value = Math.min(1, this.puffT);
      if (this.puffT >= 1) {
        this.puffT = -1;
        this.puff.visible = false;
      }
    }
    this.glow = 0;
    if (this.cel) this.updateCelebration(dt);
    (this.motesMat.uniforms.uCenter.value as THREE.Vector3).copy(center);
    this.motesMat.uniforms.uSpan.value = Math.max(150, camDist * 0.3);
    this.motesMat.uniforms.uFade.value = 1 - smooth(1500, 3500, camDist);
  }

  private updateCelebration(dt: number): void {
    const c = this.cel!;
    c.t += dt;
    const rr = this.starRingMat.uniforms;
    const t = c.t;
    if (c.reduced) {
      // 原地淡入淡出：没有上升、旋转、纸屑与环波
      const a = smooth(0, 0.3, t) * (1 - smooth(1.2, 1.8, t));
      rr.uAlpha.value = a * 0.9;
      this.glow = a;
      if (t >= 1.8) this.endCelebration();
      return;
    }
    if (t < c.lead) {
      // 蓄力：星环从暗到亮、慢慢转；纸屑螺旋汇聚；精度圈跟着变亮
      const k = t / c.lead;
      rr.uAlpha.value = 0.15 + 0.7 * k * k;
      this.starRing.rotation.y += dt * 0.6;
      this.starRing.position.y = c.at.y + 2;
      this.burstMat.uniforms.uProgress.value = -(1 - k);
      this.glow = 0.3 + 0.7 * k * k;
      return;
    }
    const r = t - c.lead;
    if (r < c.hold) {
      // 顿帧：纸屑聚成一团、星环最亮——这是「打中」的那一帧，静止才看得清
      rr.uAlpha.value = 1;
      this.burstMat.uniforms.uProgress.value = 0;
      this.glow = 1.6;
      return;
    }
    const q = (r - c.hold) / CELEBRATE_TAIL;
    if (!c.waveFired) {
      c.waveFired = true;
      // 暖黄环波：尺寸按镜头距离给，保证扫过整个屏幕——结算卡挡住了画面中央，环波在卡片四周都看得见
      this.startShock(c.at, SUN, { t: 0, dur: 1.2, mode: 0, size: Math.max(600, c.camDist * 1.0) });
    }
    if (q >= 1) {
      this.endCelebration();
      return;
    }
    rr.uAlpha.value = 1 - smooth(0.5, 1, q);
    this.starRing.position.y = c.at.y + 2 + easeOutCubic(q * 1.6) * c.s * 1.8;
    this.starRing.rotation.y += dt * (6 * Math.exp(-q * 4) + 0.4);
    this.burstMat.uniforms.uProgress.value = easeOutCubic(q * 1.3);
    this.glow = 1.6 * (1 - smooth(0, 0.6, q));
  }

  private endCelebration(): void {
    this.cel = null;
    this.starRing.visible = this.burst.visible = false;
  }

  dispose(): void {
    for (const g of this.geos) g.dispose();
    this.shockMat.dispose();
    this.starRingMat.dispose();
    this.burstMat.dispose();
    this.puffMat.dispose();
    this.motesMat.dispose();
  }
}
