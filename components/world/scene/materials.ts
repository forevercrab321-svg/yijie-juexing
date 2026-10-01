/**
 * 共享材质库。按「角色」而不是按物体建材质：同一角色的所有网格共用一个材质实例，
 * 统一受昼夜 uniform 驱动，draw call 与着色器程序数都可控。
 *
 * 角色：ground（地面/街道/公园，顶点色；夜里路面亮起街灯）· building（实例化楼体，程序化窗户、
 *      屋面材质与女儿墙压顶、屋顶设备箱、檐口线与墩柱、夜间楼层灯带）· water（水面）· shore（岸线浅滩与浪花）
 *      foliage（树，风摆 + 边缘光）· roofProp（水塔等屋顶件）· structure（地标结构，顶点色）
 *      lights（地标夜灯）· lantern（屋顶灯笼）· halo（灯笼光晕）· cables（桥索）· billboard（广告牌）
 *
 * 美术约束（CLAUDE.md）：大地色系、低饱和、有色阴影、柔和边缘光；不要霓虹、不要青紫发光。
 * 全局调色（冷影暖光、亮度 S 曲线）不在这里，在 grade.ts 的色调映射里，对所有材质统一生效。
 */
import * as THREE from 'three';

export interface WorldUniforms {
  uTime: { value: number };
  /** 0 = 白天，1 = 深夜 */
  uNight: { value: number };
  uSkyTop: { value: THREE.Color };
  uSkyHorizon: { value: THREE.Color };
  /** 相机到焦点的距离（米）：光晕等需要按屏幕尺寸补偿的效果用 */
  uCamDist: { value: number };
}

export function createUniforms(): WorldUniforms {
  return {
    uTime: { value: 0 },
    uNight: { value: 0 },
    uSkyTop: { value: new THREE.Color('#8fb0c9') },
    uSkyHorizon: { value: new THREE.Color('#e9dfc9') },
    uCamDist: { value: 1000 },
  };
}

/** 楼体立面风格，写在实例属性 aStyle 里 */
export const STYLE = {
  PUNCHED: 0, // 砖石墙上的独立窗洞
  RIBBON: 1, // 横向带窗
  CURTAIN: 2, // 玻璃幕墙
  BROWNSTONE: 3, // 褐石排屋：窗少而深
  BLANK: 4, // 屋顶机房等无窗体块
} as const;

const HASH_GLSL = /* glsl */ `
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

/*
 * 楼体着色器里 M3 美术加的几段（GLSL 内只留短注释：模板字符串里的中文注释会原样打进 3D 分包，
 * 详细理由写在这里，构建时会被压缩掉）：
 *
 * · 退台接触暗部（bAo *= …）：塔楼压在裙楼屋面上的那一圈也要接地，塔与裙楼才读得出前后。
 *   bReal：非实例化的世贸玻璃塔 vBSize 恒为 1，这些细节都不给它。
 * · 檐口阴影线 + 转角墩柱受光棱：盒体「设计过的边」。宽度按屏幕像素保底约 1.3 px——
 *   默认视角一米不到一个像素，真实尺寸的线脚会直接消失。
 * · 屋顶：俯瞰视角里屋顶占了楼群一半的像素，原先统一成一种暗灰，城市读成「一片盒子」。
 *   现在每栋楼一种屋面（沥青、碎石、石板、陶瓦、铜绿、苔藓，全是低饱和大地色），屋面混入 25% 立面色避免拼布；
 *   女儿墙压顶是比立面略浅的石色，内侧一圈阴影让屋面像是凹进去的；大屋面按每栋楼 5.5–8 m 的网格
 *   随机放空调机组 / 天窗，背光一侧（楼体局部 -z，大致是正午太阳的反方向）画一块投影，读成小盒子而不是白点。
 *   一格小于约 3 像素时淡出，淡没了、屋面太小或是褐石排屋时整段跳过，远景不为看不见的东西算哈希。
 *   fwidth 必须在分支外取：2×2 像素块里屋面与立面混在一起时，分支内的导数是未定义的。
 *   全部在着色器里画，不加几何、不加 draw call。
 * · 夜间窗灯整段在 uNight > 0 时才算：uNight 是 uniform，整帧走同一条分支（分支内 fwidth 仍有定义），白天省掉十来次哈希。
 * · 远景窗灯（窗格小于约 2 像素，默认视角里的立面多半是这一档）：原先整面墙按窗墙比均匀发光，
 *   玻璃幕墙（窗墙比约 0.7）读成「被照亮的砂岩墙」、屋顶却是黑的，像一张反相的白天。现在亮度分布更偏暗（三次方）、
 *   窗墙比封顶 0.42，并按「两层楼一条、长短不一」的横向灯带分暗 / 半亮 / 全亮三档（灯带大于约 2 像素时可见，
 *   再远就平均掉、整体再暗一些），立面读成一条条亮着的办公楼层，而不是方格迷彩。
 */
function patchBuilding(mat: THREE.MeshStandardMaterial, u: WorldUniforms): void {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uNight = u.uNight;
    shader.uniforms.uSkyTop = u.uSkyTop;
    shader.uniforms.uSkyHorizon = u.uSkyHorizon;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        /* glsl */ `#include <common>
