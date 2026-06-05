/**
 * 예적금 대비 초과수익 (기능 D) — 한국 초보의 진짜 대안은 주식이 아니라 예금이다.
 * ----------------------------------------------------------
 * 같은 돈을 매달 정기적금(연 X%)에 넣었다면 지금 얼마였을지 계산해,
 * "주식을 해서 예금보다 얼마나 더/덜 벌었나(기회비용)"를 보여준다.
 */

export type DepositCompare = {
  annualRate: number; // 가정한 연이율 (예: 0.035)
  depositFinal: number; // 세후 예금 만기 평가액
  excessOverDeposit: number; // 포트폴리오 세후 - 예금 세후 (양수면 주식 승)
  beatDeposit: boolean;
};

const INTEREST_TAX = 0.154; // 이자소득세 15.4%

/**
 * 매달 monthly원을 months개월간 적립식 예금에 넣었을 때의 세후 만기액.
 * 매월 말 복리, 이자에 15.4% 과세 가정(단순화).
 */
export function depositFutureValue(monthly: number, months: number, annualRate: number): number {
  return depositFutureValueWithInitial(monthly, months, annualRate, 0);
}

export function depositFutureValueWithInitial(
  monthly: number,
  months: number,
  annualRate: number,
  initial = 0,
): number {
  const r = annualRate / 12;
  let principal = Math.max(0, initial);
  let value = principal;
  for (let i = 0; i < months; i++) {
    value = (value + monthly) * (1 + r);
    principal += monthly;
  }
  const interest = value - principal;
  return principal + interest * (1 - INTEREST_TAX);
}

export function compareToDeposit(
  monthly: number,
  months: number,
  portfolioNetFinal: number,
  annualRate = 0.035,
  initial = 0,
): DepositCompare {
  const depositFinal = depositFutureValueWithInitial(monthly, months, annualRate, initial);
  const excess = portfolioNetFinal - depositFinal;
  return {
    annualRate,
    depositFinal,
    excessOverDeposit: excess,
    beatDeposit: excess > 0,
  };
}
