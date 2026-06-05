/**
 * 변동성 조정 매수금액 (기능 ③) — 초보가 제일 못하는 "얼마 사지?"에 답.
 * 같은 금액을 똑같이 나누지 않고, 더 출렁이는 종목엔 더 적게(역변동성 가중).
 */

export type SizingInput = { symbol: string; name: string; volatility: number };
export type SizingOutput = SizingInput & { weight: number; amount: number };

/**
 * 한 그룹(예: 코어끼리, 새틀라이트끼리) 안에서 역변동성 비중을 매겨
 * budget(원)을 배분한다. 변동성 정보가 이상하면 균등 분배로 안전하게 폴백.
 */
export function inverseVolAllocation(items: SizingInput[], budget: number): SizingOutput[] {
  if (items.length === 0) return [];
  const invs = items.map((it) => {
    const v = Number.isFinite(it.volatility) && it.volatility > 0.01 ? it.volatility : 0.2;
    return 1 / v;
  });
  const sum = invs.reduce((s, x) => s + x, 0);
  return items.map((it, i) => {
    const weight = sum > 0 ? invs[i] / sum : 1 / items.length;
    return { ...it, weight, amount: Math.round(budget * weight) };
  });
}