attribute float aStyle;
varying vec3 vBLocal;
varying vec3 vBNormal;
// 每栋楼的常量用 flat：普通插值在三角形内部会有 1e-7 级的误差，喂给哈希后会被放大成逐像素的随机数，
// 夜里整面墙的窗灯就变成了细密的噪点（白天看不出来）。flat 直接取顶点值，整栋楼完全一致
flat varying vec3 vBSize;
flat varying float vBSeed;
flat varying float vBStyle;
flat varying float vBBaseY;`,
      )
      .replace(
        '#include <begin_vertex>',
        /* glsl */ `#include <begin_vertex>
#ifdef USE_INSTANCING
  vec3 bScale = vec3(length(instanceMatrix[0].xyz), length(instanceMatrix[1].xyz), length(instanceMatrix[2].xyz));
  vec3 bOrigin = instanceMatrix[3].xyz;
#else
  vec3 bScale = vec3(1.0);
  vec3 bOrigin = vec3(0.0);
#endif
vBLocal = position * bScale;
vBNormal = normal;
vBSize = bScale;
vBSeed = fract(sin(dot(bOrigin.xz, vec2(12.9898, 78.233))) * 43758.5453);
vBStyle = aStyle;
vBBaseY = bOrigin.y;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        /* glsl */ `#include <common>
uniform float uNight;
uniform vec3 uSkyTop;
uniform vec3 uSkyHorizon;
varying vec3 vBLocal;
varying vec3 vBNormal;
flat varying vec3 vBSize;
flat varying float vBSeed;
flat varying float vBStyle;
flat varying float vBBaseY;
${HASH_GLSL}`,
      )
      .replace(
        '#include <color_fragment>',
        /* glsl */ `#include <color_fragment>
vec3 bN = normalize(vBNormal);
float bWall = 1.0 - step(0.5, abs(bN.y));
float bAlong = abs(bN.x) > 0.5 ? vBLocal.z : vBLocal.x;
float bFaceW = abs(bN.x) > 0.5 ? vBSize.z : vBSize.x;
float bY = vBBaseY + vBLocal.y;
float bTop = vBBaseY + vBSize.y;
float bStyle = floor(vBStyle + 0.5);
float bFloorH = mix(3.3, 4.1, fract(vBSeed * 7.13));
float bColW = mix(2.7, 3.7, fract(vBSeed * 3.71));
vec2 bMin = vec2(0.22, 0.30);
vec2 bMax = vec2(0.78, 0.82);
if (bStyle == 1.0) { bMin = vec2(-0.1, 0.32); bMax = vec2(1.1, 0.80); }
if (bStyle == 2.0) { bColW = 1.7; bFloorH = 3.9; bMin = vec2(0.07, 0.08); bMax = vec2(0.93, 0.92); }
if (bStyle == 3.0) { bColW = 3.6; bFloorH = 3.5; bMin = vec2(0.30, 0.26); bMax = vec2(0.70, 0.78); }
// 一楼是店面：更高、更宽的橱窗
float bGround = 1.0 - step(5.2, bY);
float bRowY = bGround > 0.5 ? bY / 5.2 : (bY - 5.2) / bFloorH;
vec2 bCell = vec2((bAlong + bFaceW * 0.5) / (bGround > 0.5 ? 4.6 : bColW), bRowY);
vec2 bF = fract(bCell);
vec2 bId = floor(bCell) + vec2(0.0, bGround > 0.5 ? -7.0 : 0.0);
if (bGround > 0.5) { bMin = vec2(0.08, 0.14); bMax = vec2(0.92, 0.80); }
vec2 bFw = max(fwidth(bCell), vec2(1e-4));
vec2 bW = smoothstep(bMin - bFw, bMin + bFw, bF) * (1.0 - smoothstep(bMax - bFw, bMax + bFw, bF));
// 列与层分开退化：远处先把窗格的列抹平，横向的楼层带保留得更久——横线比网格更耐缩小，不出摩尔纹
vec2 bFadeV = smoothstep(vec2(0.22), vec2(0.55), bFw);
vec2 bCoverV = clamp(bMax - bMin, 0.0, 1.0);
vec2 bWv = mix(bW, bCoverV, bFadeV);
float bWin = bWv.x * bWv.y;
float bFade = max(bFadeV.x, bFadeV.y);
// 窗只在墙面上；女儿墙、转角墩柱与无窗体块不开窗
float bEdge = step(abs(bAlong), bFaceW * 0.5 - 1.1);
bWin *= bWall * bEdge * step(bY, bTop - 1.3) * (bStyle == 4.0 ? 0.0 : 1.0);
// 白天：玻璃明显比墙暗，高层映出更多天色；入夜后窗玻璃本身也暗下去，留给灯光
vec3 bGlass = mix(vec3(0.075, 0.08, 0.085), uSkyHorizon * 0.42, smoothstep(0.0, 160.0, bY) * 0.7 + 0.12);
if (bStyle == 2.0) bGlass = mix(diffuseColor.rgb * 0.42, uSkyHorizon * 0.5, 0.5);
bGlass *= 1.0 - 0.6 * uNight;
diffuseColor.rgb = mix(diffuseColor.rgb, bGlass, bWin * 0.92);
// 墙脚接地暗部 + 屋檐受光：盒体靠这两笔才有体积，不像积木
float bAo = mix(0.58, 1.0, smoothstep(0.0, 11.0, bY));
// 退台接触暗部
float bReal = step(1.5, vBSize.y); // 非实例化的世贸塔不加细节
bAo *= mix(1.0, mix(0.7, 1.0, smoothstep(0.0, 6.0, vBLocal.y)), step(2.0, vBBaseY) * bReal);
diffuseColor.rgb *= mix(1.0, bAo, bWall);
// 入夜后墙面再压暗一档：月光下的石墙退到背景里，暖色窗灯与光柱才是画面的主角
diffuseColor.rgb *= 1.0 - 0.3 * uNight * bWall;
diffuseColor.rgb *= 1.0 + 0.18 * bWall * smoothstep(bTop - 1.3, bTop - 0.4, bY);
// 檐口阴影线、墩柱受光棱（宽度按像素保底）
float bMppY = max(fwidth(bY), 1e-3);
float bCor = bTop - 1.3;
float bCorW = max(0.9, bMppY * 1.3);
float bUnderCor = smoothstep(bCor - bCorW * 2.2, bCor - bCorW, bY) * (1.0 - smoothstep(bCor - bMppY * 0.5, bCor, bY));
diffuseColor.rgb *= 1.0 - 0.22 * bUnderCor * bWall * bReal;
float bCornerD = bFaceW * 0.5 - abs(bAlong);
float bPierW = max(0.7, fwidth(bAlong) * 1.3);
diffuseColor.rgb *= 1.0 + 0.1 * (1.0 - smoothstep(bPierW * 0.55, bPierW, bCornerD)) * bWall * bReal;
// 屋顶：屋面材质、压顶、设备箱
float bRoof = step(0.5, bN.y);
// fwidth 必须在分支外取
vec2 rP = vBLocal.xz;
vec2 rHalf = vBSize.xz * 0.5;
float rE = min(rHalf.x - abs(rP.x), rHalf.y - abs(rP.y));
float rMpp = max(fwidth(rE), 1e-3);
vec2 rCell = rP / mix(5.5, 8.0, fract(vBSeed * 91.3));
vec2 rAa = max(fwidth(rCell), vec2(1e-4));
if (bRoof > 0.5) {
  float rRimW = min(max(0.55, rMpp * 1.4), min(rHalf.x, rHalf.y) * 0.22);
  float rRim = 1.0 - smoothstep(rRimW - rMpp * 0.75, rRimW + rMpp * 0.25, rE);
  float rInner = smoothstep(rRimW, rRimW + rMpp, rE) * (1.0 - smoothstep(rRimW + rMpp, rRimW + max(1.8, rMpp * 2.6), rE));
  float rH1 = fract(vBSeed * 31.7);
  vec3 rBase = rH1 < 0.4 ? vec3(0.235, 0.21, 0.18)      // 沥青油毡
    : rH1 < 0.68 ? vec3(0.4, 0.37, 0.32)                // 浅色碎石
    : rH1 < 0.83 ? vec3(0.155, 0.16, 0.17)              // 石板
    : rH1 < 0.92 ? vec3(0.34, 0.16, 0.095)              // 陶瓦
    : rH1 < 0.96 ? vec3(0.19, 0.25, 0.205)              // 铜绿
    : vec3(0.17, 0.215, 0.115);                         // 苔藓屋面
  if (bStyle == 3.0) rBase = rH1 < 0.55 ? vec3(0.155, 0.16, 0.17) : vec3(0.34, 0.16, 0.095);
  if (bStyle == 2.0) rBase = rH1 < 0.6 ? vec3(0.4, 0.37, 0.32) : vec3(0.235, 0.21, 0.18);
  vec3 rCol = mix(rBase, diffuseColor.rgb * 0.7, 0.25) * (0.9 + 0.16 * yjNoise(rP * 0.3 + vBSeed * 40.0));
  // 设备箱 + 背光投影；太小时跳过
  float rUnitFade = 1.0 - smoothstep(0.22, 0.45, max(rAa.x, rAa.y));
  if (rUnitFade > 0.001 && min(vBSize.x, vBSize.z) >= 14.0 && bStyle != 3.0) {
    vec2 rId = floor(rCell);
    vec2 rF = fract(rCell) - 0.5;
    vec2 rSz = mix(vec2(0.14), vec2(0.36), vec2(yjHash(rId * 1.7 + vBSeed), yjHash(rId * 2.3 + vBSeed * 3.0)));
    float rUnit = (1.0 - smoothstep(rSz.x - rAa.x, rSz.x + rAa.x, abs(rF.x))) * (1.0 - smoothstep(rSz.y - rAa.y, rSz.y + rAa.y, abs(rF.y)));
    vec2 rFs = abs(rF - vec2(-0.03, -0.09));
    float rCast = (1.0 - smoothstep(rSz.x - rAa.x, rSz.x + rAa.x, rFs.x)) * (1.0 - smoothstep(rSz.y - rAa.y, rSz.y + rAa.y, rFs.y)) * (1.0 - rUnit);
    float rOn = step(yjHash(rId + vBSeed * 13.0), 0.24) * step(rRimW + 3.0, rE) * rUnitFade;
    rCol = mix(rCol, vec3(0.43, 0.42, 0.395), rUnit * rOn * 0.7);
    rCol *= 1.0 - 0.32 * rCast * rOn;
  }
  // 压顶 + 内侧阴影
  vec3 rCoping = mix(diffuseColor.rgb, vec3(0.62, 0.58, 0.5), 0.35) * 1.05;
  rCol = mix(rCol, rCoping, rRim * bReal);
  rCol *= 1.0 - 0.28 * rInner * bReal;
  diffuseColor.rgb = rCol;
}
// 夜里亮起的窗：暖色、明暗随机，约六成亮着；一楼店面更亮。
// 白天跳过（uNight 为 uniform）
vec3 bEmit = vec3(0.0);
if (uNight > 0.001) {
float bLitP = bGround > 0.5 ? 0.4 : 0.64;
// 灯按「一层楼里连续的五扇窗」整段亮：远看是一条条暖色的楼层灯带，而不是满墙的噪点
vec2 bStrip = vec2(floor(bId.x / 5.0), bId.y);
float bLit = step(bLitP, yjHash(bStrip + vBSeed * 91.7));
// 近处再让灯带里零星几扇窗暗着，读得出是一扇一扇的窗
bLit *= mix(step(0.18, yjHash(bId * 1.37 + vBSeed * 5.1)), 1.0, bFade);
vec3 bWarm = mix(vec3(1.0, 0.58, 0.28), vec3(1.0, 0.74, 0.46), yjHash(bStrip.yx * 1.31 + vBSeed * 13.1));
float bGain = mix(0.55, 1.1, yjHash(bStrip * 1.7 + vBSeed)) * (1.0 + bGround * 0.6);
vec3 bEmitNear = bWarm * bLit * bGain * bWin * uNight * 0.85;
// 窗格 < 2 px 时切到远景：楼层灯带三档明暗
float bFar = smoothstep(0.4, 0.8, max(bFw.x, bFw.y));
float bBldH = yjHash(vec2(vBSeed * 17.3, vBSeed * 3.7));
float bBld = 0.06 + 0.8 * bBldH * bBldH * bBldH;
float bRowF = bY / 7.4;
float bRowId = floor(bRowF);
float bSegF = (bAlong + bFaceW * 0.5) / mix(18.0, 42.0, yjHash(vec2(bRowId, vBSeed * 3.1)));
float bSegH = yjHash(vec2(floor(bSegF), bRowId) + vBSeed * 7.31);
float bBlk = bSegH < 0.42 ? 0.0 : (bSegH < 0.74 ? 0.5 : 1.0);
float bBlkAvg = smoothstep(0.3, 0.6, max(fwidth(bSegF) * 0.5, fwidth(bRowF)));
bBlk = mix(bBlk, 0.42, bBlkAvg);
vec3 bEmitFar = vec3(1.0, 0.64, 0.34) * bBld * min(bWin, 0.42) * uNight * (0.2 + 1.3 * bBlk) * (1.0 - 0.15 * bBlkAvg);
bEmit = mix(bEmitNear, bEmitFar, bFar);
}`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        /* glsl */ `#include <roughnessmap_fragment>
roughnessFactor = mix(roughnessFactor, 0.34, bWin * (1.0 - bFade * 0.6));`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        /* glsl */ `#include <emissivemap_fragment>
totalEmissiveRadiance += bEmit;`,
      );
  };
  mat.customProgramCacheKey = () => 'yj-building-v3';
}

