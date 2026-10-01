/**
 * 委托光柱。
 *
 * 每个委托：一根光柱（叠加混合、向上渐隐、能量带上涌）+ 地面法阵 + 漂浮的类型图钉 + 三枚环绕的符文。
 * 全部委托共用 4 个 InstancedMesh，draw call 与委托数量无关（简报估算的 3×N 在这里是常数 4）。
 *
 * 可读性（简报 P2「从任意角度都能读出：在哪、多远、急不急、适不适合我」）：
 *  - 在哪：光柱高过中城楼群；图钉不做深度测试，被楼挡住也看得见。
 *  - 多远：光柱宽度与图钉按距离做屏幕尺寸补偿，远处的仍然可点，但近处的明显更大。
 *  - 急不急：紧急 = --ember 暖橙 + 菱形图钉 + 心跳节奏 + 外扩涟漪；普通 = --gold + 圆形图钉 + 缓慢呼吸。
 *    形状和动态都不同，不只靠颜色（色弱友好）。
 *  - 适不适合我：等级不足的光柱变暗、图钉换成锁；已完成的换成勾。
 *
 * 拾取：屏幕空间。点到「底座—图钉」线段的像素距离小于半径即命中（触控 30 px、鼠标 20 px），
 * 多个命中时优先离点击点最近的底座，保证 render_game_to_text 报告的 screen 坐标点下去命中的就是它。
 *
 * 手感（参数见 feel.ts）：聚焦走弹簧——选中时过冲约 12% 再落定，取消时临界阻尼、不回弹；
 * 接取时光柱先被压扁再弹长（aKick），完成时沉回地面再以「已完成」的样子长回来。图钉尺寸不参与，拾取不受影响。
 */
import * as THREE from 'three';
import type { Quest } from '../../../types';
import { LandIndex } from './land';
import { project } from './geo';
import { TYPE_GLYPH, GLYPH, RUNE_COLS } from './textures';
import { FEEL, SQUASH_DUR, SEAL_DUR, squashStretch, sealCurve } from './feel';

const _col = new THREE.Color();
const lin = (h: string): [number, number, number] => {
  _col.set(h);
  return [_col.r, _col.g, _col.b];
};
const COLORS = {
  gold: lin('#c9a961'),
  ember: lin('#c87a45'),
  goldBright: lin('#e8cf94'),
  done: lin('#9e9480'),
};

export interface Beacon {
  id: string;
  quest: Quest;
  pos: THREE.Vector3;
  onLand: boolean;
  urgent: boolean;
  glyph: number;
  focus: number;
  focusTarget: number;
  active: boolean;
  completed: boolean;
  locked: boolean;
  flare: number;
  phase: number;
  /** 聚焦弹簧的速度 */
  focusV: number;
  /** 接取挤压—拉伸 / 完成下沉的计时（秒），−1 = 不在演出 */
  kickT: number;
  kickMode: 'impact' | 'seal';
  /** 光柱高度的相对变化（写进 aKick） */
  kick: number;
}

/** 与着色器里完全相同的屏幕尺寸补偿公式（拾取依赖它们一致） */
export const BEACON_SIZE = {
  pillarW: (camD: number, focus: number, urgent: boolean) => Math.max(26, camD * 0.024) * (1 + 0.35 * focus) * (urgent ? 1.12 : 1),
  pillarH: (camD: number, focus: number) => Math.max(380, camD * 0.1) * (1 + 0.25 * focus),
  pinH: (camD: number) => Math.max(70, camD * 0.062),
  pinS: (camD: number, focus: number) => Math.max(32, camD * 0.04) * (1 + 0.3 * focus),
  ringR: (camD: number, focus: number) => Math.max(55, camD * 0.016) * (1 + 0.3 * focus),
};

// 实例属性：aState = (聚焦 0..1，进行中，变暗，相位)；aMisc = (紧急，图标格，闪光 0..1，约束态 见 constraintOf)；
// 符文的 aRune = (相位，图标格，速度，起始高度)
const COMMON_VERT = /* glsl */ `
attribute vec3 aColor;
attribute vec4 aState;
attribute vec4 aMisc;
uniform float uTime;
uniform float uMotion;
varying vec2 vUv;
varying vec3 vColor;
varying vec4 vState;
varying vec4 vMisc;
`;

