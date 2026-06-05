"use client";

import { useState } from "react";
import LineChart from "@/components/LineChart";
import { HelpBox, Define, Hint } from "@/components/Help";

type Net = {
  invested: number;
  grossFinal: number;
  netFinal: number;
  grossProfit: number;
  netProfit: number;
  totalCost: number;
  breakdown: { fee: number; fx: number; dividendTax: number; capitalGainsTax: number };
  grossReturnPct: number;
  netReturnPct: number;
};
type Deposit = {
  annualRate: number;
  depositFinal: number;
  excessOverDeposit: number;
  beatDeposit: boolean;
};
type DepositBeat = {
  checkpoints: number;
  winRate: number | null;
  latestEdge: number;
  worstEdge: number;
  bestEdge: number;
  enough: boolean;
};
type Recovery = {
  worstDrawdown: number;
  worstDrawdownDate: string | null;
  longestUnderwaterDays: number;
  longestUnderwaterMonths: number;
  stillUnderwater: boolean;
  currentUnderwaterDays: number;
};
type Sim = {
  start: string;
  end: string;
  months: number;
  monthly: number;
  initial: number;
  invested: number;
  finalValue: number;
  profit: number;
  returnPct: number;
  dividends: number;
  worstDrawdown: number;
  recovery: Recovery;
  basketVol: number;
  net: Net;
  deposit: Deposit;
  depositBeat: DepositBeat;
  series: { date: string; value: number; invested: number }[];
};

const won = (n: number) => new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 0 }).format(Math.round(n)) + "원";
const pct1 = (n: number) => `${n >= 0 ? "+" : ""}${(n * 100).toFixed(1)}%`;

