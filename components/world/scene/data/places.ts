/**
 * 程序化纽约用到的真实地点数据（经纬度或曼哈顿网格坐标）。
 *
 * 只收「辨识度」需要的东西：公园、百老汇斜线、地标、桥。不追求逐栋准确——
 * 简报 10 节的辨识度优先级是：中央公园 > 岛形与两河 > 29° 街网 > 中城/下城双峰 > 帝国大厦尖顶 > 布鲁克林大桥 > 时代广场广告牌。
 */

export type LatLon = readonly [number, number];

/** 网格矩形：s 为街号区间，a 为距第五大道向西的米数区间 */
export interface GridRect {
  s0: number;
  s1: number;
  a0: number;
  a1: number;
}

/** 曼哈顿主要大道（距第五大道中心线向西的米数）与路宽。按 a 从东到西排序 */
export const AVENUES: readonly { name: string; a: number; width: number }[] = [
  { name: 'Ave D', a: -1683, width: 24 },
  { name: 'Ave C', a: -1483, width: 24 },
  { name: 'Ave B', a: -1283, width: 24 },
  { name: 'York / Ave A', a: -1083, width: 26 },
  { name: '1st', a: -885, width: 30 },
  { name: '2nd', a: -687, width: 30 },
  { name: '3rd', a: -501, width: 30 },
  { name: 'Lexington', a: -373, width: 24 },
  { name: 'Park', a: -250, width: 42 },
  { name: 'Madison', a: -128, width: 24 },
  { name: '5th', a: 0, width: 30 },
  { name: '6th', a: 280, width: 30 },
  { name: '7th', a: 560, width: 30 },
  { name: '8th / CPW', a: 840, width: 30 },
  { name: '9th / Columbus', a: 1084, width: 30 },
  { name: '10th / Amsterdam', a: 1328, width: 30 },
  { name: '11th / West End', a: 1572, width: 30 },
  { name: '12th / Riverside', a: 1816, width: 30 },
];

/** 宽街（100 ft）：横跨全岛的主干道，街区之间留出更宽的缝，俯瞰时能读出节奏 */
export const WIDE_STREETS = new Set([14, 23, 34, 42, 57, 59, 72, 79, 86, 96, 106, 110, 116, 125]);

/** 百老汇：唯一斜穿网格的大道，经过时代广场、先驱广场、麦迪逊广场、联合广场 */
export const BROADWAY: readonly LatLon[] = [
  [40.705, -74.0137], // 保龄球绿地
  [40.7081, -74.0118], // 华尔街口
  [40.7128, -74.0067], // 市政厅公园
  [40.7194, -74.0014], // 运河街
  [40.7253, -73.9967], // 休斯顿街
  [40.7323, -73.9909], // 10 街拐点
  [40.7352, -73.9906], // 联合广场
  [40.7411, -73.9896], // 麦迪逊广场 / 熨斗大厦
  [40.7497, -73.9878], // 先驱广场
  [40.758, -73.9855], // 时代广场
  [40.7681, -73.9819], // 哥伦布圆环
  [40.7734, -73.9821],
  [40.7787, -73.9819],
  [40.7834, -73.98],
  [40.7886, -73.9767],
  [40.7939, -73.9725],
  [40.8027, -73.966],
  [40.8078, -73.9638],
];

/** 中央公园（网格坐标）：59 街到 110 街，第五大道到中央公园西大道 */
export const CENTRAL_PARK: GridRect = { s0: 59.18, s1: 109.82, a0: 16, a1: 824 };

/** 公园内的水面（网格坐标的椭圆，superellipse 指数 e 越大越方） */
export const CP_WATERS: readonly { s: number; a: number; rs: number; ra: number; e: number; name: string }[] = [
  { name: 'Reservoir', s: 90.9, a: 440, rs: 4.75, ra: 285, e: 2.6 },
  { name: 'The Lake', s: 75.4, a: 560, rs: 2.6, ra: 150, e: 2.0 },
  { name: 'Harlem Meer', s: 107.9, a: 165, rs: 1.6, ra: 140, e: 2.2 },
  { name: 'The Pond', s: 60.5, a: 130, rs: 0.9, ra: 95, e: 2.0 },
  { name: 'Turtle Pond', s: 79.6, a: 350, rs: 0.45, ra: 70, e: 2.0 },
  { name: 'Conservatory Water', s: 74.0, a: 85, rs: 0.5, ra: 42, e: 3.0 },
];

/** 公园里的大草坪：不种树，俯瞰时形成可辨认的空地 */
export const CP_LAWNS: readonly { s: number; a: number; rs: number; ra: number; e: number }[] = [
  { s: 83.0, a: 450, rs: 2.4, ra: 165, e: 2.2 }, // Great Lawn
  { s: 67.8, a: 600, rs: 1.6, ra: 120, e: 2.4 }, // Sheep Meadow
  { s: 99.6, a: 450, rs: 2.2, ra: 190, e: 2.6 }, // North Meadow
  { s: 72.6, a: 330, rs: 0.6, ra: 55, e: 2.0 }, // Bethesda Terrace 广场
];

