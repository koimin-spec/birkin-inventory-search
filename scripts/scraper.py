"""
エルメス バーキン クロコダイル 在庫検索スクレイパー（最終版）
Playwright使用でCAPTCHA回避
対応サイト: Yahoo!ショッピング, 楽天市場, メルカリ, eBay
"""
import asyncio
import json
import re
import time
from datetime import datetime
from urllib.parse import quote
from playwright.async_api import async_playwright
import requests
from bs4 import BeautifulSoup

PLAYWRIGHT_ARGS = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--no-zygote',
]

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
}

# ========== Yahoo!ショッピング ==========
def scrape_yahoo_shopping(query='エルメス バーキン クロコダイル', max_items=20):
    """Yahoo!ショッピングから商品データを取得"""
    results = []
    seen = set()
    
    url = f'https://shopping.yahoo.co.jp/search?p={quote(query)}&sort=end&num=40'
    
    try:
        resp = requests.get(url, headers=HEADERS, timeout=15)
        if resp.status_code != 200:
            print(f'Yahoo! error: {resp.status_code}')
            return results
        
        soup = BeautifulSoup(resp.content, 'html.parser')
        
        # SearchResultItem要素を取得
        items = soup.select('div[class*="SearchResultItem__mJ7vY"]')
        
        for item in items[:max_items]:
            try:
                # 商品名リンクを取得（テキストが長いもの）
                name_link = None
                for a in item.find_all('a', href=True):
                    href = a.get('href', '')
                    text = a.get_text(strip=True)
                    if 'store.shopping.yahoo.co.jp' in href and len(text) > 20:
                        name_link = a
                        break
                
                if not name_link:
                    continue
                
                href = name_link.get('href', '').split('?')[0]
                if href in seen:
                    continue
                seen.add(href)
                
                name = name_link.get_text(strip=True)
                if not name:
                    continue
                
                # 価格
                price_el = item.select_one('[class*="Price"], [class*="price"]')
                price = ''
                if price_el:
                    price_text = price_el.get_text(strip=True)
                    price_match = re.search(r'([\d,]+)円', price_text)
                    if price_match:
                        price = price_match.group(0)
                
                # 画像
                img = item.find('img')
                img_url = img.get('src', '') if img else ''
                
                results.append({
                    'source': 'Yahoo!ショッピング',
                    'name': name,
                    'price': price,
                    'href': href,
                    'img': img_url,
                    'currency': 'JPY',
                })
                
            except Exception as e:
                continue
        
    except Exception as e:
        print(f'Yahoo! exception: {e}')
    
    print(f'Yahoo!ショッピング: {len(results)}件')
    return results


# ========== 楽天市場 ==========
async def scrape_rakuten(query='エルメス バーキン クロコダイル', max_items=20):
    """楽天市場から商品データを取得（Playwright使用）"""
    results = []
    seen = set()
    
    url = f'https://search.rakuten.co.jp/search/mall/{quote(query)}/?s=6'
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, args=PLAYWRIGHT_ARGS)
        context = await browser.new_context(
            user_agent=HEADERS['User-Agent'],
            locale='ja-JP',
        )
        page = await context.new_page()
        await page.add_init_script('Object.defineProperty(navigator, "webdriver", {get: () => undefined})')
        
        try:
            await page.goto(url, timeout=30000)
            await asyncio.sleep(3)
            
            html = await page.evaluate('document.documentElement.outerHTML')
            soup = BeautifulSoup(html, 'html.parser')
            
            cards = soup.select('div.dui-card.searchresultitem')
            
            for card in cards[:max_items]:
                try:
                    # 商品名リンク
                    title_link = None
                    for a in card.find_all('a', href=True):
                        href = a.get('href', '')
                        text = a.get_text(strip=True)
                        if 'item.rakuten.co.jp' in href and len(text) > 10:
                            title_link = a
                            break
                    
                    if not title_link:
                        # 画像リンクから取得
                        for a in card.find_all('a', href=True):
                            href = a.get('href', '')
                            if 'item.rakuten.co.jp' in href:
                                title_link = a
                                break
                    
                    if not title_link:
                        continue
                    
                    href = title_link.get('href', '').split('?')[0]
                    if href in seen:
                        continue
                    seen.add(href)
                    
                    # 商品名（テキストが長いリンクから取得）
                    name = ''
                    for a in card.find_all('a', href=True):
                        text = a.get_text(strip=True)
                        if 'item.rakuten.co.jp' in a.get('href', '') and len(text) > len(name):
                            name = text
                    
                    if not name:
                        # タイトル要素から取得
                        title_el = card.select_one('[class*="title"]')
                        if title_el:
                            name = title_el.get_text(strip=True)
                    
                    if not name:
                        continue
                    
                    # 価格
                    price_el = card.select_one('[class*="price"]')
                    price = ''
                    if price_el:
                        price_text = price_el.get_text(strip=True)
                        price_match = re.search(r'([\d,]+)円', price_text)
                        if price_match:
                            price = price_match.group(0)
                    
                    # 画像
                    img = card.find('img')
                    img_url = img.get('src', '') if img else ''
                    
                    results.append({
                        'source': '楽天市場',
                        'name': name,
                        'price': price,
                        'href': href,
                        'img': img_url,
                        'currency': 'JPY',
                    })
                    
                except Exception as e:
                    continue
            
        except Exception as e:
            print(f'楽天市場 exception: {e}')
        finally:
            await browser.close()
    
    print(f'楽天市場: {len(results)}件')
    return results


