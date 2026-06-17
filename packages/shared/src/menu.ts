export const FILLINGS = ['Veg', 'Paneer', 'Cheese Corn', 'Platter'] as const;

export const PREPARATIONS = [
  'Steam',
  'Fry',
  'Creamy',
  'Creamy Fry',
  'Nepalese Kothey',
  'Pan Fried Gravy',
] as const;

export const FULL_PRICES: number[][] = [
  [89, 109, 129, 109],
  [109, 129, 149, 129],
  [129, 129, 149, 129],
  [129, 149, 169, 149],
  [129, 139, 149, 139],
  [139, 149, 159, 149],
];

export const HALF_PRICES: number[][] = [
  [50, 60, 70, 60],
  [60, 70, 80, 70],
  [60, 70, 80, 70],
  [70, 80, 90, 80],
  [70, 75, 80, 75],
  [75, 80, 85, 80],
];

export interface MenuItem {
  id: number;
  filling: string;
  preparation: string;
  displayName: string;
  fullPrice: number;
  halfPrice: number;
}

export function buildMenu(): MenuItem[] {
  const items: MenuItem[] = [];
  let id = 1;
  PREPARATIONS.forEach((prep, pi) => {
    FILLINGS.forEach((fill, fi) => {
      items.push({
        id: id++,
        filling: fill,
        preparation: prep,
        displayName: fill,
        fullPrice: FULL_PRICES[pi][fi],
        halfPrice: HALF_PRICES[pi][fi],
      });
    });
  });
  return items;
}

export function computeHalfPrice(fullPrice: number): number {
  return Math.round((fullPrice + 11) / 2);
}
