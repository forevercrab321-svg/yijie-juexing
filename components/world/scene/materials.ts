/**
 * 共享材质库。按「角色」而不是按物体建材质（指南 5.2）：同一角色的所有网格共用一个材质实例，
 * 统一受昼夜 uniform 驱动，draw call 与着色器程序数都可控。
 *
 * 角色：ground（陆地 / 城区 / 公园 / 道路合并，顶点上只存分类号）· water（卡通波纹）· shore（浅水带 + 浪花）
 *      building（实例化圆角楼：墙 / 白色压顶 / 枕形屋顶帽同一个 draw call）· foliage（棒棒糖树）
 *      structure（地标结构，顶点色）· glow（地标点缀：尖顶、时代广场色块，夜里自发光）· cables（桥索）
 *      blob（贴地软影）· cloud（卡通云）
 *
 * 昼夜：每个角色都在两套反照率之间按 uNight 插值（理由见 palette.ts）。灯光只给明暗与冷暖。
 * 卡通着色：建筑、树、地标共用一张 4 阶渐变（MeshToonMaterial.gradientMap）。背光面 60–78%，
 * 再叠上偏蓝的半球光——阴影是浅蓝灰，不是灰黑。地面用 Lambert：大平面上的阶梯光照只会变成色带。
 *
 * GLSL 模板字符串里只留英文短注释：中文注释会原样打进 3D 分包（每字 3 字节）。理由都写在 TS 注释里。
 */
import * as THREE from 'three';
import {
  GROUND_COLORS, WATER, WALLS_DAY, WALLS_NIGHT, ROOFS_DAY, ROOF_NIGHT, COPING_DAY, COPING_NIGHT,
  WINDOW_DAY, WINDOW_NIGHT_OFF, LAMP, CROWNS_DAY, CROWNS_NIGHT, TRUNK_DAY, TRUNK_NIGHT, SHADOW_INK, LANDMARK,
} from './palette';

export interface WorldUniforms {
  uTime: { value: number };
  /** 0 = 白天，1 = 深夜 */
  uNight: { value: number };
  uSkyTop: { value: THREE.Color };
  uSkyHorizon: { value: THREE.Color };
  /** 相机到焦点的距离（米）：按屏幕尺寸补偿的效果用 */
  uCamDist: { value: number };
  /** 距相机 1 米处，一个 CSS 像素对应的世界长度（= 2·tan(fov/2) / 视口高）。徽章、路径按像素给尺寸都靠它 */
  uPx: { value: number };
  /** 指向太阳 / 月亮的单位向量：云与徽章的「假光照」用，与真实主光同向 */
  uSunDir: { value: THREE.Vector3 };
}

export function createUniforms(): WorldUniforms {
  return {
    uTime: { value: 0 },
    uNight: { value: 0 },
    uSkyTop: { value: new THREE.Color('#4FB2F2') },
    uSkyHorizon: { value: new THREE.Color('#E4F5FF') },
    uCamDist: { value: 1000 },
    uPx: { value: 0.001 },
    uSunDir: { value: new THREE.Vector3(0.3, 0.8, 0.5).normalize() },
  };
}

export const HASH_GLSL = /* glsl */ `
float yjHash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float yjNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(yjHash(i), yjHash(i + vec2(1.0, 0.0)), u.x),
             mix(yjHash(i + vec2(0.0, 1.0)), yjHash(i + vec2(1.0, 1.0)), u.x), u.y);
}
`;

const v3 = (hex: string) => new THREE.Color(hex);
const v3list = (list: string[]) => list.map(v3);

/*
 * 地面：顶点属性 aG = (分类号, 明暗系数)。分类号查 GROUND_COLORS 的昼夜两色；明暗系数 < 1 用来把
 * 建筑脚下的一圈环境光遮蔽烘进地面（低档没有实时阴影时，楼靠它「站在地上」）。
 * 分类号用 flat varying：插值误差会让 int() 取到相邻分类，三角形边上出现一像素的杂色。
 * 夜里大道亮起暖色街灯：沿曼哈顿街网每 32 m 一盏；一盏灯小于约 4 像素时退成均匀的路面暖光，不闪。白天整段跳过。
 */