# ========== メルカリ ==========
async def scrape_mercari(query='バーキン クロコダイル', max_items=20):
    """メルカリから商品データを取得（Playwright使用）"""
    results = []
    seen = set()
    
    url = f'https://jp.mercari.com/search?keyword={quote(query)}&order=created_time&sort=desc&status=on_sale'
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True, args=PLAYWRIGHT_ARGS)
        context = await browser.new_context(
            user_agent=HEADERS['User-Agent'],
            locale='ja-JP',
        )
        page = await context.new_page()
        await page.add_init_script('Object.defineProperty(navigator, "webdriver", {get: () => undefined})')
        
        try:
            await page.goto(url, timeout=30000)
            await asyncio.sleep(8)  # SPAのため長めに待機
            
            # JavaScriptで商品データを取得
            items_data = await page.evaluate('''
                () => {
                    const cells = document.querySelectorAll('[data-testid="item-cell"]');
                    return Array.from(cells).map(cell => {
                        const link = cell.querySelector('a[href]');
                        const div = cell.querySelector('[aria-label]');
                        const img = cell.querySelector('img');
                        return {
                            href: link ? link.getAttribute('href') : '',
                            ariaLabel: div ? div.getAttribute('aria-label') : '',
                            img: img ? img.getAttribute('src') : '',
                        };
                    });
                }
            ''')
            
            for item in items_data:
                try:
                    href = item.get('href', '')
                    if not href or href in seen:
                        continue
                    seen.add(href)
                    
                    if href.startswith('/'):
                        href = 'https://jp.mercari.com' + href
                    
                    aria_label = item.get('ariaLabel', '')
                    name = ''
                    price = ''
                    
                    if aria_label:
                        name_match = re.match(r'^(.+?)の画像', aria_label)
                        if name_match:
                            name = name_match.group(1).strip()
                        price_match = re.search(r'の画像\s*([\d,]+)円', aria_label)
                        if price_match:
                            price = price_match.group(1) + '円'
                    
                    # バーキンを含む商品のみ
                    if not name or ('バーキン' not in name and 'birkin' not in name.lower()):
                        continue
                    
                    results.append({
                        'source': 'メルカリ',
                        'name': name,
                        'price': price,
                        'href': href,
                        'img': item.get('img', ''),
                        'currency': 'JPY',
                    })
                    
                    if len(results) >= max_items:
                        break
                    
                except Exception as e:
                    continue
            
        except Exception as e:
            print(f'メルカリ exception: {e}')
        finally:
            await browser.close()
    
    print(f'メルカリ: {len(results)}件')
    return results


# ========== eBay ==========
def parse_ebay_cards(html, seen):
    """EBayのHTMLから商品データを抽出"""
    results = []
    soup = BeautifulSoup(html, 'html.parser')
    cards = soup.select('li.s-card')
    
    for card in cards:
        try:
            product_link = None
            for a in card.find_all('a', href=True):
                href = a.get('href', '')
                if 'ebay.com/itm/' in href and '123456' not in href:
                    product_link = a
                    break
            
            if not product_link:
                continue
            
            href = product_link.get('href', '').split('?')[0]
            if href in seen:
                continue
            seen.add(href)
            
            title_el = card.select_one('.s-card__title')
            name = title_el.get_text(strip=True) if title_el else ''
            name = re.sub(r'Opens in a new window or tab', '', name).strip()
            
            if not name or 'birkin' not in name.lower():
                continue
            
            price_el = card.select_one('.s-card__price')
            price = price_el.get_text(strip=True) if price_el else ''
            
            img = card.find('img')
            img_url = img.get('src', '') if img else ''
            
            results.append({
                'source': 'eBay',
                'name': name,
                'price': price,
                'href': href,
                'img': img_url,
                'currency': 'USD',
            })
        except Exception:
            continue
    
    return results, len(cards)


