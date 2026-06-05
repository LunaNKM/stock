import type { ReactNode } from "react";

/**
 * 초보용 설명 박스 (눌러서 펼치는 아코디언).
 * 모바일에서도 잘 동작하도록 hover 툴팁 대신 native <details> 사용.
 */
export function HelpBox({
  title = "이게 무슨 뜻인가요?",
  children,
  defaultOpen = false,
}: {
  title?: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details
      open={defaultOpen}
      className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-0 text-sm dark:border-amber-900/40 dark:bg-amber-950/20"
    >
      <summary className="cursor-pointer list-none px-4 py-3 font-medium text-amber-800 marker:content-none dark:text-amber-300">
        💡 {title} <span className="ml-1 text-xs text-amber-600">(눌러서 펼치기)</span>
      </summary>
      <div className="space-y-2 px-4 pb-4 leading-relaxed text-zinc-700 dark:text-zinc-300">
        {children}
      </div>
    </details>
  );
}

/** 지표/항목 아래에 붙이는 작은 회색 한 줄 풀이 */
export function Hint({ children }: { children: ReactNode }) {
  return <p className="mt-1 text-xs leading-relaxed text-zinc-500">{children}</p>;
}

/** 용어 한 줄 정의 (설명 박스 안에서 목록으로 사용) */
export function Define({ term, children }: { term: string; children: ReactNode }) {
  return (
    <p>
      <b className="text-zinc-900 dark:text-zinc-100">{term}</b> — {children}
    </p>
  );
}
