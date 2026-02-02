// ACHIEVEMENTS renderer (Type 22 - 成就獎勵)
import React from 'react';
import { commonClasses } from './sharedUtils.jsx';

export function renderAchievements({
  source,
  index,
  getAchievementInfo,
  handleAchievementMouseEnter,
  handleAchievementMouseMove,
  handleAchievementMouseLeave
}) {
  const { data } = source;
  
  if (!data || !Array.isArray(data) || data.length === 0) {
    return null;
  }

  const validAchievements = data.filter(achievementId => {
    const achievementInfo = getAchievementInfo(achievementId);
    return achievementInfo && achievementInfo.name;
  });
  
  if (validAchievements.length === 0) {
    return null;
  }
  
  return (
    <div key={`achievement-${index}`} className={commonClasses.card}>
      <div className={commonClasses.header}>
        <img src="https://xivapi.com/i/060000/060453.png" alt="Achievement" className={commonClasses.icon} />
        <span className={commonClasses.title}>成就獎勵</span>
      </div>
      <div className="flex flex-wrap gap-2 mt-2">
        {validAchievements.map((achievementId, achievementIndex) => {
          const achievementInfo = getAchievementInfo(achievementId);
          
          if (!achievementInfo) return null;
          
          return (
            <div
              key={achievementIndex}
              className="w-[280px] flex-grow-0 bg-slate-900/50 rounded p-2 min-h-[70px] flex flex-col justify-center"
              onMouseEnter={(e) => handleAchievementMouseEnter(e, achievementId)}
              onMouseMove={handleAchievementMouseMove}
              onMouseLeave={handleAchievementMouseLeave}
            >
              <div className="flex items-center gap-2">
                {achievementInfo.icon && (
                  <img src={achievementInfo.icon} alt={achievementInfo.name} className="w-7 h-7 object-contain" />
                )}
                <div className="flex-1">
                  <div className="text-sm font-medium text-yellow-400 cursor-help underline decoration-dotted decoration-yellow-400/50 hover:decoration-yellow-400 transition-colors">
                    {achievementInfo.name}
                  </div>
                  {achievementInfo.description && (
                    <div className="text-xs text-gray-400 mt-0.5 line-clamp-2">
                      {achievementInfo.description}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        }).filter(Boolean)}
      </div>
    </div>
  );
}
