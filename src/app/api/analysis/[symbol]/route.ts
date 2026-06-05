import { NextResponse } from "next/server";
import { getHistory } from "@/lib/stocks";
import { sma, rsi, macd, last } from "@/lib/indicators";

export const dynamic = "force-dynamic";

type Signal = { label: string; tone: "bull" | "bear" | "neutral"; detail: string };

export async function GET(_req: Request, ctx: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await ctx.params;
  try {
    const history = await getHistory(symbol, 400);
    if (history.length < 60) {
      return NextResponse.json(
        { error: "데이터가 부족합니다 (상장 초기이거나 잘못된 종목 코드일 수 있어요)." },
        { status: 404 },
      );
    }

    // 지표·차트는 수정종가(배당·분할 반영)로 계산해 가짜 급락을 피한다.
    const closes = history.map((c) => c.adjclose);
    const volumes = history.map((c) => c.volume);
    const dates = history.map((c) => c.date);

    const sma20 = sma(closes, 20);
    const sma60 = sma(closes, 60);
    const sma120 = sma(closes, 120);
    const rsiArr = rsi(closes, 14);
    const { macdLine, signal: macdSignal, histogram } = macd(closes);

    const price = history[history.length - 1].close; // 헤드라인은 실제 종가
    const s20 = last(sma20);
    const s60 = last(sma60);
    const s120 = last(sma120);
    const rsiVal = last(rsiArr);
    const macdHist = histogram[histogram.length - 1];

    // 최근 20일 평균 거래량 대비 당일 거래량 비율
    const recentVol = volumes.slice(-20);
    const avgVol = recentVol.reduce((s, v) => s + v, 0) / recentVol.length;
    const volRatio = avgVol > 0 ? volumes[volumes.length - 1] / avgVol : 1;

    // ── 신호 해석 ──────────────────────────────
    const signals: Signal[] = [];

    if (s20 != null && s60 != null) {
      if (price > s20 && s20 > s60) {
        signals.push({ label: "정배열 (상승추세)", tone: "bull", detail: "현재가 > 20일선 > 60일선" });
      } else if (price < s20 && s20 < s60) {
        signals.push({ label: "역배열 (하락추세)", tone: "bear", detail: "현재가 < 20일선 < 60일선" });
      } else {
        signals.push({ label: "추세 혼조", tone: "neutral", detail: "이동평균선이 엉켜 있음" });
      }
    }

    if (rsiVal != null) {
      if (rsiVal >= 70) signals.push({ label: `RSI 과매수 (${rsiVal.toFixed(0)})`, tone: "bear", detail: "단기 과열, 조정 가능" });
      else if (rsiVal <= 30) signals.push({ label: `RSI 과매도 (${rsiVal.toFixed(0)})`, tone: "bull", detail: "단기 침체, 반등 가능" });
      else signals.push({ label: `RSI 중립 (${rsiVal.toFixed(0)})`, tone: "neutral", detail: "30~70 정상 구간" });
    }

    if (macdHist != null) {
      if (macdHist > 0) signals.push({ label: "MACD 상승 모멘텀", tone: "bull", detail: "히스토그램 양(+)" });
      else signals.push({ label: "MACD 하락 모멘텀", tone: "bear", detail: "히스토그램 음(−)" });
    }

    if (volRatio >= 1.5) {
      signals.push({ label: `거래량 급증 (평균 ${volRatio.toFixed(1)}배)`, tone: "neutral", detail: "관심 집중, 변동성 주의" });
    }

    return NextResponse.json({
      symbol: symbol.toUpperCase(),
      price,
      indicators: { sma20: s20, sma60: s60, sma120: s120, rsi: rsiVal, macdHist, volRatio },
      signals,
      // 차트용: 최근 120일 종가 + 이동평균선
      chart: {
        dates: dates.slice(-120),
        close: closes.slice(-120),
        sma20: sma20.slice(-120),
        sma60: sma60.slice(-120),
        macd: macdLine.slice(-120),
        macdSignal: macdSignal.slice(-120),
        histogram: histogram.slice(-120),
      },
    });
  } catch (err) {
    console.error(`[/api/analysis/${symbol}] 실패:`, err);
    return NextResponse.json({ error: "분석에 실패했습니다." }, { status: 500 });
  }
}
