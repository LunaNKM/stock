import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { DEFAULT_WATCHLIST, type Candidate, type Category, type Market } from "./watchlist";

/**
 * 후보 종목 영속화 계층.
 * data/watchlist.json 에 저장하며, 파일이 없으면 기본 후보 목록으로 초기화한다.
 */
const DATA_DIR = path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "watchlist.json");

async function ensureFile(): Promise<void> {
  try {
    await fs.access(FILE);
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(FILE, JSON.stringify(DEFAULT_WATCHLIST, null, 2), "utf-8");
  }
}

export async function getWatchlist(): Promise<Candidate[]> {
  await ensureFile();
  try {
    return JSON.parse(await fs.readFile(FILE, "utf-8")) as Candidate[];
  } catch {
    return [...DEFAULT_WATCHLIST];
  }
}

async function save(list: Candidate[]): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(list, null, 2), "utf-8");
}

export type CandidateInput = {
  symbol: string;
  name: string;
  category: Category;
  market: Market;
  note?: string;
};

/** 후보 추가(같은 심볼이면 덮어쓰기) */
export async function addCandidate(input: CandidateInput): Promise<Candidate[]> {
  const symbol = input.symbol.trim().toUpperCase();
  if (!symbol) throw new Error("종목 심볼을 입력하세요.");

  const candidate: Candidate = {
    symbol,
    name: input.name.trim() || symbol,
    category: input.category === "satellite" ? "satellite" : "core",
    market: input.market === "KR" ? "KR" : "US",
    note: input.note?.trim() || "직접 추가한 관심 종목",
  };

  const list = await getWatchlist();
  const idx = list.findIndex((c) => c.symbol === symbol);
  if (idx >= 0) list[idx] = candidate;
  else list.push(candidate);
  await save(list);
  return list;
}

/** 후보 삭제 */
export async function removeCandidate(symbol: string): Promise<Candidate[]> {
  const target = symbol.trim().toUpperCase();
  const list = (await getWatchlist()).filter((c) => c.symbol !== target);
  await save(list);
  return list;
}
