/**
 * 추천 점수 "코어 엔진" (순수 계산).
 * ----------------------------------------------------------
 * 같은 채점 로직을 (1)오늘의 추천 (2)과거 백테스트 양쪽에서 재사용하기 위해
 * recommend.ts 에서 분리했습니다. 입력은 종가/거래량 배열, 출력은 한 시점의 점수.
 *
 * 점수 100점 = 추세30 + 모멘텀20 + 안정성25 + 가격위치/밸류25.
 * (이전: 추세35+모멘텀25+안정성25+가격위치15. 추세·모멘텀에 60%가 쏠려
 *  "이미 많이 오른 종목"을 고득점시키는 고점추격 편향이 있어, 추세·모멘텀을
 *  10점 줄이고 그만큼 "싼 자리인가(가격위치/밸류)"에 실어 균형을 맞췄다.)
 *
 * ⚠️ 입력 종가는 반드시 수정종가(adjclose)를 넣는다 — 배당·분할로 인한
 *    가짜 급락/급등이 지표를 오염시키지 않도록.
 */
import { sma, rsi, macd } from "./indicators";
import { dailyReturns, annualizedVol, maxDrawdown } from "./stats";

/** 한 번만 계산해두고 모든 시점(t)에서 재사용하는 지표 배열들 */
export type Precomputed = {
  closes: number[];
  volumes: number[];
  sma20: (number | null)[];
  sma60: (number | null)[];
  sma120: (number | null)[];
  rsiArr: (number | null)[];
  macdHist: number[];
};

export function precompute(closes: number[], volumes: number[]): Precomputed {
  return {
    closes,
    volumes,
    sma20: sma(closes, 20),
    sma60: sma(closes, 60),
    sma120: sma(closes, 120),
    rsiArr: rsi(closes, 14),
    macdHist: macd(closes).histogram,
  };
}

export type ScoreAt = {
  score: number;
  price: number;
  // 채점에 쓰인 원자료 (recommend가 쉬운 말 근거를 만들 때 사용)
  s20: number | null;
  s60: number | null;
  s120: number | null;
  rsi: number | null;
  macdHist: number | null;
  volatility: number;
  maxDrawdown: number;
  return3m: number;
  pos52: number; // 52주(1년) 범위 내 현재가 위치 0~1
  pos5y: number; // 5년 가격 백분위 (0=5년 최저권, 1=5년 최고권) — 밸류 프록시
  volConfirm: boolean; // 최근 거래량이 늘며 추세에 힘을 보태는가
};

/** 시점 t(배열 인덱스)에서의 점수를 계산. t는 충분한 과거(>=120)가 있어야 의미 있음. */
export function scoreAt(pre: Precomputed, t: number): ScoreAt {
  const { closes, volumes } = pre;
  const price = closes[t];
  const s20 = pre.sma20[t];
  const s60 = pre.sma60[t];
  const s120 = pre.sma120[t];
  const rsiVal = pre.rsiArr[t];
  const macdHist = pre.macdHist[t] ?? null;

  // 트레일링 윈도우 통계
  const retWindow = dailyReturns(closes.slice(Math.max(0, t - 60), t + 1));
  const vol = annualizedVol(retWindow);
  const ddWindow = closes.slice(Math.max(0, t - 251), t + 1);
  const mdd = maxDrawdown(ddWindow);

  const idx3m = Math.max(0, t - 63);
  const return3m = closes[idx3m] > 0 ? price / closes[idx3m] - 1 : 0;

  const lo = Math.min(...ddWindow);
  const hi = Math.max(...ddWindow);
  const pos52 = hi > lo ? (price - lo) / (hi - lo) : 0.5;

  // 5년 가격 백분위(밸류 프록시): 현재가가 지난 5년 중 어느 높이인가.
  // 업종별 적정 PER 차이를 피하면서 "자기 역사 대비 싼가"를 본다.
  const win5y = closes.slice(Math.max(0, t - 1250), t + 1);
  let below = 0;
  for (const p of win5y) if (p <= price) below++;
  const pos5y = win5y.length > 1 ? below / win5y.length : 0.5;

  // 거래량 확인: 최근 5일 평균 > 직전 20일 평균이면 참여(거래량) 증가
  const v5 = avg(volumes.slice(Math.max(0, t - 4), t + 1));
  const v20 = avg(volumes.slice(Math.max(0, t - 23), t - 3 <= 0 ? 1 : t - 3));
  const volConfirm = v20 > 0 && v5 > v20;

  // ── 1) 추세 (30) ──
  let trend = 0;
  if (s20 != null && price > s20) trend += 9;
  if (s20 != null && s60 != null && s20 > s60) trend += 11;
  if (s120 != null && price > s120) trend += 10;

  // ── 2) 모멘텀 (20) = MACD 10 + RSI 8 + 거래량확인 2 ──
  let momentum = 0;
  if (macdHist != null && macdHist > 0) momentum += 10;
  if (rsiVal != null) {
    if (rsiVal >= 45 && rsiVal <= 65) momentum += 8;
    else if (rsiVal > 65 && rsiVal < 70) momentum += 5;
    else if (rsiVal >= 35 && rsiVal < 45) momentum += 5;
    else if (rsiVal >= 70) momentum += 1;
    else momentum += 3;
  }
  if (volConfirm && macdHist != null && macdHist > 0) momentum += 2;

  // ── 3) 안정성 (25) ──
  let stability = 0;
  if (vol <= 0.15) stability += 15;
  else if (vol <= 0.25) stability += 11;
  else if (vol <= 0.4) stability += 7;
  else stability += 3;
  if (mdd > -0.15) stability += 10;
  else if (mdd > -0.25) stability += 6;
  else if (mdd > -0.4) stability += 3;

  // ── 4) 가격 위치/밸류 (25) ──
  // 1년 위치(pos52)와 5년 백분위(pos5y)를 절반씩 섞어, 자기 역사 대비
  // "싼 자리"일수록 점수를 준다. 고점 추격을 억제하는 핵심 축.
  const posBlend = 0.5 * pos52 + 0.5 * pos5y;
  let position = 0;
  if (posBlend < 0.4) position += 25;
  else if (posBlend < 0.6) position += 18;
  else if (posBlend < 0.8) position += 12;
  else if (posBlend < 0.95) position += 6;
  else position += 2;

  const score = Math.round(Math.min(100, trend + momentum + stability + position));

  return {
    score, price, s20, s60, s120, rsi: rsiVal, macdHist,
    volatility: vol, maxDrawdown: mdd, return3m, pos52, pos5y, volConfirm,
  };
}

function avg(a: number[]): number {
  if (a.length === 0) return 0;
  return a.reduce((s, x) => s + x, 0) / a.length;
}
