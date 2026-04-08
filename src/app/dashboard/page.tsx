"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Expense {
  id: string;
  amount: number;
  category: string;
  description: string;
  date: string;
  createdAt: string;
}

interface BudgetData {
  income: number;
  savingsGoal: number;
  expenses: Expense[];
}

// ─── Categories ──────────────────────────────────────────────────────────────

const CATEGORIES = [
  { id: "loyer", icon: "🏠", name: "Loyer" },
  { id: "lamal", icon: "🏥", name: "Caisse maladie" },
  { id: "3epilier", icon: "🏦", name: "3e pilier" },
  { id: "impots", icon: "📋", name: "Impôts" },
  { id: "courses", icon: "🛒", name: "Courses" },
  { id: "transport", icon: "🚂", name: "Transport" },
  { id: "telephone", icon: "📱", name: "Téléphone" },
  { id: "assurances", icon: "🛡️", name: "Assurances" },
  { id: "restaurants", icon: "🍽️", name: "Restaurants" },
  { id: "loisirs", icon: "🎉", name: "Loisirs" },
  { id: "vetements", icon: "👕", name: "Vêtements" },
  { id: "epargne", icon: "💰", name: "Épargne" },
  { id: "autre", icon: "📦", name: "Autre" },
] as const;

function getCategoryInfo(id: string) {
  return CATEGORIES.find((c) => c.id === id) || CATEGORIES[CATEGORIES.length - 1];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatCHF(amount: number): string {
  return amount.toLocaleString("fr-CH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function getMonthKey(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

const MONTH_NAMES = [
  "Janvier",
  "Février",
  "Mars",
  "Avril",
  "Mai",
  "Juin",
  "Juillet",
  "Août",
  "Septembre",
  "Octobre",
  "Novembre",
  "Décembre",
];

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("fr-CH", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ─── Storage ─────────────────────────────────────────────────────────────────

function loadBudget(monthKey: string): BudgetData {
  if (typeof window === "undefined") {
    return { income: 0, savingsGoal: 0, expenses: [] };
  }
  try {
    const raw = localStorage.getItem(`mi-budget-${monthKey}`);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return { income: 0, savingsGoal: 0, expenses: [] };
}

function saveBudget(monthKey: string, data: BudgetData) {
  if (typeof window === "undefined") return;
  localStorage.setItem(`mi-budget-${monthKey}`, JSON.stringify(data));
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const monthKey = getMonthKey(currentDate.getFullYear(), currentDate.getMonth());

  const [budget, setBudget] = useState<BudgetData>({
    income: 0,
    savingsGoal: 0,
    expenses: [],
  });
  const [loaded, setLoaded] = useState(false);

  // Form state
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("courses");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(todayStr());
  const [editingIncome, setEditingIncome] = useState(false);
  const [editingSavings, setEditingSavings] = useState(false);
  const [incomeInput, setIncomeInput] = useState("");
  const [savingsInput, setSavingsInput] = useState("");

  // Load data
  useEffect(() => {
    const data = loadBudget(monthKey);
    setBudget(data);
    setLoaded(true);
  }, [monthKey]);

  // Save data
  const persist = useCallback(
    (data: BudgetData) => {
      setBudget(data);
      saveBudget(monthKey, data);
    },
    [monthKey]
  );

  // Computed
  const totalExpenses = budget.expenses.reduce((s, e) => s + e.amount, 0);
  const remaining = budget.income - totalExpenses;
  const savingsProgress =
    budget.savingsGoal > 0
      ? Math.min(100, Math.round((Math.max(0, remaining) / budget.savingsGoal) * 100))
      : 0;

  // Group expenses by date
  const grouped = budget.expenses
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
    .reduce<Record<string, Expense[]>>((acc, exp) => {
      if (!acc[exp.date]) acc[exp.date] = [];
      acc[exp.date].push(exp);
      return acc;
    }, {});

  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  // Handlers
  function prevMonth() {
    setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  }

  function nextMonth() {
    setCurrentDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  }

  function addExpense(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parseFloat(amount);
    if (!parsed || parsed <= 0) return;

    const newExpense: Expense = {
      id: crypto.randomUUID(),
      amount: Math.round(parsed * 100) / 100,
      category,
      description: description.trim(),
      date,
      createdAt: new Date().toISOString(),
    };

    persist({
      ...budget,
      expenses: [...budget.expenses, newExpense],
    });

    setAmount("");
    setDescription("");
    setDate(todayStr());
  }

  function deleteExpense(id: string) {
    persist({
      ...budget,
      expenses: budget.expenses.filter((e) => e.id !== id),
    });
  }

  function saveIncome() {
    const parsed = parseFloat(incomeInput);
    if (isNaN(parsed)) return;
    persist({ ...budget, income: Math.round(parsed * 100) / 100 });
    setEditingIncome(false);
  }

  function saveSavingsGoal() {
    const parsed = parseFloat(savingsInput);
    if (isNaN(parsed)) return;
    persist({ ...budget, savingsGoal: Math.round(parsed * 100) / 100 });
    setEditingSavings(false);
  }

  if (!loaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-red-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
          <Link href="/" className="text-lg font-bold">
            Merci<span className="text-red-600">Internet</span>
          </Link>
          <div className="flex items-center gap-2">
            <button
              onClick={prevMonth}
              className="rounded-lg p-2 text-zinc-500 transition-colors hover:bg-zinc-100"
              aria-label="Mois précédent"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="min-w-[140px] text-center text-sm font-semibold">
              {MONTH_NAMES[currentDate.getMonth()]} {currentDate.getFullYear()}
            </span>
            <button
              onClick={nextMonth}
              className="rounded-lg p-2 text-zinc-500 transition-colors hover:bg-zinc-100"
              aria-label="Mois suivant"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 pb-8 pt-4">
        {/* Summary Cards */}
        <div className="mb-6 grid grid-cols-2 gap-3">
          {/* Income */}
          <div
            className="dashboard-card cursor-pointer rounded-xl bg-white p-4"
            onClick={() => {
              setIncomeInput(String(budget.income || ""));
              setEditingIncome(true);
            }}
          >
            <div className="mb-1 text-xs font-medium text-zinc-500">Revenus du mois</div>
            {editingIncome ? (
              <div className="flex gap-1">
                <input
                  type="number"
                  value={incomeInput}
                  onChange={(e) => setIncomeInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && saveIncome()}
                  onBlur={saveIncome}
                  autoFocus
                  className="w-full rounded border border-zinc-300 px-2 py-1 text-lg font-bold focus:border-red-600 focus:outline-none"
                  placeholder="0.00"
                />
              </div>
            ) : (
              <div className="text-xl font-bold text-green-600">
                {formatCHF(budget.income)}
                <span className="ml-1 text-xs font-normal text-zinc-400">CHF</span>
              </div>
            )}
          </div>

          {/* Expenses */}
          <div className="dashboard-card rounded-xl bg-white p-4">
            <div className="mb-1 text-xs font-medium text-zinc-500">Dépenses du mois</div>
            <div className="text-xl font-bold text-red-600">
              {formatCHF(totalExpenses)}
              <span className="ml-1 text-xs font-normal text-zinc-400">CHF</span>
            </div>
          </div>

          {/* Remaining */}
          <div className="dashboard-card rounded-xl bg-white p-4">
            <div className="mb-1 text-xs font-medium text-zinc-500">Reste à dépenser</div>
            <div
              className={`text-xl font-bold ${remaining >= 0 ? "text-zinc-900" : "text-red-600"}`}
            >
              {remaining < 0 && "-"}
              {formatCHF(Math.abs(remaining))}
              <span className="ml-1 text-xs font-normal text-zinc-400">CHF</span>
            </div>
          </div>

          {/* Savings Goal */}
          <div
            className="dashboard-card cursor-pointer rounded-xl bg-white p-4"
            onClick={() => {
              setSavingsInput(String(budget.savingsGoal || ""));
              setEditingSavings(true);
            }}
          >
            <div className="mb-1 text-xs font-medium text-zinc-500">Objectif épargne</div>
            {editingSavings ? (
              <div className="flex gap-1">
                <input
                  type="number"
                  value={savingsInput}
                  onChange={(e) => setSavingsInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && saveSavingsGoal()}
                  onBlur={saveSavingsGoal}
                  autoFocus
                  className="w-full rounded border border-zinc-300 px-2 py-1 text-lg font-bold focus:border-red-600 focus:outline-none"
                  placeholder="0.00"
                />
              </div>
            ) : (
              <>
                <div className="text-xl font-bold text-zinc-900">
                  {savingsProgress}%
                  {budget.savingsGoal > 0 && (
                    <span className="ml-1 text-xs font-normal text-zinc-400">
                      / {formatCHF(budget.savingsGoal)}
                    </span>
                  )}
                </div>
                {budget.savingsGoal > 0 && (
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
                    <div
                      className="animate-progress h-full rounded-full bg-red-600"
                      style={{ width: `${savingsProgress}%` }}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Quick Add Form */}
        <form onSubmit={addExpense} className="mb-6 rounded-xl bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-zinc-700">Ajouter une dépense</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-zinc-500">Montant (CHF)</label>
              <input
                type="number"
                step="0.05"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                required
                className="w-full rounded-lg border border-zinc-200 px-3 py-2.5 text-base font-semibold focus:border-red-600 focus:outline-none focus:ring-1 focus:ring-red-600"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-500">Catégorie</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-lg border border-zinc-200 px-3 py-2.5 text-base focus:border-red-600 focus:outline-none focus:ring-1 focus:ring-red-600"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.icon} {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-500">Description</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optionnel"
                className="w-full rounded-lg border border-zinc-200 px-3 py-2.5 text-base focus:border-red-600 focus:outline-none focus:ring-1 focus:ring-red-600"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-500">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-lg border border-zinc-200 px-3 py-2.5 text-base focus:border-red-600 focus:outline-none focus:ring-1 focus:ring-red-600"
              />
            </div>
          </div>
          <button
            type="submit"
            className="mt-4 w-full rounded-lg bg-red-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-700 active:bg-red-800"
          >
            Ajouter
          </button>
        </form>

        {/* Expense List */}
        <div>
          <h2 className="mb-3 text-sm font-semibold text-zinc-700">
            Dépenses ({budget.expenses.length})
          </h2>
          {sortedDates.length === 0 ? (
            <div className="rounded-xl bg-white p-8 text-center text-sm text-zinc-400 shadow-sm">
              Aucune dépense ce mois-ci.
              <br />
              Ajoutez votre première dépense ci-dessus.
            </div>
          ) : (
            <div className="space-y-4">
              {sortedDates.map((dateKey) => (
                <div key={dateKey}>
                  <div className="mb-2 text-xs font-medium text-zinc-500">
                    {formatDate(dateKey)}
                  </div>
                  <div className="overflow-hidden rounded-xl bg-white shadow-sm">
                    {grouped[dateKey].map((exp, i) => {
                      const cat = getCategoryInfo(exp.category);
                      return (
                        <div
                          key={exp.id}
                          className={`flex items-center gap-3 px-4 py-3 ${
                            i > 0 ? "border-t border-zinc-100" : ""
                          }`}
                        >
                          <span className="text-2xl">{cat.icon}</span>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-zinc-900">
                              {exp.description || cat.name}
                            </div>
                            <div className="text-xs text-zinc-400">{cat.name}</div>
                          </div>
                          <div className="text-sm font-semibold text-zinc-900">
                            -{formatCHF(exp.amount)}
                          </div>
                          <button
                            onClick={() => deleteExpense(exp.id)}
                            className="ml-1 rounded-lg p-1.5 text-zinc-300 transition-colors hover:bg-red-50 hover:text-red-500"
                            aria-label="Supprimer"
                          >
                            <svg
                              className="h-4 w-4"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M6 18L18 6M6 6l12 12"
                              />
                            </svg>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
