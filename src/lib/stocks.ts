import "server-only";
import YahooFinance from "yahoo-finance2";
import { cached } from "./cache";

// yahoo-finance2 v3는 클래스이므로 인스턴스를 한 번 생성해 재사용한다.
const yahooFinance = new YahooFinance();

/**
 * close   = 액면분할만 반영된 종가 (화면에 보여줄 "실제 가격").
 * adjclose = 배당·분할까지 반영된 수정종가 (수익률·지표·백테스트는 반드시 이걸로).
 *   → 배당주(SCHD·KODEX 등)의 수익이 구조적으로 과소평가되는 문제를 막는다.
 */
export type Candle = { date: string; close: number; adjclose: number; volume: number };

const HISTORY_TTL = 10 * 60 * 1000; // 10분
const FUND_TTL = 60 * 60 * 1000; // 1시간 (펀더멘털은 자주 안 바뀜)

/** 과거 일봉 데이터 조회 (기본 1년). 기술지표·통계·추천 점수 계산용. */
export async function getHistory(symbol: string, days = 365): Promise<Candle[]> {
  return cached(`hist:${symbol}:${days}`, HISTORY_TTL, async () => {
    const period1 = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const res = await yahooFinance.chart(symbol, { period1, interval: "1d" });
    return (res.quotes ?? [])
      .filter((q) => q.close != null)
      .map((q) => ({
        date: new Date(q.date).toISOString().slice(0, 10),
        close: q.close as number,
        // 수정종가가 없으면(일부 종목·환율) 종가로 폴백
        adjclose: (q.adjclose ?? q.close) as number,
        volume: q.volume ?? 0,
      }));
  });
}

/** 종목 펀더멘털 (PER·PBR·ROE·배당·성장 등). 조회 실패/미지원이면 모두 null. */
export type FundamentalsRaw = {
  per: number | null; // 주가수익비율 (trailingPE)
  forwardPer: number | null; // 예상 PER
  pbr: number | null; // 주가순자산비율
  roe: number | null; // 자기자본이익률 (0~1)
  dividendYield: number | null; // 배당수익률 (0~1)
  revenueGrowth: number | null; // 매출성장률 (전년比, 0~1)
  earningsGrowth: number | null; // 이익성장률 (0~1)
  profitMargin: number | null; // 순이익률 (0~1)
  marketCap: number | null; // 시가총액
};

export async function getFundamentals(symbol: string): Promise<FundamentalsRaw> {
  return cached(`fund:${symbol}`, FUND_TTL, async () => {
    const empty: FundamentalsRaw = {
      per: null, forwardPer: null, pbr: null, roe: null, dividendYield: null,
      revenueGrowth: null, earningsGrowth: null, profitMargin: null, marketCap: null,
    };
    try {
      const r = await yahooFinance.quoteSummary(symbol, {
        modules: ["summaryDetail", "defaultKeyStatistics", "financialData"],
      });
      const sd = r.summaryDetail;
      const ks = r.defaultKeyStatistics;
      const fd = r.financialData;
      const num = (v: unknown): number | null =>
        typeof v === "number" && Number.isFinite(v) ? v : null;
      return {
        per: num(sd?.trailingPE),
        forwardPer: num(sd?.forwardPE ?? ks?.forwardPE),
        pbr: num(ks?.priceToBook),
        roe: num(fd?.returnOnEquity),
        dividendYield: num(sd?.dividendYield ?? sd?.trailingAnnualDividendYield),
        revenueGrowth: num(fd?.revenueGrowth),
        earningsGrowth: num(fd?.earningsGrowth),
        profitMargin: num(fd?.profitMargins ?? ks?.profitMargins),
        marketCap: num(sd?.marketCap ?? ks?.marketCap),
      };
    } catch {
      return empty;
    }
  });
}

/** 원/달러 환율 과거 시세 (날짜→환율 맵). 미국주식의 원화 수익 분해용. */
export async function getUsdKrw(days = 400): Promise<Map<string, number>> {
  return cached(`fx:usdkrw:${days}`, HISTORY_TTL, async () => {
    const hist = await getHistory("USDKRW=X", days);
    return new Map(hist.map((h) => [h.date, h.close]));
  });
}
