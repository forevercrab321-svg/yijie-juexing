/** 地理位置工具：真实定位获取与距离计算。 */

/** 提交任务证明时允许的最大偏差（米）。超出即视为不在现场。 */
export const PROOF_RADIUS_METERS = 200;

/** Haversine 距离，单位米。 */
export function distanceMeters(
  [lat1, lon1]: [number, number],
  [lat2, lon2]: [number, number],
): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export type GeoStatus = 'idle' | 'watching' | 'denied' | 'unavailable';

export interface GeoFix {
  coords: [number, number];
  /** 定位精度（米）。精度太差时不应据此判定用户是否到达现场。 */
  accuracy: number;
  timestamp: number;
}

/**
 * 持续跟踪用户位置。返回取消函数。
 *
 * 注意这里用的是真实的 navigator.geolocation，不再是写死的坐标——
 * 任务完成校验依赖它，写死坐标等于校验形同虚设。
 */
export function watchLocation(
  onFix: (fix: GeoFix) => void,
  onError: (status: Exclude<GeoStatus, 'idle' | 'watching'>) => void,
): () => void {
  if (!('geolocation' in navigator)) {
    onError('unavailable');
    return () => {};
  }

  const id = navigator.geolocation.watchPosition(
    (pos) => {
      onFix({
        coords: [pos.coords.latitude, pos.coords.longitude],
        accuracy: pos.coords.accuracy,
        timestamp: pos.timestamp,
      });
    },
    (err) => {
      onError(err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable');
    },
    { enableHighAccuracy: true, maximumAge: 15_000, timeout: 20_000 },
  );

  return () => navigator.geolocation.clearWatch(id);
}
