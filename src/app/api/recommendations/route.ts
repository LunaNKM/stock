import { NextResponse } from "next/server";
import { buildRecommendations } from "@/lib/recommend";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await buildRecommendations());
  } catch (err) {
    console.error("[/api/recommendations] 실패:", err);
    return NextResponse.json({ error: "추천을 불러오지 못했습니다." }, { status: 500 });
  }
}
