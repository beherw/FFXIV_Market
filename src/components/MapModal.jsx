// Map Modal component for displaying NPC/quest/FATE/gathering locations on FFXIV maps
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import mapsData from '../../teamcraft_git/libs/data/src/lib/json/maps.json';

export default function MapModal({ isOpen, onClose, zoneName, x, y, npcName, mapId }) {
  const [mapData, setMapData] = useState(null);
  const [markerPosition, setMarkerPosition] = useState(null);
  const [imageLoaded, setImageLoaded] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || !mapId) {
      setMapData(null);
      setMarkerPosition(null);
      setImageLoaded(false);
      return;
    }

    // Get map data from maps.json
    const map = mapsData[String(mapId)] || mapsData[mapId];
    if (!map) {
      console.warn(`[MapModal] Map data not found for mapId: ${mapId}`);
      setMapData(null);
      setMarkerPosition(null);
      return;
    }

    setMapData(map);
    setImageLoaded(false);

    // Calculate marker position on map
    // Formula from teamcraft: getPositionPercentOnMap
    // x = (position.x - offset) * 50 * scale / 20.48
    // where offset = 1, scale = size_factor / 100, 20.48 = 2048 / 100
    if (x !== undefined && y !== undefined && map.size_factor !== undefined) {
      const scale = map.size_factor / 100;
      const offset = 1;
      const mapX = ((x - offset) * 50 * scale) / 20.48;
      const mapY = ((y - offset) * 50 * scale) / 20.48;
      
      setMarkerPosition({
        x: mapX,
        y: mapY
      });
    } else {
      setMarkerPosition(null);
    }
  }, [isOpen, mapId, x, y]);

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
      className="fixed inset-0 z-[10000] flex items-start justify-center bg-black/90 backdrop-blur-sm p-4 overflow-y-auto"
      onClick={onClose}
      style={{ background: 'radial-gradient(circle at center, rgba(0, 0, 0, 0.7) 0%, rgba(0, 0, 0, 0.95) 100%)' }}
    >
      <div 
        className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-lg border-4 border-ffxiv-gold/60 shadow-2xl max-w-[490px] w-full my-4 relative"
        style={{ 
          zIndex: 10001,
          boxShadow: '0 0 30px rgba(255, 215, 0, 0.3), inset 0 0 20px rgba(0, 0, 0, 0.5)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - FF Style */}
        <div className="p-4 pb-3 border-b-4 border-ffxiv-gold/40 bg-gradient-to-r from-slate-800 via-slate-700 to-slate-800 sticky top-0 z-10 relative">
          {/* Decorative corner elements */}
          <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-ffxiv-gold/60"></div>
          <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-ffxiv-gold/60"></div>
          
          <button
            onClick={onClose}
            className="absolute top-3 right-3 text-ffxiv-gold hover:text-yellow-300 transition-colors bg-slate-900/80 rounded border border-ffxiv-gold/50 p-1.5 hover:bg-slate-800"
            aria-label="Close"
            style={{ boxShadow: '0 0 10px rgba(255, 215, 0, 0.3)' }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          
          <h3 className="text-lg font-bold text-ffxiv-gold mb-2 pr-12 tracking-wide" style={{ 
            textShadow: '2px 2px 4px rgba(0, 0, 0, 0.8), 0 0 10px rgba(255, 215, 0, 0.5)',
            fontFamily: 'serif'
          }}>
            {npcName || '位置信息'}
          </h3>
          
          <div className="space-y-1 text-yellow-100 text-xs font-semibold">
            {zoneName && (
              <div className="flex items-center gap-2">
                <span className="text-ffxiv-gold font-bold">■</span>
                <span className="text-gray-200">{zoneName}</span>
              </div>
            )}
            {(x !== undefined && y !== undefined) && (
              <div className="flex items-center gap-2">
                <span className="text-ffxiv-gold font-bold">◆</span>
                <span className="text-gray-200">座標 ({x.toFixed(1)}, {y.toFixed(1)})</span>
              </div>
            )}
          </div>
        </div>
        
        {/* Map Content - FF Style */}
        <div className="p-4 bg-gradient-to-b from-slate-900 to-slate-950">
          {/* Map Container - scaled down 30% */}
          <div className="relative bg-black rounded border-2 border-ffxiv-gold/40 mx-auto" style={{ width: '70%' }}>
            {!imageLoaded && (
              <div className="absolute inset-0 flex items-center justify-center bg-black z-10">
                <div className="text-ffxiv-gold text-sm font-semibold" style={{ textShadow: '0 0 10px rgba(255, 215, 0, 0.5)' }}>
                  載入地圖中...
                </div>
              </div>
            )}
            <div className="relative">
              <img 
                src={mapData.image} 
                alt={`${zoneName || '地圖'}`}
                className="w-full h-auto block"
                style={{ display: 'block' }}
                onLoad={() => setImageLoaded(true)}
                onError={(e) => {
                  console.error(`[MapModal] Failed to load map image: ${mapData.image}`);
                  setImageLoaded(true);
                }}
              />
            
            {/* Marker - FF Style */}
            {markerPosition && imageLoaded && (
              <div
                className="absolute"
                style={{
                  left: `${markerPosition.x}%`,
                  top: `${markerPosition.y}%`,
                  transform: 'translate(-50%, -50%)',
                  zIndex: 20
                }}
              >
                <div className="relative">
                  {/* Marker pin - FF style star/crystal */}
                  <svg 
                    className="w-10 h-10 text-ffxiv-gold drop-shadow-lg"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                    style={{ filter: 'drop-shadow(0 0 8px rgba(255, 215, 0, 0.8))' }}
                  >
                    <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
                  </svg>
                  {/* Pulse animation - FF style glow */}
                  <div 
                    className="absolute inset-0 rounded-full bg-ffxiv-gold animate-ping opacity-50"
                    style={{ 
                      animation: 'ping 2s cubic-bezier(0, 0, 0.2, 1) infinite',
                      filter: 'blur(4px)'
                    }}
                  />
                </div>
                {/* Tooltip - FF Style */}
                <div 
                  className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-3 px-3 py-2 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-yellow-100 text-xs font-semibold whitespace-nowrap border-2 border-ffxiv-gold/60 z-30 rounded"
                  style={{ 
                    boxShadow: '0 0 15px rgba(255, 215, 0, 0.4), inset 0 0 10px rgba(0, 0, 0, 0.5)',
                    textShadow: '1px 1px 2px rgba(0, 0, 0, 0.8)'
                  }}
                >
                  <div className="text-ffxiv-gold font-bold">{npcName || '位置'}</div>
                  <div className="text-yellow-200 text-xs mt-0.5">({x?.toFixed(1)}, {y?.toFixed(1)})</div>
                </div>
              </div>
            )}
            </div>
          </div>
          
          {/* Map Info - FF Style */}
          <div className="mt-4 text-xs text-yellow-200/70 text-center border-t border-ffxiv-gold/30 pt-3">
            <p className="font-semibold">
              <span className="text-ffxiv-gold">地圖來源：</span>
              <a 
                href={mapData.image} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-yellow-300 hover:text-ffxiv-gold transition-colors underline"
                style={{ textShadow: '0 0 5px rgba(255, 215, 0, 0.3)' }}
              >
                XIVAPI
              </a>
            </p>
          </div>
        </div>
        
        {/* Decorative bottom border */}
        <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-ffxiv-gold/60"></div>
        <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-ffxiv-gold/60"></div>
      </div>
    </div>
  );

  // Render modal outside of parent container using Portal
  return createPortal(modalContent, document.body);
}
