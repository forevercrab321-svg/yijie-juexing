/**
 * 语音输入插槽。
 *
 * ⬛ 这里**故意是空的**。
 *
 * 项目不接任何云端 ASR——音频不离开这台设备，是既定的产品决定，
 * PRIVACY.md 的「数据不出本机」因此依然成立。语音识别由你之后放进来的
 * 开源引擎在浏览器里本地完成（whisper.cpp / sherpa-onnx / Moonshine 之类，
 * 编译成 WASM 跑在 worker 里）。
 *
 * ── 接入方式 ────────────────────────────────────────────────
 *
 * 写一个满足 SttEngine 的对象，在应用启动时注册一次即可，
 * 其余代码（麦克风按钮、录音、状态机、把结果送给艾琳娜）都已经就绪：
 *
 *   import { registerSttEngine } from './lib/agent/stt';
 *
 *   registerSttEngine({
 *     name: 'whisper-tiny-wasm',
 *     async load() { ... 把模型加载进 worker ... },
 *     async transcribe(audio, signal) { ... 返回识别出的文字 ... },
 *   });
 *
 * 注册之前，界面上的麦克风按钮是禁用状态并标明原因，不会假装能用。
 *
 * ── 为什么是「引擎自己拿麦克风」的反面 ──────────────────────
 *
 * 录音归应用管，识别归引擎管。这样换引擎时不必重写录音、VAD、打断逻辑，
 * 引擎只需要回答一个问题：这段音频说了什么。
 */

export interface SttEngine {
  /** 引擎名，只用于日志与界面提示 */
  name: string;
  /**
   * 预加载模型。应用会在用户第一次点麦克风前调用，
   * 失败就退回打字，不要抛到界面上。
   */
  load?: () => Promise<void>;
  /**
   * 把一段录音转成文字。
   *
   * @param audio 一段完整的录音。由 MediaRecorder 产出，通常是 audio/webm。
   *              需要别的格式就在引擎内部转，不要反过来要求应用改录音方式。
   * @param signal 用户中途取消时会 abort，请尽快返回。
   * @returns 识别出的文字。识别不出内容就返回空字符串，不要抛异常。
   */
  transcribe: (audio: Blob, signal: AbortSignal) => Promise<string>;
}

let engine: SttEngine | null = null;
let loadPromise: Promise<void> | null = null;

/** 注册本地语音引擎。重复注册以最后一次为准，方便热替换调试。 */
export function registerSttEngine(next: SttEngine): void {
  engine = next;
  loadPromise = null;
  console.info(`[stt] 已注册本地语音引擎：${next.name}`);
}

export function hasSttEngine(): boolean {
  return engine !== null;
}

export function sttEngineName(): string | null {
  return engine?.name ?? null;
}

/**
 * 确保模型已加载。多次调用只会真正加载一次。
 * 加载失败会把 promise 清掉，让下次点击可以重试——模型下载失败是常见且可恢复的。
 */
export async function ensureSttReady(): Promise<boolean> {
  if (!engine) return false;
  if (!engine.load) return true;

  if (!loadPromise) {
    loadPromise = engine.load().catch((err) => {
      console.error('[stt] 引擎加载失败：', err);
      loadPromise = null;
      throw err;
    });
  }
  try {
    await loadPromise;
    return true;
  } catch {
    return false;
  }
}

/** 识别一段录音。没有引擎时返回 null，调用方据此提示「语音输入未接入」。 */
export async function transcribe(audio: Blob, signal: AbortSignal): Promise<string | null> {
  if (!engine) return null;
  if (!(await ensureSttReady())) return null;

  try {
    return (await engine.transcribe(audio, signal)).trim();
  } catch (err) {
    if (signal.aborted) return null;
    console.error('[stt] 识别失败：', err);
    return null;
  }
}
