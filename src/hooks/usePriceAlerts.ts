import { useState, useEffect, useCallback } from 'react';

const PRICE_STORAGE_KEY = 'birkin-favorite-prices';
const ALERTS_DISMISSED_KEY = 'birkin-alerts-dismissed';

export interface PriceAlert {
  id: number;
  name: string;
  oldPrice: number;
  newPrice: number;
  direction: 'up' | 'down';
  imageUrl: string;
  url: string;
  site: string;
}

interface PriceRecord {
  [id: string]: number;
}

function loadPriceRecords(): PriceRecord {
  try {
    const raw = localStorage.getItem(PRICE_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return {};
}

function savePriceRecords(records: PriceRecord) {
  localStorage.setItem(PRICE_STORAGE_KEY, JSON.stringify(records));
}

function loadDismissedSession(): Set<number> {
  try {
    const raw = sessionStorage.getItem(ALERTS_DISMISSED_KEY);
    if (raw) return new Set(JSON.parse(raw));
  } catch {
    // ignore
  }
  return new Set();
}

function saveDismissedSession(ids: Set<number>) {
  sessionStorage.setItem(ALERTS_DISMISSED_KEY, JSON.stringify(Array.from(ids)));
}

export function usePriceAlerts(
  favoriteIds: Set<number>,
  products: { id: number; name: string; price: string; imageUrl: string; url: string; site: string }[]
) {
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<number>>(() => loadDismissedSession());

  // Parse price string to number
  const parsePrice = useCallback((price: string): number => {
    return parseInt(price.replace(/[^\d]/g, '') || '0', 10);
  }, []);

  // Check for price changes on mount and when favorites change
  useEffect(() => {
    if (favoriteIds.size === 0) {
      setAlerts([]);
      return;
    }

    const savedPrices = loadPriceRecords();
    const newAlerts: PriceAlert[] = [];
    const updatedPrices: PriceRecord = { ...savedPrices };

    for (const product of products) {
      if (!favoriteIds.has(product.id)) continue;

      const currentPrice = parsePrice(product.price);
      if (currentPrice === 0) continue;

      const savedPrice = savedPrices[String(product.id)];

      if (savedPrice !== undefined && savedPrice !== currentPrice) {
        newAlerts.push({
          id: product.id,
          name: product.name,
          oldPrice: savedPrice,
          newPrice: currentPrice,
          direction: currentPrice < savedPrice ? 'down' : 'up',
          imageUrl: product.imageUrl,
          url: product.url,
          site: product.site,
        });
      }

      // Always update the stored price to the current value
      updatedPrices[String(product.id)] = currentPrice;
    }

    // Clean up prices for items no longer in favorites
    const favIdStrings = new Set(Array.from(favoriteIds).map(String));
    for (const key of Object.keys(updatedPrices)) {
      if (!favIdStrings.has(key)) {
        delete updatedPrices[key];
      }
    }

    savePriceRecords(updatedPrices);

    // Filter out dismissed alerts
    const filtered = newAlerts.filter(a => !dismissedIds.has(a.id));
    setAlerts(filtered);
  }, [favoriteIds, products, parsePrice, dismissedIds]);

  // When a new item is favorited, record its current price immediately
  useEffect(() => {
    const savedPrices = loadPriceRecords();
    let changed = false;

    for (const product of products) {
      if (!favoriteIds.has(product.id)) continue;
      const key = String(product.id);
      if (savedPrices[key] === undefined) {
        const currentPrice = parsePrice(product.price);
        if (currentPrice > 0) {
          savedPrices[key] = currentPrice;
          changed = true;
        }
      }
    }

    if (changed) {
      savePriceRecords(savedPrices);
    }
  }, [favoriteIds, products, parsePrice]);

  const dismissAlert = useCallback((id: number) => {
    setDismissedIds(prev => {
      const next = new Set(prev);
      next.add(id);
      saveDismissedSession(next);
      return next;
    });
    setAlerts(prev => prev.filter(a => a.id !== id));
  }, []);

  const dismissAllAlerts = useCallback(() => {
    const allIds = new Set(alerts.map(a => a.id));
    setDismissedIds(prev => {
      const next = new Set([...Array.from(prev), ...Array.from(allIds)]);
      saveDismissedSession(next);
      return next;
    });
    setAlerts([]);
  }, [alerts]);

  return { alerts, dismissAlert, dismissAllAlerts };
}
