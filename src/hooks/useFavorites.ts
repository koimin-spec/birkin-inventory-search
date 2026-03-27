import { useState, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'birkin-favorites';

function loadFavorites(): Set<number> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const arr = JSON.parse(raw) as number[];
      return new Set(arr);
    }
  } catch {
    // ignore
  }
  return new Set();
}

function saveFavorites(ids: Set<number>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(ids)));
}

export function useFavorites() {
  const [favoriteIds, setFavoriteIds] = useState<Set<number>>(() => loadFavorites());

  useEffect(() => {
    saveFavorites(favoriteIds);
  }, [favoriteIds]);

  const toggleFavorite = useCallback((id: number) => {
    setFavoriteIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const isFavorite = useCallback((id: number) => favoriteIds.has(id), [favoriteIds]);

  const favoriteCount = favoriteIds.size;

  return { favoriteIds, toggleFavorite, isFavorite, favoriteCount };
}
