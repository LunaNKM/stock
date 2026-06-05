/**
 * 한국 투자자 기준 세금·비용 모델 (기능 A) — "내 손에 남는 돈".
 * ----------------------------------------------------------
 * 상용 서비스가 안 보여주는, 세전 수익률의 거품을 걷어낸 실질 수익.
 * 2025년 기준의 단순화 모델이며, 개인별 상황(증권사 우대·금융소득 종합과세 등)에
 * 따라 달라지므로 "대략 이만큼 빠진다"는 참고용 추정입니다.
 */

export type Costs = {
  fxSpreadPct: number; // 환전 스프레드(편도, %). 매수·매도 양쪽에서 발생
  usCommissionPct: number; // 미국주식 매매 수수료(편도, %)
  krCommissionPct: number; // 한국주식 매매 수수료(편도, %)
  krSellTaxPct: number; // 한국주식 거래세(매도 시, %)
  dividendTaxPct: number; // 배당소득세 (보유세, %)
  usCapGainsTaxPct: number; // 미국주식 양도소득세 (%)
  usCapGainsDeductionKrw: number; // 미국주식 양도세 연 기본공제(원)
};

/** 일반적인 소액 투자자 기준 기본값 (보수적으로 약간 높게 잡음) */
export const DEFAULT_COSTS: Costs = {
  fxSpreadPct: 0.4, // 우대 환율 가정(미우대면 ~1%). 편도
  usCommissionPct: 0.07, // 미국주식 약 0.07%
  krCommissionPct: 0.0140757, // 한국주식 약 0.015%
  krSellTaxPct: 0.18, // 2025년 코스피/코스닥 거래세 0.18% (매도)
  dividendTaxPct: 15.4, // 배당소득세 14% + 지방세 1.4%
  usCapGainsTaxPct: 22, // 양도소득세 20% + 지방세 2%
  usCapGainsDeductionKrw: 2_500_000, // 연 250만원 기본공제
};

export type NetInput = {
  market: "KR" | "US";
  invested: number; // 원금(원)
  finalValue: number; // 세전 평가액(배당 재투자 포함, 원)
  dividends: number; // 추정 배당 합계(원) — 수정종가-종가 차이로 근사
};

export type NetResult = {
  invested: number;
  grossFinal: number; // 세전 평가액
  netFinal: number; // 세후·비용 차감 후 손에 쥐는 금액
  grossProfit: number;
  netProfit: number;
  totalCost: number; // 빠져나간 세금+비용 합계
  breakdown: {
    fee: number; // 매매수수료(매수+매도)
    fx: number; // 환전 스프레드(매수+매도, 미국만)
    dividendTax: number; // 배당세
    capitalGainsTax: number; // 양도세(미국) / 거래세(한국)
  };
  grossReturnPct: number;
  netReturnPct: number;
};

/**
 * 여러 자산(시장 혼재)의 세후 실질수익을 합산.
 * - 양도세 기본공제(250만)는 미국주식 전체 합산 차익에 한 번만 적용.
 * - 배당은 보유 중 과세되므로 평가액에서 차감.
 */
export function netReturns(items: NetInput[], costs: Costs = DEFAULT_COSTS): NetResult {
  let invested = 0;
  let grossFinal = 0;
  let fee = 0;
  let fx = 0;
  let dividendTax = 0;
  let capitalGainsTax = 0;
  let usGainSum = 0; // 미국 차익 합 (공제 적용 전)

  for (const it of items) {
    invested += it.invested;
    grossFinal += it.finalValue;

    const priceGain = it.finalValue - it.invested; // 배당 포함 총차익

    // 배당세 (보유 중 과세)
    dividendTax += Math.max(0, it.dividends) * (costs.dividendTaxPct / 100);

    if (it.market === "US") {
      // 환전: 매수(원금)와 매도(평가액) 양쪽에 스프레드
      fee += (it.invested + it.finalValue) * (costs.usCommissionPct / 100);
      fx += (it.invested + it.finalValue) * (costs.fxSpreadPct / 100);
      usGainSum += priceGain;
    } else {
      fee += it.invested * (costs.krCommissionPct / 100);
      fee += it.finalValue * (costs.krCommissionPct / 100);
      // 한국 소액주주는 양도세 없음. 매도 시 거래세만.
      capitalGainsTax += it.finalValue * (costs.krSellTaxPct / 100);
    }
  }

  // 미국 양도세: 합산 차익에서 250만 공제 후 22%
  const usTaxable = Math.max(0, usGainSum - costs.usCapGainsDeductionKrw);
  capitalGainsTax += usTaxable * (costs.usCapGainsTaxPct / 100);

  const totalCost = fee + fx + dividendTax + capitalGainsTax;
  const netFinal = grossFinal - totalCost;

  return {
    invested,
    grossFinal,
    netFinal,
    grossProfit: grossFinal - invested,
    netProfit: netFinal - invested,
    totalCost,
    breakdown: { fee, fx, dividendTax, capitalGainsTax },
    grossReturnPct: invested > 0 ? (grossFinal - invested) / invested : 0,
    netReturnPct: invested > 0 ? (netFinal - invested) / invested : 0,
  };
}

/** 통화별 무위험수익률 (샤프지수용). 한국·미국 금리가 달라 분리. */
export const RISK_FREE: Record<"KR" | "US", number> = {
  KR: 0.032, // 한국 기준금리·국고채 대략
  US: 0.043, // 미국 단기물 대략
};
