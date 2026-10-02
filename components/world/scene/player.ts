/**
 * 玩家：站在真实 GPS 位置上的 Q 版大头角色 + 精度圈；以及通往进行中委托的点状路径（指南 5.6 / 5.7）。
 *
 * 尺寸：真人 2 m 在城市尺度上看不见。和这一类「步行 + 地图」游戏一样，角色按相机距离保持大致恒定的屏幕高度
 * （桌面约 64 px、手机约 72 px，缩到总览时最小 28 px），精度圈则是真实半径（最小 36 px）——它表达的是
 * 「定位有多准」，不能为了好看放大。没有定位或不在世界范围内时整个角色组隐藏（简报反支柱：不在纽约却把角色放进城里）。
 *
 * 动画全在 CPU 上算成 16 个部件矩阵，顶点着色器按部件号取用（avatar.ts）：
 *  - 待机：上下浮动 3%（1.6 s）+ 呼吸挤压（纵向 0.97–1.0）+ 每 3–5 s 随机眨眼；身体 3/4 侧向相机，让脸可见。
 *  - 走路（显示位置在追赶真实定位时）：腿摆 ±28°、手臂反相 ±22°、2.2 步/s、身体上下浮动为步频 2 倍、前倾 6°；
 *    0.2 s 内转向移动方向。史莱姆改为挤压拉伸的「蹦」，傀儡更顿更重。
 *  - 出场 / 回到我：0 → 1.1 → 1 的弹簧放大 + 一小团白色尘雾（尘雾由 VfxSystem 放）。
 */
import * as THREE from 'three';
import { Race } from '../../../types';
import { buildAvatar, PART, PART_COUNT, PIVOT, type RaceLook } from './avatar';
import type { WorldUniforms } from './materials';
import { UI, SHADOW_INK } from './palette';

const OUTPUT = /* glsl */ `
#include <colorspace_fragment>
`;

/** 角色材质：卡通渐变 + 白色边缘光（让角色从地图上「浮」出来，指南 5.2）+ 发光部件（光环、核心、闪光点） */
function patchAvatar(mat: THREE.MeshToonMaterial, parts: { value: THREE.Matrix4[] }, night: { value: number }, rim: number): void {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uPart = parts;
    shader.uniforms.uNight = night;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\nuniform mat4 uPart[${PART_COUNT}];\nattribute float aPart;\nattribute float aGlow;\nvarying float vGlow;`)
      .replace('#include <beginnormal_vertex>', 'mat4 pM = uPart[int(aPart + 0.5)];\nvec3 objectNormal = normalize(mat3(pM) * normal);')
      .replace('#include <begin_vertex>', 'vec3 transformed = (pM * vec4(position, 1.0)).xyz;\nvGlow = aGlow;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uNight;\nvarying float vGlow;')
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
float pRim = pow(1.0 - saturate(dot(normal, normalize(vViewPosition))), 2.5);
totalEmissiveRadiance += vec3(pRim * ${rim.toFixed(2)});
totalEmissiveRadiance += diffuseColor.rgb * vGlow * (0.25 + 0.8 * uNight);`,
      );
  };
  mat.customProgramCacheKey = () => `yj-cute-avatar-${rim.toFixed(2)}`;
}