const OUTPUT = /* glsl */ `
#include <tonemapping_fragment>
#include <colorspace_fragment>
`;

/*
 * 光柱。注释写在着色器字符串外面：字符串里的注释会原样打进 3D 分包（中文每字 3 字节）。
 *  - 圆柱式公告板：绕竖轴朝向相机。用相机的「右」向量投到水平面，正俯视时也不会退化。
 *  - 能量带向上流：紧急的流得快。节奏：紧急是心跳（两拍一停），普通是缓慢呼吸。
 *  - 核心往同色系的亮色走，而不是往白走：暖橙的紧急光柱不能被冲成粉色。
 *  - aKick：接取时的挤压—拉伸（高度 ×(1+k)、宽度按体积反向）；完成时 k 沉到 −1，光一路变暗收回地面（vDrain）。
 */
function pillarMaterial(uniforms: Record<string, THREE.IUniform>): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `${COMMON_VERT}
attribute float aKick;
varying float vDrain;
void main() {
  vUv = uv; vColor = aColor; vState = aState; vMisc = aMisc;
  vec3 base = instanceMatrix[3].xyz;
  float camD = distance(cameraPosition, base);
  float focus = aState.x;
  float doneW = abs(floor(aMisc.w + 0.5) - 2.0) < 0.5 ? 0.6 : 1.0;
  float W = max(26.0, camD * 0.024) * (1.0 + 0.35 * focus) * (aMisc.x > 0.5 ? 1.12 : 1.0) * (1.0 + 0.6 * aMisc.z) * doneW * (1.0 - 0.35 * clamp(aKick, -0.3, 1.0));
  float H = max(380.0, camD * 0.1) * (1.0 + 0.25 * focus) * max(1.0 + aKick, 0.0);
  vDrain = 1.0 + min(aKick + 0.3, 0.0) * 1.1;
  vec3 camRight = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 right = normalize(vec3(camRight.x, 0.0, camRight.z) + vec3(1e-5, 0.0, 0.0));
  vec3 p = base + right * position.x * W + vec3(0.0, position.y * H, 0.0);
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}`,
    fragmentShader: /* glsl */ `
uniform float uTime;
uniform float uMotion;
varying vec2 vUv;
varying vec3 vColor;
varying vec4 vState;
varying vec4 vMisc;
varying float vDrain;
void main() {
  float x = abs(vUv.x - 0.5) * 2.0;
  float y = vUv.y;
  float urgent = vMisc.x;
  float t = uTime * uMotion;
  float core = exp(-x * x * 16.0);
  float glow = exp(-x * x * 3.0) * 0.75;
  float fade = pow(1.0 - y, 1.25) * smoothstep(0.0, 0.012, y);
  float st = floor(vMisc.w + 0.5);
  float locked = abs(st - 1.0) < 0.5 ? 1.0 : 0.0;
  float done = abs(st - 2.0) < 0.5 ? 1.0 : 0.0;
  float passive = abs(st - 3.0) < 0.5 ? 1.0 : 0.0;
  float flow = (urgent > 0.5 ? 3.4 : 1.5) * (1.0 - locked) * (1.0 - done) * (1.0 - 0.5 * passive);
  float bands = 0.78 + 0.22 * sin((y * 22.0 - t * flow) * 3.14159);
  float beat = urgent > 0.5
    ? 0.72 + 0.28 * max(sin(t * 7.0 + vState.w), 0.0) * (0.6 + 0.4 * step(0.0, sin(t * 1.75 + vState.w)))
    : 0.84 + 0.16 * sin(t * 1.4 + vState.w);
  float focus = vState.x;
  float dim = vState.z;
  float k = (core * 1.7 + glow) * fade * bands * beat * (1.0 + 0.9 * focus + 0.5 * vState.y) * (1.0 - 0.62 * dim) * (1.0 + 1.6 * vMisc.z) * vDrain;
  vec3 base = mix(vColor, vec3(dot(vColor, vec3(0.299, 0.587, 0.114))) * vec3(1.06, 1.0, 0.9), 0.6 * locked);
  vec3 hot = base * vec3(1.25, 1.12, 1.0) + vec3(0.18, 0.14, 0.08);
  vec3 c = mix(base, hot, core * 0.8 * (1.0 - done)) * k * 1.9;
  gl_FragColor = vec4(c, 1.0);
  ${OUTPUT}
}`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    fog: false,
  });
}

