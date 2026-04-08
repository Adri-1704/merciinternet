"use client";

import { GamificationData, BADGES } from "@/lib/gamification";

interface GamificationBarProps {
  data: GamificationData;
  onOpen: () => void;
}

export default function GamificationBar({ data, onOpen }: GamificationBarProps) {
  const totalBadges = BADGES.length;
  const unlockedBadges = data.badges.length;
  const scorePercent = data.monthlyScore;

  return (
    <button
      onClick={onOpen}
      className="mx-auto flex w-full max-w-lg items-center justify-between gap-2 border-b border-zinc-100 bg-white px-4 py-2 transition-colors hover:bg-violet-50/50"
    >
      {/* Streak */}
      <div className="flex items-center gap-1.5">
        <span
          className={`text-base ${data.streak > 0 ? "animate-pulse" : "grayscale opacity-50"}`}
        >
          🔥
        </span>
        <span
          className={`text-sm font-bold ${
            data.streak > 0 ? "text-orange-500" : "text-zinc-400"
          }`}
        >
          {data.streak}
        </span>
        <span className="text-[10px] text-zinc-400">jour{data.streak !== 1 ? "s" : ""}</span>
      </div>

      {/* Monthly Score */}
      <div className="flex items-center gap-1.5">
        <div className="relative h-6 w-6">
          <svg className="h-6 w-6 -rotate-90" viewBox="0 0 24 24">
            <circle
              cx="12"
              cy="12"
              r="10"
              fill="none"
              stroke="#e4e4e7"
              strokeWidth="3"
            />
            <circle
              cx="12"
              cy="12"
              r="10"
              fill="none"
              stroke="#7C3AED"
              strokeWidth="3"
              strokeDasharray={`${(scorePercent / 100) * 62.83} 62.83`}
              strokeLinecap="round"
              className="transition-all duration-700"
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-[7px] font-bold text-violet-600">
            {scorePercent}
          </span>
        </div>
        <span className="text-[10px] text-zinc-400">score</span>
      </div>

      {/* Badges */}
      <div className="flex items-center gap-1.5">
        <span className="text-base">🏆</span>
        <span className="text-sm font-bold text-violet-600">
          {unlockedBadges}/{totalBadges}
        </span>
        <span className="text-[10px] text-zinc-400">badges</span>
      </div>
    </button>
  );
}
