/**
 * 输入：Pointer Events 统一处理鼠标与触控。
 *
 * - 单指 / 左键拖动：绕焦点旋转（横向改航向、纵向改俯仰）
 * - 双指：捏合缩放 + 扭转改航向 + 质心平移；滚轮：缩放
 * - 右键 / 中键 / Shift+左键拖动：平移
 * - 点击判定：位移 < 8 px 且按下时长 < 450 ms（按事件时间戳）。拖动过的手势一律不算点击，
 *   所以从徽章上开始拖动不会误触聚焦。
 *
 * 页面手势冲突：容器设 touch-action:none（覆盖 body 的 pan-x pan-y），滚轮 passive:false 并阻止默认，
 * iOS Safari 的 gesturestart 也要拦，否则双指会把整页放大。
 */

export interface InputCallbacks {
  /** 任意按下：开场镜头与飞行立即停止 */
  onInteractStart(): void;
  onRotate(dxPx: number, dyPx: number): void;
  onPan(dxPx: number, dyPx: number): void;
  onZoom(factor: number): void;
  onTwist(dDeg: number): void;
  onTap(clientX: number, clientY: number, pointerType: string): void;
}

interface PointerState {
  x: number;
  y: number;
  startX: number;
  startY: number;
  startT: number;
  type: string;
}

const TAP_MOVE_PX = 8;
// 按下到抬起的时长用事件自带的时间戳算：主线程忙或帧很慢时，处理时刻会被推迟，但事件发生的时刻不会
const TAP_MS = 450;

export class InputController {
  private readonly el: HTMLElement;
  private readonly cb: InputCallbacks;
  private readonly pointers = new Map<number, PointerState>();
  private mode: 'none' | 'rotate' | 'pan' | 'pinch' = 'none';
  private dragging = false;
  private pinch = { dist: 0, angle: 0, cx: 0, cy: 0 };
  private readonly listeners: [EventTarget, string, EventListener, AddEventListenerOptions | boolean][] = [];

  constructor(el: HTMLElement, cb: InputCallbacks) {
    this.el = el;
    this.cb = cb;
    this.on(el, 'pointerdown', this.onDown as EventListener);
    this.on(el, 'pointermove', this.onMove as EventListener);
    this.on(el, 'pointerup', this.onUp as EventListener);
    this.on(el, 'pointercancel', this.onCancel as EventListener);
    this.on(el, 'lostpointercapture', this.onCancel as EventListener);
    this.on(el, 'wheel', this.onWheel as EventListener, { passive: false });
    this.on(el, 'contextmenu', prevent);
    this.on(el, 'dblclick', prevent);
    this.on(el, 'gesturestart', prevent, { passive: false });
    this.on(el, 'gesturechange', prevent, { passive: false });
    this.on(el, 'gestureend', prevent, { passive: false });
  }

  private on(t: EventTarget, type: string, fn: EventListener, opts: AddEventListenerOptions | boolean = false): void {
    t.addEventListener(type, fn, opts);
    this.listeners.push([t, type, fn, opts]);
  }

  private pinchMetrics(): { dist: number; angle: number; cx: number; cy: number } {
    const [a, b] = Array.from(this.pointers.values());
    return {
      dist: Math.hypot(b.x - a.x, b.y - a.y),
      angle: (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI,
      cx: (a.x + b.x) / 2,
      cy: (a.y + b.y) / 2,
    };
  }

  private onDown = (e: PointerEvent): void => {
    // 新一轮手势的第一根手指（或鼠标）：清掉上一轮可能漏收 pointerup 的残留指针，
    // 否则下一次单指点击会被误当成双指捏合
    if (e.isPrimary && this.pointers.size > 0) {
      this.pointers.clear();
      this.mode = 'none';
      this.dragging = false;
    }
    if (this.pointers.size >= 2) return;
    try {
      this.el.setPointerCapture(e.pointerId);
    } catch {
      /* 某些合成事件没有可捕获的指针，忽略 */
    }
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY, startT: e.timeStamp, type: e.pointerType });
    this.cb.onInteractStart();
    if (this.pointers.size === 1) {
      const panMode = e.button === 1 || e.button === 2 || e.shiftKey || e.ctrlKey || e.metaKey;
      this.mode = panMode ? 'pan' : 'rotate';
      this.dragging = false;
    } else {
      this.mode = 'pinch';
      this.dragging = true;
      this.pinch = this.pinchMetrics();
    }
    if (e.pointerType !== 'mouse') e.preventDefault();
  };

  private onMove = (e: PointerEvent): void => {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    p.x = e.clientX;
    p.y = e.clientY;
    if (this.mode === 'pinch' && this.pointers.size === 2) {
      const m = this.pinchMetrics();
      if (this.pinch.dist > 0 && m.dist > 0) this.cb.onZoom(this.pinch.dist / m.dist);
      let da = m.angle - this.pinch.angle;
      if (da > 180) da -= 360;
      if (da < -180) da += 360;
      if (Math.abs(da) < 20) this.cb.onTwist(da);
      this.cb.onPan(m.cx - this.pinch.cx, m.cy - this.pinch.cy);
      this.pinch = m;
      return;
    }
    if (!this.dragging) {
      if (Math.hypot(e.clientX - p.startX, e.clientY - p.startY) < TAP_MOVE_PX) return;
      this.dragging = true;
    }
    if (this.mode === 'rotate') this.cb.onRotate(dx, dy);
    else if (this.mode === 'pan') this.cb.onPan(dx, dy);
  };

  private release(e: PointerEvent, canTap: boolean): void {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    this.pointers.delete(e.pointerId);
    try {
      if (this.el.hasPointerCapture(e.pointerId)) this.el.releasePointerCapture(e.pointerId);
    } catch {
      /* 已经释放 */
    }
    if (this.pointers.size === 1) {
      // 双指抬起一指：剩下那指继续旋转，但这次手势不再算点击，也不跳变
      const rest = Array.from(this.pointers.values())[0];
      rest.startX = rest.x;
      rest.startY = rest.y;
      this.mode = 'rotate';
      this.dragging = true;
      return;
    }
    if (this.pointers.size === 0) {
      const quick = e.timeStamp - p.startT < TAP_MS;
      const still = Math.hypot(e.clientX - p.startX, e.clientY - p.startY) < TAP_MOVE_PX;
      if (canTap && !this.dragging && quick && still && this.mode !== 'pinch') this.cb.onTap(e.clientX, e.clientY, p.type);
      this.mode = 'none';
      this.dragging = false;
    }
  }

  private onUp = (e: PointerEvent): void => this.release(e, true);
  private onCancel = (e: PointerEvent): void => this.release(e, false);

  private onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    this.cb.onInteractStart();
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 100 : 1;
    const dy = Math.max(-200, Math.min(200, e.deltaY * unit));
    this.cb.onZoom(Math.exp(dy * 0.0012));
  };

  dispose(): void {
    for (const [t, type, fn, opts] of this.listeners) t.removeEventListener(type, fn, opts);
    this.listeners.length = 0;
    this.pointers.clear();
  }
}

function prevent(e: Event): void {
  e.preventDefault();
}
