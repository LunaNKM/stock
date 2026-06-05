import "server-only";
import { getHistory, getFundamentals, getUsdKrw } from "./stocks";
import { getWatchlist } from "./watchlistStore";
import { precompute, scoreAt } from "./scoring";
import { backtestReliability, type Reliability } from "./backtest";
import { scoreAlpha, type Alpha } from "./alpha";
import { interpretFundamentals, type FundamentalView } from "./fundamentals";
import { decomposeKrwReturn, type FxDecomp } from "./fx";
import { inverseVolAllocation, type SizingOutput } from "./sizing";
import {
  dataQuality,
  fxHeadwind,
  realKrwAlpha,
  safetyMargin,
  scoreErrorProfile,
  type DataQuality,
  type FxHeadwind,
  type RealKrwAlpha,
  type SafetyMargin,
  type ScoreErrorProfile,
} from "./insights";
import { TARGET_CORE_PCT, TARGET_SATELLITE_PCT, MONTHLY_EXAMPLE_KRW, type Candidate } from "./watchlist";

export type Tone = "bull" | "neutral" | "bear";

export type PickInsights = {
  insights: {
    realKrwAlpha: RealKrwAlpha;
    scoreError: ScoreErrorProfile;
    fxHeadwind: FxHeadwind | null;
    safetyMargin: SafetyMargin;
    dataQuality: DataQuality;
  };
};

export type Pick = Candidate & PickInsights & {
  currency: "USD" | "KRW";
  price: number;
  score: number;
  label: string;
  tone: Tone;
  riskTag: "안정" | "보통" | "높음";
  reasons: string[];
  metrics: {
    rsi: number | null;
    volatility: number;
    maxDrawdown: number;
    return3m: number;
    pos52: number;
    pos5y: number; // 5년 가격 백분위 (밸류 프록시)
  };
  reliability: Reliability; // ① 점수 신뢰도(백테스트)
  alpha: Alpha; // ⑦ 점수 알파(무지성 적립 대비)
  fundamentals: FundamentalView; // 펀더멘털 한 줄 평가
  fx: FxDecomp | null; // ② 원화 수익 분해 (미국주식만)
};

const HISTORY_DAYS = 5 * 365; // 백테스트용으로 길게

function buildPick(
  c: Candidate,
  closes: number[], // 수정종가(adjclose) — 모든 점수·지표 계산용
  rawPrice: number, // 실제 표시 가격(분할만 반영된 종가)
  volumes: number[],
  dates: string[],
  fund: FundamentalView,
  fx: FxDecomp | null,
): Pick {
  const pre = precompute(closes, volumes);
  const s = scoreAt(pre, closes.length - 1);
  const reliability = backtestReliability(closes, volumes);
  const alpha = scoreAlpha(closes, volumes);
  const currency: "USD" | "KRW" = c.market === "KR" ? "KRW" : "USD";

  const reasons: string[] = [];
  if (s.s20 != null && s.s60 != null && s.price > s.s20 && s.s20 > s.s60) reasons.push("상승 추세(정배열)");
  else if (s.s20 != null && s.s60 != null && s.price < s.s20 && s.s20 < s.s60) reasons.push("하락 추세(역배열)");
  if (s.macdHist != null && s.macdHist > 0) reasons.push(s.volConfirm ? "오르는 힘 우세 + 거래량 증가" : "오르는 힘 우세(MACD+)");
  else reasons.push("힘이 약함(MACD−)");
  if (s.rsi != null && s.rsi >= 70) reasons.push(`단기 과열(RSI ${s.rsi.toFixed(0)}) — 추격 주의`);
  else if (s.rsi != null && s.rsi < 35) reasons.push(`단기 과매도(RSI ${s.rsi.toFixed(0)}) — 반등 가능`);
  if (s.maxDrawdown > -0.15) reasons.push("낙폭이 작아 안정적");
  if (s.volatility > 0.4) reasons.push("변동성 큼 — 비중 작게");
  if (s.pos52 < 0.5) reasons.push("52주 범위 하단 — 가격 부담 적음");
  else if (s.pos52 >= 0.95) reasons.push("52주 고점 부근 — 분할매수 권장");

  let label: string, tone: Tone;
  if (s.score >= 70) { label = "지금 분위기 좋음"; tone = "bull"; }
  else if (s.score >= 50) { label = "무난 — 분할매수 고려"; tone = "neutral"; }
  else if (s.score >= 35) { label = "관망"; tone = "neutral"; }
  else { label = "약세 — 신중히"; tone = "bear"; }

  const riskTag: Pick["riskTag"] = s.volatility <= 0.18 ? "안정" : s.volatility <= 0.3 ? "보통" : "높음";

  return {
    ...c,
    currency,
    price: rawPrice,
    score: s.score,
    label,
    tone,
    riskTag,
    reasons: reasons.slice(0, 4),
    metrics: { rsi: s.rsi, volatility: s.volatility, maxDrawdown: s.maxDrawdown, return3m: s.return3m, pos52: s.pos52, pos5y: s.pos5y },
    reliability,
    alpha,
    fundamentals: fund,
    fx,
    insights: {
      realKrwAlpha: realKrwAlpha({
        alpha,
        reliability,
        fx,
        volatility: s.volatility,
        maxDrawdown: s.maxDrawdown,
      }),
      scoreError: scoreErrorProfile(reliability),
      fxHeadwind: fxHeadwind(fx),
      safetyMargin: safetyMargin({
        pos52: s.pos52,
        pos5y: s.pos5y,
        rsi: s.rsi,
        volatility: s.volatility,
        fundamentals: fund,
      }),
      dataQuality: dataQuality({
        lastDate: dates[dates.length - 1] ?? null,
        historyDays: closes.length,
        fundamentals: fund,
      }),
    },
  };
}

