/**
 * 全局调色：把渲染器的色调映射换成「Neutral + 分离色调 + 亮度 S 曲线」。
 *
 * 为什么写进色调映射而不是做后处理：three 的每个材质（含光柱、天空、特效这些 ShaderMaterial）在片元末尾
 * 都会调用 toneMapping()。把调色写进 CustomToneMapping，等于一个零 draw call、零渲染目标、手机也能开的
 * 「调色 pass」——简报 7.1 要求手机 0 个后处理 pass，3D 分包也只剩二十来 KB 余量，EffectComposer 进不来。
 *
 * 调色方向（CLAUDE.md：低饱和、有色阴影、旷野之息）：
 *  - 冷影暖光：暗部往石板蓝偏、亮部往暖米偏。只改色相，按亮度加权的增益约等于 1，不改明暗。
 *  - 对比只做在亮度上：中间调更有体积，但各通道比例不变——饱和度不会被 S 曲线顺手抬高。
 *  - 信号色保护：高饱和像素（光柱的金与赭、界面同源的 token 色）少调甚至不调，token 在屏幕上仍是设计稿的颜色。
 *
 * 注意：three 在色调映射之后才混雾（fog_fragment 在 colorspace_fragment 之后），雾色不经过这里，要按显示空间直接给。
 */
import * as THREE from 'three';

const MARK = '/* yj-grade-v1 */';
const PLACEHOLDER = 'vec3 CustomToneMapping( vec3 color ) { return color; }';

/*
 * 着色器里的步骤（注释写在这里而不是 GLSL 里：模板字符串里的中文会原样打进 3D 分包）：
 *  1. Neutral 负责曝光与高光压缩——它最大程度保留原色，是 M1 选定的基线。
 *  2. 在近似感知空间（γ≈2）里分档：亮暗的划分与 S 曲线都更贴近肉眼。sat 高的像素（信号色）k 变小、少调。
 *  3. 冷影暖光：两组系数按亮度加权（0.2126 / 0.7152 / 0.0722）都约为 1，只改色相不改明暗。
 *  4. 亮度 S 曲线：只缩放亮度，色相与饱和度不动。暗部（趾部）不压——旷野之息的阴影是透气的冷色，不是死黑。
 */
const GRADE_GLSL = /* glsl */ `${MARK}
vec3 CustomToneMapping( vec3 color ) {
	vec3 c = NeutralToneMapping( color );
	vec3 p = sqrt( max( c, vec3( 0.0 ) ) );
	float l = dot( p, vec3( 0.2126, 0.7152, 0.0722 ) );
	float mx = max( p.r, max( p.g, p.b ) );
	float sat = ( mx - min( p.r, min( p.g, p.b ) ) ) / max( mx, 1e-4 );
	float k = 1.0 - 0.75 * smoothstep( 0.42, 0.8, sat );
	vec3 tint = mix( vec3( 0.94, 0.995, 1.10 ), vec3( 1.035, 1.0, 0.935 ), smoothstep( 0.2, 0.62, l ) );
	p *= mix( vec3( 1.0 ), tint, k );
	float l2 = l + ( l * l * ( 3.0 - 2.0 * l ) - l ) * 0.22 * smoothstep( 0.1, 0.4, l );
	p *= l2 / max( l, 1e-4 );
	return clamp( p * p, 0.0, 1.0 );
}`;

/** 只需调用一次；重复挂载 3D 世界（2D ↔ 3D 来回切）时是空操作 */
export function installGrade(): void {
  const chunk = THREE.ShaderChunk.tonemapping_pars_fragment;
  if (chunk.includes(MARK) || !chunk.includes(PLACEHOLDER)) return;
  THREE.ShaderChunk.tonemapping_pars_fragment = chunk.replace(PLACEHOLDER, GRADE_GLSL);
}

/** 占位符没找到（three 升级改了写法）时退回 Neutral，画面至少与 M1 一致 */
export function gradeToneMapping(): THREE.ToneMapping {
  return THREE.ShaderChunk.tonemapping_pars_fragment.includes(MARK) ? THREE.CustomToneMapping : THREE.NeutralToneMapping;
}
