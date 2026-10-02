/**
 * 昼夜与天空（指南 5.1 昼夜关键帧、5.3 光照、5.9 氛围）。
 *
 * 色彩方向：白天是晴空下的玩具地图（天顶 #4FB2F2 → 地平线 #E4F5FF，雾 = 地平线附近的天色，地图「融进天空」）；
 * 黄昏是桃色、夜里是海军蓝——不是琥珀、不是紫。
 *
 * 亮度不靠灯光：每个材质都在白天 / 夜晚两套色板之间按 night 插值（palette.ts）。这里把主光 + 半球光
 * 按「水平顶面受到的总亮度 ≈ 1」归一化——色板颜色进去，受光面原样出来（指南：受光面取色 ≈ 色板 hex）。
 * 关键帧里的强度只决定「主光与天光的比例」，也就是受光面与背光面的明暗差：白天 2.6 : 1.4（立体），
 * 夜里 0.9 : 0.8（柔和）。灯光颜色给冷暖倾向；夜里主光往白色收一大半——夜色已经写在色板里，再乘一盏蓝月光会发紫。
 *
 * 太阳：正午仰角约 55°（比真实的 47° 高，阴影短），任何时段不低于 35°——上一版日出日落时的长投影把半条街压黑。
 */
import * as THREE from 'three';
import { SKY } from './palette';

interface SkyKey {
  h: number;
  top: string;
  mid?: string;
  horizon: string;
  light: string;
  lightI: number;
  hemiSky: string;
  hemiGround: string;
  hemiI: number;
  /** 显示空间的雾色（远景退向的颜色） */
  fog: string;
}

const NIGHT: Omit<SkyKey, 'h'> = { top: '#0E1838', horizon: '#2B3C72', light: '#A9BCFF', lightI: 0.9, hemiSky: '#34477F', hemiGround: '#141D38', hemiI: 0.8, fog: '#1C2A55' };
const DAY: Omit<SkyKey, 'h'> = { top: '#4FB2F2', mid: SKY.dayMid, horizon: '#E4F5FF', light: '#FFF6E2', lightI: 2.6, hemiSky: '#DDF1FF', hemiGround: '#C4E8A6', hemiI: 1.4, fog: '#EAF7FF' };

const KEYS: SkyKey[] = [
  { h: 0, ...NIGHT },
  { h: 5, ...NIGHT },
  { h: 6.6, top: '#7FA6E8', horizon: '#FFD2B8', light: '#FFC9A0', lightI: 1.6, hemiSky: '#C9D8F5', hemiGround: '#B5D69A', hemiI: 1.1, fog: '#F4DCCB' },
  { h: 8.2, ...DAY },
  { h: 16.6, ...DAY },
  { h: 18.3, top: '#6F8FE0', horizon: '#FFC2A6', light: '#FFB48A', lightI: 1.8, hemiSky: '#F2D4CF', hemiGround: '#B9CF98', hemiI: 1.1, fog: '#F6D0C0' },
  { h: 19.6, top: '#24326A', horizon: '#4D5E96', light: '#B7C4F0', lightI: 1.0, hemiSky: '#3D4F86', hemiGround: '#18223F', hemiI: 0.9, fog: '#33447A' },
  { h: 21, ...NIGHT },
  { h: 24, ...NIGHT },
];

const KEY_COLORS = KEYS.map((k) => {
  const top = new THREE.Color(k.top);
  const horizon = new THREE.Color(k.horizon);
  return {
    h: k.h,
    top,
    horizon,
    // 中段没写的关键帧取天顶与地平线之间偏地平线的一点：天空下半截更亮，像晴天
    mid: k.mid ? new THREE.Color(k.mid) : top.clone().lerp(horizon, 0.55),
    light: new THREE.Color(k.light),
    lightI: k.lightI,
    hemiSky: new THREE.Color(k.hemiSky),
    hemiGround: new THREE.Color(k.hemiGround),
    hemiI: k.hemiI,
    fog: new THREE.Color(k.fog),
  };
});

