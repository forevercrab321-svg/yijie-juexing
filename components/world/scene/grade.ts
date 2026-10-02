/**
 * 全局色调映射：「近似直通 + 柔和高光肩」。
 *
 * 为什么不直接用 NeutralToneMapping（指南 5.2 的起点）：Neutral 从 0.76 起就开始压高光，
 * 而这一版的色板几乎全是接近白的粉彩（奶油墙 #FFF3DE 的 R 通道就是 1.0）——Neutral 下奶油墙会掉到 #F0E5D1 一带，
 * 「受光面取色 ≈ 色板（每通道误差 ≤ 10/255）」这条验收永远过不了。指南也允许「直接退回 Neutral 或只做轻调色」，
 * 这里取更直接的一种：0.86 以下原样输出（色板颜色进去什么出来什么），只有峰值通道超过 0.86 时按 Neutral 同款的
 * 有理函数平滑压到 1，夜里的窗灯、徽章光晕、升级曝光闪不会硬切成一块死白。按峰值等比缩放，色相不变。
 *
 * 写进色调映射而不是做后处理：three 的每个材质（含 ShaderMaterial）在片元末尾都会调用 toneMapping()，
 * 等于一个零 draw call、零渲染目标、手机也能开的调色 pass（简报 7.1：手机 0 个后处理 pass）。
 * 注意：three 在色调映射之后才混雾，雾色要按显示空间直接给。
 */
import * as THREE from 'three';

const MARK = '/* yj-cute-tone-v1 */';
const PLACEHOLDER = 'vec3 CustomToneMapping( vec3 color ) { return color; }';

const GRADE_GLSL = /* glsl */ `${MARK}
vec3 CustomToneMapping( vec3 color ) {
	color = max( color * toneMappingExposure, vec3( 0.0 ) );
	float peak = max( color.r, max( color.g, color.b ) );
	const float K = 0.86;
	if ( peak <= K ) return color;
	float d = 1.0 - K;
	float np = 1.0 - d * d / ( peak + d - K );
	return color * ( np / peak );
}`;

// 旧版（大地色方向）的调色标记：同一页面里 2D ↔ 3D 来回切时可能已经装过，要先认出来
const OLD_MARK = '/* yj-grade-v1 */';

/** 只需调用一次；重复挂载 3D 世界（2D ↔ 3D 来回切）时是空操作 */
export function installGrade(): void {
  const chunk = THREE.ShaderChunk.tonemapping_pars_fragment;
  if (chunk.includes(MARK) || chunk.includes(OLD_MARK) || !chunk.includes(PLACEHOLDER)) return;
  THREE.ShaderChunk.tonemapping_pars_fragment = chunk.replace(PLACEHOLDER, GRADE_GLSL);
}

/** 占位符没找到（three 升级改了写法）时退回 Neutral：画面会略灰，但不会坏 */
export function gradeToneMapping(): THREE.ToneMapping {
  return THREE.ShaderChunk.tonemapping_pars_fragment.includes(MARK) ? THREE.CustomToneMapping : THREE.NeutralToneMapping;
}
