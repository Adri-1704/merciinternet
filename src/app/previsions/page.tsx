"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";

// ─── Types ───────────────────────────────────────────────────────────────────

interface RecurringItem {
  id: string;
  name: string;
  amount: number;
  type: "income" | "expense";
  category: string;
}

interface Expense {
  id: string;
  amount: number;
  category: string;
  description: string;
  date: string;
  createdAt: string;
}

interface IncomePerson {
  id: string;
  name: string;
  amount: number;
}

interface Invoice {
  id: string;
  clientName: string;
  amount: number;
  date: string;
  paid: boolean;
}

interface BankAccount {
  id: string;
  name: string;
  balance: number;
  type: "perso" | "pro";
}

interface PaidBill {
  id: string;
  name: string;
  amount: number;
  date: string;
  category: string;
}

interface BillToPay {
  id: string;
  name: string;
  amount: number;
  dueDate: string;
  paid: boolean;
}

interface BudgetData {
  income: number;
  incomes: IncomePerson[];
  savingsGoal: number;
  expenses: Expense[];
  mode: "particulier" | "independant";
  invoices: Invoice[];
  bankAccounts: BankAccount[];
  paidBills: PaidBill[];
  billsToPay: BillToPay[];
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
  { id: "poursuites", icon: "⚖️", name: "Poursuites" },
  { id: "arrangements", icon: "📝", name: "Arrangements" },
  { id: "autre", icon: "📦", name: "Autre" },
] as const;

const EXPENSE_SUGGESTIONS = [
  { name: "Loyer", category: "loyer", amount: 1500 },
  { name: "Caisse maladie (LAMal)", category: "lamal", amount: 380 },
  { name: "3e pilier", category: "3epilier", amount: 588 },
  { name: "Impôts", category: "impots", amount: 500 },
  { name: "Assurances", category: "assurances", amount: 150 },
  { name: "Téléphone/Internet", category: "telephone", amount: 80 },
  { name: "Transport (CFF/Abo)", category: "transport", amount: 200 },
  { name: "Serafe", category: "autre", amount: 28 },
];

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

const MONTH_NAMES = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

const MONTH_SHORT = [
  "Jan", "Fév", "Mar", "Avr", "Mai", "Jun",
  "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc",
];

function loadBudget(monthKey: string): BudgetData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(`mi-budget-${monthKey}`);
    if (raw) {
      const data = JSON.parse(raw);
      if (!data.incomes) data.incomes = [];
      if (!data.mode) data.mode = "particulier";
      if (!data.invoices) data.invoices = [];
      if (!data.bankAccounts) data.bankAccounts = [];
      if (!data.paidBills) data.paidBills = [];
      if (!data.billsToPay) data.billsToPay = [];
      return data;
    }
  } catch {
    /* ignore */
  }
  return null;
}

function loadRecurring(): RecurringItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem("mi-recurring");
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return [];
}

