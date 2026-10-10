/** A deal's price: the percentage off, rounded to the cent, never below 1 cent. */
export function dealPrice(priceCents: number, percentOff: number): number {
  return Math.max(1, Math.round((priceCents * (100 - percentOff)) / 100));
}
