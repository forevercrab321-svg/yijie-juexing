/**
 * 对话的数据形态与两个纯函数。
 *
 * 放在这里而不是 hook 里，是为了让「切句」和「裁历史」这两段逻辑
 * 可以被单独读懂、单独改——它们直接决定她说话像不像人，以及一轮对话烧多少 token。
 */

/** 发给模型的消息。字段与 OpenAI Chat Completions 一致，MiniMax 兼容这套。 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  /** assistant 决定调工具时带上 */
  tool_calls?: ToolCall[];
  /** role='tool' 时必须带，对应它在回答哪一次调用 */
  tool_call_id?: string;
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

/** 界面上显示的一条对话。比 ChatMessage 多了展示用的信息。 */
export interface DisplayTurn {
  id: string;
  who: 'player' | 'elena';
  text: string;
  /** 她这轮做了什么，显示成一行小字。没调工具就是空数组。 */
  actions: string[];
  /** 还在流式输出中 */
  streaming?: boolean;
}

/**
 * 历史裁剪。
 *
 * 只保留最近 N 轮。不做摘要压缩——这是公会柜台对话，
 * 聊的是「哪个委托、在哪、能不能接」，二十句之前说过什么基本不影响当下判断，
 * 花一次模型调用去压缩历史不划算。真需要长期记忆时再在这里加。
 *
 * 注意成对保留：assistant 的 tool_calls 和对应的 tool 结果如果被切散，
 * 上游会直接报错。所以从头往后找第一个「安全切点」。
 */
export function trimHistory(messages: ChatMessage[], maxMessages = 24): ChatMessage[] {
  if (messages.length <= maxMessages) return messages;

  let start = messages.length - maxMessages;
  // 切点不能落在 tool 消息上，也不能把带 tool_calls 的 assistant 留在外面
  while (start < messages.length && messages[start].role === 'tool') start++;
  return messages.slice(start);
}

/** 一句话的结束标志。中英标点都算，换行也算。 */
const SENTENCE_END = /[。！？；!?;\n]/;

/**
 * 从流式文本里切出「可以拿去合成语音」的完整句子。
 *
 * 这是「活起来」的关键：不等整段生成完，第一句一到就开始出声。
 * 实测第一句通常十来个字，合成很快，玩家的感受是她**立刻**开口了。
 *
 * @param buffer 还没被切走的尾巴
 * @param minChars 太短的句子不单独送去合成——「好的。」单独合成一次不值当，
 *                 而且断断续续的短音频听起来很碎
 * @returns ready 是切出来的完整句子（可能不止一句），rest 是剩下的尾巴
 */
export function takeSentences(
  buffer: string,
  minChars = 8,
): { ready: string; rest: string } {
  let cut = -1;
  for (let i = 0; i < buffer.length; i++) {
    if (SENTENCE_END.test(buffer[i])) cut = i;
  }
  if (cut === -1) return { ready: '', rest: buffer };

  const ready = buffer.slice(0, cut + 1).trim();
  if (ready.length < minChars) return { ready: '', rest: buffer };

  return { ready, rest: buffer.slice(cut + 1) };
}

/** 把工具调用翻译成界面上那行小字。她做了什么，玩家该看得见。 */
export function describeAction(name: string, args: string): string {
  let parsed: Record<string, any> = {};
  try {
    parsed = args ? JSON.parse(args) : {};
  } catch {
    /* 参数坏了也要有一行字，不能空着 */
  }

  switch (name) {
    case 'list_quests':
      return parsed.onlySuitable
        ? '翻找适合你的委托'
        : parsed.onlyAcceptable
          ? '翻找你现在能接的委托'
          : '翻看委托板';
    case 'get_quest':
      return '取出委托详情';
    case 'focus_map':
      return '把地图移过去';
    case 'accept_quest':
      return '签下契约';
    default:
      return name;
  }
}
