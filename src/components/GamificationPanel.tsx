"use client";

import { useState, useEffect } from "react";
import {
  GamificationData,
  BudgetData,
  BADGES,
  getScoreBreakdown,
  generateChallenges,
  Challenge,
} from "@/lib/gamification";

interface GamificationPanelProps {
  data: GamificationData;
  budget: BudgetData;
  onClose: () => void;
}

type Tab = "streak" | "badges" | "score" | "challenges";

const TAB_ITEMS: { id: Tab; icon: string; label: string }[] = [
  { id: "streak", icon: "🔥", label: "Streak" },
  { id: "badges", icon: "🏆", label: "Badges" },
  { id: "score", icon: "⭐", label: "Score" },
  { id: "challenges", icon: "🎯", label: "Défis" },
];

export default function GamificationPanel({
  data,
  budget,
  onClose,
}: GamificationPanelProps) {
  const [tab, setTab] = useState<Tab>("streak");
  const [animateIn, setAnimateIn] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setAnimateIn(true));
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className={`w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-2xl bg-white transition-transform duration-300 ${
          animateIn
            ? "translate-y-0 opacity-100"
            : "translate-y-8 opacity-0"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-100 bg-white/95 backdrop-blur px-5 pt-5 pb-3 rounded-t-3xl sm:rounded-t-2xl">
          <h2 className="text-lg font-bold text-zinc-900">Gamification</h2>
          <button
            onClick={onClose}
            className="rounded-xl p-2 text-zinc-400 hover:bg-zinc-100 transition-colors"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tab nav */}
        <div className="flex border-b border-zinc-100 px-2">
          {TAB_ITEMS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 py-3 text-center text-xs font-medium transition-colors ${
                tab === t.id
                  ? "border-b-2 border-violet-600 text-violet-600"
                  : "text-zinc-400 hover:text-zinc-600"
              }`}
            >
              <span className="text-base">{t.icon}</span>
              <br />
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-5">
          {tab === "streak" && <StreakTab data={data} />}
          {tab === "badges" && <BadgesTab data={data} />}
          {tab === "score" && <ScoreTab data={data} budget={budget} />}
          {tab === "challenges" && <ChallengesTab data={data} budget={budget} />}
        </div>
      </div>
    </div>
  );
}

// ─── Streak Tab ─────────────────────────────────────────────────────────────

