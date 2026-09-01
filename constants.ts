
import { Quest, QuestDifficulty, Race, Profession, ProfessionTrack, CommunityPost, BrandOpportunity, PlayerGuild } from './types';

/**
 * 静态图一律走本地文件，运行时不再向任何第三方发请求。
 * 这些文件由 `npm run assets` 用 MiniMax image-01 生成，清单见 scripts/build-assets.ts。
 */
export const LANDING_HERO_IMAGE = "/assets/hero-landing.jpg";
export const WORLD_HERO_IMAGE = "/assets/world-hero.jpg";
// 艾琳娜的立绘按表情分成多张，路径由 lib/elena.ts 的 expressionImageUrl 计算

// 次元廣播隨機模板
export const BROADCAST_TEMPLATES = [
  "【{loc}】ID:{id} 成功封印了這裡的精魂，獲得星徽 +{xp}，大家都在熱烈討論喔！",
  "【{loc}】深夜傳送任務觸發！ID:{id} 只花了 {time} 分鐘就抵達，太厲害了吧～",
  "【{loc}】隱藏 BOSS 出沒！ID:{id} 帶領公會發起圍剿，賞金翻倍囉！",
  "【{loc}】聽說 ID:{id} 在這裡找到了失落的聖杯（代購成功），辛苦了呢！",
  "【{loc}】警報！ID:{id} 完成了 S 級委託，艾賽爾加德的秩序又更加穩固了喔！",
  "【{loc}】ID:{id} 分享了新的冒險日誌，趕快去圍觀點贊，可以嗎？",
  "【{loc}】公會爭霸戰：ID:{id} 為公會貢獻了大量積分，領先優勢擴大囉！",
  "【{loc}】ID:{id} 剛剛使用了瞬移券，在傳送陣中消失了，好神秘喔！",
  "【{loc}】物資運輸達成！ID:{id} 守護了這區的補給線，真的很棒喔！",
  "【{loc}】ID:{id} 達成了百次封印成就，獲得專屬頭像框，大家記得恭喜他喔！"
];