function patchGround(mat: THREE.MeshLambertMaterial, u: WorldUniforms): void {
  const day = v3list(GROUND_COLORS.map((c) => c[0]));
  const night = v3list(GROUND_COLORS.map((c) => c[1]));
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uNight = u.uNight;
    shader.uniforms.uGDay = { value: day };
    shader.uniforms.uGNight = { value: night };
    shader.uniforms.uLamp = { value: v3(LAMP) };
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
attribute vec2 aG;
flat varying float vGCls;
varying float vGShade;
varying vec3 vGWorld;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
vGCls = aG.x;
vGShade = aG.y;
vGWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform float uNight;
uniform vec3 uGDay[${day.length}];
uniform vec3 uGNight[${day.length}];
uniform vec3 uLamp;
flat varying float vGCls;
varying float vGShade;
varying vec3 vGWorld;`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
int gCi = int(vGCls + 0.5);
diffuseColor.rgb = mix(uGDay[gCi], uGNight[gCi], uNight) * vGShade;`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
if (uNight > 0.001 && gCi == 4) {
  const vec2 G_UP = vec2(0.48481, -0.87462);
  const vec2 G_WEST = vec2(-0.87462, -0.48481);
  vec2 gLampC = vec2(dot(vGWorld.xz, G_UP), dot(vGWorld.xz, G_WEST)) / 32.0;
  vec2 gLampFw = fwidth(gLampC);
  float gLampD = length(fract(gLampC) - 0.5) * 32.0;
  float gLamp = 1.0 - smoothstep(1.4, 2.8, gLampD);
  gLamp = mix(gLamp, 0.1, smoothstep(0.1, 0.22, max(gLampFw.x, gLampFw.y)));
  totalEmissiveRadiance += uLamp * gLamp * uNight * 0.9;
}`,
      );
  };
  mat.customProgramCacheKey = () => 'yj-cute-ground-v1';
}

/*
 * 楼体几何是「编码」的：几何里只存每个顶点属于哪个角、哪一层（aB）、真实法线方向（aBN）与部位（aBR），
 * 顶点着色器按实例的长宽高把它摆成真实米数的圆角体块——竖向倒角半径恒为 clamp(0.12 × 短边, 1.2, 4) m，
 * 不随非均匀缩放变形（指南 5.4 的「零变形倒角」）。transformed = 米数 / 缩放：instanceMatrix 乘回去时恰好抵消。
 * 法线同理：three 对实例法线做的是 R·(n/s)，所以喂进去 n·s，出来就是 R·n。
 * 阴影 pass 用的 customDepthMaterial 必须带同一段摆位代码，否则投影是一个个单位立方体。
 *
 * 层号：0 墙脚 · 1 墙顶 · 2 枕面外沿（与墙顶同位）· 3 枕面内圈（收进约 32%）· 4 枕面顶点。
 * 部位：0 墙 · 3 枕面（外缘 cop 米画成白色压顶，其余是屋顶帽色）。立面朝向：0 倒角 · 1 朝 x · 2 朝 z（只在主立面开窗）。
 * 压顶宽度、枕面鼓起高度都按短边取值并夹住范围：小楼不会被白边吃掉，大楼的屋顶不会鼓成馒头。
 */
const BUILDING_VERT_COMMON = /* glsl */ `
attribute vec4 aB;
attribute vec3 aBN;
attribute vec2 aBR;
#ifdef USE_INSTANCING
attribute float aStyle;
#endif
vec3 yjBScale() {
#ifdef USE_INSTANCING
  return vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
#else
  return vec3(1.0);
#endif
}
vec3 yjBPos(vec3 S, out float halfFace, out float inset) {
  float sh = min(S.x, S.z);
  float dome = clamp(sh * 0.09, 0.6, 3.2);
  float lv = aB.w;
  float hx0 = S.x * 0.5;
  float hz0 = S.z * 0.5;
  float mh = min(hx0, hz0);
  inset = lv < 2.5 ? 0.0 : (lv < 3.5 ? clamp(0.32 * mh, 1.4, 9.0) : mh);
  float y = lv < 0.5 ? 0.0 : (lv < 2.5 ? S.y : (lv < 3.5 ? S.y + dome * 0.72 : S.y + dome));
  float hx = max(hx0 - inset, 0.2);
  float hz = max(hz0 - inset, 0.2);
  float c = min(clamp(0.12 * sh, 1.2, 4.0) * (lv < 2.5 ? 1.0 : 0.6), min(hx, hz) * 0.9);
  vec2 p = aB.z < 0.5 ? vec2(aB.x * hx, aB.y * (hz - c)) : (aB.z < 1.5 ? vec2(aB.x * (hx - c), aB.y * hz) : vec2(0.0));
  halfFace = aBR.y < 0.5 ? 0.0 : (aBR.y < 1.5 ? hz - c : hx - c);
  return vec3(p.x, y, p.y);
}
`;

function patchBuilding(mat: THREE.MeshToonMaterial, u: WorldUniforms): void {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uNight = u.uNight;
    shader.uniforms.uWallD = { value: v3list(WALLS_DAY) };
    shader.uniforms.uWallN = { value: v3list(WALLS_NIGHT) };
    shader.uniforms.uRoofD = { value: v3list(ROOFS_DAY) };
    shader.uniforms.uRoofN = { value: v3(ROOF_NIGHT) };
    shader.uniforms.uCopD = { value: v3(COPING_DAY) };
    shader.uniforms.uCopN = { value: v3(COPING_NIGHT) };
    shader.uniforms.uWinD = { value: v3(WINDOW_DAY) };
    shader.uniforms.uWinOff = { value: v3(WINDOW_NIGHT_OFF) };
    shader.uniforms.uLamp = { value: v3(LAMP) };
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
${BUILDING_VERT_COMMON}
varying vec3 vBL;
varying float vBU;
varying float vBIn;
flat varying vec3 vBSize;
flat varying float vBPal;
flat varying float vBSeed;
flat varying float vBRole;
flat varying float vBHalf;`,
      )
      .replace('#include <beginnormal_vertex>', 'vec3 objectNormal = aBN * yjBScale();')
      .replace(
        '#include <begin_vertex>',
        `vec3 bS = yjBScale();
float bHalf;
vBL = yjBPos(bS, bHalf, vBIn);
vec3 transformed = vBL / bS;
vBSize = bS;
vBRole = aBR.x;
vBHalf = bHalf;
vBU = aBR.y < 1.5 ? vBL.z : vBL.x;
#ifdef USE_INSTANCING
  vBPal = floor(aStyle + 0.01);
  vBSeed = fract(sin(dot(instanceMatrix[3].xz, vec2(12.9898, 78.233))) * 43758.5453);
#else
  vBPal = 0.0;
  vBSeed = 0.37;
#endif`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform float uNight;
uniform vec3 uWallD[5];
uniform vec3 uWallN[5];
uniform vec3 uRoofD[5];
uniform vec3 uRoofN;
uniform vec3 uCopD;
uniform vec3 uCopN;
uniform vec3 uWinD;
uniform vec3 uWinOff;
uniform vec3 uLamp;
varying vec3 vBL;
varying float vBU;
varying float vBIn;
flat varying vec3 vBSize;
flat varying float vBPal;
flat varying float vBSeed;
flat varying float vBRole;
flat varying float vBHalf;
${HASH_GLSL}
float yjRBox(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
int bPi = int(vBPal + 0.5);
vec3 bWall = mix(uWallD[bPi], uWallN[bPi], uNight);
vec3 bRoof = mix(uRoofD[bPi], uRoofN, uNight);
vec3 bCop = mix(uCopD, uCopN, uNight);
vec3 bEmit = vec3(0.0);
float bPxY = max(fwidth(vBL.y), 1e-3);
vec3 bCol;
if (vBRole < 0.5) {
  bCol = bWall * mix(0.85, 1.0, smoothstep(0.0, 6.0, vBL.y));
  float bH = vBSize.y;
  if (vBHalf > 3.2 && bH > 9.0) {
    float bRow = floor((vBL.y - 3.0) / 6.4);
    float bCy = 3.0 + (bRow + 0.5) * 6.4;
    float bTwo = step(9.0, vBHalf);
    float bCx = bTwo * vBHalf * 0.5;
    vec2 bQ = vec2(abs(vBU) - bCx, vBL.y - bCy);
    float bD = yjRBox(bQ, vec2(1.5, 1.35), 1.05);
    float bAa = bPxY * 1.2;
    float bWin = (1.0 - smoothstep(-bAa, bAa, bD)) * step(2.6, vBL.y) * step(vBL.y, bH - 2.2);
    bWin *= 1.0 - smoothstep(0.7, 1.2, bPxY);
    float bLit = step(yjHash(vec2(bRow, sign(vBU) * bTwo + vBHalf * 3.1) + vBSeed * 17.0), 0.38);
    vec3 bGlass = mix(uWinD, uWinOff, uNight);
    bCol = mix(bCol, bGlass, bWin);
    bEmit = uLamp * bWin * bLit * uNight * 0.55;
  }
  bCol = mix(bCol, bCop, smoothstep(bH - 0.9 - bPxY, bH - 0.9, vBL.y));
} else {
  float bCopW = clamp(min(vBSize.x, vBSize.z) * 0.07, 0.8, 2.2);
  float bInAa = max(fwidth(vBIn), 1e-3);
  bCol = mix(bCop, bRoof, smoothstep(bCopW - bInAa, bCopW + bInAa, vBIn));
}
diffuseColor.rgb = bCol;`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
totalEmissiveRadiance += bEmit;`,
      );
  };
  mat.customProgramCacheKey = () => 'yj-cute-building-v1';
}