/*
 * 地面着色器里 M3 美术加的几段（理由写在这里，GLSL 内只留短注释，原因见 patchBuilding 上方）：
 * · 地面是一个顶点色网格：按反照率认出「田野」与「沥青路面」（city.ts 的调色板里只有它们落在这两个亮度 / 饱和度区间），
 *   不需要额外的顶点属性。
 * · 外围田野再加一层大尺度的「草甸 / 枯草」色块：总览时城外不再是一整块平涂的橄榄色。
 * · 夜里街道亮起暖色路灯：俯瞰时城市是一张发光的街网，而不是一片漆黑（夜景总览原先约 70% 的像素是同一种黑）。
 *   路灯沿曼哈顿街网每 26 m 一盏；一盏灯小于约 4 像素时退成均匀的路面暖光，不闪。白天整段跳过。
 */
function patchGround(mat: THREE.MeshStandardMaterial, u: WorldUniforms): void {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uNight = u.uNight;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vGWorld;')
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvGWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;',
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform float uNight;\nvarying vec3 vGWorld;\n${HASH_GLSL}`)
      .replace(
        '#include <color_fragment>',
        /* glsl */ `#include <color_fragment>
// 按反照率识别田野 / 沥青
float gLum = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));
float gMx = max(diffuseColor.r, max(diffuseColor.g, diffuseColor.b));
float gSat = (gMx - min(diffuseColor.r, min(diffuseColor.g, diffuseColor.b))) / max(gMx, 1e-4);
float gStreet = smoothstep(0.075, 0.09, gLum) * (1.0 - smoothstep(0.145, 0.16, gLum)) * (1.0 - smoothstep(0.38, 0.45, gSat));
float gField = (1.0 - smoothstep(0.012, 0.03, abs(gLum - 0.2455))) * step(diffuseColor.b, diffuseColor.r * 0.7);
// 两个尺度的低频斑驳：打破大片纯色，田野读起来像草地而不是塑料
float gN = yjNoise(vGWorld.xz / 37.0) * 0.6 + yjNoise(vGWorld.xz / 160.0) * 0.4;
diffuseColor.rgb *= 0.9 + 0.2 * gN;
float gL = yjNoise(vGWorld.xz / 1300.0) * 0.65 + yjNoise(vGWorld.xz / 520.0) * 0.35;
diffuseColor.rgb *= mix(vec3(0.86, 0.9, 0.82), vec3(1.08, 1.04, 0.94), gL);
// 外围草甸 / 枯草色块
float gM = yjNoise(vGWorld.xz / 1900.0 + 7.3) * 0.7 + yjNoise(vGWorld.xz / 420.0 - 3.1) * 0.3;
vec3 gMeadow = mix(vec3(0.165, 0.21, 0.09), vec3(0.33, 0.27, 0.125), smoothstep(0.3, 0.72, gM));
diffuseColor.rgb = mix(diffuseColor.rgb, gMeadow * (0.92 + 0.16 * gN), gField * 0.55);`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        /* glsl */ `#include <emissivemap_fragment>
// 夜间街灯（白天跳过）
if (uNight > 0.001) {
  const vec2 G_UP = vec2(0.48481, -0.87462);
  const vec2 G_WEST = vec2(-0.87462, -0.48481);
  vec2 gLampC = vec2(dot(vGWorld.xz, G_UP), dot(vGWorld.xz, G_WEST)) / 26.0;
  vec2 gLampFw = fwidth(gLampC);
  float gLampD = length(fract(gLampC) - 0.5) * 26.0;
  float gLamp = 1.0 - smoothstep(1.2, 2.6, gLampD);
  gLamp = mix(gLamp, 0.08, smoothstep(0.12, 0.25, max(gLampFw.x, gLampFw.y)));
  totalEmissiveRadiance += vec3(1.0, 0.6, 0.28) * gStreet * uNight * (0.07 + 0.5 * gLamp);
}`,
      );
  };
  mat.customProgramCacheKey = () => 'yj-ground-v3';
}

/*
 * 夜间波光（M3 美术）：6 m 一格、约一半的格子里有一个随机位置的光点，各自按随机节奏闪一下，读成水面映出的点点灯火。
 * 原先是对 20 m 尺度的值噪声取阈值，中景里是一片片形状不规则的米色斑块，像漂着的纸片。
 * 光点半径至少约一个像素；格子小于约 2 像素时整体淡出（再远就只剩闪烁的噪点）。白天整段跳过。
 */
function patchWater(mat: THREE.MeshStandardMaterial, u: WorldUniforms): void {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = u.uTime;
    shader.uniforms.uNight = u.uNight;
    shader.uniforms.uSkyTop = u.uSkyTop;
    shader.uniforms.uSkyHorizon = u.uSkyHorizon;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWWorld;')
      .replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvWWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;',
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        /* glsl */ `#include <common>
uniform float uTime;
uniform float uNight;
uniform vec3 uSkyTop;
uniform vec3 uSkyHorizon;
varying vec3 vWWorld;
${HASH_GLSL}`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        /* glsl */ `#include <normal_fragment_maps>
// 三层波纹的解析梯度：大涌、风纹、细碎反光。只扰动法线，不动几何
vec2 wp = vWWorld.xz;
float t = uTime;
vec2 g = vec2(0.0);
g += vec2(cos(wp.x * 0.021 + t * 0.6), cos(wp.y * 0.017 - t * 0.5)) * 0.35;
g += vec2(cos((wp.x + wp.y) * 0.067 + t * 1.3), cos((wp.x - wp.y) * 0.059 - t * 1.1)) * 0.22;
g += (vec2(yjNoise(wp * 0.11 + t * 0.4), yjNoise(wp.yx * 0.13 - t * 0.35)) - 0.5) * 0.5;
vec3 wPerturb = (viewMatrix * vec4(g.x, 0.0, g.y, 0.0)).xyz;
normal = normalize(normal + wPerturb * 0.22);`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        /* glsl */ `#include <emissivemap_fragment>
// 没有环境贴图，天空的反射由菲涅尔项补上；夜里再加城市灯火映在水面上的点点波光
float wFres = pow(1.0 - saturate(dot(normal, normalize(vViewPosition))), 4.0);
vec3 wSky = mix(uSkyHorizon, uSkyTop, 0.35);
totalEmissiveRadiance += wSky * wFres * 0.55 * (1.0 - 0.6 * uNight);
// 夜间点状波光（白天跳过）
if (uNight > 0.001) {
  vec2 wgC = vWWorld.xz / 6.0;
  vec2 wgId = floor(wgC);
  float wgH = yjHash(wgId * 1.31 + 0.7);
  vec2 wgP = vec2(yjHash(wgId + 7.1), yjHash(wgId + 3.7)) - 0.5;
  float wgD = length((fract(wgC) - 0.5 - wgP * 0.7) * 6.0);
  float wgR = max(0.45, length(fwidth(vWWorld.xz)) * 0.8);
  float wgTw = pow(max(sin(uTime * (1.3 + 2.2 * wgH) + wgH * 40.0), 0.0), 5.0);
  float wGlint = (1.0 - smoothstep(wgR * 0.35, wgR, wgD)) * step(0.5, wgH) * wgTw;
  wGlint *= 1.0 - smoothstep(0.25, 0.5, length(fwidth(wgC)));
  totalEmissiveRadiance += vec3(1.0, 0.7, 0.4) * wGlint * uNight * 0.9;
}`,
      );
  };
  mat.customProgramCacheKey = () => 'yj-water-v2';
}

function patchFoliage(mat: THREE.MeshStandardMaterial, u: WorldUniforms): void {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = u.uTime;
    shader.uniforms.uNight = u.uNight;
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;').replace(
      '#include <begin_vertex>',
      /* glsl */ `#include <begin_vertex>
