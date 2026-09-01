/**
 * 相貌抽取。
 *
 * 转生这件事轮不到自己挑长相——种族与立绘都由系统随机分配，玩家可以重抽。
 * 立绘是现成的图片文件，不经过任何模型生成，也就不涉及任何个人数据。
 *
 * 图库规格见 public/assets/avatars/README.md。
 */

import { Race } from '../types';
import { RACE_CONFIG } from '../constants';

/**
 * 每个种族的立绘数量。
 *
 * 文件命名：`public/assets/avatars/{key}-{01..N}.jpg`，
 * 例如 slime-01.jpg … slime-04.jpg。加图时改这个数字即可，代码无需改动。
 */
export const VARIANTS_PER_RACE = 4;

export interface AvatarRoll {
  race: Race;
  /** 立绘路径，形如 /assets/avatars/kijin-03.jpg */
  avatarUrl: string;
  /** 第几张变体，1 起 */
  variant: number;
}

const ALL_RACES = Object.values(Race);

export function avatarPath(race: Race, variant: number): string {
  const key = RACE_CONFIG[race].key;
  return `/assets/avatars/${key}-${String(variant).padStart(2, '0')}.jpg`;
}

/**
 * 抽一次相貌。
 *
 * @param exclude 上一次的结果。传入后会避开完全相同的组合，
 *                避免连点两次重抽却没有任何变化——那看起来像卡住了。
 */
export function rollAvatar(exclude?: AvatarRoll): AvatarRoll {
  const totalCombos = ALL_RACES.length * VARIANTS_PER_RACE;

  for (let attempt = 0; attempt < 12; attempt++) {
    const race = ALL_RACES[Math.floor(Math.random() * ALL_RACES.length)];
    const variant = 1 + Math.floor(Math.random() * VARIANTS_PER_RACE);

    const isSame = exclude && exclude.race === race && exclude.variant === variant;
    // 只有一种组合时无从避开，直接返回
    if (!isSame || totalCombos <= 1) {
      return { race, variant, avatarUrl: avatarPath(race, variant) };
    }
  }

  // 理论上到不了这里，兜底保证一定有结果
  const race = ALL_RACES[0];
  return { race, variant: 1, avatarUrl: avatarPath(race, 1) };
}