export const TRANSLATIONS = {
  zh: {
    identity_verified: '嗨～ 靈魂連結成功囉！歡迎回來，今天也要元氣滿滿喔！',
    welcome: '嗨～ 歡迎來到紐約冒險者公會！今天想做點什麼呢？',
    insufficient_level: '哎呀～ 這個委託等級太高了，我們先去練練功好嗎？',
    contract_active: '親愛的～ 你已經有任務在身了喔，要專心一點嘛！',
    mission_start: '收到！任務正式開始囉～ 路上小心，我會在這裡等你回來的，加油！',
    auto_nav_start: '導航已經幫你開啟囉～ 跟著箭頭走就沒問題了，加油喔！',
    auto_nav_stop: '我們抵達目的地囉！辛苦了～ 記得要把照片拍清楚喔，可以嗎？',
    level_up: '哇！升級了耶！真的很棒喔，我就知道你一定可以的！',
    level_down: '嗚... 好像不小心搞砸了？沒關係啦，我們下次再努力就好，記得喔！',
    mission_complete: '任務順利完成！真的辛苦了～ 快點回來休息一下吧！',
    mission_abort: '任務取消了呀... 沒關係沒關係，休息完下次再挑戰就好喔！',
    guild_title: '冒險者公會',
    guild_chat_title: '公會大廳',
    urgent_tag: '緊急委託',
    tab_guild: '大廳',
    tab_world: '世界',
    tab_alliances: '合作',
    tab_squads: '公會', 
    post_placeholder: '嗨～ 分享一下今天遇到的趣事吧...',
    req_level: '需要等級',
    filter_all: '全部',
    gps_link: '開啟地圖',
    submit: '提交證明',
    auto: '自動尋路',
    disclaimer_title: '冒險者公約',
    disclaimer_body: '這裡不是打工的地方喔，我們是為了榮譽 and 信任而戰的夥伴。',
    understand: '沒問題，我知道了',
    pro_title: '職業獵人執照',
    pro_subtitle: '成為傳說中的存在',
    pro_def_is: '這代表你的身分已經被公會認證囉！',
    pro_def_not: '這不是工作合約，而是一種榮耀。',
    pro_benefit_1: '專屬公會徽章',
    pro_benefit_desc_1: '你的名字旁邊會有閃亮亮的星星喔！',
    pro_benefit_2: '優先接取任務',
    pro_benefit_desc_2: '好的委託當然要留給最厲害的你～',
    pro_benefit_3: '特殊裝備支援',
    pro_benefit_desc_3: '可以申請贊助商提供的強力裝備！',
    pro_crit_title: '申請條件確認',
    pro_crit_1: '至少完成過 3 次委託',
    pro_crit_2: '獲得 2 次以上的推薦',
    pro_crit_3: '選擇你的專長領域',
    pro_crit_4: '完成實名認證',
    pro_disclaimer: '這只是公會內部的身分認證，不代表勞雇關係喔，記得喔。',
    pro_action_check: '檢查我的資格',
    pro_action_apply: '立即申請執照',
    pro_price: '免費',
    pro_status_review: '資料審核中...',
    
    guild_search_placeholder: '搜尋感興趣的公會...',
    guild_create: '建立公會',
    guild_join: '申請加入',
    guild_leave: '退出公會',
    guild_members: '成員',
    guild_joined: '已加入',
    guild_create_success: '公會建立成功囉！太棒了，我們以後一起加油吧！',
    guild_join_success: '申請已經幫你送出囉！希望能順利加入，加油喔！',
    guild_leave_success: '退出公會了呀... 沒關係，稍微休息一下再出發，可以嗎？',

    friends_title: '夥伴通訊錄',
    friends_tab_mine: '我的好友',
    friends_tab_pending: '待處理',
    friends_search_placeholder: '搜尋 ID 或冒險者姓名...',
    friends_no_found: '找不到該冒險者呢，再確認一下 ID 吧？',
    friends_add_success: '好友請求發送成功！',
    friends_online: '冒險中',
    friends_offline: '冥想中',
    friends_sync_contacts: '同步靈魂連結',
  },
  en: {
    identity_verified: 'Identity verified. Welcome back, Adventurer.',
    welcome: 'Welcome to NYC Aethelgard.',
    insufficient_level: 'Level insufficient for this contract.',
    contract_active: 'You already have an active contract.',
    mission_start: 'Contract accepted. Mission start.',
    auto_nav_start: 'Auto-navigation engaged.',
    auto_nav_stop: 'Destination reached. Navigation ending.',
    level_up: 'Level Up! Capacity increased.',
    level_down: 'Penalty applied. Level decreased.',
    mission_complete: 'Mission Complete. Rewards transferred.',
    mission_abort: 'Mission Aborted.',
    guild_title: 'Guild Hall',
    guild_chat_title: 'Guild Chat',
    urgent_tag: 'Urgent',
    tab_guild: 'Hall',
    tab_world: 'World',
    tab_alliances: 'Brands',
    tab_squads: 'Squads',
    post_placeholder: 'Share your journey...',
    req_level: 'Req. Lv.',
    filter_all: 'ALL',
    gps_link: 'GPS Link',
    submit: 'Submit Proof',
    auto: 'Auto Nav',
    disclaimer_title: 'Hunter Protocol',
    disclaimer_body: 'This is a voluntary community. No employment guaranteed.',
    understand: 'I Understand',
    pro_title: 'Pro License',
    pro_subtitle: 'Become a Legend',
    pro_def_is: 'Verified Identity & Status',
    pro_def_not: 'Not an Employment Contract',
    pro_benefit_1: 'Verified Badge',
    pro_benefit_desc_1: 'Stand out in the community.',
    pro_benefit_2: 'Priority Access',
    pro_benefit_desc_2: 'Access urgent quests first.',
    pro_benefit_3: 'Equipment Support',
    pro_benefit_desc_3: 'Apply for brand gear.',
    pro_crit_title: 'Eligibility Check',
    pro_crit_1: '3+ Missions Complete',
    pro_crit_2: '2+ Recommendations',
    pro_crit_3: 'Select Expertise',
    pro_crit_4: 'ID Verified',
    pro_disclaimer: 'Community status only.',
    pro_action_check: 'Check Eligibility',
    pro_action_apply: 'Apply for License',
    pro_price: 'Free',
    pro_status_review: 'Under Review...',
    
    guild_search_placeholder: 'Search for squads...',
    guild_create: 'Create Squad',
    guild_join: 'Join',
    guild_leave: 'Leave',
    guild_members: 'Members',
    guild_joined: 'Joined',
    guild_create_success: 'Squad created successfully!',
    guild_join_success: 'Application sent.',
    guild_leave_success: 'Left squad.',

    friends_title: 'Contacts',
    friends_tab_mine: 'Friends',
    friends_tab_pending: 'Requests',
    friends_search_placeholder: 'Search ID or Name...',
    friends_no_found: 'Adventurer not found. Try another signal.',
    friends_add_success: 'Link request transmitted!',
    friends_online: 'Questing',
    friends_offline: 'Resting',
    friends_sync_contacts: 'Sync Soul Links',
  }
};

