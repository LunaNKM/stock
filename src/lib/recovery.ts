/**
 * 하락장 회복 프로파일 (기능 C) — "얼마나 빠졌나"보다 "얼마나 오래 물려 있었나".
 * ----------------------------------------------------------
 * 초보가 손절하는 진짜 이유는 낙폭의 깊이보다 회복까지의 "기간"이다.
 * 전고점을 회복하지 못하고 물속(underwater)에 잠겨 있던 최장 구간을 잰다.
 */

export type DrawdownProfile = {
  worstDrawdown: number; // 최대 낙폭 (음수)
  worstDrawdownDate: string | null; // 그 저점 날짜
  longestUnderwaterDays: number; // 전고점→회복까지 걸린 최장 거래일 수
  longestUnderwaterMonths: number; // 위를 개월로 환산(≈21거래일)
  stillUnderwater: boolean; // 지금도 직전 고점 아래인가
  currentUnderwaterDays: number; // 현재 물려 있는 기간(거래일)
};

const TRADING_DAYS_PER_MONTH = 21;

/**
 * @param index 바구니/종목의 누적 가치 지수 (1에서 시작, 수정종가 기반)
 * @param dates index와 같은 길이의 날짜(YYYY-MM-DD)
 */
export function drawdownProfile(index: number[], dates: string[]): DrawdownProfile {
  if (index.length === 0) {
    return {
      worstDrawdown: 0, worstDrawdownDate: null, longestUnderwaterDays: 0,
      longestUnderwaterMonths: 0, stillUnderwater: false, currentUnderwaterDays: 0,
    };
  }

  let peak = index[0];
  let worstDrawdown = 0;
  let worstDrawdownDate: string | null = null;

  let longestUnderwaterDays = 0;
  let underwaterStart = -1; // 마지막으로 신고점을 찍은 인덱스
  let currentUnderwaterDays = 0;

  for (let i = 0; i < index.length; i++) {
    if (index[i] >= peak) {
      // 전고점 회복(또는 갱신) → 직전 물속 구간 종료
      if (underwaterStart >= 0) {
        const span = i - underwaterStart;
        if (span > longestUnderwaterDays) longestUnderwaterDays = span;
      }
      peak = index[i];
      underwaterStart = -1;
      currentUnderwaterDays = 0;
    } else {
      if (underwaterStart < 0) underwaterStart = i - 1; // 직전 고점 시점부터
      currentUnderwaterDays = i - underwaterStart;
      const dd = (index[i] - peak) / peak;
      if (dd < worstDrawdown) {
        worstDrawdown = dd;
        worstDrawdownDate = dates[i] ?? null;
      }
    }
  }

  const stillUnderwater = underwaterStart >= 0;
  // 끝까지 물속이면 그 구간도 후보
  if (stillUnderwater && currentUnderwaterDays > longestUnderwaterDays) {
    longestUnderwaterDays = currentUnderwaterDays;
  }

  return {
    worstDrawdown,
    worstDrawdownDate,
    longestUnderwaterDays,
    longestUnderwaterMonths: Math.round(longestUnderwaterDays / TRADING_DAYS_PER_MONTH),
    stillUnderwater,
    currentUnderwaterDays,
  };
}
