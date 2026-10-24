function decimal(value: string): { units: bigint; scale: number } {
  if (typeof value !== 'string' || value.length > 256 || !/^\+?\d+(\.\d+)?$/.test(value.trim())) {
    throw new Error('Holding amount must be a non-negative decimal string');
  }
  const [integer, fraction = ''] = value.trim().replace(/^\+/, '').split('.');
  return { units: BigInt(integer + fraction), scale: fraction.length };
}

/** Exact non-negative decimal addition. Never converts token amounts to floating point. */
export function sumTokenAmounts(amounts: readonly string[]): string {
  let sum = 0n;
  let scale = 0;
  for (const value of amounts) {
    const amount = decimal(value);
    const nextScale = Math.max(scale, amount.scale);
    sum = sum * (10n ** BigInt(nextScale - scale)) + amount.units * (10n ** BigInt(nextScale - amount.scale));
    scale = nextScale;
  }
  const digits = sum.toString().padStart(scale + 1, '0');
  if (!scale) return digits;
  const fraction = digits.slice(-scale).replace(/0+$/, '');
  return digits.slice(0, -scale) + (fraction ? `.${fraction}` : '');
}
