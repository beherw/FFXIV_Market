import { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';

// Lazy load maps.json to avoid blocking module evaluation
let mapsData = null;
let mapsDataPromise = null;

async function loadMapsData() {
  if (mapsData) return mapsData;
  if (mapsDataPromise) return mapsDataPromise;
  
  mapsDataPromise = import('../../teamcraft_git/libs/data/src/lib/json/maps.json')
    .then(module => {
      mapsData = module.default || module;
      return mapsData;
    })
    .catch(error => {
      console.error('[MapModal] Failed to load maps.json:', error);
      mapsDataPromise = null;
      return {};
    });
  
  return mapsDataPromise;
}

export default function MapModal({ isOpen, onClose, zoneName, x, y, npcName, mapId }) {
  const [mapData, setMapData] = useState(null);
  const [markerPosition, setMarkerPosition] = useState(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [scale, setScale] = useState(1);
  const [showTooltip, setShowTooltip] = useState(false);
  const [transformOrigin, setTransformOrigin] = useState('center top');
  const mapContainerRef = useRef(null);
  const markerRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      // Prevent body scroll when modal is open
      const originalOverflow = document.body.style.overflow;
      const originalPosition = document.body.style.position;
      const originalTop = document.body.style.top;
      const scrollY = window.scrollY;
      
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      
      return () => {
        document.body.style.overflow = originalOverflow;
        document.body.style.position = originalPosition;
        document.body.style.top = originalTop;
        document.body.style.width = '';
        window.scrollTo(0, scrollY);
      };
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !mapId) {
      setMapData(null);
      setMarkerPosition(null);
      setImageLoaded(false);
      setScale(1);
      setShowTooltip(false);
      return;
    }

    // Load maps data if not already loaded
    let cancelled = false;
    loadMapsData().then(loadedMapsData => {
      if (cancelled) return;
      
      // Get map data from maps.json
      const map = loadedMapsData[String(mapId)] || loadedMapsData[mapId];
      if (!map) {
        console.warn(`[MapModal] Map data not found for mapId: ${mapId}`);
        setMapData(null);
        setMarkerPosition(null);
        return;
      }

      setMapData(map);
      setImageLoaded(false);
      setScale(1);

      // Calculate marker position on map
      // Formula from teamcraft: getPositionPercentOnMap
      // x = (position.x - offset) * 50 * scale / 20.48
      // where offset = 1, scale = size_factor / 100, 20.48 = 2048 / 100
      if (x !== undefined && y !== undefined && map.size_factor !== undefined) {
        const mapScale = map.size_factor / 100;
        const offset = 1;
        const mapX = ((x - offset) * 50 * mapScale) / 20.48;
        const mapY = ((y - offset) * 50 * mapScale) / 20.48;
        
        setMarkerPosition({
          x: mapX,
          y: mapY
        });
      } else {
        setMarkerPosition(null);
      }
    }).catch(error => {
      if (!cancelled) {
        console.error(`[MapModal] Error loading map data for mapId ${mapId}:`, error);
        setMapData(null);
        setMarkerPosition(null);
      }
    });
    
    return () => {
      cancelled = true;
    };
  }, [isOpen, mapId, x, y]);

  useEffect(() => {
    if (!isOpen) {
      setScale(1);
      setTransformOrigin('center top');
    }
  }, [isOpen]);

  useEffect(() => {
    if (scale === 1) {
      setTransformOrigin('center top');
    } else if (markerPosition) {
      setTransformOrigin(`${markerPosition.x}% ${markerPosition.y}%`);
    }
  }, [scale, markerPosition]);

  useEffect(() => {
    if (!isOpen || !mapContainerRef.current) return;

    const handleWheel = (e) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      
      if (markerPosition) {
        setTransformOrigin(`${markerPosition.x}% ${markerPosition.y}%`);
      } else {
        const container = mapContainerRef.current;
        const rect = container.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        const percentX = (mouseX / rect.width) * 100;
        const percentY = (mouseY / rect.height) * 100;
        
        setTransformOrigin(`${percentX}% ${percentY}%`);
      }
      
      const delta = e.deltaY > 0 ? 0.95 : 1.05;
      setScale(prev => Math.max(1, Math.min(3, prev * delta)));
    };

    const container = mapContainerRef.current;
    container.addEventListener('wheel', handleWheel, { passive: false, capture: true });

    return () => {
      container.removeEventListener('wheel', handleWheel, { capture: true });
    };
  }, [isOpen, imageLoaded, markerPosition]);

  if (!isOpen) {
    return null;
  }

  const modalContent = !mapData ? (
    <div 
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
        <div 
          className="bg-slate-800 rounded-lg border border-ffxiv-gold/50 p-6 max-w-2xl w-full mx-4 relative"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
            aria-label="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          
          <h3 className="text-xl font-bold text-ffxiv-gold mb-4">
            {npcName || '位置信息'}
          </h3>
          
          <div className="space-y-2 text-gray-300">
            {zoneName && (
              <div>
                <span className="text-gray-400">區域：</span>
                <span className="text-white">{zoneName}</span>
              </div>
            )}
            {(x !== undefined && y !== undefined) && (
              <div>
                <span className="text-gray-400">座標：</span>
                <span className="text-white">({x.toFixed(1)}, {y.toFixed(1)})</span>
              </div>
            )}
            {mapId && (
              <div>
                <span className="text-gray-400">地圖ID：</span>
                <span className="text-white">{mapId}</span>
              </div>
            )}
          </div>
          
          <div className="mt-6 text-sm text-yellow-400">
            <p>⚠️ 地圖數據未找到（地圖ID: {mapId}）</p>
          </div>
        </div>
      </div>
  ) : (
    <div 
      className="fixed inset-0 z-[10000] flex items-start justify-center bg-black/90 backdrop-blur-sm p-4 overflow-hidden"
      onClick={onClose}
      style={{ 
        background: 'radial-gradient(circle at center, rgba(0, 0, 0, 0.7) 0%, rgba(0, 0, 0, 0.95) 100%)',
        touchAction: 'none'
      }}
      onWheel={(e) => {
        // Prevent all background scroll
        // Only allow scroll in .map-modal-scroll content area
        // Zoom is handled by map container's onWheel
        const target = e.target;
        const isScrollableContent = target.closest('.map-modal-scroll');
        const isMapContainer = mapContainerRef.current?.contains(target);
        
        // If not in scrollable content or map container, prevent scroll
        if (!isScrollableContent && !isMapContainer) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
      onTouchMove={(e) => {
        // Prevent background touch scroll
        const target = e.target;
        const isScrollableContent = target.closest('.map-modal-scroll');
        if (!isScrollableContent) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
    >
      <div 
        className="rounded-lg border-4 border-amber-800/60 shadow-2xl max-w-[490px] w-full my-4 relative overflow-hidden"
        style={{ 
          zIndex: 10001,
          background: 'linear-gradient(135deg, #d4a574 0%, #c49460 50%, #b8844c 100%)',
          boxShadow: '0 0 30px rgba(139, 69, 19, 0.4), inset 0 0 20px rgba(0, 0, 0, 0.2)',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          minHeight: '60vh'
        }}
        onClick={(e) => e.stopPropagation()}
        onWheel={(e) => {
          // Only allow scroll in the content area (.map-modal-scroll)
          // Zoom is handled by map container
          const target = e.target;
          const isScrollableContent = target.closest('.map-modal-scroll');
          const isMapContainer = mapContainerRef.current?.contains(target);
          
          // If scrolling on modal container itself (not content area or map), prevent it
          if (!isScrollableContent && !isMapContainer) {
            e.preventDefault();
            e.stopPropagation();
          }
        }}
      >
        <div 
          className="map-modal-scroll relative overflow-hidden" 
          style={{
            background: 'linear-gradient(135deg, #d4a574 0%, #c49460 50%, #b8844c 100%)',
            scrollbarWidth: 'thin',
            scrollbarColor: 'rgba(139, 69, 19, 0.5) rgba(180, 132, 76, 0.5)',
            width: '100%',
            height: '100%',
            minHeight: '60vh',
            flex: 1
          }}
          onWheel={(e) => {
            const target = e.target;
            const isMapContainer = mapContainerRef.current?.contains(target);
            
            if (isMapContainer) {
              e.preventDefault();
              e.stopPropagation();
            }
          }}
        >
          <button
            onClick={onClose}
            className="absolute top-3 right-3 text-amber-900 hover:text-amber-950 transition-colors bg-amber-100/90 rounded border border-amber-800/60 p-1.5 hover:bg-amber-200/90 z-50"
            aria-label="Close"
            style={{ boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)' }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          
          <div className="absolute top-3 left-3 z-50" style={{
            background: 'rgba(212, 165, 116, 0.85)',
            backdropFilter: 'blur(4px)',
            padding: '8px 12px',
            borderRadius: '4px',
            border: '1px solid rgba(139, 69, 19, 0.4)',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2), inset 0 1px 2px rgba(255, 255, 255, 0.3)'
          }}>
            <h3 className="text-base font-bold mb-1 tracking-wide" style={{ 
              color: '#1a0f00',
              textShadow: '0 1px 2px rgba(255, 255, 255, 0.6)',
              fontFamily: 'serif'
            }}>
              {npcName || '位置信息'}
            </h3>
            
            <div className="space-y-0.5 text-xs">
              {zoneName && (
                <div className="flex items-center gap-1.5" style={{ color: '#2d1b0a' }}>
                  <span className="font-bold">■</span>
                  <span style={{ textShadow: '0 1px 1px rgba(255, 255, 255, 0.6)' }}>{zoneName}</span>
                </div>
              )}
              {(x !== undefined && y !== undefined) && (
                <div className="flex items-center gap-1.5" style={{ color: '#2d1b0a' }}>
                  <span className="font-bold">◆</span>
                  <span style={{ textShadow: '0 1px 1px rgba(255, 255, 255, 0.6)' }}>座標 ({x.toFixed(1)}, {y.toFixed(1)})</span>
                </div>
              )}
            </div>
          </div>
          
          <div 
            ref={mapContainerRef}
            className="absolute inset-0 bg-black overflow-hidden"
            style={{ 
              width: '100%',
              height: '100%',
              transform: `scale(${scale})`,
              transformOrigin: transformOrigin,
              transition: 'transform 0.1s ease-out'
            }}
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            {!imageLoaded && (
              <div className="absolute inset-0 flex items-center justify-center bg-black z-10">
                <div className="text-amber-900 text-sm font-semibold" style={{ textShadow: '0 1px 2px rgba(255, 255, 255, 0.5)' }}>
                  載入地圖中...
                </div>
              </div>
            )}
            <div className="absolute inset-0">
              <img 
                src={mapData.image} 
                alt={`${zoneName || '地圖'}`}
                className="w-full h-full object-cover block"
                style={{ display: 'block' }}
                onLoad={() => setImageLoaded(true)}
                onError={(e) => {
                  console.error(`[MapModal] Failed to load map image: ${mapData.image}`);
                  setImageLoaded(true);
                }}
              />
            
            {markerPosition && imageLoaded && (
              <div
                ref={markerRef}
                className="absolute cursor-pointer"
                style={{
                  left: `${markerPosition.x}%`,
                  top: `${markerPosition.y}%`,
                  transform: 'translate(-50%, -50%)',
                  zIndex: 20
                }}
                onMouseEnter={() => setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
                onWheel={(e) => {
                  e.stopPropagation();
                }}
              >
                <div className="relative">
                  <div 
                    className="absolute inset-0 rounded-full bg-white"
                    style={{
                      width: '8px',
                      height: '8px',
                      transform: 'translate(-50%, -50%)',
                      left: '50%',
                      top: '50%',
                      boxShadow: '0 0 4px rgba(255, 255, 255, 0.8), 0 0 8px rgba(255, 0, 0, 0.6)'
                    }}
                  />
                  <div 
                    className="absolute rounded-full bg-red-600"
                    style={{
                      width: '4px',
                      height: '4px',
                      transform: 'translate(-50%, -50%)',
                      left: '50%',
                      top: '50%',
                      boxShadow: '0 0 6px rgba(255, 0, 0, 0.9)'
                    }}
                  />
                  <div 
                    className="absolute bg-red-600"
                    style={{
                      width: '1px',
                      height: '12px',
                      transform: 'translate(-50%, -50%)',
                      left: '50%',
                      top: '50%',
                      opacity: 0.7
                    }}
                  />
                  <div 
                    className="absolute bg-red-600"
                    style={{
                      width: '12px',
                      height: '1px',
                      transform: 'translate(-50%, -50%)',
                      left: '50%',
                      top: '50%',
                      opacity: 0.7
                    }}
                  />
                </div>
                {showTooltip && (
                  <div 
                    className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs font-medium whitespace-nowrap border z-30 rounded pointer-events-none"
                    style={{ 
                      background: 'rgba(212, 165, 116, 0.95)',
                      backdropFilter: 'blur(4px)',
                      color: '#78350f',
                      border: '1px solid rgba(139, 69, 19, 0.6)',
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3), inset 0 1px 2px rgba(255, 255, 255, 0.3)',
                      textShadow: '0 1px 1px rgba(255, 255, 255, 0.5)'
                    }}
                  >
                    <div className="font-semibold">{npcName || '位置'}</div>
                    <div className="text-xs mt-0.5">({x?.toFixed(1)}, {y?.toFixed(1)})</div>
                  </div>
                )}
              </div>
            )}
            </div>
          </div>
        </div>
        
        <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-ffxiv-gold/60"></div>
        <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-ffxiv-gold/60"></div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
