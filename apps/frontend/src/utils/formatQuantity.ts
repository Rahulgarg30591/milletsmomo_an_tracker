/**
 * Renders an order-line quantity.
 *
 * Momo quantities are counted in pieces and read most naturally as plates of
 * six. Beverages are sold by the unit, so plate wording would be wrong — "3
 * Cold Drink" must not render as "1 plate".
 */
export function formatQuantity(qty: number, isBeverage = false): string {
  if (isBeverage) {
    return `${qty}x`;
  }

  const halfPlates = Math.floor(qty / 3);
  const plates = halfPlates / 2;
  const remainder = qty % 3;

  if (remainder === 0) {
    return `${plates} plate${plates !== 1 ? 's' : ''}`;
  }

  if (plates === 0) {
    return `${qty}x`;
  }

  return `${qty}x (${plates} plate${plates !== 1 ? 's' : ''} + ${remainder})`;
}
