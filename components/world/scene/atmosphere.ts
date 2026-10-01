/**
 * 昼夜与天空。
 *
 * 按本地时间算太阳方位、天空色、雾色与曝光。入夜后太阳换成冷色的月光（同一盏投影光，
 * 阴影始终只有一盏），城市靠窗户、街灯、灯笼和光柱的暖光撑起画面。
 *
 * 色彩方向：旷野之息式的「冷影暖光」——主光是偏金的暖阳，阴影里只剩偏蓝的天光（半球光天空色）
 * 和一盏从背光侧打来的冷色补光，于是同一栋楼的受光面、补光面、背光面是暖 / 冷 / 暗三档，
 * 而不是同一种灰的深浅。黄昏是琥珀，夜里是深石板蓝而不是紫。
 *
 * 雾色单独给（显示空间）：three 在色调映射之后才混雾，雾不经过 grade.ts 的调色。
 * 白天的远景往「浅、略冷」退（空气透视），夜里往深石板蓝退。
 */
import * as THREE from 'three';

interface SkyKey {
  h: number;
  top: string;
  horizon: string;
  sun: string;
  hemiSky: string;
  hemiGround: string;
  /** 显示空间的雾色（远景退向的颜色） */
  fog: string;
  /** 背光侧冷色补光 */
  fill: string;
}

const KEYS: SkyKey[] = [
  { h: 0, top: '#121a27', horizon: '#2b3140', sun: '#9fb2d2', hemiSky: '#34435c', hemiGround: '#221d18', fog: '#1e2430', fill: '#566a8c' },
  { h: 5, top: '#1b2433', horizon: '#3d3a36', sun: '#9fb2d2', hemiSky: '#3a4659', hemiGround: '#251f19', fog: '#252a33', fill: '#56688a' },
  { h: 6.6, top: '#56688a', horizon: '#e2a77a', sun: '#ffbb80', hemiSky: '#b4b6c0', hemiGround: '#6e5a44', fog: '#c9a888', fill: '#8f9cb8' },
  { h: 8.2, top: '#7fa1c0', horizon: '#e6d6bc', sun: '#ffdcae', hemiSky: '#a9bdd6', hemiGround: '#8f775a', fog: '#d3d2c8', fill: '#9cb2d2' },
  { h: 12.5, top: '#8fb0c9', horizon: '#e9dfc9', sun: '#ffe2b6', hemiSky: '#a6bcd8', hemiGround: '#937a5b', fog: '#d6d6cd', fill: '#a3b8d6' },
  { h: 16.6, top: '#86a4bd', horizon: '#e8d3b0', sun: '#ffd69e', hemiSky: '#adbcd0', hemiGround: '#8f7657', fog: '#d8d0bf', fill: '#9fb1cc' },
  { h: 18.3, top: '#4f5f80', horizon: '#e0935e', sun: '#ffaa66', hemiSky: '#b7a89c', hemiGround: '#6f5640', fog: '#c7997a', fill: '#8a92b0' },
  { h: 19.6, top: '#27324a', horizon: '#6a4e3b', sun: '#c79a80', hemiSky: '#4f5468', hemiGround: '#33291f', fog: '#3b3536', fill: '#5d6886' },
  { h: 21, top: '#141c29', horizon: '#2e3440', sun: '#9fb2d2', hemiSky: '#34435c', hemiGround: '#221d18', fog: '#1e2430', fill: '#566a8c' },
  { h: 24, top: '#121a27', horizon: '#2b3140', sun: '#9fb2d2', hemiSky: '#34435c', hemiGround: '#221d18', fog: '#1e2430', fill: '#566a8c' },
];

const KEY_COLORS = KEYS.map((k) => ({
  h: k.h,
  top: new THREE.Color(k.top),
  horizon: new THREE.Color(k.horizon),
  sun: new THREE.Color(k.sun),
  hemiSky: new THREE.Color(k.hemiSky),
  hemiGround: new THREE.Color(k.hemiGround),
  fog: new THREE.Color(k.fog),
  fill: new THREE.Color(k.fill),
}));

export interface DayNight {
  hour: number;
  /** 0 = 白天，1 = 深夜 */
  night: number;
  /** 指向光源（太阳或月亮）的单位向量 */
  lightDir: THREE.Vector3;
  lightColor: THREE.Color;
  lightIntensity: number;
  hemiSky: THREE.Color;
  hemiGround: THREE.Color;
  hemiIntensity: number;
  skyTop: THREE.Color;
  skyHorizon: THREE.Color;
  fog: THREE.Color;
  /** 冷色补光：方向与主光的水平方位相反、仰角较低，不投影 */
  fillDir: THREE.Vector3;
  fillColor: THREE.Color;
  fillIntensity: number;
  exposure: number;
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
    skyHorizon: new THREE.Color(),
    fog: new THREE.Color(),
    fillDir: new THREE.Vector3(0, 1, 0),
    fillColor: new THREE.Color(),
    fillIntensity: 0,
    exposure: 1,
  };
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** 十月初的纽约：日出约 6:55，日落约 18:40，正午太阳高度约 47° */
const SUNRISE = 6.9;
const SUNSET = 18.7;
// 月亮挂得比原先高（仰角约 52°）：月光主要落在屋顶上，夜里俯瞰时楼群是一块块石板蓝的体块，
// 立面留暗给窗灯——原先 41° 的月光把朝南的立面照得和屋顶一样亮
const MOON_EL = 0.9;
const MOON_DIR = new THREE.Vector3(Math.sin((205 * Math.PI) / 180) * Math.cos(MOON_EL), Math.sin(MOON_EL), -Math.cos((205 * Math.PI) / 180) * Math.cos(MOON_EL)).normalize();
const _sun = new THREE.Vector3();
const _sunCol = new THREE.Color();

