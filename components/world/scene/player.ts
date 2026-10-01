/**
 * 玩家：站在真实 GPS 位置上的风格化角色 + 精度圈 + 通往进行中委托的发光路径。
 *
 * 尺寸：真人 2 m 在城市尺度上看不见。和 Pokémon GO 一样，角色按相机距离保持大致恒定的屏幕高度
 * （桌面约 60 px），精度圈则是真实半径——它表达的是「定位有多准」，不能为了好看放大。
 * 没有定位或不在世界范围内时整个角色组隐藏（简报反支柱：不在纽约却把角色放进城里）。
 */
import * as THREE from 'three';
import { mergeNonIndexed } from './geometry';
import { Race } from '../../../types';

const RACE_TINT: Record<Race, string> = {
  [Race.SLIME]: '#6d9b87',
  [Race.KIJIN]: '#a5503c',
  [Race.DAEMON]: '#4b3a33',
  [Race.DRAGONNEWT]: '#8a4b2f',
  [Race.ANGEL]: '#e4d9c2',
  [Race.ELF]: '#5f7a45',
  [Race.DWARF]: '#9c6b3a',
  [Race.BEASTKIN]: '#b07a45',
  [Race.FAIRY]: '#c9b06b',
  [Race.UNDEAD]: '#5c6266',
  [Race.MERFOLK]: '#4f7f86',
  [Race.GOLEM]: '#8a8270',
};
const DEFAULT_TINT = '#7d5a3c';