/* 地面法阵：外圈（等级不足时断成一段段的封印）、中圈缓慢转动的符文刻度、紧急的外扩涟漪、进行中的四段旋转准星弧。 */
function ringMaterial(uniforms: Record<string, THREE.IUniform>): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `${COMMON_VERT}
attribute float aKick;
void main() {
  vUv = uv; vColor = aColor; vState = aState; vMisc = aMisc;
  vec3 base = instanceMatrix[3].xyz;
  float camD = distance(cameraPosition, base);
  float R = max(55.0, camD * 0.016) * (1.0 + 0.3 * aState.x) * (1.0 + 0.4 * aMisc.z) * (1.0 + 0.35 * max(-aKick, 0.0));
  vec3 p = base + vec3(position.x * R * 2.0, 1.2, position.z * R * 2.0);
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}`,
    fragmentShader: /* glsl */ `
uniform float uTime;
uniform float uMotion;
varying vec2 vUv;
varying vec3 vColor;
varying vec4 vState;
varying vec4 vMisc;
float band(float r, float c, float w, float aa) { return smoothstep(c - w - aa, c - w, r) * (1.0 - smoothstep(c + w, c + w + aa, r)); }
void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float r = length(p);
  if (r > 1.0) discard;
  float t = uTime * uMotion;
  float aa = fwidth(r) * 1.5;
  float ang = atan(p.y, p.x) / 6.28318 + 0.5;
  float st = floor(vMisc.w + 0.5);
  float locked = abs(st - 1.0) < 0.5 ? 1.0 : 0.0;
  float done = abs(st - 2.0) < 0.5 ? 1.0 : 0.0;
  float outer = band(r, 0.93, 0.025, aa) * mix(1.0, step(0.42, fract(ang * 18.0)), locked);
  float ticks = step(0.45, fract(ang * 28.0 + t * 0.04 * (1.0 - locked)));
  float runes = band(r, 0.7, 0.07, aa) * (0.3 + 0.7 * ticks) * (1.0 - done);
  float fill = (1.0 - smoothstep(0.0, 0.66, r)) * 0.16 * (1.0 - done);
  float urgent = vMisc.x;
  float ripple = 0.0;
  if (urgent > 0.5) {
    float rr = fract(t * 0.75 + vState.w);
    ripple = band(r, rr, 0.03, aa) * (1.0 - rr) * 1.4;
  }
  float reticle = 0.0;
  if (vState.y > 0.5) {
    float seg = step(0.62, fract(ang * 4.0 - t * 0.12));
    reticle = band(r, 0.83, 0.03, aa) * seg * 1.6;
  }
  float k = (outer + runes * 0.75 + fill + ripple + reticle) * (1.0 + 1.2 * vState.x) * (1.0 - 0.6 * vState.z) * (1.0 + 1.5 * vMisc.z);
  gl_FragColor = vec4(vColor * k * 1.2, 1.0);
  ${OUTPUT}
}`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
    fog: false,
  });
}

/*
 * 图钉。普通是圆，紧急是菱形：形状本身就能读出「急」。
 * 图标格号经顶点插值后可能是 3.9999 这样的值：先四舍五入再拆行列，
 * 否则第 0 / 4 / 8 / 12 格会偶发取到图集外（紧急救援的十字图标时有时无就是这个原因）。符文着色器同理。
 */