async def scrape_ebay_multi(queries=None, max_items=120, max_pages=2):
    """EBayから複数クエリ・複数ページで商品データを取得（Playwright使用）
    1つのブラウザコンテキストで全クエリを処理し、メモリ使用量を削減"""
    if queries is None:
        queries = [
            'hermes birkin crocodile',
            'hermes birkin porosus',
            'hermes birkin exotic leather',
            'hermes birkin alligator',
        ]
    
    all_results = []
    seen = set()
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=PLAYWRIGHT_ARGS + ['--disable-extensions', '--single-process'],
        )
        context = await browser.new_context(
            user_agent=HEADERS['User-Agent'],
            locale='en-US',
        )
        page = await context.new_page()
        await page.add_init_script('Object.defineProperty(navigator, "webdriver", {get: () => undefined})')
        
        try:
            # 最初にトップページでCookie取得
            await page.goto('https://www.ebay.com/', timeout=30000)
            await asyncio.sleep(2)
            
            for query in queries:
                print(f'  eBay検索: "{query}"')
                for page_num in range(1, max_pages + 1):
                    # Worldwideフィルター + 60件表示
                    url = f'https://www.ebay.com/sch/i.html?_nkw={quote(query)}&_sop=10&_ipg=60&LH_PrefLoc=2'
                    if page_num > 1:
                        url += f'&_pgn={page_num}'
                    
                    try:
                        await page.goto(url, timeout=30000)
                        await asyncio.sleep(3)
                        
                        html = await page.evaluate('document.documentElement.outerHTML')
                        page_results, card_count = parse_ebay_cards(html, seen)
                        all_results.extend(page_results)
                        print(f'    page {page_num}: {card_count} cards -> {len(page_results)}件取得 (累計: {len(all_results)}件)')
                        
                        if card_count < 10:
                            break
                    except Exception as e:
                        print(f'    page {page_num} error: {e}')
                        break
                    
                    await asyncio.sleep(1)
        except Exception as e:
            print(f'eBay exception: {e}')
        finally:
            await browser.close()
    
    print(f'eBay合計: {len(all_results)}件')
    return all_results


def deduplicate(items):
    """URLをキーにして重複を除去"""
    seen = set()
    result = []
    for item in items:
        key = item.get('href', '').split('?')[0]
        if key and key not in seen:
            seen.add(key)
            result.append(item)
    return result


# ========== メイン ==========
async def main():
    print(f'スクレイピング開始: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}')
    
    # === クロコダイル検索 ===
    yahoo_croco = scrape_yahoo_shopping('エルメス バーキン クロコダイル')
    rakuten_croco = scrape_rakuten('エルメス バーキン クロコダイル')
    mercari_croco = scrape_mercari('バーキン クロコダイル')
    
    # eBay: 複数クエリ + Worldwide + ページネーション対応
    ebay_all = scrape_ebay_multi(
        queries=[
            'hermes birkin crocodile',
            'hermes birkin porosus',
            'hermes birkin exotic leather',
            'hermes birkin alligator',
            'hermes birkin special order',
        ],
        max_items=120,
        max_pages=2,
    )
    
    croco_rakuten, croco_mercari, ebay_results_raw = await asyncio.gather(
        rakuten_croco, mercari_croco, ebay_all
    )
    
    # === パーソナルオーダー検索 ===
    print('\n--- パーソナルオーダー検索 ---')
    yahoo_po = scrape_yahoo_shopping('エルメス バーキン パーソナルオーダー')
    rakuten_po = scrape_rakuten('エルメス バーキン パーソナルオーダー')
    mercari_po = scrape_mercari('バーキン パーソナルオーダー')
    
    po_rakuten, po_mercari = await asyncio.gather(
        rakuten_po, mercari_po
    )
    
    # 統合・重複除去
    yahoo_results = deduplicate(yahoo_croco + yahoo_po)
    rakuten_results = deduplicate(croco_rakuten + po_rakuten)
    mercari_results = deduplicate(croco_mercari + po_mercari)
    ebay_results = deduplicate(ebay_results_raw)
    
    all_results = yahoo_results + rakuten_results + mercari_results + ebay_results
    
    print(f'\n合計: {len(all_results)}件')
    print(f'  Yahoo!ショッピング: {len(yahoo_results)}件')
    print(f'  楽天市場: {len(rakuten_results)}件')
    print(f'  メルカリ: {len(mercari_results)}件')
    print(f'  eBay: {len(ebay_results)}件')
    
    # JSONに保存
    output = {
        'updated_at': datetime.now().isoformat(),
        'total': len(all_results),
        'items': all_results,
    }
    
    import os
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(script_dir)
    output_file = os.path.join(project_root, 'src', 'data', 'inventory_data.json')
    os.makedirs(os.path.dirname(output_file), exist_ok=True)
    
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    
    print(f'\nJSONに保存しました: {output_file}')
    
    # サンプル表示
    for r in all_results[:5]:
        print(f'\n[{r["source"]}] {r["name"][:60]}')
        print(f'  価格: {r["price"]}')
        print(f'  URL: {r["href"][:80]}')
    
    return all_results


if __name__ == '__main__':
    asyncio.run(main())
