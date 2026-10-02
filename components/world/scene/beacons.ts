/**
 * 委托标记：自行设计的悬浮徽章（指南 5.5）。自下而上：地面光圈 → 白色细柱 → 悬浮徽章（→ 紧急时头顶「!」气泡）。
 *
 * 全部委托共用 3 个 InstancedMesh（光圈 / 细柱 / 徽章），draw call 与委托数量无关（指南账本 ≤ 5）。
 * 徽章的五种外形、圆章图标、聚焦光晕、进度弧、「!」气泡都在同一个徽章网格里（badgeGeometry.ts）。
 *
 * 尺寸按屏幕像素给（徽章宽 48 px、手机 52 px；细柱 60 px；光圈直径 64 px），在着色器里用 uPx 换算成世界尺寸：
 * 远处的徽章不会缩成看不见的点，近处的也不会糊满屏——GO 式地图上的兴趣点就是这样读的。拾取用同一组公式（BadgeMetrics）。
 *
 * 可读性：类型 = 颜色 + 外形 + 图标（四重编码的前三重，第四重是卡片文字），灰度截图里只看外形也能区分；
 * 紧急 = 「!」气泡 + 挤压拉伸的弹跳 + 双层珊瑚脉冲圈，与类型无关、也不只靠颜色。
 * 徽章不做深度测试（被楼挡住也看得见）：画徽章前清一次深度缓冲，徽章之间仍按深度互相遮挡、自身的厚片也正确。
 * 徽章朝相机的仰角后仰 70%：高俯角（总览）下竖直的厚片会被压扁成一条线，后仰之后正面仍朝着玩家。
 *
 * 手感（feel.ts）：聚焦走弹簧（放大到 1.25×，过冲约 12%），停转并转正对相机；接取时先压扁再弹起（aKick）；
 * 完成时缩没再以「已完成」的样子长回来。减少动态效果：停转停浮、光圈不脉冲、气泡不弹，徽章直接正对相机。
 */
import * as THREE from 'three';
import type { Quest } from '../../../types';
import { LandIndex } from './land';
import { project } from './geo';
import { TYPE_ICON, ICON, ICON_COLS, ICON_ROWS } from './icons';
import { QUEST_TYPES, QUEST_FALLBACK, UI, SHADOW_INK, lin } from './palette';
import { createBadgeGeometry, createPoleGeometry } from './badgeGeometry';
import type { WorldUniforms } from './materials';
import { FEEL, SQUASH_DUR, SEAL_DUR, squashStretch, sealCurve } from './feel';

export interface Beacon {
  id: string;
  quest: Quest;
  pos: THREE.Vector3;
  onLand: boolean;
  urgent: boolean;
  /** 图集格号（委托类型图标） */
  glyph: number;
  /** 外形编号（0 扇贝 · 1 盾 · 2 六边形 · 3 对话气泡 · 4 十字） */
  shape: number;
  /** 类型色（线性）：400 = 徽章底色，600 = 图标色 */
  c400: readonly number[];
  c600: readonly number[];
  focus: number;
  focusTarget: number;
  active: boolean;
  completed: boolean;
  locked: boolean;
  flare: number;
  phase: number;
  /** 聚焦弹簧的速度 */
  focusV: number;
  /** 接取挤压—拉伸 / 完成缩放的计时（秒），−1 = 不在演出 */
  kickT: number;
  kickMode: 'impact' | 'seal';
  /** 徽章尺寸的相对变化（写进 aKick） */
  kick: number;
}

/** 徽章在屏幕上的尺寸（CSS 像素）。手机宽度下徽章大一号，手指好点 */
export const BADGE_PX = { desktop: 48, mobile: 52, pole: 60, ring: 64 } as const;

/** 与着色器完全相同的尺寸公式（拾取依赖它们一致）。px = 该距离上一个 CSS 像素对应的米数 */
export const BadgeMetrics = {
  width: (px: number, badgePx: number, focus: number, done: boolean, flare: number) => badgePx * px * (1 + 0.25 * focus) * (done ? 0.85 : 1) * (1 + 0.12 * flare),
  centerY: (px: number, width: number) => BADGE_PX.pole * px + width * 0.5,
};