export type Starter = {
  monthly: number;
  corePct: number;
  satellitePct: number;
  core: SizingOutput[];
  satellite: SizingOutput[];
};

export type Recommendations = {
  asOf: string;
  picks: Pick[];
  starter: Starter; // ③ 변동성 조정 매수금액
  failed: string[];
};

export async function buildRecommendations(): Promise<Recommendations> {
  const watchlist = await getWatchlist();
  const failed: string[] = [];
  const fxMap = await getUsdKrw(HISTORY_DAYS).catch(() => new Map<string, number>());

  const results = await Promise.all(
    watchlist.map(async (c) => {
      try {
        const hist = await getHistory(c.symbol, HISTORY_DAYS);
        if (hist.length < 60) {
          failed.push(c.symbol);
          return null;
        }
        const closes = hist.map((h) => h.adjclose); // 점수·지표는 수정종가로
        const rawPrice = hist[hist.length - 1].close; // 표시 가격은 실제 종가
        const volumes = hist.map((h) => h.volume);
        const dates = hist.map((h) => h.date);
        const fundRaw = await getFundamentals(c.symbol).catch(() => null);
        const fund = interpretFundamentals(
          fundRaw ?? { per: null, forwardPer: null, pbr: null, roe: null, dividendYield: null, revenueGrowth: null, earningsGrowth: null, profitMargin: null, marketCap: null },
        );
        const fx = c.market === "US" ? decomposeKrwReturn(closes, dates, fxMap) : null;
        return buildPick(c, closes, rawPrice, volumes, dates, fund, fx);
      } catch {
        failed.push(c.symbol);
        return null;
      }
    }),
  );

  const picks = results.filter((p): p is Pick => p !== null).sort((a, b) => b.score - a.score);

  // ③ 스타터: 점수 상위 코어/새틀라이트에 역변동성으로 금액 배분
  const topCore = picks.filter((p) => p.category === "core").slice(0, 3);
  const topSat = picks.filter((p) => p.category === "satellite").slice(0, 3);
  const toInput = (p: Pick) => ({ symbol: p.symbol, name: p.name, volatility: p.metrics.volatility });
  const starter: Starter = {
    monthly: MONTHLY_EXAMPLE_KRW,
    corePct: TARGET_CORE_PCT,
    satellitePct: TARGET_SATELLITE_PCT,
    core: inverseVolAllocation(topCore.map(toInput), (MONTHLY_EXAMPLE_KRW * TARGET_CORE_PCT) / 100),
    satellite: inverseVolAllocation(topSat.map(toInput), (MONTHLY_EXAMPLE_KRW * TARGET_SATELLITE_PCT) / 100),
  };

  return { asOf: new Date().toISOString(), picks, starter, failed };
}