function patchBuildingDepth(mat: THREE.MeshDepthMaterial): void {
  mat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${BUILDING_VERT_COMMON}`)
      .replace(
        '#include <begin_vertex>',
        `vec3 bS = yjBScale();
float bHalf;
float bIn;
vec3 transformed = yjBPos(bS, bHalf, bIn) / bS;`,
      );
  };
  mat.customProgramCacheKey = () => 'yj-cute-building-depth-v1';
}

/*
 * 棒棒糖树：顶点属性 aT（0 树干 · 1 树冠，树冠部分 aT 的小数位是到冠底的归一高度，风摆用），
 * 实例属性 aTree（整数部分 = 三种树冠绿之一）。树冠按世界位置错开相位轻轻摆，树干不动。
 */
function patchFoliage(mat: THREE.MeshToonMaterial, u: WorldUniforms): void {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = u.uTime;
    shader.uniforms.uNight = u.uNight;
    shader.uniforms.uCrD = { value: v3list(CROWNS_DAY) };
    shader.uniforms.uCrN = { value: v3list(CROWNS_NIGHT) };
    shader.uniforms.uTrD = { value: v3(TRUNK_DAY) };
    shader.uniforms.uTrN = { value: v3(TRUNK_NIGHT) };
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
uniform float uTime;
attribute float aT;
#ifdef USE_INSTANCING
attribute float aTree;
#endif
flat varying float vTPal;
varying float vTCrown;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
vTCrown = step(0.5, aT);
#ifdef USE_INSTANCING
  vTPal = floor(aTree + 0.01);
  float tPh = instanceMatrix[3].x * 0.05 + instanceMatrix[3].z * 0.037;
#else
  vTPal = 0.0;
  float tPh = 0.0;
#endif
float tK = vTCrown * fract(aT);
transformed.x += sin(uTime * 1.2 + tPh) * 0.035 * tK * 8.0;
transformed.z += cos(uTime * 0.95 + tPh) * 0.025 * tK * 8.0;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform float uNight;
uniform vec3 uCrD[3];
uniform vec3 uCrN[3];
uniform vec3 uTrD;
uniform vec3 uTrN;
flat varying float vTPal;
varying float vTCrown;`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
int tPi = int(vTPal + 0.5);
diffuseColor.rgb = mix(mix(uTrD, uTrN, uNight), mix(uCrD[tPi], uCrN[tPi], uNight), step(0.5, vTCrown));`,
      );
  };
  mat.customProgramCacheKey = () => 'yj-cute-foliage-v1';
}

/*
 * 地标结构（顶点色）：夜里换成「白天颜色 × 很小的系数 + 海军蓝底」，与建筑夜色同一个调子
 * （奶油色 → #434C72 一带），不用逐个部件再写一套夜色。glow 角色（尖顶、色块、火炬）夜里再叠自发光。
 */
const NIGHTIFY = 'vec3 yjNightify(vec3 c) { return c * vec3(0.03, 0.04, 0.08) + vec3(0.026, 0.037, 0.11); }';
function patchStructure(mat: THREE.MeshToonMaterial, u: WorldUniforms, glow: boolean): void {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uNight = u.uNight;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform float uNight;\n${NIGHTIFY}`)
      .replace(
        '#include <color_fragment>',
        glow
          ? `#include <color_fragment>
vec3 sDay = diffuseColor.rgb;
diffuseColor.rgb = mix(sDay, sDay * 0.3, uNight);`
          : `#include <color_fragment>
diffuseColor.rgb = mix(diffuseColor.rgb, yjNightify(diffuseColor.rgb), uNight);`,
      );
    if (glow) {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
totalEmissiveRadiance += sDay * uNight * 0.85;`,
      );
    }
  };
  mat.customProgramCacheKey = () => (glow ? 'yj-cute-glow-v1' : 'yj-cute-structure-v1');
}

/*
 * 水面：不受光的平涂色 + 一圈圈缓慢漂移的「卡通波纹线」。
 * 波纹线 = 低频噪声的等值线（取 fract(n·5) 的窄带），只保留约一半的等值线，读成一笔笔浪纹而不是地形图；
 * 线宽按 fwidth 保底，线间距小于几个像素时整体淡出（远景不闪）。没有高光反射（指南 5.2）。
 */
function createWaterMaterial(u: WorldUniforms): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
      uTime: u.uTime,
      uNight: u.uNight,
      uDay: { value: v3(WATER.day) },
      uNightC: { value: v3(WATER.night) },
      uRipD: { value: v3(WATER.rippleDay) },
      uRipN: { value: v3(WATER.rippleNight) },
    },
    vertexShader: /* glsl */ `
varying vec3 vW;
#include <fog_pars_vertex>
void main() {
  vW = (modelMatrix * vec4(position, 1.0)).xyz;
  vec4 mvPosition = viewMatrix * vec4(vW, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`,
    fragmentShader: /* glsl */ `
uniform float uTime;
uniform float uNight;
uniform vec3 uDay;
uniform vec3 uNightC;
uniform vec3 uRipD;
uniform vec3 uRipN;
varying vec3 vW;
${HASH_GLSL}
#include <fog_pars_fragment>
void main() {
  vec2 p = vW.xz;
  float n = yjNoise(p / 85.0 + vec2(uTime * 0.018, -uTime * 0.013)) * 0.7 + yjNoise(p / 31.0 - vec2(uTime * 0.025, uTime * 0.02)) * 0.3;
  float s = n * 6.0;
  float f = fract(s);
  float fw = max(fwidth(s), 1e-4);
  float line = smoothstep(0.0, fw * 1.2, f) * (1.0 - smoothstep(0.07, 0.07 + fw * 1.2, f));
  line *= step(0.45, yjHash(vec2(floor(s), 3.7)));
  line *= 1.0 - smoothstep(0.18, 0.45, fw);
  vec3 col = mix(mix(uDay, uNightC, uNight), mix(uRipD, uRipN, uNight), line * 0.8);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`,
    fog: true,
  });
}

/**
 * 岸线：沿全部海岸 / 湖岸画「浪花 + 浅水带」（指南 5.1：18 m 浅水 + 6 m 浪花）。
 * 带宽在着色器里按相机距离保底（max(24 m, 0.006 × 距离)）：拉远到总览时岸线仍有两三个像素，岛形一眼可认。
 * 浪花线贴着岸、随噪声轻轻起伏；夜里换成波光蓝的浅色。
 */
function createShoreMaterial(u: WorldUniforms): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
      uCamDist: u.uCamDist,
      uNight: u.uNight,
      uTime: u.uTime,
      uFoamD: { value: v3(WATER.foamDay) },
      uFoamN: { value: v3(WATER.foamNight) },
      uShD: { value: v3(WATER.shallowDay) },
      uShN: { value: v3(WATER.shallowNight) },
    },
    vertexShader: /* glsl */ `
attribute vec2 aOut;
attribute float aSide;
uniform float uCamDist;
varying float vSide;
varying vec2 vSWorld;
#include <fog_pars_vertex>
void main() {
  float w = clamp(max(24.0, uCamDist * 0.006), 24.0, 160.0);
  vec3 p = position + vec3(aOut.x, 0.0, aOut.y) * w * aSide;
  vSide = aSide;
  vSWorld = p.xz;
  vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`,
    fragmentShader: /* glsl */ `
uniform float uNight;
uniform float uTime;
uniform vec3 uFoamD;
uniform vec3 uFoamN;
uniform vec3 uShD;
uniform vec3 uShN;
varying float vSide;
varying vec2 vSWorld;
${HASH_GLSL}
#include <fog_pars_fragment>
void main() {
  float n = yjNoise(vSWorld / 40.0 + vec2(uTime * 0.05, -uTime * 0.04));
  float aa = fwidth(vSide) * 1.2;
  float edge = 0.2 + 0.06 * n;
  float foam = 1.0 - smoothstep(edge - aa, edge + aa, vSide);
  float shallow = 1.0 - smoothstep(0.55, 1.0, vSide);
  vec3 sh = mix(uShD, uShN, uNight);
  vec3 fo = mix(uFoamD, uFoamN, uNight);
  vec3 col = mix(sh, fo, foam);
  float a = max(foam * mix(0.6, 0.45, uNight), shallow * 0.85);
  gl_FragColor = vec4(col, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`,
    transparent: true,
    depthWrite: false,
    // 外环与内环（湖岸）的走向相反：双面画，省得逐环判断绕向
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -4,
    fog: true,
  });
}

/**
 * 贴地软影：实例化的水平面片，径向渐变，藏青色（不用黑）。树用它代替实时阴影（指南 5.3：可爱风格里软影片比实时阴影更「对」）。
 * 夜里淡到几乎看不见：月光下没有清楚的影子，留着反而像地上的污渍。
 */
function createBlobMaterial(u: WorldUniforms): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uNight: u.uNight, uInk: { value: v3(SHADOW_INK) } },
    vertexShader: /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  vec4 p = vec4(position, 1.0);
#ifdef USE_INSTANCING
  p = instanceMatrix * p;
#endif
  gl_Position = projectionMatrix * modelViewMatrix * p;
}`,
    fragmentShader: /* glsl */ `
uniform float uNight;
uniform vec3 uInk;
varying vec2 vUv;
void main() {
  float d = length(vUv - 0.5) * 2.0;
  float a = (1.0 - smoothstep(0.35, 1.0, d)) * 0.22 * (1.0 - 0.75 * uNight);
  gl_FragColor = vec4(uInk, a);
  #include <colorspace_fragment>
}`,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
}

/**
 * 卡通云：受光面白、背光面 #DCEBF7；夜里 #2E3F73、60% 不透明（指南 5.9）。不受雾影响——它们本来就站在雾带里。
 * 光照是「假」的：按真实主光方向算两阶明暗，不进场景光照（云在远平面附近，没必要为它多跑一套灯光循环）。
 */
function createCloudMaterial(u: WorldUniforms): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uNight: u.uNight,
      uSunDir: u.uSunDir,
      uLitD: { value: v3('#FFFFFF') },
      uShadeD: { value: v3('#DCEBF7') },
      uNightC: { value: v3('#2E3F73') },
      uFade: { value: 1 },
    },
    vertexShader: /* glsl */ `
varying vec3 vN;
varying vec3 vV;
void main() {
  vec4 p = vec4(position, 1.0);
  vec3 n = normal;
#ifdef USE_INSTANCING
  p = instanceMatrix * p;
  n = mat3(instanceMatrix) * n;
#endif
  vec4 wp = modelMatrix * p;
  vN = normalize(mat3(modelMatrix) * n);
  vV = normalize(cameraPosition - wp.xyz);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`,
    fragmentShader: /* glsl */ `
uniform float uNight;
uniform vec3 uSunDir;
uniform vec3 uLitD;
uniform vec3 uShadeD;
uniform vec3 uNightC;
uniform float uFade;
varying vec3 vN;
varying vec3 vV;
void main() {
  vec3 n = normalize(vN);
  float l = dot(n, normalize(uSunDir)) * 0.5 + 0.5;
  float lit = smoothstep(0.42, 0.48, l + 0.25 * n.y);
  vec3 day = mix(uShadeD, uLitD, lit);
  float rim = pow(1.0 - abs(dot(n, normalize(vV))), 3.0);
  vec3 col = mix(day + rim * 0.06, uNightC * (0.85 + 0.25 * lit), uNight);
  gl_FragColor = vec4(col, mix(1.0, 0.6, uNight) * uFade);
  #include <colorspace_fragment>
}`,
    transparent: true,
    depthWrite: false,
    fog: false,
  });
}

export interface MaterialKit {
  /** 4 阶卡通渐变（建筑、树、地标、玩家共用） */
  gradient: THREE.DataTexture;
  ground: THREE.MeshLambertMaterial;
  shore: THREE.ShaderMaterial;
  building: THREE.MeshToonMaterial;
  /** 楼体投影用：与 building 同一段顶点摆位 */
  buildingDepth: THREE.MeshDepthMaterial;
  water: THREE.ShaderMaterial;
  foliage: THREE.MeshToonMaterial;
  structure: THREE.MeshToonMaterial;
  glow: THREE.MeshToonMaterial;
  cables: THREE.LineBasicMaterial;
  blob: THREE.ShaderMaterial;
  cloud: THREE.ShaderMaterial;
  /** 每帧按昼夜更新非 uniform 驱动的参数 */
  update(night: number): void;
  dispose(): void;
}

export function createMaterials(u: WorldUniforms, gradient: THREE.DataTexture): MaterialKit {
  const ground = new THREE.MeshLambertMaterial({ color: 0xffffff });
  patchGround(ground, u);
  const building = new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: gradient });
  patchBuilding(building, u);
  const buildingDepth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  patchBuildingDepth(buildingDepth);
  const foliage = new THREE.MeshToonMaterial({ color: 0xffffff, gradientMap: gradient });
  patchFoliage(foliage, u);
  const structure = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: gradient });
  patchStructure(structure, u, false);
  const glow = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: gradient });
  patchStructure(glow, u, true);
  const water = createWaterMaterial(u);
  const shore = createShoreMaterial(u);
  const cables = new THREE.LineBasicMaterial({ color: LANDMARK.cable, transparent: true, opacity: 0.95 });
  const blob = createBlobMaterial(u);
  const cloud = createCloudMaterial(u);
  const cableDay = new THREE.Color(LANDMARK.cable);
  const cableNight = new THREE.Color('#8FA6D8');
  const all: THREE.Material[] = [ground, shore, building, buildingDepth, water, foliage, structure, glow, cables, blob, cloud];
  return {
    gradient,
    ground,
    shore,
    building,
    buildingDepth,
    water,
    foliage,
    structure,
    glow,
    cables,
    blob,
    cloud,
    update(night: number) {
      cables.color.copy(cableDay).lerp(cableNight, night);
    },
    dispose() {
      for (const m of all) m.dispose();
      gradient.dispose();
    },
  };
}