#ifdef USE_INSTANCING
  float fPhase = instanceMatrix[3].x * 0.05 + instanceMatrix[3].z * 0.037;
#else
  float fPhase = 0.0;
#endif
float fH = max(position.y - 0.3, 0.0);
transformed.x += sin(uTime * 1.3 + fPhase) * 0.045 * fH;
transformed.z += cos(uTime * 1.05 + fPhase) * 0.03 * fH;`,
    );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uNight;')
      .replace(
        '#include <emissivemap_fragment>',
        /* glsl */ `#include <emissivemap_fragment>
// 旷野之息式的柔和边缘光：树冠轮廓透一点暖光，从背景里浮出来
float fRim = pow(1.0 - saturate(dot(normal, normalize(vViewPosition))), 3.0);
totalEmissiveRadiance += diffuseColor.rgb * fRim * mix(0.35, 0.12, uNight);`,
      );
  };
  mat.customProgramCacheKey = () => 'yj-foliage-v1';
}

/** 屋顶灯笼光晕：实例化的朝向相机的面片，径向衰减，叠加混合。只在入夜后可见 */
function createHaloMaterial(u: WorldUniforms): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uNight: u.uNight, uCamDist: u.uCamDist, uTime: u.uTime },
    vertexShader: /* glsl */ `