// 实例属性：aState = (聚焦 0..1+，进行中，闪光 0..1，相位)；aMisc = (紧急，图标格，约束态，外形)；aKick = 尺寸变化
// 约束态：0 开放 · 1 等级不足 · 2 已完成 · 3 已有进行中的委托（其余徽章退到次要）
const INST_VERT = /* glsl */ `
attribute vec3 aColor;
attribute vec3 aIcon;
attribute vec4 aState;
attribute vec4 aMisc;
attribute float aKick;
uniform float uTime;
uniform float uMotion;
uniform float uPx;
uniform float uBadgePx;
uniform float uPolePx;
float yjBadgeW(float px, float focus, float done, float flare) {
  return uBadgePx * px * (1.0 + 0.25 * focus) * mix(1.0, 0.85, done) * (1.0 + 0.12 * flare);
}
float yjBob(float px, float urgent, float done, float phase) {
  return sin(uTime * uMotion * 6.2832 / (urgent > 0.5 ? 1.6 : 2.4) + phase) * 4.0 * px * (1.0 - done);
}
`;

const OUTPUT = /* glsl */ `
#include <colorspace_fragment>
`;

function badgeMaterial(uniforms: Record<string, THREE.IUniform>): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `${INST_VERT}
attribute float aPart;
attribute float aShape;
varying vec2 vUv;
varying float vPart;
varying vec3 vN;
varying vec3 vV;
varying vec3 vColor;
varying vec3 vIcon;
varying vec4 vState;
varying vec4 vMisc;
void main() {
  vUv = uv; vPart = aPart; vColor = aColor; vIcon = aIcon; vState = aState; vMisc = aMisc;
  float urgent = aMisc.x;
  float st = floor(aMisc.z + 0.5);
  float done = abs(st - 2.0) < 0.5 ? 1.0 : 0.0;
  if ((aShape > -0.5 && abs(aShape - aMisc.w) > 0.5) || (aPart > 4.5 && (urgent < 0.5 || done > 0.5))) {
    gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
    return;
  }
  vec3 base = instanceMatrix[3].xyz;
  float px = distance(cameraPosition, base) * uPx;
  float focus = aState.x;
  float t = uTime * uMotion;
  float W = yjBadgeW(px, focus, done, aState.z);
  vec3 center = base + vec3(0.0, uPolePx * px + W * 0.5 + yjBob(px, urgent, done, aState.w), 0.0);
  vec3 camRight = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
  vec3 camUp = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
  vec3 toCam = normalize(cameraPosition - center);
  vec3 wp;
  vec3 n;
  if (aPart > 3.5) {
    if (aPart < 4.5) {
      wp = center + (camRight * position.x + camUp * position.y) * W * 1.75 - toCam * W * 0.4;
    } else {
      float bt = fract(t / 0.9 + aState.w * 0.13);
      float hop = abs(sin(3.14159 * bt)) * step(0.01, uMotion);
      float sy = mix(0.8, 1.06, smoothstep(0.0, 0.3, hop)) * mix(1.0, 1.0, step(uMotion, 0.01));
      float sx = 1.0 / sqrt(sy);
      float S = W * 0.62;
      vec3 bottom = center + vec3(0.0, W * 0.5 + S * 0.08 + hop * W * 0.18, 0.0);
      wp = bottom + camRight * position.x * S * sx + camUp * (position.y + 0.5) * S * sy;
    }
    n = toCam;
  } else {
    float spin = t * 6.2832 / 7.0 + aState.w * 3.0;
    float face = atan(toCam.x, toCam.z);
    float faceAmt = clamp(max(focus, max(done, 1.0 - uMotion)), 0.0, 1.0);
    float dd = face - spin;
    dd -= 6.2832 * floor((dd + 3.14159) / 6.2832);
    float yaw = spin + dd * faceAmt;
    float k = aKick;
    vec3 lp = position * W * (1.0 + min(k, 0.0) * 0.9);
    lp.y *= 1.0 + max(k, 0.0) * 0.45 + min(k, 0.0) * 0.2;
    lp.x *= 1.0 - max(k, 0.0) * 0.22;
    float c = cos(yaw);
    float s = sin(yaw);
    vec3 rp = vec3(lp.x * c + lp.z * s, lp.y, -lp.x * s + lp.z * c);
    n = vec3(normal.x * c + normal.z * s, normal.y, -normal.x * s + normal.z * c);
    vec3 ax = normalize(vec3(camRight.x, 0.0, camRight.z) + vec3(1e-5, 0.0, 0.0));
    float th = -asin(clamp(toCam.y, 0.0, 1.0)) * 0.7;
    float ct = cos(th);
    float stt = sin(th);
    rp = rp * ct + cross(ax, rp) * stt + ax * dot(ax, rp) * (1.0 - ct);
    n = n * ct + cross(ax, n) * stt + ax * dot(ax, n) * (1.0 - ct);
    wp = center + rp;
  }
  vN = n;
  vV = toCam;
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
}`,
    fragmentShader: /* glsl */ `
uniform sampler2D uAtlas;
uniform float uNight;
uniform float uTime;
uniform vec3 uSunDir;
uniform vec3 uDone;
uniform vec3 uDoneInk;
uniform vec3 uCoral;
varying vec2 vUv;
varying float vPart;
varying vec3 vN;
varying vec3 vV;
varying vec3 vColor;
varying vec3 vIcon;
varying vec4 vState;
varying vec4 vMisc;
float yjIcon(float cell, vec2 uv) {
  float row = floor((cell + 0.5) / ${ICON_COLS}.0);
  float col = cell - row * ${ICON_COLS}.0;
  vec2 g = clamp(uv, 0.0, 1.0);
  return texture2D(uAtlas, vec2((col + g.x) / ${ICON_COLS}.0, 1.0 - (row + 1.0 - g.y) / ${ICON_ROWS}.0)).a;
}
void main() {
  float st = floor(vMisc.z + 0.5);
  float locked = abs(st - 1.0) < 0.5 ? 1.0 : 0.0;
  float done = abs(st - 2.0) < 0.5 ? 1.0 : 0.0;
  float gray = max(locked, done);
  float part = floor(vPart + 0.5);
  if (part == 4.0) {
    vec2 q = vUv * 2.0 - 1.0;
    float r = length(q);
    float aa = fwidth(r) * 1.2;
    float glow = (1.0 - smoothstep(0.32, 1.0, r)) * 0.75 * clamp(vState.x, 0.0, 1.0);
    float ang = atan(q.y, q.x) / 6.2832 + 0.5;
    float ring = smoothstep(0.66 - aa, 0.66, r) * (1.0 - smoothstep(0.74, 0.74 + aa, r));
    float arc = ring * step(fract(ang - uTime * 0.12), 0.7) * step(0.5, vState.y);
    float a = max(glow, arc * 0.95);
    vec3 add = vColor * (1.0 - smoothstep(0.25, 0.95, r)) * 0.5 * uNight * (1.0 - done);
    if (a < 0.01 && dot(add, vec3(1.0)) < 0.01) discard;
    gl_FragColor = vec4(vec3(a) + add, a);
    ${OUTPUT}
    return;
  }
  if (part == 5.0) {
    vec2 q = vUv * 2.0 - 1.0;
    float dc = length(q - vec2(0.0, 0.14));
    float aa = fwidth(dc) * 1.2;
    float tailO = step(-0.98, q.y) * step(q.y, -0.5) * (1.0 - smoothstep((q.y + 0.98) * 0.62 - 0.02, (q.y + 0.98) * 0.62 + 0.02, abs(q.x)));
    float tailI = step(-0.84, q.y) * step(q.y, -0.5) * (1.0 - smoothstep((q.y + 0.84) * 0.5 - 0.02, (q.y + 0.84) * 0.5 + 0.02, abs(q.x)));
    float outer = max(1.0 - smoothstep(0.84 - aa, 0.84 + aa, dc), tailO);
    float inner = max(1.0 - smoothstep(0.68 - aa, 0.68 + aa, dc), tailI);
    if (outer < 0.01) discard;
    float bang = yjIcon(${ICON.BANG}.0, (q - vec2(0.0, 0.14)) / 1.3 + 0.5) * inner;
    vec3 col = mix(vec3(1.0), uCoral, inner);
    col = mix(col, vec3(1.0), bang);
    gl_FragColor = vec4(col * outer, outer);
    ${OUTPUT}
    return;
  }
  vec3 n = normalize(vN);
  float diff = mix(0.86 + 0.14 * max(dot(n, normalize(uSunDir)), 0.0), 0.96, uNight);
  float rim = pow(1.0 - max(dot(n, normalize(vV)), 0.0), 2.5) * 0.3;
  vec3 base;
  if (part == 0.0) {
    base = vec3(1.0);
  } else if (part == 1.0) {
    base = mix(vColor, uDone, gray);
  } else {
    float cell = gray > 0.5 ? (done > 0.5 ? ${ICON.CHECK}.0 : ${ICON.LOCK}.0) : floor(vMisc.y + 0.5);
    float ic = yjIcon(cell, (vUv - 0.5) * 1.08 + 0.5);
    base = mix(vec3(1.0), mix(vIcon, uDoneInk, gray), ic);
  }
  vec3 col = base * diff + rim;
  col = mix(col, vec3(1.0), clamp(vState.z, 0.0, 1.0) * 0.35);
  gl_FragColor = vec4(col, 1.0);
  ${OUTPUT}
}`,
    transparent: true,
    premultipliedAlpha: true,
    depthTest: true,
    depthWrite: true,
    side: THREE.FrontSide,
    fog: false,
  });
}