export const INITIAL_QUESTS: Quest[] = [
  {
    id: 'q1',
    title: 'Time Square Cleanup',
    description: 'The plaza is overcrowded with debris. Needs clearing.',
    realTask: 'Community Cleanup',
    location: [40.7580, -73.9855],
    locationName: 'Times Square',
    difficulty: QuestDifficulty.C,
    minLevel: 1,
    trustPoints: 50,
    rewardGold: 100,
    type: '迷宫建设',
    estimatedTime: 30,
    neededProfessions: [Profession.MASON, Profession.STRIDER, Profession.CULTIVATOR],
    isUrgent: true,
    imageUrl: 'https://images.unsplash.com/photo-1534430480872-3498386e7856?auto=format&fit=crop&w=800&q=80'
  },
  {
    id: 'q2',
    title: 'Central Park Patrol',
    description: 'Monitor the ancient forest for anomalies.',
    realTask: 'Park Safety Watch',
    location: [40.785091, -73.968285],
    locationName: 'Central Park',
    difficulty: QuestDifficulty.B,
    minLevel: 5,
    trustPoints: 120,
    rewardGold: 300,
    type: '魔物讨伐',
    estimatedTime: 60,
    neededProfessions: [Profession.WARDEN, Profession.CHRONICLER, Profession.STRIDER],
    imageUrl: 'https://images.unsplash.com/photo-1510265119258-db115b0e8172?auto=format&fit=crop&w=800&q=80'
  },
  {
    id: 'q3',
    title: 'Brooklyn Bridge Supply Run',
    description: 'Transport essential crystals to the outpost.',
    realTask: 'Food Bank Delivery',
    location: [40.7061, -73.9969],
    locationName: 'Brooklyn Bridge',
    difficulty: QuestDifficulty.D,
    minLevel: 1,
    trustPoints: 30,
    rewardDesc: 'Free Bagel',
    rewardGold: 50,
    type: '物资运输',
    estimatedTime: 45,
    neededProfessions: [Profession.COURIER, Profession.ASSAYER, Profession.HEARTHKEEPER],
    imageUrl: 'https://images.unsplash.com/photo-1542384557-0e248b75f564?auto=format&fit=crop&w=800&q=80'
  }
];

export const MOCK_POSTS: CommunityPost[] = [
  {
    id: 'p1',
    author: 'Rimuru_Tempest',
    content: 'Just finished the patrol at Central Park. The squirrels are acting suspicious today. 🐿️ #SafetyFirst',
    timestamp: '2m ago',
    likes: 24,
    isUrgent: false,
    comments: [
        { id: 'c1', author: 'Gobta', content: 'Did you see the big one?', timestamp: '1m ago' }
    ]
  },
  {
    id: 'p2',
    author: 'Veldora',
    content: 'Found a great ramen spot near the dungeon entrance (Subway station). Highly recommend! 🍜',
    timestamp: '15m ago',
    likes: 156,
    isUrgent: false,
    mediaType: 'image',
    mediaUrl: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=800&q=80',
    comments: []
  }
];

export const BRAND_MANIFESTO = [
    {
        title: 'OUR PLEDGE',
        content: 'We believe in a world where digital value meets physical action. We do not sell ads. We support heroes.',
        highlight: true
    },
    {
        title: 'FOR BRANDS',
        content: 'Don\'t buy attention. Earn respect. Sponsor equipment, host workshops, and fuel the people who make the city better.'
    }
];