export default function SimulatorPage() {
  const [monthly, setMonthly] = useState(300000);
  const [initial, setInitial] = useState(0);
  const [years, setYears] = useState(3);
  const [depositRate, setDepositRate] = useState(3.5);
  const [tolerance, setTolerance] = useState(20); // 감내 가능한 최대 낙폭(%)
  const [data, setData] = useState<Sim | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const params = new URLSearchParams({
        monthly: String(monthly),
        years: String(years),
        initial: String(initial),
        depositRate: String(depositRate / 100),
      });
      const res = await fetch(`/api/simulate?${params.toString()}`, { cache: "no-store" });
      if (!res.ok) throw new Error((await res.json()).error ?? "실패");
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "시뮬레이션 실패");
    } finally {
      setLoading(false);
    }
  }

  const worstLoss = data ? monthly * 12 * Math.abs(data.worstDrawdown) : 0; // 1년치 적립금 기준 체감용

  return (
    <main className="mx-auto max-w-5xl px-5 py-8">
      <header className="mb-4">
        <h1 className="text-2xl font-bold">🎮 시뮬레이터</h1>
        <p className="text-sm text-zinc-500">
          “과거에 이 후보들에 매달 적립했다면?”을 실데이터로 돌려보고, 하락장도 미리 겪어봐요
        </p>
      </header>

      <HelpBox title="이게 뭐예요? (꼭 읽어보세요)" defaultOpen>
        <p>
          <b>적립식 백테스트</b>는 후보 종목 바구니에 <b>코어75:새틀25 비중으로 매달 정액 적립</b>했다고
          가정해 지금 평가액을 계산해요. <b>하락장 시뮬레이터</b>는 그 바구니가 과거에 겪은 가장 큰
          고점→저점 낙폭을 보여줘 “버틸 수 있는지” 미리 가늠하게 해줍니다.
        </p>
        <Define term="평가액 vs 원금">넣은 돈(원금) 대비 지금 얼마가 됐는지</Define>
        <Define term="최악 낙폭(MDD)">한때 고점에서 최대로 빠졌던 폭 — 이만큼 떨어져도 안 팔 수 있나요?</Define>
        <Define term="세후 실질수익">양도세·배당세·환전·수수료를 다 뺀 ‘진짜 손에 쥐는 돈’ (상용 서비스는 안 보여줘요)</Define>
        <Define term="예금 대비">같은 돈을 정기적금에 넣었을 때보다 얼마나 더/덜 벌었나 (진짜 기회비용)</Define>
        <Define term="회복기간">한 번 빠진 뒤 전고점을 되찾기까지 걸린 최장 기간 — 멘탈이 버티는 건 깊이보다 ‘기간’</Define>
        <p className="text-zinc-500">
          ⚠️ 과거 성과는 미래를 보장하지 않아요. 수익은 <b>배당 재투자(수정종가)</b>로 계산하고, 세금·수수료·환전은
          한국 투자자 기준으로 <b>추정 차감</b>합니다(개인 상황에 따라 달라짐).
        </p>
      </HelpBox>

      <section className="mb-6 flex flex-wrap items-end gap-3 rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
        <label className="text-sm">
          <span className="mb-1 block text-zinc-500">월 적립액</span>
          <select
            value={monthly}
            onChange={(e) => setMonthly(Number(e.target.value))}
            className="rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          >
            {[100000, 200000, 300000, 500000, 1000000].map((v) => (
              <option key={v} value={v}>{won(v)}</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-zinc-500">예금금리(%)</span>
          <input
            type="number"
            min={0}
            max={10}
            step={0.1}
            value={depositRate}
            onChange={(e) => setDepositRate(Number(e.target.value))}
            className="w-24 rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-zinc-500">현재 투입금</span>
          <input
            type="number"
            min={0}
            step={100000}
            value={initial}
            onChange={(e) => setInitial(Number(e.target.value))}
            className="w-36 rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-zinc-500">기간</span>
          <select
            value={years}
            onChange={(e) => setYears(Number(e.target.value))}
            className="rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          >
            {[1, 2, 3, 5].map((v) => (
              <option key={v} value={v}>{v}년</option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-zinc-500">내가 견딜 수 있는 낙폭</span>
          <select
            value={tolerance}
            onChange={(e) => setTolerance(Number(e.target.value))}
            className="rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900"
          >
            {[10, 20, 30, 50].map((v) => (
              <option key={v} value={v}>-{v}%까지</option>
            ))}
          </select>
        </label>
        <button
          onClick={run}
          disabled={loading}
          className="rounded-lg bg-zinc-900 px-5 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-white dark:text-zinc-900"
        >
          {loading ? "계산 중…" : "시뮬레이션 실행"}
        </button>
      </section>

      {error && <div className="mb-4 rounded-lg border border-rose-300 bg-rose-50 p-4 text-sm text-rose-700">⚠️ {error}</div>}

      {data && (
        <>
          <section className="mb-6 grid gap-3 sm:grid-cols-3">
            <Stat label="원금 (적립 합계)" value={won(data.invested)} sub={`${data.months}개월 적립`} />
            <Stat
              label="현재 평가액"
              value={won(data.finalValue)}
              sub={pct1(data.returnPct)}
              tone={data.profit >= 0 ? "up" : "down"}
            />
            <Stat
              label="평가손익"
              value={(data.profit >= 0 ? "+" : "") + won(data.profit)}
              sub={`연변동성 ${(data.basketVol * 100).toFixed(0)}%`}
              tone={data.profit >= 0 ? "up" : "down"}
            />
          </section>

          {/* A) 세후 실질수익 — 상용이 안 보여주는 '내 손에 남는 돈' */}
          <section className="mb-6 rounded-xl border border-violet-200 bg-violet-50/40 p-5 dark:border-violet-900/40 dark:bg-violet-950/10">
            <h2 className="mb-1 font-semibold">🇰🇷 세금·비용 빼면 진짜 얼마? (세후 실질수익)</h2>
            <p className="mb-3 text-sm text-zinc-600 dark:text-zinc-400">
              세전 <b>{won(data.net.grossFinal)}</b>처럼 보여도, 세금·수수료·환전을 빼면 실제로 손에 쥐는 건
              아래 금액이에요.
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <Stat label="세후 평가액" value={won(data.net.netFinal)} sub={pct1(data.net.netReturnPct)} tone={data.net.netProfit >= 0 ? "up" : "down"} />
              <Stat label="빠져나간 세금·비용" value={"-" + won(data.net.totalCost)} sub={`세전대비 ${pct1(-(data.net.grossFinal > 0 ? data.net.totalCost / data.net.grossFinal : 0))}`} tone="down" />
              <Stat label="추정 배당(재투자)" value={won(data.dividends)} sub="수정종가로 반영됨" />
            </div>
            <Hint>
              내역: 매매수수료 {won(data.net.breakdown.fee)} · 환전 {won(data.net.breakdown.fx)} · 배당세{" "}
              {won(data.net.breakdown.dividendTax)} · 양도세/거래세 {won(data.net.breakdown.capitalGainsTax)}.
              미국주식 양도세는 연 250만원 공제 후 22% 가정.
            </Hint>
          </section>

          {/* D) 예적금 대비 초과수익 — 한국 초보의 진짜 대안 */}
          <section className="mb-6 rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
            <h2 className="mb-1 font-semibold">🏦 그냥 적금에 넣었다면? (기회비용)</h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              같은 돈을 연 {(data.deposit.annualRate * 100).toFixed(1)}% 정기적금에 넣었다면 세후 약{" "}
              <b>{won(data.deposit.depositFinal)}</b>이 됐을 거예요.
            </p>
            <p className="mt-2 text-sm">
              👉 이 포트폴리오는 적금보다{" "}
              <b className={data.deposit.beatDeposit ? "text-rose-500" : "text-blue-500"}>
                {data.deposit.excessOverDeposit >= 0 ? "+" : ""}{won(data.deposit.excessOverDeposit)}
              </b>{" "}
              {data.deposit.beatDeposit ? "더 벌었어요." : "오히려 덜 벌었어요 — 위험을 진 보람이 없었던 셈."}
            </p>
          </section>
          <DepositBeatCard beat={data.depositBeat} />

          {data.series.length > 1 && (
            <section className="mb-6 rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
              <h2 className="mb-3 text-sm font-semibold text-zinc-500">원금 vs 평가액 (시간 흐름)</h2>
              <LineChart
                series={[
                  { name: "평가액", color: "#f43f5e", values: data.series.map((s) => s.value) },
                  { name: "원금", color: "#94a3b8", values: data.series.map((s) => s.invested) },
                ]}
              />
            </section>
          )}

          {/* ⑤ 하락장 시뮬레이터 */}
          <section className="rounded-xl border border-blue-200 bg-blue-50/40 p-5 dark:border-blue-900/40 dark:bg-blue-950/10">
            <h2 className="mb-1 font-semibold">📉 하락장에 버틸 수 있나요?</h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              이 바구니는 지난 {years}년간 한때 고점 대비{" "}
              <b className="text-blue-600">{pct1(data.worstDrawdown)}</b>까지 빠진 적이 있어요.
            </p>
            <p className="mt-2 text-sm">
              👉 만약 1년치 적립금 <b>{won(monthly * 12)}</b>이 그 상황을 겪었다면 한때{" "}
              <b className="text-blue-600">약 {won(worstLoss)}</b>이 평가손실로 보였을 수 있어요.
            </p>
            {data.recovery.longestUnderwaterMonths > 0 && (
              <p className="mt-2 text-sm">
                ⏳ 그리고 한 번 빠진 뒤 전고점을 되찾기까지 <b className="text-blue-600">최장 약 {data.recovery.longestUnderwaterMonths}개월</b>{" "}
                물려 있던 적이 있어요{data.recovery.stillUnderwater ? " (지금도 전고점 아래)" : ""}. 낙폭의 깊이보다 이 ‘기간’을 못 견뎌 파는 경우가 많아요.
              </p>
            )}
            <ToleranceVerdict worstDD={Math.abs(data.worstDrawdown)} tolerance={tolerance / 100} />
            <Hint>이 정도 출렁임을 못 견디고 팔면 손실이 확정돼요. 버틸 수 있는 비중·종목만 담는 게 핵심입니다.</Hint>
          </section>

          <p className="mt-4 text-xs text-zinc-400">
            분석 기간: {data.start} ~ {data.end} · 비중 코어75:새틀25(그룹 내 균등) · 데이터: Yahoo Finance ·
            수익은 배당 재투자(수정종가) 기준, 세금·수수료·환전은 한국 투자자 기준 추정 차감 · 참고용.
          </p>
        </>
      )}
    </main>
  );
}

/** C) 위험성향 매칭 — 내가 고른 감내 낙폭 vs 이 바구니의 실제 최악 낙폭 */
function ToleranceVerdict({ worstDD, tolerance }: { worstDD: number; tolerance: number }) {
  const ok = worstDD <= tolerance;
  return (
    <div
      className={`mt-3 rounded-lg px-3 py-2 text-sm ${
        ok
          ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-300"
          : "bg-rose-50 text-rose-800 dark:bg-rose-950/20 dark:text-rose-300"
      }`}
    >
      {ok ? "✅ 감당 가능한 수준" : "🚨 당신이 견디겠다고 한 선을 넘었어요"} — 내가 고른 한계{" "}
      <b>-{(tolerance * 100).toFixed(0)}%</b> vs 이 바구니 실제 최악 <b>-{(worstDD * 100).toFixed(0)}%</b>.
      {!ok && " 비중을 줄이거나 더 안정적인 종목을 섞으세요."}
    </div>
  );
}

function DepositBeatCard({ beat }: { beat: DepositBeat }) {
  const winText = beat.winRate == null ? "표본 부족" : `${(beat.winRate * 100).toFixed(0)}%`;
  return (
    <section className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50/40 p-5 dark:border-emerald-900/40 dark:bg-emerald-950/10">
      <h2 className="mb-1 font-semibold">예금 대비 세후 승률</h2>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        12개월 이상 지난 월별 체크포인트마다 같은 돈을 예금에 넣은 경우와 비교했습니다.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <Stat label="예금 이긴 비율" value={winText} sub={`${beat.checkpoints}개 체크포인트`} tone={beat.winRate != null && beat.winRate >= 0.5 ? "up" : "down"} />
        <Stat label="현재 예금 대비" value={(beat.latestEdge >= 0 ? "+" : "") + won(beat.latestEdge)} tone={beat.latestEdge >= 0 ? "up" : "down"} />
        <Stat label="최악 체크포인트" value={(beat.worstEdge >= 0 ? "+" : "") + won(beat.worstEdge)} tone={beat.worstEdge >= 0 ? "up" : "down"} />
      </div>
      {!beat.enough && <Hint>아직 기간이 짧아 승률은 참고용입니다. 최소 12개월 이후 체크포인트가 쌓일수록 의미가 커집니다.</Hint>}
    </section>
  );
}

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "up" | "down" }) {
  const subColor = tone === "up" ? "text-rose-500" : tone === "down" ? "text-blue-500" : "text-zinc-400";
  return (
    <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="text-xs text-zinc-400">{label}</div>
      <div className="mt-1 text-xl font-extrabold tabular-nums">{value}</div>
      {sub && <div className={`mt-0.5 text-sm font-medium tabular-nums ${subColor}`}>{sub}</div>}
    </div>
  );
}