/* 细柱：白色，顶端 14 px 一段类型色带；聚焦时色带拉长、整体提亮（「细柱上段高亮」）。正常深度测试，会被楼挡住。 */
function poleMaterial(uniforms: Record<string, THREE.IUniform>): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `${INST_VERT}
varying float vFromTop;
varying vec3 vColor;
varying vec3 vN;
varying vec4 vMisc;
varying float vFocus;
void main() {
  vColor = aColor; vMisc = aMisc; vFocus = aState.x;
  float st = floor(aMisc.z + 0.5);
  float done = abs(st - 2.0) < 0.5 ? 1.0 : 0.0;
  vec3 base = instanceMatrix[3].xyz;
  float px = distance(cameraPosition, base) * uPx;
  float W = yjBadgeW(px, aState.x, done, aState.z);
  float top = uPolePx * px + yjBob(px, aMisc.x, done, aState.w) + W * 0.1;
  float r = 2.5 * px;
  vec3 p = base + vec3(position.x * 2.0 * r, position.y * top, position.z * 2.0 * r);
  vFromTop = (1.0 - position.y) * top / px;
  vN = normalize(vec3(position.x, 0.0, position.z));
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}`,
    fragmentShader: /* glsl */ `
uniform vec3 uSunDir;
uniform vec3 uDone;
uniform float uNight;
varying float vFromTop;
varying vec3 vColor;
varying vec3 vN;
varying vec4 vMisc;
varying float vFocus;
void main() {
  float st = floor(vMisc.z + 0.5);
  float gray = (abs(st - 1.0) < 0.5 || abs(st - 2.0) < 0.5) ? 1.0 : 0.0;
  float bandPx = mix(14.0, 22.0, clamp(vFocus, 0.0, 1.0));
  float band = 1.0 - step(bandPx, vFromTop);
  vec3 col = mix(vec3(1.0), mix(vColor, uDone, gray), band);
  float diff = mix(0.8 + 0.2 * max(dot(normalize(vN), normalize(vec3(uSunDir.x, 0.0, uSunDir.z) + 1e-4)), 0.0), 0.95, uNight);
  gl_FragColor = vec4(col * diff * (1.0 + 0.12 * clamp(vFocus, 0.0, 1.0)), 1.0);
  ${OUTPUT}
}`,
    fog: false,
  });
}

