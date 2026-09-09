export const FILLINGS = ['Veg', 'Paneer', 'Cheese Corn', 'Platter'] as const;

export const PREPARATIONS = [
  'Steam',
  'Fry',
  'Creamy',
  'Creamy Fry',
  'Nepalese Kothey',
  'Pan Fried Gravy',
  'Fried Peri Peri',
] as const;

export const FULL_PRICES: number[][] = [
  [89, 109, 129, 109],
  [109, 129, 149, 129],
  [129, 129, 149, 129],
  [129, 149, 169, 149],
  [129, 139, 149, 139],
  [139, 149, 159, 149],
  [129, 149, 169, 149],
];

export const HALF_PRICES: number[][] = [
  [50, 60, 70, 60],
  [60, 70, 80, 70],
  [60, 70, 80, 70],
  [70, 80, 90, 80],
  [70, 75, 80, 75],
  [75, 80, 85, 80],
  [70, 80, 90, 80],
];

export interface MenuItem {
  id: number;
  filling: string;
  preparation: string;
  displayName: string;
  fullPrice: number;
  halfPrice: number;
  /** Sold by the unit at a flat price, with no plate/half concept. */
  isBeverage?: boolean;
}

/**
 * Category name for beverages. Deliberately kept out of `PREPARATIONS`, which
 * drives momo-only logic (plate counts, stock, minimum sale value).
 */
export const BEVERAGE_CATEGORY = 'Beverages';

export const BEVERAGES: { name: string; price: number }[] = [
  { name: 'Cold Drink', price: 10 },
  { name: 'Water', price: 10 },
];

export function buildMenu(): MenuItem[] {
  const items: MenuItem[] = [];
  let id = 1;
  PREPARATIONS.forEach((prep, pi) => {
    FILLINGS.forEach((fill, fi) => {
      items.push({
        id: id++,
        filling: fill,
        preparation: prep,
        displayName: `${fill} ${prep}`,
        fullPrice: FULL_PRICES[pi][fi],
        halfPrice: HALF_PRICES[pi][fi],
      });
    });
  });
  // Appended last so momo ids stay stable; these ids are the MenuItems.id
  // values that OrderItems.menu_item_id points at.
  BEVERAGES.forEach((bev) => {
    items.push({
      id: id++,
      filling: bev.name,
      preparation: BEVERAGE_CATEGORY,
      displayName: bev.name,
      fullPrice: bev.price,
      halfPrice: bev.price,
      isBeverage: true,
    });
  });
  return items;
}