export interface DayNight {
  hour: number;
  /** 0 = 白天，1 = 深夜 */
  night: number;
  /** 指向光源（太阳或月亮）的单位向量 */
  lightDir: THREE.Vector3;
  lightColor: THREE.Color;
  /** 归一化之后实际给主光的强度 */
  lightIntensity: number;
  hemiSky: THREE.Color;
  hemiGround: THREE.Color;
  hemiIntensity: number;
  skyTop: THREE.Color;
  skyMid: THREE.Color;
  skyHorizon: THREE.Color;
  fog: THREE.Color;
  exposure: number;
  /** 太阳仰角（度），调试读数 */
  sunElevation: number;
}

export function createDayNight(): DayNight {
  return {
    hour: 12,
    night: 0,
    lightDir: new THREE.Vector3(0, 1, 0),
    lightColor: new THREE.Color(),
    lightIntensity: 1,
    hemiSky: new THREE.Color(),
    hemiGround: new THREE.Color(),
    hemiIntensity: 1,
    skyTop: new THREE.Color(),
    skyMid: new THREE.Color(),
    skyHorizon: new THREE.Color(),
    fog: new THREE.Color(),
    exposure: 1,
    sunElevation: 55,
  };
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** 十月初的纽约：日出约 6:55，日落约 18:40 */
const SUNRISE = 6.9;
const SUNSET = 18.7;
const DEG = Math.PI / 180;
const SUN_MIN_EL = 35 * DEG;
const SUN_MAX_EL = 55 * DEG;
// 月亮仰角 52°：月光主要落在屋顶上，夜里俯瞰时楼群是一块块海军蓝的体块
const MOON_EL = 52 * DEG;
const MOON_DIR = new THREE.Vector3(Math.sin(205 * DEG) * Math.cos(MOON_EL), Math.sin(MOON_EL), -Math.cos(205 * DEG) * Math.cos(MOON_EL)).normalize();
const WHITE = new THREE.Color(1, 1, 1);
const _sun = new THREE.Vector3();
const _gray = new THREE.Color();
const lum = (c: THREE.Color) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;

export function computeDayNight(hourIn: number, out: DayNight): DayNight {
  const hour = ((hourIn % 24) + 24) % 24;
  out.hour = hour;
  let i = 0;
  while (i < KEY_COLORS.length - 2 && KEY_COLORS[i + 1].h <= hour) i++;
  const a = KEY_COLORS[i];
  const b = KEY_COLORS[i + 1];
  const t = smooth(0, 1, (hour - a.h) / (b.h - a.h));
  out.skyTop.copy(a.top).lerp(b.top, t);
  out.skyMid.copy(a.mid).lerp(b.mid, t);
  out.skyHorizon.copy(a.horizon).lerp(b.horizon, t);
  out.fog.copy(a.fog).lerp(b.fog, t);
  out.hemiSky.copy(a.hemiSky).lerp(b.hemiSky, t);
  out.hemiGround.copy(a.hemiGround).lerp(b.hemiGround, t);
  out.lightColor.copy(a.light).lerp(b.light, t);
  const keyI = a.lightI + (b.lightI - a.lightI) * t;
  const hemiI = a.hemiI + (b.hemiI - a.hemiI) * t;

  out.night = Math.max(1 - smooth(5.3, 7.3, hour), smooth(18.0, 20.0, hour));

  // 太阳：东升西落，经过正南；仰角在 35°–55° 之间按日弧起落
  const k = (hour - SUNRISE) / (SUNSET - SUNRISE);
  const kk = Math.min(1, Math.max(0, k));
  const elev = SUN_MIN_EL + (SUN_MAX_EL - SUN_MIN_EL) * Math.sin(Math.PI * kk);
  const az = (95 + 170 * kk) * DEG;
  _sun.set(Math.sin(az) * Math.cos(elev), Math.sin(elev), -Math.cos(az) * Math.cos(elev)).normalize();
  out.lightDir.copy(_sun).lerp(MOON_DIR, out.night).normalize();
  out.sunElevation = Math.round((Math.asin(out.lightDir.y) / DEG) * 10) / 10;

  // 夜色已经写进色板：主光往白收、天光去掉一半饱和，免得蓝上加蓝。
  // 白天的暖阳也往白收 45%：#FFF6E2 原样乘到粉彩墙上，受光面的蓝通道会掉 12–21/255（截图取色实测），奶油墙发黄
  out.lightColor.lerp(WHITE, 0.45 + (0.88 - 0.45) * out.night);
  _gray.setScalar(lum(out.hemiSky));
  out.hemiSky.lerp(_gray, 0.6 * out.night);
  _gray.setScalar(lum(out.hemiGround));
  out.hemiGround.lerp(_gray, 0.4 * out.night);

  // 归一化：水平顶面的总受光 = (主光·sinθ + 天光) / π ≈ 1
  const top = (keyI * Math.max(0.3, out.lightDir.y) * lum(out.lightColor) + hemiI * lum(out.hemiSky)) / Math.PI;
  const norm = 1 / Math.max(0.05, top);
  out.lightIntensity = keyI * norm;
  out.hemiIntensity = hemiI * norm;
  out.exposure = 1;
  return out;
}

/**
 * 渐变天穹：一个跟随相机的大球。天顶 → 中段 → 地平线三段插值；夜里加卡通圆月（实心圆 + 柔光晕，无镜头光斑）与稀疏的星。
 * 地平线以下退到雾色（uFog）：低俯角时画面上缘越过远平面，露出的天穹要和被雾吞掉的远景地面无缝接上。
 * 天穹不过色调映射：雾也不过（three 在色调映射之后混雾），两者同为显示空间，地平线才对得上。
 */
export class SkyDome {
  readonly mesh: THREE.Mesh;
  private readonly mat: THREE.ShaderMaterial;

  constructor() {
    this.mat = new THREE.ShaderMaterial({
      uniforms: {
        uTop: { value: new THREE.Color() },
        uMid: { value: new THREE.Color() },
        uHorizon: { value: new THREE.Color() },
        uFog: { value: new THREE.Color() },
        uMoonDir: { value: MOON_DIR.clone() },
        uMoon: { value: new THREE.Color(SKY.moon) },
        uStar: { value: new THREE.Color(SKY.stars) },
        uSunDir: { value: new THREE.Vector3(0, 1, 0) },
        uNight: { value: 0 },
      },
      vertexShader: /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}`,
      fragmentShader: /* glsl */ `
uniform vec3 uTop;
uniform vec3 uMid;
uniform vec3 uHorizon;
uniform vec3 uFog;
uniform vec3 uMoonDir;
uniform vec3 uMoon;
uniform vec3 uStar;
uniform vec3 uSunDir;
uniform float uNight;
varying vec3 vDir;
float h21(vec2 p) { p = fract(p * vec2(234.34, 435.345)); p += dot(p, p + 34.23); return fract(p.x * p.y); }
void main() {
  vec3 d = normalize(vDir);
  float h = clamp(d.y, 0.0, 1.0);
  vec3 col = mix(uHorizon, uMid, smoothstep(0.0, 0.22, h));
  col = mix(col, uTop, smoothstep(0.18, 0.75, h));
  col = mix(uFog, col, smoothstep(-0.02, 0.06, d.y));
  float sd = max(dot(d, normalize(uSunDir)), 0.0);
  col += vec3(1.0, 0.97, 0.88) * pow(sd, 24.0) * 0.18 * (1.0 - uNight);
  float md = dot(d, normalize(uMoonDir));
  float disc = smoothstep(0.99935, 0.99955, md);
  float halo = pow(max(md, 0.0), 120.0) * 0.35;
  col = mix(col, uMoon, disc * uNight);
  col += uMoon * halo * uNight * (1.0 - disc);
  vec2 g = floor(vec2(atan(d.z, d.x) * 90.0, d.y * 120.0));
  float star = step(0.9955, h21(g)) * smoothstep(0.1, 0.35, d.y);
  col += uStar * star * uNight * 0.9;
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`,
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: true,
      fog: false,
      toneMapped: false,
    });
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16), this.mat);
    this.mesh.name = 'sky';
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = -10;
  }

  update(dn: DayNight, cameraPos: THREE.Vector3, radius: number): void {
    const u = this.mat.uniforms;
    (u.uTop.value as THREE.Color).copy(dn.skyTop);
    (u.uMid.value as THREE.Color).copy(dn.skyMid);
    (u.uHorizon.value as THREE.Color).copy(dn.skyHorizon);
    (u.uFog.value as THREE.Color).copy(dn.fog);
    (u.uSunDir.value as THREE.Vector3).copy(dn.lightDir);
    u.uNight.value = dn.night;
    this.mesh.position.copy(cameraPos);
    this.mesh.scale.setScalar(radius);
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.mat.dispose();
  }
}
