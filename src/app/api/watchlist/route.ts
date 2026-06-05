import { NextResponse } from "next/server";
import { getWatchlist, addCandidate, removeCandidate } from "@/lib/watchlistStore";

export const dynamic = "force-dynamic";

/** 후보 종목 목록 */
export async function GET() {
  return NextResponse.json(await getWatchlist());
}

/** 후보 추가 */
export async function POST(req: Request) {
  try {
    const b = await req.json();
    const list = await addCandidate({
      symbol: String(b.symbol ?? ""),
      name: String(b.name ?? ""),
      category: b.category === "satellite" ? "satellite" : "core",
      market: b.market === "KR" ? "KR" : "US",
      note: b.note ? String(b.note) : undefined,
    });
    return NextResponse.json(list);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "추가 실패" },
      { status: 400 },
    );
  }
}

/** 후보 삭제 (?symbol=AAPL) */
export async function DELETE(req: Request) {
  const symbol = new URL(req.url).searchParams.get("symbol");
  if (!symbol) return NextResponse.json({ error: "symbol 파라미터 필요" }, { status: 400 });
  return NextResponse.json(await removeCandidate(symbol));
}
