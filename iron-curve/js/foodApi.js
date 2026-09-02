// Live food lookup via the free, keyless Open Food Facts API, with local caching
// and an offline fallback dataset so nutrition tracking still works without a network.
import { state, save } from './store.js';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

// A categorized, browsable catalogue that works fully offline — covers plain
// whole foods plus common pub/takeaway dishes (which rarely show up as
// barcoded products on Open Food Facts, since they're prepared meals rather
// than packaged goods). Values are per-100g estimates for a typical
// preparation, not lab-measured — close enough for tracking, not exact.
export const CATALOGUE = [
  {
    category: 'Protein',
    items: [
      { name: 'Chicken Breast, raw', per100g: { cal: 120, protein: 22.5, carbs: 0, fat: 2.6 } },
      { name: 'Chicken Thigh, raw', per100g: { cal: 177, protein: 17, carbs: 0, fat: 12 } },
      { name: 'Salmon, raw', per100g: { cal: 208, protein: 20, carbs: 0, fat: 13 } },
      { name: 'Tuna, canned in water', per100g: { cal: 116, protein: 26, carbs: 0, fat: 1 } },
      { name: 'Egg, whole', per100g: { cal: 143, protein: 12.6, carbs: 0.7, fat: 9.5 } },
      { name: 'Egg White', per100g: { cal: 52, protein: 10.9, carbs: 0.7, fat: 0.2 } },
      { name: 'Ground Beef 90/10, raw', per100g: { cal: 176, protein: 20, carbs: 0, fat: 10 } },
      { name: 'Whey Protein Powder', per100g: { cal: 400, protein: 80, carbs: 8, fat: 6.5 } },
    ],
  },
  {
    category: 'Carbs & Grains',
    items: [
      { name: 'Oats, dry', per100g: { cal: 389, protein: 16.9, carbs: 66, fat: 6.9 } },
      { name: 'White Rice, cooked', per100g: { cal: 130, protein: 2.7, carbs: 28, fat: 0.3 } },
      { name: 'Brown Rice, cooked', per100g: { cal: 123, protein: 2.7, carbs: 25.6, fat: 1 } },
      { name: 'Pasta, cooked', per100g: { cal: 158, protein: 5.8, carbs: 30.9, fat: 0.9 } },
      { name: 'White Bread', per100g: { cal: 265, protein: 9, carbs: 49, fat: 3.2 } },
      { name: 'Potato, baked', per100g: { cal: 93, protein: 2.5, carbs: 21, fat: 0.1 } },
      { name: 'Sweet Potato, baked', per100g: { cal: 90, protein: 2, carbs: 21, fat: 0.1 } },
    ],
  },
  {
    category: 'Dairy',
    items: [
      { name: 'Greek Yogurt, plain nonfat', per100g: { cal: 59, protein: 10.2, carbs: 3.6, fat: 0.4 } },
      { name: 'Whole Milk', per100g: { cal: 61, protein: 3.2, carbs: 4.8, fat: 3.3 } },
      { name: 'Cheddar Cheese', per100g: { cal: 403, protein: 25, carbs: 1.3, fat: 33 } },
    ],
  },
  {
    category: 'Fruit & Veg',
    items: [
      { name: 'Banana', per100g: { cal: 89, protein: 1.1, carbs: 22.8, fat: 0.3 } },
      { name: 'Apple', per100g: { cal: 52, protein: 0.3, carbs: 13.8, fat: 0.2 } },
      { name: 'Broccoli, steamed', per100g: { cal: 35, protein: 2.4, carbs: 7.2, fat: 0.4 } },
      { name: 'Avocado', per100g: { cal: 160, protein: 2, carbs: 8.5, fat: 14.7 } },
    ],
  },
  {
    category: 'Fats, Nuts & Legumes',
    items: [
      { name: 'Almonds', per100g: { cal: 579, protein: 21.2, carbs: 21.6, fat: 49.9 } },
      { name: 'Peanut Butter', per100g: { cal: 588, protein: 25, carbs: 20, fat: 50 } },
      { name: 'Olive Oil', per100g: { cal: 884, protein: 0, carbs: 0, fat: 100 } },
      { name: 'Tofu, firm', per100g: { cal: 144, protein: 15.8, carbs: 2.8, fat: 8.7 } },
      { name: 'Black Beans, cooked', per100g: { cal: 132, protein: 8.9, carbs: 23.7, fat: 0.5 } },
    ],
  },
  {
    category: 'Pub & Takeaway',
    items: [
      { name: 'Chicken Parmigiana', per100g: { cal: 200, protein: 14, carbs: 10, fat: 11 } },
      { name: 'Chips / Fries', per100g: { cal: 312, protein: 3.4, carbs: 41, fat: 15 } },
      { name: 'Hot Chips with Gravy', per100g: { cal: 180, protein: 3, carbs: 22, fat: 9 } },
      { name: 'Fish and Chips', per100g: { cal: 239, protein: 9, carbs: 24, fat: 12 } },
      { name: 'Beef Burger with Bun', per100g: { cal: 250, protein: 13, carbs: 22, fat: 12 } },
      { name: 'Meat Pie', per100g: { cal: 280, protein: 9, carbs: 24, fat: 17 } },
      { name: 'Pizza, margherita slice', per100g: { cal: 266, protein: 11, carbs: 33, fat: 10 } },
      { name: 'Chicken Schnitzel', per100g: { cal: 250, protein: 18, carbs: 14, fat: 14 } },
      { name: 'Fried Rice', per100g: { cal: 163, protein: 4, carbs: 20, fat: 7 } },
      { name: 'Butter Chicken (no rice)', per100g: { cal: 150, protein: 12, carbs: 6, fat: 9 } },
      { name: 'Pad Thai', per100g: { cal: 180, protein: 7, carbs: 24, fat: 6 } },
      { name: 'Burrito', per100g: { cal: 200, protein: 9, carbs: 24, fat: 8 } },
      { name: 'Chicken Souvlaki Wrap', per100g: { cal: 210, protein: 13, carbs: 20, fat: 9 } },
      { name: 'Doner Kebab', per100g: { cal: 230, protein: 12, carbs: 20, fat: 11 } },
      { name: 'Nachos with Cheese', per100g: { cal: 325, protein: 8, carbs: 33, fat: 18 } },
      { name: 'Chicken Wings', per100g: { cal: 290, protein: 23, carbs: 3, fat: 20 } },
      { name: 'Calamari, fried', per100g: { cal: 280, protein: 12, carbs: 20, fat: 17 } },
      { name: 'Garlic Bread', per100g: { cal: 350, protein: 8, carbs: 40, fat: 17 } },
      { name: 'Caesar Salad with Chicken', per100g: { cal: 160, protein: 10, carbs: 6, fat: 11 } },
      { name: 'Spring Rolls, fried', per100g: { cal: 220, protein: 5, carbs: 24, fat: 12 } },
    ],
  },
];

