"use client";

import { useEffect, useState } from "react";
import { won } from "@/lib/format";
import { HelpBox, Hint, Define } from "@/components/Help";

type Tone = "bull" | "neutral" | "bear";
type Reliability = {
  horizonDays: number;
  threshold: number;
  samples: number;
  winRate: number | null;
  avgForward: number | null;
  baseWinRate: number;
  baseAvgForward: number;
  enough: boolean;
};
type ValuationTone = "cheap" | "fair" | "rich" | "unknown";
type Fundamentals = {
  per: number | null;
  pbr: number | null;
  roe: number | null;
  dividendYield: number | null;
  revenueGrowth: number | null;
  valuation: ValuationTone;
  valuationLabel: string;
  notes: string[];
};
type Fx = { totalKrw: number; stockUsd: number; fx: number };
type Alpha = {
  enough: boolean;
  months: number;
  naiveMultiple: number;
  scoreMultiple: number;
  alpha: number;
  verdict: "score" | "tie" | "naive";
};
type Insights = {
  realKrwAlpha: {
    score: number;
    label: string;
    realAlphaPct: number;
    components: { timingAlpha: number; reliabilityEdge: number; fxContribution: number; riskPenalty: number };
  };
  scoreError: { lossRate: number | null; edgeWinRate: number | null; label: string; enough: boolean };
  fxHeadwind: { contribution: number; label: string; tone: "good" | "neutral" | "bad" } | null;
  safetyMargin: { score: number; label: string; room: number };
  dataQuality: { lastDate: string | null; staleDays: number | null; historyDays: number; fundamentalsCoverage: number; label: string };
  gate: {
    status: "review" | "small" | "hold" | "block";
    label: string;
    tone: "good" | "caution" | "bad" | "neutral";
    reasons: string[];
    checklist: string[];
  };
};
type Pick = {
  symbol: string;
  name: string;
  category: "core" | "satellite";
  market: "KR" | "US";
  note: string;
  currency: "USD" | "KRW";
  price: number;
  score: number;
  label: string;
  tone: Tone;
  riskTag: "안정" | "보통" | "높음";
  reasons: string[];
  metrics: { rsi: number | null; volatility: number; maxDrawdown: number; return3m: number; pos52: number; pos5y: number };
  reliability: Reliability;
  alpha: Alpha;
  fundamentals: Fundamentals;
  fx: Fx | null;
  insights: Insights;
};
type Sizing = { symbol: string; name: string; volatility: number; weight: number; amount: number };
type Starter = {
  monthly: number;
  corePct: number;
  satellitePct: number;
  core: Sizing[];
  satellite: Sizing[];
};
type Recos = { asOf: string; picks: Pick[]; starter: Starter; failed: string[] };

const valuationStyle: Record<ValuationTone, { label: string; cls: string }> = {
  cheap: { label: "💰 저평가", cls: "bg-blue-100 text-blue-700" },
  fair: { label: "⚖️ 적정", cls: "bg-zinc-100 text-zinc-600" },
  rich: { label: "🔥 고평가", cls: "bg-rose-100 text-rose-700" },
  unknown: { label: "정보 부족", cls: "bg-zinc-100 text-zinc-400" },
};

const toneBorder: Record<Tone, string> = {
  bull: "border-rose-300 dark:border-rose-800",
  neutral: "border-zinc-200 dark:border-zinc-700",
  bear: "border-blue-200 dark:border-blue-900",
};
const scoreColor = (s: number) =>
  s >= 70 ? "text-rose-500" : s >= 50 ? "text-amber-500" : "text-zinc-400";
const riskColor: Record<Pick["riskTag"], string> = {
  안정: "bg-emerald-100 text-emerald-700",
  보통: "bg-amber-100 text-amber-700",
  높음: "bg-rose-100 text-rose-700",
};

const emptyForm = { symbol: "", name: "", category: "satellite", market: "US", note: "" };