uniform float uCamDist;
uniform float uTime;
varying vec2 vUv;
varying float vFlicker;
varying float vFar;
void main() {
  vUv = uv;
  vec3 center = instanceMatrix[3].xyz;
  float base = length(instanceMatrix[0].xyz);
  // 按距离放大，远看仍是可见的光点；近看不至于糊成一片。
  // 拉远到总览时放大变缓、亮度减半：几百盏灯笼不再连成一片光斑，抢走光柱的视觉层级
  float far = smoothstep(3000.0, 12000.0, uCamDist);
  float size = max(base, uCamDist * 0.011 * mix(1.0, 0.5, far));
  vec4 mv = modelViewMatrix * vec4(center, 1.0);
  // 面片朝相机挪半个尺寸：下半圈不再被灯笼所在的屋顶裁掉（远看不会变成一排半圆）
  mv.z += size * 0.5;
  mv.xy += (uv - 0.5) * size;
  vFlicker = 0.85 + 0.15 * sin(uTime * 3.1 + center.x * 0.37 + center.z * 0.21);
  vFar = far;
  gl_Position = projectionMatrix * mv;
}`,
    fragmentShader: /* glsl */ `
uniform float uNight;
varying vec2 vUv;
varying float vFlicker;
varying float vFar;
void main() {
  float d = length(vUv - 0.5) * 2.0;
  float a = pow(max(1.0 - d, 0.0), 2.2);
  gl_FragColor = vec4(vec3(1.0, 0.62, 0.3) * a * uNight * vFlicker * mix(2.0, 1.0, vFar), 1.0);
  // 直接上屏时由这两段做色调映射与 sRGB；渲染到后处理目标时 three 会让它们变成空操作
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false,
  });
}

