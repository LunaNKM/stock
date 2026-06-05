"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/", label: "오늘의 추천" },
  { href: "/analysis", label: "종목 분석" },
  { href: "/statistics", label: "위험 비교" },
  { href: "/simulator", label: "시뮬레이터" },
];

export default function NavBar() {
  const pathname = usePathname();
  return (
    <nav className="border-b border-zinc-200 dark:border-zinc-800">
      <div className="mx-auto flex max-w-5xl items-center gap-1 px-5">
        <span className="mr-3 py-3 font-bold">📈 Stock</span>
        {tabs.map((t) => {
          const active = pathname === t.href;
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`border-b-2 px-3 py-3 text-sm transition-colors ${
                active
                  ? "border-zinc-900 font-medium text-zinc-900 dark:border-white dark:text-white"
                  : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
