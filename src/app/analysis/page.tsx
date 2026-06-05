"use client";

import { useEffect, useState } from "react";
import LineChart from "@/components/LineChart";
import { HelpBox, Hint, Define } from "@/components/Help";

type Holding = { symbol: string; name: string };
type Signal = { label: string; tone: "bull" | "bear" | "neutral"; detail: string };
type Analysis = {
  symbol: string;
  price: number;
  indicators: {
    sma20: number | null;
    sma60: number | null;
    sma120: number | null;
    rsi: number | null;
    macdHist: number | null;
    volRatio: number;
  };
  signals: Signal[];
  chart: {
    dates: string[];
    close: number[];
    sma20: (number | null)[];
    sma60: (number | null)[];
    macd: number[];
    macdSignal: number[];
    histogram: number[];
  };
};

const toneClass: Record<Signal["tone"], string> = {
  bull: "bg-rose-50 text-rose-700 border-rose-200",
  bear: "bg-blue-50 text-blue-700 border-blue-200",
  neutral: "bg-zinc-50 text-zinc-600 border-zinc-200",
};

export default function AnalysisPage() {
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [symbol, setSymbol] = useState<string>("");
  const [data, setData] = useState<Analysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // 후보 종목 목록 → 첫 종목 자동 선택
  useEffect(() => {
    fetch("/api/watchlist")
      .then((r) => r.json())
      .then((h: Holding[]) => {
        setHoldings(h);
        if (h.length > 0) setSymbol(h[0].symbol);
      });
  }, []);

  useEffect(() => {
    if (!symbol) return;
    queueMicrotask(() => {
      setLoading(true);
      setError(null);
      setData(null);
    });
    fetch(`/api/analysis/${encodeURIComponent(symbol)}`, { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error ?? "분석 실패");
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [symbol]);

  const fmt = (n: number | null, d = 1) => (n == null ? "—" : n.toFixed(d));

  return (
    <main className="mx-auto max-w-5xl px-5 py-8">
      <header className="mb-4">
        <h1 className="text-2xl font-bold">📊 기술분석</h1>
        <p className="text-sm text-zinc-500">차트 모양으로 ‘요즘 이 종목 분위기’를 읽어보는 곳</p>
      </header>

      <HelpBox title="기술분석이 뭐예요? (꼭 읽어보세요)" defaultOpen>
        <p>
          회사의 실적이 아니라 <b>가격 그래프의 모양</b>만 보고 ‘지금 오르는 분위기인지, 내리는
          분위기인지, 너무 많이 올라 쉬어갈 때인지’를 가늠하는 방법이에요. 아래 신호들은{" "}
          <b>참고용 힌트</b>일 뿐, ‘무조건 사라/팔아라’가 아닙니다. 초보는 이걸 단독 근거로 매매하지
          마세요!
        </p>
        <Define term="이동평균선 (20·60·120일선)">
          최근 며칠간의 <b>평균 가격을 이은 선</b>. 현재가가 이 선들 ‘위’에 있으면 상승 흐름, ‘아래’면
          하락 흐름이에요. 20일=약 1개월, 60일=약 3개월, 120일=약 6개월 추세를 뜻해요.
        </Define>
        <Define term="RSI (0~100)">
          ‘너무 많이 올랐나/내렸나’를 보는 온도계. <b>70 이상이면 과열</b>(잠깐 식을 수 있음),{" "}
          <b>30 이하면 너무 빠진 상태</b>(반등할 수도). 30~70은 보통이에요.
        </Define>
        <Define term="MACD">
          가격이 오르는 ‘힘의 방향’을 보는 지표. 히스토그램 값이 <b>0보다 크면 오르는 힘</b>, 작으면
          내리는 힘이 우세하다는 뜻이에요.
        </Define>
        <Define term="거래량 비율">
          평소(최근 20일 평균)보다 오늘 거래가 몇 배 많은지. <b>1.5배가 넘으면</b> 사람들이 갑자기
          몰린 것 — 큰 변동이 올 수 있으니 주의해요.
        </Define>
      </HelpBox>

      <select
        value={symbol}
        onChange={(e) => setSymbol(e.target.value)}
        className="mb-6 rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
      >
        {holdings.map((h) => (
          <option key={h.symbol} value={h.symbol}>
            {h.name} ({h.symbol})
          </option>
        ))}
      </select>

      {loading && <p className="text-zinc-500">분석 중…</p>}
      {error && (
        <div className="rounded-lg border border-rose-300 bg-rose-50 p-4 text-sm text-rose-700">⚠️ {error}</div>
      )}

      {data && (
        <>
          {/* 신호 요약 */}
          <section className="mb-6">
            <h2 className="mb-2 text-sm font-semibold text-zinc-500">한눈에 보는 신호</h2>
            <div className="flex flex-wrap gap-2">
              {data.signals.map((s, i) => (
                <span
                  key={i}
                  className={`rounded-full border px-3 py-1 text-xs ${toneClass[s.tone]}`}
                  title={s.detail}
                >
                  {s.label}
                </span>
              ))}
            </div>
            <Hint>
              <span className="text-rose-500">빨강 계열</span> = 오르는 쪽 신호,{" "}
              <span className="text-blue-500">파랑 계열</span> = 내리는 쪽 신호, 회색 = 중립이에요. 칩에
              마우스를 올리면 근거가 보여요.
            </Hint>
          </section>

          {/* 지표 카드 */}
          <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Metric label="현재가" value={data.price.toLocaleString()} hint="지금 시장 가격" />
            <Metric label="RSI(14)" value={fmt(data.indicators.rsi, 0)} hint="70↑ 과열 · 30↓ 침체" />
            <Metric label="20일선" value={fmt(data.indicators.sma20)} hint="최근 1개월 평균가" />
            <Metric label="60일선" value={fmt(data.indicators.sma60)} hint="최근 3개월 평균가" />
            <Metric label="120일선" value={fmt(data.indicators.sma120)} hint="최근 6개월 평균가" />
            <Metric label="MACD 히스토" value={fmt(data.indicators.macdHist, 2)} hint="+면 오름세 · −면 내림세" />
            <Metric label="거래량 비율" value={`${fmt(data.indicators.volRatio, 2)}배`} hint="평소보다 몇 배 거래됐나" />
          </section>

          {/* 가격 + 이동평균 차트 */}
          <section className="mb-6 rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
            <h2 className="text-sm font-semibold text-zinc-500">가격 · 이동평균 (최근 120거래일)</h2>
            <Hint>
              검은 선(실제 가격)이 주황·초록 선 위에 있으면 ‘오르는 분위기’, 아래에 있으면 ‘내리는
              분위기’로 봐요.
            </Hint>
            <div className="mt-3" />
            <LineChart
              series={[
                { name: "종가", color: "#18181b", values: data.chart.close },
                { name: "20일선", color: "#f59e0b", values: data.chart.sma20 },
                { name: "60일선", color: "#10b981", values: data.chart.sma60 },
              ]}
            />
          </section>

          {/* MACD 차트 */}
          <section className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
            <h2 className="text-sm font-semibold text-zinc-500">MACD (12,26,9)</h2>
            <Hint>파란 선이 빨간 선 위로 올라가면 상승 힘이 강해지는 신호로 해석해요.</Hint>
            <div className="mt-3" />
            <LineChart
              height={160}
              series={[
                { name: "MACD", color: "#2563eb", values: data.chart.macd },
                { name: "시그널", color: "#ef4444", values: data.chart.macdSignal },
                { name: "히스토그램", color: "#a1a1aa", values: data.chart.histogram },
              ]}
            />
          </section>

          <p className="mt-4 text-xs text-zinc-400">
            ⚠️ 기술지표는 참고용 보조 신호입니다. 매수/매도 추천이 아니며, 단독 판단 근거로 쓰지 마세요.
          </p>
        </>
      )}
    </main>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="mb-1 text-xs text-zinc-500">{label}</div>
      <div className="text-lg font-bold tabular-nums">{value}</div>
      {hint && <Hint>{hint}</Hint>}
    </div>
  );
}