/**
 * 岸线：沿全部海岸 / 湖岸画一条「浅滩 + 浪花」的半透明带。俯瞰地图里水陆交界是读岛形与河道的第一条线索，
 * 原先只有 3 m 高的堤岸侧壁，默认视角一两个像素、总览时完全看不见。
 * 带宽约 0.011 × 相机距离：俯视地面再打一次透视折扣后，浪花线在任何缩放下都有两三个像素；外缘渐隐到水面本色，不受光照。
 * 浪花线贴着岸、随噪声轻轻起伏。夜里换成一道暗暖的沙色（岸上灯火照着的碎浪），夜景总览里岛形仍读得出来；
 * 亮度与饱和度都压得很低，读成水边的微光，不是描边的霓虹（美术方向禁霓虹）。
 */
function createShoreMaterial(u: WorldUniforms): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
      uCamDist: u.uCamDist,
      uNight: u.uNight,
      uTime: u.uTime,
      uFoam: { value: new THREE.Color('#d8d3bf') },
      uShallow: { value: new THREE.Color('#6d887a') },
    },
    vertexShader: /* glsl */ `
attribute vec2 aOut;
attribute float aSide;
uniform float uCamDist;
varying float vSide;
varying vec2 vSWorld;
#include <fog_pars_vertex>
void main() {
  float w = clamp(uCamDist * 0.011, 9.0, 170.0);
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
uniform vec3 uFoam;
uniform vec3 uShallow;
varying float vSide;
varying vec2 vSWorld;
${HASH_GLSL}
#include <fog_pars_fragment>
void main() {
  float n = yjNoise(vSWorld / 38.0 + vec2(uTime * 0.06, -uTime * 0.045));
  float foam = 1.0 - smoothstep(0.1 + 0.1 * n, 0.34 + 0.1 * n, vSide);
  float shallow = 1.0 - smoothstep(0.1, 1.0, vSide);
  vec3 col = mix(mix(uShallow, uFoam, foam), vec3(0.3, 0.21, 0.13) * (0.35 + 0.65 * foam), uNight);
  gl_FragColor = vec4(col, max(foam * 0.55, shallow * 0.3 * (1.0 - 0.6 * uNight)));
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`,
    transparent: true,
    depthWrite: false,
    // 外环与内环（湖岸）的走向相反，三角形的正反面各占一半：双面画，省得逐环判断绕向
    side: THREE.DoubleSide,
    // 再往相机方向偏一点深度：不同 GPU 的深度缓冲精度不一，岸线始终压在水面之上
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -4,
    fog: true,
  });
}