/*
 * 地面光圈（预乘 alpha 输出：白天正常叠加，夜里 alpha 打折、读成加法的柔光，一个材质两种混合）：
 * 徽章下的小软影 → 类型色实心圆（45%）+ 外淡圈（22%）→ 1.6 s 一次的脉冲圈（聚焦 1.0 s）→
 * 紧急的双层珊瑚脉冲（1.0 s）→ 进行中的 teal 虚线环慢转。已完成只留软影；等级不足是灰蓝、没有脉冲。
 */
function ringMaterial(uniforms: Record<string, THREE.IUniform>): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `${INST_VERT}
varying vec2 vQ;
varying vec3 vColor;
varying vec4 vState;
varying vec4 vMisc;
void main() {
  vColor = aColor; vState = aState; vMisc = aMisc;
  vec3 base = instanceMatrix[3].xyz;
  float camD = distance(cameraPosition, base);
  float px = camD * uPx * mix(1.0, 0.55, smoothstep(1500.0, 6000.0, camD));
  float R = 84.0;
  vQ = position.xz * 2.0 * R;
  vec3 p = base + vec3(vQ.x * px, 0.8, vQ.y * px);
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}`,
    fragmentShader: /* glsl */ `
uniform float uTime;
uniform float uMotion;
uniform float uNight;
uniform vec3 uDone;
uniform vec3 uTeal;
uniform vec3 uCoralR;
uniform vec3 uInk;
uniform float uOv;
varying vec2 vQ;
varying vec3 vColor;
varying vec4 vState;
varying vec4 vMisc;
float band(float r, float c, float w, float aa) { return smoothstep(c - w - aa, c - w, r) * (1.0 - smoothstep(c + w, c + w + aa, r)); }
void over(inout vec4 acc, vec3 c, float a) { acc.rgb = c * a + acc.rgb * (1.0 - a); acc.a = a + acc.a * (1.0 - a); }
void main() {
  float r = length(vQ);
  float aa = fwidth(r) + 0.35;
  float st = floor(vMisc.z + 0.5);
  float locked = abs(st - 1.0) < 0.5 ? 1.0 : 0.0;
  float done = abs(st - 2.0) < 0.5 ? 1.0 : 0.0;
  float passive = abs(st - 3.0) < 0.5 ? 1.0 : 0.0;
  float focus = clamp(vState.x, 0.0, 1.2);
  float urgent = vMisc.x * (1.0 - done);
  float moving = step(0.01, uMotion) * (1.0 - 0.85 * uOv);
  float t = uTime * uMotion;
  vec3 c = mix(vColor, uDone, max(locked, done));
  vec4 acc = vec4(0.0);
  over(acc, uInk, (1.0 - smoothstep(3.0, 18.0, r)) * 0.2 * (1.0 - uNight));
  over(acc, c, (1.0 - smoothstep(20.0 - aa, 20.0 + aa, r)) * 0.45 * (1.0 + 0.4 * focus) * (1.0 - done));
  over(acc, c, band(r, 28.0, 3.0, aa) * 0.22 * (1.0 + 0.8 * focus) * (1.0 - done) * (1.0 - 0.7 * uOv));
  float per = focus > 0.5 ? 1.0 : 1.6;
  float ph = fract(t / per + vState.w * 0.1);
  over(acc, c, band(r, 32.0 * (1.0 + 1.2 * ph), 2.5, aa) * (1.0 - ph) * 0.75 * (1.0 - locked) * (1.0 - done) * moving * (1.0 - 0.5 * passive));
  float u1 = fract(t + vState.w * 0.1);
  float u2 = fract(t + vState.w * 0.1 + 0.5);
  float up = band(r, 32.0 * (1.0 + 1.2 * u1), 2.5, aa) * (1.0 - u1) + band(r, 32.0 * (1.0 + 1.2 * u2), 2.5, aa) * (1.0 - u2);
  over(acc, uCoralR, min(1.0, up) * 0.85 * urgent * moving);
  over(acc, uCoralR, band(r, 38.0, 2.0, aa) * 0.8 * urgent * (1.0 - moving));
  float ang = atan(vQ.y, vQ.x) / 6.2832 + 0.5;
  float dash = smoothstep(0.42, 0.46, fract(ang * 18.0 - t * 0.08)) * (1.0 - smoothstep(0.92, 0.96, fract(ang * 18.0 - t * 0.08)));
  over(acc, uTeal, band(r, 42.0, 2.6, aa) * dash * step(0.5, vState.y));
  if (acc.a < 0.003) discard;
  gl_FragColor = vec4(acc.rgb, acc.a * (1.0 - 0.6 * uNight));
  ${OUTPUT}
}`,
    transparent: true,
    premultipliedAlpha: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
    fog: false,
  });
}

