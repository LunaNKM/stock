/** 화면 표시용 포맷 헬퍼 (클라이언트/서버 공용) */

export const won = (n: number) =>
  new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 0 }).format(Math.round(n)) + "원";

export const pct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;

/** 한국식 색상: 상승=빨강, 하락=파랑 */
export const colorOf = (n: number) =>
  n > 0 ? "text-rose-500" : n < 0 ? "text-blue-500" : "text-zinc-400";
