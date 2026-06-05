/**
 * 포트폴리오 시뮬레이터 (기능 ⑤ 하락장 / ⑥ 적립식 백테스트).
 * - DCA: 과거에 매달 정액 적립했다면 지금 얼마가 됐을지 실데이터로 계산.
 * - 하락장: 이 바구니를 그냥 들고 있었을 때 최악의 고점→저점 낙폭(%)과 회복기간.
 *
 * ⚠️ 수익률 계산은 수정종가(adjclose, 배당 재투자 반영)로 한다. 세금·비용은
 *    이 모듈 밖(costs.ts)에서 per-asset breakdown에 적용한다.
 * ⚠️ 과거 성과는 미래를 보장하지 않는다.
 */
import { dailyReturns, annualizedVol } from "./stats";
import { drawdownProfile, type DrawdownProfile } from "./recovery";

export type SimAsset = {
  symbol: string;
  name: string;
  market: "KR" | "US";
  weight: number; // 정규화 전 비중(상대값이면 됨)
  hist: { date: string; close: number; adjclose: number }[];
};

/** 세후 계산(costs.ts)에 넘길 자산별 원금·평가액·추정배당 */
export type AssetBreakdown = {
  symbol: string;
  market: "KR" | "US";
  invested: number; // 이 자산에 들어간 원금
  finalValue: number; // 세전 평가액(배당 재투자 포함)
  dividends: number; // 추정 배당 합계(수정종가 vs 종가 차이로 근사)
};

export type SimResult = {
  start: string;
  end: string;
  months: number;
  monthly: number;
  initial: number;
  invested: number; // 원금 합계
  finalValue: number; // 현재 평가액(세전, 배당 재투자 포함)
  profit: number;
  returnPct: number; // 원금 대비 수익률(세전)
  dividends: number; // 추정 배당 합계
  worstDrawdown: number; // 바구니 매수후보유 최악 낙폭 (음수)
  recovery: DrawdownProfile; // 회복기간 등 낙폭 프로파일
  basketVol: number; // 바구니 연환산 변동성
  assets: AssetBreakdown[]; // 세후 계산용 자산별 분해
  series: { date: string; value: number; invested: number }[];
  monthlySeries: { date: string; value: number; invested: number; months: number }[];
};

export function simulatePortfolio(
  assets: SimAsset[],
  opts: { monthly: number; years: number; initial?: number },
): SimResult | null {
  const monthly = opts.monthly;
  const initial = Math.max(0, opts.initial ?? 0);
  const usable = assets.filter((a) => a.hist.length >= 60);
  if (usable.length === 0) return null;

  // 1) 공통 거래일 교집합 (한국·미국 거래일이 달라서). 수정종가+종가를 함께 보관.
  const maps = usable.map(
    (a) => new Map(a.hist.map((h) => [h.date, { adj: h.adjclose, raw: h.close }])),
  );
  let dates = usable[0].hist.map((h) => h.date);
  for (let i = 1; i < maps.length; i++) dates = dates.filter((d) => maps[i].has(d));
  dates.sort();

  // 기간 제한 (최근 years년)
  const cutoff = new Date(Date.now() - opts.years * 365 * 86400000).toISOString().slice(0, 10);
  dates = dates.filter((d) => d >= cutoff);
  if (dates.length < 30) return null;

  // 2) 비중 정규화
  const wsum = usable.reduce((s, a) => s + (a.weight > 0 ? a.weight : 0), 0) || usable.length;
  const weights = usable.map((a) => (a.weight > 0 ? a.weight : 1) / wsum);

  // 3) 바구니 매수후보유 지수(수정종가) → 변동성·낙폭 프로파일
  const basketIndex: number[] = [1];
  for (let t = 1; t < dates.length; t++) {
    let r = 0;
    for (let k = 0; k < usable.length; k++) {
      const p0 = maps[k].get(dates[t - 1])!.adj;
      const p1 = maps[k].get(dates[t])!.adj;
      if (p0 > 0) r += weights[k] * (p1 / p0 - 1);
    }
    basketIndex.push(basketIndex[t - 1] * (1 + r));
  }
  const basketVol = annualizedVol(dailyReturns(basketIndex));
  const recovery = drawdownProfile(basketIndex, dates);

  // 4) 적립식(DCA): 매달 첫 거래일에 monthly를 비중대로 매수.
  //    수정종가로 산 "총수익 평가액"과 종가로 산 "가격만 평가액"을 함께 추적해
  //    그 차이를 배당 기여분으로 근사(자산별).
  const unitsAdj = new Array(usable.length).fill(0);
  const unitsRaw = new Array(usable.length).fill(0);
  const investedPer = new Array(usable.length).fill(0);
  let invested = 0;
  let months = 0;
  let prevMonth = "";
  const series: { date: string; value: number; invested: number }[] = [];
  const monthlySeries: { date: string; value: number; invested: number; months: number }[] = [];

  if (initial > 0) {
    invested += initial;
    for (let k = 0; k < usable.length; k++) {
      const cell = maps[k].get(dates[0])!;
      const buy = initial * weights[k];
      investedPer[k] += buy;
      if (cell.adj > 0) unitsAdj[k] += buy / cell.adj;
      if (cell.raw > 0) unitsRaw[k] += buy / cell.raw;
    }
  }

  for (let t = 0; t < dates.length; t++) {
    const ym = dates[t].slice(0, 7);
    let boughtThisMonth = false;
    if (ym !== prevMonth) {
      prevMonth = ym;
      months++;
      boughtThisMonth = true;
      invested += monthly;
      for (let k = 0; k < usable.length; k++) {
        const cell = maps[k].get(dates[t])!;
        const buy = monthly * weights[k];
        investedPer[k] += buy;
        if (cell.adj > 0) unitsAdj[k] += buy / cell.adj;
        if (cell.raw > 0) unitsRaw[k] += buy / cell.raw;
      }
    }
    let value = 0;
    for (let k = 0; k < usable.length; k++) value += unitsAdj[k] * maps[k].get(dates[t])!.adj;
    series.push({ date: dates[t], value, invested });
    if (boughtThisMonth) monthlySeries.push({ date: dates[t], value, invested, months });
  }

  // 자산별 최종 평가액·배당 추정
  const lastDate = dates[dates.length - 1];
  const assetsBreakdown: AssetBreakdown[] = usable.map((a, k) => {
    const cell = maps[k].get(lastDate)!;
    const finalAdj = unitsAdj[k] * cell.adj; // 총수익(배당 재투자 포함)
    const finalRaw = unitsRaw[k] * cell.raw; // 가격만
    const dividends = Math.max(0, finalAdj - finalRaw); // 배당 기여분 근사
    return { symbol: a.symbol, market: a.market, invested: investedPer[k], finalValue: finalAdj, dividends };
  });

  const finalValue = series[series.length - 1].value;
  const profit = finalValue - invested;
  const dividends = assetsBreakdown.reduce((s, a) => s + a.dividends, 0);

  // 차트용 다운샘플 (~120포인트)
  const stride = Math.max(1, Math.floor(series.length / 120));
  const sampled = series.filter((_, i) => i % stride === 0 || i === series.length - 1);

  return {
    start: dates[0],
    end: dates[dates.length - 1],
    months,
    monthly,
    initial,
    invested,
    finalValue,
    profit,
    returnPct: invested > 0 ? profit / invested : 0,
    dividends,
    worstDrawdown: recovery.worstDrawdown,
    recovery,
    basketVol,
    assets: assetsBreakdown,
    series: sampled,
    monthlySeries,
  };
}
