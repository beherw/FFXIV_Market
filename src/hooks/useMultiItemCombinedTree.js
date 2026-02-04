import { useState, useCallback, useEffect, useRef } from 'react';

const STORAGE_KEY = 'ffxiv_multi_item_state';

/**
 * Custom hook for managing multi-item combined tree state with localStorage cache
 */
export function useMultiItemCombinedTree() {
  const [itemList, setItemList] = useState([]);
  const [builtTree, setBuiltTree] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const prevItemListRef = useRef(null);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const data = JSON.parse(saved);
        // Load both itemList and builtTree from storage
        if (data.itemList && data.itemList.length > 0) {
          setItemList(data.itemList);
        }
        if (data.builtTree && data.builtTree.length > 0) {
          setBuiltTree(data.builtTree);
        }
      }
    } catch (err) {
      console.error('Failed to load multi-item state from localStorage:', err);
    }
  }, []);

  // Save to localStorage whenever state changes
  useEffect(() => {
    try {
      const data = {
        itemList,
        builtTree,
        timestamp: Date.now(),
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (err) {
      console.error('Failed to save multi-item state to localStorage:', err);
    }
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
    localStorage.removeItem(STORAGE_KEY);
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
