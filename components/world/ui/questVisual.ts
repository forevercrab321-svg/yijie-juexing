import type { LucideIcon } from 'lucide-react';
import { Hammer, HeartPulse, MessageCircleHeart, Package, Swords } from 'lucide-react';
import type { Quest } from '../../../types';

/**
 * 委托类型 → 色调 / 图标 / 英文名（风格指南 3.1、5.5）。
 *
 * 类型永远是「颜色 + 外形 + 图标 + 文字」四重编码：界面这边负责颜色、图标与文字，外形在 3D 徽章与 2D 图钉上。
 * 色调名直接拼成 `cute-tone-${tone}`——这一族在 tailwind.config.js 里整族保留，拼接不会被裁掉。
 * 写成对象字面量而不是 switch：BountyBoard、MapBoard 若要同一套映射，可以直接 import 这里，不必各抄一份。
 *
 * 紧急救援用 HeartPulse 而不是 LifeBuoy：红白相间的救生圈太接近红白圆形的 IP 禁区（指南 1.2、3.9）。
 */
export type QuestTone = 'transport' | 'hunt' | 'build' | 'envoy' | 'rescue';

export const QUEST_TONE: Record<Quest['type'], QuestTone> = {
  物资运输: 'transport',
  魔物讨伐: 'hunt',
  迷宫建设: 'build',
  异界交涉: 'envoy',
  紧急救援: 'rescue',
};

export const QUEST_ICON: Record<Quest['type'], LucideIcon> = {
  物资运输: Package,
  魔物讨伐: Swords,
  迷宫建设: Hammer,
  异界交涉: MessageCircleHeart,
  紧急救援: HeartPulse,
};

export const QUEST_TYPE_EN: Record<Quest['type'], string> = {
  物资运输: 'Supply Run',
  魔物讨伐: 'Monster Hunt',
  迷宫建设: 'Dungeon Works',
  异界交涉: 'Envoy',
  紧急救援: 'Rescue',
};

/** 未知类型（数据层将来加了新类型而这里没跟上）退到品牌青，不至于整张卡没有颜色 */
export const toneClass = (type: Quest['type']): string => `cute-tone-${QUEST_TONE[type] ?? 'teal'}`;
