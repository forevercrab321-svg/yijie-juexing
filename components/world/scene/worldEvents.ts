/**
 * 世界事件总线（契约 B）。
 *
 * 这是 App 唯一允许静态 import 的 scene/ 文件，所以必须保持零依赖、不得 import three——
 * 否则 three 会被打进入口包，同意页也要为 3D 付费。
 *
 * 用法：
 *   界面发 recenter / resetView；App 在 acceptQuest 内发 pulse、在升级时发 celebrate；
 *   场景（WorldMap）挂载时订阅并演出，卸载时取消订阅。2D 模式下没有订阅者，事件直接丢弃。
 */

export type WorldEvent =
  | { type: 'recenter' }
  | { type: 'resetView' }
  | { type: 'pulse'; questId: string }
  | { type: 'celebrate' };

export type WorldEventListener = (event: WorldEvent) => void;

const listeners = new Set<WorldEventListener>();

export const worldEvents = {
  emit(event: WorldEvent): void {
    // 拷贝一份再遍历：监听者可能在回调里取消订阅
    for (const listener of Array.from(listeners)) {
      try {
        listener(event);
      } catch (err) {
        // 一个订阅者出错不能让其他订阅者（以及 App 的接取流程）跟着中断
        console.warn('[worldEvents] listener failed:', err);
      }
    }
  },

  /** 订阅事件，返回取消订阅函数 */
  on(listener: WorldEventListener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

// 世界范围判定同样零依赖，转出给 App 判断「不在纽约」时禁用「回到我」
export { isInWorld, WORLD_BOUNDS } from './geo';
