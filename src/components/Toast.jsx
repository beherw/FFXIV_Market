// Toast notification component
import { useEffect, useState, useRef } from 'react';

export default function Toast({ message, type = 'info', duration = 3000, onClose }) {
  const [visible, setVisible] = useState(true);
  const onCloseRef = useRef(onClose);
  const timerRef = useRef(null);

  // Keep onClose ref up to date
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Set up timer only once when component mounts
  useEffect(() => {
    if (duration > 0) {
      timerRef.current = setTimeout(() => {
        setVisible(false);
        setTimeout(() => {
          onCloseRef.current?.();
        }, 300);
      }, duration);
      
      return () => {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
        }
      };
    }
  }, [duration]); // Only depend on duration, not onClose

  if (!visible) return null;

  const bgColor = {
    info: 'bg-ffxiv-blue/90',
    success: 'bg-green-600/90',
    warning: 'bg-yellow-600/90',
    error: 'bg-red-600/90',
  }[type];

  return (
    <div className={`${bgColor} text-white px-4 py-3 rounded-lg shadow-lg backdrop-blur-sm border border-white/20 animate-fadeIn mb-2`}>
      <div className="flex items-center justify-between">
        <span className="text-sm">{message}</span>
        <button
          onClick={() => {
            if (timerRef.current) {
              clearTimeout(timerRef.current);
            }
            setVisible(false);
            setTimeout(() => {
              onCloseRef.current?.();
            }, 300);
          }}
          className="ml-4 text-white/80 hover:text-white"
        >
          ×
        </button>
      </div>
    </div>
  );
}