// Flattened for the offline substring-match fallback used by searchFoods().
export const COMMON_FOODS = CATALOGUE.flatMap((group) =>
  group.items.map((item) => ({ ...item, brand: '', category: group.category })));

// Full browsable catalogue, including any foods the user has saved themselves.
export function getCatalogue() {
  const groups = CATALOGUE.map((g) => ({ category: g.category, items: g.items.map((i) => ({ ...i, brand: '', source: 'catalogue' })) }));
  if (state.customFoods.length) {
    groups.push({ category: 'Your Foods', items: state.customFoods.map((f) => ({ ...f, source: 'custom' })) });
  }
  return groups;
}

function normalizeCache(query) {
  return query.trim().toLowerCase();
}

function fromCache(query) {
  const key = normalizeCache(query);
  const hit = state.foodCache[key];
  if (hit && Date.now() - hit.ts < CACHE_TTL_MS) return hit.results;
  return null;
}

function toCache(query, results) {
  const key = normalizeCache(query);
  state.foodCache[key] = { results, ts: Date.now() };
  // Keep the cache small.
  const keys = Object.keys(state.foodCache);
  if (keys.length > 60) {
    keys.sort((a, b) => state.foodCache[a].ts - state.foodCache[b].ts);
    delete state.foodCache[keys[0]];
  }
  save();
}

function mapOffProduct(p) {
  const n = p.nutriments || {};
  const cal = n['energy-kcal_100g'] ?? (n['energy_100g'] ? n['energy_100g'] / 4.184 : 0);
  return {
    id: p.code || p._id || `${p.product_name}-${Math.random()}`,
    name: p.product_name || p.generic_name || 'Unnamed product',
    brand: p.brands || '',
    per100g: {
      cal: Math.round(cal || 0),
      protein: Number((n['proteins_100g'] ?? 0).toFixed(1)),
      carbs: Number((n['carbohydrates_100g'] ?? 0).toFixed(1)),
      fat: Number((n['fat_100g'] ?? 0).toFixed(1)),
    },
    source: 'openfoodfacts',
  };
}

function offlineMatches(query) {
  const q = query.trim().toLowerCase();
  const local = [...COMMON_FOODS, ...state.customFoods].filter((f) => f.name.toLowerCase().includes(q));
  return local.map((f) => ({ ...f, id: f.id || `local-${f.name}`, source: f.source || 'offline' }));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// The OFF v2 REST search endpoint (/api/v2/search) sends CORS headers reliably,
// but it silently ignores the `search_terms` parameter and just returns an
// unfiltered product listing — useless for name search. Only the legacy
// cgi/search.pl endpoint actually does free-text relevance matching, but its
// CORS headers are inconsistent (observed ~1-in-4 requests succeed). Retrying
// several times turns that into a reliably-successful search in practice,
// while the barcode lookup below uses the (correct and reliable) v2 endpoint.
async function fetchWithRetry(url, attempts = 6) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`OFF request failed: ${res.status}`);
      return await res.json();
    } catch (e) {
      lastErr = e;
      if (i < attempts - 1) await sleep(150);
    }
  }
  throw lastErr;
}

export async function searchFoods(query) {
  if (!query || query.trim().length < 2) return [];
  const cached = fromCache(query);
  if (cached) return cached;

  try {
    const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=15&fields=code,product_name,generic_name,brands,nutriments`;
    const data = await fetchWithRetry(url);
    const mapped = (data.products || [])
      .map(mapOffProduct)
      .filter((f) => f.name !== 'Unnamed product' && (f.per100g.cal > 0 || f.per100g.protein > 0 || f.per100g.carbs > 0 || f.per100g.fat > 0));

    const results = mapped.length ? mapped : offlineMatches(query);
    toCache(query, results);
    return results;
  } catch {
    return offlineMatches(query);
  }
}

export async function lookupBarcode(code) {
  try {
    const data = await fetchWithRetry(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json`);
    if (data.status !== 1 || !data.product) return null;
    return mapOffProduct(data.product);
  } catch {
    return null;
  }
}
