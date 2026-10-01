import { useEffect, useState } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

/**
 * 系统的「减少动态效果」设置。
 *
 * CSS 动画用 @media 就能降级，但结算的数字计数是 JS 逐帧驱动的，媒体查询管不到，
 * 必须在 JS 里读到同一个开关。订阅 change 是因为玩家可能在游戏中途去系统里切换它。
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(QUERY).matches
      : false,
  );

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia(QUERY);
    const onChange = () => setReduced(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return reduced;
}