export interface MaterialKit {
  ground: THREE.MeshStandardMaterial;
  /** 岸线浅滩与浪花 */
  shore: THREE.ShaderMaterial;
  building: THREE.MeshStandardMaterial;
  /** 世贸一号楼等非实例化玻璃楼：与楼体同一套窗户着色器（共享程序），只是底色不同 */
  landmarkGlass: THREE.MeshStandardMaterial;
  water: THREE.MeshStandardMaterial;
  foliage: THREE.MeshStandardMaterial;
  roofProp: THREE.MeshStandardMaterial;
  structure: THREE.MeshStandardMaterial;
  lights: THREE.MeshStandardMaterial;
  lantern: THREE.MeshStandardMaterial;
  halo: THREE.ShaderMaterial;
  cables: THREE.LineBasicMaterial;
  billboard: THREE.MeshBasicMaterial;
  /** 每帧按昼夜更新非 uniform 驱动的参数 */
  update(night: number): void;
  dispose(): void;
}

export function createMaterials(u: WorldUniforms): MaterialKit {
  const ground = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, metalness: 0 });
  patchGround(ground, u);
  const building = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.84, metalness: 0 });
  patchBuilding(building, u);
  const landmarkGlass = new THREE.MeshStandardMaterial({ color: '#a7aeae', roughness: 0.5, metalness: 0 });
  patchBuilding(landmarkGlass, u);
  // 水色偏石板绿而不是青：冷调的阴影调色会把偏青的水推向青色（美术方向禁青紫）
  const water = new THREE.MeshStandardMaterial({ color: '#4a655d', roughness: 0.2, metalness: 0 });
  patchWater(water, u);
  const foliage = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0 });
  patchFoliage(foliage, u);
  const roofProp = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0 });
  const structure = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, metalness: 0.05 });
  // 地标夜灯的底色是浅石色：帝国大厦冠顶这类整段泛光的部件白天要读成石砌，而不是一圈深色带子
  const lights = new THREE.MeshStandardMaterial({
    color: '#cdbf9f',
    emissive: '#ffcb80',
    emissiveIntensity: 0.06,
    roughness: 0.6,
  });
  const lantern = new THREE.MeshStandardMaterial({
    color: '#e6cfa2',
    emissive: '#ffb45c',
    emissiveIntensity: 0.15,
    roughness: 0.7,
  });
  const halo = createHaloMaterial(u);
  const cables = new THREE.LineBasicMaterial({ color: '#5d564c', transparent: true, opacity: 0.85 });
  const billboard = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const shore = createShoreMaterial(u);
  const all: THREE.Material[] = [ground, shore, building, landmarkGlass, water, foliage, roofProp, structure, lights, lantern, halo, cables, billboard];
  return {
    ground,
    shore,
    building,
    landmarkGlass,
    water,
    foliage,
    roofProp,
    structure,
    lights,
    lantern,
    halo,
    cables,
    billboard,
    update(night: number) {
      // 灯笼与地标夜灯：白天几乎不亮（纸灯笼的米色），入夜后成为城市的暖色节点
      lantern.emissiveIntensity = 0.12 + night * 2.6;
      lights.emissiveIntensity = 0.06 + night * 1.6;
      // 广告牌白天正常显色，夜里提亮成「被灯照亮的招牌」，但不过曝成霓虹
      const k = 0.95 + night * 1.75;
      billboard.color.setRGB(k, k, k);
      // 夜里桥索偏暗，不和光柱抢对比
      cables.opacity = 0.85 - night * 0.35;
    },
    dispose() {
      for (const m of all) m.dispose();
    },
  };
}
