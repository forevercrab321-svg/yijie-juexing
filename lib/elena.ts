/**
 * 艾琳娜 · 角色定义与台词库
 *
 * 这里是她全部话语的唯一来源。散落在各组件里的硬编码字符串已经收拢到此处，
 * 目的有三个：
 *   1. 形象一致——她的语气、边界、能做什么，只在一个地方定义；
 *   2. 省额度——固定台词的语音一次性预生成，运行时直接播放，不再每次调 TTS；
 *   3. 可迭代——改一条台词就重跑一次 `npm run assets:voices`，不必翻组件。
 *
 * 新增台词时：加一条 ELENA_LINES，然后重跑语音生成脚本。
 * 忘了重跑也不会坏——运行时找不到音频文件会自动退回实时合成。
 */

/**
 * 角色设定。同时用于 TTS 的朗读指令与图像生成的立绘提示词，
 * 保证「听起来的她」和「看起来的她」是同一个人。
 */
export const ELENA_PERSONA = {
  name: '艾琳娜',
  nameEn: 'Elena',
  role: '纽约冒险者公会的负责人',

  /** 语气基调。传给 TTS 作为朗读指令。 */
  voiceDirection:
    '知性、沉稳、带一点温柔的成熟女性口吻，语速从容，不夸张、不做作',

  /**
   * 立绘提示词 —— 定稿版，依据实际采用的美术稿反写而成。
   *
   * 这是她外观的唯一权威定义。补新表情、换工具重画，都以这段为基准，
   * 只替换 EXPRESSION_PROMPTS 里的差异部分，其余一个字都不要动——
   * 服装、发型、徽章、背景任何一处漂移，看起来就不是同一个人了。
   *
   * 全站统一 2D 插画风，不做 3D。
   */
  visualPrompt:
    '2D anime illustration, refined lineart, soft cel shading with delicate gradients, subtle grain texture, ' +
    'half-body portrait of a poised woman in her late twenties, ' +
    'long voluminous dark brown wavy hair with fine strand detail catching warm rim light, ' +
    'thin rectangular metal-framed glasses, amber-gold eyes, refined elegant features, ' +
    'wearing a dark forest-green tailored blazer with gold piping along the lapels, ' +
    'a cream pinstriped shirt open at the collar, a loose dark green necktie, ' +
    'a golden compass-rose emblem pinned on the left chest, ' +
    'gold honeycomb-patterned trim on the cuffs, a gold star clasp on the belt, ' +
    'standing in a vaulted gothic guild hall, tall arched window on the left casting warm orange light, ' +
    'wooden shelves and lantern glow blurred in the background, ' +
    'warm backlight, cool violet shadows, painterly atmosphere, ' +
    'character occupies 60-80% of frame height, headroom above the hair, ' +
    'no 3D render, no photorealism',

  /**
   * 她能做的事——职责边界。
   * 这不只是文档：它约束了台词库该覆盖哪些场景，也划出了她不该说什么。
   */
  canDo: [
    '介绍与发布委托，说明委托内容与所在地点',
    '确认契约签署，为出发的冒险者送行',
    '验收任务证明，发放报酬与称号',
    '公会事务：加入、退出、创建小队的回应',
    '伙伴事务：搜索结果、好友请求的回应',
    '职业猎人执照的说明与祝贺',
  ],
  /** 明确不做的事，避免角色越界。 */
  cannotDo: [
    '不承诺任何收入、报酬金额或雇佣关系',
    '不提供现实世界的法律、医疗、财务建议',
    '不评价用户外貌，不索取委托之外的个人信息',
    '不代替用户判断现实中的人身安全风险',
  ],
} as const;

/**
 * 表情。每一种对应 public/assets/elena/{id}.jpg 一张立绘。
 *
 * 用切换立绘来表达情绪，而不是给单张图叠模拟眨眼与口型——
 * 立绘之间姿势不同，五官位置对不齐，硬编码坐标必然错位；
 * 而且换一张真实绘制的表情，表现力远好过让一张图假装在眨眼。
 */
export type ElenaExpression =
  | 'neutral'   // 平静，默认态
  | 'smile'     // 微笑
  | 'playful'   // 俏皮、带点得意
  | 'warm'      // 温柔、欣慰
  | 'stern'     // 严肃、审视
  | 'joy'       // 明显的高兴
  | 'sad'       // 失落
  | 'angry';    // 不悦

/**
 * 各表情与基础形象的差异描述。
 *
 * 补图时用法：`ELENA_PERSONA.visualPrompt` + 这里对应的一句，其余不动。
 * 前五个已按实际美术稿反写；后三个是待补的规格，画之前照这个来。
 */
export const EXPRESSION_PROMPTS: Record<ElenaExpression, string> = {
  neutral: 'both hands folded loosely in front, calm composed expression, lips closed with a faint smile',
  smile:   'no hands in frame, gentle warm smile, relaxed shoulders',
  playful: 'one hand raised to adjust the glasses, knowing amused smile, head slightly tilted',
  stern:   'one hand raised to adjust the glasses, sharp serious gaze over the lenses, lips lightly pressed',
  warm:    'one hand resting softly on her own chest, tender affectionate smile, eyes slightly softened',
  joy:     'bright delighted smile showing genuine happiness, eyes slightly narrowed, shoulders lifted',
  sad:     'eyes cast downward, subdued melancholic expression, one hand lowered, quiet posture',
  angry:   'brows drawn together, cold displeased gaze, chin slightly lifted, lips firmly closed',
};

