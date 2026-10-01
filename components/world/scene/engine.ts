/**
 * 3D 世界引擎：渲染器、场景、相机、输入、渲染循环、资源生命周期。WorldMap.tsx 只是它的 React 外壳。
 *
 * 生命周期要点（简报质量线）：
 *  - WebGL2 上下文自己创建再交给 three：创建失败直接抛 WorldInitError，由 WorldMap 走 onFallback，
 *    不会让 three 打印 console.error。
 *  - 标签页隐藏时停掉 rAF；低档帧率封顶 30。
 *  - 上下文丢失：先等浏览器恢复，2 s 内没恢复就 onFallback 切 2D。
 *  - 卸载：释放全部几何体、材质、纹理、渲染目标，renderer.dispose + forceContextLoss，移除全部监听。
 *  - 统计口径：renderer.info.autoReset=false，每帧开始手动 reset，阴影 pass 与后处理都算在同一帧里。
 */
import * as THREE from 'three';
import type { Quest, Race } from '../../../types';
import { worldEvents, type WorldEvent } from './worldEvents';
import { project, unproject, isInWorld } from './geo';
import { LandIndex } from './land';
import { resolveQuality, type Quality } from './quality';
import { createUniforms, createMaterials, type MaterialKit, type WorldUniforms } from './materials';
import { createBillboardAtlas, createRuneAtlas, textureBytes } from './textures';
import { buildCity, type CityResult } from './city';
import { buildLandmarks, type LandmarkResult } from './landmarks';
import { computeDayNight, createDayNight, SkyDome, type DayNight } from './atmosphere';
import { installGrade, gradeToneMapping } from './grade';
import { BeaconSystem, type Beacon } from './beacons';
import { PlayerAvatar, QuestPath } from './player';
import { VfxSystem } from './vfx';
import { CameraRig, TILT_MAX, type FitMargins } from './cameraRig';
import { InputController } from './input';
import { FEEL, flashCurve } from './feel';

export class WorldInitError extends Error {
  constructor(readonly reason: string) {
    super(reason);
    this.name = 'WorldInitError';
  }
}

export interface EngineCallbacks {
  onFocus(quest: Quest): void;
  onFallback(reason: string): void;
  onWorldStatus?(status: { userInWorld: boolean }): void;
}

export interface WorldEventRecord {
  type: WorldEvent['type'];
  questId?: string;
  at: number;
}

/** 安全框（NDC）：避开顶部档案 HUD、右侧控件与底部卡片 / 按钮 */
const V1_MARGINS: FitMargins = { x: 0.8, yTop: 0.66, yBottom: 0.74 };
const OVERVIEW_MARGINS: FitMargins = { x: 0.88, yTop: 0.74, yBottom: 0.74 };
const ACTIVE_MARGINS: FitMargins = { x: 0.72, yTop: 0.52, yBottom: 0.45 };
const DEFAULT_TILT = 52;
const ORIGIN = new THREE.Vector3(0, 0, 0);
const DEG = Math.PI / 180;
const BEACON_GOLD = new THREE.Color('#e8cf94');
const BEACON_EMBER = new THREE.Color('#c87a45');
// 每帧都要用的临时向量：渲染循环里不分配对象
const _up = new THREE.Vector3();
const _right = new THREE.Vector3();
const _lup = new THREE.Vector3();
const _snapped = new THREE.Vector3();

const round = (v: number, k = 100) => Math.round(v * k) / k;

export class WorldEngine {
  readonly quality: Quality;
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly rig = new CameraRig();
  readonly land: LandIndex;
  buildMs = 0;
  frames = 0;
  lastWorldEvent: WorldEventRecord | null = null;
  userInWorld = false;

  private readonly container: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly cb: EngineCallbacks;
  private readonly uniforms: WorldUniforms;
  private readonly materials: MaterialKit;
  private readonly billboardTex: THREE.CanvasTexture;
  private readonly runeTex: THREE.CanvasTexture;
  private readonly city: CityResult;
  private readonly landmarks: LandmarkResult;
  private readonly sky = new SkyDome();
  private readonly beacons: BeaconSystem;
  private readonly player: PlayerAvatar;
  private readonly path: QuestPath;
  private readonly vfx: VfxSystem;
  private readonly hemi: THREE.HemisphereLight;
  private readonly sun: THREE.DirectionalLight;
  /** 背光侧的冷色补光：不投影、不占 draw call，只在已有的光照计算里多一盏方向光 */
  private readonly fill: THREE.DirectionalLight;
  private readonly fog: THREE.Fog;
  private readonly input: InputController;
  private readonly dn: DayNight = createDayNight();
  private readonly resizeObserver: ResizeObserver;
  private readonly unsubscribe: () => void;
  private readonly motionQuery: MediaQueryList | null;

  private raf = 0;
  private lastFrame = 0;
  /** 模拟时钟上次推进到的时刻（performance.now） */
  private simT = 0;
  /** 环境动画的时钟（uTime）：顿帧时几乎停住 */
  private time = 0;
  /** 真实流逝的模拟时间（秒）：顿帧窗口、曝光闪、接取后的镜头停顿都按它排 */
  private realT = 0;
  private hitStops: { at: number; dur: number }[] = [];
  private flashAt = -1;
  private flashAmp = 0;
  /** 上一次接取冲击的时刻：紧随其后的「框住玩家与目标」先停一拍再出发 */
  private impactAt = -1;
  private started = false;
  private disposed = false;
  private hidden = false;
  private contextLost = false;
  private lostTimer = 0;
  private fps = 0;
  private fpsFrames = 0;
  private fpsT0 = 0;
  /** 最近一次「含阴影 pass」的整帧读数（预算按这个口径）与当前帧的实际读数 */
  private stats = { drawCalls: 0, triangles: 0, liveCalls: 0, liveTriangles: 0, shadowCached: false };
  private shadowKey = new Float64Array(8).fill(NaN);
  private hourOverride: number | null = null;
  private reducedMotionProp: boolean | undefined;
  private width = 1;
  private height = 1;
  private dpr = 1;

