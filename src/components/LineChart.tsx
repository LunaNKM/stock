"use client";

export type Series = { name: string; color: string; values: (number | null)[] };

/**
 * 의존성 없는 가벼운 SVG 라인차트.
 * 여러 시계열을 한 좌표계에 겹쳐 그린다 (null 구간은 끊김).
 */
export default function LineChart({
  series,
  height = 240,
}: {
  series: Series[];
  height?: number;
}) {
  const W = 800;
  const H = height;
  const padL = 8;
  const padR = 8;
  const padY = 12;

  const allVals = series.flatMap((s) => s.values.filter((v): v is number => v != null));
  if (allVals.length === 0) return <div className="text-sm text-zinc-400">데이터 없음</div>;

  const min = Math.min(...allVals);
  const max = Math.max(...allVals);
  const range = max - min || 1;
  const len = Math.max(...series.map((s) => s.values.length));

  const x = (i: number) => padL + (i / Math.max(len - 1, 1)) * (W - padL - padR);
  const y = (v: number) => padY + (1 - (v - min) / range) * (H - padY * 2);

  const toPath = (values: (number | null)[]) => {
    let d = "";
    let pen = false;
    values.forEach((v, i) => {
      if (v == null) {
        pen = false;
        return;
      }
      d += `${pen ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)} `;
      pen = true;
    });
    return d.trim();
  };

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none">
        {series.map((s) => (
          <path
            key={s.name}
            d={toPath(s.values)}
            fill="none"
            stroke={s.color}
            strokeWidth={1.6}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
      <div className="mt-2 flex flex-wrap gap-3 text-xs text-zinc-500">
        {series.map((s) => (
          <span key={s.name} className="flex items-center gap-1">
            <span className="inline-block h-2 w-3 rounded" style={{ background: s.color }} />
            {s.name}
          </span>
        ))}
      </div>
    </div>
  );
}