function saveRecurring(items: RecurringItem[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem("mi-recurring", JSON.stringify(items));
}

function uuid(): string {
  return Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function Previsions() {
  const [recurring, setRecurring] = useState<RecurringItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Form state income
  const [incName, setIncName] = useState("");
  const [incAmount, setIncAmount] = useState("");
  const [incCategory, setIncCategory] = useState("autre");

  // Form state expense
  const [expName, setExpName] = useState("");
  const [expAmount, setExpAmount] = useState("");
  const [expCategory, setExpCategory] = useState("loyer");

  // Active section
  const [activeSection, setActiveSection] = useState<"recurring" | "chart" | "projection">("recurring");

  // Current date info
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-based

  // Load data
  useEffect(() => {
    setRecurring(loadRecurring());
    setLoaded(true);
  }, []);

  // Persist recurring
  function persistRecurring(items: RecurringItem[]) {
    setRecurring(items);
    saveRecurring(items);
  }

  // Add recurring income
  function addIncome() {
    const amt = parseFloat(incAmount);
    if (!incName.trim() || isNaN(amt) || amt <= 0) return;
    const item: RecurringItem = {
      id: uuid(),
      name: incName.trim(),
      amount: amt,
      type: "income",
      category: incCategory,
    };
    persistRecurring([...recurring, item]);
    setIncName("");
    setIncAmount("");
    setIncCategory("autre");
  }

  // Add recurring expense
  function addExpense() {
    const amt = parseFloat(expAmount);
    if (!expName.trim() || isNaN(amt) || amt <= 0) return;
    const item: RecurringItem = {
      id: uuid(),
      name: expName.trim(),
      amount: amt,
      type: "expense",
      category: expCategory,
    };
    persistRecurring([...recurring, item]);
    setExpName("");
    setExpAmount("");
    setExpCategory("loyer");
  }

  // Add suggestion
  function addSuggestion(s: typeof EXPENSE_SUGGESTIONS[number]) {
    // Check if already exists
    if (recurring.some((r) => r.name === s.name && r.type === "expense")) return;
    const item: RecurringItem = {
      id: uuid(),
      name: s.name,
      amount: s.amount,
      type: "expense",
      category: s.category,
    };
    persistRecurring([...recurring, item]);
  }

  function removeItem(id: string) {
    persistRecurring(recurring.filter((r) => r.id !== id));
  }

  // Computed
  const recurringIncomes = recurring.filter((r) => r.type === "income");
  const recurringExpenses = recurring.filter((r) => r.type === "expense");
  const totalRecurringIncome = recurringIncomes.reduce((s, r) => s + r.amount, 0);
  const totalRecurringExpenses = recurringExpenses.reduce((s, r) => s + r.amount, 0);
  const monthlyBalance = totalRecurringIncome - totalRecurringExpenses;

  // Load 12 months of budget data
  const monthlyData = useMemo(() => {
    if (!loaded) return [];
    const data: Array<{
      month: number;
      year: number;
      monthKey: string;
      label: string;
      actualIncome: number;
      actualExpenses: number;
      isPast: boolean;
      budget: BudgetData | null;
    }> = [];

    for (let i = 0; i < 12; i++) {
      const monthIdx = i;
      const year = currentYear;
      const monthKey = `${year}-${String(monthIdx + 1).padStart(2, "0")}`;
      const budget = loadBudget(monthKey);
      const isPast = monthIdx < currentMonth || (monthIdx === currentMonth);

      let actualIncome = 0;
      let actualExpenses = 0;
      if (budget) {
        const isInde = budget.mode === "independant";
        actualIncome = isInde
          ? budget.invoices.filter((inv) => inv.paid).reduce((s, inv) => s + inv.amount, 0)
          : budget.incomes.length > 0
            ? budget.incomes.reduce((s, p) => s + p.amount, 0)
            : budget.income;
        actualExpenses = budget.expenses.reduce((s, e) => s + e.amount, 0);
      }

      data.push({
        month: monthIdx,
        year,
        monthKey,
        label: MONTH_SHORT[monthIdx],
        actualIncome,
        actualExpenses,
        isPast: isPast && budget !== null,
        budget,
      });
    }
    return data;
  }, [loaded, currentYear, currentMonth, recurring]);

  // Max value for chart scaling
  const chartMax = useMemo(() => {
    let max = 1;
    for (const m of monthlyData) {
      const inc = m.isPast ? m.actualIncome : totalRecurringIncome;
      const exp = m.isPast ? m.actualExpenses : totalRecurringExpenses;
      if (inc > max) max = inc;
      if (exp > max) max = exp;
    }
    return max * 1.1;
  }, [monthlyData, totalRecurringIncome, totalRecurringExpenses]);

  // Cumulative savings
  const cumulativeSavings = useMemo(() => {
    let cumul = 0;
    return monthlyData.map((m) => {
      const inc = m.isPast ? m.actualIncome : totalRecurringIncome;
      const exp = m.isPast ? m.actualExpenses : totalRecurringExpenses;
      cumul += inc - exp;
      return cumul;
    });
  }, [monthlyData, totalRecurringIncome, totalRecurringExpenses]);

  const savingsMax = useMemo(() => {
    const vals = cumulativeSavings.map(Math.abs);
    return Math.max(...vals, 1) * 1.2;
  }, [cumulativeSavings]);

  // Bank accounts total from current month
  const bankTotal = useMemo(() => {
    const currentMonthKey = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}`;
    const b = loadBudget(currentMonthKey);
    if (!b || !b.bankAccounts) return 0;
    return b.bankAccounts.reduce((s, a) => s + a.balance, 0);
  }, [loaded, currentYear, currentMonth]);

  // Projection milestones
  const projection3 = bankTotal + monthlyBalance * 3;
  const projection6 = bankTotal + monthlyBalance * 6;
  const projection12 = bankTotal + monthlyBalance * 12;

  function projectionColor(val: number): string {
    if (val < 0) return "text-red-600";
    if (val < 1000) return "text-orange-500";
    return "text-emerald-600";
  }

  function projectionBg(val: number): string {
    if (val < 0) return "bg-red-50 border-red-200";
    if (val < 1000) return "bg-orange-50 border-orange-200";
    return "bg-emerald-50 border-emerald-200";
  }

  if (!loaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="h-8 w-8 animate-spin rounded-full border-3 border-violet-300 border-t-violet-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 pb-24">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="text-sm font-medium">Retour</span>
          </Link>
          <h1 className="text-lg font-bold">
            <span className="text-violet-600">Prévisions</span> annuelles
          </h1>
          <div className="w-16" /> {/* spacer */}
        </div>
      </header>

      {/* Section Tabs */}
      <div className="mx-auto max-w-lg px-4 pt-3">
        <div className="flex rounded-xl bg-white p-1 shadow-sm border border-zinc-100">
          {[
            { key: "recurring" as const, label: "Charges fixes" },
            { key: "chart" as const, label: "Graphique" },
            { key: "projection" as const, label: "Projection" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveSection(tab.key)}
              className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-all ${
                activeSection === tab.key
                  ? "bg-violet-600 text-white shadow-sm"
                  : "text-zinc-500 hover:text-zinc-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-lg px-4 pt-4 space-y-4">
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* SECTION A: CHARGES FIXES MENSUELLES */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {activeSection === "recurring" && (
          <div className="space-y-4 animate-fade-in-up">
            {/* Summary card */}
            <div className="rounded-2xl bg-white p-4 shadow-sm border border-zinc-100">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-xs text-zinc-400 mb-1">Revenus</p>
                  <p className="text-sm font-bold text-emerald-600">{formatCHF(totalRecurringIncome)}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-400 mb-1">Charges</p>
                  <p className="text-sm font-bold text-red-500">{formatCHF(totalRecurringExpenses)}</p>
                </div>
                <div>
                  <p className="text-xs text-zinc-400 mb-1">Disponible</p>
                  <p className={`text-sm font-bold ${monthlyBalance >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                    {formatCHF(monthlyBalance)}
                  </p>
                </div>
              </div>
              <p className="text-center text-[10px] text-zinc-400 mt-2">par mois en CHF</p>
            </div>

            {/* Two columns on desktop, stacked on mobile */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Revenus récurrents */}
              <div className="rounded-2xl bg-white p-4 shadow-sm border border-zinc-100">
                <h3 className="text-sm font-bold text-emerald-700 mb-3 flex items-center gap-2">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-xs">+</span>
                  Revenus récurrents
                </h3>

                {recurringIncomes.length === 0 && (
                  <p className="text-xs text-zinc-400 mb-3">Aucun revenu récurrent défini</p>
                )}

                <div className="space-y-2 mb-3">
                  {recurringIncomes.map((item) => {
                    const cat = getCategoryInfo(item.category);
                    return (
                      <div key={item.id} className="flex items-center justify-between rounded-xl bg-emerald-50 px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{cat.icon}</span>
                          <span className="text-xs font-medium text-zinc-700">{item.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-emerald-600">{formatCHF(item.amount)}</span>
                          <button
                            onClick={() => removeItem(item.id)}
                            className="text-zinc-300 hover:text-red-400 transition-colors"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Add form */}
                <div className="space-y-2 border-t border-zinc-100 pt-3">
                  <input
                    type="text"
                    placeholder="Nom (ex: Salaire)"
                    value={incName}
                    onChange={(e) => setIncName(e.target.value)}
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-xs focus:border-violet-400 focus:outline-none"
                  />
                  <div className="flex gap-2">
                    <input
                      type="number"
                      placeholder="Montant"
                      value={incAmount}
                      onChange={(e) => setIncAmount(e.target.value)}
                      className="flex-1 rounded-lg border border-zinc-200 px-3 py-2 text-xs focus:border-violet-400 focus:outline-none"
                    />
                    <select
                      value={incCategory}
                      onChange={(e) => setIncCategory(e.target.value)}
                      className="rounded-lg border border-zinc-200 px-2 py-2 text-xs focus:border-violet-400 focus:outline-none"
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.icon} {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    onClick={addIncome}
                    className="w-full rounded-lg bg-emerald-600 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-700"
                  >
                    + Ajouter un revenu
                  </button>
                </div>

                <div className="mt-3 border-t border-zinc-100 pt-2">
                  <p className="text-xs font-semibold text-emerald-700">
                    Total revenus mensuels : {formatCHF(totalRecurringIncome)} CHF
                  </p>
                </div>
              </div>

              {/* Charges fixes */}
              <div className="rounded-2xl bg-white p-4 shadow-sm border border-zinc-100">
                <h3 className="text-sm font-bold text-red-600 mb-3 flex items-center gap-2">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-red-100 text-xs">-</span>
                  Charges fixes
                </h3>

                {recurringExpenses.length === 0 && (
                  <p className="text-xs text-zinc-400 mb-3">Aucune charge fixe définie</p>
                )}

                <div className="space-y-2 mb-3">
                  {recurringExpenses.map((item) => {
                    const cat = getCategoryInfo(item.category);
                    return (
                      <div key={item.id} className="flex items-center justify-between rounded-xl bg-red-50 px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{cat.icon}</span>
                          <span className="text-xs font-medium text-zinc-700">{item.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-red-500">{formatCHF(item.amount)}</span>
                          <button
                            onClick={() => removeItem(item.id)}
                            className="text-zinc-300 hover:text-red-400 transition-colors"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Suggestions */}
                {recurringExpenses.length < 3 && (
                  <div className="mb-3">
                    <p className="text-[10px] text-zinc-400 mb-1.5">Suggestions (charges suisses typiques) :</p>
                    <div className="flex flex-wrap gap-1">
                      {EXPENSE_SUGGESTIONS.filter(
                        (s) => !recurring.some((r) => r.name === s.name && r.type === "expense")
                      ).map((s) => (
                        <button
                          key={s.name}
                          onClick={() => addSuggestion(s)}
                          className="rounded-full border border-zinc-200 px-2 py-0.5 text-[10px] text-zinc-500 transition-colors hover:border-violet-300 hover:bg-violet-50 hover:text-violet-600"
                        >
                          + {s.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Add form */}
                <div className="space-y-2 border-t border-zinc-100 pt-3">
                  <input
                    type="text"
                    placeholder="Nom (ex: Loyer)"
                    value={expName}
                    onChange={(e) => setExpName(e.target.value)}
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-xs focus:border-violet-400 focus:outline-none"
                  />
                  <div className="flex gap-2">
                    <input
                      type="number"
                      placeholder="Montant"
                      value={expAmount}
                      onChange={(e) => setExpAmount(e.target.value)}
                      className="flex-1 rounded-lg border border-zinc-200 px-3 py-2 text-xs focus:border-violet-400 focus:outline-none"
                    />
                    <select
                      value={expCategory}
                      onChange={(e) => setExpCategory(e.target.value)}
                      className="rounded-lg border border-zinc-200 px-2 py-2 text-xs focus:border-violet-400 focus:outline-none"
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.icon} {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button
                    onClick={addExpense}
                    className="w-full rounded-lg bg-red-500 py-2 text-xs font-semibold text-white transition-colors hover:bg-red-600"
                  >
                    + Ajouter une charge
                  </button>
                </div>

                <div className="mt-3 border-t border-zinc-100 pt-2">
                  <p className="text-xs font-semibold text-red-600">
                    Total charges fixes : {formatCHF(totalRecurringExpenses)} CHF
                  </p>
                </div>
              </div>
            </div>

            {/* Bottom difference card */}
            <div className={`rounded-2xl p-4 shadow-sm border text-center ${
              monthlyBalance >= 0
                ? "bg-emerald-50 border-emerald-200"
                : "bg-red-50 border-red-200"
            }`}>
              <p className="text-xs text-zinc-500 mb-1">Disponible après charges fixes</p>
              <p className={`text-2xl font-bold ${monthlyBalance >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                {formatCHF(monthlyBalance)} CHF
              </p>
              <p className="text-[10px] text-zinc-400 mt-1">par mois</p>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* SECTION B: GRAPHIQUE ANNUEL */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {activeSection === "chart" && (
          <div className="space-y-4 animate-fade-in-up">
            <div className="rounded-2xl bg-white p-4 shadow-sm border border-zinc-100">
              <h3 className="text-sm font-bold text-zinc-800 mb-1">Vue annuelle {currentYear}</h3>
              <p className="text-[10px] text-zinc-400 mb-4">Revenus vs Charges par mois</p>

              {/* Legend */}
              <div className="flex items-center gap-4 mb-4">
                <div className="flex items-center gap-1.5">
                  <div className="h-3 w-3 rounded-sm bg-emerald-400" />
                  <span className="text-[10px] text-zinc-500">Revenus</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-3 w-3 rounded-sm bg-red-400" />
                  <span className="text-[10px] text-zinc-500">Charges fixes</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-3 w-3 rounded-sm bg-violet-400" />
                  <span className="text-[10px] text-zinc-500">Dépenses réelles</span>
                </div>
              </div>

              {/* Bar chart */}
              <div className="flex items-end gap-1" style={{ height: "200px" }}>
                {monthlyData.map((m, i) => {
                  const inc = m.isPast ? m.actualIncome : totalRecurringIncome;
                  const charges = totalRecurringExpenses;
                  const actual = m.isPast ? m.actualExpenses : 0;
                  const incH = chartMax > 0 ? (inc / chartMax) * 100 : 0;
                  const chargesH = chartMax > 0 ? (charges / chartMax) * 100 : 0;
                  const actualH = chartMax > 0 ? (actual / chartMax) * 100 : 0;
                  const isCurrent = i === currentMonth;

                  return (
                    <div key={m.monthKey} className="flex-1 flex flex-col items-center gap-0.5 h-full justify-end">
                      <div className="flex items-end gap-px w-full justify-center" style={{ height: "180px" }}>
                        {/* Income bar */}
                        <div
                          className="rounded-t-sm bg-emerald-400 transition-all duration-500"
                          style={{
                            width: "30%",
                            height: `${incH}%`,
                            minHeight: inc > 0 ? "2px" : "0",
                            opacity: m.isPast ? 1 : 0.5,
                          }}
                          title={`Revenus: ${formatCHF(inc)} CHF`}
                        />
                        {/* Charges bar */}
                        <div
                          className="rounded-t-sm bg-red-400 transition-all duration-500"
                          style={{
                            width: "30%",
                            height: `${chargesH}%`,
                            minHeight: charges > 0 ? "2px" : "0",
                            opacity: m.isPast ? 1 : 0.5,
                          }}
                          title={`Charges: ${formatCHF(charges)} CHF`}
                        />
                        {/* Actual expenses bar (only for past) */}
                        {m.isPast && actual > 0 && (
                          <div
                            className="rounded-t-sm bg-violet-400 transition-all duration-500"
                            style={{
                              width: "30%",
                              height: `${actualH}%`,
                              minHeight: "2px",
                            }}
                            title={`Dépenses réelles: ${formatCHF(actual)} CHF`}
                          />
                        )}
                      </div>
                      <span className={`text-[9px] ${isCurrent ? "font-bold text-violet-600" : "text-zinc-400"}`}>
                        {m.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Cumulative savings */}
            <div className="rounded-2xl bg-white p-4 shadow-sm border border-zinc-100">
              <h3 className="text-sm font-bold text-zinc-800 mb-1">Épargne cumulée</h3>
              <p className="text-[10px] text-zinc-400 mb-4">Revenus - Charges, cumulé mois par mois</p>

              <div className="flex items-end gap-1" style={{ height: "140px" }}>
                {cumulativeSavings.map((val, i) => {
                  const isPositive = val >= 0;
                  const h = savingsMax > 0 ? (Math.abs(val) / savingsMax) * 100 : 0;
                  const isCurrent = i === currentMonth;

                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-0.5 h-full justify-end">
                      <div className="w-full flex justify-center" style={{ height: "120px", alignItems: "flex-end" }}>
                        <div
                          className={`rounded-t-sm w-3/4 transition-all duration-500 ${
                            isPositive ? "bg-emerald-400" : "bg-red-400"
                          }`}
                          style={{
                            height: `${h}%`,
                            minHeight: Math.abs(val) > 0 ? "2px" : "0",
                            opacity: i <= currentMonth ? 1 : 0.5,
                          }}
                          title={`${MONTH_SHORT[i]}: ${formatCHF(val)} CHF`}
                        />
                      </div>
                      <span className={`text-[9px] ${isCurrent ? "font-bold text-violet-600" : "text-zinc-400"}`}>
                        {MONTH_SHORT[i]}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Values under the chart */}
              <div className="mt-3 grid grid-cols-4 gap-2 text-center border-t border-zinc-100 pt-3">
                {[2, 5, 8, 11].map((i) => (
                  <div key={i}>
                    <p className="text-[10px] text-zinc-400">{MONTH_NAMES[i]}</p>
                    <p className={`text-xs font-bold ${cumulativeSavings[i] >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                      {formatCHF(cumulativeSavings[i])}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Monthly details table */}
            <div className="rounded-2xl bg-white p-4 shadow-sm border border-zinc-100">
              <h3 className="text-sm font-bold text-zinc-800 mb-3">Détail mensuel</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-zinc-100">
                      <th className="pb-2 text-left text-zinc-400 font-medium">Mois</th>
                      <th className="pb-2 text-right text-zinc-400 font-medium">Revenus</th>
                      <th className="pb-2 text-right text-zinc-400 font-medium">Charges</th>
                      <th className="pb-2 text-right text-zinc-400 font-medium">Solde</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyData.map((m, i) => {
                      const inc = m.isPast ? m.actualIncome : totalRecurringIncome;
                      const exp = m.isPast ? m.actualExpenses : totalRecurringExpenses;
                      const bal = inc - exp;
                      const isCurrent = i === currentMonth;
                      return (
                        <tr key={m.monthKey} className={`border-b border-zinc-50 ${isCurrent ? "bg-violet-50" : ""}`}>
                          <td className={`py-1.5 ${isCurrent ? "font-bold text-violet-600" : "text-zinc-600"}`}>
                            {MONTH_NAMES[m.month]}
                            {m.isPast && <span className="ml-1 text-[9px] text-zinc-400">(réel)</span>}
                          </td>
                          <td className="py-1.5 text-right text-emerald-600 font-medium">{formatCHF(inc)}</td>
                          <td className="py-1.5 text-right text-red-500 font-medium">{formatCHF(exp)}</td>
                          <td className={`py-1.5 text-right font-bold ${bal >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                            {formatCHF(bal)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-zinc-200">
                      <td className="pt-2 font-bold text-zinc-700">Total annuel</td>
                      <td className="pt-2 text-right font-bold text-emerald-600">
                        {formatCHF(monthlyData.reduce((s, m, i) => {
                          const inc = m.isPast ? m.actualIncome : totalRecurringIncome;
                          return s + inc;
                        }, 0))}
                      </td>
                      <td className="pt-2 text-right font-bold text-red-500">
                        {formatCHF(monthlyData.reduce((s, m) => {
                          const exp = m.isPast ? m.actualExpenses : totalRecurringExpenses;
                          return s + exp;
                        }, 0))}
                      </td>
                      <td className={`pt-2 text-right font-bold ${
                        cumulativeSavings[11] >= 0 ? "text-emerald-600" : "text-red-500"
                      }`}>
                        {formatCHF(cumulativeSavings[11])}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* SECTION C: PROJECTION DE SOLDE */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {activeSection === "projection" && (
          <div className="space-y-4 animate-fade-in-up">
            {/* Current balance */}
            <div className="rounded-2xl bg-violet-600 p-4 shadow-sm text-center text-white">
              <p className="text-xs opacity-80 mb-1">Solde actuel (comptes bancaires)</p>
              <p className="text-3xl font-bold">{formatCHF(bankTotal)} CHF</p>
              <p className="text-[10px] opacity-60 mt-1">
                {MONTH_NAMES[currentMonth]} {currentYear}
              </p>
            </div>

            {/* Monthly surplus */}
            <div className={`rounded-2xl p-4 shadow-sm border text-center ${
              monthlyBalance >= 0 ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"
            }`}>
              <p className="text-xs text-zinc-500 mb-1">Surplus mensuel estimé</p>
              <p className={`text-xl font-bold ${monthlyBalance >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                {monthlyBalance >= 0 ? "+" : ""}{formatCHF(monthlyBalance)} CHF / mois
              </p>
              <p className="text-[10px] text-zinc-400 mt-1">revenus récurrents - charges fixes</p>
            </div>

            {/* Big milestone cards */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { months: 3, label: "Dans 3 mois", value: projection3 },
                { months: 6, label: "Dans 6 mois", value: projection6 },
                { months: 12, label: "Dans 12 mois", value: projection12 },
              ].map((p) => (
                <div key={p.months} className={`rounded-2xl p-3 border text-center ${projectionBg(p.value)}`}>
                  <p className="text-[10px] text-zinc-500 mb-1">{p.label}</p>
                  <p className={`text-sm font-bold ${projectionColor(p.value)}`}>{formatCHF(p.value)}</p>
                  <p className="text-[9px] text-zinc-400">CHF</p>
                </div>
              ))}
            </div>

            {/* Monthly timeline */}
            <div className="rounded-2xl bg-white p-4 shadow-sm border border-zinc-100">
              <h3 className="text-sm font-bold text-zinc-800 mb-3">Évolution du solde</h3>
              <div className="space-y-2">
                {Array.from({ length: 12 }, (_, i) => {
                  const monthIdx = (currentMonth + i) % 12;
                  const year = currentMonth + i >= 12 ? currentYear + 1 : currentYear;
                  const projected = bankTotal + monthlyBalance * (i + 1);
                  const barWidth = Math.min(100, Math.max(5, (Math.abs(projected) / Math.max(Math.abs(projection12), Math.abs(bankTotal), 1)) * 100));

                  return (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-[10px] text-zinc-400 w-12 text-right shrink-0">
                        {MONTH_SHORT[monthIdx]} {String(year).slice(2)}
                      </span>
                      <div className="flex-1 h-5 bg-zinc-100 rounded-full overflow-hidden relative">
                        <div
                          className={`h-full rounded-full transition-all duration-700 ${
                            projected < 0
                              ? "bg-red-400"
                              : projected < 1000
                                ? "bg-orange-400"
                                : "bg-emerald-400"
                          }`}
                          style={{
                            width: `${barWidth}%`,
                            animationDelay: `${i * 50}ms`,
                          }}
                        />
                        <span className={`absolute inset-0 flex items-center px-2 text-[9px] font-semibold ${
                          projected < 0 ? "text-red-700" : projected < 1000 ? "text-orange-700" : "text-emerald-700"
                        }`}>
                          {formatCHF(projected)} CHF
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Warning/info box */}
            <div className="rounded-2xl bg-violet-50 border border-violet-200 p-4 text-center">
              <p className="text-xs text-violet-700">
                Ces projections sont basées sur vos charges fixes et revenus récurrents.
                Ajustez-les dans l&apos;onglet &quot;Charges fixes&quot; pour affiner les prévisions.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
