// Live food lookup via the free, keyless Open Food Facts API, with local caching
// and an offline fallback dataset so nutrition tracking still works without a network.
import { state, save } from './store.js';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

// Small offline fallback of common whole foods (per 100g), used when the API is
// unreachable or returns nothing useful.
export const COMMON_FOODS = [
  { name: 'Chicken Breast, raw', brand: '', per100g: { cal: 120, protein: 22.5, carbs: 0, fat: 2.6 } },
  { name: 'Chicken Thigh, raw', brand: '', per100g: { cal: 177, protein: 17, carbs: 0, fat: 12 } },
  { name: 'Salmon, raw', brand: '', per100g: { cal: 208, protein: 20, carbs: 0, fat: 13 } },
  { name: 'Tuna, canned in water', brand: '', per100g: { cal: 116, protein: 26, carbs: 0, fat: 1 } },
  { name: 'Egg, whole', brand: '', per100g: { cal: 143, protein: 12.6, carbs: 0.7, fat: 9.5 } },
  { name: 'Egg White', brand: '', per100g: { cal: 52, protein: 10.9, carbs: 0.7, fat: 0.2 } },
  { name: 'Ground Beef 90/10, raw', brand: '', per100g: { cal: 176, protein: 20, carbs: 0, fat: 10 } },
  { name: 'Greek Yogurt, plain nonfat', brand: '', per100g: { cal: 59, protein: 10.2, carbs: 3.6, fat: 0.4 } },
  { name: 'Whole Milk', brand: '', per100g: { cal: 61, protein: 3.2, carbs: 4.8, fat: 3.3 } },
  { name: 'Whey Protein Powder', brand: '', per100g: { cal: 400, protein: 80, carbs: 8, fat: 6.5 } },
  { name: 'Oats, dry', brand: '', per100g: { cal: 389, protein: 16.9, carbs: 66, fat: 6.9 } },
  { name: 'White Rice, cooked', brand: '', per100g: { cal: 130, protein: 2.7, carbs: 28, fat: 0.3 } },
  { name: 'Brown Rice, cooked', brand: '', per100g: { cal: 123, protein: 2.7, carbs: 25.6, fat: 1 } },
  { name: 'Pasta, cooked', brand: '', per100g: { cal: 158, protein: 5.8, carbs: 30.9, fat: 0.9 } },
  { name: 'White Bread', brand: '', per100g: { cal: 265, protein: 9, carbs: 49, fat: 3.2 } },
  { name: 'Potato, baked', brand: '', per100g: { cal: 93, protein: 2.5, carbs: 21, fat: 0.1 } },
  { name: 'Sweet Potato, baked', brand: '', per100g: { cal: 90, protein: 2, carbs: 21, fat: 0.1 } },
  { name: 'Banana', brand: '', per100g: { cal: 89, protein: 1.1, carbs: 22.8, fat: 0.3 } },
  { name: 'Apple', brand: '', per100g: { cal: 52, protein: 0.3, carbs: 13.8, fat: 0.2 } },
  { name: 'Broccoli, steamed', brand: '', per100g: { cal: 35, protein: 2.4, carbs: 7.2, fat: 0.4 } },
  { name: 'Avocado', brand: '', per100g: { cal: 160, protein: 2, carbs: 8.5, fat: 14.7 } },
  { name: 'Almonds', brand: '', per100g: { cal: 579, protein: 21.2, carbs: 21.6, fat: 49.9 } },
  { name: 'Peanut Butter', brand: '', per100g: { cal: 588, protein: 25, carbs: 20, fat: 50 } },
  { name: 'Olive Oil', brand: '', per100g: { cal: 884, protein: 0, carbs: 0, fat: 100 } },
  { name: 'Cheddar Cheese', brand: '', per100g: { cal: 403, protein: 25, carbs: 1.3, fat: 33 } },
  { name: 'Tofu, firm', brand: '', per100g: { cal: 144, protein: 15.8, carbs: 2.8, fat: 8.7 } },
  { name: 'Black Beans, cooked', brand: '', per100g: { cal: 132, protein: 8.9, carbs: 23.7, fat: 0.5 } },
];

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

export async function searchFoods(query) {
  if (!query || query.trim().length < 2) return [];
  const cached = fromCache(query);
  if (cached) return cached;

  try {
    const url = `https://world.openfoodfacts.org/api/v2/search?search_terms=${encodeURIComponent(query)}&page_size=15&fields=code,product_name,generic_name,brands,nutriments`;
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`OFF search failed: ${res.status}`);
    const data = await res.json();
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
    const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json`);
    if (!res.ok) throw new Error('barcode lookup failed');
    const data = await res.json();
    if (data.status !== 1 || !data.product) return null;
    return mapOffProduct(data.product);
  } catch {
    return null;
  }
}
