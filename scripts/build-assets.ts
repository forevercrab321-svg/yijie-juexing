/**
 * 资产生成脚本 —— 把运行时的第三方图片请求变成仓库里的静态文件。
 *
 * 用法（需要先在 .env.local 配好 MINIMAX_API_KEY）：
 *   npm run assets            生成缺失的图片与语音
 *   npm run assets:images     只做图片
 *   npm run assets:voices     只做语音
 *   npm run assets -- --force 重新生成全部（默认跳过已存在的文件，避免白烧额度）
 *
 * 图片进 public/assets/，语音进 public/audio/elena/。
 * 台词与艾琳娜的角色设定来自 lib/elena.ts，改那里再重跑即可，不必动本脚本。
 */

import { writeFile, mkdir, access } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ELENA_LINES,
  ELENA_PERSONA,
  buildSpeechInstruction,
  type ElenaLineId,
} from '../lib/elena.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// ─────────────────────────── 环境变量 ───────────────────────────

/** 简易 .env 解析。为一个构建脚本引入 dotenv 不值得。 */
function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  try {
    const raw = readFileSync(join(ROOT, '.env.local'), 'utf8');
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
    }
  } catch {
    /* 没有 .env.local 时退回进程环境变量 */
  }
  return { ...env, ...process.env } as Record<string, string>;
}

const env = loadEnv();
const API_KEY = env.MINIMAX_API_KEY;
const BASE_URL = (env.MINIMAX_BASE_URL || 'https://api.minimax.io').replace(/\/+$/, '');
const GROUP_ID = env.MINIMAX_GROUP_ID;
const VOICE_ID = env.MINIMAX_TTS_VOICE_ID || 'Chinese (Mandarin)_Lyrical_Voice';

if (!API_KEY || API_KEY === 'PLACEHOLDER_API_KEY') {
  console.error('✗ .env.local 里没有可用的 MINIMAX_API_KEY');
  process.exit(1);
}

// ─────────────────────────── 资产清单 ───────────────────────────

/**
 * 全站统一的 2D 插画风格。
 *
 * 这些是**占位图**——正式美术由人来出，规格见 public/assets/README.md。
 * 脚本默认跳过已存在的文件，所以成品图放进来之后再跑也不会被覆盖。
 */
const ART_STYLE_2D =
  '2D anime illustration, clean line art, cel shading, vibrant flat colors, ' +
  'soft rim light, simple uncluttered background, high quality anime character art, ' +
  'no 3D render, no photorealism';

interface ImageAsset {
  /** 输出文件名（不含扩展名），同时是代码里引用的路径片段 */
  id: string;
  prompt: string;
  aspectRatio: string;
  /** 固定 seed：改 prompt 时形象变化可控，不改就永远是同一张 */
  seed: number;
  note: string;
}

/** 场景图。 */
const SCENE_ASSETS: ImageAsset[] = [
  {
    id: 'hero-landing',
    prompt:
      '2D anime illustration, wide vertical landscape of a solarpunk fantasy city, ' +
      'giant trees and floating islands, waterfalls, blue sky, Studio Ghibli inspired, ' +
      'soft painted background art, no characters',
    aspectRatio: '9:16',
    seed: 777,
    note: '觉醒流程的全屏背景',
  },
  // 艾琳娜的立绘刻意不在这里自动生成。
  //
  // 她用的是人工定稿的美术图（public/assets/elena/*.jpg），
  // 脚本按文字设定重画出来的是另一个人——放进去会把定稿覆盖掉。
  // 角色设定与各表情的差异描述见 lib/elena.ts 的 ELENA_PERSONA 与 EXPRESSION_PROMPTS，
  // 补新表情时照那份规格画，不要从这里生成。
  {
    id: 'world-hero',
    prompt:
      '2D anime illustration, fantasy city skyline at dusk, warm lights, painted background art, ' +
      'panoramic banner, no characters',
    aspectRatio: '21:9',
    seed: 404,
    note: '世界频道横幅',
  },
];

/**
 * 角色立绘图库。玩家的相貌从这里随机抽取。
 * 每个种族生成 VARIANTS_PER_RACE 张，通过 variantHint 让同种族的几张有所区分。
 */
/**
 * 每个种族的 4 张变体 = **2 男 2 女**（序号 01/03 男，02/04 女）。
 *
 * 性别必须显式写进 variantHints：`look` 保持中性时，模型会默认画女性，
 * 48 张会清一色是女的——男性玩家抽到自己的相貌时没有代表性。
 * 组装 prompt 时性别放在最前面，权重更高。
 */