function pinMaterial(uniforms: Record<string, THREE.IUniform>): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `${COMMON_VERT}
void main() {
  vUv = uv; vColor = aColor; vState = aState; vMisc = aMisc;
  vec3 base = instanceMatrix[3].xyz;
  float camD = distance(cameraPosition, base);
  float H = max(70.0, camD * 0.062);
  float S = max(32.0, camD * 0.04) * (1.0 + 0.3 * aState.x);
  float bob = sin(uTime * uMotion * 1.6 + aState.w) * S * 0.08;
  vec4 mv = viewMatrix * vec4(base + vec3(0.0, H + bob, 0.0), 1.0);
  mv.xy += (uv - 0.5) * S;
  gl_Position = projectionMatrix * mv;
}`,
    fragmentShader: /* glsl */ `
uniform sampler2D uAtlas;
varying vec2 vUv;
varying vec3 vColor;
varying vec4 vState;
varying vec4 vMisc;
void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float urgent = vMisc.x;
  float d = urgent > 0.5 ? (abs(p.x) + abs(p.y)) * 0.8 : length(p);
  float aa = fwidth(d) * 1.5;
  float body = 1.0 - smoothstep(0.86 - aa, 0.86, d);
  float rim = smoothstep(0.7 - aa, 0.7, d) * body;
  float glyph = floor(vMisc.y + 0.5);
  vec2 gp = p * (urgent > 0.5 ? 0.6 : 0.7) * 0.5 + 0.5;
  float row = floor((glyph + 0.5) / ${RUNE_COLS}.0);
  float col = glyph - row * ${RUNE_COLS}.0;
  vec2 auv = vec2((col + gp.x) / ${RUNE_COLS}.0, 1.0 - (row + 1.0 - gp.y) / ${RUNE_COLS}.0);
  float g = texture2D(uAtlas, auv).a * step(d, 0.69);
  vec3 bg = vec3(0.045, 0.036, 0.028);
  vec3 parchment = vec3(0.84, 0.78, 0.66);
  vec3 c = mix(bg, vColor * (1.15 + 0.9 * vState.x + 1.2 * vMisc.z), rim);
  c = mix(c, mix(parchment, vColor, 0.3) * 1.25, g);
  float dim = vState.z;
  float halo = (1.0 - smoothstep(0.86, 1.0, d)) * (1.0 - body) * (0.35 + 0.4 * vState.x);
  vec3 outc = c * body * (1.0 - 0.35 * dim) + vColor * halo;
  gl_FragColor = vec4(outc, max(body * (0.95 - 0.3 * dim), halo));
  ${OUTPUT}
}`,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    fog: false,
  });
}

function runeMaterial(uniforms: Record<string, THREE.IUniform>): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `
attribute vec3 aColor;
attribute vec4 aRune;
attribute vec4 aState;
uniform float uTime;
uniform float uMotion;
varying vec2 vUv;
varying vec3 vColor;
varying float vAlpha;
varying float vGlyph;
void main() {
  vUv = uv; vColor = aColor; vGlyph = aRune.y;
  vec3 base = instanceMatrix[3].xyz;
  float camD = distance(cameraPosition, base);
  float W = max(26.0, camD * 0.024);
  float H = max(380.0, camD * 0.1);
  float t = uTime * uMotion;
  float life = fract(aRune.w + t * 0.045 * aRune.z);
  float ang = aRune.x + t * 0.5 * aRune.z;
  float R = W * (2.2 + aState.x);
  vec3 c = base + vec3(cos(ang) * R, (0.06 + life * 0.42) * H, sin(ang) * R);
  float S = max(11.0, camD * 0.011) * (1.0 + 0.4 * aState.x);
  vec4 mv = viewMatrix * vec4(c, 1.0);
  mv.xy += (uv - 0.5) * S;
  vAlpha = smoothstep(0.0, 0.15, life) * (1.0 - smoothstep(0.7, 1.0, life)) * (1.0 - 0.7 * aState.z) * (0.6 + 0.6 * aState.x);
  gl_Position = projectionMatrix * mv;
}`,
    fragmentShader: /* glsl */ `
uniform sampler2D uAtlas;
varying vec2 vUv;
varying vec3 vColor;
varying float vAlpha;
varying float vGlyph;
void main() {
  float glyph = floor(vGlyph + 0.5);
  float row = floor((glyph + 0.5) / ${RUNE_COLS}.0);
  float col = glyph - row * ${RUNE_COLS}.0;
  vec2 auv = vec2((col + vUv.x) / ${RUNE_COLS}.0, 1.0 - (row + 1.0 - vUv.y) / ${RUNE_COLS}.0);
  float g = texture2D(uAtlas, auv).a;
  gl_FragColor = vec4(vColor * g * vAlpha * 1.6, 1.0);
  ${OUTPUT}
}`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
  });
}