export const MOCK_BRAND_OPPS: BrandOpportunity[] = [
    {
        id: 'b1',
        brandName: 'Sony',
        title: 'Alpha Gear Program',
        description: 'Lending cameras to top-tier scouts for high-res documentation of city events.',
        type: 'EQUIPMENT',
        isProOnly: true
    },
    {
        id: 'b2',
        brandName: 'Patagonia',
        title: 'Urban Ranger Workshop',
        description: 'Free training session on sustainable city living and gear maintenance.',
        type: 'WORKSHOP',
        isProOnly: false
    }
];

/**
 * 种族设定。外观随机分配，所以这里不再绑定职业——职业是玩家自己选的。
 * `key` 对应 public/assets/avatars/ 下的文件名前缀。
 */
export const RACE_CONFIG: Record<Race, {
    key: string;
    desc: string;
    buff: string;
    /** 图库缺图时的兜底立绘 */
    img: string;
}> = {
    [Race.SLIME]: {
        key: 'slime',
        desc: '没有固定形态，也就没有做不到的事。与任何阵营都相处得来。',
        buff: '体力 +10%',
        img: '/assets/avatars/slime-01.jpg'
    },
    [Race.KIJIN]: {
        key: 'kijin',
        desc: '认了的事就做到底。荣誉比性命重要，因此从不后退。',
        buff: '力量 +15%',
        img: '/assets/avatars/kijin-01.jpg'
    },
    [Race.DAEMON]: {
        key: 'daemon',
        desc: '深谙契约与人心。别人说了什么不重要，没说什么才重要。',
        buff: '情报 +20%',
        img: '/assets/avatars/daemon-01.jpg'
    },
    [Race.DRAGONNEWT]: {
        key: 'dragonnewt',
        desc: '天空是它们的领地。抵达从来不是问题，问题是要不要去。',
        buff: '速度 +15%',
        img: '/assets/avatars/dragonnewt-01.jpg'
    },
    [Race.ANGEL]: {
        key: 'angel',
        desc: '天生就站在人群中央。说的话有人听，这本身就是一种力量。',
        buff: '魅力 +20%',
        img: '/assets/avatars/angel-01.jpg'
    },
    [Race.ELF]: {
        key: 'elf',
        desc: '在别人看见树之前就听见了林子。耐心是与生俱来的。',
        buff: '感知 +20%',
        img: '/assets/avatars/elf-01.jpg'
    },
    [Race.DWARF]: {
        key: 'dwarf',
        desc: '相信手比嘴可靠。经它们的手做出来的东西，能传三代。',
        buff: '耐久 +15%',
        img: '/assets/avatars/dwarf-01.jpg'
    },
    [Race.BEASTKIN]: {
        key: 'beastkin',
        desc: '靠直觉活着，而直觉很少出错。危险来临前会先竖起耳朵。',
        buff: '敏锐 +15%',
        img: '/assets/avatars/beastkin-01.jpg'
    },
    [Race.FAIRY]: {
        key: 'fairy',
        desc: '体型不大，主意很多。缝隙、屋檐和无人注意的角落都是它们的路。',
        buff: '灵巧 +20%',
        img: '/assets/avatars/fairy-01.jpg'
    },
    [Race.UNDEAD]: {
        key: 'undead',
        desc: '不必睡也不觉得累。别人放弃的时候，它们只是刚开始。',
        buff: '耐力 +25%',
        img: '/assets/avatars/undead-01.jpg'
    },
    [Race.MERFOLK]: {
        key: 'merfolk',
        desc: '能听懂话里没说出口的部分。情绪对它们来说是有形状的。',
        buff: '共鸣 +20%',
        img: '/assets/avatars/merfolk-01.jpg'
    },
    [Race.GOLEM]: {
        key: 'golem',
        desc: '一旦开始就不会中断。时间对它们几乎不构成消耗。',
        buff: '专注 +25%',
        img: '/assets/avatars/golem-01.jpg'
    }
};

