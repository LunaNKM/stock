/**
 * 통계 분석 (순수 함수 모음)
 * 변동성·샤프지수·최대낙폭·상관관계 등 포트폴리오 위험 지표 계산.
 */

/** 일간 수익률 시계열 (close[i]/close[i-1] - 1) */
export function dailyReturns(closes: number[]): number[] {
  const r: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    r.push(closes[i] / closes[i - 1] - 1);
  }
  return r;
}

export function mean(a: number[]): number {
  if (a.length === 0) return 0;
  return a.reduce((s, x) => s + x, 0) / a.length;
}

/** 표본 표준편차 */
export function std(a: number[]): number {
  if (a.length < 2) return 0;
  const m = mean(a);
  const v = a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1);
  return Math.sqrt(v);
}

const TRADING_DAYS = 252;

/** 연환산 변동성 (일간 수익률 표준편차 × √252) */
export function annualizedVol(returns: number[]): number {
  return std(returns) * Math.sqrt(TRADING_DAYS);
}

/** 연환산 수익률 (일평균 × 252) */
export function annualizedReturn(returns: number[]): number {
  return mean(returns) * TRADING_DAYS;
}

/** 샤프지수 = (연환산수익률 − 무위험수익률) / 연환산변동성. 기본 무위험 3% */
export function sharpe(returns: number[], riskFree = 0.03): number {
  const vol = annualizedVol(returns);
  if (vol === 0) return 0;
  return (annualizedReturn(returns) - riskFree) / vol;
}

/** 최대낙폭 (Max Drawdown) — 고점 대비 최대 하락폭, 음수(예: -0.32 = -32%) */
export function maxDrawdown(closes: number[]): number {
  if (closes.length === 0) return 0;
  let peak = closes[0];
  let mdd = 0;
  for (const p of closes) {
    if (p > peak) peak = p;
    const dd = (p - peak) / peak;
    if (dd < mdd) mdd = dd;
  }
  return mdd;
}

/** 피어슨 상관계수 (-1 ~ 1) */
export function correlation(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n < 2) return 0;
  const ma = mean(a.slice(0, n));
  const mb = mean(b.slice(0, n));
  let cov = 0;
  let va = 0;
  let vb = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - ma;
    const db = b[i] - mb;
    cov += da * db;
    va += da * da;
    vb += db * db;
  }
  if (va === 0 || vb === 0) return 0;
  return cov / Math.sqrt(va * vb);
}

/**
 * 포트폴리오 집중도 (기능 ④) — "사실상 한 종목" 경고용.
 * 상관계수 행렬에서 자기 자신을 뺀 모든 쌍의 평균 상관을 구한다.
 * 1에 가까울수록 함께 움직여 분산효과가 거의 없다는 뜻.
 */
export function avgPairwiseCorrelation(matrix: number[][]): number {
  const n = matrix.length;
  if (n < 2) return 0;
  let sum = 0;
  let count = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      sum += matrix[i][j];
      count++;
    }
  }
  return count > 0 ? sum / count : 0;
}
