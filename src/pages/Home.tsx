/*
 * Design: Refined Monochrome + Warm Accent — Dark Mode対応版
 * - Light: off-white bg (#F8F6F3), white cards, navy accent (#1E3A5F)
 * - Dark: deep slate bg, dark cards, sky-blue accent
 * - Typography: "Cormorant Garamond" (display) + "Noto Sans JP" (body)
 * - Features: Sort, NEW badge, Dark mode, Color/Price/Size/Type/Site filters, Favorites
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Search, ExternalLink, ShoppingBag, Gavel,
  SlidersHorizontal, X, Moon, Sun,
  ArrowUpDown, ArrowUp, ArrowDown, Sparkles,
  Heart, TrendingDown, TrendingUp, Bell, ChevronRight,
  LayoutList, LayoutGrid,
} from 'lucide-react';
import birkinData from '@/data/birkin-inventory.json';
import { useTheme } from '@/contexts/ThemeContext';
import { useFavorites } from '@/hooks/useFavorites';
import { usePriceAlerts } from '@/hooks/usePriceAlerts';

interface BirkinProduct {
  id: number;
  name: string;
  price: string | number;
  priceUSD?: string;
  size: string;
  type: string;
  material: string;
  url: string;
  imageUrl: string;
  site: string;
  condition: string;
  shipping?: string;
  location?: string;
  shipsToJapan?: boolean | null;
  color?: string;
}

type SortKey = 'default' | 'price_asc' | 'price_desc';

const PLACEHOLDER_IMG = 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=400&h=400&fit=crop&auto=format';

// 最新10件をNEWとみなす（IDが大きい順）
const MAX_ID = Math.max(...(birkinData as BirkinProduct[]).map(p => p.id));
const NEW_THRESHOLD = MAX_ID - 9;

// 色の定義
const COLOR_KEYWORDS: Record<string, string[]> = {
  'ブラック': ['ブラック', '黒', 'black', 'noir'],
  'ルージュ': ['ルージュ', '赤', '赤系', 'rouge', 'red'],
  'ゴールド': ['ゴールド', '金', '金色', 'gold', 'or'],
  'ベージュ': ['ベージュ', 'beige', 'tan'],
  'グレー': ['グレー', '灰色', 'gray', 'grey'],
  'ホワイト': ['ホワイト', '白', 'white', 'blanc'],
  'ブルー': ['ブルー', '青', 'blue', 'bleu'],
  'グリーン': ['グリーン', '緑', 'green', 'vert'],
  'オレンジ': ['オレンジ', 'orange'],
  'ピンク': ['ピンク', 'pink', 'rose'],
  'パープル': ['パープル', '紫', 'purple', 'violet'],
  'シルバー': ['シルバー', '銀', 'silver', 'argent'],
};

// 価格帯の定義
const PRICE_RANGES = [
  { label: '〜500万円', min: 0, max: 5000000 },
  { label: '500〜1000万円', min: 5000000, max: 10000000 },
  { label: '1000万円以上', min: 10000000, max: Infinity },
];

function extractColor(name: string): string {
  for (const [color, keywords] of Object.entries(COLOR_KEYWORDS)) {
    for (const keyword of keywords) {
      if (name.toLowerCase().includes(keyword.toLowerCase())) {
        return color;
      }
    }
  }
  return '';
}

function parsePrice(price: string | number): number {
  if (typeof price === 'number') return price;
  return parseInt(String(price).replace(/[^\d]/g, '') || '0', 10);
}

function NewBadge() {
  return (
    <div className="absolute top-2 right-2 z-10">
      <span className="relative flex items-center gap-1 bg-rose-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-lg new-badge-glow">
        <Sparkles className="w-3 h-3" />
        NEW
        {/* Ping animation ring */}
        <span className="absolute inset-0 rounded-full bg-rose-400 opacity-75 new-badge-ping" />
      </span>
    </div>
  );
}

