// Item image component using XIVAPI
import { useState, useEffect } from 'react';
import { getItemImageUrl, getItemImageUrlSync, getCalculatedIconUrls } from '../utils/itemImage';

export default function ItemImage({ itemId, alt, className, ...props }) {
  const [imageUrl, setImageUrl] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [fallbackUrls, setFallbackUrls] = useState([]);
  const [currentFallbackIndex, setCurrentFallbackIndex] = useState(0);

  useEffect(() => {
    if (!itemId || itemId <= 0) {
      setIsLoading(false);
      setHasError(true);
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
  }, [itemId]);

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

  // Show placeholder while loading or on error
  if (isLoading || (hasError && !imageUrl)) {
    return (
      <div className={`w-10 h-10 bg-slate-700/50 rounded border border-slate-600/50 flex items-center justify-center ${className || ''}`}>
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
      <div className={`w-10 h-10 bg-slate-700/50 rounded border border-slate-600/50 flex items-center justify-center ${className || ''}`}>
        <span className="text-xs text-gray-500">?</span>
      </div>
    );
  }

  return (
    <img
      src={imageUrl}
      alt={alt || `Item ${itemId}`}
      className={className}
      onError={handleImageError}
      data-item-id={itemId}
      {...props}
    />
  );
}
