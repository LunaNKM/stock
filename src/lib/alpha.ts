/**
 * 점수 알파 (기능 B) — "이 점수, 그냥 매달 적립보다 나아?"
 * ----------------------------------------------------------
 * 상용 서비스는 점수를 팔기만 하지, 그 점수가 "무지성 적립(DCA)"을 실제로
 * 이겼는지는 증명하지 않는다. 여기선 과거 데이터로 두 전략을 나란히 돌린다:
 *
 *   ① 무지성 적립 : 매달 같은 금액
 *   ② 점수 적립   : 점수가 높을 땐 더, 낮을 땐 덜 (같은 평균 금액)
 *
 * 두 전략의 "원금 대비 배수(평가액/원금)"를 money-weighted로 비교한다.
 * 못 이기면 화면에 정직하게 "그냥 적립이 나았다"고 말한다.
 */
import { precompute, scoreAt } from "./scoring";

export type Alpha = {
  enough: boolean; // 표본이 충분한가 (상장기간)
  months: number; // 적립 횟수
  naiveMultiple: number; // 무지성 적립 최종 배수 (평가액/원금)
  scoreMultiple: number; // 점수 적립 최종 배수
  alpha: number; // scoreMultiple - naiveMultiple (양수면 점수가 이김)
  verdict: "score" | "tie" | "naive";
};

/**
 * @param adjcloses 수정종가(배당 반영) 시계열
 * @param volumes   같은 길이 거래량
 */
export function scoreAlpha(
  adjcloses: number[],
  volumes: number[],
  opts: { step?: number; warmup?: number } = {},
): Alpha {
  const step = opts.step ?? 21; // 약 한 달(거래일)
  const warmup = opts.warmup ?? 130; // 지표 안정 구간
  const pre = precompute(adjcloses, volumes);
  const last = adjcloses[adjcloses.length - 1];

  let nUnits = 0, nInvested = 0; // 무지성
  let sUnits = 0, sInvested = 0; // 점수 가중
  let months = 0;

  for (let t = warmup; t < adjcloses.length; t += step) {
    const price = adjcloses[t];
    if (price <= 0) continue;
    const { score } = scoreAt(pre, t);

    // 점수→매수강도: 50점=1배 기준, 0.4~1.6배로 제한 (평균은 대체로 1배 근방)
    const w = Math.max(0.4, Math.min(1.6, score / 50));

    nInvested += 1; nUnits += 1 / price;
    sInvested += w; sUnits += w / price;
    months++;
  }

  const naiveMultiple = nInvested > 0 ? (nUnits * last) / nInvested : 0;
  const scoreMultiple = sInvested > 0 ? (sUnits * last) / sInvested : 0;
  const alpha = scoreMultiple - naiveMultiple;
  const enough = months >= 18; // 최소 1.5년치 적립

  let verdict: Alpha["verdict"] = "tie";
  if (enough) {
    if (alpha > 0.02) verdict = "score";
    else if (alpha < -0.02) verdict = "naive";
  }

  return { enough, months, naiveMultiple, scoreMultiple, alpha, verdict };
}
