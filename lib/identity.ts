/**
 * 证件号处理。
 *
 * 设计原则：证件号原文只在用户输入的那一刻存在于表单里，
 * 校验通过后立刻转成掩码，原文既不进应用状态、不落 localStorage、也不发往任何服务端。
 * 应用真正需要记住的只有两件事：这个人验过、以及末四位（供本人辨认）。
 */

export type IdKind = 'CN_MAINLAND' | 'GENERIC';

export interface IdValidation {
  valid: boolean;
  kind: IdKind;
  /** 校验失败时的原因码，供 UI 映射成提示文案 */
  reason?: 'EMPTY' | 'FORMAT' | 'CHECKSUM' | 'TOO_SHORT';
}

const CN_WEIGHTS = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
const CN_CHECK_CODES = ['1', '0', 'X', '9', '8', '7', '6', '5', '4', '3', '2'];

/**
 * 校验证件号。
 * 18 位数字（末位可为 X）走 GB 11643 校验位算法；其余按通用证件宽松校验，
 * 只拦明显无效的输入，不假设用户一定持有中国大陆身份证。
 */
export function validateId(raw: string): IdValidation {
  const value = raw.trim().toUpperCase();
  if (!value) return { valid: false, kind: 'GENERIC', reason: 'EMPTY' };

  if (/^\d{17}[\dX]$/.test(value)) {
    const sum = CN_WEIGHTS.reduce((acc, w, i) => acc + parseInt(value[i], 10) * w, 0);
    const expected = CN_CHECK_CODES[sum % 11];
    return value[17] === expected
      ? { valid: true, kind: 'CN_MAINLAND' }
      : { valid: false, kind: 'CN_MAINLAND', reason: 'CHECKSUM' };
  }

  if (!/^[A-Z0-9]+$/.test(value)) {
    return { valid: false, kind: 'GENERIC', reason: 'FORMAT' };
  }
  if (value.length < 6) {
    return { valid: false, kind: 'GENERIC', reason: 'TOO_SHORT' };
  }
  return { valid: true, kind: 'GENERIC' };
}

/** 生成只保留末四位的掩码，例如 `**************1234`。这是唯一会被保存的形态。 */
export function maskId(raw: string): string {
  const value = raw.trim().toUpperCase();
  if (value.length <= 4) return '*'.repeat(value.length);
  return '*'.repeat(value.length - 4) + value.slice(-4);
}

/**
 * 尽力擦除内存中的证件号字符串。
 *
 * JS 的字符串不可变，无法真正抹掉底层内存——这里能做的是断开引用，
 * 让它尽快可被 GC 回收，并把"不要长期持有原文"这条约束显式写进代码。
 * 真正的强保证只能来自"根本不收集原文"，见 PRIVACY.md 的改进建议。
 */
export function discard(ref: { value: string }): void {
  ref.value = '';
}
