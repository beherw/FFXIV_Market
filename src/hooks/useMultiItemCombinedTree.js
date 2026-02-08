import { useState, useCallback, useEffect, useRef } from 'react';
import { getValidatedCache, setCache, removeCache } from '../utils/cacheStorage.js';

const STORAGE_KEY = 'ffxiv_multi_item_state';

/**
 * Custom hook for managing multi-item combined tree state with localStorage cache
 */
export function useMultiItemCombinedTree() {
  const [itemList, setItemList] = useState([]);
  const [builtTree, setBuiltTree] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const prevItemListRef = useRef(null);

  // Load from localStorage on mount (only if cache is valid/versioned)
  useEffect(() => {
    const data = getValidatedCache(STORAGE_KEY);
    if (data) {
      if (data.itemList && data.itemList.length > 0) {
        setItemList(data.itemList);
      }
      if (data.builtTree && data.builtTree.length > 0) {
        setBuiltTree(data.builtTree);
      }
    }
  }, []);

  // Save to localStorage whenever state changes (with timestamp for validation)
  useEffect(() => {
    setCache(STORAGE_KEY, { itemList, builtTree });
  }, [itemList, builtTree]);

  // Clear built tree when item list changes (after initial load)
  useEffect(() => {
    // Skip on initial load
    if (prevItemListRef.current === null) {
      prevItemListRef.current = itemList;
      return;
    }
    
    // Check if itemList has actually changed
    const prevIds = prevItemListRef.current.map(item => item.id || item.itemId).sort().join(',');
    const currentIds = itemList.map(item => item.id || item.itemId).sort().join(',');
    
    if (prevIds !== currentIds && builtTree !== null) {
      // Item list has changed, clear the built tree cache
      setBuiltTree(null);
    }
    
    prevItemListRef.current = itemList;
  }, [itemList, builtTree]);

  const updateItemList = useCallback((newList) => {
    setItemList(newList);
  }, []);

  const buildTree = useCallback((items) => {
    setBuiltTree(items);
    // Don't clear itemList - allow users to continue editing
  }, []);

  const clearTree = useCallback(() => {
    setBuiltTree(null);
    // Keep itemList intact so user can re-edit and rebuild
  }, []);

  const clearAll = useCallback(() => {
    setItemList([]);
    setBuiltTree(null);
    removeCache(STORAGE_KEY);
  }, []);

  return {
    itemList,
    builtTree,
    isModalOpen,
    setIsModalOpen,
    updateItemList,
    buildTree,
    clearTree,
    clearAll,
  };
}
