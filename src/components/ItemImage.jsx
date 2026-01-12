// Item image component using XIVAPI
import { useState, useEffect, useRef } from 'react';
import { getItemImageUrl, getItemImageUrlSync, getCalculatedIconUrls } from '../utils/itemImage';

export default function ItemImage({ itemId, alt, className, priority = false, loadDelay = 0, ...props }) {
  const [imageUrl, setImageUrl] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [fallbackUrls, setFallbackUrls] = useState([]);
  const [currentFallbackIndex, setCurrentFallbackIndex] = useState(0);
  const [shouldLoad, setShouldLoad] = useState(priority);
  const timeoutRef = useRef(null);
  const observerRef = useRef(null);
  const imgRef = useRef(null);

  // 优先级加载：前5个立即加载，后面的按顺序延迟加载
  useEffect(() => {
    if (priority) {
      // 优先级图片（前5个）立即加载
      setShouldLoad(true);
      return;
    }

    // 非优先级图片：按顺序延迟加载，每200ms加载一个
    if (loadDelay > 0) {
      timeoutRef.current = setTimeout(() => {
        setShouldLoad(true);
      }, loadDelay);
      
      return () => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
      };
    } else {
      // 如果没有设置延迟，也使用 Intersection Observer 作为备选方案
      if (typeof IntersectionObserver !== 'undefined') {
        observerRef.current = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting) {
                setShouldLoad(true);
                if (observerRef.current && imgRef.current) {
                  observerRef.current.unobserve(imgRef.current);
                }
              }
            });
          },
          {
            rootMargin: '50px', // 提前50px开始加载
            threshold: 0.01,
          }
        );
        // Observer 会在 ref 设置后通过另一个 useEffect 开始观察
      } else {
        // 不支持 Intersection Observer 时，延迟加载
        setShouldLoad(true);
      }
    }
  }, [priority, loadDelay]);

  // 加载图片
  useEffect(() => {
    if (!shouldLoad || !itemId || itemId <= 0) {
      if (!itemId || itemId <= 0) {
        setIsLoading(false);
        setHasError(true);
      }
      return;
    }

    // Check cache first
    const cachedUrl = getItemImageUrlSync(itemId);
    if (cachedUrl) {
      setImageUrl(cachedUrl);
      setIsLoading(false);
      setHasError(false);
      return;
    }

    // Set calculated fallback URLs
    const calculatedUrls = getCalculatedIconUrls(itemId);
    setFallbackUrls(calculatedUrls);

    // Fetch from API
    setIsLoading(true);
    getItemImageUrl(itemId)
      .then(url => {
        if (url) {
          setImageUrl(url);
          setHasError(false);
        } else {
          // API failed, try calculated URLs
          if (calculatedUrls.length > 0) {
            setImageUrl(calculatedUrls[0]);
            setCurrentFallbackIndex(0);
          } else {
            setHasError(true);
          }
        }
        setIsLoading(false);
      })
      .catch(error => {
        console.error('Failed to load item image:', error);
        // Try calculated URLs as fallback
        if (calculatedUrls.length > 0) {
          setImageUrl(calculatedUrls[0]);
          setCurrentFallbackIndex(0);
        } else {
          setHasError(true);
        }
        setIsLoading(false);
      });
  }, [itemId, shouldLoad]);

  const handleImageError = () => {
    // Try next fallback URL
    if (currentFallbackIndex < fallbackUrls.length - 1) {
      const nextIndex = currentFallbackIndex + 1;
      setCurrentFallbackIndex(nextIndex);
      setImageUrl(fallbackUrls[nextIndex]);
    } else {
      // All URLs failed
      setHasError(true);
      setImageUrl(null);
    }
  };

  // Extract width and height from className to maintain aspect ratio
  const getDimensions = () => {
    if (!className) return { width: 'w-10', height: 'h-10' };
    
    // Match Tailwind width/height classes (w-10, w-20, h-10, etc.)
    const widthMatch = className.match(/\bw-(\d+)\b/);
    const heightMatch = className.match(/\bh-(\d+)\b/);
    
    const width = widthMatch ? `w-${widthMatch[1]}` : 'w-10';
    const height = heightMatch ? `h-${heightMatch[1]}` : 'h-10';
    
    return { width, height };
  };

  const { width, height } = getDimensions();
  // Preserve other classes from className but ensure dimensions are set
  const otherClasses = className?.split(' ').filter(c => !c.match(/^(w-|h-)/)).join(' ') || '';
  const containerClasses = `${width} ${height} bg-purple-900/40 rounded border border-purple-500/30 flex items-center justify-center flex-shrink-0 ${otherClasses}`.trim();

  // 设置 ref 用于 Intersection Observer
  useEffect(() => {
    if (!priority && loadDelay === 0 && observerRef.current && imgRef.current) {
      observerRef.current.observe(imgRef.current);
      return () => {
        if (observerRef.current && imgRef.current) {
          observerRef.current.unobserve(imgRef.current);
        }
      };
    }
  }, [priority, loadDelay]);

  // Show placeholder while loading or on error - always reserve space
  if (!shouldLoad) {
    // 尚未开始加载，显示占位符
    return (
      <div ref={imgRef} className={containerClasses}>
        <span className="text-xs text-gray-500 opacity-50">...</span>
      </div>
    );
  }

  if (isLoading || (hasError && !imageUrl)) {
    return (
      <div ref={imgRef} className={containerClasses}>
        {isLoading ? (
          <span className="text-xs text-gray-500 animate-pulse">...</span>
        ) : (
          <span className="text-xs text-gray-500">?</span>
        )}
      </div>
    );
  }

  if (!imageUrl) {
    return (
      <div ref={imgRef} className={containerClasses}>
        <span className="text-xs text-gray-500">?</span>
      </div>
    );
  }

  return (
    <div ref={imgRef} className={containerClasses}>
      <img
        src={imageUrl}
        alt={alt || `Item ${itemId}`}
        className="w-full h-full object-contain"
        onError={handleImageError}
        data-item-id={itemId}
        {...props}
      />
    </div>
  );
}
