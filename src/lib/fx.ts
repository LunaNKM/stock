/**
 * 원화 실질수익 분해 (기능 ②) — 한국 투자자 전용 관점.
 * 미국주식 수익을 "주가가 번 것 + 환율이 번 것"으로 쪼갠다.
 * (1+원화수익) = (1+달러주가수익) × (1+환율수익)
 */

export type FxDecomp = {
  totalKrw: number; // 원화 기준 총수익률
  stockUsd: number; // 달러 주가 수익률
  fx: number; // 환율(원/달러) 수익률
};

/**
 * @param usdCloses   해당 종목의 달러 종가 시계열(날짜 오름차순)
 * @param dates       usdCloses와 같은 길이의 날짜(YYYY-MM-DD)
 * @param fxByDate    날짜→원달러 환율 맵
 * @param lookbackDays 거래일 기준 되돌아볼 기간 (기본 63 ≈ 3개월)
 */
export function decomposeKrwReturn(
  usdCloses: number[],
  dates: string[],
  fxByDate: Map<string, number>,
  lookbackDays = 63,
): FxDecomp | null {
  if (usdCloses.length < lookbackDays + 1) return null;
  const endI = usdCloses.length - 1;
  const startI = Math.max(0, endI - lookbackDays);

  const pEnd = usdCloses[endI];
  const pStart = usdCloses[startI];
  const fxEnd = nearestFx(fxByDate, dates[endI]);
  const fxStart = nearestFx(fxByDate, dates[startI]);
  if (pStart <= 0 || fxStart == null || fxEnd == null || fxStart <= 0) return null;

  const stockUsd = pEnd / pStart - 1;
  const fx = fxEnd / fxStart - 1;
  const totalKrw = (1 + stockUsd) * (1 + fx) - 1;
  return { totalKrw, stockUsd, fx };
}

/** 주말·휴일로 정확한 날짜가 없을 수 있어 가까운 과거 환율을 찾는다. */
function nearestFx(fxByDate: Map<string, number>, date: string): number | null {
  if (fxByDate.has(date)) return fxByDate.get(date)!;
  const d = new Date(date);
  for (let i = 1; i <= 7; i++) {
    const prev = new Date(d.getTime() - i * 86400000).toISOString().slice(0, 10);
    if (fxByDate.has(prev)) return fxByDate.get(prev)!;
  }
  return null;
}