const RUNES_PER_BEACON = 3;

export class BeaconSystem {
  readonly group = new THREE.Group();
  beacons: Beacon[] = [];
  private readonly land: LandIndex;
  private readonly uniforms: Record<string, THREE.IUniform>;
  private readonly materials: THREE.ShaderMaterial[];
  private meshes: THREE.InstancedMesh[] = [];
  private attrs: { color: THREE.InstancedBufferAttribute; state: THREE.InstancedBufferAttribute; misc: THREE.InstancedBufferAttribute; kick: THREE.InstancedBufferAttribute } | null = null;
  private reduced = false;
  private runeAttrs: { state: THREE.InstancedBufferAttribute } | null = null;
  private focusedId: string | null = null;
  private activeId: string | null = null;
  private completed = new Set<string>();
  private userLevel: number | null = null;
  private readonly _v = new THREE.Vector3();
  private readonly _h = new THREE.Vector3();

  constructor(land: LandIndex, atlas: THREE.Texture, time: THREE.IUniform) {
    this.land = land;
    this.group.name = 'beacons';
    this.uniforms = { uTime: time, uMotion: { value: 1 }, uAtlas: { value: atlas } };
    this.materials = [pillarMaterial(this.uniforms), ringMaterial(this.uniforms), pinMaterial(this.uniforms), runeMaterial(this.uniforms)];
  }

  setReducedMotion(reduced: boolean): void {
    // 减少动态效果：环境动画放慢到 30%，不取消——光柱的「在呼吸」仍然是状态提示
    this.uniforms.uMotion.value = reduced ? 0.3 : 1;
    // 也不再挤压拉伸与弹簧过冲；亮度闪光保留（它说的是「就是这一根」）
    this.reduced = reduced;
  }

  setQuests(quests: Quest[]): void {
    const prev = new Map(this.beacons.map((b) => [b.id, b]));
    this.beacons = quests.map((q, i) => {
      const xz = project(q.location[0], q.location[1]);
      const surf = this.land.surfaceAt(xz);
      const old = prev.get(q.id);
      return {
        id: q.id,
        quest: q,
        pos: new THREE.Vector3(surf.x, surf.y + 0.6, surf.z),
        onLand: surf.kind !== 'water',
        urgent: !!q.isUrgent,
        glyph: TYPE_GLYPH[q.type] ?? GLYPH.STAR,
        focus: old?.focus ?? 0,
        focusTarget: old?.focusTarget ?? 0,
        active: false,
        completed: false,
        locked: false,
        flare: 0,
        phase: (i * 2.399) % (Math.PI * 2),
        focusV: 0,
        kickT: -1,
        kickMode: 'impact',
        kick: 0,
      };
    });
    this.rebuild();
    this.applyState();
  }

  setState(focusedId: string | null, activeId: string | null, completedIds: readonly string[] | undefined, userLevel: number | undefined): void {
    this.focusedId = focusedId;
    this.activeId = activeId;
    this.completed = new Set(completedIds ?? []);
    this.userLevel = typeof userLevel === 'number' ? userLevel : null;
    this.applyState();
  }

  /** 聚焦（小档）：点中的那一根闪一下；放大的「弹」由聚焦弹簧负责 */
  tap(id: string): Beacon | null {
    const b = this.get(id);
    if (b) b.flare = Math.max(b.flare, FEEL.focus.flare);
    return b;
  }

  /** 接取（中档）：满强度闪光 + 先压扁再拉长（冲击波由 VfxSystem 负责） */
  impact(id: string): Beacon | null {
    const b = this.get(id);
    if (!b) return null;
    b.flare = 1;
    if (!this.reduced) {
      b.kickT = 0;
      b.kickMode = 'impact';
    }
    return b;
  }

