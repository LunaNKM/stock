import "server-only";

/**
 * 아주 단순한 메모리 TTL 캐시 (+ 장애 시 stale 폴백).
 * yahoo-finance 호출을 줄여 새로고침을 빠르게 하고 rate-limit을 피한다.
 * 비공식 API라 가끔 차단/오류가 나는데, 그럴 땐 만료된 값이라도 마지막 정상값을
 * 돌려줘 화면 전체가 깨지지 않게 한다(stale-while-error).
 * (개발/단일 인스턴스 기준. 다중 인스턴스라면 외부 캐시로 교체.)
 */
type Entry<T> = { value: T; expires: number };
const store = new Map<string, Entry<unknown>>();

/**
 * key로 캐시를 조회하고, 없거나 만료면 loader를 실행해 ttlMs 동안 보관.
 * loader가 실패하면 (있다면) 만료된 마지막 정상값을 폴백으로 반환한다.
 */
export async function cached<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
  const hit = store.get(key) as Entry<T> | undefined;
  if (hit && hit.expires > Date.now()) return hit.value;
  try {
    const value = await loader();
    store.set(key, { value, expires: Date.now() + ttlMs });
    return value;
  } catch (err) {
    // 만료됐더라도 마지막 정상값이 있으면 그걸로 버틴다.
    if (hit) {
      console.warn(`[cache] '${key}' 갱신 실패 → 이전 값으로 폴백:`, err instanceof Error ? err.message : err);
      return hit.value;
    }
    throw err;
  }
}