const RACE_ART: { key: string; label: string; look: string; variantHints: string[] }[] = [
  {
    key: 'slime',
    label: '利姆鲁·史莱姆',
    look: 'cheerful character with translucent blue accessories and a small crown, soft blue hair',
    variantHints: [
      'a young man with short messy hair, oversized hoodie',
      'a young woman with long wavy hair, flowing cape',
      'a man with tousled hair, casual scarf',
      'a woman with twin tails, cropped jacket',
    ],
  },
  {
    key: 'kijin',
    label: '鬼人族·侍大将',
    look: 'japanese oni warrior with red oni horns, samurai-inspired armor, confident expression',
    variantHints: [
      'a muscular man with a topknot and shoulder guard',
      'a woman with a high ponytail and red armor',
      'a man with short cropped hair and a facial scar',
      'a woman with long white hair and a sash',
    ],
  },
  {
    key: 'daemon',
    label: '原初之黑·恶魔',
    look: 'elegant demon character with dark horns and a tail, black formal coat, calm smirk',
    variantHints: [
      'a man with slicked-back hair and gloves',
      'a woman with wavy hair and a monocle',
      'a man with short hair and a high collar',
      'a woman with long hair and chain accessories',
    ],
  },
  {
    key: 'dragonnewt',
    label: '龙人族·龙战士',
    look: 'dragon-blooded warrior with small horns, scaled green accents, tail',
    variantHints: [
      'a broad-shouldered man with spiky hair and shoulder scales',
      'a woman with long hair and a wing cloak',
      'a man with short hair and heavy gauntlets',
      'a woman with tied-back hair and a chest plate',
    ],
  },
  {
    key: 'angel',
    label: '天翼族·歼灭天使',
    look: 'winged character with small white wings and a halo, white and gold outfit, serene expression',
    variantHints: [
      'a man with short silver hair',
      'a woman with long straight hair',
      'a man with cropped hair and a feather collar',
      'a woman with a high ponytail and a sash',
    ],
  },
  {
    key: 'elf',
    label: '森精灵·守林人',
    look: 'forest elf with long pointed ears, leaf and vine ornaments, deep green and bark-brown clothing, calm watchful eyes',
    variantHints: [
      'a man with long braided hair',
      'a woman with silver hair and a leaf circlet',
      'a man with short hair and a hooded cloak',
      'a woman with tied-back hair and an archer bracer',
    ],
  },
  {
    key: 'dwarf',
    label: '矮人族·锻炉子嗣',
    look: 'sturdy dwarf artisan, broad build, leather apron with copper fittings, soot-marked hands, warm confident face',
    variantHints: [
      'a stout man with a thick braided beard',
      'a stout woman with braided hair and a headband',
      'a man with short hair and goggles on the forehead',
      'a woman with a topknot and forge gloves',
    ],
  },
  {
    key: 'beastkin',
    label: '兽人族·野性同盟',
    look: 'beastkin with animal ears and tail, tribal patterned clothing, alert lively expression',
    variantHints: [
      'a man with wolf ears and short hair',
      'a woman with cat ears and long hair',
      'a man with hound ears and cropped hair',
      'a woman with fox ears and a side braid',
    ],
  },
  {
    key: 'fairy',
    label: '妖精族·微光使',
    look: 'petite fairy with translucent insect-like wings, soft glow around the body, flower and dew ornaments',
    variantHints: [
      'a slender young man with a pixie cut',
      'a young woman with long hair and a petal dress',
      'a young man with tousled hair and dragonfly wings',
      'a young woman with twin buns and luminous trim',
    ],
  },
  {
    key: 'undead',
    label: '不死者·长夜行者',
    look: 'dignified undead with pale skin, faint dark veins, deep violet and charcoal funeral attire, quiet tireless gaze',
    variantHints: [
      'a gaunt man with long dark hair',
      'a woman with white hair and a mourning veil',
      'a man with short hair and a high collar',
      'a woman with a bandaged arm and a cloak',
    ],
  },
  {
    key: 'merfolk',
    label: '人鱼族·潮汐歌者',
    look: 'merfolk with iridescent scale patterns on skin, fin-like ears, teal and pearl gradient garments, gentle empathetic expression',
    variantHints: [
      'a man with long flowing hair and a shell ornament',
      'a woman with wavy hair and pearl strands',
      'a man with short hair and a fin collar',
      'a woman with braided hair and a coral crown',
    ],
  },
  {
    key: 'golem',
    label: '傀儡族·不眠石心',
    look: 'humanoid golem with stone and terracotta texture skin, visible seams, a softly lit core in the chest, impassive steady face',
    variantHints: [
      'a broad male-form golem with carved geometric patterns',
      'a slender female-form golem with runic engravings',
      'a male-form golem with moss on the shoulders',
      'a female-form golem with gold repair seams',
    ],
  },
];

/** 每个种族生成几张。必须与 lib/avatar.ts 的 VARIANTS_PER_RACE 一致。 */
const VARIANTS_PER_RACE = 4;

const AVATAR_ASSETS: ImageAsset[] = RACE_ART.flatMap((race) =>
  Array.from({ length: VARIANTS_PER_RACE }, (_, i) => ({
    id: `avatars/${race.key}-${String(i + 1).padStart(2, '0')}`,
    // 性别提示放在最前面：越靠前权重越高，否则模型会忽略它默认画女性
    prompt: `${ART_STYLE_2D}, ${race.variantHints[i % race.variantHints.length]}, ${race.look}, upper body portrait, character centered`,
    aspectRatio: '3:4',
    seed: 1000 + RACE_ART.indexOf(race) * 100 + i,
    note: `${race.label} 立绘 ${i + 1}（${i % 2 === 0 ? '男' : '女'}）`,
  })),
);

