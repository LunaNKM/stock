import { NextResponse } from "next/server";
import { getHistory } from "@/lib/stocks";
import { getWatchlist } from "@/lib/watchlistStore";
import { simulatePortfolio, type SimAsset } from "@/lib/simulate";
import { netReturns } from "@/lib/costs";
import { compareToDeposit } from "@/lib/deposit";
import { depositBeatProfile } from "@/lib/insights";
import { TARGET_CORE_PCT, TARGET_SATELLITE_PCT } from "@/lib/watchlist";

export const dynamic = "force-dynamic";

/**
 * 적립식·하락장 시뮬레이션.
 * ?monthly=월적립액(원) &years=기간 &symbols=쉼표목록(선택) &depositRate=예금연이율(예: 0.035)
 * 비중은 코어 75%/새틀라이트 25%를 각 그룹 안에서 균등 분배.
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const monthly = Math.max(10000, Number(url.searchParams.get("monthly")) || 300000);
    const years = Math.min(10, Math.max(1, Number(url.searchParams.get("years")) || 3));
    const initial = Math.min(1_000_000_000, Math.max(0, Number(url.searchParams.get("initial")) || 0));
    const depositRate = Math.min(0.1, Math.max(0, Number(url.searchParams.get("depositRate")) || 0.035));
    const only = url.searchParams.get("symbols")?.split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);

    let watchlist = await getWatchlist();
    if (only && only.length > 0) watchlist = watchlist.filter((c) => only.includes(c.symbol.toUpperCase()));
    if (watchlist.length === 0) {
      return NextResponse.json({ error: "후보 종목이 없습니다." }, { status: 404 });
    }

    const numCore = watchlist.filter((c) => c.category === "core").length || 1;
    const numSat = watchlist.filter((c) => c.category === "satellite").length || 1;

    const assets: SimAsset[] = await Promise.all(
      watchlist.map(async (c) => {
        const hist = await getHistory(c.symbol, years * 365 + 60).catch(() => []);
        const weight =
          c.category === "core" ? TARGET_CORE_PCT / numCore : TARGET_SATELLITE_PCT / numSat;
        return {
          symbol: c.symbol,
          name: c.name,
          market: c.market,
          weight,
          hist: hist.map((h) => ({ date: h.date, close: h.close, adjclose: h.adjclose })),
        };
      }),
    );

    const result = simulatePortfolio(assets, { monthly, years, initial });
    if (!result) {
      return NextResponse.json({ error: "공통 거래기간 데이터가 부족합니다." }, { status: 404 });
    }

    // A) 세후·비용 반영 실질수익  B/D) 예적금 대비 초과수익
    const net = netReturns(
      result.assets.map((a) => ({
        market: a.market,
        invested: a.invested,
        finalValue: a.finalValue,
        dividends: a.dividends,
      })),
    );
    const deposit = compareToDeposit(monthly, result.months, net.netFinal, depositRate, initial);
    const depositBeat = depositBeatProfile(result.monthlySeries, monthly, depositRate, initial);

    return NextResponse.json({ ...result, net, deposit, depositBeat });
  } catch (err) {
    console.error("[/api/simulate] 실패:", err);
    return NextResponse.json({ error: "시뮬레이션에 실패했습니다." }, { status: 500 });
  }
}
