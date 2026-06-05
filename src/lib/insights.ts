import type { Alpha } from "./alpha";
import type { Reliability } from "./backtest";
import { depositFutureValueWithInitial } from "./deposit";
import type { FxDecomp } from "./fx";
import type { FundamentalView } from "./fundamentals";

const DAY_MS = 24 * 60 * 60 * 1000;

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export type ScoreErrorProfile = {
  lossRate: number | null;
  edgeWinRate: number | null;
  label: string;
  enough: boolean;
};

export function scoreErrorProfile(r: Reliability): ScoreErrorProfile {
  if (!r.enough || r.winRate == null) {
    return {
      lossRate: null,
      edgeWinRate: null,
      label: "표본 부족",
      enough: false,
    };
  }

  const lossRate = 1 - r.winRate;
  const edgeWinRate = r.winRate - r.baseWinRate;
  const label =
    lossRate <= 0.35 ? "오답률 낮음" :
    lossRate <= 0.5 ? "보통" :
    "오답률 높음";

  return { lossRate, edgeWinRate, label, enough: true };
}

export type FxHeadwind = {
  contribution: number;
  label: string;
  tone: "good" | "neutral" | "bad";
};

export function fxHeadwind(fx: FxDecomp | null): FxHeadwind | null {
  if (!fx) return null;
  const contribution = fx.totalKrw - fx.stockUsd;
  if (contribution <= -0.03) return { contribution, label: "환율 역풍", tone: "bad" };
  if (contribution >= 0.03) return { contribution, label: "환율 순풍", tone: "good" };
  return { contribution, label: "환율 영향 작음", tone: "neutral" };
}

export type SafetyMargin = {
  score: number;
  label: string;
  room: number;
};

export function safetyMargin(input: {
  pos52: number;
  pos5y: number;
  rsi: number | null;
  volatility: number;
  fundamentals: FundamentalView;
}): SafetyMargin {
  const position = 0.5 * input.pos52 + 0.5 * input.pos5y;
  const room = clamp(1 - position, 0, 1);
  let score = room * 55;

  if (input.fundamentals.valuation === "cheap") score += 24;
  else if (input.fundamentals.valuation === "fair") score += 14;
  else if (input.fundamentals.valuation === "rich") score -= 10;

  if (input.rsi != null) {
    if (input.rsi < 35) score += 14;
    else if (input.rsi <= 60) score += 8;
    else if (input.rsi >= 70) score -= 12;
  }

  score -= clamp((input.volatility - 0.25) * 80, 0, 24);
  const rounded = Math.round(clamp(score, 0, 100));
  const label = rounded >= 70 ? "여유 있음" : rounded >= 45 ? "분할 진입" : "안전마진 얇음";

  return { score: rounded, label, room };
}

export type RealKrwAlpha = {
  score: number;
  label: string;
  realAlphaPct: number;
  components: {
    timingAlpha: number;
    reliabilityEdge: number;
    fxContribution: number;
    riskPenalty: number;
  };
};

export function realKrwAlpha(input: {
  alpha: Alpha;
  reliability: Reliability;
  fx: FxDecomp | null;
  volatility: number;
  maxDrawdown: number;
}): RealKrwAlpha {
  const timingAlpha = input.alpha.enough ? input.alpha.alpha : 0;
  const reliabilityEdge =
    input.reliability.enough && input.reliability.avgForward != null
      ? input.reliability.avgForward - input.reliability.baseAvgForward
      : 0;
  const fxContribution = input.fx ? input.fx.totalKrw - input.fx.stockUsd : 0;
  const riskPenalty =
    clamp(input.volatility - 0.25, 0, 1) * 0.12 +
    clamp(Math.abs(input.maxDrawdown) - 0.25, 0, 1) * 0.18;
  const realAlphaPct = timingAlpha + reliabilityEdge + fxContribution - riskPenalty;
  const score = Math.round(clamp(50 + realAlphaPct * 260, 0, 100));
  const label = score >= 70 ? "원화 실질 우위" : score >= 45 ? "중립" : "실질 매력 낮음";

  return {
    score,
    label,
    realAlphaPct,
    components: { timingAlpha, reliabilityEdge, fxContribution, riskPenalty },
  };
}

export type ConcentrationInsight = {
  illusionScore: number;
  effectiveCount: number;
  topPair: { a: string; b: string; corr: number } | null;
  label: string;
};

export function concentrationInsight(symbols: string[], matrix: number[][], avgCorrelation: number): ConcentrationInsight {
  const n = symbols.length;
  let topPair: ConcentrationInsight["topPair"] = null;

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const corr = matrix[i]?.[j] ?? 0;
      if (!topPair || corr > topPair.corr) topPair = { a: symbols[i], b: symbols[j], corr };
    }
  }

  const positiveCorr = clamp(avgCorrelation, 0, 0.95);
  const effectiveCount = n <= 1 ? n : n / (1 + (n - 1) * positiveCorr);
  const compression = n > 0 ? 1 - effectiveCount / n : 0;
  const illusionScore = Math.round(clamp(positiveCorr * 70 + compression * 30, 0, 100));
  const label =
    illusionScore >= 70 ? "겉보기보다 집중" :
    illusionScore >= 45 ? "분산 효과 제한" :
    "분산 양호";

  return { illusionScore, effectiveCount, topPair, label };
}

export type DepositBeatProfile = {
  checkpoints: number;
  winRate: number | null;
  latestEdge: number;
  worstEdge: number;
  bestEdge: number;
  enough: boolean;
};

