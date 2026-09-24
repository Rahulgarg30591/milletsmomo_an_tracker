import type { CylinderBrand } from '../types';

export const CYLINDER_BRANDS: { brand: CylinderBrand; short: string; full: string; color: string }[] = [
  { brand: 'HP', short: 'HP', full: 'Hindustan Petroleum', color: '#DC2626' },
  { brand: 'BP', short: 'BP', full: 'Bharat Petroleum', color: '#2563EB' },
  { brand: 'INDANE', short: 'Indane', full: 'Indian Oil', color: '#EA580C' },
];

export function brandInfo(brand: CylinderBrand) {
  return CYLINDER_BRANDS.find((b) => b.brand === brand) ?? CYLINDER_BRANDS[0];
}

const LAST_PRICE_KEY = 'mm_cylinder_last_price';

/** The price last entered for a brand on this device, to prefill the next refill. */
export function getLastPrice(brand: CylinderBrand): string {
  try {
    const saved = JSON.parse(localStorage.getItem(LAST_PRICE_KEY) || '{}');
    return typeof saved[brand] === 'number' ? String(saved[brand]) : '';
  } catch {
    return '';
  }
}

export function setLastPrice(brand: CylinderBrand, amount: number): void {
  try {
    const saved = JSON.parse(localStorage.getItem(LAST_PRICE_KEY) || '{}');
    localStorage.setItem(LAST_PRICE_KEY, JSON.stringify({ ...saved, [brand]: amount }));
  } catch {
    // Prefill is a convenience; without storage the field just starts empty.
  }
}

export function formatRupees(n: number): string {
  return `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}
