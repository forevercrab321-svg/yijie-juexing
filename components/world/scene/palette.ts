/**
 * 3D 世界色板（docs/studio/style-cute.md 第 5.1 节的唯一落地处）。
 *
 * 为什么白天 / 夜晚各写一套 hex，而不是用灯光把白天的颜色「照暗」：
 * 指南要的夜景是「深海军蓝地图 + 发光的委托标记」，夜间陆地 #1F2C4D 与白天 #C4E8A6 连色相都不同，
 * 单靠一盏偏蓝的月光乘出来要么发黑、要么偏紫。所以每个材质角色都在着色器里按 uNight 在两套反照率之间插值，
 * 灯光只负责明暗关系与冷暖倾向，不负责整体亮度（engine 每帧把顶面受光归一化到 ≈1，见 atmosphere.ts）。
 *
 * 这里全部是 sRGB 写法；进着色器前用 lin() 转线性。界面与 3D 共用的委托类型色与 index.html 的 --quest-* 同值。
 */
import * as THREE from 'three';

const _c = new THREE.Color();
/** sRGB hex → 线性 RGB 三元组（THREE.Color.set 会自动做色彩空间转换） */
export function lin(hex: string): [number, number, number] {
  _c.set(hex);
  return [_c.r, _c.g, _c.b];
}
export function linColor(hex: string): THREE.Color {
  return new THREE.Color(hex);
}

/** 地面分类：顶点上只存分类号，颜色在着色器里按昼夜查表（MeshBuilder 的 aG.x） */
export const GROUND = {
  LAND: 0,
  CITY: 1,
  PARK: 2,
  PATH: 3,
  AVENUE: 4,
  AVENUE_EDGE: 5,
  STREET: 6,
  CURB: 7,
  BEACH: 8,
  PLAZA: 9,
  LAWN: 10,
  POOL_RIM: 11,
} as const;

/** [白天, 夜晚]，下标与 GROUND 一致 */
export const GROUND_COLORS: [string, string][] = [
  ['#C4E8A6', '#1F2C4D'], // 陆地
  ['#DDF0C8', '#24345A'], // 城区地面（街区内）
  ['#8ED46B', '#1E4048'], // 公园
  ['#F6EBC8', '#2C3E68'], // 公园小径
  ['#FFF3C9', '#3B4F7E'], // 主路（大道）
  ['#EBD79B', '#33456F'], // 主路路缘
  ['#FFFCF0', '#2F4170'], // 街道
  ['#E3E8D6', '#2A3A63'], // 街道路缘
  ['#F5E6B0', '#2A3A63'], // 岸滩 / 堤岸
  ['#FFF8E6', '#33466F'], // 广场（时代广场等）
  ['#A6DE84', '#22494F'], // 公园大草坪：比公园浅一档，读出草坪与林地
  ['#E9F2F7', '#2B3D66'], // 纪念池池沿
];

export const WATER = {
  day: '#5DC3F5',
  night: '#13254D',
  /** 卡通波纹线：白天是更浅的水色，夜里是波光蓝 */
  rippleDay: '#9ADDFB',
  rippleNight: '#2D4E8C',
  shallowDay: '#A6E3FA',
  shallowNight: '#24407A',
  foamDay: '#FFFFFF',
  foamNight: '#5C7DB8',
};

/** 建筑：五色墙 / 对应屋顶帽（同一下标）；夜晚屋顶统一 */
export const WALLS_DAY = ['#FFF3DE', '#FFD6C7', '#CDEFDD', '#D3E7FF', '#FFF1A6'];
export const WALLS_NIGHT = ['#434C72', '#4A4470', '#2F4A6A', '#34497A', '#45507A'];
export const ROOFS_DAY = ['#F6C98E', '#FF9F8C', '#7FD3B0', '#8DBDF2', '#F9CF5B'];
export const ROOF_NIGHT = '#2A3860';
export const COPING_DAY = '#FFFFFF';
export const COPING_NIGHT = '#56679A';
export const WINDOW_DAY = '#8FC4EA';
export const WINDOW_NIGHT_OFF = '#2E3B66';
export const LAMP = '#FFD98A';

/** 棒棒糖树：三种树冠绿 + 树干 */
export const CROWNS_DAY = ['#6CC24A', '#4FB359', '#93D46A'];
export const CROWNS_NIGHT = ['#24544F', '#1F4A4A', '#2B5E55'];
export const TRUNK_DAY = '#B57D55';
export const TRUNK_NIGHT = '#3A3550';

/** 地标点缀 */
export const LANDMARK = {
  spire: '#FFC83D',
  tsBlocks: ['#FF8C42', '#F26DAA', '#3BA4F5', '#FFC83D'],
  bridgeTower: '#E8C9A0',
  bridgeDeck: '#FFF3C9',
  cable: '#FFFFFF',
  cream: '#FFF3DE',
  mint: '#7FD3B0',
  mintDeep: '#4FB89A',
  sky: '#8DBDF2',
  steel: '#BFD3EA',
  sand: '#F5E6B0',
  white: '#FFFFFF',
};

/** 天空关键色（昼夜关键帧在 atmosphere.ts） */
export const SKY = {
  dayMid: '#9FD6F7',
  stars: '#FFF6D6',
  moon: '#FFF3C4',
};

/** 委托类型（与界面 --quest-* 同一组 hex）：400 = 3D 徽章底色，600 = 图标色 */
export const QUEST_TYPES: Record<string, { c400: string; c600: string; c50: string; shape: number }> = {
  物资运输: { c400: '#3BA4F5', c600: '#1268B4', c50: '#E8F4FE', shape: 0 },
  魔物讨伐: { c400: '#FF8C42', c600: '#B24A0C', c50: '#FFF0E5', shape: 1 },
  迷宫建设: { c400: '#68C34A', c600: '#3D7A28', c50: '#EEF8EA', shape: 2 },
  异界交涉: { c400: '#F26DAA', c600: '#BE2E70', c50: '#FDEBF3', shape: 3 },
  紧急救援: { c400: '#FF5F5A', c600: '#C4302E', c50: '#FFECEA', shape: 4 },
};
export const QUEST_FALLBACK = QUEST_TYPES['物资运输'];

/** 状态 / 品牌色 */
export const UI = {
  teal400: '#2CC5B0',
  teal600: '#127C6F',
  sun400: '#FFC83D',
  coral500: '#E5484D',
  coral400: '#FF5F5A',
  envoy400: '#F26DAA',
  done: '#C5D3DE',
  doneInk: '#7D8A9C',
  ink: '#1F2D44',
  white: '#FFFFFF',
};

/** 软阴影 / 环境光遮蔽用的藏青（与界面阴影 rgba(31,45,68,…) 同源，不用黑） */
export const SHADOW_INK = '#1F2D44';
