/**
 * 점수 신뢰도 백테스트 (기능 ①) — "이 점수, 믿어도 돼?"
 * ----------------------------------------------------------
 * 과거 모든 시점에서 같은 채점 엔진(scoreAt)을 돌려, 점수가 높았을 때
 * 그 뒤 실제로 올랐는지를 집계한다. 상용 서비스가 안 해주는 "점수의 성적표".
 *
 * ⚠️ 과거 통계일 뿐 미래 보장이 아니며, 후보가 우량주 위주라 생존편향이 있다.
 */
import { precompute, scoreAt } from "./scoring";

export type Reliability = {
  horizonDays: number; // 미래를 며칠(거래일) 본 것인가
  threshold: number; // "좋음"으로 본 점수 기준
  samples: number; // 점수 >= threshold 였던 표본 수
  winRate: number | null; // 그 중 horizon 뒤 올라 있던 비율 0~1
  avgForward: number | null; // 그때 평균 미래수익률
  baseWinRate: number; // 점수 무관 전체 평균 상승확률 (비교 기준선)
  baseAvgForward: number; // 점수 무관 전체 평균 미래수익률
  enough: boolean; // 표본이 통계적으로 말할 만큼 되는가
};

/**
 * @param closes  최대한 긴 종가 시계열(가급적 3~5년)
 * @param volumes 같은 길이의 거래량
 */
export function backtestReliability(
  closes: number[],
  volumes: number[],
  opts: { horizonDays?: number; threshold?: number; step?: number; warmup?: number } = {},
): Reliability {
  const horizonDays = opts.horizonDays ?? 126; // 약 6개월
  const threshold = opts.threshold ?? 70;
  const step = opts.step ?? 3; // 3거래일마다 샘플 (속도/표본 균형)
  const warmup = opts.warmup ?? 130; // sma120 등 지표가 안정되는 구간

  const pre = precompute(closes, volumes);

  let hiWins = 0, hiCount = 0, hiSum = 0;
  let allWins = 0, allCount = 0, allSum = 0;

  for (let t = warmup; t + horizonDays < closes.length; t += step) {
    if (closes[t] <= 0) continue;
    const fwd = closes[t + horizonDays] / closes[t] - 1;
    const { score } = scoreAt(pre, t);

    allCount++;
    allSum += fwd;
    if (fwd > 0) allWins++;

    if (score >= threshold) {
      hiCount++;
      hiSum += fwd;
      if (fwd > 0) hiWins++;
    }
  }

  const enough = hiCount >= 8 && allCount >= 30;
  return {
    horizonDays,
    threshold,
    samples: hiCount,
    winRate: hiCount > 0 ? hiWins / hiCount : null,
    avgForward: hiCount > 0 ? hiSum / hiCount : null,
    baseWinRate: allCount > 0 ? allWins / allCount : 0,
    baseAvgForward: allCount > 0 ? allSum / allCount : 0,
    enough,
  };
}