function colored(geo: THREE.BufferGeometry, hex: string): THREE.BufferGeometry {
  let g = geo.index ? geo.toNonIndexed() : geo;
  if (g !== geo) geo.dispose();
  g.deleteAttribute('uv');
  const c = new THREE.Color(hex);
  const n = g.getAttribute('position').count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    arr[i * 3] = c.r;
    arr[i * 3 + 1] = c.g;
    arr[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}

/** 给角色材质加柔和边缘光，让它从城市背景里浮出来（旷野之息式的轮廓光） */
function addRim(mat: THREE.MeshStandardMaterial, strength: number, key: string): void {
  mat.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>
float pRim = pow(1.0 - saturate(dot(normal, normalize(vViewPosition))), 2.5);
totalEmissiveRadiance += vec3(1.0, 0.86, 0.62) * pRim * ${strength.toFixed(2)};`,
    );
  };
  mat.customProgramCacheKey = () => key;
}

const OUTPUT = /* glsl */ `
#include <tonemapping_fragment>
#include <colorspace_fragment>
`;

export class PlayerAvatar {
  readonly group = new THREE.Group();
  /** 角色本体（按距离缩放的部分） */
  private readonly figure = new THREE.Group();
  private readonly cloakMat: THREE.MeshStandardMaterial;
  private readonly bodyMat: THREE.MeshStandardMaterial;
  private readonly crystalMat: THREE.MeshStandardMaterial;
  private readonly accuracy: THREE.Mesh;
  private readonly accuracyMat: THREE.ShaderMaterial;
  private readonly blob: THREE.Mesh;
  /** 脚下光圈的增益：升级蓄力时能量往角色身上聚，高潮时最亮 */
  private readonly glow = { value: 0 };
  private readonly crystal: THREE.Mesh;
  private readonly geometries: THREE.BufferGeometry[] = [];
  private facing = 0;
  visible = false;

  constructor(time: THREE.IUniform, night: THREE.IUniform) {
    this.group.name = 'player';
    this.cloakMat = new THREE.MeshStandardMaterial({ color: DEFAULT_TINT, roughness: 0.82 });
    addRim(this.cloakMat, 0.55, 'yj-player-cloak');
    this.bodyMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 });
    addRim(this.bodyMat, 0.35, 'yj-player-body');
    this.crystalMat = new THREE.MeshStandardMaterial({ color: '#3a2e20', emissive: '#e8cf94', emissiveIntensity: 2.2, roughness: 0.3 });

    // 斗篷：下摆宽、肩部收窄的车床体，带兜帽——轮廓一眼就是「旅人」
    const cloakGeo = new THREE.LatheGeometry(
      [
        new THREE.Vector2(0.01, 0),
        new THREE.Vector2(0.3, 0.0),
        new THREE.Vector2(0.27, 0.18),
        new THREE.Vector2(0.21, 0.42),
        new THREE.Vector2(0.17, 0.6),
        new THREE.Vector2(0.19, 0.66),
        new THREE.Vector2(0.13, 0.72),
        new THREE.Vector2(0.01, 0.73),
      ],
      14,
    );
    const hoodGeo = new THREE.SphereGeometry(0.13, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.62);
    hoodGeo.translate(0, 0.79, -0.015);
    const cloakParts = [cloakGeo.toNonIndexed(), hoodGeo.toNonIndexed()];
    for (const g of cloakParts) g.deleteAttribute('uv');
    const cloak = new THREE.Mesh(mergeNonIndexed(cloakParts), this.cloakMat);
    for (const g of cloakParts) g.dispose();
    cloakGeo.dispose();
    hoodGeo.dispose();
    cloak.castShadow = true;
    this.geometries.push(cloak.geometry);

    // 脸、腰带、背包、手杖，以及斗篷的金色下摆与羊皮纸色披肩：顶点色合并成一个网格。
    // 下摆与披肩把轮廓分成「浅肩 / 种族色斗篷 / 金边」三段——缩到几十个像素时仍是一个有设计的旅人，而不是一个色块
    const face = new THREE.SphereGeometry(0.095, 12, 8);
    face.translate(0, 0.78, 0.035);
    const belt = new THREE.CylinderGeometry(0.205, 0.215, 0.04, 14);
    belt.translate(0, 0.43, 0);
    const pack = new THREE.BoxGeometry(0.2, 0.22, 0.1);
    pack.translate(0, 0.52, -0.2);
    const staff = new THREE.CylinderGeometry(0.014, 0.018, 0.95, 6);
    staff.translate(0.26, 0.47, 0.06);
    const staffHead = new THREE.OctahedronGeometry(0.045, 0);
    staffHead.translate(0.26, 0.97, 0.06);
    const hem = new THREE.CylinderGeometry(0.296, 0.306, 0.05, 14, 1, true);
    hem.translate(0, 0.03, 0);
    const mantle = new THREE.CylinderGeometry(0.15, 0.235, 0.11, 14, 1, true);
    mantle.translate(0, 0.625, 0);
    const bodyParts = [
      colored(face, '#e3c9a6'),
      colored(belt, '#6b4a2e'),
      colored(pack, '#5a4632'),
      colored(staff, '#4a3a2a'),
      colored(staffHead, '#c9a961'),
      colored(hem, '#c9a961'),
      colored(mantle, '#d8c9a6'),
    ];
    const bodyGeo = mergeNonIndexed(bodyParts);
    for (const g of bodyParts) g.dispose();
    const body = new THREE.Mesh(bodyGeo, this.bodyMat);
    body.castShadow = true;
    this.geometries.push(bodyGeo);

    // 头顶漂浮的引路水晶：「这是你」的信号，暖金色，不用青色
    const crystalGeo = new THREE.OctahedronGeometry(0.07, 0);
    crystalGeo.scale(1, 1.6, 1);
    this.crystal = new THREE.Mesh(crystalGeo, this.crystalMat);
    this.crystal.position.y = 1.08;
    this.geometries.push(crystalGeo);

    this.figure.add(cloak, body, this.crystal);
    this.group.add(this.figure);

    // 接地暗斑 + 暖色光晕：中心的接触暗部保证角色永远「站在地上」，外圈是引路水晶投下的一圈暖光——
    // 玩家是画面的主角，夜里像提着一盏灯（白天很淡，只是让脚下比周围亮一点）。同一张面片、同一个 draw call
    const blobGeo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    this.geometries.push(blobGeo);
    this.blob = new THREE.Mesh(
      blobGeo,
      new THREE.ShaderMaterial({
        uniforms: { uNight: night, uGlow: this.glow },
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: /* glsl */ `
uniform float uNight;
uniform float uGlow;
varying vec2 vUv;
void main() {
  float d = length(vUv - 0.5) * 2.0;
  float core = pow(max(1.0 - d / 0.42, 0.0), 1.6) * 0.55;
  float aura = pow(max(1.0 - d, 0.0), 2.2) * (mix(0.14, 0.42, uNight) + 0.35 * uGlow) * (1.0 - core);
  vec3 col = mix(vec3(1.0, 0.8, 0.52), vec3(0.08, 0.06, 0.04), core / max(core + aura, 1e-4));
  gl_FragColor = vec4(col, core + aura);
  ${OUTPUT}
}`,
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      }),
    );
    this.blob.renderOrder = 3;
    this.group.add(this.blob);

    // 精度圈：真实半径，柔和填充 + 描边 + 向外的涟漪
    const accGeo = new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2);
    this.geometries.push(accGeo);
    this.accuracyMat = new THREE.ShaderMaterial({
      uniforms: { uTime: time, uColor: { value: new THREE.Color('#e8cf94') } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: /* glsl */ `
uniform float uTime;
uniform vec3 uColor;
varying vec2 vUv;
void main() {
  float r = length(vUv - 0.5) * 2.0;
  if (r > 1.0) discard;
  float aa = fwidth(r) * 1.5;
  float edge = smoothstep(0.94 - aa, 0.94, r) * (1.0 - smoothstep(0.985, 0.985 + aa, r));
  float fill = 0.12 * (1.0 - r * 0.4);
  float rr = fract(uTime * 0.45);
  float ripple = smoothstep(rr - 0.03 - aa, rr, r) * (1.0 - smoothstep(rr, rr + 0.03 + aa, r)) * (1.0 - rr) * 0.5;
  gl_FragColor = vec4(uColor, fill + edge * 0.75 + ripple);
  ${OUTPUT}
}`,
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -3,
    });
    this.accuracy = new THREE.Mesh(accGeo, this.accuracyMat);
    this.accuracy.renderOrder = 4;
    this.group.add(this.accuracy);
    this.group.visible = false;
  }

  setRace(race: Race | undefined): void {
    this.cloakMat.color.set(race ? RACE_TINT[race] ?? DEFAULT_TINT : DEFAULT_TINT);
  }

  /** 升级演出期间脚下光圈的增益（0 = 平常） */
  setGlow(v: number): void {
    this.glow.value = v;
  }

  /** pos 为 null 时隐藏 */
  setPosition(pos: THREE.Vector3 | null, accuracyM: number): void {
    this.visible = !!pos;
    this.group.visible = this.visible;
    if (!pos) return;
    this.group.position.copy(pos);
    const r = Math.max(6, Math.min(400, accuracyM));
    this.accuracy.scale.set(r, 1, r);
    this.accuracy.position.y = 1.0;
  }

  /** 每帧：按相机距离缩放角色、待机呼吸、转向目标 */
  update(dt: number, time: number, camDist: number, faceToward: THREE.Vector3 | null, motion: number): void {
    if (!this.visible) return;
    const h = Math.max(15, Math.min(230, camDist * 0.052));
    this.figure.scale.setScalar(h);
    const bob = Math.sin(time * 2.1 * motion) * 0.012 * motion;
    this.figure.position.y = bob * h;
    this.crystal.position.y = 1.08 + Math.sin(time * 1.7 * motion) * 0.03 * motion;
    this.crystal.rotation.y = time * 1.2 * motion;
    // 面片放大到角色高度的 1.8 倍：中心接触暗部的实际大小与原先相同（0.42 × 1.8 ≈ 0.75），外圈留给暖光
    this.blob.scale.set(h * 1.8, 1, h * 1.8);
    this.blob.position.y = 0.9;
    if (faceToward) {
      const want = Math.atan2(faceToward.x - this.group.position.x, faceToward.z - this.group.position.z);
      let d = want - this.facing;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      this.facing += d * (1 - Math.exp(-dt / 0.35));
      this.figure.rotation.y = this.facing;
    }
  }

  dispose(): void {
    for (const g of this.geometries) g.dispose();
    this.cloakMat.dispose();
    this.bodyMat.dispose();
    this.crystalMat.dispose();
    this.accuracyMat.dispose();
    (this.blob.material as THREE.Material).dispose();
  }
}

/**
 * 玩家 → 进行中委托的发光路径。直线，不做寻路（简报 3.2）。
 * 可见部分明亮，被楼挡住的部分用 depthFunc=Greater 画一遍淡淡的「透视」，路径永远连得上。
 *
 * 接取时路径不是一下子出现，而是从脚下一路亮到光柱（reveal）：前端带一个亮头，
 * 简报「前 30 秒」里「从我到目标亮起一条路」说的就是这个顺序——先看到起点是自己，再看到终点。
 */
export class QuestPath {
  readonly group = new THREE.Group();
  private readonly visibleMat: THREE.ShaderMaterial;
  private readonly hiddenMat: THREE.ShaderMaterial;
  private readonly geo: THREE.PlaneGeometry;
  private readonly meshes: THREE.Mesh[];
  /** 生长进度（两种材质共用同一个 uniform）：略大于 1 表示整条显示，亮头也已走出终点 */
  private readonly reveal = { value: 1.1 };
  private revealT = -1;
  private revealDelay = 0;
  private revealDur = 0.7;

  constructor(time: THREE.IUniform) {
    this.group.name = 'questPath';
    // 单位长条：x 从 0 到 1（沿路径），z 从 -0.5 到 0.5（横向）
    this.geo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0.5, 0, 0);
    // 人字纹每 40 m 一个、向目标流动，方向就是「往那边走」；shown / head 是生长时的已亮部分与前端亮头
    const make = (alpha: number, hidden: boolean) =>
      new THREE.ShaderMaterial({
        uniforms: { uTime: time, uLength: { value: 1000 }, uAlpha: { value: alpha }, uColor: { value: new THREE.Color('#e8cf94') }, uReveal: this.reveal },
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: /* glsl */ `
uniform float uTime;
uniform float uLength;
uniform float uAlpha;
uniform vec3 uColor;
uniform float uReveal;
varying vec2 vUv;
void main() {
  float across = abs(vUv.y - 0.5) * 2.0;
  float core = exp(-across * across * 7.0);
  float s = vUv.x * uLength / 40.0 - uTime * 1.2;
  float chevron = fract(s + across * 0.35);
  float dash = smoothstep(0.0, 0.12, chevron) * (1.0 - smoothstep(0.42, 0.55, chevron));
  float ends = smoothstep(0.0, 0.03, vUv.x) * (1.0 - smoothstep(0.97, 1.0, vUv.x));
  float shown = 1.0 - smoothstep(uReveal - 0.02, uReveal, vUv.x);
  float dh = (vUv.x - uReveal) * uLength / 28.0;
  float head = exp(-dh * dh) * step(uReveal, 1.02) * core * 1.6;
  float a = ((core * 0.55 + dash * core * 0.9) * shown + head) * ends * uAlpha;
  gl_FragColor = vec4(uColor * a * 1.4, 1.0);
  ${OUTPUT}
}`,
        transparent: true,
        depthWrite: false,
        depthFunc: hidden ? THREE.GreaterDepth : THREE.LessEqualDepth,
        blending: THREE.AdditiveBlending,
        fog: false,
      });
    this.visibleMat = make(1, false);
    this.hiddenMat = make(0.28, true);
    this.meshes = [new THREE.Mesh(this.geo, this.visibleMat), new THREE.Mesh(this.geo, this.hiddenMat)];
    for (const m of this.meshes) {
      m.frustumCulled = false;
      m.renderOrder = 6;
      this.group.add(m);
    }
    this.group.visible = false;
  }

  private wasVisible = false;

  /** 预热：用零透明度画一帧（编译着色器、上传几何），之后恢复原来的可见性 */
  setPrewarm(on: boolean): void {
    if (on) {
      this.wasVisible = this.group.visible;
      this.visibleMat.uniforms.uAlpha.value = 0;
      this.hiddenMat.uniforms.uAlpha.value = 0;
      this.group.visible = true;
    } else {
      this.visibleMat.uniforms.uAlpha.value = 1;
      this.hiddenMat.uniforms.uAlpha.value = 0.28;
      this.group.visible = this.wasVisible;
    }
  }

  /** 接取时调用：delay 秒后从起点生长到终点，用时 dur 秒；instant（减少动态效果）直接整条显示 */
  playReveal(delay: number, dur: number, instant: boolean): void {
    if (instant) {
      this.revealT = -1;
      this.reveal.value = 1.1;
      return;
    }
    this.revealT = 0;
    this.revealDelay = delay;
    this.revealDur = dur;
    this.reveal.value = 0;
  }

  /** 生长是否还在进行（调试读数），返回 0–1 的进度 */
  get revealProgress(): number {
    return Math.min(1, this.reveal.value);
  }

  update(dt: number): void {
    if (this.revealT < 0) return;
    this.revealT += dt;
    const k = Math.min(1, Math.max(0, (this.revealT - this.revealDelay) / this.revealDur));
    // 缓出：从脚下冲出去，接近光柱时放慢；终点再多走一点，让亮头完全走出路径末端
    this.reveal.value = (1 - Math.pow(1 - k, 3)) * 1.1;
    if (k >= 1) this.revealT = -1;
  }

  set(from: THREE.Vector3 | null, to: THREE.Vector3 | null, camDist: number): void {
    if (!from || !to) {
      this.group.visible = false;
      return;
    }
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    const len = Math.hypot(dx, dz);
    if (len < 5) {
      this.group.visible = false;
      return;
    }
    this.group.visible = true;
    const w = Math.max(7, camDist * 0.009);
    for (const m of this.meshes) {
      m.position.set(from.x, Math.max(from.y, 0) + 1.6, from.z);
      m.rotation.set(0, Math.atan2(-dz, dx), 0);
      m.scale.set(len, 1, w);
    }
    this.visibleMat.uniforms.uLength.value = len;
    this.hiddenMat.uniforms.uLength.value = len;
  }

  dispose(): void {
    this.geo.dispose();
    this.visibleMat.dispose();
    this.hiddenMat.dispose();
  }
}