export function depositBeatProfile(
  monthlySeries: { value: number; months: number }[],
  monthly: number,
  annualRate: number,
  initial = 0,
): DepositBeatProfile {
  let wins = 0;
  let checkpoints = 0;
  let latestEdge = 0;
  let worstEdge = Number.POSITIVE_INFINITY;
  let bestEdge = Number.NEGATIVE_INFINITY;

  for (const point of monthlySeries) {
    if (point.months < 12) continue;
    const deposit = depositFutureValueWithInitial(monthly, point.months, annualRate, initial);
    const edge = point.value - deposit;
    latestEdge = edge;
    worstEdge = Math.min(worstEdge, edge);
    bestEdge = Math.max(bestEdge, edge);
    if (edge > 0) wins++;
    checkpoints++;
  }

  return {
    checkpoints,
    winRate: checkpoints > 0 ? wins / checkpoints : null,
    latestEdge,
    worstEdge: Number.isFinite(worstEdge) ? worstEdge : 0,
    bestEdge: Number.isFinite(bestEdge) ? bestEdge : 0,
    enough: checkpoints >= 6,
  };
}

export type DataQuality = {
  lastDate: string | null;
  staleDays: number | null;
  historyDays: number;
  fundamentalsCoverage: number;
  label: string;
};

export type DecisionGate = {
  status: "review" | "small" | "hold" | "block";
  label: string;
  tone: "good" | "caution" | "bad" | "neutral";
  reasons: string[];
  checklist: string[];
};

export function decisionGate(input: {
  score: number;
  category: "core" | "satellite";
  volatility: number;
  rsi: number | null;
  pos52: number;
  realKrwAlpha: RealKrwAlpha;
  scoreError: ScoreErrorProfile;
  safetyMargin: SafetyMargin;
  dataQuality: DataQuality;
  fundamentals: FundamentalView;
}): DecisionGate {
  const reasons: string[] = [];
  let status: DecisionGate["status"] = "hold";

  if (input.dataQuality.historyDays < 180 || input.dataQuality.fundamentalsCoverage < 0.15) {
    reasons.push("판단에 필요한 가격/재무 데이터가 부족합니다.");
    status = "block";
  }
  if (input.dataQuality.staleDays != null && input.dataQuality.staleDays > 7) {
    reasons.push("시세 기준일이 오래되어 실제 주문 전 확인이 필요합니다.");
    if (status !== "block") status = "hold";
  }
  if (input.scoreError.lossRate != null && input.scoreError.lossRate > 0.55) {
    reasons.push("과거 고점수 구간의 오답률이 높았습니다.");
    if (status !== "block") status = "hold";
  }
  if (input.realKrwAlpha.score < 35) {
    reasons.push("세금/환율/위험을 반영한 원화 기준 매력이 낮습니다.");
    if (status !== "block") status = "hold";
  }
  if (input.volatility > 0.55) {
    reasons.push("변동성이 커서 소액 검토도 신중해야 합니다.");
    if (status !== "block") status = "hold";
  }
  if (input.rsi != null && input.rsi >= 75 && input.pos52 >= 0.9) {
    reasons.push("단기 과열과 52주 고점권이 겹쳐 추격 검토를 보류합니다.");
    if (status !== "block") status = "hold";
  }
  if (input.category === "satellite" && input.fundamentals.valuation === "rich" && input.safetyMargin.score < 40) {
    reasons.push("개별주인데 고평가와 낮은 가격 여유가 함께 나타납니다.");
    if (status !== "block") status = "hold";
  }

  if (status !== "block" && reasons.length === 0) {
    if (input.score >= 70 && input.realKrwAlpha.score >= 55 && input.safetyMargin.score >= 45) {
      status = input.category === "core" ? "review" : "small";
    } else if (input.score >= 50 && input.realKrwAlpha.score >= 40) {
      status = "small";
    } else {
      status = "hold";
      reasons.push("점수나 원화 실질 지표가 강하지 않아 기다리는 쪽이 낫습니다.");
    }
  }

  const label =
    status === "review" ? "검토 가능" :
    status === "small" ? "소액만 검토" :
    status === "block" ? "차단" :
    "보류";
  const tone =
    status === "review" ? "good" :
    status === "small" ? "caution" :
    status === "block" ? "bad" :
    "neutral";

  return {
    status,
    label,
    tone,
    reasons: reasons.slice(0, 3),
    checklist: [
      "ETF 대신 이 종목을 사야 하는 이유를 한 문장으로 말할 수 있나요?",
      "-20% 하락해도 팔지 않을 이유와 금액 한도를 정했나요?",
      "전체 자산에서 이 종목과 같은 테마 비중이 과하지 않나요?",
      "최근 실적, 공시, 다음 이벤트 일정을 확인했나요?",
      "실제 주문 전 증권사 앱의 현재가와 호가를 다시 확인했나요?",
    ],
  };
}

export function dataQuality(input: {
  lastDate: string | null;
  historyDays: number;
  fundamentals: FundamentalView;
  now?: Date;
}): DataQuality {
  const now = input.now ?? new Date();
  const staleDays = input.lastDate
    ? Math.max(0, Math.floor((now.getTime() - new Date(input.lastDate).getTime()) / DAY_MS))
    : null;
  const fields: (keyof FundamentalView)[] = [
    "per", "forwardPer", "pbr", "roe", "dividendYield", "revenueGrowth", "earningsGrowth", "profitMargin", "marketCap",
  ];
  const known = fields.filter((key) => input.fundamentals[key] != null).length;
  const fundamentalsCoverage = known / fields.length;
  const label =
    input.historyDays < 180 ? "가격 이력 짧음" :
    staleDays != null && staleDays > 7 ? "시세 오래됨" :
    fundamentalsCoverage < 0.35 ? "재무정보 부족" :
    "양호";

  return {
    lastDate: input.lastDate,
    staleDays,
    historyDays: input.historyDays,
    fundamentalsCoverage,
    label,
  };
}
