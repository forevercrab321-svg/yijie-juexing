
/**
 * 种族 —— 血统。
 *
 * 由系统随机分配，转生这件事本来就轮不到自己挑。
 * 种族只决定外观与天赋倾向，**刻意不绑定任何行业**——
 * 否则抽到史莱姆的人就永远当不了医护，那会毁掉「相貌随机」的乐趣。
 *
 * 取材自日式转生与西幻共有的谱系：原生系、鬼神系、魔族系、
 * 龙族系、天界系、自然系、匠造系、兽性系、灵体系、不死系、水生系、造物系。
 * 每个种族在 public/assets/avatars/ 下有一组立绘。
 */
export enum Race {
  SLIME = '利姆鲁·史莱姆',
  KIJIN = '鬼人族·侍大将',
  DAEMON = '原初之黑·恶魔',
  DRAGONNEWT = '龙人族·龙战士',
  ANGEL = '天翼族·歼灭天使',
  ELF = '森精灵·守林人',
  DWARF = '矮人族·锻炉子嗣',
  BEASTKIN = '兽人族·野性同盟',
  FAIRY = '妖精族·微光使',
  UNDEAD = '不死者·长夜行者',
  MERFOLK = '人鱼族·潮汐歌者',
  GOLEM = '傀儡族·不眠石心'
}

/**
 * 职业 —— 选择。
 *
 * 与种族完全解耦，由玩家自己挑。每个职业对应现实中的一类行业能力，
 * 这是「真实 + 游戏」真正的接缝：游戏里它是身份，
 * 线下活动里它决定你能承担什么角色、该被派到哪个位置。
 *
 * 按六大领域分组，覆盖主流行业。分组见 constants.ts 的 PROFESSION_TRACKS。
 */
export enum Profession {
  // 记录与传播
  CHRONICLER = '记录者',
  ILLUMINATOR = '幻绘师',
  HERALD = '传令者',
  // 语言与沟通
  LINGUIST = '语灵',
  CONFIDANT = '倾听者',
  MENTOR = '导师',
  // 物资与建造
  COURIER = '运输者',
  ARTIFICER = '匠人',
  MASON = '筑城师',
  // 照护与生养
  MENDER = '治愈者',
  HEARTHKEEPER = '炉火守',
  CULTIVATOR = '育种者',
  // 秩序与规则
  WARDEN = '守望者',
  ARBITER = '裁定者',
  ASSAYER = '度量师',
  // 探索与技术
  WEAVER = '织网者',
  TRADER = '行商',
  STRIDER = '疾行者'
}

/** 职业所属领域。用于分组展示与任务匹配。 */
export enum ProfessionTrack {
  RECORD = '记录与传播',
  LANGUAGE = '语言与沟通',
  LOGISTICS = '物资与建造',
  CARE = '照护与生养',
  ORDER = '秩序与规则',
  CRAFT = '探索与技术'
}

export interface User {
  id: string;
  /** 可选。只有完成了信任认证的用户才有，入门不需要。 */
  realName?: string;
  /**
   * 证件号的掩码形态（仅末四位可见），同样是可选的。
   * 证件号原文不会出现在应用状态里，也不会被发往任何服务端——
   * 见 lib/identity.ts 与 PRIVACY.md。
   */
  idCardMasked?: string;
  name: string;
  /** 随机分配 */
  race: Race;
  /** 玩家自选 */
  profession: Profession;
  level: number;
  magicules: number; // XP
  bio: string;
  /** 是否完成了实名信任认证。入门时为 false，需要时在个人档案里补。 */
  verified: boolean;
  avatarUrl?: string; 
  trustScore: number;
  goldCoins: number;
  guildContribution: number;
  isProMember?: boolean;
}

export enum QuestDifficulty {
  D = 'F级·日常互助', 
  C = 'B级·社区协作', 
  B = 'A级·紧急支援', 
  A = 'S级·灾难救助', 
  S = 'SS级·世界守护' 
}

export interface Quest {
  id: string;
  title: string;
  description: string; 
  realTask: string; 
  location: [number, number]; 
  locationName: string;
  difficulty: QuestDifficulty;
  minLevel: number;
  trustPoints: number; 
  rewardDesc?: string; 
  rewardGold: number; 
  type: '物资运输' | '魔物讨伐' | '迷宫建设' | '异界交涉' | '紧急救援';
  estimatedTime: number;
  /**
   * 这个委托更需要哪些职业。
   *
   * 不是硬性门槛——谁都能接，但匹配的人会看到「适合你」的标记，
   * 现场也知道该由谁牵头。职业因此不只是档案上的一个词。
   */
  neededProfessions?: Profession[];
  isUrgent?: boolean;
  communityComments?: number;
  imageUrl?: string; 
}

export interface ToastMessage {
  id: string;
  title: string; 
  message: string;
  type: 'sage' | 'success' | 'warning' | 'danger';
}

export interface Comment {
  id: string;
  author: string;
  content: string;
  timestamp: string;
}

export interface CommunityPost {
  id: string;
  author: string;
  avatar?: string;
  content: string;
  mediaType?: 'image' | 'video';
  mediaUrl?: string;
  likes: number;
  isLiked?: boolean; 
  timestamp: string;
  isUrgent: boolean;
  comments: Comment[]; 
}

export interface BrandOpportunity {
  id: string;
  brandName: string;
  title: string;
  description: string;
  type: 'EQUIPMENT' | 'WORKSHOP' | 'RECOGNITION';
  iconUrl?: string;
  isProOnly: boolean;
  spots?: number;
}

export interface PlayerGuild {
  id: string;
  name: string;
  description: string;
  leader: string;
  memberCount: number;
  level: number;
  isJoined?: boolean;
  tags: string[];
  bannerUrl?: string;
}