/** 网格内的其他公园与广场 */
export const GRID_PARKS: readonly (GridRect & { name: string; trees: number })[] = [
  { name: 'Bryant Park', s0: 40.2, s1: 41.8, a0: 150, a1: 268, trees: 0.6 },
  { name: 'Madison Square Park', s0: 23.2, s1: 25.8, a0: -116, a1: -14, trees: 0.8 },
  { name: 'Union Square', s0: 14.2, s1: 16.8, a0: -240, a1: -100, trees: 0.6 },
  { name: 'Tompkins Square Park', s0: 7.2, s1: 9.8, a0: -1270, a1: -1096, trees: 0.9 },
  { name: 'Stuyvesant Square', s0: 15.2, s1: 16.8, a0: -655, a1: -560, trees: 0.8 },
  { name: 'Morningside Park', s0: 110.2, s1: 122.8, a0: 1110, a1: 1215, trees: 0.9 },
  { name: 'Marcus Garvey Park', s0: 120.2, s1: 123.8, a0: -122, a1: -8, trees: 0.9 },
  { name: 'DeWitt Clinton Park', s0: 52.2, s1: 53.8, a0: 1590, a1: 1790, trees: 0.6 },
];

/** 不在网格里的公园（经纬度多边形） */
export const POLY_PARKS: readonly { name: string; ring: readonly LatLon[]; trees: number }[] = [
  {
    name: 'Battery Park',
    ring: [
      [40.7063, -74.0183],
      [40.7048, -74.0142],
      [40.7029, -74.0126],
      [40.7006, -74.0137],
      [40.7002, -74.0168],
      [40.7026, -74.0195],
    ],
    trees: 0.8,
  },
  {
    name: 'Washington Square Park',
    ring: [
      [40.7322, -73.9993],
      [40.7317, -73.9958],
      [40.7296, -73.9952],
      [40.7300, -73.9988],
    ],
    trees: 0.7,
  },
  {
    name: 'City Hall Park',
    ring: [
      [40.7140, -74.0066],
      [40.7133, -74.0045],
      [40.7116, -74.0061],
      [40.7122, -74.0079],
    ],
    trees: 0.7,
  },
  {
    name: 'Brooklyn Bridge Park',
    ring: [
      [40.7045, -73.9915],
      [40.7038, -73.9948],
      [40.7005, -73.9978],
      [40.6955, -74.0003],
      [40.6948, -73.9985],
      [40.6998, -73.9955],
      [40.7030, -73.9925],
    ],
    trees: 0.6,
  },
  {
    name: 'Liberty State Park',
    ring: [
      [40.7120, -74.0450],
      [40.7080, -74.0400],
      [40.6960, -74.0480],
      [40.6930, -74.0620],
      [40.7050, -74.0640],
    ],
    trees: 0.5,
  },
  {
    name: 'Prospect Park',
    ring: [
      [40.6730, -73.9700],
      [40.6640, -73.9610],
      [40.6520, -73.9650],
      [40.6500, -73.9740],
      [40.6620, -73.9800],
    ],
    trees: 0.6,
  },
];

/** 帝国大厦（第五大道 × 34 街）：中城天际线最可辨认的尖顶 */
export const EMPIRE_STATE: LatLon = [40.74844, -73.98566];
/** 克莱斯勒大厦（列克星敦大道 × 42 街）：阶梯式拱冠 */
export const CHRYSLER: LatLon = [40.75162, -73.97545];
/** 世贸一号楼：下城天际线的锚点 */
export const ONE_WTC: LatLon = [40.71274, -74.01338];
/** 9/11 纪念池（两个方形水池） */
export const WTC_POOLS: readonly LatLon[] = [
  [40.71166, -74.01318],
  [40.71088, -74.01405],
];
/** 自由女神像（自由岛，世界范围外，但总览时能看见） */
export const LIBERTY: LatLon = [40.68925, -74.0445];
/** 「亿万富翁街」的细高楼群，中央公园南缘的天际线特征 */
export const PENCIL_TOWERS: readonly { at: LatLon; height: number; w: number; d: number }[] = [
  { at: [40.7663, -73.9810], height: 405, w: 26, d: 24 }, // Central Park Tower
  { at: [40.7646, -73.9772], height: 380, w: 18, d: 16 }, // 111 W 57th
  { at: [40.7616, -73.9718], height: 370, w: 24, d: 24 }, // 432 Park
];

/** 时代广场（领结形广场）的网格范围：42 街到 47 街，百老汇与第七大道交汇 */
export const TIMES_SQUARE = { s0: 42.1, s1: 47.2, a7: 560 } as const;

/** 悬索桥：中心点、方位角（从曼哈顿一端指向对岸，度，顺时针自正北）、主跨与边跨（米） */
export interface BridgeSpec {
  name: string;
  center: LatLon;
  bearing: number;
  mainSpan: number;
  sideSpan: number;
  approach: number;
  deckHeight: number;
  towerHeight: number;
  width: number;
  style: 'stone' | 'steel';
}

export const BRIDGES: readonly BridgeSpec[] = [
  {
    name: 'Brooklyn Bridge',
    // 以公开资料里的桥中点为锚（q3 委托也取自这个点），塔位由 LandIndex 按实测河宽沿桥轴校正
    center: [40.7061, -73.9969],
    bearing: 136,
    mainSpan: 486,
    sideSpan: 283,
    approach: 330,
    deckHeight: 41,
    towerHeight: 92,
    width: 26,
    style: 'stone',
  },
  {
    name: 'Manhattan Bridge',
    center: [40.7075, -73.9905],
    bearing: 152,
    mainSpan: 448,
    sideSpan: 220,
    approach: 380,
    deckHeight: 41,
    towerHeight: 102,
    width: 30,
    style: 'steel',
  },
  {
    name: 'Williamsburg Bridge',
    center: [40.7135, -73.9725],
    bearing: 112,
    mainSpan: 488,
    sideSpan: 182,
    approach: 520,
    deckHeight: 41,
    towerHeight: 100,
    width: 34,
    style: 'steel',
  },
];
