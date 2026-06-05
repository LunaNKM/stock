import { NextResponse } from "next/server";
import { getHistory } from "@/lib/stocks";
import { getWatchlist } from "@/lib/watchlistStore";
import { dailyReturns, annualizedVol, annualizedReturn, sharpe, maxDrawdown, correlation, avgPairwiseCorrelation } from "@/lib/stats";
import { RISK_FREE } from "@/lib/costs";
import { concentrationInsight } from "@/lib/insights";

export const dynamic = "force-dynamic";

/** 후보 종목들의 위험·수익 지표와 상관관계를 비교용으로 계산 */
export async function GET() {
  try {
    const watchlist = await getWatchlist();
    if (watchlist.length === 0) {
      return NextResponse.json({ error: "후보 종목이 없습니다." }, { status: 404 });
    }

    const histories = await Promise.all(
      watchlist.map((c) => getHistory(c.symbol, 365).catch(() => [])),
    );

    // 데이터가 충분한 종목만 사용
    const usable = watchlist
      .map((c, i) => ({ c, hist: histories[i] }))
      .filter((x) => x.hist.length >= 60);

    const symbols = usable.map((x) => x.c.symbol);
    // 수익률·통계는 수정종가(배당 반영)로 계산
    const closeByDate = usable.map((x) => new Map(x.hist.map((h) => [h.date, h.adjclose])));

    // 공통 거래일 교집합 (한국·미국 거래일이 달라서)
    let commonDates: string[] = usable[0]?.hist.map((h) => h.date) ?? [];
    for (let i = 1; i < closeByDate.length; i++) {
      commonDates = commonDates.filter((d) => closeByDate[i].has(d));
    }
    commonDates.sort();

    const alignedCloses = closeByDate.map((m) => commonDates.map((d) => m.get(d) as number));
    const alignedReturns = alignedCloses.map((c) => dailyReturns(c));

    const assets = usable.map((x, i) => ({
      symbol: x.c.symbol,
      name: x.c.name,
      category: x.c.category,
      market: x.c.market,
      annualizedReturn: annualizedReturn(alignedReturns[i]),
      annualizedVol: annualizedVol(alignedReturns[i]),
      sharpe: sharpe(alignedReturns[i], RISK_FREE[x.c.market]), // 통화별 무위험수익률
      maxDrawdown: maxDrawdown(alignedCloses[i]),
    }));

    const matrix = alignedReturns.map((a) => alignedReturns.map((b) => correlation(a, b)));
    const concentration = concentrationInsight(symbols, matrix, avgPairwiseCorrelation(matrix));
    const avgCorr = avgPairwiseCorrelation(matrix); // ④ 집중도(몰빵) 경고용

    return NextResponse.json({
      asOf: new Date().toISOString(),
      tradingDays: commonDates.length,
      periodStart: commonDates[0] ?? null,
      periodEnd: commonDates[commonDates.length - 1] ?? null,
      assets,
      avgCorrelation: avgCorr,
      concentration,
      correlation: { symbols, names: usable.map((x) => x.c.name), matrix },
    });
  } catch (err) {
    console.error("[/api/compare] 실패:", err);
    return NextResponse.json({ error: "비교 데이터를 불러오지 못했습니다." }, { status: 500 });
  }
}