function StreakTab({ data }: { data: GamificationData }) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0=Sun
  const monthPrefix = `${year}-${String(month + 1).padStart(2, "0")}`;

  // Build calendar grid
  const days: (number | null)[] = [];
  // Fill leading blanks (Mon-based: convert Sun=0 to 6, Mon=1 to 0...)
  const offset = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
  for (let i = 0; i < offset; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(d);

  const activeDaysSet = new Set(
    data.activeDays
      .filter((d) => d.startsWith(monthPrefix))
      .map((d) => parseInt(d.split("-")[2], 10))
  );

  return (
    <div className="space-y-6">
      {/* Big flame */}
      <div className="flex flex-col items-center gap-2">
        <div
          className={`text-7xl transition-transform ${
            data.streak > 0 ? "animate-bounce" : "grayscale opacity-40"
          }`}
          style={{ animationDuration: "2s" }}
        >
          🔥
        </div>
        <div className="text-4xl font-black text-orange-500">{data.streak}</div>
        <div className="text-sm text-zinc-500">
          jour{data.streak !== 1 ? "s" : ""} de suite
        </div>
        <div className="mt-1 rounded-full bg-violet-50 px-3 py-1 text-xs font-medium text-violet-600">
          Record : {data.bestStreak} jours
        </div>
      </div>

      {/* Calendar */}
      <div>
        <div className="mb-2 text-center text-xs font-semibold text-zinc-500">
          {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map((d) => (
            <span key={d} className="inline-block w-[calc(100%/7)] text-center">
              {d}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((day, i) => {
            if (day === null) {
              return <div key={`blank-${i}`} className="h-8" />;
            }
            const isActive = activeDaysSet.has(day);
            const isToday = day === now.getDate();
            return (
              <div
                key={day}
                className={`flex h-8 items-center justify-center rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? "bg-violet-600 text-white shadow-sm shadow-violet-200"
                    : isToday
                      ? "border-2 border-violet-300 text-violet-600"
                      : "text-zinc-400"
                }`}
              >
                {day}
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-center text-xs text-zinc-400">
        Saisissez une depense chaque jour pour maintenir votre streak !
      </p>
    </div>
  );
}

// ─── Badges Tab ─────────────────────────────────────────────────────────────

function BadgesTab({ data }: { data: GamificationData }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {BADGES.map((badge) => {
        const unlocked = data.badges.includes(badge.id);
        return (
          <div
            key={badge.id}
            className={`flex flex-col items-center gap-2 rounded-2xl p-4 text-center transition-all ${
              unlocked
                ? "bg-gradient-to-b from-violet-50 to-white border border-violet-100 shadow-sm"
                : "bg-zinc-50 opacity-50 grayscale"
            }`}
          >
            <span
              className={`text-4xl transition-transform ${
                unlocked ? "scale-110" : ""
              }`}
            >
              {badge.icon}
            </span>
            <div>
              <div
                className={`text-sm font-bold ${
                  unlocked ? "text-violet-700" : "text-zinc-400"
                }`}
              >
                {badge.name}
              </div>
              <div className="mt-0.5 text-[11px] text-zinc-400">
                {badge.description}
              </div>
            </div>
            {unlocked && (
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-700">
                Débloqué
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Score Tab ──────────────────────────────────────────────────────────────

function ScoreTab({
  data,
  budget,
}: {
  data: GamificationData;
  budget: BudgetData;
}) {
  const breakdown = getScoreBreakdown(data, budget);
  const total = Math.min(100, breakdown.regularity + breakdown.budget + breakdown.savings);
  const [animatedScore, setAnimatedScore] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setAnimatedScore(total), 100);
    return () => clearTimeout(timer);
  }, [total]);

  const circumference = 2 * Math.PI * 54;
  const strokeDashoffset = circumference - (animatedScore / 100) * circumference;

  const breakdownItems = [
    {
      label: "Régularité",
      score: breakdown.regularity,
      max: 30,
      color: "bg-blue-500",
      tip: "Saisissez vos dépenses chaque jour",
    },
    {
      label: "Budget",
      score: breakdown.budget,
      max: 40,
      color: "bg-green-500",
      tip: "Gardez vos dépenses sous vos revenus",
    },
    {
      label: "Épargne",
      score: breakdown.savings,
      max: 30,
      color: "bg-amber-500",
      tip: "Définissez et atteignez votre objectif d'épargne",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Big circle */}
      <div className="flex flex-col items-center gap-3">
        <div className="relative h-36 w-36">
          <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120">
            <circle
              cx="60"
              cy="60"
              r="54"
              fill="none"
              stroke="#f4f4f5"
              strokeWidth="8"
            />
            <circle
              cx="60"
              cy="60"
              r="54"
              fill="none"
              stroke="#7C3AED"
              strokeWidth="8"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className="transition-all duration-1000 ease-out"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-black text-violet-600">{animatedScore}</span>
            <span className="text-xs text-zinc-400">/100</span>
          </div>
        </div>
        <div className="text-sm font-medium text-zinc-500">Score mensuel</div>
      </div>

      {/* Breakdown */}
      <div className="space-y-3">
        {breakdownItems.map((item) => (
          <div key={item.label} className="rounded-xl bg-zinc-50 p-3">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-sm font-semibold text-zinc-700">{item.label}</span>
              <span className="text-sm font-bold text-violet-600">
                {item.score}/{item.max}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-200">
              <div
                className={`h-full rounded-full ${item.color} transition-all duration-700`}
                style={{ width: `${(item.score / item.max) * 100}%` }}
              />
            </div>
            <p className="mt-1 text-[11px] text-zinc-400">{item.tip}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Challenges Tab ─────────────────────────────────────────────────────────

function ChallengesTab({
  data,
  budget,
}: {
  data: GamificationData;
  budget: BudgetData;
}) {
  const challenges = generateChallenges(budget, data);

  return (
    <div className="space-y-4">
      <p className="text-center text-xs text-zinc-400">
        Défis du mois en cours
      </p>
      {challenges.map((ch) => (
        <ChallengeCard key={ch.id} challenge={ch} />
      ))}
    </div>
  );
}

function ChallengeCard({ challenge }: { challenge: Challenge }) {
  // For the restaurant challenge, lower is better
  const isInverse = challenge.category === "restaurants";
  let progress: number;

  if (isInverse) {
    // Target is max allowed; show how much budget remains
    progress = challenge.target > 0
      ? Math.min(100, Math.round((challenge.current / challenge.target) * 100))
      : 0;
  } else {
    progress = challenge.target > 0
      ? Math.min(100, Math.round((challenge.current / challenge.target) * 100))
      : 0;
  }

  const isCompleted = challenge.completed;

  return (
    <div
      className={`rounded-2xl border p-4 transition-all ${
        isCompleted
          ? "border-green-200 bg-green-50"
          : "border-zinc-100 bg-white"
      }`}
    >
      <div className="mb-2 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h3
              className={`text-sm font-bold ${
                isCompleted ? "text-green-700" : "text-zinc-900"
              }`}
            >
              {challenge.title}
            </h3>
            {isCompleted && <span className="text-base">✅</span>}
          </div>
          <p className="mt-0.5 text-xs text-zinc-400">{challenge.description}</p>
        </div>
      </div>

      {/* Progress */}
      <div className="mt-3">
        <div className="mb-1 flex justify-between text-xs">
          <span className="font-medium text-zinc-500">
            {isInverse
              ? `${Math.round(challenge.current)} / ${challenge.target} CHF`
              : `${Math.round(challenge.current)} / ${challenge.target}`}
          </span>
          <span
            className={`font-bold ${
              isCompleted ? "text-green-600" : "text-violet-600"
            }`}
          >
            {progress}%
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-200">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              isCompleted
                ? "bg-green-500"
                : isInverse
                  ? progress > 90
                    ? "bg-red-500"
                    : progress > 70
                      ? "bg-amber-500"
                      : "bg-violet-600"
                  : "bg-violet-600"
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}
