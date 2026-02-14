// Cute fluffy cloud loader animation - Pure CSS for GPU efficiency
export default function RunningLoader({ 
  message = '正在搜尋中...',
  searchingLanguage = null  // Optional: display language being searched (e.g., '繁體', '簡體', 'English')
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] py-12 px-4">
      <div className="relative w-full max-w-lg h-48 mb-8 overflow-hidden">
        {/* Ground line with gradient */}
        <div className="absolute bottom-0 left-0 right-0 h-3">
          <div className="h-full bg-gradient-to-r from-transparent via-purple-400/40 to-transparent"></div>
        </div>
        
        {/* Cute fluffy cloud character - pure CSS animation */}
        <div className="loader-cloud">
          {/* Main cloud body */}
          <div className="loader-cloud-wobble">
            {/* Large center cloud */}
            <div className="w-20 h-16 bg-gradient-to-br from-purple-200/80 via-purple-300/70 to-purple-400/60 rounded-full shadow-lg relative z-10">
              <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent rounded-full"></div>
            </div>
            
            {/* Left cloud puff */}
            <div className="absolute -left-4 top-2 w-14 h-12 bg-gradient-to-br from-purple-200/80 via-purple-300/70 to-purple-400/60 rounded-full shadow-md">
              <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent rounded-full"></div>
            </div>
            
            {/* Right cloud puff */}
            <div className="absolute -right-4 top-2 w-14 h-12 bg-gradient-to-br from-purple-200/80 via-purple-300/70 to-purple-400/60 rounded-full shadow-md">
              <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent rounded-full"></div>
            </div>
            
            {/* Bottom cloud puff */}
            <div className="absolute left-1/2 -bottom-2 transform -translate-x-1/2 w-16 h-10 bg-gradient-to-br from-purple-200/80 via-purple-300/70 to-purple-400/60 rounded-full shadow-md">
              <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent rounded-full"></div>
            </div>
            
            {/* Cute face on cloud */}
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-20">
              {/* Eyes */}
              <div className="flex gap-3 mb-1 justify-center">
                <div className="w-2.5 h-2.5 bg-purple-600 rounded-full loader-blink"></div>
                <div className="w-2.5 h-2.5 bg-purple-600 rounded-full loader-blink" style={{ animationDelay: '0.1s' }}></div>
              </div>
              {/* Smile */}
              <div className="w-7 h-3 border-b-2 border-purple-600 rounded-b-full mx-auto"></div>
            </div>
            
            {/* Sparkle stars around cloud - CSS only */}
            <div className="loader-sparkle loader-sparkle-1">
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-2 h-2 text-ffxiv-gold">
                <path d="M12 2l2.4 7.2h7.6l-6 4.8 2.4 7.2-6-4.8-6 4.8 2.4-7.2-6-4.8h7.6z"/>
              </svg>
            </div>
            <div className="loader-sparkle loader-sparkle-2">
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-2 h-2 text-ffxiv-gold">
                <path d="M12 2l2.4 7.2h7.6l-6 4.8 2.4 7.2-6-4.8-6 4.8 2.4-7.2-6-4.8h7.6z"/>
              </svg>
            </div>
            <div className="loader-sparkle loader-sparkle-3">
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-2 h-2 text-ffxiv-gold">
                <path d="M12 2l2.4 7.2h7.6l-6 4.8 2.4 7.2-6-4.8-6 4.8 2.4-7.2-6-4.8h7.6z"/>
              </svg>
            </div>
          </div>
        </div>
        
        {/* Floating particles - CSS only */}
        <div className="absolute inset-0 opacity-30 pointer-events-none">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="absolute w-1.5 h-1.5 bg-purple-300 rounded-full loader-particle"
              style={{
                left: `${10 + i * 15}%`,
                top: `${35 + (i % 3) * 10}%`,
                animationDelay: `${i * 0.4}s`,
              }}
            ></div>
          ))}
        </div>
      </div>
      
      {/* Loading text with animation */}
      <div className="text-center">
        <p className="text-lg sm:text-xl font-semibold text-purple-300 mb-3">
          {searchingLanguage ? `正在搜尋${searchingLanguage}資料庫...` : message}
        </p>
        <div className="flex items-center justify-center gap-2">
          <div className="w-2 h-2 bg-purple-300 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
          <div className="w-2 h-2 bg-purple-300 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
          <div className="w-2 h-2 bg-purple-300 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
        </div>
      </div>
      
      <style>{`
        /* Cloud movement - pure CSS, no JS setInterval */
        @keyframes cloudMove {
          0% { left: -10%; }
          100% { left: 100%; }
        }
        @keyframes cloudBounce {
          0%, 100% { transform: translateX(-50%) translateY(0); }
          50% { transform: translateX(-50%) translateY(-6px); }
        }
        @keyframes cloudWobble {
          0%, 100% { transform: rotate(-3deg); }
          50% { transform: rotate(3deg); }
        }
        @keyframes loaderBlink {
          0%, 40%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        @keyframes sparkleFloat {
          0%, 100% { opacity: 0.6; transform: scale(0.8) rotate(0deg); }
          50% { opacity: 1; transform: scale(1.1) rotate(180deg); }
        }
        @keyframes particleFloat {
          0%, 100% { opacity: 0.3; transform: translateY(0) scale(0.5); }
          50% { opacity: 0.7; transform: translateY(-10px) scale(1); }
        }
        .loader-cloud {
          position: absolute;
          bottom: 2rem;
          animation: cloudMove 6s linear infinite, cloudBounce 1.5s ease-in-out infinite;
          will-change: left;
        }
        .loader-cloud-wobble {
          position: relative;
          animation: cloudWobble 2s ease-in-out infinite;
        }
        .loader-blink {
          animation: loaderBlink 2s infinite;
        }
        .loader-sparkle {
          position: absolute;
          animation: sparkleFloat 2s ease-in-out infinite;
        }
        .loader-sparkle-1 { top: -10%; left: -20%; animation-delay: 0s; }
        .loader-sparkle-2 { top: 10%; right: -20%; animation-delay: 0.7s; }
        .loader-sparkle-3 { top: -5%; left: 40%; animation-delay: 1.3s; }
        .loader-particle {
          animation: particleFloat 3s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
