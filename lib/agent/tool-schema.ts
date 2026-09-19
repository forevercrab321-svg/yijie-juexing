/**
 * 工具的**定义**——她能动手做的事有哪些，以及每件事怎么描述给模型听。
 *
 * 单独成文件是为了让服务端只拿这一份。
 * 执行逻辑在同目录的 tools.ts 里，那边要 import constants / types / geo，
 * 服务端一个都用不上——工具全部在客户端执行，服务端只负责转发 tool_calls。
 *
 * 范围是**委托，且只有委托**：发布、讲解、确认还在不在、确认接取。
 * 这不是技术限制而是产品决定。要扩她的能力，先改 lib/elena.ts 的 ELENA_SCOPE，
 * 再来这里加定义、去 tools.ts 加执行，三处必须同步，
 * 否则她会说自己能做某件事却调不出对应的工具。
 */

/** OpenAI 兼容的工具定义。MiniMax 用 `tools` 字段，不支持旧的 `function_call`。 */
export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, unknown>;
      required?: string[];
    };
  };
}

export const ELENA_TOOLS: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'list_quests',
      description:
        '列出公会现在挂着的委托。冒险者问「有什么任务」「附近有什么」「适合我的有哪些」时用。' +
        '不带参数就是全部。返回里已经标好了他等级够不够、职业合不合适。',
      parameters: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['物资运输', '魔物讨伐', '迷宫建设', '异界交涉', '紧急救援'],
            description: '只看某一类委托。不确定就别传。',
          },
          onlyAcceptable: {
            type: 'boolean',
            description: '只列出他现在等级够、能立刻接的。他说「我能接的」时传 true。',
          },
          onlySuitable: {
            type: 'boolean',
            description: '只列出点名了他这个职业的。他说「适合我的」时传 true。',
          },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_quest',
      description:
        '看某个委托的详情：现实中实际要做什么、在哪、要多久、报酬多少、需要哪些职业、' +
        '**现在还在不在**、他等级够不够。他指着某个委托问细节时用。',
      parameters: {
        type: 'object',
        properties: {
          questId: { type: 'string', description: '委托 id，从 list_quests 的结果里取' },
        },
        required: ['questId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'focus_map',
      description:
        '把地图镜头移到某个委托的位置上。他问「在哪」「给我看看」时用。' +
        '这只是移动镜头，不会接取任何东西。',
      parameters: {
        type: 'object',
        properties: {
          questId: { type: 'string', description: '委托 id' },
        },
        required: ['questId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'accept_quest',
      description:
        '确认接取委托，把契约签下去。这是唯一一个会改变状态的工具。' +
        '**只有当冒险者明确说要接这一个委托时才调用**——「看起来不错」「介绍一下」都不算。' +
        '不确定他指哪个就先问。工具会自己校验等级、是否已有在进行的委托、委托还在不在，' +
        '被拒绝了就把 reason 讲给他听。',
      parameters: {
        type: 'object',
        properties: {
          questId: { type: 'string', description: '委托 id' },
        },
        required: ['questId'],
      },
    },
  },
];
