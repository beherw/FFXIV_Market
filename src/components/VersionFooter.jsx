import { APP_VERSION } from '../constants/version';

export default function VersionFooter() {
  return (
    <div className="w-full py-3 mt-6 border-t border-slate-700/30">
      <p className="text-xs text-slate-500 text-center">
        版本 <span className="text-ffxiv-gold font-semibold">{APP_VERSION}</span> 
        <span className="mx-3 text-slate-600">•</span>
        作者：<span className="text-ffxiv-gold font-semibold">貝肝煎熬</span>
      </p>
    </div>
  );
}
