"use client";

import { useEffect, useState } from "react";
import { HelpBox, Define } from "@/components/Help";

type Asset = {
  symbol: string;
  name: string;
  category: "core" | "satellite";
  market: "KR" | "US";
  annualizedReturn: number;
  annualizedVol: number;
  sharpe: number;
  maxDrawdown: number;
};

type Compare = {
  tradingDays: number;
  periodStart: string | null;
  periodEnd: string | null;
  assets: Asset[];
  avgCorrelation: number;
  concentration: {
    illusionScore: number;
    effectiveCount: number;
    topPair: { a: string; b: string; corr: number } | null;
    label: string;
  };
  correlation: { symbols: string[]; names: string[]; matrix: number[][] };
};

const p1 = (n: number) => `${(n * 100).toFixed(1)}%`;

/** 상관계수 → 배경색 (−1 파랑 ~ 0 흰색 ~ +1 빨강) */
function corrColor(v: number): string {
  if (v >= 0) return `rgba(244, 63, 94, ${0.12 + Math.min(v, 1) * 0.6})`;
  return `rgba(59, 130, 246, ${0.12 + Math.min(-v, 1) * 0.6})`;
}

export default function ComparePage() {
  const [data, setData] = useState<Compare | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<"vol" | "sharpe" | "mdd" | "ret">("sharpe");

  useEffect(() => {
    fetch("/api/compare", { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error ?? "조회 실패");
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const sorted = data
    ? [...data.assets].sort((a, b) => {
        if (sortKey === "vol") return a.annualizedVol - b.annualizedVol; // 낮은 위험 먼저
        if (sortKey === "mdd") return b.maxDrawdown - a.maxDrawdown; // 덜 빠진 것 먼저
        if (sortKey === "ret") return b.annualizedReturn - a.annualizedReturn;
        return b.sharpe - a.sharpe; // 효율 높은 것 먼저
      })
    : [];

  return (
    <main className="mx-auto max-w-5xl px-5 py-8">
      <header className="mb-4">
        <h1 className="text-2xl font-bold">⚖️ 위험 비교</h1>
        <p className="text-sm text-zinc-500">후보 종목들이 ‘얼마나 출렁이며 벌었는지’를 한 표로 비교 (최근 1년)</p>
      </header>

      <HelpBox title="이 표 어떻게 읽어요? (꼭 읽어보세요)" defaultOpen>
        <p>
          수익률만 보면 위험을 놓쳐요. 같은 수익이면 <b>덜 출렁이는 쪽이 더 좋은 투자</b>예요. 아래
          숫자로 ‘안전벨트’를 확인하세요.
        </p>
        <Define term="연수익률">최근 1년 흐름을 1년치로 환산한 수익</Define>
        <Define term="변동성">가격이 출렁인 정도 — 낮을수록 안정(롤러코스터 ❌)</Define>
        <Define term="샤프">위험 대비 효율 — 1↑ 양호, 2↑ 우수</Define>
        <Define term="MDD(최대낙폭)">한때 고점 대비 최대로 빠진 폭 — 내 멘탈이 버틸 수 있는지 확인</Define>
        <Define term="상관관계 표">
          두 종목이 같이 움직이는 정도. 1(빨강)이면 똑같이 움직여 분산이 안 되고, 낮거나 음수(파랑)면
          서로 달라 위험이 잘 나눠져요. <b>서로 색이 옅은(상관 낮은) 종목끼리 섞으면</b> 안전해요.
        </Define>
      </HelpBox>

      {loading && <p className="text-zinc-500">후보 종목들을 비교 분석 중입니다… (몇 초 걸려요)</p>}
      {error && <div className="rounded-lg border border-rose-300 bg-rose-50 p-4 text-sm text-rose-700">⚠️ {error}</div>}

      {data && (
        <>
          <p className="mb-3 text-xs text-zinc-400">
            분석 기간: {data.periodStart} ~ {data.periodEnd} (공통 거래일 {data.tradingDays}일)
          </p>

          <ConcentrationWarning avg={data.avgCorrelation} n={data.assets.length} />
          <ConcentrationCard concentration={data.concentration} total={data.assets.length} />

          {/* 정렬 버튼 */}
          <div className="mb-2 flex flex-wrap gap-2 text-xs">
            <span className="py-1 text-zinc-400">정렬:</span>
            {[
              { k: "sharpe", label: "효율(샤프) 순" },
              { k: "vol", label: "안전(저변동성) 순" },
              { k: "ret", label: "수익률 순" },
              { k: "mdd", label: "낙폭 작은 순" },
            ].map((o) => (
              <button
                key={o.k}
                onClick={() => setSortKey(o.k as typeof sortKey)}
                className={`rounded-full border px-3 py-1 ${
                  sortKey === o.k
                    ? "border-zinc-900 bg-zinc-900 text-white dark:border-white dark:bg-white dark:text-zinc-900"
                    : "border-zinc-300 text-zinc-500 dark:border-zinc-700"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>

          {/* 종목별 비교 표 */}
          <section className="mb-6 overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-left text-zinc-500 dark:bg-zinc-900">
                <tr>
                  <th className="p-3">종목</th>
                  <th className="p-3 text-right">연수익률</th>
                  <th className="p-3 text-right">변동성</th>
                  <th className="p-3 text-right">샤프</th>
                  <th className="p-3 text-right">MDD</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((a) => (
                  <tr key={a.symbol} className="border-t border-zinc-100 dark:border-zinc-800">
                    <td className="p-3">
                      <div className="flex items-center gap-1.5 font-medium">
                        {a.name}
                        <span
                          className={`rounded px-1 py-0.5 text-[10px] ${
                            a.category === "core" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {a.category === "core" ? "코어" : "위성"}
                        </span>
                      </div>
                      <div className="text-xs text-zinc-400">{a.symbol}</div>
                    </td>
                    <td className="p-3 text-right tabular-nums">{p1(a.annualizedReturn)}</td>
                    <td className="p-3 text-right tabular-nums">{p1(a.annualizedVol)}</td>
                    <td className="p-3 text-right font-semibold tabular-nums">{a.sharpe.toFixed(2)}</td>
                    <td className="p-3 text-right tabular-nums">{p1(a.maxDrawdown)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {/* 상관관계 히트맵 */}
          <section className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
            <h2 className="mb-1 text-sm font-semibold text-zinc-500">상관관계 (분산 잘 됐나 확인)</h2>
            <p className="mb-3 text-xs text-zinc-400">
              색이 <span className="text-rose-500">진한 빨강</span>일수록 같이 움직여요(분산 효과 적음).
              옅거나 <span className="text-blue-500">파랑</span>인 종목끼리 섞으면 위험이 잘 나눠집니다.
            </p>
            <div className="overflow-x-auto">
              <table className="text-xs">
                <thead>
                  <tr>
                    <th className="p-2" />
                    {data.correlation.symbols.map((s) => (
                      <th key={s} className="p-2 font-medium text-zinc-500">{s.replace(".KS", "")}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.correlation.matrix.map((row, i) => (
                    <tr key={i}>
                      <td className="whitespace-nowrap p-2 font-medium text-zinc-500">
                        {data.correlation.symbols[i].replace(".KS", "")}
                      </td>
                      {row.map((v, j) => (
                        <td key={j} className="p-2 text-center tabular-nums" style={{ background: corrColor(v) }}>
                          {v.toFixed(2)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <p className="mt-4 text-xs text-zinc-400">
            ※ 한국·미국은 거래일이 달라 공통 거래일만으로 계산합니다. 수익률은 배당 반영(수정종가),
            샤프지수 무위험수익률은 통화별(한국 3.2%·미국 4.3%) 가정 · 참고용 지표입니다.
          </p>
        </>
      )}
    </main>
  );
}

/** ④ 몰빵 경고 — 후보들이 사실상 한 덩어리처럼 움직이는지 */
function ConcentrationWarning({ avg, n }: { avg: number; n: number }) {
  if (n < 2) return null;
  let tone: string, head: string, body: string;
  if (avg >= 0.7) {
    tone = "border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/20 dark:text-rose-300";
    head = "🚨 분산이 거의 안 돼요 (사실상 한 종목)";
    body = "후보들이 거의 똑같이 움직여요. 여러 개를 사도 위험은 한 종목 수준입니다. 성격이 다른 자산(예: 채권·금 ETF, 다른 업종)을 섞어보세요.";
  } else if (avg >= 0.5) {
    tone = "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-300";
    head = "⚠️ 분산이 약한 편";
    body = "후보들이 꽤 비슷하게 움직여요. 상관이 낮은 종목을 더 넣으면 같은 수익에 위험을 줄일 수 있어요.";
  } else {
    tone = "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-300";
    head = "✅ 분산이 잘 된 편";
    body = "후보들이 서로 다르게 움직여요. 위험이 여러 곳으로 잘 나뉘어 있습니다.";
  }
  return (
    <div className={`mb-4 rounded-xl border p-4 text-sm ${tone}`}>
      <div className="font-semibold">{head} · 평균 상관 {avg.toFixed(2)}</div>
      <p className="mt-1 text-xs leading-relaxed opacity-90">{body}</p>
    </div>
  );
}

function ConcentrationCard({
  concentration,
  total,
}: {
  concentration: Compare["concentration"];
  total: number;
}) {
  const top = concentration.topPair;
  return (
    <section className="mb-4 rounded-xl border border-zinc-200 p-4 text-sm dark:border-zinc-800">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">몰빵 착시 지수</h2>
          <p className="mt-1 text-xs text-zinc-500">
            종목 수가 아니라 실제로 얼마나 다르게 움직이는지를 압축해 본 값입니다.
          </p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-extrabold tabular-nums">{concentration.illusionScore}</div>
          <div className="text-xs text-zinc-500">{concentration.label}</div>
        </div>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <div className="rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-800/50">
          <div className="text-xs text-zinc-400">실효 분산 종목 수</div>
          <div className="font-semibold tabular-nums">{concentration.effectiveCount.toFixed(1)}개 / {total}개</div>
        </div>
        <div className="rounded-lg bg-zinc-50 px-3 py-2 dark:bg-zinc-800/50">
          <div className="text-xs text-zinc-400">가장 비슷하게 움직인 쌍</div>
          <div className="font-semibold tabular-nums">
            {top ? `${top.a} · ${top.b} (${top.corr.toFixed(2)})` : "없음"}
          </div>
        </div>
      </div>
    </section>
  );
}
