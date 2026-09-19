/**
 * 艾琳娜能动手做的事。
 *
 * 范围是**委托，且只有委托**：发布、讲解、确认还在不在、确认接取。
 * 这不是技术限制而是产品决定——她的定位就是公会柜台，不是通用助手。
 * 要扩她的能力，先改 lib/elena.ts 的 ELENA_SCOPE，再来这里加工具，
 * 两边必须同步，否则她会说自己能做某件事却调不出对应的工具。
 *
 * 这个文件是**执行**那一半；定义在 tool-schema.ts。
 *
 * 工具全部在**客户端**执行。
 * 它们要读 React state、要动地图、要改本机档案——这些都不在服务端。
 * 服务端只负责把模型吐出的 tool_calls 原样转发回来，自己不执行任何一个。
 */

import { Quest, Profession, User } from '../../types';
import { PROFESSION_CONFIG } from '../../constants';
import { distanceMeters } from '../geo';

// 定义在 tool-schema.ts，服务端只 import 那一份。这里转出去，调用方不必关心拆分。
export { ELENA_TOOLS, type ToolDefinition } from './tool-schema';

/** 工具执行时能看到的世界。由 useElenaAgent 在每次调用前现组装。 */
export interface ToolContext {
  quests: Quest[];
  user: User;
  activeQuestId: string | null;
  /** 玩家当前坐标。没有定位就是 null，距离一律按「未知」处理 */
  userLocation: [number, number] | null;
  /**
   * 已经关闭、不可再接的委托 id。
   * 目前只有「自己正在做的那个」，接上真实后端后这里会是服务端下发的状态。
   */
  closedQuestIds?: string[];
  /** 地图聚焦。纯 UI 副作用。 */
  onFocus: (quest: Quest) => void;
  /** 真正签下契约。由 App 提供，与点击接取走的是同一条路径。 */
  onAccept: (quest: Quest) => void;
}

/** 工具执行结果。ok=false 时 reason 会被她读给玩家听，所以要写成人话。 */
export interface ToolResult {
  ok: boolean;
  reason?: string;
  [key: string]: unknown;
}

function isOpen(quest: Quest, ctx: ToolContext): boolean {
  if (ctx.activeQuestId === quest.id) return false;
  return !(ctx.closedQuestIds ?? []).includes(quest.id);
}

/** 距离。没有定位时返回 null——不能假装知道，否则她会说错「走过去十分钟」。 */
function distanceText(quest: Quest, ctx: ToolContext): string | null {
  if (!ctx.userLocation) return null;
  const meters = Math.round(distanceMeters(ctx.userLocation, quest.location));
  return meters < 1000 ? `${meters} 公尺` : `${(meters / 1000).toFixed(1)} 公里`;
}

/** 摘要形态。列表里用，字段少一点，省 token 也省得她一次读太多。 */
function briefOf(quest: Quest, ctx: ToolContext) {
  return {
    questId: quest.id,
    title: quest.title,
    realTask: quest.realTask,
    locationName: quest.locationName,
    difficulty: quest.difficulty,
    minLevel: quest.minLevel,
    levelOk: ctx.user.level >= quest.minLevel,
    suitsHim: quest.neededProfessions?.includes(ctx.user.profession) ?? false,
    isUrgent: Boolean(quest.isUrgent),
    stillOpen: isOpen(quest, ctx),
    distance: distanceText(quest, ctx),
  };
}

/**
 * 执行一个工具。
 *
 * 永远返回结果而不抛异常——模型拿到 ok:false + reason 能自己把话圆回去，
 * 抛出去则会让整轮对话断在半路，她突然不说话了比说错话更糟。
 */
export function executeTool(name: string, rawArgs: string, ctx: ToolContext): ToolResult {
  let args: Record<string, any> = {};
  try {
    args = rawArgs ? JSON.parse(rawArgs) : {};
  } catch {
    return { ok: false, reason: '参数解析失败，请重新组织一次调用。' };
  }

  switch (name) {
    case 'list_quests': {
      let list = ctx.quests;
      if (args.type) list = list.filter((q) => q.type === args.type);
      if (args.onlyAcceptable) {
        list = list.filter((q) => ctx.user.level >= q.minLevel && isOpen(q, ctx));
      }
      if (args.onlySuitable) {
        list = list.filter((q) => q.neededProfessions?.includes(ctx.user.profession));
      }
      return {
        ok: true,
        count: list.length,
        quests: list.map((q) => briefOf(q, ctx)),
        hasActiveQuest: ctx.activeQuestId !== null,
      };
    }

    case 'get_quest': {
      const quest = ctx.quests.find((q) => q.id === args.questId);
      if (!quest) return { ok: false, reason: '找不到这个委托，编号可能不对。' };

      return {
        ok: true,
        ...briefOf(quest, ctx),
        description: quest.description,
        type: quest.type,
        estimatedMinutes: quest.estimatedTime,
        rewardGold: quest.rewardGold,
        rewardDesc: quest.rewardDesc ?? null,
        trustPoints: quest.trustPoints,
        neededProfessions: (quest.neededProfessions ?? []).map((p) => ({
          name: p,
          realSkill: PROFESSION_CONFIG[p as Profession].realSkill,
        })),
      };
    }

    case 'focus_map': {
      const quest = ctx.quests.find((q) => q.id === args.questId);
      if (!quest) return { ok: false, reason: '找不到这个委托。' };
      ctx.onFocus(quest);
      return { ok: true, focused: quest.locationName, distance: distanceText(quest, ctx) };
    }

    case 'accept_quest': {
      const quest = ctx.quests.find((q) => q.id === args.questId);
      if (!quest) return { ok: false, reason: '找不到这个委托，编号可能不对。' };

      // 校验顺序按「玩家最该先知道哪一条」排，不是按代码方便排。
      if (ctx.activeQuestId === quest.id) {
        return { ok: false, reason: '这个委托他已经在做了。' };
      }
      if (ctx.activeQuestId !== null) {
        const current = ctx.quests.find((q) => q.id === ctx.activeQuestId);
        return {
          ok: false,
          reason: `他手上还有「${current?.title ?? '一个委托'}」在进行，得先完成或取消才能接新的。`,
        };
      }
      if (!isOpen(quest, ctx)) {
        return { ok: false, reason: '这个委托已经不在了。' };
      }
      if (ctx.user.level < quest.minLevel) {
        return {
          ok: false,
          reason: `这个委托要 ${quest.minLevel} 级，他现在 ${ctx.user.level} 级，还不够。`,
        };
      }

      ctx.onAccept(quest);
      return {
        ok: true,
        accepted: quest.title,
        locationName: quest.locationName,
        estimatedMinutes: quest.estimatedTime,
        distance: distanceText(quest, ctx),
        // 定位不可用时她必须提醒——不然玩家跑到现场才发现交不了证明
        locationWarning: ctx.userLocation
          ? null
          : '定位目前不可用，他到了现场也提交不了证明，要提醒他先开定位。',
      };
    }

    default:
      return { ok: false, reason: `没有这个工具：${name}` };
  }
}
