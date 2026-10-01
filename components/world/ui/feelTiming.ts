/**
 * 结算时刻的节拍表（毫秒）。零点 = 结算演出出现的那一刻，也就是 App 发出 celebrate 的同一刻。
 *
 * 结算讲的是「记账 → 升级」：三笔收益一笔一笔落账，停半拍，最后才是升级的高潮。
 * 结算卡（SettlementToast）、顶栏（TopHud）与 3D 场景的 celebrate 各自计时，但都读这张表——
 * 世界的爆发、卡片上「等级提升」砸下来、顶栏等级数字跳动，因此落在同一拍上；
 * 高潮若提前到零点，就会在玩家还在看金币时把最大的反馈用掉，后面的「等级提升」反而像补充说明。
 *
 * 零依赖：3D 分包也 import 它。打包时它留在入口包里，不会把界面代码带进 3D 分包。
 */
export const SETTLE_BEATS = {
  /** 卡片入场后先停一拍，视线落到卡片上了再开始数 */
  countStart: 260,
  /** 每一笔从 0 数到终值的时长 */
  countMs: 520,
  /** 相邻两笔的错开。约每秒 4 拍：三次落账是听得出来的三下，而不是糊成一下 */
  stagger: 240,
  /** 升级高潮。比最后一笔落账（1260）晚 190 ms：高潮前留一口气，就是蓄力 */
  levelUp: 1450,
} as const;

/** 第 i 笔（0 金币、1 信任、2 经验）落账的时刻 */
export const landAt = (i: number): number => SETTLE_BEATS.countStart + i * SETTLE_BEATS.stagger + SETTLE_BEATS.countMs;