const COLOR_DONE = lin(UI.done);

export class BeaconSystem {
  readonly group = new THREE.Group();
  beacons: Beacon[] = [];
  private readonly land: LandIndex;
  private readonly uniforms: Record<string, THREE.IUniform>;
  private readonly materials: THREE.ShaderMaterial[];
  private meshes: THREE.InstancedMesh[] = [];
  private readonly badgeGeo: THREE.BufferGeometry;
  private readonly poleGeo: THREE.BufferGeometry;
  private readonly ringGeo: THREE.BufferGeometry;
  private attrs: { color: THREE.InstancedBufferAttribute; icon: THREE.InstancedBufferAttribute; state: THREE.InstancedBufferAttribute; misc: THREE.InstancedBufferAttribute; kick: THREE.InstancedBufferAttribute } | null = null;
  private reduced = false;
  private focusedId: string | null = null;
  private activeId: string | null = null;
  private completed = new Set<string>();
  private userLevel: number | null = null;
  private readonly _v = new THREE.Vector3();
  private readonly _h = new THREE.Vector3();

  constructor(land: LandIndex, atlas: THREE.Texture, world: WorldUniforms) {
    this.land = land;
    this.group.name = 'beacons';
    this.uniforms = {
      uTime: world.uTime,
      uNight: world.uNight,
      uPx: world.uPx,
      uSunDir: world.uSunDir,
      uMotion: { value: 1 },
      // 总览混合系数（0 普通 → 1 完全总览）：拉远时光圈的脉冲与外圈淡掉，十几枚徽章挤在一起时不糊成一团圈
      uOv: { value: 0 },
      uAtlas: { value: atlas },
      uBadgePx: { value: BADGE_PX.desktop },
      uPolePx: { value: BADGE_PX.pole },
      uDone: { value: new THREE.Color(UI.done) },
      uDoneInk: { value: new THREE.Color(UI.doneInk) },
      uCoral: { value: new THREE.Color(UI.coral500) },
      uCoralR: { value: new THREE.Color(UI.coral400) },
      uTeal: { value: new THREE.Color(UI.teal400) },
      uInk: { value: new THREE.Color(SHADOW_INK) },
    };
    this.materials = [ringMaterial(this.uniforms), poleMaterial(this.uniforms), badgeMaterial(this.uniforms)];
    this.badgeGeo = createBadgeGeometry();
    this.poleGeo = createPoleGeometry();
    this.ringGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  }

