import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

function NotFound() {
  const navigate = useNavigate();
  const [countdown, setCountdown] = useState(2);

  useEffect(() => {
    // Countdown timer
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          navigate('/', { replace: true });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Auto-redirect after 2 seconds
    const redirectTimer = setTimeout(() => {
      navigate('/', { replace: true });
    }, 2000);

    return () => {
      clearInterval(timer);
      clearTimeout(redirectTimer);
    };
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 via-purple-950/30 to-slate-950 text-white flex items-center justify-center px-4">
      <div className="text-center max-w-2xl">
        {/* 404 Number with glow effect */}
        <div className="mb-8">
          <h1 className="text-9xl sm:text-[12rem] font-bold text-ffxiv-gold text-glow mb-4 animate-fadeIn">
            404
          </h1>
          <div className="w-32 h-1 bg-gradient-to-r from-transparent via-ffxiv-gold to-transparent mx-auto opacity-60"></div>
        </div>

        {/* Error Message */}
        <div className="bg-gradient-to-br from-slate-800/60 via-purple-900/20 to-slate-800/60 backdrop-blur-sm rounded-lg border border-purple-500/20 p-8 sm:p-12 mb-8 card-glow">
          <div className="text-6xl mb-6">🔍</div>
          <h2 className="text-2xl sm:text-3xl font-bold text-ffxiv-gold mb-4">
            頁面未找到
          </h2>
          <p className="text-base sm:text-lg text-gray-300 mb-6">
            抱歉，您訪問的頁面不存在或已被移除。
          </p>
          <p className="text-sm sm:text-base text-gray-400">
            {countdown > 0 ? (
              <span>
                將在 <span className="text-ffxiv-gold font-bold">{countdown}</span> 秒後自動返回首頁...
              </span>
            ) : (
              <span className="text-ffxiv-gold">正在跳轉...</span>
            )}
          </p>
        </div>

        {/* Manual redirect button */}
        <button
          onClick={() => navigate('/', { replace: true })}
          className="px-6 py-3 bg-gradient-to-r from-purple-900/60 via-indigo-900/50 to-purple-900/60 border border-ffxiv-gold/40 text-ffxiv-gold font-semibold rounded-lg hover:border-ffxiv-gold/60 hover:shadow-[0_0_20px_rgba(251,191,36,0.4)] transition-all duration-300"
        >
          立即返回首頁
        </button>
      </div>
    </div>
  );
}

export default NotFound;