export default function RecommendPage() {
  const [data, setData] = useState<Recos | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/recommendations", { cache: "no-store" });
      if (!res.ok) throw new Error((await res.json()).error ?? "조회 실패");
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "알 수 없는 오류");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void Promise.resolve().then(load);
  }, []);

  async function addCandidate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "추가 실패");
      setForm(emptyForm);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "추가 실패");
    } finally {
      setSaving(false);
    }
  }

  async function removeCandidate(symbol: string) {
    if (!confirm(`${symbol}을(를) 후보에서 뺄까요?`)) return;
    await fetch(`/api/watchlist?symbol=${encodeURIComponent(symbol)}`, { method: "DELETE" });
    await load();
  }

  const won0 = (n: number) => new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 0 }).format(Math.round(n));

  return (
    <main className="mx-auto max-w-5xl px-5 py-8">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">오늘의 점검</h1>
          <p className="text-sm text-zinc-500">관심종목을 바로 사기 전에 <b>검토 가능/소액만/보류/차단</b> 상태로 걸러보세요.</p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-white dark:text-zinc-900"
        >
          {loading ? "분석 중…" : "새로고침"}
        </button>
      </header>

      <section className="mb-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
        <b>이 화면은 매수 추천이 아니라 점검 도구입니다.</b>
        <p className="mt-1">
          점수가 높아도 최종 점검이 보류/차단이면 사지 않는 쪽으로 해석하세요. 실제 주문 전에는 증권사 앱의 현재가, 호가, 공시, 실적 일정을 다시 확인해야 합니다.
        </p>
      </section>

      <HelpBox title="이 점검은 어떻게 나온 거예요? (꼭 읽어보세요)" defaultOpen>
        <p>
          미래 가격은 아무도 못 맞혀요. 이 점수는 <b>과거·현재 데이터로 계산한 점검 점수</b>(0~100)
          일 뿐이에요. <b>타이밍을 맞히는 용도가 아니라</b>, 적립식 투자에서 “이번 달은 조건이 괜찮으니
          평소만큼 / 확인할 게 많으니 조금만”처럼 <b>적립 강도를 조절</b>하는 참고용입니다. 책임은 본인에게 있어요.
        </p>
        <p>점수는 아래 4가지를 종합해서 매겨요 (총 100점):</p>
        <Define term="추세 (30)">가격이 평균선들 위에 있어 오르는 흐름인가</Define>
        <Define term="모멘텀 (20)">오르는 힘(MACD)이 있고, 너무 과열(RSI)되진 않았나</Define>
        <Define term="안정성 (25)">덜 출렁이고(변동성), 크게 안 빠졌나(낙폭)</Define>
        <Define term="가격 위치/밸류 (25)">1년·5년 가격대에서 가격 부담이 큰 구간은 아닌가 (고점 추격 억제)</Define>
        <p className="text-zinc-500">
          💡 점수 70↑ = 조건 양호 · 50~69 = 추가 확인 필요 · 50 미만 = 보류/주의. 위험등급(안정·보통·높음)은
          변동성으로 매겨요. 최종 행동은 점수가 아니라 <b>최종 점검</b>과 체크리스트를 함께 보고 판단하세요.
        </p>
      </HelpBox>

      {error && (
        <div className="mb-4 rounded-lg border border-rose-300 bg-rose-50 p-4 text-sm text-rose-700">⚠️ {error}</div>
      )}
      {loading && !data && <p className="text-zinc-500">14개 후보 종목을 분석 중입니다… (몇 초 걸려요)</p>}

      {data && (
        <>
          {/* 초보 시작 가이드 */}
          <section className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50/50 p-5 dark:border-emerald-900/40 dark:bg-emerald-950/10">
            <h2 className="mb-1 font-semibold">🌱 처음이라면 이렇게 시작해 보세요 (월 {won(300000)} 예시)</h2>
            <p className="mb-3 text-sm text-zinc-600 dark:text-zinc-400">
              한 종목에 몰빵하지 말고, <b>안정(코어) 75% + 도전(새틀라이트) 25%</b>로 나눠 적립하는 게
              초보에게 가장 무난해요.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <StarterCard
                title={`코어 ${data.starter.corePct}% · ${won(data.starter.monthly * data.starter.corePct / 100)}`}
                subtitle="시장 전체 ETF로 안정적으로"
                items={data.starter.core}
                color="text-emerald-700"
                won0={won0}
              />
              <StarterCard
                title={`새틀라이트 ${data.starter.satellitePct}% · ${won(data.starter.monthly * data.starter.satellitePct / 100)}`}
                subtitle="게이트를 통과한 개별주만 소액 검토"
                items={data.starter.satellite}
                color="text-amber-700"
                won0={won0}
              />
            </div>
            <Hint>
              ※ 금액은 <b>변동성이 큰 종목엔 적게</b> 들어가도록 자동 배분(역변동성)했어요. 단순 예시이니
              종목·비율은 본인 판단으로 바꾸세요.
            </Hint>
          </section>

          {/* 추천 순위 */}
          <h2 className="mb-3 text-sm font-semibold text-zinc-500">전체 후보 순위 (점수 높은 순)</h2>
          <section className="mb-6 grid gap-3 sm:grid-cols-2">
            {data.picks.map((p, i) => (
              <div key={p.symbol} className={`rounded-xl border p-4 ${toneBorder[p.tone]}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-zinc-400">#{i + 1}</span>
                      <span className="font-bold">{p.name}</span>
                      <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-500 dark:bg-zinc-800">
                        {p.market}
                      </span>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] ${
                          p.category === "core" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {p.category === "core" ? "코어" : "새틀라이트"}
                      </span>
                    </div>
                    <div className="mt-0.5 text-xs text-zinc-400">{p.symbol}</div>
                  </div>
                  <div className="text-right">
                    <div className={`text-2xl font-extrabold tabular-nums ${scoreColor(p.score)}`}>{p.score}</div>
                    <div className="text-[10px] text-zinc-400">점 / 100</div>
                  </div>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="text-sm font-medium">{p.label}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] ${riskColor[p.riskTag]}`}>
                    위험 {p.riskTag}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] ${valuationStyle[p.fundamentals.valuation].cls}`}>
                    {valuationStyle[p.fundamentals.valuation].label}
                  </span>
                </div>
                <DecisionGatePanel gate={p.insights.gate} />

                <p className="mt-2 text-xs text-zinc-500">{p.note}</p>

                <ul className="mt-2 space-y-0.5">
                  {p.reasons.map((r, j) => (
                    <li key={j} className="text-xs text-zinc-600 dark:text-zinc-300">
                      · {r}
                    </li>
                  ))}
                </ul>

                <ReliabilityBadge r={p.reliability} />
                <AlphaBadge a={p.alpha} />
                <InsightPanel insights={p.insights} />
                <PreTradeChecklist items={p.insights.gate.checklist} />
                <FundamentalsRow f={p.fundamentals} />
                <ValueRow pos52={p.metrics.pos52} pos5y={p.metrics.pos5y} />
                {p.fx && <FxRow fx={p.fx} />}

                <div className="mt-3 flex items-center justify-between border-t border-zinc-100 pt-2 text-[11px] text-zinc-400 dark:border-zinc-800">
                  <span>
                    {p.currency === "USD" ? "$" : "₩"}
                    {p.price.toLocaleString()} · 변동성 {(p.metrics.volatility * 100).toFixed(0)}% · 3개월{" "}
                    {(p.metrics.return3m * 100).toFixed(0)}%
                  </span>
                  <button onClick={() => removeCandidate(p.symbol)} className="hover:text-rose-500" title="후보에서 빼기">
                    🗑
                  </button>
                </div>
              </div>
            ))}
          </section>

          {data.failed.length > 0 && (
            <p className="mb-4 text-xs text-zinc-400">조회 실패(잘못된 코드일 수 있음): {data.failed.join(", ")}</p>
          )}

          {/* 후보 추가 */}
          <section className="rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
            <h2 className="mb-1 text-sm font-semibold text-zinc-500">관심 종목 직접 추가</h2>
            <p className="mb-3 text-xs text-zinc-500">
              궁금한 종목을 넣으면 다음 분석부터 점수가 매겨져요. (미국: <code>AAPL</code> / 한국:{" "}
              <code>005930.KS</code>)
            </p>
            <form onSubmit={addCandidate} className="grid grid-cols-2 gap-3 sm:grid-cols-6">
              <input
                required
                placeholder="심볼"
                value={form.symbol}
                onChange={(e) => setForm({ ...form, symbol: e.target.value })}
                className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              />
              <input
                placeholder="이름"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              />
              <select
                value={form.market}
                onChange={(e) => setForm({ ...form, market: e.target.value })}
                className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              >
                <option value="US">미국</option>
                <option value="KR">한국</option>
              </select>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              >
                <option value="core">코어</option>
                <option value="satellite">새틀라이트</option>
              </select>
              <input
                placeholder="메모(선택)"
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
                className="rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
              />
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-white dark:text-zinc-900"
              >
                {saving ? "추가 중…" : "추가"}
              </button>
            </form>
          </section>

          <p className="mt-4 text-xs text-zinc-400">
            데이터: Yahoo Finance · ⚠️ 본 추천은 교육·참고용이며 투자 권유가 아닙니다. 투자 책임은 본인에게 있어요.
          </p>
        </>
      )}
    </main>
  );
}

const pct1 = (n: number) => `${n >= 0 ? "+" : ""}${(n * 100).toFixed(1)}%`;

/** ① 점수 신뢰도 배지 — 과거에 이 점수였을 때 실제로 어땠나 */
function ReliabilityBadge({ r }: { r: Reliability }) {
  const months = Math.round(r.horizonDays / 21);
  if (!r.enough || r.winRate == null || r.avgForward == null) {
    return (
      <div className="mt-3 rounded-lg bg-zinc-50 px-3 py-2 text-[11px] text-zinc-400 dark:bg-zinc-800/50">
        🧪 신뢰도: 표본이 적어 통계 내기 어려워요 (상장 기간이 짧거나 {r.threshold}점↑가 드묾)
      </div>
    );
  }
  const edge = r.winRate - r.baseWinRate;
  const good = r.avgForward > 0 && r.winRate >= 0.55;
  const thin = r.samples < 15; // 표본이 얇으면 더 강하게 경고
  return (
    <div className={`mt-3 rounded-lg px-3 py-2 text-[11px] ${good ? "bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-300" : "bg-zinc-50 text-zinc-500 dark:bg-zinc-800/50"}`}>
      🧪 <b>점수 성적표</b> — 지난 5년간 {r.threshold}점↑였을 때 이후 약 {months}개월:
      <b className="tabular-nums"> 승률 {(r.winRate * 100).toFixed(0)}%</b> ·
      <b className="tabular-nums"> 평균 {pct1(r.avgForward)}</b>
      <span className="text-zinc-400"> (표본 {r.samples}회, 평소 승률 {(r.baseWinRate * 100).toFixed(0)}%</span>
      {edge >= 0.03 ? <span className="text-rose-500"> ▲{(edge * 100).toFixed(0)}%p</span>
        : edge <= -0.03 ? <span className="text-blue-500"> ▼{(Math.abs(edge) * 100).toFixed(0)}%p</span> : null}
      <span className="text-zinc-400">)</span>
      <div className="mt-0.5 text-[10px] text-zinc-400">
        ⚠️ {thin && "표본이 얇아요. "}우량주 위주라 생존편향이 있어요 — 과거 통계일 뿐 미래 보장 아님.
      </div>
    </div>
  );
}

/** ⑦ 점수 알파 — 이 점수대로 산 게 그냥 매달 적립보다 나았나 (정직 지표) */
function AlphaBadge({ a }: { a: Alpha }) {
  if (!a.enough) return null;
  const diffPct = a.alpha * 100; // 배수 차이를 %p로
  if (a.verdict === "score") {
    return (
      <div className="mt-1 rounded-lg bg-emerald-50 px-3 py-2 text-[11px] text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300">
        📈 <b>점수 알파</b> — 점수대로 강약 조절한 적립이 무지성 적립보다
        <b className="tabular-nums"> +{diffPct.toFixed(1)}%p</b> 나았어요 (과거 기준).
      </div>
    );
  }
  if (a.verdict === "naive") {
    return (
      <div className="mt-1 rounded-lg bg-zinc-50 px-3 py-2 text-[11px] text-zinc-500 dark:bg-zinc-800/50">
        🤷 <b>점수 알파</b> — 솔직히 이 종목은 <b>그냥 매달 적립</b>이 더 나았어요
        <span className="tabular-nums"> ({diffPct.toFixed(1)}%p)</span>. 점수에 너무 기대지 마세요.
      </div>
    );
  }
  return (
    <div className="mt-1 rounded-lg bg-zinc-50 px-3 py-2 text-[11px] text-zinc-500 dark:bg-zinc-800/50">
      ⚖️ <b>점수 알파</b> — 점수 조절과 무지성 적립이 사실상 비슷했어요. 꾸준함이 제일 중요.
    </div>
  );
}

/** 1년·5년 가격대에서의 위치 (싼 자리인지 밸류 프록시) */
function DecisionGatePanel({ gate }: { gate: Insights["gate"] }) {
  const toneClass =
    gate.tone === "good" ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-300" :
    gate.tone === "caution" ? "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-300" :
    gate.tone === "bad" ? "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/20 dark:text-rose-300" :
    "border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-800/50 dark:text-zinc-300";
  return (
    <div className={`mt-2 rounded-lg border px-3 py-2 text-xs ${toneClass}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold">최종 점검</span>
        <b>{gate.label}</b>
      </div>
      {gate.reasons.length > 0 && (
        <ul className="mt-1 space-y-0.5 text-[11px] opacity-90">
          {gate.reasons.map((reason) => (
            <li key={reason}>· {reason}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PreTradeChecklist({ items }: { items: string[] }) {
  return (
    <details className="mt-2 rounded-lg border border-zinc-200 px-3 py-2 text-[11px] text-zinc-600 dark:border-zinc-800 dark:text-zinc-300">
      <summary className="cursor-pointer font-medium">매수 전 체크리스트</summary>
      <ul className="mt-2 space-y-1">
        {items.map((item) => (
          <li key={item}>□ {item}</li>
        ))}
      </ul>
    </details>
  );
}

function InsightPanel({ insights }: { insights: Insights }) {
  const fxTone =
    insights.fxHeadwind?.tone === "good" ? "text-emerald-600" :
    insights.fxHeadwind?.tone === "bad" ? "text-blue-600" :
    "text-zinc-500";
  return (
    <div className="mt-2 grid gap-1 rounded-lg bg-zinc-50 px-3 py-2 text-[11px] text-zinc-600 dark:bg-zinc-800/50 dark:text-zinc-300">
      <div className="flex items-center justify-between gap-2">
        <span>원화 실질 알파</span>
        <b className="tabular-nums">{insights.realKrwAlpha.score}점 · {insights.realKrwAlpha.label}</b>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span>고점수 오답률</span>
        <b className="tabular-nums">
          {insights.scoreError.lossRate == null ? "표본 부족" : `${(insights.scoreError.lossRate * 100).toFixed(0)}%`}
        </b>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span>추가매수 안전마진</span>
        <b className="tabular-nums">{insights.safetyMargin.score}점 · {insights.safetyMargin.label}</b>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span>데이터 품질</span>
        <b>{insights.dataQuality.label}</b>
      </div>
      {insights.fxHeadwind && (
        <div className="flex items-center justify-between gap-2">
          <span>환율 민감도</span>
          <b className={`tabular-nums ${fxTone}`}>
            {insights.fxHeadwind.label} {pct1(insights.fxHeadwind.contribution)}
          </b>
        </div>
      )}
    </div>
  );
}

function ValueRow({ pos52, pos5y }: { pos52: number; pos5y: number }) {
  const band = (p: number) => (p < 0.3 ? "하단(싼 편)" : p < 0.7 ? "중간" : "상단(비싼 편)");
  return (
    <div className="mt-1 text-[11px] text-zinc-500">
      <span className="text-zinc-400">📍 가격 위치: </span>
      <span className="tabular-nums">1년 {band(pos52)} ({(pos52 * 100).toFixed(0)}%)</span>
      <span className="text-zinc-400"> · </span>
      <span className="tabular-nums">5년 {band(pos5y)} ({(pos5y * 100).toFixed(0)}%)</span>
    </div>
  );
}

/** 펀더멘털 한 줄 (PER·ROE 등) */
function FundamentalsRow({ f }: { f: Fundamentals }) {
  const chips: string[] = [];
  if (f.per != null) chips.push(`PER ${f.per.toFixed(1)}`);
  if (f.pbr != null) chips.push(`PBR ${f.pbr.toFixed(2)}`);
  if (f.roe != null) chips.push(`ROE ${(f.roe * 100).toFixed(0)}%`);
  if (f.dividendYield != null && f.dividendYield > 0) chips.push(`배당 ${(f.dividendYield * 100).toFixed(1)}%`);
  if (chips.length === 0) return null;
  return (
    <div className="mt-2 text-[11px] text-zinc-500">
      <span className="text-zinc-400">📋 회사 체력: </span>
      <span className="tabular-nums">{chips.join(" · ")}</span>
      {f.notes[0] && <span className="text-zinc-400"> — {f.notes[0]}</span>}
    </div>
  );
}

/** ② 원화 수익 분해 (미국주식) */
function FxRow({ fx }: { fx: Fx }) {
  return (
    <div className="mt-1 text-[11px] text-zinc-500">
      <span className="text-zinc-400">💱 원화 3개월 </span>
      <b className="tabular-nums">{pct1(fx.totalKrw)}</b>
      <span className="text-zinc-400"> = 주가 </span>
      <span className="tabular-nums">{pct1(fx.stockUsd)}</span>
      <span className="text-zinc-400"> + 환율 </span>
      <span className="tabular-nums">{pct1(fx.fx)}</span>
    </div>
  );
}

function StarterCard({
  title,
  subtitle,
  items,
  color,
  won0,
}: {
  title: string;
  subtitle: string;
  items: Sizing[];
  color: string;
  won0: (n: number) => string;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className={`text-sm font-semibold ${color}`}>{title}</div>
      <div className="mb-2 text-xs text-zinc-400">{subtitle}</div>
      {items.length === 0 ? (
        <p className="text-xs text-zinc-400">후보 없음</p>
      ) : (
        <ul className="space-y-1">
          {items.map((p) => (
            <li key={p.symbol} className="flex items-center justify-between text-sm">
              <span>{p.name}</span>
              <span className="tabular-nums">
                <b>{won0(p.amount)}원</b>
                <span className="ml-1 text-xs text-zinc-400">({(p.weight * 100).toFixed(0)}%)</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