/** 职业领域的展示顺序与说明。 */
export const PROFESSION_TRACKS: { track: ProfessionTrack; hint: string }[] = [
    { track: ProfessionTrack.RECORD,    hint: '让事情被看见、被记住' },
    { track: ProfessionTrack.LANGUAGE,  hint: '让人和人能听懂彼此' },
    { track: ProfessionTrack.LOGISTICS, hint: '让东西到位、让场地成形' },
    { track: ProfessionTrack.CARE,      hint: '照看人的身体与状态' },
    { track: ProfessionTrack.ORDER,     hint: '让规则和数目立得住' },
    { track: ProfessionTrack.CRAFT,     hint: '打通系统、渠道与体能' },
];

/**
 * 职业设定。这是「真实 + 游戏」的接缝：
 * 游戏里是身份，线下活动里决定你能承担什么角色。
 *
 * `expertise` 与 ProMembershipModal 的专长领域对应，选了职业就不必再填一次。
 */
export const PROFESSION_CONFIG: Record<Profession, {
    icon: string;
    tagline: string;
    track: ProfessionTrack;
    desc: string;
    /** 现实中对应的能力 */
    realSkill: string;
    expertise: string;
}> = {
    // ── 记录与传播 ────────────────────────────────
    [Profession.CHRONICLER]: {
        icon: '📷', tagline: 'Chronicler', track: ProfessionTrack.RECORD,
        desc: '把发生过的事留下来。活动的影像与记录由你负责。',
        realSkill: '摄影 / 摄像 / 记录',
        expertise: 'photo'
    },
    [Profession.ILLUMINATOR]: {
        icon: '🎨', tagline: 'Illuminator', track: ProfessionTrack.RECORD,
        desc: '让东西好看起来。海报、招牌、视觉物料出自你手。',
        realSkill: '设计 / 插画 / 排版',
        expertise: 'design'
    },
    [Profession.HERALD]: {
        icon: '📣', tagline: 'Herald', track: ProfessionTrack.RECORD,
        desc: '让人聚起来。开场、串场、把气氛带热是你的领域。',
        realSkill: '主持 / 活动组织 / 运营',
        expertise: 'social'
    },

    // ── 语言与沟通 ────────────────────────────────
    [Profession.LINGUIST]: {
        icon: '🗝️', tagline: 'Linguist', track: ProfessionTrack.LANGUAGE,
        desc: '让听不懂的人听懂。跨语言的场合少不了你。',
        realSkill: '翻译 / 口译 / 多语沟通',
        expertise: 'translation'
    },
    [Profession.CONFIDANT]: {
        icon: '🫧', tagline: 'Confidant', track: ProfessionTrack.LANGUAGE,
        desc: '有人需要被听见的时候，你在。不急着给建议是你的长处。',
        realSkill: '心理 / 倾听 / 咨询陪伴',
        expertise: 'counseling'
    },
    [Profession.MENTOR]: {
        icon: '📖', tagline: 'Mentor', track: ProfessionTrack.LANGUAGE,
        desc: '把会的教给不会的。新人第一次上手时最需要你。',
        realSkill: '教育 / 培训 / 带教',
        expertise: 'teaching'
    },

    // ── 物资与建造 ────────────────────────────────
    [Profession.COURIER]: {
        icon: '📦', tagline: 'Courier', track: ProfessionTrack.LOGISTICS,
        desc: '把东西送到该去的地方。物资与补给线交给你。',
        realSkill: '运输 / 配送 / 仓储',
        expertise: 'logistics'
    },
    [Profession.ARTIFICER]: {
        icon: '🔧', tagline: 'Artificer', track: ProfessionTrack.LOGISTICS,
        desc: '坏掉的东西经你的手会重新转起来。',
        realSkill: '维修 / 手作 / 设备',
        expertise: 'repair'
    },
    [Profession.MASON]: {
        icon: '🧱', tagline: 'Mason', track: ProfessionTrack.LOGISTICS,
        desc: '空场地在你手里变成能用的场地。搭建与收场都算你的。',
        realSkill: '建筑 / 装修 / 场地搭建',
        expertise: 'construction'
    },

    // ── 照护与生养 ────────────────────────────────
    [Profession.MENDER]: {
        icon: '🌿', tagline: 'Mender', track: ProfessionTrack.CARE,
        desc: '照看状态不好的人。急救与陪伴都是你的本事。',
        realSkill: '医护 / 急救 / 照护',
        expertise: 'care'
    },
    [Profession.HEARTHKEEPER]: {
        icon: '🍲', tagline: 'Hearthkeeper', track: ProfessionTrack.CARE,
        desc: '一顿热的能挽回很多东西。补给点的火由你看着。',
        realSkill: '餐饮 / 烹饪 / 食品',
        expertise: 'culinary'
    },
    [Profession.CULTIVATOR]: {
        icon: '🌱', tagline: 'Cultivator', track: ProfessionTrack.CARE,
        desc: '和活的东西打交道。种植、绿化、动物照料都归你。',
        realSkill: '农业 / 园艺 / 动物照料',
        expertise: 'cultivation'
    },

    // ── 秩序与规则 ────────────────────────────────
    [Profession.WARDEN]: {
        icon: '🛡️', tagline: 'Warden', track: ProfessionTrack.ORDER,
        desc: '人多的地方需要有人盯着。安全与秩序是你的职责。',
        realSkill: '安保 / 秩序维护 / 应急',
        expertise: 'security'
    },
    [Profession.ARBITER]: {
        icon: '⚖️', tagline: 'Arbiter', track: ProfessionTrack.ORDER,
        desc: '规矩要立得住，也要讲得清。争议摆到你面前才有结论。',
        realSkill: '法律 / 合规 / 调解',
        expertise: 'legal'
    },
    [Profession.ASSAYER]: {
        icon: '📐', tagline: 'Assayer', track: ProfessionTrack.ORDER,
        desc: '数目对不上就别开工。账、预算与物资清点交给你。',
        realSkill: '财务 / 会计 / 核算',
        expertise: 'finance'
    },

    // ── 探索与技术 ────────────────────────────────
    [Profession.WEAVER]: {
        icon: '🕸️', tagline: 'Weaver', track: ProfessionTrack.CRAFT,
        desc: '系统、网络、看不见的那层由你打理。出问题时大家找你。',
        realSkill: 'IT / 开发 / 技术支持',
        expertise: 'tech'
    },
    [Profession.TRADER]: {
        icon: '🪙', tagline: 'Trader', track: ProfessionTrack.CRAFT,
        desc: '把需要的和拥有的接上。谈条件、拉赞助是你的战场。',
        realSkill: '销售 / 商务 / 采购',
        expertise: 'business'
    },
    [Profession.STRIDER]: {
        icon: '🏃', tagline: 'Strider', track: ProfessionTrack.CRAFT,
        desc: '需要跑起来的活儿找你。体力活和长距离都不在话下。',
        realSkill: '运动 / 体能 / 户外',
        expertise: 'athletics'
    }
};