  private quests: Quest[] = [];
  private focusedId: string | null = null;
  private activeId: string | null = null;
  private completedIds: string[] = [];
  private userLevel: number | undefined;
  private playerPos: THREE.Vector3 | null = null;
  private accuracy = 30;
  private userInteracted = false;
  private hasHadPlayer = false;
  private readonly frameMid = new THREE.Vector3();
  private hoverAt: { x: number; y: number } | null = null;
  private dragging = false;

  constructor(container: HTMLElement, cb: EngineCallbacks) {
    this.container = container;
    this.cb = cb;
    this.quality = resolveQuality();

    // ── 渲染器 ───────────────────────────────────────────────────────
    this.canvas = document.createElement('canvas');
    const gl = this.canvas.getContext('webgl2', {
      antialias: this.quality.antialias,
      alpha: false,
      depth: true,
      stencil: false,
      premultipliedAlpha: true,
      preserveDrawingBuffer: false,
      powerPreference: 'default',
    });
    if (!gl) throw new WorldInitError('webgl2-unavailable');
    try {
      this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, context: gl, antialias: this.quality.antialias });
    } catch (err) {
      throw new WorldInitError(`renderer-init-failed: ${err instanceof Error ? err.message : String(err)}`);
    }
    const r = this.renderer;
    r.info.autoReset = false;
    r.outputColorSpace = THREE.SRGBColorSpace;
    // 调色写在色调映射里（grade.ts）：Neutral 打底保留 token 色，再加冷影暖光与亮度 S 曲线。
    // 必须在任何材质编译之前装好——着色器块是在程序编译时才拼进去的
    installGrade();
    r.toneMapping = gradeToneMapping();
    r.shadowMap.enabled = this.quality.shadowMapSize > 0;
    r.shadowMap.type = this.quality.tier === 'high' ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
    // 城市是静态的：阴影贴图只在视角、太阳或玩家变化时重画，镜头静止时省掉整个阴影 pass（省电）
    r.shadowMap.autoUpdate = false;
    r.shadowMap.needsUpdate = true;
    this.canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:none;outline:none;';
    this.canvas.setAttribute('aria-hidden', 'true');
    container.appendChild(this.canvas);

    // ── 场景 ─────────────────────────────────────────────────────────
    this.uniforms = createUniforms();
    this.materials = createMaterials(this.uniforms);
    this.billboardTex = createBillboardAtlas(this.quality.textureSize);
    this.runeTex = createRuneAtlas(this.quality.textureSize);

    const t0 = performance.now();
    this.land = new LandIndex();
    this.landmarks = buildLandmarks(this.land, this.materials, this.billboardTex);
    this.city = buildCity({ land: this.land, quality: this.quality, materials: this.materials, extraBuildings: this.landmarks.buildings });
    this.buildMs = performance.now() - t0;

    this.fog = new THREE.Fog(0xd6d6cd, 1500, 9000);
    this.scene.fog = this.fog;
    this.hemi = new THREE.HemisphereLight(0xa6bcd8, 0x937a5b, 1.0);
    this.sun = new THREE.DirectionalLight(0xffe2b6, 2.6);
    if (this.quality.shadowMapSize > 0) {
      this.sun.castShadow = true;
      this.sun.shadow.mapSize.set(this.quality.shadowMapSize, this.quality.shadowMapSize);
      this.sun.shadow.bias = -0.0004;
      this.sun.shadow.normalBias = 0.6;
    }
    // 补光的 target 留在原点：方向 = position − 原点，updateDayNight 每次把 position 设成补光方向
    this.fill = new THREE.DirectionalLight(0xa3b8d6, 0.6);
    this.scene.add(this.hemi, this.sun, this.sun.target, this.fill);

    this.beacons = new BeaconSystem(this.land, this.runeTex, this.uniforms.uTime);
    this.player = new PlayerAvatar(this.uniforms.uTime, this.uniforms.uNight);
    this.path = new QuestPath(this.uniforms.uTime);
    this.vfx = new VfxSystem(this.uniforms.uTime, this.uniforms.uNight, this.uniforms.uCamDist, this.runeTex);
    this.scene.add(this.sky.mesh, this.city.group, this.landmarks.group, this.beacons.group, this.player.group, this.path.group, this.vfx.group);

    // ── 交互 ─────────────────────────────────────────────────────────
    this.input = new InputController(container, {
      onInteractStart: () => {
        this.syncSim();
        this.userInteracted = true;
        this.rig.interrupt();
      },
      onRotate: (dx, dy) => {
        this.dragging = true;
        this.rig.rotate(-dx * 0.3, dy * 0.22);
      },
      onPan: (dx, dy) => {
        this.dragging = true;
        this.rig.pan(dx, dy, this.height);
      },
      onZoom: (f) => this.rig.zoom(f),
      onTwist: (d) => this.rig.rotate(d, 0),
      onTap: (x, y, type) => {
        const hit = this.pickAt(x, y, type === 'mouse' ? 20 : 30);
        if (hit) this.cb.onFocus(hit.quest);
      },
    });
    container.addEventListener('pointermove', this.onHoverMove);
    container.addEventListener('pointerup', this.onPointerUpCursor);
    container.style.cursor = 'grab';

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    // ResizeObserver 的回调跟着渲染节拍走，慢设备上会晚一拍；窗口尺寸与横竖屏变化另外立即处理
    window.addEventListener('resize', this.onWindowResize);
    window.addEventListener('orientationchange', this.onWindowResize);
    document.addEventListener('visibilitychange', this.onVisibility);
    this.canvas.addEventListener('webglcontextlost', this.onContextLost as EventListener, false);
    this.canvas.addEventListener('webglcontextrestored', this.onContextRestored, false);
    this.unsubscribe = worldEvents.on(this.onWorldEvent);

    this.motionQuery = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    this.motionQuery?.addEventListener?.('change', this.applyReducedMotion);
    this.applyReducedMotion();

    this.resize();
    this.updateDayNight();
    this.updateLimits();
    this.rig.snapTo(this.rig.home);
    this.rig.update(0);

    // 不用 compileAsync：没有 KHR_parallel_shader_compile 的设备上它不但没收益，
    // three r180 还会打印 THREE. 警告，并在部分材质尚无程序时抛异常。首帧直接编译即可。
    // 渲染循环由 start() 启动：外壳先把委托、定位等初始状态灌进来，开场镜头才知道往哪落。
  }

  start(): void {
    if (this.disposed || this.started) return;
    this.started = true;
    this.startCameraStory();
    this.hidden = document.visibilityState === 'hidden';
    if (!this.hidden) this.kick();
  }

  // ── 外部输入（来自 React props）────────────────────────────────────

  setQuests(quests: Quest[]): void {
    if (quests === this.quests) return;
    this.quests = quests;
    this.beacons.setQuests(quests);
    this.beacons.setState(this.focusedId, this.activeId, this.completedIds, this.userLevel);
    this.updateLimits();
  }

  setFocused(id: string | null): void {
    if (id === this.focusedId) return;
    this.syncSim();
    this.focusedId = id;
    this.beacons.setState(this.focusedId, this.activeId, this.completedIds, this.userLevel);
    if (!this.started) return;
    if (id) {
      // 小档反馈：被点中的光柱闪一下（放大的「弹」由聚焦弹簧负责），镜头推近
      this.beacons.tap(id);
      this.flyToQuest(id);
    } else if (this.activeId) this.frameActive();
  }

  setActive(id: string | null): void {
    if (id === this.activeId) return;
    this.syncSim();
    this.activeId = id;
    this.beacons.setState(this.focusedId, this.activeId, this.completedIds, this.userLevel);
    if (!this.started) return;
    if (id && !this.focusedId) this.frameActive();
    if (!id && this.playerPos) this.rig.follow = this.playerPos;
  }

  setProgress(completedIds: string[] | undefined, userLevel: number | undefined): void {
    const next = completedIds ?? [];
    // 运行中新增的已完成委托 = 刚刚结算的那一个：光柱收回地面，遮住「状态瞬间切成已完成」的跳变。
    // 挂载时带进来的老记录不演（started 之前不会进这里）
    if (this.started) {
      this.syncSim();
      for (const id of next) if (!this.completedIds.includes(id)) this.sealQuest(id);
    }
    this.completedIds = next;
    this.userLevel = userLevel;
    this.beacons.setState(this.focusedId, this.activeId, this.completedIds, this.userLevel);
  }

  private sealQuest(id: string): void {
    const b = this.beacons.seal(id);
    if (b && !this.rig.reducedMotion) this.vfx.seal(b.pos, b.urgent ? BEACON_EMBER : BEACON_GOLD, this.rig.distance);
  }

  setRace(race: Race | undefined): void {
    this.player.setRace(race);
  }

  setReducedMotion(reduced: boolean | undefined): void {
    this.reducedMotionProp = reduced;
    this.applyReducedMotion();
  }

  setUserLocation(loc: [number, number] | null, accuracy: number | null | undefined): void {
    if (typeof accuracy === 'number' && Number.isFinite(accuracy)) this.accuracy = accuracy;
    const inWorld = isInWorld(loc);
    if (inWorld && loc) {
      const xz = project(loc[0], loc[1]);
      const surf = this.land.surfaceAt(xz);
      if (!this.playerPos) this.playerPos = new THREE.Vector3();
      this.playerPos.set(surf.x, Math.max(surf.y, -2.5) + 0.5, surf.z);
      this.player.setPosition(this.playerPos, this.accuracy);
    } else {
      this.playerPos = null;
      this.player.setPosition(null, 0);
      if (this.rig.follow && this.rig.follow !== this.frameMid) this.rig.follow = null;
    }
    const changed = inWorld !== this.userInWorld;
    this.userInWorld = inWorld;
    if (changed) this.cb.onWorldStatus?.({ userInWorld: inWorld });
    this.computeHome();
    // 第一次拿到世界内的定位：如果玩家还没动过镜头，飞到自己身边并开始跟随
    if (inWorld && !this.hasHadPlayer) {
      this.hasHadPlayer = true;
      if (this.started && !this.userInteracted && !this.focusedId && !this.activeId) {
        this.rig.flyTo(this.rig.home, this.rig.inIntro ? 1.2 : 1.0);
        this.rig.follow = this.playerPos;
      } else if (!this.started) {
        this.rig.snapTo(this.rig.home);
      }
    }
    if (this.activeId && !this.focusedId && this.started && changed) this.frameActive();
  }

  // ── 镜头叙事 ───────────────────────────────────────────────────────

  private startCameraStory(): void {
    if (this.focusedId) {
      this.flyToQuest(this.focusedId, true);
      return;
    }
    if (this.activeId) {
      this.frameActive(true);
      return;
    }
    this.rig.playIntro();
    if (this.playerPos) this.rig.follow = this.playerPos;
  }

  /**
   * 聚焦：推近到当前距离的 0.72 倍（夹在 420–900 m；本来就更近时不往回拉），
   * 起步就有速度的临界阻尼缓动（点下去立刻动、落地不回弹），
   * 光柱底座落在画面中心偏上——底部要放聚焦卡片，手机上卡片顶边恰好在中线附近。
   */
  private flyToQuest(id: string, snap = false): void {
    const b = this.beacons.get(id);
    if (!b) return;
    this.rig.stopFollow();
    const f = FEEL.focus;
    const cur = this.rig.distance;
    const dist = cur < f.minDist ? cur : Math.min(f.maxDist, Math.max(f.minDist, cur * f.push));
    const target = this.liftedTarget(b.pos, dist);
    const travel = Math.hypot(target.x - this.rig.target.x, target.z - this.rig.target.z);
    if (snap) this.rig.snapTo({ target, distance: dist });
    else this.rig.flyTo({ target, distance: dist }, Math.min(1.3, Math.max(0.8, 0.75 + travel / 9000)), false, { ease: 'response' });
  }

  /**
   * 让地面点 p 落在画面中心偏上 FEEL.focus.lift（NDC）的相机焦点：焦点沿视线的地面投影往相机方向挪 Δ。
   * Δ 由透视关系精确解出：Δ·sin(e) / (d + Δ·cos(e)) = lift·tan(fov/2)。
   */
  private liftedTarget(p: THREE.Vector3, dist: number): THREE.Vector3 {
    const e = this.rig.tilt * DEG;
    const h = this.rig.heading * DEG;
    const l = FEEL.focus.lift * Math.tan((this.rig.fov * DEG) / 2);
    const delta = Math.max(0, (l * dist) / Math.max(0.2, Math.sin(e) - l * Math.cos(e)));
    // 视线在地面上的前进方向 = (sin h, 0, −cos h)（与 cameraRig 的相机摆位一致），焦点往反方向挪
    return new THREE.Vector3(p.x - Math.sin(h) * delta, Math.max(0, p.y - 0.6), p.z + Math.cos(h) * delta);
  }

  /** 进行中的委托：同时框住玩家与目标 */
  private frameActive(snap = false): void {
    const b = this.beacons.get(this.activeId);
    if (!b) return;
    if (!this.playerPos) {
      this.flyToQuest(b.id, snap);
      return;
    }
    const mid = new THREE.Vector3().addVectors(this.playerPos, b.pos).multiplyScalar(0.5);
    mid.y = 0;
    const d = this.rig.fitDistance(mid, [this.playerPos, b.pos], this.rig.tilt, [this.rig.heading], ACTIVE_MARGINS);
    const dist = Math.min(this.rig.maxDistance * 0.7, Math.max(450, d));
    this.frameMid.copy(mid);
    // 刚接取：先让玩家在原地看清光柱上的冲击（顿帧 + 冲击波起势），再拉远去交代路径
    const sinceImpact = this.impactAt < 0 ? Infinity : this.realT - this.impactAt;
    const hold = sinceImpact < 0.4 ? Math.max(0, FEEL.pulse.hitStop + FEEL.pulse.cameraHold - sinceImpact) : 0;
    if (snap) this.rig.snapTo({ target: mid, distance: dist });
    else this.rig.flyTo({ target: mid, distance: dist }, 1.1, false, { hold });
    // 飞到之后继续跟随「玩家—目标」中点：玩家往目标走时，两者始终都在画面里
    this.rig.follow = this.frameMid;
  }

  private recenter(): void {
    this.computeHome();
    if (this.playerPos) {
      this.rig.flyTo({ target: this.rig.home.target, distance: this.rig.home.distance }, 0.9);
      this.rig.follow = this.playerPos;
    } else {
      this.rig.flyTo({ target: ORIGIN, distance: this.rig.home.distance }, 0.9);
    }
  }

  private resetView(): void {
    this.rig.flyTo({ tilt: this.rig.home.tilt, heading: this.rig.home.heading, distance: this.rig.home.distance }, 0.8);
  }

  /** 总览距离与默认视角：委托或视口变化时重算 */
  private updateLimits(): void {
    const pts = this.beacons.beacons.map((b) => b.pos);
    if (pts.length) {
      const box = new THREE.Box3().setFromPoints(pts);
      const c = box.getCenter(new THREE.Vector3());
      this.rig.overviewCenter.set(c.x, 0, c.z);
      const fit = this.rig.fitDistance(this.rig.overviewCenter, pts, TILT_MAX, [0, 45, 90, 135, 180, 225, 270, 315], OVERVIEW_MARGINS);
      this.rig.maxDistance = Math.min(32000, Math.max(6000, fit * 1.04));
    } else {
      this.rig.overviewCenter.set(0, 0, 0);
      this.rig.maxDistance = 12000;
    }
    this.rig.distance = Math.min(this.rig.distance, this.rig.maxDistance);
    this.computeHome();
  }

  private computeHome(): void {
    const home = this.rig.home;
    home.tilt = DEFAULT_TILT;
    home.heading = 0;
    /*
     * 有定位：以玩家为中心；没有可用定位（未授权、没信号、不在纽约）：以时代广场为中心。
     * 两种情况都拟合「中心 + 最近的 3 个委托」。原先无定位分支写死 1300 m，只框得住 1 根光柱，
     * 而大多数测试者不在纽约、看到的恰恰是这一档——「光柱在城市各处升起」对他们不成立（QA-R1-02）。
     * 没有委托可框时保留原来的默认距离：有定位 650 m 起，无定位 1300 m。
     */
    const c = this.playerPos ?? ORIGIN;
    home.target.set(c.x, 0, c.z);
    const nearest = [...this.beacons.beacons]
      .sort((a, b) => Math.hypot(a.pos.x - c.x, a.pos.z - c.z) - Math.hypot(b.pos.x - c.x, b.pos.z - c.z))
      .slice(0, 3)
      .map((b) => b.pos);
    const fit = nearest.length ? this.rig.fitDistance(home.target, [c, ...nearest], DEFAULT_TILT, [0], V1_MARGINS) : 0;
    home.distance = Math.min(this.rig.maxDistance * 0.6, Math.max(this.playerPos ? 650 : 1300, fit));
  }

  // ── 世界事件 ───────────────────────────────────────────────────────

  private onWorldEvent = (e: WorldEvent): void => {
    this.syncSim();
    this.lastWorldEvent = { type: e.type, ...(e.type === 'pulse' ? { questId: e.questId } : {}), at: Date.now() };
    switch (e.type) {
      case 'recenter':
        this.userInteracted = true;
        this.recenter();
        break;
      case 'resetView':
        this.userInteracted = true;
        this.resetView();
        break;
      case 'pulse': {
        // 中档：顿帧（光柱压扁、底座一团闪光）→ 松开（光柱拉长、冲击波、轻震、视场外踢）→ 停一拍后拉远、路径生长
        const b = this.beacons.impact(e.questId);
        if (b) {
          const f = FEEL.pulse;
          const reduced = this.rig.reducedMotion;
          // 减少动态效果：冲击波本身就是「冲击」，整屏扩散的环不播；光柱的亮度闪光（beacons.impact）照样说明「接的是这一根」
          if (!reduced) {
            this.vfx.pulse(b.pos, b.urgent ? BEACON_EMBER : BEACON_GOLD, this.rig.distance, f.hitStop);
            this.hitStop(f.hitStop);
            this.rig.addTrauma(f.trauma, f.hitStop);
            this.rig.kickFov(f.fovKick, f.hitStop);
            this.impactAt = this.realT;
          }
          this.path.playReveal(f.pathDelay, f.pathDur, reduced);
        }
        break;
      }
      case 'celebrate': {
        // 大档：蓄力与结算卡记账同步，在 SETTLE_BEATS.levelUp 那一拍爆发（与卡片「等级提升」、顶栏等级跳动同拍）
        const at = this.playerPos ?? this.rig.effTarget;
        const c = FEEL.celebrate;
        const reduced = this.rig.reducedMotion;
        this.vfx.celebrate(at, this.rig.distance, c.lead, reduced);
        if (!reduced) {
          this.hitStop(c.hitStop, c.lead);
          this.flashAt = this.realT + c.lead;
          this.flashAmp = c.flash;
          this.rig.addTrauma(c.trauma, c.lead + c.hitStop);
          this.rig.kickFov(c.fovKick, c.lead + c.hitStop, 0.5, 0.2);
        }
        break;
      }
    }
  };

  /** 顿帧：delay 秒后，环境动画（水面、光柱流动、灯笼、浮光）停 dur 秒。镜头与输入不受影响 */
  private hitStop(dur: number, delay = 0): void {
    this.hitStops.push({ at: this.realT + delay, dur });
  }

  /** 当前曝光闪的增益（0 = 不闪） */
  private flashGain(): number {
    if (this.flashAt < 0 || this.rig.reducedMotion) return 0;
    return flashCurve(this.realT - this.flashAt) * this.flashAmp;
  }

  // ── 拾取与悬停 ───────────────────────────────────────────────────────

  private pickAt(clientX: number, clientY: number, radius: number): Beacon | null {
    const rect = this.canvas.getBoundingClientRect();
    return this.beacons.pick(clientX, clientY, this.rig.camera, rect, radius);
  }

  private onHoverMove = (e: PointerEvent): void => {
    if (e.pointerType !== 'mouse') return;
    if (e.buttons) {
      this.container.style.cursor = 'grabbing';
      return;
    }
    this.hoverAt = { x: e.clientX, y: e.clientY };
  };

  private onPointerUpCursor = (): void => {
    this.dragging = false;
    this.container.style.cursor = 'grab';
  };

  // ── 循环 ─────────────────────────────────────────────────────────

  private kick(): void {
    if (this.raf || this.disposed) return;
    this.lastFrame = performance.now();
    this.fpsT0 = this.lastFrame;
    this.fpsFrames = 0;
    this.raf = requestAnimationFrame(this.loop);
  }

  private halt(): void {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private loop = (now: number): void => {
    this.raf = 0;
    if (this.disposed || this.hidden || this.contextLost) return;
    this.raf = requestAnimationFrame(this.loop);
    const elapsed = now - this.lastFrame;
    // 低档封顶 30 帧：跳过过早的回调（留 3 ms 容差，避免 60 Hz 屏上抖成 20 帧）
    if (this.quality.fpsCap > 0 && elapsed < 1000 / this.quality.fpsCap - 3) return;
    this.lastFrame = now;
    this.frame();
  };

  /**
   * 推进模拟到 now（墙钟时间）。模拟与渲染解耦：镜头飞行、冲击波、聚焦缓动都按真实时间走，
   * 读调试状态时也会先推进到当前时刻——即使慢设备一秒只画一帧，读到的镜头与特效状态也是「此刻」的。
   */
  /** 外部输入（事件、props、手势）改变状态之前，先把模拟推进到此刻，新动画从「现在」开始计时 */
  private syncSim(): void {
    if (this.started && !this.disposed) this.advance(performance.now());
  }

  private advance(now: number): void {
    if (!this.simT) this.simT = now;
    const dt = Math.min(1, Math.max(0, (now - this.simT) / 1000));
    this.simT = now;
    // 顿帧：与顿帧窗口重叠的那部分时间，环境时钟只走 5%。按区间求重叠而不是看「此刻在不在窗口里」——
    // 慢设备一帧可能跨过整个 60 ms 的窗口，那样顿帧会被整个跳过或整帧冻住
    const t1 = this.realT;
    const t2 = t1 + dt;
    let frozen = 0;
    if (this.hitStops.length) {
      for (const w of this.hitStops) frozen += Math.max(0, Math.min(t2, w.at + w.dur) - Math.max(t1, w.at));
      this.hitStops = this.hitStops.filter((w) => w.at + w.dur > t2);
    }
    this.realT = t2;
    this.time += dt - Math.min(dt, frozen) * (1 - FEEL.hitStopScale);
    this.uniforms.uTime.value = this.time;
    this.updateDayNight();
    this.rig.update(dt);
    const cam = this.rig.camera;
    const dist = this.rig.distance;
    this.uniforms.uCamDist.value = dist;

    // 雾随距离：默认视角里画面下半部清楚、上缘（约 3 km 外）退进浅色的空气里，低俯角时远景层层变浅——
    // 空气透视给出近 / 中 / 远三层。原先起雾点在焦点距离的 1.1 倍之外，默认视角整屏都在起雾点以内，画面没有纵深。
    // 拉远进入总览时退回原来的稀薄雾（按总览混合系数插值），岛形与河道仍然清清楚楚（M3-13）
    const ob = this.rig.overviewBlend();
    this.fog.near = dist * (0.5 + 0.6 * ob) + 100;
    this.fog.far = Math.min(cam.far * 0.95, dist * (2.5 + 1.7 * ob) + 1200 + 3300 * ob);

    this.updateShadowCamera();
    this.sky.update(this.dn, cam.position, cam.far * 0.85);

    this.beacons.update(dt);
    const active = this.beacons.get(this.activeId);
    const motion = this.rig.reducedMotion ? 0.3 : 1;
    this.player.update(dt, this.time, dist, active ? active.pos : cam.position, motion);
    this.path.update(dt);
    this.path.set(this.playerPos, active ? active.pos : null, dist);
    if (active && this.playerPos) {
      this.frameMid.addVectors(this.playerPos, active.pos).multiplyScalar(0.5);
      this.frameMid.y = 0;
    }
    this.vfx.update(dt, this.rig.effTarget);
    this.player.setGlow(this.vfx.glow);
  }

  private frame(): void {
    this.advance(performance.now());
    const cam = this.rig.camera;
    // 首帧把特效与路径网格以「不可见的参数」画一遍：着色器提前编译、几何提前上传，
    // 第一次接取时不卡顿，GPU 资源读数也与是否演出过特效无关
    const prewarm = this.frames === 0;
    const culled: THREE.Object3D[] = [];
    if (prewarm) {
      this.vfx.setPrewarm(true);
      this.path.setPrewarm(true);
      // 首帧关掉视锥剔除：所有几何一次上传完，之后转到哪里都不会再有首次上传的卡顿
      this.scene.traverse((o) => {
        if (o.frustumCulled) {
          o.frustumCulled = false;
          culled.push(o);
        }
      });
    }
    if (this.hoverAt && !this.dragging) {
      const hit = this.pickAt(this.hoverAt.x, this.hoverAt.y, 18);
      this.container.style.cursor = hit ? 'pointer' : 'grab';
      this.hoverAt = null;
    }

    const r = this.renderer;
    const shadowPass = this.quality.shadowMapSize > 0 && this.shadowDirty();
    if (shadowPass) r.shadowMap.needsUpdate = true;
    r.info.reset();
    r.render(this.scene, cam);
    if (prewarm) {
      this.vfx.setPrewarm(false);
      this.path.setPrewarm(false);
      for (const o of culled) o.frustumCulled = true;
    }
    this.stats.liveCalls = r.info.render.calls;
    this.stats.liveTriangles = r.info.render.triangles;
    this.stats.shadowCached = !shadowPass && this.quality.shadowMapSize > 0;
    if (!this.stats.shadowCached) {
      this.stats.drawCalls = this.stats.liveCalls;
      this.stats.triangles = this.stats.liveTriangles;
    }
    this.frames++;
    this.fpsFrames++;
    const now = performance.now();
    if (now - this.fpsT0 >= 1000) {
      this.fps = (this.fpsFrames * 1000) / (now - this.fpsT0);
      this.fpsFrames = 0;
      this.fpsT0 = now;
    }
  }

  /** 阴影贴图是否需要重画：阴影相机中心、覆盖范围、光方向或玩家位置/尺寸有可见变化 */
  private shadowDirty(): boolean {
    const k = this.shadowKey;
    const c = this.sun.shadow.camera;
    const d = this.dn.lightDir;
    const pp = this.playerPos;
    const next = [this.sun.target.position.x, this.sun.target.position.z, c.right, d.x * 1000, d.y * 1000, d.z * 1000, pp ? pp.x : 0, pp ? pp.z + this.rig.distance * 1e-3 : 0];
    const texel = (2 * c.right) / (this.quality.shadowMapSize || 1024);
    let dirty = Number.isNaN(k[0]);
    if (!dirty) {
      dirty =
        Math.abs(next[0] - k[0]) > texel * 0.5 ||
        Math.abs(next[1] - k[1]) > texel * 0.5 ||
        Math.abs(next[2] - k[2]) > k[2] * 0.004 ||
        Math.abs(next[3] - k[3]) > 0.4 ||
        Math.abs(next[4] - k[4]) > 0.4 ||
        Math.abs(next[5] - k[5]) > 0.4 ||
        Math.abs(next[6] - k[6]) > 0.5 ||
        Math.abs(next[7] - k[7]) > 0.5;
    }
    if (dirty) for (let i = 0; i < 8; i++) k[i] = next[i];
    return dirty;
  }

  private currentHour(): number {
    if (this.hourOverride !== null) return this.hourOverride;
    const d = new Date();
    return d.getHours() + d.getMinutes() / 60;
  }

  private updateDayNight(): void {
    const dn = computeDayNight(this.currentHour(), this.dn);
    this.hemi.color.copy(dn.hemiSky);
    this.hemi.groundColor.copy(dn.hemiGround);
    this.hemi.intensity = dn.hemiIntensity;
    this.sun.color.copy(dn.lightColor);
    this.sun.intensity = dn.lightIntensity;
    this.fill.color.copy(dn.fillColor);
    this.fill.intensity = dn.fillIntensity;
    this.fill.position.copy(dn.fillDir).multiplyScalar(1000);
    this.fog.color.copy(dn.fog);
    this.renderer.setClearColor(dn.fog);
    // 升级高潮的曝光闪叠在昼夜曝光上（只闪一次、0.35 s 缓出；减少动态效果时不排程）
    this.renderer.toneMappingExposure = dn.exposure * (1 + this.flashGain());
    this.uniforms.uNight.value = dn.night;
    this.uniforms.uSkyTop.value.copy(dn.skyTop);
    this.uniforms.uSkyHorizon.value.copy(dn.skyHorizon);
    this.materials.update(dn.night);
  }

  /** 太阳阴影相机跟随焦点，覆盖范围随缩放变化；按纹素对齐，镜头移动时阴影边缘不闪 */
  private updateShadowCamera(): void {
    const center = this.rig.effTarget;
    const S = Math.min(9000, Math.max(380, this.rig.distance * 1.25));
    const sc = this.sun.shadow.camera;
    const size = this.quality.shadowMapSize || 1024;
    const texel = (2 * S) / size;
    const dir = this.dn.lightDir;
    // 在光源空间里对齐纹素：把中心投到垂直于光方向的平面上再取整
    const up = Math.abs(dir.y) > 0.99 ? _up.set(0, 0, 1) : _up.set(0, 1, 0);
    const right = _right.crossVectors(up, dir).normalize();
    const lup = _lup.crossVectors(dir, right).normalize();
    const cr = Math.round(center.dot(right) / texel) * texel;
    const cu = Math.round(center.dot(lup) / texel) * texel;
    const cd = center.dot(dir);
    const snapped = _snapped.set(0, 0, 0).addScaledVector(right, cr).addScaledVector(lup, cu).addScaledVector(dir, cd);
    const L = S * 2 + 2500;
    this.sun.position.copy(snapped).addScaledVector(dir, L);
    this.sun.target.position.copy(snapped);
    this.sun.target.updateMatrixWorld();
    sc.left = -S;
    sc.right = S;
    sc.top = S;
    sc.bottom = -S;
    sc.near = 10;
    sc.far = L + S * 2 + 1000;
    sc.updateProjectionMatrix();
    this.sun.shadow.normalBias = Math.max(0.4, texel * 0.9);
  }

  private resize(): void {
    const rect = this.container.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width));
    const h = Math.max(1, Math.round(rect.height));
    const dpr = Math.min(window.devicePixelRatio || 1, this.quality.dprCap);
    if (w === this.width && h === this.height && dpr === this.dpr && this.started) return;
    this.width = w;
    this.height = h;
    this.dpr = dpr;
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    this.vfx.setPixelRatio(dpr);
    this.rig.setViewport(w, h);
    this.rig.camera.updateProjectionMatrix();
    if (this.beacons.beacons.length) this.updateLimits();
    // 尺寸变化后立刻补画一帧，避免拉伸的旧画面停留到下一次 rAF
    if (this.started && !this.hidden && !this.contextLost) this.frame();
  }

  private onWindowResize = (): void => this.resize();

  private onVisibility = (): void => {
    this.hidden = document.visibilityState === 'hidden' || document.hidden;
    if (this.hidden) this.halt();
    else if (this.started && !this.contextLost) this.kick();
  };

  private onContextLost = (e: Event): void => {
    e.preventDefault();
    this.contextLost = true;
    this.halt();
    window.clearTimeout(this.lostTimer);
    // 浏览器通常会很快恢复；2 s 内没恢复就切到 2D，不让玩家对着黑屏
    this.lostTimer = window.setTimeout(() => {
      if (this.contextLost && !this.disposed) this.cb.onFallback('webgl-context-lost');
    }, 2000);
  };

  private onContextRestored = (): void => {
    window.clearTimeout(this.lostTimer);
    this.contextLost = false;
    this.shadowKey.fill(NaN);
    if (this.started && !this.hidden) this.kick();
  };

  private applyReducedMotion = (): void => {
    const reduced = this.reducedMotionProp ?? !!this.motionQuery?.matches;
    this.rig.reducedMotion = reduced;
    this.beacons.setReducedMotion(reduced);
  };

  // ── 调试钩子用的读数与操作 ───────────────────────────────────────────

  private textureMB(): number {
    let bytes = textureBytes(this.billboardTex) + textureBytes(this.runeTex);
    if (this.quality.shadowMapSize > 0) bytes += this.quality.shadowMapSize ** 2 * (4 + 4);
    return bytes / (1024 * 1024);
  }

  rendererStats() {
    const info = this.renderer.info;
    return {
      drawCalls: this.stats.drawCalls,
      triangles: this.stats.triangles,
      drawCallsLive: this.stats.liveCalls,
      trianglesLive: this.stats.liveTriangles,
      shadowCached: this.stats.shadowCached,
      geometries: info.memory.geometries,
      textures: info.memory.textures,
      fps: round(this.fps, 10),
      tier: this.quality.tier,
      dpr: this.dpr,
      // 不开后处理：bloom 在本作里收益很小（光柱与灯笼本身就是叠加发光），见交接文档的取舍说明
      postPasses: 0,
      shadowMapSize: this.quality.shadowMapSize,
      textureMB: round(this.textureMB(), 10),
      frames: this.frames,
      programs: info.programs?.length ?? 0,
    };
  }

  debugState() {
    if (this.started && !this.disposed) {
      this.resize();
      this.advance(performance.now());
    }
    const cam = this.rig.camera;
    const rect = this.canvas.getBoundingClientRect();
    const snap = this.rig.snapshot();
    const s = { x: 0, y: 0, front: false };
    const onScreen = (p: { x: number; y: number; front: boolean }) =>
      p.front && p.x >= rect.left && p.x <= rect.right && p.y >= rect.top && p.y <= rect.bottom;
    const beacons = this.beacons.beacons.map((b) => {
      this.beacons.toScreen(b.pos, cam, rect, s);
      return { id: b.id, screen: { x: round(s.x, 10), y: round(s.y, 10) }, onScreen: onScreen(s), onLand: b.onLand, urgent: b.urgent };
    });
    let player: { screen: { x: number; y: number }; onScreen: boolean } | null = null;
    if (this.playerPos) {
      this.beacons.toScreen(this.playerPos, cam, rect, s);
      player = { screen: { x: round(s.x, 10), y: round(s.y, 10) }, onScreen: onScreen(s) };
    }
    const tgt = unproject(snap.target.x, snap.target.z);
    return {
      mode: '3d' as const,
      camera: {
        position: { x: round(snap.position.x), y: round(snap.position.y), z: round(snap.position.z) },
        target: { x: round(snap.target.x), y: round(snap.target.y), z: round(snap.target.z), lat: round(tgt.lat, 1e6), lon: round(tgt.lon, 1e6) },
        tilt: round(snap.tilt),
        heading: round(snap.heading),
        zoom: round(snap.zoom),
      },
      focusedQuestId: this.focusedId,
      activeQuestId: this.activeId,
      beacons,
      player,
      renderer: this.rendererStats(),
      lastWorldEvent: this.lastWorldEvent,
      hour: round(this.currentHour()),
      userInWorld: this.userInWorld,
      intro: this.rig.inIntro,
      flying: this.rig.flying,
      reducedMotion: this.rig.reducedMotion,
      vfx: { shockwave: this.vfx.shockwaveActive, celebrate: this.vfx.celebrateActive, seal: this.vfx.sealActive },
      // 手感读数（feel.ts）：震屏 trauma、视场冲击（度）、是否在顿帧、曝光闪增益、升级演出段落、路径生长进度、
      // 聚焦 / 进行中那根光柱的弹簧值与挤压量。自动化验证时序用，不靠截图猜
      feel: {
        trauma: round(this.rig.shakeTrauma, 1000),
        fov: round(this.rig.fovOffset, 1000),
        hitStop: this.hitStops.some((w) => this.realT >= w.at && this.realT < w.at + w.dur),
        flash: round(this.flashGain(), 1000),
        celebrate: this.vfx.celebratePhase,
        path: round(this.path.revealProgress, 1000),
        focused: this.beacons.feelOf(this.focusedId),
        active: this.beacons.feelOf(this.activeId),
      },
      maxZoom: round(this.rig.maxDistance),
      homeZoom: round(this.rig.home.distance),
    };
  }

  /** 与真实点击完全同一条路径：交给 App 的 onFocus */
  tapBeacon(id: string): boolean {
    const b = this.beacons.get(id);
    if (!b) return false;
    this.cb.onFocus(b.quest);
    return true;
  }

  /** 只移动镜头（测量视角 V3 用），不改 App 状态 */
  focusQuest(id: string): boolean {
    if (!this.beacons.get(id)) return false;
    this.syncSim();
    this.flyToQuest(id);
    return true;
  }

  /** 调试：直接设定镜头（QA 复现视角用）。target 可给世界坐标 {x,z} 或经纬度 {lat,lon} */
  setView(v: { tilt?: number; heading?: number; zoom?: number; target?: { x?: number; z?: number; lat?: number; lon?: number } }): void {
    const pose: { tilt?: number; heading?: number; distance?: number; target?: THREE.Vector3 } = {};
    if (typeof v.tilt === 'number') pose.tilt = Math.min(TILT_MAX, Math.max(35, v.tilt));
    if (typeof v.heading === 'number') pose.heading = v.heading;
    if (typeof v.zoom === 'number') pose.distance = Math.min(this.rig.maxDistance, Math.max(160, v.zoom));
    if (v.target) {
      if (typeof v.target.lat === 'number' && typeof v.target.lon === 'number') {
        const p = project(v.target.lat, v.target.lon);
        pose.target = new THREE.Vector3(p.x, 0, p.z);
      } else pose.target = new THREE.Vector3(v.target.x ?? 0, 0, v.target.z ?? 0);
    }
    this.rig.stopFollow();
    this.rig.snapTo(pose);
  }

  setHour(h: number | null): void {
    this.hourOverride = h === null || !Number.isFinite(h) ? null : ((h % 24) + 24) % 24;
    this.updateDayNight();
  }

  recenterNow(): void {
    this.recenter();
  }

  statsWithBuild() {
    return { ...this.rendererStats(), buildMs: round(this.buildMs, 10), city: this.city.stats };
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.halt();
    window.clearTimeout(this.lostTimer);
    this.unsubscribe();
    this.resizeObserver.disconnect();
    document.removeEventListener('visibilitychange', this.onVisibility);
    window.removeEventListener('resize', this.onWindowResize);
    window.removeEventListener('orientationchange', this.onWindowResize);
    this.canvas.removeEventListener('webglcontextlost', this.onContextLost as EventListener, false);
    this.canvas.removeEventListener('webglcontextrestored', this.onContextRestored, false);
    this.container.removeEventListener('pointermove', this.onHoverMove);
    this.container.removeEventListener('pointerup', this.onPointerUpCursor);
    this.motionQuery?.removeEventListener?.('change', this.applyReducedMotion);
    this.input.dispose();
    this.container.style.cursor = '';

    this.city.dispose();
    this.landmarks.dispose();
    this.beacons.dispose();
    this.player.dispose();
    this.path.dispose();
    this.vfx.dispose();
    this.sky.dispose();
    this.materials.dispose();
    this.billboardTex.dispose();
    this.runeTex.dispose();
    this.sun.shadow.map?.dispose();
    this.sun.dispose();
    this.fill.dispose();
    this.hemi.dispose();
    this.scene.clear();
    this.renderer.renderLists.dispose();
    const lost = this.contextLost || this.renderer.getContext().isContextLost();
    this.renderer.dispose();
    // 立即归还 GL 上下文：反复切换 2D/3D 时不会堆出「Too many active WebGL contexts」。
    // 已经丢失的上下文不能再调（three 会打印 THREE. 警告）
    if (!lost) this.renderer.forceContextLoss();
    this.canvas.remove();
  }
}