/** 已备齐素材的表情。缺图的会按 EXPRESSION_FALLBACK 退回。 */
export const AVAILABLE_EXPRESSIONS: ElenaExpression[] = [
  'neutral',
  'smile',
  'playful',
  'warm',
  'stern',
];

/**
 * 缺图时的退路。补齐素材后把它从这里删掉即可，无需改调用方。
 * 退路的选择原则是「情绪方向不要反」——高兴退回微笑可以，退回严肃就不行。
 */
const EXPRESSION_FALLBACK: Record<ElenaExpression, ElenaExpression> = {
  neutral: 'neutral',
  smile: 'smile',
  playful: 'playful',
  warm: 'warm',
  stern: 'stern',
  joy: 'smile',
  sad: 'neutral',
  angry: 'stern',
};

/** 解析出实际可用的表情。 */
export function resolveExpression(want: ElenaExpression): ElenaExpression {
  return AVAILABLE_EXPRESSIONS.includes(want) ? want : EXPRESSION_FALLBACK[want];
}

/** 立绘路径。 */
export function expressionImageUrl(expression: ElenaExpression): string {
  return `/assets/elena/${resolveExpression(expression)}.jpg`;
}

export type ElenaLineId =
  | 'greeting'
  | 'contract_signed'
  | 'mission_complete'
  | 'pro_granted'
  | 'guild_joined'
  | 'guild_left'
  | 'guild_created'
  | 'friend_found'
  | 'friend_not_found'
  | 'friend_request_sent';

export interface ElenaLine {
  id: ElenaLineId;
  /** 触发场景，供维护者理解上下文 */
  scene: string;
  text: string;
  /** 说这句话时的表情。缺图会自动退回，见 resolveExpression */
  expression: ElenaExpression;
}

/**
 * 固定台词。每条对应 public/audio/elena/{id}.mp3。
 *
 * 全部使用繁体中文，与界面其余文案保持一致。
 */
export const ELENA_LINES: Record<ElenaLineId, ElenaLine> = {
  greeting: {
    id: 'greeting',
    scene: '打开契约终端时',
    text: '冒險者，你看起來很有精神呢。是想領取新的契約，還是想聽聽我的特別指引？',
    expression: 'playful',
  },
  contract_signed: {
    id: 'contract_signed',
    scene: '接下一个委托后',
    text: '契約簽署完成了喔。期待你在這座城市留下的英雄足跡。',
    expression: 'warm',
  },
  mission_complete: {
    id: 'mission_complete',
    scene: '任务证明通过验收',
    text: '做得很出色。證據已經驗證通過，酬勞已發放。好好休息一下吧。',
    expression: 'joy',
  },
  pro_granted: {
    id: 'pro_granted',
    scene: '获得职业猎人执照',
    text: '恭喜你。從現在起，你也是職業獵人的一員了。我期待看到你的成長。',
    expression: 'joy',
  },
  guild_joined: {
    id: 'guild_joined',
    scene: '加入小队',
    text: '申請已經幫你送出囉。希望能順利加入，加油喔。',
    expression: 'smile',
  },
  guild_left: {
    id: 'guild_left',
    scene: '退出小队',
    text: '退出小隊了呀。沒關係，稍微休息一下再出發也好。',
    expression: 'sad',
  },
  guild_created: {
    id: 'guild_created',
    scene: '创建小队',
    text: '小隊建立成功了。往後就要靠你來帶領大家了呢。',
    expression: 'joy',
  },
  friend_found: {
    id: 'friend_found',
    scene: '搜索到冒险者',
    text: '發現新的靈魂信號了。要向對方送出連結嗎？',
    expression: 'playful',
  },
  friend_not_found: {
    id: 'friend_not_found',
    scene: '搜索无结果',
    text: '找不到這位冒險者呢，再確認一下編號吧。',
    expression: 'neutral',
  },
  friend_request_sent: {
    id: 'friend_request_sent',
    scene: '好友请求已发送',
    text: '連結請求已經送出去了。',
    expression: 'smile',
  },
};

/** 预生成音频的存放位置。脚本写入这里，运行时从这里读。 */
export function lineAudioUrl(id: ElenaLineId): string {
  return `/audio/elena/${id}.mp3`;
}

/** 供 TTS 使用的完整朗读指令。脚本与服务端共用，保证预生成与实时合成音色一致。 */
export function buildSpeechInstruction(text: string): string {
  return (
    `你现在是${ELENA_PERSONA.name}，一位${ELENA_PERSONA.role}。` +
    `用${ELENA_PERSONA.voiceDirection}，朗读下面这段台词。` +
    `只朗读台词本身，不要添加任何额外内容：\n${text}`
  );
}