  /** 总览混合系数（引擎每帧给） */
  setOverview(k: number): void {
    this.uniforms.uOv.value = k;
  }

  /** 视口宽度：手机宽度下徽章 52 px，桌面 48 px */
  setViewport(width: number): void {
    this.uniforms.uBadgePx.value = width < 640 ? BADGE_PX.mobile : BADGE_PX.desktop;
  }

  get badgePx(): number {
    return this.uniforms.uBadgePx.value as number;
  }

  setReducedMotion(reduced: boolean): void {
    // 减少动态效果：停转停浮、光圈不脉冲、气泡不弹（指南 3.8）；状态仍由外形、图标、颜色与静态圈表达
    this.uniforms.uMotion.value = reduced ? 0 : 1;
    this.reduced = reduced;
  }

  setQuests(quests: Quest[]): void {
    const prev = new Map(this.beacons.map((b) => [b.id, b]));
    this.beacons = quests.map((q, i) => {
      const xz = project(q.location[0], q.location[1]);
      const surf = this.land.surfaceAt(xz);
      const old = prev.get(q.id);
      const type = QUEST_TYPES[q.type] ?? QUEST_FALLBACK;
      return {
        id: q.id,
        quest: q,
        pos: new THREE.Vector3(surf.x, surf.y + 0.6, surf.z),
        onLand: surf.kind !== 'water',
        urgent: !!q.isUrgent,
        glyph: TYPE_ICON[q.type] ?? ICON.TRANSPORT,
        shape: type.shape,
        c400: lin(type.c400),
        c600: lin(type.c600),
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

  /** 聚焦（小档）：点中的那一枚闪一下；放大的「弹」由聚焦弹簧负责 */
  tap(id: string): Beacon | null {
    const b = this.get(id);
    if (b) b.flare = Math.max(b.flare, FEEL.focus.flare);
    return b;
  }

  /** 接取（中档）：满强度闪光 + 先压扁再弹起（冲击环与纸屑由 VfxSystem 负责） */
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

  /** 完成：徽章缩没，再以「已完成」（灰蓝 + 白勾、0.85×）的样子长回来 */
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
    const n = this.beacons.length;
    if (n === 0) return;
    const mk = (k: number) => new THREE.InstancedBufferAttribute(new Float32Array(n * k), k).setUsage(THREE.DynamicDrawUsage);
    const color = mk(3);
    const icon = mk(3);
    const state = mk(4);
    const misc = mk(4);
    const kick = mk(1);
    this.attrs = { color, icon, state, misc, kick };
    const names = ['beaconRings', 'beaconPoles', 'beaconBadges'];
    // 几何本身共用；实例属性挂在每个网格自己的几何克隆上（克隆只复制属性引用，不复制顶点数据）
    [this.ringGeo, this.poleGeo, this.badgeGeo].forEach((src, k) => {
      const geo = new THREE.BufferGeometry();
      for (const [name, attr] of Object.entries(src.attributes)) geo.setAttribute(name, attr);
      if (src.index) geo.setIndex(src.index);
      geo.setAttribute('aColor', color);
      geo.setAttribute('aIcon', icon);
      geo.setAttribute('aState', state);
      geo.setAttribute('aMisc', misc);
      geo.setAttribute('aKick', kick);
      const mesh = new THREE.InstancedMesh(geo, this.materials[k], n);
      mesh.name = names[k];
      // 实例在着色器里按屏幕像素放大，包围球算不准；委托很少，直接跳过视锥剔除
      mesh.frustumCulled = false;
      mesh.renderOrder = k === 2 ? 100 : k === 0 ? 9 : 0;
      if (k === 2) {
        // 徽章不做与城市的深度测试：画之前清掉深度缓冲（徽章之间、徽章自身仍正确遮挡）。它是最后一个画的（renderOrder 最大）
        // three 的 clear() 不会打开深度写入掩码：前一个透明材质 depthWrite = false 时 glClear 的深度位会被掩掉、什么也不清，
        // 所以先把掩码打开（状态缓存会在下一个材质绑定时按需恢复）
        mesh.onBeforeRender = (renderer) => {
          renderer.state.buffers.depth.setMask(true);
          renderer.clearDepth();
        };
      }
      this.meshes.push(mesh);
      this.group.add(mesh);
    });
    const m = new THREE.Matrix4();
    this.beacons.forEach((b, i) => {
      m.makeTranslation(b.pos.x, b.pos.y, b.pos.z);
      for (const mesh of this.meshes) mesh.setMatrixAt(i, m);
    });
    for (const mesh of this.meshes) mesh.instanceMatrix.needsUpdate = true;
  }

  private constraintOf(b: Beacon): number {
    if (b.completed) return 2;
    if (b.locked) return 1;
    return this.activeId !== null && !b.active ? 3 : 0;
  }

  private writeAttributes(): void {
    if (!this.attrs) return;
    const { color, icon, state, misc, kick } = this.attrs;
    this.beacons.forEach((b, i) => {
      const c = b.completed ? COLOR_DONE : b.c400;
      const ic = b.c600;
      color.setXYZ(i, c[0], c[1], c[2]);
      icon.setXYZ(i, ic[0], ic[1], ic[2]);
      state.setXYZW(i, b.focus, b.active ? 1 : 0, b.flare, b.phase);
      misc.setXYZW(i, b.urgent && !b.completed ? 1 : 0, b.glyph, this.constraintOf(b), b.shape);
      kick.setX(i, b.kick);
    });
    color.needsUpdate = true;
    icon.needsUpdate = true;
    state.needsUpdate = true;
    misc.needsUpdate = true;
    kick.needsUpdate = true;
  }

  /**
   * 每帧：聚焦弹簧、闪光衰减、挤压拉伸 / 缩放。只有在动画中才重写属性。
   * 聚焦是阻尼弹簧：选中时欠阻尼（ζ 0.56，过冲约 12%）——「弹」一下才像被点中了；取消时临界阻尼，安静地退回去。
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

  /** 调试读数：某枚徽章的聚焦值与挤压量 */
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

  /** 徽章中心的世界坐标（不含浮动），调试与拾取用 */
  badgeCenter(b: Beacon, camera: THREE.PerspectiveCamera, out: THREE.Vector3): THREE.Vector3 {
    const px = camera.position.distanceTo(b.pos) * (this.uniforms.uPx.value as number);
    const w = BadgeMetrics.width(px, this.badgePx, b.focus, b.completed, b.flare);
    return out.copy(b.pos).setY(b.pos.y + BadgeMetrics.centerY(px, w));
  }

  /**
   * 屏幕空间拾取：点到「光圈中心—徽章中心」线段的像素距离，徽章本身按其屏幕半径另算（触控 30 px、鼠标 20 px 容差）。
   * 多个命中时优先离点击点最近的底座，保证 render_game_to_text 报告的 screen 坐标点下去命中的就是它。
   */
  pick(clientX: number, clientY: number, camera: THREE.PerspectiveCamera, rect: DOMRect, radiusPx: number): Beacon | null {
    let best: Beacon | null = null;
    let bestScore = Infinity;
    const sb = { x: 0, y: 0, front: false };
    const sh = { x: 0, y: 0, front: false };
    for (const b of this.beacons) {
      this.toScreen(b.pos, camera, rect, sb);
      this.badgeCenter(b, camera, this._h);
      this.toScreen(this._h, camera, rect, sh);
      if (!sb.front && !sh.front) continue;
      const headR = (this.badgePx * (1 + 0.25 * b.focus) * (b.completed ? 0.85 : 1)) / 2;
      const sx = sh.x - sb.x;
      const sy = sh.y - sb.y;
      const L2 = sx * sx + sy * sy || 1;
      let t = ((clientX - sb.x) * sx + (clientY - sb.y) * sy) / L2;
      t = Math.max(0, Math.min(1, t));
      const segD = Math.hypot(clientX - (sb.x + sx * t), clientY - (sb.y + sy * t));
      const headD = Math.max(0, Math.hypot(clientX - sh.x, clientY - sh.y) - headR);
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
    this.badgeGeo.dispose();
    this.poleGeo.dispose();
    this.ringGeo.dispose();
    for (const mat of this.materials) mat.dispose();
  }
}