  /** 完成：光柱沉回地面，再以「已完成」的样子长回来；法阵随之一亮 */
  seal(id: string): Beacon | null {
    const b = this.get(id);
    if (!b) return null;
    b.flare = Math.max(b.flare, FEEL.seal.flare);
    if (!this.reduced) {
      b.kickT = 0;
      b.kickMode = 'seal';
    }
    return b;
  }

  get(id: string | null | undefined): Beacon | null {
    if (!id) return null;
    return this.beacons.find((b) => b.id === id) ?? null;
  }

  private applyState(): void {
    for (const b of this.beacons) {
      b.focusTarget = b.id === this.focusedId ? 1 : 0;
      b.active = b.id === this.activeId;
      b.completed = this.completed.has(b.id);
      b.locked = this.userLevel !== null && b.quest.minLevel > this.userLevel && !b.completed;
    }
    this.writeAttributes();
  }

  private rebuild(): void {
    for (const m of this.meshes) {
      this.group.remove(m);
      m.geometry.dispose();
      m.dispose();
    }
    this.meshes = [];
    this.attrs = null;
    this.runeAttrs = null;
    const n = this.beacons.length;
    if (n === 0) return;
    const color = new THREE.InstancedBufferAttribute(new Float32Array(n * 3), 3);
    const state = new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4);
    const misc = new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4);
    const kick = new THREE.InstancedBufferAttribute(new Float32Array(n), 1);
    state.setUsage(THREE.DynamicDrawUsage);
    misc.setUsage(THREE.DynamicDrawUsage);
    color.setUsage(THREE.DynamicDrawUsage);
    kick.setUsage(THREE.DynamicDrawUsage);
    this.attrs = { color, state, misc, kick };

    const pillarGeo = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);
    const ringGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    const pinGeo = new THREE.PlaneGeometry(1, 1);
    const names = ['beaconPillars', 'beaconRings', 'beaconPins'];
    [pillarGeo, ringGeo, pinGeo].forEach((geo, k) => {
      geo.setAttribute('aColor', color);
      geo.setAttribute('aState', state);
      geo.setAttribute('aMisc', misc);
      if (k < 2) geo.setAttribute('aKick', kick);
      const mesh = new THREE.InstancedMesh(geo, this.materials[k], n);
      mesh.name = names[k];
      // 实例在着色器里按距离放大，包围球算不准；光柱很少，直接跳过视锥剔除
      mesh.frustumCulled = false;
      mesh.renderOrder = k === 2 ? 20 : 10;
      this.meshes.push(mesh);
      this.group.add(mesh);
    });

    // 漂浮符文：每个光柱 3 枚
    const rn = n * RUNES_PER_BEACON;
    const runeGeo = new THREE.PlaneGeometry(1, 1);
    const rColor = new THREE.InstancedBufferAttribute(new Float32Array(rn * 3), 3);
    const rRune = new THREE.InstancedBufferAttribute(new Float32Array(rn * 4), 4);
    const rState = new THREE.InstancedBufferAttribute(new Float32Array(rn * 4), 4);
    rState.setUsage(THREE.DynamicDrawUsage);
    rColor.setUsage(THREE.DynamicDrawUsage);
    runeGeo.setAttribute('aColor', rColor);
    runeGeo.setAttribute('aRune', rRune);
    runeGeo.setAttribute('aState', rState);
    const runeMesh = new THREE.InstancedMesh(runeGeo, this.materials[3], rn);
    runeMesh.name = 'beaconRunes';
    runeMesh.frustumCulled = false;
    runeMesh.renderOrder = 11;
    this.meshes.push(runeMesh);
    this.group.add(runeMesh);
    this.runeAttrs = { state: rState };

    const m = new THREE.Matrix4();
    this.beacons.forEach((b, i) => {
      m.makeTranslation(b.pos.x, b.pos.y, b.pos.z);
      for (let k = 0; k < 3; k++) this.meshes[k].setMatrixAt(i, m);
      for (let r = 0; r < RUNES_PER_BEACON; r++) {
        const j = i * RUNES_PER_BEACON + r;
        runeMesh.setMatrixAt(j, m);
        rRune.setXYZW(j, b.phase + (r * Math.PI * 2) / RUNES_PER_BEACON, GLYPH.RUNE0 + ((i * 3 + r) % 8), 0.8 + 0.4 * ((r * 7 + i) % 3) / 2, r / RUNES_PER_BEACON);
      }
    });
    for (const mesh of this.meshes) mesh.instanceMatrix.needsUpdate = true;
  }

  private colorOf(b: Beacon): readonly number[] {
    if (b.completed) return COLORS.done;
    if (b.active) return COLORS.goldBright;
    return b.urgent ? COLORS.ember : COLORS.gold;
  }

  /**
   * 约束态（写进 aMisc.w）：0 开放 · 1 等级不足 · 2 已完成 · 3 已有进行中的委托（其余光柱退到次要）。
   * 着色器里各态不只靠变暗区分（色弱友好）：
   *  - 等级不足：光柱褪色成旧金、能量带停住不流；地面法阵外圈断成一段段的「封印」，符文刻度停转。
   *  - 已完成：光柱收细四成、静止、没有热芯；法阵只留一道细外圈，退成地图上的一枚旧标记。
   *  - 已有进行中的委托：其余光柱流速减半、略暗，视线留给进行中的那一根。
   */
  private constraintOf(b: Beacon): number {
    if (b.completed) return 2;
    if (b.locked) return 1;
    return this.activeId !== null && !b.active ? 3 : 0;
  }

  private dimOf(b: Beacon): number {
    return b.completed ? 0.7 : b.locked ? 0.45 : this.activeId !== null && !b.active ? 0.3 : 0;
  }

  private writeAttributes(): void {
    if (!this.attrs) return;
    const { color, state, misc, kick } = this.attrs;
    this.beacons.forEach((b, i) => {
      const c = this.colorOf(b);
      color.setXYZ(i, c[0], c[1], c[2]);
      state.setXYZW(i, b.focus, b.active ? 1 : 0, this.dimOf(b), b.phase);
      const glyph = b.completed ? GLYPH.CHECK : b.locked ? GLYPH.LOCK : b.glyph;
      misc.setXYZW(i, b.urgent && !b.completed ? 1 : 0, glyph, b.flare, this.constraintOf(b));
      kick.setX(i, b.kick);
    });
    color.needsUpdate = true;
    state.needsUpdate = true;
    misc.needsUpdate = true;
    kick.needsUpdate = true;
    if (this.runeAttrs && this.meshes[3]) {
      const rs = this.runeAttrs.state;
      const rc = (this.meshes[3].geometry.getAttribute('aColor') as THREE.InstancedBufferAttribute);
      this.beacons.forEach((b, i) => {
        const c = this.colorOf(b);
        const dim = this.dimOf(b);
        for (let r = 0; r < RUNES_PER_BEACON; r++) {
          const j = i * RUNES_PER_BEACON + r;
          rs.setXYZW(j, b.focus, b.active ? 1 : 0, dim, 0);
          rc.setXYZ(j, c[0], c[1], c[2]);
        }
      });
      rs.needsUpdate = true;
      rc.needsUpdate = true;
    }
  }

  /**
   * 每帧：聚焦弹簧、闪光衰减、挤压拉伸 / 下沉。只有在动画中才重写属性。
   *
   * 聚焦是阻尼弹簧而不是指数逼近：选中时欠阻尼（ζ 0.56，过冲约 12%）——「弹」一下才像被点中了；
   * 取消时临界阻尼，安静地退回去。减少动态效果时两者都是临界阻尼。
   * 慢设备上 dt 可达 1 s，按 1/120 s 分步积分，保证稳定。
   */
  update(dt: number): void {
    let dirty = false;
    const steps = Math.max(1, Math.ceil(dt * 120));
    const h = dt / steps;
    for (const b of this.beacons) {
      if (b.focus !== b.focusTarget || b.focusV !== 0) {
        const rising = b.focusTarget > 0.5 && !this.reduced;
        const w = 2 * Math.PI * (this.reduced ? 3 : rising ? 2.4 : 2.2);
        const z = rising ? 0.56 : 1;
        for (let s = 0; s < steps; s++) {
          b.focusV += (w * w * (b.focusTarget - b.focus) - 2 * z * w * b.focusV) * h;
          b.focus += b.focusV * h;
        }
        if (Math.abs(b.focus - b.focusTarget) < 0.002 && Math.abs(b.focusV) < 0.02) {
          b.focus = b.focusTarget;
          b.focusV = 0;
        }
        dirty = true;
      }
      if (b.flare > 0) {
        b.flare = Math.max(0, b.flare - dt / 1.2);
        dirty = true;
      }
      if (b.kickT >= 0) {
        b.kickT += dt;
        const impact = b.kickMode === 'impact';
        if (b.kickT >= (impact ? FEEL.pulse.hitStop + SQUASH_DUR : SEAL_DUR)) {
          b.kickT = -1;
          b.kick = 0;
        } else b.kick = impact ? squashStretch(b.kickT, FEEL.pulse.hitStop) : sealCurve(b.kickT);
        dirty = true;
      }
    }
    if (dirty) this.writeAttributes();
  }

  /** 调试读数：某根光柱的聚焦值与挤压量 */
  feelOf(id: string | null): { focus: number; kick: number; flare: number } | null {
    const b = this.get(id);
    return b ? { focus: Math.round(b.focus * 1000) / 1000, kick: Math.round(b.kick * 1000) / 1000, flare: Math.round(b.flare * 1000) / 1000 } : null;
  }

  /** 屏幕投影：返回 CSS 像素坐标与是否在相机前方 */
  toScreen(p: THREE.Vector3, camera: THREE.PerspectiveCamera, rect: DOMRect, out: { x: number; y: number; front: boolean }): typeof out {
    this._v.copy(p).applyMatrix4(camera.matrixWorldInverse);
    out.front = this._v.z < 0;
    this._v.applyMatrix4(camera.projectionMatrix);
    out.x = rect.left + ((this._v.x + 1) / 2) * rect.width;
    out.y = rect.top + ((1 - this._v.y) / 2) * rect.height;
    return out;
  }

  /** 屏幕空间拾取：点到「底座—图钉」线段的像素距离 */
  pick(clientX: number, clientY: number, camera: THREE.PerspectiveCamera, rect: DOMRect, radiusPx: number): Beacon | null {
    let best: Beacon | null = null;
    let bestScore = Infinity;
    const sb = { x: 0, y: 0, front: false };
    const sh = { x: 0, y: 0, front: false };
    const pxPerRad = rect.height / (2 * Math.tan((camera.fov * Math.PI) / 360));
    for (const b of this.beacons) {
      const camD = camera.position.distanceTo(b.pos);
      this.toScreen(b.pos, camera, rect, sb);
      this._h.copy(b.pos);
      this._h.y += BEACON_SIZE.pinH(camD);
      this.toScreen(this._h, camera, rect, sh);
      if (!sb.front && !sh.front) continue;
      const pinR = (0.43 * BEACON_SIZE.pinS(camD, b.focus) * pxPerRad) / Math.max(1, camera.position.distanceTo(this._h));
      const sx = sh.x - sb.x;
      const sy = sh.y - sb.y;
      const L2 = sx * sx + sy * sy || 1;
      let t = ((clientX - sb.x) * sx + (clientY - sb.y) * sy) / L2;
      t = Math.max(0, Math.min(1, t));
      const segD = Math.hypot(clientX - (sb.x + sx * t), clientY - (sb.y + sy * t));
      const headD = Math.max(0, Math.hypot(clientX - sh.x, clientY - sh.y) - pinR);
      const d = Math.min(segD, headD);
      if (d > radiusPx) continue;
      const score = d + 0.25 * Math.hypot(clientX - sb.x, clientY - sb.y);
      if (score < bestScore) {
        bestScore = score;
        best = b;
      }
    }
    return best;
  }

  dispose(): void {
    for (const m of this.meshes) {
      m.geometry.dispose();
      m.dispose();
    }
    this.meshes = [];
    for (const mat of this.materials) mat.dispose();
  }
}