export const MOCK_GUILDS: PlayerGuild[] = [
    {
        id: 'g1',
        name: '貓貓巡邏隊',
        description: '專門負責餵食街貓跟巡邏公園的休閒公會，歡迎愛貓人士～',
        leader: 'MeowMaster',
        memberCount: 128,
        level: 5,
        isJoined: false,
        tags: ['動物友善', '休閒', '公園'],
        bannerUrl: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&w=800&q=80'
    },
    {
        id: 'g2',
        name: '深夜食堂',
        description: '尋找紐約最好吃的宵夜，並負責深夜物資運送。',
        leader: 'ChefSan',
        memberCount: 45,
        level: 3,
        isJoined: true,
        tags: ['美食', '夜貓子', '運輸'],
        bannerUrl: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=800&q=80'
    },
    {
        id: 'g3',
        name: '鐵壁防線',
        description: '負責大型活動秩序維護與災害支援。硬核玩家請進。',
        leader: 'IronWall',
        memberCount: 300,
        level: 9,
        isJoined: false,
        tags: ['硬核', '紀律', '守護'],
        bannerUrl: 'https://images.unsplash.com/photo-1595855769995-2dfb750cb39d?auto=format&fit=crop&w=800&q=80'
    },
    {
        id: 'g4',
        name: '綠色和平',
        description: '致力於城市綠化與環保回收任務。',
        leader: 'Leafy',
        memberCount: 89,
        level: 4,
        isJoined: false,
        tags: ['環保', '自然', '回收'],
        bannerUrl: 'https://images.unsplash.com/photo-1518531933037-9a8477d09333?auto=format&fit=crop&w=800&q=80'
    }
];
