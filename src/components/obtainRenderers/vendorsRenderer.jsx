// VENDORS renderer (Type 3 - NPC商店)
import React from 'react';
import ItemImage from '../ItemImage';
import { commonClasses } from './sharedUtils.jsx';

export function renderVendors({
  source,
  index,
  loadedDataRef,
  getNpcName,
  getNpcTitle,
  getPlaceNameCN,
  getVendorShopName,
  getAchievementInfo,
  handleAchievementMouseEnter,
  handleAchievementMouseMove,
  handleAchievementMouseLeave,
  achievementIds,
  setMapModal,
  formatPrice
}) {
  const { data } = source;
  const currentLoadedData = loadedDataRef.current;

  // Group vendors by NPC ID
  const vendorsByNpc = {};
  data.forEach((vendor) => {
    const npcId = vendor.npcId;
    if (!vendorsByNpc[npcId]) {
      vendorsByNpc[npcId] = [];
    }
    vendorsByNpc[npcId].push(vendor);
  });

  const npcGroups = Object.keys(vendorsByNpc).map((npcId) => {
    return { npcId, vendors: vendorsByNpc[npcId] };
  });

  // Separate NPCs into those with location info and those without
  const npcGroupsWithLocation = [];
  const npcGroupsWithoutLocation = [];

  npcGroups.forEach((npcGroup) => {
    const npcVendors = npcGroup.vendors;
    const firstVendor = npcVendors[0];
    const npcName = getNpcName(firstVendor.npcId);
    
    // Try to get position from vendor data first, then fallback to npcs.json
    let zoneId = firstVendor.zoneId;
    let coords = firstVendor.coords;
    let mapId = firstVendor.mapId;
    
    // If vendor doesn't have position data, try to get it from npcs.json (lazy loaded)
    if ((!zoneId || !coords || coords.x === undefined || coords.y === undefined) && firstVendor.npcId && currentLoadedData.npcs) {
      const npcData = currentLoadedData.npcs[firstVendor.npcId] || currentLoadedData.npcs[String(firstVendor.npcId)];
      if (npcData?.position) {
        zoneId = zoneId || npcData.position.zoneid;
        mapId = mapId || npcData.position.map;
        if (!coords || coords.x === undefined || coords.y === undefined) {
          coords = {
            x: npcData.position.x,
            y: npcData.position.y
          };
        }
      }
    }
    
    // Check if this is a housing NPC (journeyman salvager or other housing NPCs)
    const isHousingNPC = !zoneId && !coords && (
      npcName?.includes('古董商') || 
      npcName?.includes('journeyman salvager') ||
      firstVendor.npcId >= 1025000 && firstVendor.npcId < 1026000
    );
    
    // For housing NPCs, set default zoneId and coords
    if (isHousingNPC) {
      zoneId = 1160; // 個人房屋
      coords = { x: 0, y: 0 };
      mapId = null;
    }
    
    // For other NPCs without coords but with zoneId, set default 0,0
    if (zoneId && (!coords || coords.x === undefined || coords.y === undefined)) {
      coords = { x: 0, y: 0 };
    }
    
    const zoneName = zoneId ? getPlaceNameCN(zoneId) : '';
    const hasLocationInfo = zoneName && coords && coords.x !== undefined && coords.y !== undefined;
    const hasValidCoords = hasLocationInfo && (coords.x !== 0 || coords.y !== 0) && mapId;

    // Categorize NPC group
    if (hasValidCoords) {
      npcGroupsWithLocation.push({ ...npcGroup, zoneId, coords, mapId, zoneName, npcName });
    } else {
      npcGroupsWithoutLocation.push({ ...npcGroup, npcName });
    }
  });

  return (
    <div key={`vendor-${index}`} className={commonClasses.card}>
      <div className={commonClasses.header}>
        <img src="https://xivapi.com/i/065000/065002.png" alt="Gil" className={commonClasses.icon} />
        <span className={commonClasses.title}>NPC商店</span>
      </div>
      <div className="flex flex-col gap-3 mt-2">
        {/* NPCs with location info */}
        {npcGroupsWithLocation.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {npcGroupsWithLocation.map((npcGroup, npcGroupIndex) => {
              const npcVendors = npcGroup.vendors;
              const firstVendor = npcVendors[0];
              const { zoneName, coords, mapId, npcName } = npcGroup;
              
              // Get all shop names for this NPC
              const shopNames = npcVendors.map(v => getVendorShopName(v.shopName)).filter(Boolean);
              const uniqueShopNames = [...new Set(shopNames)];
              
              // Check if any vendor requires achievement
              const requiresAchievement = achievementIds.length > 0 || 
                npcVendors.some(vendor => {
                  const shopName = getVendorShopName(vendor.shopName);
                  return vendor.shopName && (
                    vendor.shopName.en?.toLowerCase().includes('achievement') ||
                    vendor.shopName.en?.toLowerCase().includes('reward') ||
                    shopName?.includes('成就')
                  );
                });
              
              // Get prices - show range if multiple vendors have different prices
              const prices = npcVendors.map(v => v.price).filter(Boolean);
              const minPrice = prices.length > 0 ? Math.min(...prices) : null;
              const maxPrice = prices.length > 0 ? Math.max(...prices) : null;
              const hasPriceRange = minPrice !== null && maxPrice !== null && minPrice !== maxPrice;
              
              // Check if location is valid for map display
              const hasValidMapLocation = mapId && (coords.x !== 0 || coords.y !== 0);
              
              return (
                <div key={npcGroupIndex} className="w-[280px] flex-grow-0 bg-slate-900/50 rounded p-2 min-h-[70px] flex flex-col">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-0.5">
                      <img src="https://xivapi.com/c/ENpcResident.png" alt="NPC" className="w-5 h-5 flex-shrink-0 grayscale opacity-70" />
                      <span className="text-sm font-medium text-white">{npcName}</span>
                      {(() => {
                        const npcTitle = getNpcTitle(firstVendor.npcId);
                        return npcTitle ? (
                          <span className="text-xs text-gray-400">&lt;{npcTitle}&gt;</span>
                        ) : null;
                      })()}
                    </div>
                    {minPrice && (
                      <span className="text-yellow-400 text-sm">
                        {hasPriceRange ? `${formatPrice(minPrice)} - ${formatPrice(maxPrice)}` : formatPrice(minPrice)} Gil
                      </span>
                    )}
                  </div>
                  {uniqueShopNames.length > 0 && (
                    <div className="text-xs text-gray-400 mt-1">
                      {uniqueShopNames.join(', ')}
                    </div>
                  )}
                  {requiresAchievement && achievementIds.length > 0 && (() => {
                    const achievementInfo = getAchievementInfo(achievementIds[0]);
                    return achievementInfo ? (
                      <div 
                        className="text-xs mt-1 flex items-start gap-1 relative"
                        onMouseEnter={(e) => handleAchievementMouseEnter(e, achievementIds[0])}
                        onMouseMove={handleAchievementMouseMove}
                        onMouseLeave={handleAchievementMouseLeave}
                      >
                        <span className="text-pink-400/90">需要完成成就：</span>
                        <span className="font-medium text-yellow-400/90 cursor-help underline decoration-dotted decoration-yellow-400/50 hover:decoration-yellow-400 transition-colors">
                          {achievementInfo.name}
                        </span>
                      </div>
                    ) : null;
                  })()}
                  {hasValidMapLocation ? (
                    <button
                      onClick={() => setMapModal({
                        isOpen: true,
                        zoneName,
                        x: coords.x,
                        y: coords.y,
                        npcName,
                        mapId: mapId,
                      })}
                      className="flex items-center gap-1.5 mt-1 pt-1 border-t border-slate-700/50 text-xs text-blue-400 hover:bg-slate-800/50 hover:text-blue-300 rounded px-1 py-0.5 transition-all w-full text-left"
                    >
                      <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                      </svg>
                      <span>
                        {zoneName}
                        <span className="ml-2">
                          X: {coords.x.toFixed(1)} - Y: {coords.y.toFixed(1)}
                        </span>
                      </span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-1.5 mt-1 pt-1 border-t border-slate-700/50 text-xs text-blue-400">
                      <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                      </svg>
                      <span>
                        {zoneName}
                        <span className="ml-2">
                          X: {coords.x.toFixed(1)} - Y: {coords.y.toFixed(1)}
                        </span>
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* NPCs without location info */}
        {npcGroupsWithoutLocation.length > 0 && (
          <div className="bg-slate-900/30 rounded p-2 border border-slate-700/50">
            <div className="text-xs mb-1.5 flex items-center gap-2">
              <span className="text-gray-400">特殊 NPC 商人</span>
              <span className="text-gray-600">({npcGroupsWithoutLocation.length} 位)</span>
              <span className="text-gray-500 text-xs ml-auto">位於個人房屋或特殊區域，暫無地圖位置資訊</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {npcGroupsWithoutLocation.map((npcGroup, npcGroupIndex) => {
                const { npcName, vendors: npcVendors } = npcGroup;
                const firstVendor = npcVendors[0];
                return (
                  <div
                    key={npcGroupIndex}
                    className="flex items-center gap-1 text-xs px-2 py-1 bg-slate-800/50 rounded border border-slate-700/30 w-full"
                  >
                    <img src="https://xivapi.com/c/ENpcResident.png" alt="NPC" className="w-3 h-3 flex-shrink-0 grayscale opacity-60" />
                    <span className="text-gray-300">{npcName}</span>
                    {(() => {
                      const npcTitle = getNpcTitle(firstVendor.npcId);
                      return npcTitle ? (
                        <span className="text-xs text-gray-500">&lt;{npcTitle}&gt;</span>
                      ) : null;
                    })()}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
