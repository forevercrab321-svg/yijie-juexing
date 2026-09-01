
import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline, CircleMarker } from 'react-leaflet';
import { DivIcon, LatLngBounds } from 'leaflet';
import { Quest } from '../types';

interface MapBoardProps {
  quests: Quest[];
  activeQuestId: string | null;
  focusedQuestId: string | null;
  onFocus: (quest: Quest) => void;
  onAccept: (quest: Quest) => void;
  userLocation: [number, number] | null;
}

const createCustomIcon = (type: string, isTarget: boolean, isFocused: boolean) => {
  const gold = '#D4AF37'; 
  const scale = isFocused ? 'scale(1.4)' : 'scale(1.0)';
  
  const html = `
    <div style="position: relative; width: 50px; height: 70px; display: flex; align-items: center; justify-content: center; transform: ${scale}; transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);">
      <div style="position: absolute; bottom: 10px; width: 30px; height: 12px; border: 1px solid ${gold}; border-radius: 50%; background: radial-gradient(circle, ${gold}44 0%, transparent 70%);"></div>
      <div style="position: absolute; bottom: 15px; width: 6px; height: 40px; background: linear-gradient(to top, ${gold}dd, transparent); border-radius: 3px; box-shadow: 0 0 15px ${gold}88;"></div>
      <div style="position: absolute; top: 0; width: 18px; height: 18px; background: ${gold}; transform: rotate(45deg); border: 2px solid #000; box-shadow: 0 0 10px ${gold}; display: flex; align-items: center; justify-content: center; animation: marker-float 2s ease-in-out infinite;">
        <div style="transform: rotate(-45deg); font-size: 10px;">
           ${type === '物资运输' ? '📦' : type === '魔物讨伐' ? '⚔️' : type === '迷宫建设' ? '🏗️' : '📜'}
        </div>
      </div>
    </div>
  `;
  
  return new DivIcon({
    html: html,
    className: 'custom-gold-marker',
    iconSize: [50, 70],
    iconAnchor: [25, 60] 
  });
};