export function computeDayNight(hourIn: number, out: DayNight): DayNight {
  const hour = ((hourIn % 24) + 24) % 24;
  out.hour = hour;
  let i = 0;
  while (i < KEY_COLORS.length - 2 && KEY_COLORS[i + 1].h <= hour) i++;
  const a = KEY_COLORS[i];
  const b = KEY_COLORS[i + 1];
  const t = smooth(0, 1, (hour - a.h) / (b.h - a.h));
  out.skyTop.copy(a.top).lerp(b.top, t);
  out.skyHorizon.copy(a.horizon).lerp(b.horizon, t);
  out.hemiSky.copy(a.hemiSky).lerp(b.hemiSky, t);
  out.hemiGround.copy(a.hemiGround).lerp(b.hemiGround, t);
  out.fog.copy(a.fog).lerp(b.fog, t);
  out.fillColor.copy(a.fill).lerp(b.fill, t);
  const sunCol = _sunCol.copy(a.sun).lerp(b.sun, t);

  out.night = Math.max(1 - smooth(5.3, 7.3, hour), smooth(18.0, 20.0, hour));

  // 太阳：东升西落，经过正南
  const k = (hour - SUNRISE) / (SUNSET - SUNRISE);
  const elev = k > 0 && k < 1 ? Math.sin(Math.PI * k) * ((47 * Math.PI) / 180) : -0.1;
  const az = ((95 + 170 * Math.min(1, Math.max(0, k))) * Math.PI) / 180;
  _sun.set(Math.sin(az) * Math.cos(Math.max(elev, 0.06)), Math.sin(Math.max(elev, 0.06)), -Math.cos(az) * Math.cos(Math.max(elev, 0.06))).normalize();
  const elevDeg = (elev * 180) / Math.PI;
  const sunI = elev > 0 ? 3.2 * (0.3 + 0.7 * smooth(0, 22, elevDeg)) : 0.6;
  out.lightDir.copy(_sun).lerp(MOON_DIR, out.night).normalize();
  out.lightColor.copy(sunCol);
  // 月光比原先亮一些：屋顶要读得出体块（石板蓝），但仍远暗于窗灯与光柱
  out.lightIntensity = sunI * (1 - out.night) + 0.62 * out.night;
  // 白天的天光比原先略强：阴影要透气（偏蓝的中间调），而不是压成黑色
  out.hemiIntensity = 1.2 * (1 - out.night) + 0.5 * out.night;
  // 补光从主光的反方位、30° 仰角打来：照亮背光立面，并给它一层天空的冷色
  const horiz = Math.hypot(out.lightDir.x, out.lightDir.z) || 1;
  out.fillDir.set((-out.lightDir.x / horiz) * 0.866, 0.5, (-out.lightDir.z / horiz) * 0.866);
  out.fillIntensity = 0.62 * (1 - out.night) + 0.16 * out.night;
  out.exposure = 1.0 + 0.24 * out.night;
  return out;
}

/**
 * 渐变天穹：一个跟随相机的大球，地平线 → 天顶插值 + 日轮 + 夜里的星与月。
 * 地平线附近退到雾色（uFog）：低俯角时画面最上缘越过远平面，露出的天穹要和被雾吞掉的远景地面无缝接上。
 */
export class SkyDome {
  readonly mesh: THREE.Mesh;
  private readonly mat: THREE.ShaderMaterial;

  constructor() {
    this.mat = new THREE.ShaderMaterial({
      uniforms: {
        uTop: { value: new THREE.Color() },
        uHorizon: { value: new THREE.Color() },
        uFog: { value: new THREE.Color() },
        uSunColor: { value: new THREE.Color() },
        uSunDir: { value: new THREE.Vector3(0, 1, 0) },
        uNight: { value: 0 },
      },
      vertexShader: /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww; // 永远落在远平面上
}`,
      fragmentShader: /* glsl */ `
uniform vec3 uTop;
uniform vec3 uHorizon;
uniform vec3 uFog;
uniform vec3 uSunColor;
uniform vec3 uSunDir;
uniform float uNight;
varying vec3 vDir;
float h21(vec2 p) { p = fract(p * vec2(234.34, 435.345)); p += dot(p, p + 34.23); return fract(p.x * p.y); }
void main() {
  vec3 d = normalize(vDir);
  float h = clamp(d.y, 0.0, 1.0);
  vec3 col = mix(uHorizon, uTop, pow(h, 0.55));
  col = mix(uFog, col, smoothstep(-0.02, 0.12, d.y));
  float sd = max(dot(d, normalize(uSunDir)), 0.0);
  col += uSunColor * (pow(sd, 900.0) * 3.0 + pow(sd, 10.0) * 0.18) * (1.0 - uNight);
  // 夜：月轮 + 稀疏的星。星点按方向格子哈希，不需要纹理
  col += vec3(0.85, 0.88, 0.95) * pow(sd, 1600.0) * 2.0 * uNight;
  vec2 g = floor(vec2(atan(d.z, d.x) * 120.0, d.y * 160.0));
  float star = step(0.9965, h21(g)) * smoothstep(0.08, 0.3, d.y);
  col += vec3(0.9, 0.88, 0.8) * star * uNight * 0.8;
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`,
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: true,
      fog: false,
      // 天穹不过色调映射与调色：雾也不过（three 在色调映射之后混雾），两者同为显示空间，地平线才对得上
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
    (u.uHorizon.value as THREE.Color).copy(dn.skyHorizon);
    (u.uFog.value as THREE.Color).copy(dn.fog);
    (u.uSunColor.value as THREE.Color).copy(dn.lightColor);
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