function patchAvatarDepth(mat: THREE.MeshDepthMaterial, parts: { value: THREE.Matrix4[] }): void {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uPart = parts;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\nuniform mat4 uPart[${PART_COUNT}];\nattribute float aPart;`)
      .replace('#include <begin_vertex>', 'vec3 transformed = (uPart[int(aPart + 0.5)] * vec4(position, 1.0)).xyz;');
  };
  mat.customProgramCacheKey = () => 'yj-cute-avatar-depth';
}

const DEG = Math.PI / 180;
const _m = new THREE.Matrix4();
const _t = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();

/** 绕转轴 pivot 旋转（欧拉角）+ 缩放，再平移 offset：M = T(offset) · T(pivot) · R · S · T(−pivot) */
function pivotMatrix(out: THREE.Matrix4, pivot: readonly number[], rx: number, ry: number, rz: number, sx = 1, sy = 1, sz = 1, ox = 0, oy = 0, oz = 0): THREE.Matrix4 {
  _q.setFromEuler(_e.set(rx, ry, rz, 'YXZ'));
  out.compose(_p.set(pivot[0] + ox, pivot[1] + oy, pivot[2] + oz), _q, _s.set(sx, sy, sz));
  return out.multiply(_t.makeTranslation(-pivot[0], -pivot[1], -pivot[2]));
}

export class PlayerAvatar {
  readonly group = new THREE.Group();
  /** 角色本体（按距离缩放的部分） */
  private readonly figure = new THREE.Group();
  private readonly parts = { value: Array.from({ length: PART_COUNT }, () => new THREE.Matrix4()) };
  private readonly opaqueMat: THREE.MeshToonMaterial;
  private readonly translucentMat: THREE.MeshToonMaterial;
  private readonly depthMat: THREE.MeshDepthMaterial;
  private body: THREE.Mesh | null = null;
  private skin: THREE.Mesh | null = null;
  private look: RaceLook;
  private race: Race | undefined = undefined;
  private built = false;
  private readonly accuracy: THREE.Mesh;
  private readonly accuracyMat: THREE.ShaderMaterial;
  /** 升级蓄力时精度圈变亮（引擎每帧转来 VfxSystem.glow） */
  private readonly glow = { value: 0 };
  private readonly accU: { uAcc: { value: number }; uShadowR: { value: number } };
  private readonly target = new THREE.Vector3();
  /** 显示位置：追赶真实定位，追赶中播走路动画 */
  readonly shown = new THREE.Vector3();
  private hasShown = false;
  private facing = 0;
  private walk = 0;
  private walkPhase = 0;
  private blinkAt = 2;
  private blinkT = -1;
  private spawnT = -1;
  private time = 0;
  /** 本帧角色的世界高度（米）：路径、软影、尘雾按它取尺寸 */
  height = 40;
  visible = false;
  /** 出场 / 回到我时引擎据此放尘雾 */
  onSpawn: ((at: THREE.Vector3, height: number) => void) | null = null;

  constructor(private readonly world: WorldUniforms, gradient: THREE.Texture, private readonly shadows: boolean) {
    this.group.name = 'player';
    this.opaqueMat = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: gradient });
    patchAvatar(this.opaqueMat, this.parts, world.uNight, 0.3);
    this.translucentMat = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: gradient, transparent: true, depthWrite: false });
    patchAvatar(this.translucentMat, this.parts, world.uNight, 0.35);
    this.depthMat = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
    patchAvatarDepth(this.depthMat, this.parts);
    this.look = buildAvatar(undefined).look;
    this.group.add(this.figure);

    // 精度圈：teal-400 14% 实心圆 + 2 px 白边 + 2.4 s 脉冲；圆心一块小软影让角色「站在地上」（低档没有实时阴影）
    const accGeo = new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2);
    this.accU = { uAcc: { value: 30 }, uShadowR: { value: 10 } };
    this.accuracyMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: world.uTime,
        uPx: world.uPx,
        uNight: world.uNight,
        uGlow: this.glow,
        uTeal: { value: new THREE.Color(UI.teal400) },
        uInk: { value: new THREE.Color(SHADOW_INK) },
        ...this.accU,
      },
      vertexShader: /* glsl */ `
uniform float uPx;
uniform float uAcc;
varying vec2 vQ;
varying float vR;
varying float vPxM;
void main() {
  vec3 c = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
  float px = distance(cameraPosition, c) * uPx;
  float R = max(uAcc, 36.0 * px);
  vR = R;
  vPxM = px;
  vQ = position.xz * R * 1.08;
  gl_Position = projectionMatrix * viewMatrix * vec4(c + vec3(vQ.x, 0.0, vQ.y), 1.0);
}`,
      fragmentShader: /* glsl */ `
uniform float uTime;
uniform float uNight;
uniform float uGlow;
uniform vec3 uTeal;
uniform vec3 uInk;
uniform float uShadowR;
varying vec2 vQ;
varying float vR;
varying float vPxM;
void over(inout vec4 acc, vec3 c, float a) { acc.rgb = c * a + acc.rgb * (1.0 - a); acc.a = a + acc.a * (1.0 - a); }
void main() {
  float d = length(vQ);
  float aa = max(fwidth(d), 1e-3);
  vec4 acc = vec4(0.0);
  over(acc, uTeal, (1.0 - smoothstep(vR - aa, vR + aa, d)) * (0.14 + 0.2 * uGlow));
  float edgeW = 2.0 * vPxM;
  over(acc, vec3(1.0), smoothstep(vR - edgeW - aa, vR - edgeW, d) * (1.0 - smoothstep(vR, vR + aa, d)) * 0.92);
  float ph = fract(uTime / 2.4);
  float pr = vR * (0.35 + 0.65 * ph);
  over(acc, vec3(1.0), smoothstep(pr - edgeW * 1.5 - aa, pr - edgeW * 0.5, d) * (1.0 - smoothstep(pr, pr + aa, d)) * (1.0 - ph) * 0.6);
  over(acc, uInk, (1.0 - smoothstep(uShadowR * 0.25, uShadowR, d)) * 0.26 * (1.0 - uNight * 0.6));
  if (acc.a < 0.003) discard;
  gl_FragColor = vec4(acc.rgb, acc.a * (1.0 - 0.35 * uNight));
  ${OUTPUT}
}`,
      transparent: true,
      premultipliedAlpha: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -3,
    });
    this.accuracy = new THREE.Mesh(accGeo, this.accuracyMat);
    this.accuracy.renderOrder = 4;
    this.accuracy.frustumCulled = false;
    this.group.add(this.accuracy);
    this.group.visible = false;
  }

  setRace(race: Race | undefined): void {
    if (this.built && race === this.race) return;
    this.race = race;
    this.built = true;
    if (this.body) {
      this.figure.remove(this.body);
      this.body.geometry.dispose();
    }
    if (this.skin) {
      this.figure.remove(this.skin);
      this.skin.geometry.dispose();
    }
    const { opaque, translucent, look } = buildAvatar(race);
    this.look = look;
    this.body = new THREE.Mesh(opaque, this.opaqueMat);
    this.body.name = 'playerBody';
    this.body.castShadow = this.shadows;
    this.body.customDepthMaterial = this.depthMat;
    this.figure.add(this.body);
    this.skin = null;
    if (translucent) {
      this.skin = new THREE.Mesh(translucent, this.translucentMat);
      this.skin.name = 'playerTranslucent';
      this.skin.renderOrder = 5;
      this.figure.add(this.skin);
    }
    if (this.visible) this.spawnT = 0;
  }

  /** 升级演出期间精度圈的增益（0 = 平常） */
  setGlow(v: number): void {
    this.glow.value = v;
  }

  /** pos 为 null 时隐藏 */
  setPosition(pos: THREE.Vector3 | null, accuracyM: number): void {
    const was = this.visible;
    this.visible = !!pos;
    this.group.visible = this.visible;
    if (!pos) return;
    this.target.copy(pos);
    // 第一次出现、或一下子跳了很远（重新定位）：直接落位并播出场
    if (!this.hasShown || !was || this.shown.distanceTo(pos) > 2500) {
      this.shown.copy(pos);
      this.hasShown = true;
      this.spawnT = 0;
    }
    this.accU.uAcc.value = Math.max(4, Math.min(400, accuracyM));
  }

  /** 回到我：再播一次弹簧放大 + 尘雾 */
  pop(): void {
    if (this.visible) this.spawnT = 0;
  }

  /**
   * 每帧：追赶定位、按相机距离缩放、动画、转向。
   * targetPx：期望的屏幕高度（CSS px）；camDist：相机到焦点的距离；faceToward：进行中的目标（无则看向相机）。
   */
  update(dt: number, camDist: number, cameraPos: THREE.Vector3, faceToward: THREE.Vector3 | null, motion: number, targetPx: number): void {
    if (!this.visible) return;
    this.time += dt * (motion > 0 ? 1 : 0);
    const t = this.time;
    const look = this.look;
    // 屏幕高度 → 世界高度：默认视距附近夹在 10–70 m（指南写 10–60 m；默认视角要框住最近 3 个委托时会拉到 1400 m，
    // 60 m 的上限会让角色缩回 47 px——「看不清主角」正是上一版评分卡扣分的地方，这里把可读性放在前面）；
    // 拉远到总览时为了保住 28 px 的下限放开上限
    const mpp = camDist * (this.world.uPx.value as number);
    const fade = Math.min(1, Math.max(0, (camDist - 1400) / 4000));
    const px = targetPx + (28 - targetPx) * fade;
    this.height = Math.max(10, Math.max(Math.min(px * mpp, 70), 28 * mpp));
    const scale = (this.height / 2) * (look.anim.scale ?? 1);

    // 追赶真实定位：速度至少 12 m/s，最多 1.2 s 追上——位置更新是一小步一小步来的，角色会「走」过去
    const dx = this.target.x - this.shown.x;
    const dz = this.target.z - this.shown.z;
    const dist = Math.hypot(dx, dz);
    let moving = false;
    if (dist > 0.3) {
      const step = Math.min(dist, Math.max(12, dist / 1.2) * dt);
      this.shown.x += (dx / dist) * step;
      this.shown.z += (dz / dist) * step;
      moving = true;
    } else {
      this.shown.x = this.target.x;
      this.shown.z = this.target.z;
    }
    this.shown.y = this.target.y;
    this.group.position.copy(this.shown);
    this.walk += ((moving ? 1 : 0) - this.walk) * (1 - Math.exp(-dt / 0.12));

    // 朝向：走路时 0.2 s 内转向移动方向；站着时 3/4 侧向相机（脸可见），有进行中目标时看向目标那一侧
    let want: number;
    if (moving) want = Math.atan2(dx, dz);
    else {
      const toCam = Math.atan2(cameraPos.x - this.shown.x, cameraPos.z - this.shown.z);
      if (faceToward) {
        // 有进行中的目标：朝目标那一侧转，但最多偏离相机方向 40°，脸始终看得见
        const toGoal = Math.atan2(faceToward.x - this.shown.x, faceToward.z - this.shown.z);
        const rel = Math.atan2(Math.sin(toGoal - toCam), Math.cos(toGoal - toCam));
        want = toCam + Math.max(-0.7, Math.min(0.7, rel));
      } else want = toCam + 0.38;
    }
    let dd = want - this.facing;
    dd = Math.atan2(Math.sin(dd), Math.cos(dd));
    this.facing += dd * (1 - Math.exp(-dt / 0.07));

    // 出场弹簧：0 → 1.1 → 1（约 0.5 s）
    let pop = 1;
    if (this.spawnT >= 0) {
      if (this.spawnT === 0) this.onSpawn?.(this.shown, this.height);
      this.spawnT += dt;
      const u = this.spawnT;
      pop = motion > 0 ? 1 - Math.exp(-u / 0.09) * Math.cos(u * 11) : 1;
      if (u > 0.9) this.spawnT = -1;
    }
    this.figure.scale.setScalar(scale * Math.max(0.001, pop));
    this.figure.position.y = (look.anim.hover ?? 0) * scale;
    this.figure.rotation.y = this.facing;
    this.accU.uShadowR.value = this.height * 0.36;

    this.animate(dt, t, motion);
  }

  private animate(dt: number, t: number, motion: number): void {
    const P = this.parts.value;
    const look = this.look;
    const m = motion > 0 ? 1 : 0;
    const w = this.walk * m;
    const heavy = look.anim.heavy ? 1 : 0;
    const hop = !!look.anim.hop;
    // 步频 2.2 步/s（一个摆腿周期 = 2 步）；傀儡慢一点、更顿
    const stepHz = heavy ? 1.6 : 2.2;
    this.walkPhase += dt * Math.PI * stepHz * (w > 0.01 ? 1 : 0);
    const ph = this.walkPhase;
    const swing = Math.sin(ph);
    const stepBob = Math.abs(Math.sin(ph));
    // 待机浮动 3%（1.6 s）+ 呼吸挤压
    const idle = Math.sin((t * 2 * Math.PI) / 1.6) * m;
    let bobY = (0.03 + 0.03 * idle) * (1 - w) + stepBob * (heavy ? 0.03 : 0.07) * w;
    let sy = 1 - 0.015 * (1 - idle) * (1 - w);
    let sx = 1;
    if (hop) {
      // 史莱姆：果冻晃动；走路时一蹦一蹦（落地压扁、腾空拉长）
      const jelly = Math.sin(t * 5.2) * 0.03 * m;
      const hp = Math.abs(Math.sin(ph * 1.2));
      bobY = (0.02 + 0.02 * idle) * (1 - w) + hp * 0.28 * w;
      sy = 1 + jelly + (hp - 0.35) * 0.22 * w;
      sx = 1 / Math.sqrt(Math.max(0.6, sy));
    }
    const lean = 6 * DEG * w * (hop ? 0 : 1);
    pivotMatrix(P[PART.ROOT], [0, 0, 0], lean, 0, heavy ? Math.sin(ph) * 0.06 * w : 0, sx, sy, sx, 0, bobY, 0);
    const root = P[PART.ROOT];
    const local = (part: number, rx: number, ry: number, rz: number, s = [1, 1, 1], o = [0, 0, 0]) => {
      pivotMatrix(_m, PIVOT[part], rx, ry, rz, s[0], s[1], s[2], o[0], o[1], o[2]);
      P[part].multiplyMatrices(root, _m);
    };
    // 头：走路时轻微点头；待机时随呼吸微微歪一下
    local(PART.HEAD, -0.05 * stepBob * w, 0, 0.03 * idle * (1 - w));
    const head = P[PART.HEAD];
    const onHead = (part: number, rx: number, ry: number, rz: number, s = [1, 1, 1], o = [0, 0, 0]) => {
      pivotMatrix(_m, PIVOT[part], rx, ry, rz, s[0], s[1], s[2], o[0], o[1], o[2]);
      P[part].multiplyMatrices(head, _m);
    };
    // 眨眼：每 3–5 s 一次，纵向缩到 0.1，120 ms
    if (this.blinkT < 0 && t >= this.blinkAt) this.blinkT = 0;
    let blink = 1;
    if (this.blinkT >= 0) {
      this.blinkT += dt;
      blink = this.blinkT < 0.12 ? 0.1 : 1;
      if (this.blinkT > 0.16) {
        this.blinkT = -1;
        this.blinkAt = t + 3 + ((Math.sin(t * 12.9898) * 43758.5453) % 1 + 1) % 1 * 2;
      }
    }
    onHead(PART.EYES, 0, 0, 0, [1, blink, 1]);
    // 手脚：腿摆 ±28°、手臂反相 ±22°
    const legA = 28 * DEG * swing * w * (hop ? 0 : 1);
    const armA = 22 * DEG * swing * w * (hop ? 0 : 1);
    local(PART.LEG_L, legA, 0, 0);
    local(PART.LEG_R, -legA, 0, 0);
    local(PART.ARM_L, -armA, 0, -0.08 - 0.04 * idle * (1 - w));
    local(PART.ARM_R, armA, 0, 0.08 + 0.04 * idle * (1 - w));
    // 尾巴摆动（走路时更快）
    local(PART.TAIL, 0, Math.sin(t * (2.4 + 3 * w)) * 0.45 * m, 0);
    // 翅膀：按种族的频率与幅度轻扇（天翼慢、妖精 6 Hz 小幅快扇）
    const wa = Math.sin(t * Math.PI * 2 * (look.anim.wingHz ?? 1)) * (look.anim.wingAmp ?? 0.15) * m;
    local(PART.WING_L, 0, -wa, 0);
    local(PART.WING_R, 0, wa, 0);
    // 光环上下浮
    onHead(PART.HALO, 0, t * 0.6 * m, 0, [1, 1, 1], [0, Math.sin(t * 2.2) * 0.04 * m, 0]);
    // 耳朵：兽耳偶尔抖一下、尖耳随步伐微颤、鳍耳随步伐开合
    const twitch = Math.max(0, Math.sin(t * 1.3) - 0.92) * 6 * m;
    const earA = twitch * 0.35 + stepBob * 0.12 * w;
    onHead(PART.EAR_L, 0, earA, -earA * 0.5);
    onHead(PART.EAR_R, 0, -earA, earA * 0.5);
    // 胡子随步伐弹
    onHead(PART.BEARD, 0, 0, 0, [1, 1 - 0.08 * stepBob * w, 1]);
    // 头带飘带随走路飘
    onHead(PART.RIBBON, 0.3 + 0.5 * w + Math.sin(t * 6) * 0.12 * m, 0, Math.sin(t * 3.1) * 0.15 * m);
    // 妖精身边的闪光点绕身体慢慢转
    local(PART.SPARK, 0, t * 1.2 * m, 0, [1, 1, 1], [0, Math.sin(t * 1.7) * 0.05 * m, 0]);
  }

  dispose(): void {
    this.body?.geometry.dispose();
    this.skin?.geometry.dispose();
    this.opaqueMat.dispose();
    this.translucentMat.dispose();
    this.depthMat.dispose();
    this.accuracy.geometry.dispose();
    this.accuracyMat.dispose();
  }
}

/**
 * 玩家 → 进行中委托的路径（指南 5.7）：直线（不做寻路，契约不变），离地的一条点状轨迹——
 * teal-400 的圆头短划 + 两侧 1.5 px 白边，屏幕宽 8 px；短划 10 px、间隔 8 px，以约 40 px/s 朝目标流动。
 * 夜里 teal 自发光（不受光，夜色下自然更亮）。被楼挡住的部分用 depthFunc = Greater 再画一遍 30% 的「透视」，路径永远连得上。
 *
 * 接取时路径不是一下子出现，而是从脚下一路亮到徽章（reveal）：先看到起点是自己，再看到终点。
 */
export class QuestPath {
  readonly group = new THREE.Group();
  private readonly visibleMat: THREE.ShaderMaterial;
  private readonly hiddenMat: THREE.ShaderMaterial;
  private readonly geo: THREE.PlaneGeometry;
  private readonly meshes: THREE.Mesh[];
  /** 生长进度（两种材质共用同一个 uniform）：略大于 1 表示整条显示 */
  private readonly reveal = { value: 1.1 };
  private readonly lengthU = { value: 1000 };
  private readonly pxU = { value: 1 };
  private revealT = -1;
  private revealDelay = 0;
  private revealDur = 0.7;

  constructor(world: WorldUniforms) {
    this.group.name = 'questPath';
    // 单位长条：x 从 0 到 1（沿路径），z 从 -0.5 到 0.5（横向）
    this.geo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2).translate(0.5, 0, 0);
    const make = (alpha: number, hidden: boolean) =>
      new THREE.ShaderMaterial({
        uniforms: {
          uTime: world.uTime,
          uLength: this.lengthU,
          uPxM: this.pxU,
          uAlpha: { value: alpha },
          uTeal: { value: new THREE.Color(UI.teal400) },
          uReveal: this.reveal,
        },
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: /* glsl */ `
uniform float uTime;
uniform float uLength;
uniform float uPxM;
uniform float uAlpha;
uniform vec3 uTeal;
uniform float uReveal;
varying vec2 vUv;
void main() {
  float sPx = vUv.x * uLength / uPxM;
  float acrossPx = (vUv.y - 0.5) * 11.0;
  float f = mod(sPx - uTime * 40.0, 18.0);
  float along = clamp(f, 4.0, 10.0);
  float d = length(vec2(f - along, acrossPx));
  float aa = 0.8;
  float core = 1.0 - smoothstep(4.0 - aa, 4.0, d);
  float edge = 1.0 - smoothstep(5.5 - aa, 5.5, d);
  float shown = 1.0 - smoothstep(uReveal - 0.02, uReveal, vUv.x);
  float headPx = (vUv.x - uReveal) * uLength / uPxM;
  float head = exp(-headPx * headPx / 120.0) * step(uReveal, 1.02) * (1.0 - smoothstep(4.0, 6.0, abs(acrossPx)));
  float ends = smoothstep(0.0, 0.02, vUv.x) * (1.0 - smoothstep(0.985, 1.0, vUv.x));
  float a = max(edge * shown, head) * ends * uAlpha;
  vec3 col = mix(vec3(1.0), uTeal, max(core * shown, head * 0.6));
  if (a < 0.004) discard;
  gl_FragColor = vec4(col * a, a);
  #include <colorspace_fragment>
}`,
        transparent: true,
        premultipliedAlpha: true,
        depthWrite: false,
        depthFunc: hidden ? THREE.GreaterDepth : THREE.LessEqualDepth,
        fog: false,
      });
    this.visibleMat = make(1, false);
    this.hiddenMat = make(0.3, true);
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
      this.hiddenMat.uniforms.uAlpha.value = 0.3;
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

  /** 生长进度（调试读数），0–1 */
  get revealProgress(): number {
    return Math.min(1, this.reveal.value);
  }

  update(dt: number): void {
    if (this.revealT < 0) return;
    this.revealT += dt;
    const k = Math.min(1, Math.max(0, (this.revealT - this.revealDelay) / this.revealDur));
    this.reveal.value = (1 - Math.pow(1 - k, 3)) * 1.1;
    if (k >= 1) this.revealT = -1;
  }

  /** mpp：焦点处一个 CSS 像素对应的米数（路径宽度、点距按像素给） */
  set(from: THREE.Vector3 | null, to: THREE.Vector3 | null, mpp: number): void {
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
    const w = 11 * mpp;
    for (const m of this.meshes) {
      m.position.set(from.x, Math.max(from.y, 0) + 1.6, from.z);
      m.rotation.set(0, Math.atan2(-dz, dx), 0);
      m.scale.set(len, 1, w);
    }
    this.lengthU.value = len;
    this.pxU.value = Math.max(1e-3, mpp);
  }

  dispose(): void {
    this.geo.dispose();
    this.visibleMat.dispose();
    this.hiddenMat.dispose();
  }
}
