// Cute fluffy cloud loader animation
import { useEffect, useState, useRef } from 'react';

export default function RunningLoader({ message = '正在搜尋中...' }) {
  const [position, setPosition] = useState(0);
  const [frame, setFrame] = useState(0);
  const [isResetting, setIsResetting] = useState(false);
  const isResettingRef = useRef(false);

  useEffect(() => {
    const interval = setInterval(() => {
      // 如果正在重置，跳過這次更新
      if (isResettingRef.current) {
        setFrame(prev => prev + 1);
        return;
      }

      setPosition(prev => {
        const newPos = prev + 0.6;
        if (newPos >= 100) {
          // 當到達右邊時，標記為重置狀態
          isResettingRef.current = true;
          setIsResetting(true);
          
          // 使用 requestAnimationFrame 確保重置順序正確
          // 第一個 frame: 重置位置（此時 isResetting = true，所以沒有 transition）
          requestAnimationFrame(() => {
            setPosition(0);
            // 第二個 frame: 恢復 transition 並清除重置標記
            requestAnimationFrame(() => {
              setIsResetting(false);
              isResettingRef.current = false;
            });
          });
          return prev; // 保持當前位置，等待 requestAnimationFrame 重置
        }
        return newPos;
      });
      setFrame(prev => prev + 1);
    }, 20); // Smooth animation

    return () => clearInterval(interval);
  }, []);

  // Calculate animation frame for cloud movement
  const bounceOffset = Math.abs(Math.sin(frame * 0.1)) * 6;
  const cloudWobble = Math.sin(frame * 0.15) * 3;

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] py-12 px-4">
      <div className="relative w-full max-w-lg h-48 mb-8 overflow-hidden">
        {/* Ground line with gradient */}
        <div className="absolute bottom-0 left-0 right-0 h-3">
          <div className="h-full bg-gradient-to-r from-transparent via-purple-400/40 to-transparent"></div>
        </div>
        
        {/* Cute fluffy cloud character */}
        <div 
          className={`absolute bottom-8 ${isResetting ? '' : 'transition-all duration-100 ease-linear'}`}
          style={{ 
            left: `${position}%`,
            transform: `translateX(-50%) translateY(-${bounceOffset}px)`,
          }}
        >
          {/* Main cloud body */}
          <div className="relative" style={{ transform: `rotate(${cloudWobble}deg)` }}>
            {/* Large center cloud */}
            <div className="w-20 h-16 bg-gradient-to-br from-purple-200/80 via-purple-300/70 to-purple-400/60 rounded-full shadow-lg relative z-10 blur-sm">
              <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent rounded-full"></div>
            </div>
            
            {/* Left cloud puff */}
            <div className="absolute -left-4 top-2 w-14 h-12 bg-gradient-to-br from-purple-200/80 via-purple-300/70 to-purple-400/60 rounded-full shadow-md blur-sm">
              <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent rounded-full"></div>
            </div>
            
            {/* Right cloud puff */}
            <div className="absolute -right-4 top-2 w-14 h-12 bg-gradient-to-br from-purple-200/80 via-purple-300/70 to-purple-400/60 rounded-full shadow-md blur-sm">
              <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent rounded-full"></div>
            </div>
            
            {/* Bottom cloud puff */}
            <div className="absolute left-1/2 -bottom-2 transform -translate-x-1/2 w-16 h-10 bg-gradient-to-br from-purple-200/80 via-purple-300/70 to-purple-400/60 rounded-full shadow-md blur-sm">
              <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent rounded-full"></div>
            </div>
            
            {/* Cute face on cloud */}
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-20">
              {/* Eyes */}
              <div className="flex gap-3 mb-1 justify-center">
                <div className="w-2.5 h-2.5 bg-purple-600 rounded-full animate-blink"></div>
                <div className="w-2.5 h-2.5 bg-purple-600 rounded-full animate-blink" style={{ animationDelay: '0.1s' }}></div>
              </div>
              {/* Smile */}
              <div className="w-7 h-3 border-b-2 border-purple-600 rounded-b-full mx-auto"></div>
            </div>
            
            {/* Sparkle stars around cloud */}
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="absolute"
                style={{
                  top: `${20 + Math.sin((frame + i * 15) * 0.2) * 15}%`,
                  left: `${-30 + i * 15}%`,
                  opacity: 0.6 + Math.sin((frame + i * 10) * 0.3) * 0.4,
                  transform: `rotate(${(frame + i * 5) * 2}deg) scale(${0.8 + Math.sin((frame + i * 8) * 0.2) * 0.2})`,
                }}
              >
                <div className="w-2 h-2 text-ffxiv-gold">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full">
                    <path d="M12 2l2.4 7.2h7.6l-6 4.8 2.4 7.2-6-4.8-6 4.8 2.4-7.2-6-4.8h7.6z"/>
                  </svg>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Floating particles in background */}
        <div className="absolute inset-0 opacity-30">
          {[...Array(12)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1.5 h-1.5 bg-purple-300 rounded-full"
              style={{
                left: `${(position * 0.3 + i * 8.3) % 100}%`,
                top: `${30 + Math.sin((frame + i * 3) * 0.1) * 20}%`,
                opacity: 0.3 + Math.sin((frame + i * 2) * 0.2) * 0.4,
                transform: `scale(${0.5 + Math.sin((frame + i * 4) * 0.15) * 0.5})`,
              }}
            ></div>
          ))}
        </div>
        
        {/* Gentle speed lines */}
        <div className="absolute bottom-12 left-0 right-0 h-1 opacity-15">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="absolute bottom-0 h-full bg-gradient-to-r from-transparent via-purple-300/50 to-transparent"
              style={{
                left: `${(position * 0.5 + i * 25) % 100}%`,
                width: '15%',
                opacity: 0.2 - i * 0.05,
              }}
            ></div>
          ))}
        </div>
      </div>
      
      {/* Loading text with animation */}
      <div className="text-center">
        <p className="text-lg sm:text-xl font-semibold text-purple-300 mb-3">
          {message}
        </p>
        <div className="flex items-center justify-center gap-2">
          <div className="w-2 h-2 bg-purple-300 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
          <div className="w-2 h-2 bg-purple-300 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
          <div className="w-2 h-2 bg-purple-300 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
        </div>
      </div>
      
      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        .animate-blink {
          animation: blink 2s infinite;
        }
      `}</style>
    </div>
  );
}
