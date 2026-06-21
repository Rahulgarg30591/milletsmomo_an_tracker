export function formatQuantity(qty: number): string {
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