const IMAGE_ASSETS: ImageAsset[] = [...SCENE_ASSETS, ...AVATAR_ASSETS];

// ─────────────────────────── MiniMax 调用 ───────────────────────────

/**
 * MiniMax 的失败常常以 HTTP 200 + base_resp.status_code != 0 的形式返回，
 * 只看 res.ok 会把鉴权失败、余额不足当成功。
 */
async function callMiniMax(path: string, payload: unknown, withGroupId = false) {
  let url = `${BASE_URL}${path}`;
  if (withGroupId && GROUP_ID) url += `?GroupId=${encodeURIComponent(GROUP_ID)}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }

  const data: any = await res.json();
  const code = data?.base_resp?.status_code;
  if (code !== undefined && code !== 0) {
    const hints: Record<number, string> = {
      1002: '触发限流，稍后重试',
      1004: '鉴权失败，检查 MINIMAX_API_KEY',
      1008: '余额不足',
      1026: '内容被安全审核拦截，需要调整 prompt',
      2049: 'API key 无效',
    };
    throw new Error(`base_resp ${code}: ${data?.base_resp?.status_msg}${hints[code] ? ` — ${hints[code]}` : ''}`);
  }
  return data;
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

// ─────────────────────────── 生成流程 ───────────────────────────

async function buildImages(force: boolean) {
  const outDir = join(ROOT, 'public', 'assets');
  await mkdir(outDir, { recursive: true });

  console.log(`\n▸ 图片资产（${IMAGE_ASSETS.length} 张）`);
  for (const asset of IMAGE_ASSETS) {
    const outPath = join(outDir, `${asset.id}.jpg`);
    // id 可能带子目录（如 avatars/slime-01）
    await mkdir(dirname(outPath), { recursive: true });

    if (!force && (await exists(outPath))) {
      console.log(`  · ${asset.id} 已存在，跳过`);
      continue;
    }

    process.stdout.write(`  · ${asset.id} … `);
    try {
      const data = await callMiniMax('/v1/image_generation', {
        model: 'image-01',
        prompt: asset.prompt,
        aspect_ratio: asset.aspectRatio,
        response_format: 'base64',
        seed: asset.seed,
        n: 1,
        prompt_optimizer: true,
      });

      const b64 = data?.data?.image_base64?.[0];
      if (!b64) throw new Error('响应里没有图片数据');

      await writeFile(outPath, Buffer.from(b64, 'base64'));
      console.log(`✓ ${asset.note}`);
    } catch (err) {
      console.log(`✗ ${(err as Error).message}`);
    }
  }
}

async function buildVoices(force: boolean) {
  const outDir = join(ROOT, 'public', 'audio', 'elena');
  await mkdir(outDir, { recursive: true });

  const lines = Object.values(ELENA_LINES);
  console.log(`\n▸ 艾琳娜语音（${lines.length} 条）`);

  for (const line of lines) {
    const outPath = join(outDir, `${line.id}.mp3`);
    if (!force && (await exists(outPath))) {
      console.log(`  · ${line.id} 已存在，跳过`);
      continue;
    }

    process.stdout.write(`  · ${line.id} … `);
    try {
      const data = await callMiniMax(
        '/v1/t2a_v2',
        {
          model: 'speech-2.6-hd',
          // 与服务端实时合成走同一条指令，保证音色一致
          text: buildSpeechInstruction(line.text),
          stream: false,
          output_format: 'hex',
          voice_setting: { voice_id: VOICE_ID, speed: 1.0, vol: 1.0, pitch: 0, emotion: 'calm' },
          audio_setting: { sample_rate: 32000, bitrate: 128000, format: 'mp3', channel: 1 },
          language_boost: 'Chinese',
        },
        true,
      );

      const hex = data?.data?.audio;
      if (!hex) throw new Error('响应里没有音频数据');

      await writeFile(outPath, Buffer.from(hex, 'hex'));
      console.log(`✓ ${line.scene}`);
    } catch (err) {
      console.log(`✗ ${(err as Error).message}`);
    }
  }
}

// ─────────────────────────── 入口 ───────────────────────────

const args = process.argv.slice(2);
const force = args.includes('--force');
const onlyImages = args.includes('--images');
const onlyVoices = args.includes('--voices');
const doAll = !onlyImages && !onlyVoices;

console.log(`MiniMax 资产生成 · ${BASE_URL}${force ? ' · 强制重建' : ''}`);

if (doAll || onlyImages) await buildImages(force);
if (doAll || onlyVoices) await buildVoices(force);

console.log('\n完成。图片在 public/assets/，语音在 public/audio/elena/');
