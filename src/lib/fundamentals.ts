/**
 * 펀더멘털 해석 (가격이 아니라 "회사가 싼가/좋은가").
 * 순수 가격분석의 가장 큰 구멍을 메운다. yahoo quoteSummary 원자료를
 * 초보가 읽을 수 있는 한 줄 평가로 바꿔준다. (휴리스틱이며 절대 기준 아님)
 */
import type { FundamentalsRaw } from "./stocks";

export type ValuationTone = "cheap" | "fair" | "rich" | "unknown";

export type FundamentalView = FundamentalsRaw & {
  valuation: ValuationTone;
  valuationLabel: string; // "저평가 구간" 등
  notes: string[]; // 쉬운 말 한 줄 평가들
};

/**
 * PER/PBR/ROE/성장 등을 종합해 대략적인 "싸냐/비싸냐" 톤을 매긴다.
 * 업종마다 적정 PER이 달라 완벽하진 않으므로 raw 수치도 함께 노출한다.
 */
export function interpretFundamentals(f: FundamentalsRaw): FundamentalView {
  const notes: string[] = [];
  let cheapPts = 0; // +면 싸 보임, -면 비싸 보임
  let scored = 0;

  if (f.per != null) {
    scored++;
    if (f.per <= 0) notes.push("적자(PER 음수) — 이익 기준 평가 어려움");
    else if (f.per < 12) { cheapPts += 1; notes.push(`PER ${f.per.toFixed(1)} — 이익 대비 저렴한 편`); }
    else if (f.per > 30) { cheapPts -= 1; notes.push(`PER ${f.per.toFixed(1)} — 기대가 많이 반영된 비싼 편`); }
    else notes.push(`PER ${f.per.toFixed(1)} — 보통 수준`);
  }
  if (f.pbr != null) {
    scored++;
    if (f.pbr < 1) { cheapPts += 1; notes.push(`PBR ${f.pbr.toFixed(2)} — 순자산보다 싸게 거래`); }
    else if (f.pbr > 5) { cheapPts -= 1; notes.push(`PBR ${f.pbr.toFixed(1)} — 자산 대비 고평가`); }
  }
  if (f.forwardPer != null && f.per != null && f.per > 0 && f.forwardPer > 0) {
    if (f.forwardPer < f.per * 0.85) notes.push("예상 PER이 낮아짐 — 이익 성장 기대");
  }
  if (f.roe != null) {
    if (f.roe >= 0.15) notes.push(`ROE ${(f.roe * 100).toFixed(0)}% — 자본을 잘 굴리는 우량 체질`);
    else if (f.roe < 0) notes.push(`ROE ${(f.roe * 100).toFixed(0)}% — 수익성 부진`);
  }
  if (f.revenueGrowth != null) {
    if (f.revenueGrowth >= 0.15) notes.push(`매출성장 +${(f.revenueGrowth * 100).toFixed(0)}% — 외형 성장 중`);
    else if (f.revenueGrowth < 0) notes.push(`매출 역성장 ${(f.revenueGrowth * 100).toFixed(0)}% — 주의`);
  }
  if (f.dividendYield != null && f.dividendYield > 0) {
    notes.push(`배당수익률 ${(f.dividendYield * 100).toFixed(1)}%`);
  }

  let valuation: ValuationTone = "unknown";
  let valuationLabel = "정보 부족";
  if (scored > 0) {
    if (cheapPts >= 1) { valuation = "cheap"; valuationLabel = "저평가 구간"; }
    else if (cheapPts <= -1) { valuation = "rich"; valuationLabel = "고평가 구간"; }
    else { valuation = "fair"; valuationLabel = "적정 구간"; }
  }

  return { ...f, valuation, valuationLabel, notes: notes.slice(0, 4) };
}
