/**
 * 本地档案存储。
 *
 * 专属卡通形象生成一次就固定下来——它是用户的身份标识，不该每次打开都重画，
 * 那样既不稳定（每次长得不一样）也白烧额度。形象连同档案一起存在本设备上。
 *
 * 这里刻意只用 localStorage，不引入 IndexedDB：数据总量就是一份档案加一张图，
 * 远在配额之内，而同步 API 让读取路径简单得多。
 *
 * 注意：启用本地留存后，数据不再"关掉页面就消失"。
 * ConsentGate 的留存说明与 PRIVACY.md 必须与这里保持一致，
 * 并且必须始终提供 clearSession() 的用户入口。
 */

import type { User } from '../types';
import type { ConsentState } from '../components/ConsentGate';

const KEY = 'aethelgard:session:v1';

interface StoredSession {
  version: 1;
  consent: ConsentState;
  user: User;
  savedAt: number;
}

export interface LoadedSession {
  consent: ConsentState;
  user: User;
}

/** 读取本设备上的档案。数据损坏或版本不符时当作没有，不让坏数据卡住启动。 */
export function loadSession(): LoadedSession | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as StoredSession;
    if (parsed?.version !== 1 || !parsed.user || !parsed.consent) return null;

    // 字段级校验。老版本存下的档案可能缺少后来才加的字段（例如 profession），
    // 直接放行会让读取方拿到 undefined 后崩在渲染里。缺字段就当没有存档，
    // 让用户重走一次觉醒流程——比白屏好。
    if (!parsed.user.race || !parsed.user.profession || !parsed.user.name) return null;

    return { consent: parsed.consent, user: parsed.user };
  } catch {
    return null;
  }
}

/**
 * 保存档案。
 *
 * 头像是 data URI，通常两三百 KB；配额撑爆时退一步只存档案不存头像，
 * 让用户下次至少还能以预设立绘登入，而不是整份档案一起丢失。
 */
export function saveSession(consent: ConsentState, user: User): void {
  const payload: StoredSession = { version: 1, consent, user, savedAt: Date.now() };

  try {
    localStorage.setItem(KEY, JSON.stringify(payload));
  } catch (err) {
    console.warn('[storage] 档案保存失败，尝试不含头像再存一次:', err);
    try {
      const lite: StoredSession = { ...payload, user: { ...user, avatarUrl: undefined } };
      localStorage.setItem(KEY, JSON.stringify(lite));
    } catch (err2) {
      console.error('[storage] 档案保存彻底失败，本次会话不会被记住:', err2);
    }
  }
}

/** 清除本设备上的全部档案。必须有对应的用户入口。 */
export function clearSession(): void {
  try {
    localStorage.removeItem(KEY);
  } catch (err) {
    console.error('[storage] 清除失败:', err);
  }
}