const MapController: React.FC<{ 
    destination: [number, number] | null;
    activeQuestLocation: [number, number] | null;
    userLocation: [number, number] | null;
}> = ({ destination, activeQuestLocation, userLocation }) => {
  const map = useMap();

  /*
   * 容器尺寸变化后必须让 Leaflet 重算，否则它只会按初始化时的尺寸请求瓦片，
   * 剩下的区域一片空白。移动端尤其容易触发——旋转屏幕、地址栏收起/展开
   * 都会改变视口高度。
   */
  useEffect(() => {
    const container = map.getContainer();
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(container);
    // 挂载后补一次：首帧布局未稳定时拿到的尺寸可能是错的
    const raf = requestAnimationFrame(() => map.invalidateSize());
    return () => {
      observer.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [map]);

  useEffect(() => {
    if (activeQuestLocation && userLocation) {
        const bounds = new LatLngBounds(userLocation, activeQuestLocation);
        map.flyToBounds(bounds, { padding: [120, 120], duration: 1.5 });
    } else if (destination) {
      map.flyTo(destination, 16, { duration: 1.2 });
    }
  }, [destination, activeQuestLocation, userLocation, map]);
  return null;
};

const MapBoard: React.FC<MapBoardProps> = ({ quests, activeQuestId, focusedQuestId, onFocus, onAccept, userLocation }) => {
  const centerPosition: [number, number] = [40.7580, -73.9855]; 
  const activeQuest = quests.find(q => q.id === activeQuestId);
  const targetQuest = quests.find(q => q.id === (focusedQuestId || activeQuestId));

  return (
    <div className="absolute inset-0 w-full h-full z-0 overflow-hidden" style={{ background: '#d9cbb0' }}>
      <style>{`
        /*
          把 CartoDB 的灰白街道图调成羊皮纸地形图。
          sepia 是关键——它把整张图收成单一暖色系，是"手绘地图"观感的来源；
          单纯降饱和只会得到灰扑扑的照片，不会有纸的感觉。
        */
        /*
          contrast 要给足。sepia 会显著压低对比，如果不补回来，
          街道线条会糊成一片米黄——好看但没法用，地图首先得能读。
        */
        .aethel-map .leaflet-tile-pane {
           filter: sepia(0.82) saturate(0.65) hue-rotate(-10deg) brightness(0.82) contrast(1.45);
        }

        /*
          街道标签压到几乎只剩痕迹。
          地图是背景不是主角——密集的街道名一旦读得清，画面立刻回到导航软件。
          留一点点是为了需要时还能辨认方位，不是为了阅读。
        */
        .map-labels-layer {
           filter: sepia(1) saturate(0.45) brightness(0.7) contrast(0.9);
           pointer-events: none;
           z-index: 400;
        }

        /* 海面与空白区。默认的冷灰会破坏暖色统一 */
        .aethel-map.leaflet-container { background: #d9cbb0; }

        /* 纸纹。压掉瓦片的数字平整感 */
        .map-paper-grain {
            position: absolute;
            inset: 0;
            pointer-events: none;
            z-index: 500;
            opacity: 0.09;
            mix-blend-mode: multiply;
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='g'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='5'/%3E%3C/filter%3E%3Crect width='200' height='200' filter='url(%23g)'/%3E%3C/svg%3E");
        }

        /*
          两层叠加：
          先铺一层暖褐把整幅图压进同一个色温（乘法混合，保留纹理），
          再用暗角收边。只做暗角的话中心会显得发白、缺层次。
        */
        .map-warm-wash {
            position: absolute;
            inset: 0;
            pointer-events: none;
            z-index: 499;
            mix-blend-mode: multiply;
            background: linear-gradient(170deg, #e0cfa8 0%, #d2bd94 55%, #c2aa82 100%);
            opacity: 0.22;
        }

        .map-vignette {
            position: absolute;
            inset: 0;
            pointer-events: none;
            z-index: 501;
            background:
              radial-gradient(ellipse at 50% 45%, transparent 30%, rgba(58, 44, 28, 0.34) 70%, rgba(30, 22, 14, 0.72) 100%);
        }

        @keyframes marker-float {
          0%, 100% { transform: translateY(0px) rotate(45deg); }
          50% { transform: translateY(-8px) rotate(45deg); }
        }

        .leaflet-popup-content-wrapper { background: transparent !important; box-shadow: none !important; padding: 0 !important; }
        .leaflet-popup-tip { display: none; }
      `}</style>

      <MapContainer center={centerPosition} zoom={15} className="w-full h-full aethel-map" zoomControl={false}>
        {/* 使用更清晰的底圖服務 */}
        <TileLayer url="https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png" />
        
        {/*
          街道标签层。
          opacity 必须走 TileLayer 的 prop——Leaflet 会给图层写内联 opacity，
          CSS class 里的 opacity 会被内联样式压过去，改了也没反应。
        */}
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png"
          className="map-labels-layer"
          opacity={0.42}
        />

        <MapController 
            destination={targetQuest ? targetQuest.location : null} 
            activeQuestLocation={activeQuest ? activeQuest.location : null}
            userLocation={userLocation}
        />
        
        {activeQuest && userLocation && (
            <Polyline 
                positions={[userLocation, activeQuest.location]}
                pathOptions={{ color: '#D4AF37', weight: 3, opacity: 0.6, dashArray: '12, 12' }}
            />
        )}

        {userLocation && (
            <CircleMarker 
                center={userLocation} 
                radius={10} 
                pathOptions={{ color: '#fff', fillColor: '#D4AF37', fillOpacity: 1, weight: 4 }} 
            />
        )}
        
        {quests.map((quest) => (
          <Marker 
            key={quest.id} 
            position={quest.location}
            icon={createCustomIcon(quest.type, quest.id === activeQuestId, quest.id === focusedQuestId)}
            eventHandlers={{ click: () => onFocus(quest) }}
          >
            <Popup closeButton={false} maxWidth={280}>
              <div className="bg-[#020617]/95 border border-[#D4AF37]/60 rounded-2xl p-5 shadow-[0_15px_40px_rgba(0,0,0,0.9)] backdrop-blur-md flex flex-col gap-4">
                <div>
                  <div className="text-[10px] text-[#D4AF37] font-bold uppercase tracking-[0.3em] mb-1">{quest.type}</div>
                  <h3 className="text-base font-bold text-white font-['Cinzel'] tracking-wider leading-tight">{quest.title}</h3>
                </div>
                <div className="text-[11px] text-slate-300 leading-relaxed font-serif italic border-l border-[#D4AF37]/30 pl-3">"{quest.description}"</div>
                <div className="flex items-center justify-between border-t border-white/10 pt-3">
                   <div className="text-[10px] text-emerald-400 font-bold font-mono tracking-widest">TRUST +{quest.trustPoints}P</div>
                   {quest.id !== activeQuestId && (
                        <button 
                            onClick={(e) => { e.stopPropagation(); onAccept(quest); }}
                            className="bg-[#D4AF37] text-black text-[10px] font-black px-4 py-2 rounded-lg shadow-lg active:scale-95 transition-all uppercase tracking-widest hover:bg-white"
                        >
                            承接契約
                        </button>
                    )}
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* 覆盖层放在地图之后，顺序即叠加顺序：暖色统一 → 纸纹去数字感 → 暗角收边 */}
      <div className="map-warm-wash" />
      <div className="map-paper-grain" />
      <div className="map-vignette" />
    </div>
  );
};

export default MapBoard;