function FavoriteButton({ isFav, onToggle }: { isFav: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggle(); }}
      className={`absolute top-2 right-2 z-20 w-8 h-8 flex items-center justify-center rounded-full transition-all duration-200 ${
        isFav
          ? 'bg-rose-500 text-white shadow-lg scale-110'
          : 'bg-black/40 text-white/80 hover:bg-black/60 hover:text-white backdrop-blur-sm'
      }`}
      title={isFav ? 'お気に入りから削除' : 'お気に入りに追加'}
    >
      <Heart className={`w-4 h-4 ${isFav ? 'fill-current' : ''}`} />
    </button>
  );
}

function ProductCard({
  product,
  isNew,
  isFav,
  onToggleFav,
  isCompact = false,
}: {
  product: BirkinProduct;
  isNew: boolean;
  isFav: boolean;
  onToggleFav: () => void;
  isCompact?: boolean;
}) {
  const [imgError, setImgError] = useState(false);
  const imgSrc = (!imgError && product.imageUrl) ? product.imageUrl : PLACEHOLDER_IMG;
  const isAuction = product.site === 'ヤフオク';

  const siteColors: Record<string, string> = {
    'Yahoo!ショッピング': 'bg-red-500',
    '楽天市場': 'bg-rose-600',
    'メルカリ': 'bg-red-400',
    'eBay': 'bg-blue-600',
    'ヤフオク': 'bg-orange-500',
    'OKURA': 'bg-purple-600',
    'HOUBIDOU': 'bg-indigo-600',
  };
  const siteColor = siteColors[product.site] || 'bg-slate-500';
  const isEbay = product.site === 'eBay';
  const noJapanShipping = product.shipsToJapan === false;

  return (
    <div className={`bg-card text-card-foreground rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden flex flex-col border group ${
      isFav ? 'border-rose-400 dark:border-rose-500 ring-1 ring-rose-200 dark:ring-rose-800' : 'border-border'
    }`}>
      {/* Product Image */}
      <div className="relative overflow-hidden bg-muted" style={{ aspectRatio: '1/1' }}>
        <img
          src={imgSrc}
          alt={product.name}
          onError={() => setImgError(true)}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        {/* Site Badge */}
        <div className="absolute top-2 left-2">
          <span className={`flex items-center gap-1 ${siteColor} text-white text-xs font-semibold px-2 py-1 rounded-full shadow`}>
            {isAuction ? <Gavel className="w-3 h-3" /> : <ShoppingBag className="w-3 h-3" />}
            {product.site.replace('Yahoo!', 'Y!')}
          </span>
        </div>
        {/* Favorite Button (replaces NEW badge position when not new) */}
        {isNew ? (
          <>
            <NewBadge />
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleFav(); }}
              className={`absolute bottom-2 right-2 z-20 w-8 h-8 flex items-center justify-center rounded-full transition-all duration-200 ${
                isFav
                  ? 'bg-rose-500 text-white shadow-lg scale-110'
                  : 'bg-black/40 text-white/80 hover:bg-black/60 hover:text-white backdrop-blur-sm'
              }`}
              title={isFav ? 'お気に入りから削除' : 'お気に入りに追加'}
            >
              <Heart className={`w-4 h-4 ${isFav ? 'fill-current' : ''}`} />
            </button>
          </>
        ) : (
          <FavoriteButton isFav={isFav} onToggle={onToggleFav} />
        )}
        {/* Japan shipping unavailable badge */}
        {noJapanShipping && (
          <div className="absolute bottom-2 left-2 z-10">
            <span className="flex items-center gap-1 bg-gray-800/90 text-red-400 text-xs font-bold px-2 py-1 rounded-full border border-red-500/50 shadow">
              日本発送不可
            </span>
          </div>
        )}
      </div>

      {/* Card Body */}
      <div className={`flex flex-col flex-1 ${isCompact ? 'p-2.5' : 'p-4'}`}>
        {/* Type / Condition Badges */}
        <div className={`flex flex-wrap mb-2 ${isCompact ? 'gap-1' : 'gap-1.5'}`}>
          <span className={`font-medium rounded-full border ${isCompact ? 'text-[10px] px-1.5 py-0' : 'text-xs px-2 py-0.5'} ${
            product.type === 'クロコダイル'
              ? 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700'
              : product.type === 'パーソナルオーダー'
              ? 'bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-900/40 dark:text-violet-300 dark:border-violet-700'
              : 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:border-blue-700'
          }`}>
            {product.type}
          </span>
          {product.condition && (
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
              product.condition.includes('未使用')
                ? 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-700'
                : product.condition.includes('美品')
                ? 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/40 dark:text-green-300 dark:border-green-700'
                : 'bg-muted text-muted-foreground border-border'
            }`}>
              {product.condition}
            </span>
          )}
        </div>

        {/* Product Name */}
        <h3 className={`font-medium text-foreground leading-snug flex-1 ${isCompact ? 'text-xs mb-2 line-clamp-2' : 'text-sm mb-3 line-clamp-3'}`}>
          {product.name}
        </h3>

        {/* Details Grid — only show rows with data */}
        <div className={`text-muted-foreground border-t border-border ${isCompact ? 'text-[10px] mb-2 pt-2' : 'text-xs mb-3 pt-3'}`}>
          {product.size && (
            <div className="grid grid-cols-2 gap-x-3 mb-1">
              <span className="font-medium text-foreground/70">サイズ</span>
              <span>{product.size}</span>
            </div>
          )}
          <div className="grid grid-cols-2 gap-x-3">
            <span className="font-medium text-foreground/70">素材</span>
            <span className="truncate">{product.material}</span>
          </div>
        </div>

        {/* Price */}
        <div className={isCompact ? 'mb-2' : 'mb-3'}>
          <p className="leading-none" style={{ fontFamily: "'Noto Sans JP', sans-serif" }}>
            <span className={`font-bold price-accent ${isCompact ? 'text-base' : 'text-2xl'}`}>
              {typeof product.price === 'number' ? product.price.toLocaleString() : String(product.price).replace('円', '')}
            </span>
            <span className={`font-medium text-muted-foreground ml-1 ${isCompact ? 'text-[10px]' : 'text-sm'}`}>円</span>
          </p>
          {isEbay && product.priceUSD && (
            <p className="text-xs text-muted-foreground mt-0.5">元値: {product.priceUSD}</p>
          )}
          {product.shipping && (
            <p className="text-xs mt-1 flex items-center gap-1">
              <span className={product.shipping === '送料無料' ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-muted-foreground'}>
                {product.shipping}
              </span>
            </p>
          )}
        </div>

        {/* CTA Button */}
        <a
          href={product.url}
          target="_blank"
          rel="noopener noreferrer"
          className={`flex items-center justify-center gap-1.5 w-full rounded-lg font-medium text-white transition-colors duration-200 cta-btn ${isCompact ? 'py-1.5 px-2 text-xs' : 'py-2 px-4 text-sm'}`}
        >
          詳細を見る
          <ExternalLink className={isCompact ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
        </a>
      </div>
    </div>
  );
}

export default function Home() {
  const { theme, toggleTheme } = useTheme();
  const { isFavorite, toggleFavorite, favoriteCount, favoriteIds } = useFavorites();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [selectedSite, setSelectedSite] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [selectedPriceRange, setSelectedPriceRange] = useState<number | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('default');
  // スマートフォン用の列数切り替え（localStorageで永続化）
  const [mobileColumns, setMobileColumns] = useState<1 | 2>(() => {
    try {
      const saved = localStorage.getItem('birkin-mobile-columns');
      return saved === '2' ? 2 : 1;
    } catch { return 1; }
  });
  const toggleMobileColumns = useCallback(() => {
    setMobileColumns(prev => {
      const next = prev === 1 ? 2 : 1;
      try { localStorage.setItem('birkin-mobile-columns', String(next)); } catch {}
      return next;
    });
  }, []);

  // Price alerts for favorite items
  const { alerts: priceAlerts, dismissAlert, dismissAllAlerts } = usePriceAlerts(
    favoriteIds,
    (birkinData as BirkinProduct[])
  );

  const products = useMemo(() => (birkinData as BirkinProduct[]).map(p => ({
    ...p,
    color: extractColor(p.name),
  })), []);

  // Filter out empty sizes from the unique sizes list
  const uniqueSizes = useMemo(() =>
    Array.from(new Set(products.map((p) => p.size).filter(s => s && s.trim() !== ''))).sort(),
    [products]
  );
  const uniqueTypes = useMemo(() => Array.from(new Set(products.map((p) => p.type))), [products]);
  const uniqueSites = useMemo(() => Array.from(new Set(products.map((p) => p.site))), [products]);
  const uniqueColors = useMemo(() =>
    Array.from(new Set(products.filter(p => p.color).map((p) => p.color))).sort(),
    [products]
  );
  const hasFilters = selectedSize || selectedType || selectedSite || selectedColor || selectedPriceRange !== null;

  const filteredProducts = useMemo(() => {
    let list = products.filter((p) => {
      const q = searchTerm.toLowerCase();
      const matchSearch =
        q === '' ||
        p.name.toLowerCase().includes(q) ||
        p.material.toLowerCase().includes(q) ||
        p.condition.toLowerCase().includes(q);
      const matchSize = !selectedSize || p.size === selectedSize;
      const matchType = !selectedType || p.type === selectedType;
      const matchSite = !selectedSite || p.site === selectedSite;
      const matchColor = !selectedColor || p.color === selectedColor;
      const matchFav = !showFavoritesOnly || isFavorite(p.id);
      
      let matchPrice = true;
      if (selectedPriceRange !== null) {
        const range = PRICE_RANGES[selectedPriceRange];
        const price = parsePrice(p.price);
        matchPrice = price >= range.min && price <= range.max;
      }

      return matchSearch && matchSize && matchType && matchSite && matchColor && matchPrice && matchFav;
    });

    if (sortKey === 'price_asc') {
      list = list.slice().sort((a, b) => parsePrice(a.price) - parsePrice(b.price));
    } else if (sortKey === 'price_desc') {
      list = list.slice().sort((a, b) => parsePrice(b.price) - parsePrice(a.price));
    }
    // 'default' = 新着順（IDが大きい順）
    else {
      list = list.slice().sort((a, b) => b.id - a.id);
    }

    return list;
  }, [searchTerm, selectedSize, selectedType, selectedSite, selectedColor, selectedPriceRange, sortKey, products, showFavoritesOnly, isFavorite]);

  const clearFilters = useCallback(() => {
    setSelectedSize(null);
    setSelectedType(null);
    setSelectedSite(null);
    setSelectedColor(null);
    setSelectedPriceRange(null);
    setSearchTerm('');
    setShowFavoritesOnly(false);
  }, []);

  const sortButtons: { key: SortKey; label: string; icon: React.ReactNode }[] = [
    { key: 'default', label: '新着順', icon: <Sparkles className="w-3.5 h-3.5" /> },
    { key: 'price_asc', label: '価格 安い順', icon: <ArrowUp className="w-3.5 h-3.5" /> },
    { key: 'price_desc', label: '価格 高い順', icon: <ArrowDown className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="min-h-screen bg-background" style={{ fontFamily: "'Noto Sans JP', sans-serif" }}>
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-50 shadow-sm">
        <div className="container py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1
                className="font-bold tracking-wide header-title"
                style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: '1.75rem' }}
              >
                HERMÈS BIRKIN
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5 tracking-widest uppercase">在庫検索 — Inventory Search</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground hidden sm:block">
                <span className="font-bold text-foreground">{filteredProducts.length}</span> 件
              </span>
              {/* Favorites toggle */}
              <Button
                variant={showFavoritesOnly ? 'default' : 'outline'}
                size="sm"
                onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                className={`flex items-center gap-1.5 ${showFavoritesOnly ? 'bg-rose-500 hover:bg-rose-600 text-white border-rose-500' : ''}`}
                title="お気に入りのみ表示"
              >
                <Heart className={`w-4 h-4 ${showFavoritesOnly ? 'fill-current' : ''}`} />
                {favoriteCount > 0 && (
                  <span className="text-xs font-bold">{favoriteCount}</span>
                )}
              </Button>
              {/* Mobile column toggle — スマートフォンのみ表示 */}
              <Button
                variant="outline"
                size="sm"
                onClick={toggleMobileColumns}
                className="w-9 h-9 p-0 sm:hidden"
                title={mobileColumns === 1 ? '2列表示に切り替え' : '1列表示に切り替え'}
              >
                {mobileColumns === 1
                  ? <LayoutGrid className="w-4 h-4" />
                  : <LayoutList className="w-4 h-4" />
                }
              </Button>
              {/* Dark mode toggle */}
              <Button
                variant="outline"
                size="sm"
                onClick={toggleTheme}
                className="w-9 h-9 p-0"
                title={theme === 'dark' ? 'ライトモードへ' : 'ダークモードへ'}
              >
                {theme === 'dark'
                  ? <Sun className="w-4 h-4 text-yellow-400" />
                  : <Moon className="w-4 h-4" />
                }
              </Button>
              {/* Manual Update Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => alert('GitHub Actionsで手動更新を実行します。\nこのボタンは本番環境でのみ機能します。')}
                className="flex items-center gap-1.5 hidden sm:flex"
                title="今すぐ更新"
              >
                <span className="text-xs">🔄 更新</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-1.5"
              >
                <SlidersHorizontal className="w-4 h-4" />
                <span className="hidden sm:inline">フィルター</span>
                {hasFilters && <span className="w-2 h-2 rounded-full bg-blue-500" />}
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Price Change Alerts Banner */}
      {priceAlerts.length > 0 && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/40 border-b border-amber-200 dark:border-amber-800">
          <div className="container py-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                  お気に入り商品の価格変動 ({priceAlerts.length}件)
                </span>
              </div>
              <button
                onClick={dismissAllAlerts}
                className="text-xs text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200 font-medium"
              >
                すべて閉じる
              </button>
            </div>
            <div className="space-y-2">
              {priceAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 border ${
                    alert.direction === 'down'
                      ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800'
                      : 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800'
                  }`}
                >
                  {/* Thumbnail */}
                  <img
                    src={alert.imageUrl || PLACEHOLDER_IMG}
                    alt=""
                    className="w-10 h-10 rounded-md object-cover flex-shrink-0"
                    onError={(e) => { (e.target as HTMLImageElement).src = PLACEHOLDER_IMG; }}
                  />
                  {/* Direction Icon */}
                  <div className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${
                    alert.direction === 'down'
                      ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400'
                      : 'bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400'
                  }`}>
                    {alert.direction === 'down'
                      ? <TrendingDown className="w-4 h-4" />
                      : <TrendingUp className="w-4 h-4" />
                    }
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{alert.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-muted-foreground line-through">
                        {alert.oldPrice.toLocaleString()}円
                      </span>
                      <ChevronRight className="w-3 h-3 text-muted-foreground" />
                      <span className={`text-xs font-bold ${
                        alert.direction === 'down'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}>
                        {alert.newPrice.toLocaleString()}円
                      </span>
                      <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${
                        alert.direction === 'down'
                          ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300'
                          : 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300'
                      }`}>
                        {alert.direction === 'down' ? '▼' : '▲'}
                        {Math.abs(Math.round((alert.newPrice - alert.oldPrice) / alert.oldPrice * 100))}%
                      </span>
                    </div>
                  </div>
                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <a
                      href={alert.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      確認
                    </a>
                    <button
                      onClick={() => dismissAlert(alert.id)}
                      className="ml-1 w-6 h-6 flex items-center justify-center rounded-full hover:bg-black/10 dark:hover:bg-white/10 text-muted-foreground"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Filter Panel */}
      {showFilters && (
        <div className="bg-card border-b border-border shadow-sm">
          <div className="container py-5">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">キーワード</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="商品名・素材・状態..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">サイズ</label>
                <div className="flex flex-wrap gap-1.5">
                  <Button variant={!selectedSize ? 'default' : 'outline'} size="sm" onClick={() => setSelectedSize(null)} className="text-xs h-7 px-3">すべて</Button>
                  {uniqueSizes.map((s) => (
                    <Button key={s} variant={selectedSize === s ? 'default' : 'outline'} size="sm" onClick={() => setSelectedSize(s)} className="text-xs h-7 px-3">{s}</Button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">タイプ</label>
                <div className="flex flex-wrap gap-1.5">
                  <Button variant={!selectedType ? 'default' : 'outline'} size="sm" onClick={() => setSelectedType(null)} className="text-xs h-7 px-3">すべて</Button>
                  {uniqueTypes.map((t) => (
                    <Button key={t} variant={selectedType === t ? 'default' : 'outline'} size="sm" onClick={() => setSelectedType(t)} className="text-xs h-7 px-3">{t}</Button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">サイト</label>
                <div className="flex flex-wrap gap-1.5">
                  <Button variant={!selectedSite ? 'default' : 'outline'} size="sm" onClick={() => setSelectedSite(null)} className="text-xs h-7 px-3">すべて</Button>
                  {uniqueSites.map((s) => (
                    <Button key={s} variant={selectedSite === s ? 'default' : 'outline'} size="sm" onClick={() => setSelectedSite(s)} className="text-xs h-7 px-3">{s}</Button>
                  ))}
                </div>
              </div>
            </div>

            {/* Color Filter Row */}
            <div className="mt-5 pt-5 border-t border-border">
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">色</label>
              <div className="flex flex-wrap gap-1.5">
                <Button variant={!selectedColor ? 'default' : 'outline'} size="sm" onClick={() => setSelectedColor(null)} className="text-xs h-7 px-3">すべて</Button>
                {uniqueColors.map((c) => (
                  <Button key={c} variant={selectedColor === c ? 'default' : 'outline'} size="sm" onClick={() => setSelectedColor(c)} className="text-xs h-7 px-3">{c}</Button>
                ))}
              </div>
            </div>

            {/* Price Range Filter Row */}
            <div className="mt-5 pt-5 border-t border-border">
              <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">価格帯</label>
              <div className="flex flex-wrap gap-1.5">
                <Button variant={selectedPriceRange === null ? 'default' : 'outline'} size="sm" onClick={() => setSelectedPriceRange(null)} className="text-xs h-7 px-3">すべて</Button>
                {PRICE_RANGES.map((range, idx) => (
                  <Button key={idx} variant={selectedPriceRange === idx ? 'default' : 'outline'} size="sm" onClick={() => setSelectedPriceRange(idx)} className="text-xs h-7 px-3">{range.label}</Button>
                ))}
              </div>
            </div>

            {hasFilters && (
              <div className="mt-4 flex items-center gap-2 flex-wrap">
                <span className="text-xs text-muted-foreground">適用中:</span>
                {selectedSize && <Badge variant="secondary" className="gap-1">{selectedSize} <X className="w-3 h-3 cursor-pointer" onClick={() => setSelectedSize(null)} /></Badge>}
                {selectedType && <Badge variant="secondary" className="gap-1">{selectedType} <X className="w-3 h-3 cursor-pointer" onClick={() => setSelectedType(null)} /></Badge>}
                {selectedSite && <Badge variant="secondary" className="gap-1">{selectedSite} <X className="w-3 h-3 cursor-pointer" onClick={() => setSelectedSite(null)} /></Badge>}
                {selectedColor && <Badge variant="secondary" className="gap-1">{selectedColor} <X className="w-3 h-3 cursor-pointer" onClick={() => setSelectedColor(null)} /></Badge>}
                {selectedPriceRange !== null && <Badge variant="secondary" className="gap-1">{PRICE_RANGES[selectedPriceRange].label} <X className="w-3 h-3 cursor-pointer" onClick={() => setSelectedPriceRange(null)} /></Badge>}
                <button onClick={clearFilters} className="text-xs text-primary hover:underline ml-1">すべてクリア</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Stats + Sort Bar */}
      <div className="container py-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          {/* Stats */}
          <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
            {uniqueSites.map((site, i) => (
              <span key={site} className="flex items-center gap-1">
                {i > 0 && <span className="text-border mr-1">|</span>}
                {site}:
                <strong className="text-foreground ml-1">
                  {filteredProducts.filter(p => p.site === site).length}件
                </strong>
              </span>
            ))}
            <span className="text-border">|</span>
            <span className="text-xs text-muted-foreground">最終更新: {new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })} (全{(birkinData as BirkinProduct[]).length}件)</span>
          </div>

          {/* Sort Buttons */}
          <div className="flex items-center gap-1.5">
            <ArrowUpDown className="w-4 h-4 text-muted-foreground mr-1" />
            {sortButtons.map(({ key, label, icon }) => (
              <button
                key={key}
                onClick={() => setSortKey(key)}
                className={`flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-full border transition-all duration-200 ${
                  sortKey === key
                    ? 'sort-btn-active'
                    : 'border-border text-muted-foreground hover:border-primary hover:text-primary bg-transparent'
                }`}
              >
                {icon}
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Favorites Only Banner */}
      {showFavoritesOnly && (
        <div className="container pb-2">
          <div className="flex items-center gap-2 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 rounded-lg px-4 py-2.5">
            <Heart className="w-4 h-4 text-rose-500 fill-current flex-shrink-0" />
            <span className="text-sm text-rose-700 dark:text-rose-300 font-medium">
              お気に入り商品のみ表示中
            </span>
            <button
              onClick={() => setShowFavoritesOnly(false)}
              className="ml-auto text-xs text-rose-500 hover:text-rose-700 dark:hover:text-rose-300 font-medium"
            >
              解除
            </button>
          </div>
        </div>
      )}

      {/* Products Grid */}
      <main className="container pb-16">
        {filteredProducts.length > 0 ? (
          <div className={`grid gap-5 ${
            mobileColumns === 2
              ? 'grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
              : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
          }`}>
            {filteredProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                isNew={product.id >= NEW_THRESHOLD}
                isFav={isFavorite(product.id)}
                onToggleFav={() => toggleFavorite(product.id)}
                isCompact={mobileColumns === 2}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-24">
            {showFavoritesOnly ? (
              <>
                <Heart className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
                <p className="text-muted-foreground text-lg">お気に入りに登録された商品がありません</p>
                <p className="text-muted-foreground/60 text-sm mt-2">商品カードのハートアイコンをクリックしてお気に入りに追加できます</p>
                <Button variant="outline" onClick={() => setShowFavoritesOnly(false)} className="mt-4">すべての商品を表示</Button>
              </>
            ) : (
              <>
                <p className="text-muted-foreground text-lg">該当する商品が見つかりませんでした</p>
                <p className="text-muted-foreground/60 text-sm mt-2">検索条件を変更してお試しください</p>
                <Button variant="outline" onClick={clearFilters} className="mt-4">フィルターをリセット</Button>
              </>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-card/50 py-6 text-center text-xs text-muted-foreground">
        <p>© 2026 HERMÈS BIRKIN Inventory Search. 毎日午前9時に自動更新されます。</p>
      </footer>
    </div>
  );
}
