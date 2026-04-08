"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import ReceiptScanner from "@/components/ReceiptScanner";
import GamificationBar from "@/components/GamificationBar";
import GamificationPanel from "@/components/GamificationPanel";
import {
  GamificationData,
  loadGamification,
  saveGamification,
  onExpenseAdded,
  onScanCompleted,
  calculateMonthlyScore,
  generateChallenges,
} from "@/lib/gamification";

// ─── Types ───────────────────────────────────────────────────────────────────

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

interface BudgetData {
  income: number;
  incomes: IncomePerson[];
  savingsGoal: number;
  expenses: Expense[];
  mode: 'particulier' | 'independant';
  invoices: Invoice[];
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

const PRO_CATEGORIES = [
  { id: "materiel", icon: "💻", name: "Matériel" },
  { id: "logiciel", icon: "🖥️", name: "Logiciel / Abo" },
  { id: "comptable", icon: "📊", name: "Comptable / Fiduciaire" },
  { id: "bureau", icon: "🏢", name: "Loyer bureau" },
  { id: "deplacement", icon: "🚗", name: "Déplacement pro" },
  { id: "formation", icon: "📚", name: "Formation" },
  { id: "marketing", icon: "📣", name: "Marketing / Pub" },
  { id: "soustraitance", icon: "🤝", name: "Sous-traitance" },
] as const;

const ALL_CATEGORIES = [...CATEGORIES, ...PRO_CATEGORIES];

function getCategoryInfo(id: string) {
  return ALL_CATEGORIES.find((c) => c.id === id) || CATEGORIES[CATEGORIES.length - 1];
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

function defaultBudget(): BudgetData {
  return { income: 0, incomes: [], savingsGoal: 0, expenses: [], mode: 'particulier', invoices: [] };
}

function loadBudget(monthKey: string): BudgetData {
  if (typeof window === "undefined") {
    return defaultBudget();
  }
  try {
    const raw = localStorage.getItem(`mi-budget-${monthKey}`);
    if (raw) {
      const data = JSON.parse(raw);
      if (!data.incomes) data.incomes = [];
      if (!data.mode) data.mode = 'particulier';
      if (!data.invoices) data.invoices = [];
      return data;
    }
  } catch {
    /* ignore */
  }
  return defaultBudget();
}

// Persist mode globally so it carries across months
function loadGlobalMode(): 'particulier' | 'independant' {
  if (typeof window === "undefined") return 'particulier';
  try {
    return (localStorage.getItem('mi-mode') as 'particulier' | 'independant') || 'particulier';
  } catch { return 'particulier'; }
}

function saveGlobalMode(mode: 'particulier' | 'independant') {
  if (typeof window === "undefined") return;
  localStorage.setItem('mi-mode', mode);
}

function saveBudget(monthKey: string, data: BudgetData) {
  if (typeof window === "undefined") return;
  localStorage.setItem(`mi-budget-${monthKey}`, JSON.stringify(data));
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const monthKey = getMonthKey(currentDate.getFullYear(), currentDate.getMonth());

  const [budget, setBudget] = useState<BudgetData>(defaultBudget());
  const [loaded, setLoaded] = useState(false);

  // Form state
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("courses");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(todayStr());
  const [editingSavings, setEditingSavings] = useState(false);
  const [savingsInput, setSavingsInput] = useState("");
  const [showIncomePanel, setShowIncomePanel] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [newPersonName, setNewPersonName] = useState("");
  const [newPersonAmount, setNewPersonAmount] = useState("");
  const [gamData, setGamData] = useState<GamificationData | null>(null);
  const [showGamification, setShowGamification] = useState(false);
  const [newBadgeToast, setNewBadgeToast] = useState<string | null>(null);
  const [showInvoicePanel, setShowInvoicePanel] = useState(false);
  const [invoiceClient, setInvoiceClient] = useState("");
  const [invoiceAmount, setInvoiceAmount] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(todayStr());

  const isIndependant = budget.mode === 'independant';

  // Load data
  useEffect(() => {
    const data = loadBudget(monthKey);
    // Apply global mode preference
    const globalMode = loadGlobalMode();
    data.mode = globalMode;
    setBudget(data);
    setLoaded(true);
  }, [monthKey]);

  // Load gamification data
  useEffect(() => {
    const gd = loadGamification();
    // Recalculate score & challenges on load
    gd.monthlyScore = calculateMonthlyScore(gd, budget);
    gd.challenges = generateChallenges(budget, gd);
    saveGamification(gd);
    setGamData(gd);
  }, [loaded, budget]);

  // Save data
  const persist = useCallback(
    (data: BudgetData) => {
      setBudget(data);
      saveBudget(monthKey, data);
    },
    [monthKey]
  );

  // Computed
  const totalInvoiced = budget.invoices.reduce((s, inv) => s + inv.amount, 0);
  const totalPaidInvoices = budget.invoices.filter((inv) => inv.paid).reduce((s, inv) => s + inv.amount, 0);
  const totalPendingInvoices = totalInvoiced - totalPaidInvoices;

  const totalIncome = isIndependant
    ? totalPaidInvoices
    : budget.incomes.length > 0
      ? budget.incomes.reduce((s, p) => s + p.amount, 0)
      : budget.income;
  const totalExpenses = budget.expenses.reduce((s, e) => s + e.amount, 0);
  const remaining = totalIncome - totalExpenses;
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

    const updatedBudget = {
      ...budget,
      expenses: [...budget.expenses, newExpense],
    };
    persist(updatedBudget);

    // Update gamification
    if (gamData) {
      const result = onExpenseAdded(gamData, updatedBudget, 1);
      setGamData(result.gamData);
      if (result.newBadges.length > 0) {
        setNewBadgeToast(result.newBadges[0]);
        setTimeout(() => setNewBadgeToast(null), 3000);
      }
    }

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

  function addIncomePerson() {
    const parsed = parseFloat(newPersonAmount);
    if (!newPersonName.trim() || isNaN(parsed) || parsed <= 0) return;
    const person: IncomePerson = {
      id: crypto.randomUUID(),
      name: newPersonName.trim(),
      amount: Math.round(parsed * 100) / 100,
    };
    persist({ ...budget, incomes: [...budget.incomes, person], income: 0 });
    setNewPersonName("");
    setNewPersonAmount("");
  }

  function removeIncomePerson(id: string) {
    persist({ ...budget, incomes: budget.incomes.filter((p) => p.id !== id) });
  }

  function updateIncomeAmount(id: string, value: string) {
    const parsed = parseFloat(value);
    if (isNaN(parsed)) return;
    persist({
      ...budget,
      incomes: budget.incomes.map((p) =>
        p.id === id ? { ...p, amount: Math.round(parsed * 100) / 100 } : p
      ),
    });
  }

  function saveSavingsGoal() {
    const parsed = parseFloat(savingsInput);
    if (isNaN(parsed)) return;
    persist({ ...budget, savingsGoal: Math.round(parsed * 100) / 100 });
    setEditingSavings(false);
  }

  function handleScannedExpenses(
    expenses: { amount: number; category: string; description: string; date: string }[]
  ) {
    const newExpenses: Expense[] = expenses.map((exp) => ({
      id: crypto.randomUUID(),
      amount: Math.round(exp.amount * 100) / 100,
      category: exp.category,
      description: exp.description,
      date: exp.date,
      createdAt: new Date().toISOString(),
    }));

    const updatedBudget = {
      ...budget,
      expenses: [...budget.expenses, ...newExpenses],
    };
    persist(updatedBudget);

    // Update gamification
    if (gamData) {
      const result = onScanCompleted(gamData, updatedBudget, newExpenses.length);
      setGamData(result.gamData);
      if (result.newBadges.length > 0) {
        setNewBadgeToast(result.newBadges[0]);
        setTimeout(() => setNewBadgeToast(null), 3000);
      }
    }

    setShowScanner(false);
  }

  function toggleMode() {
    const newMode = budget.mode === 'particulier' ? 'independant' : 'particulier';
    saveGlobalMode(newMode);
    persist({ ...budget, mode: newMode });
  }

  function addInvoice() {
    const parsed = parseFloat(invoiceAmount);
    if (!invoiceClient.trim() || isNaN(parsed) || parsed <= 0) return;
    const inv: Invoice = {
      id: crypto.randomUUID(),
      clientName: invoiceClient.trim(),
      amount: Math.round(parsed * 100) / 100,
      date: invoiceDate,
      paid: false,
    };
    persist({ ...budget, invoices: [...budget.invoices, inv] });
    setInvoiceClient("");
    setInvoiceAmount("");
    setInvoiceDate(todayStr());
  }

  function toggleInvoicePaid(id: string) {
    persist({
      ...budget,
      invoices: budget.invoices.map((inv) =>
        inv.id === id ? { ...inv, paid: !inv.paid } : inv
      ),
    });
  }

  function deleteInvoice(id: string) {
    persist({
      ...budget,
      invoices: budget.invoices.filter((inv) => inv.id !== id),
    });
  }

  if (!loaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      {/* Income Panel */}
      {showIncomePanel && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40" onClick={() => setShowIncomePanel(false)}>
          <div className="w-full max-w-md rounded-t-2xl sm:rounded-2xl bg-white p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold">Revenus du mois</h3>
              <button onClick={() => setShowIncomePanel(false)} className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* Liste des personnes */}
            {budget.incomes.length > 0 && (
              <div className="mb-4 space-y-2">
                {budget.incomes.map((person) => (
                  <div key={person.id} className="flex items-center gap-2 rounded-xl bg-zinc-50 p-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-100 text-sm font-bold text-violet-600">
                      {person.name[0].toUpperCase()}
                    </div>
                    <span className="flex-1 text-sm font-medium">{person.name}</span>
                    <input
                      type="number"
                      defaultValue={person.amount}
                      onBlur={(e) => updateIncomeAmount(person.id, e.target.value)}
                      className="w-24 rounded-lg border border-zinc-200 px-2 py-1 text-right text-sm font-semibold focus:border-violet-500 focus:outline-none"
                    />
                    <span className="text-xs text-zinc-400">CHF</span>
                    <button onClick={() => removeIncomePerson(person.id)} className="rounded-lg p-1 text-zinc-300 hover:bg-red-50 hover:text-red-500">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                ))}
                <div className="flex justify-between rounded-xl bg-green-50 p-3 text-sm font-bold text-green-700">
                  <span>Total</span>
                  <span>{formatCHF(totalIncome)} CHF</span>
                </div>
              </div>
            )}

            {/* Ajouter une personne */}
            <div className="flex gap-2">
              <input
                type="text"
                value={newPersonName}
                onChange={(e) => setNewPersonName(e.target.value)}
                placeholder="Prénom"
                className="flex-1 rounded-xl border border-zinc-200 px-3 py-2.5 text-sm focus:border-violet-500 focus:outline-none"
              />
              <input
                type="number"
                value={newPersonAmount}
                onChange={(e) => setNewPersonAmount(e.target.value)}
                placeholder="Revenu"
                onKeyDown={(e) => e.key === "Enter" && addIncomePerson()}
                className="w-28 rounded-xl border border-zinc-200 px-3 py-2.5 text-sm focus:border-violet-500 focus:outline-none"
              />
              <button
                onClick={addIncomePerson}
                className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700"
              >
                +
              </button>
            </div>
            <p className="mt-2 text-center text-xs text-zinc-400">
              Ajoutez chaque personne du foyer et son revenu mensuel
            </p>
          </div>
        </div>
      )}

      {/* Invoice Panel (independant mode) */}
      {showInvoicePanel && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40" onClick={() => setShowInvoicePanel(false)}>
          <div className="w-full max-w-md max-h-[85vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold">Factures du mois</h3>
              <button onClick={() => setShowInvoicePanel(false)} className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* Summary */}
            <div className="mb-4 grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-green-50 p-3 text-center">
                <div className="text-xs text-green-600 font-medium">Encaisse</div>
                <div className="text-lg font-bold text-green-700">{formatCHF(totalPaidInvoices)} CHF</div>
              </div>
              <div className="rounded-xl bg-orange-50 p-3 text-center">
                <div className="text-xs text-orange-600 font-medium">En attente</div>
                <div className="text-lg font-bold text-orange-700">{formatCHF(totalPendingInvoices)} CHF</div>
              </div>
            </div>

            {/* Invoice list */}
            {budget.invoices.length > 0 && (
              <div className="mb-4 space-y-2">
                {budget.invoices
                  .slice()
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .map((inv) => (
                  <div key={inv.id} className="flex items-center gap-2 rounded-xl bg-zinc-50 p-3">
                    <button
                      onClick={() => toggleInvoicePaid(inv.id)}
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-lg ${inv.paid ? 'bg-green-100' : 'bg-orange-100'}`}
                      title={inv.paid ? 'Encaissee' : 'En attente'}
                    >
                      {inv.paid ? '✅' : '⏳'}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-zinc-900 truncate">{inv.clientName}</div>
                      <div className="text-xs text-zinc-400">{formatDate(inv.date)}</div>
                    </div>
                    <div className={`text-sm font-semibold ${inv.paid ? 'text-green-600' : 'text-orange-600'}`}>
                      {formatCHF(inv.amount)} CHF
                    </div>
                    <button onClick={() => deleteInvoice(inv.id)} className="rounded-lg p-1 text-zinc-300 hover:bg-red-50 hover:text-red-500">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add invoice form */}
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={invoiceClient}
                  onChange={(e) => setInvoiceClient(e.target.value)}
                  placeholder="Nom du client"
                  className="flex-1 rounded-xl border border-zinc-200 px-3 py-2.5 text-sm focus:border-violet-500 focus:outline-none"
                />
                <input
                  type="number"
                  value={invoiceAmount}
                  onChange={(e) => setInvoiceAmount(e.target.value)}
                  placeholder="Montant"
                  className="w-28 rounded-xl border border-zinc-200 px-3 py-2.5 text-sm focus:border-violet-500 focus:outline-none"
                />
              </div>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  className="flex-1 rounded-xl border border-zinc-200 px-3 py-2.5 text-sm focus:border-violet-500 focus:outline-none"
                />
                <button
                  onClick={addInvoice}
                  className="rounded-xl bg-violet-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-violet-700"
                >
                  Ajouter
                </button>
              </div>
            </div>
            <p className="mt-2 text-center text-xs text-zinc-400">
              Cliquez sur le statut pour basculer entre encaissee et en attente
            </p>
          </div>
        </div>
      )}

      {/* Receipt Scanner */}
      {showScanner && (
        <ReceiptScanner
          onExpensesAdded={handleScannedExpenses}
          onClose={() => setShowScanner(false)}
        />
      )}

      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
          <Link href="/" className="text-lg font-bold">
            Merci<span className="text-violet-600">internet</span>
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

      {/* Mode Toggle */}
      <div className="mx-auto max-w-lg px-4 pt-3 pb-1">
        <div className="flex items-center justify-center">
          <div className="inline-flex rounded-full bg-zinc-100 p-0.5 text-xs font-medium">
            <button
              onClick={() => budget.mode !== 'particulier' && toggleMode()}
              className={`rounded-full px-3 py-1 transition-colors ${budget.mode === 'particulier' ? 'bg-violet-600 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
            >
              Particulier
            </button>
            <button
              onClick={() => budget.mode !== 'independant' && toggleMode()}
              className={`rounded-full px-3 py-1 transition-colors ${budget.mode === 'independant' ? 'bg-violet-600 text-white shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
            >
              Independant
            </button>
          </div>
        </div>
      </div>

      {/* Gamification Bar */}
      {gamData && (
        <GamificationBar data={gamData} onOpen={() => setShowGamification(true)} />
      )}

      {/* Gamification Panel */}
      {showGamification && gamData && (
        <GamificationPanel
          data={gamData}
          budget={budget}
          onClose={() => setShowGamification(false)}
        />
      )}

      {/* Badge unlock toast */}
      {newBadgeToast && (
        <div className="fixed top-20 left-1/2 z-[60] -translate-x-1/2 animate-bounce rounded-2xl bg-violet-600 px-5 py-3 text-center text-white shadow-xl">
          <div className="text-2xl">🏆</div>
          <div className="text-sm font-bold">Nouveau badge débloqué !</div>
          <div className="text-xs text-violet-200">{newBadgeToast}</div>
        </div>
      )}

      <main className="mx-auto max-w-lg px-4 pb-8 pt-4">
        {/* Summary Cards */}
        <div className="mb-6 grid grid-cols-2 gap-3">
          {/* Income / Invoices card */}
          {isIndependant ? (
            <>
              {/* Facture ce mois */}
              <div
                className="dashboard-card cursor-pointer rounded-xl bg-white p-4"
                onClick={() => setShowInvoicePanel(true)}
              >
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs font-medium text-zinc-500">Facture ce mois</span>
                  {budget.invoices.length > 0 && (
                    <span className="text-[10px] text-zinc-400">{budget.invoices.length} facture{budget.invoices.length > 1 ? "s" : ""}</span>
                  )}
                </div>
                <div className="text-xl font-bold text-violet-600">
                  {formatCHF(totalInvoiced)}
                  <span className="ml-1 text-xs font-normal text-zinc-400">CHF</span>
                </div>
                {budget.invoices.length > 0 && (
                  <div className="mt-2 space-y-0.5">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-green-600">Encaisse</span>
                      <span className="text-green-600 font-medium">{formatCHF(totalPaidInvoices)}</span>
                    </div>
                    <div className="flex justify-between text-[11px]">
                      <span className="text-orange-500">En attente</span>
                      <span className="text-orange-500 font-medium">{formatCHF(totalPendingInvoices)}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Encaisse */}
              <div className="dashboard-card rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 p-4">
                <div className="mb-1 text-xs font-medium text-green-100">Encaisse</div>
                <div className="text-xl font-bold text-white">
                  {formatCHF(totalPaidInvoices)}
                  <span className="ml-1 text-xs font-normal text-green-200">CHF</span>
                </div>
              </div>
            </>
          ) : (
            <div
              className="dashboard-card cursor-pointer rounded-xl bg-white p-4"
              onClick={() => setShowIncomePanel(true)}
            >
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs font-medium text-zinc-500">Revenus du mois</span>
                {budget.incomes.length > 0 && (
                  <span className="text-[10px] text-zinc-400">{budget.incomes.length} personne{budget.incomes.length > 1 ? "s" : ""}</span>
                )}
              </div>
              <div className="text-xl font-bold text-green-600">
                {formatCHF(totalIncome)}
                <span className="ml-1 text-xs font-normal text-zinc-400">CHF</span>
              </div>
              {budget.incomes.length > 0 && (
                <div className="mt-2 space-y-0.5">
                  {budget.incomes.map((p) => (
                    <div key={p.id} className="flex justify-between text-[11px] text-zinc-400">
                      <span>{p.name}</span>
                      <span>{formatCHF(p.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Expenses */}
          <div className={`dashboard-card rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 p-4 ${isIndependant ? 'col-span-1' : ''}`}>
            <div className="mb-1 text-xs font-medium text-violet-100">Depenses du mois</div>
            <div className="text-xl font-bold text-white">
              {formatCHF(totalExpenses)}
              <span className="ml-1 text-xs font-normal text-violet-200">CHF</span>
            </div>
          </div>

          {/* Remaining */}
          <div className="dashboard-card rounded-xl bg-white p-4">
            <div className="mb-1 text-xs font-medium text-zinc-500">{isIndependant ? 'Reste' : 'Reste a depenser'}</div>
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
                  className="w-full rounded border border-zinc-300 px-2 py-1 text-lg font-bold focus:border-violet-600 focus:outline-none"
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
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-violet-100">
                    <div
                      className="animate-progress h-full rounded-full bg-violet-600"
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
                className="w-full rounded-lg border border-zinc-200 px-3 py-2.5 text-base font-semibold focus:border-violet-600 focus:outline-none focus:ring-1 focus:ring-violet-600"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-500">Catégorie</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-lg border border-zinc-200 px-3 py-2.5 text-base focus:border-violet-600 focus:outline-none focus:ring-1 focus:ring-violet-600"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.icon} {c.name}
                  </option>
                ))}
                {isIndependant && (
                  <>
                    <option disabled>--- Pro ---</option>
                    {PRO_CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.icon} {c.name}
                      </option>
                    ))}
                  </>
                )}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-500">Description</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optionnel"
                className="w-full rounded-lg border border-zinc-200 px-3 py-2.5 text-base focus:border-violet-600 focus:outline-none focus:ring-1 focus:ring-violet-600"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-zinc-500">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-lg border border-zinc-200 px-3 py-2.5 text-base focus:border-violet-600 focus:outline-none focus:ring-1 focus:ring-violet-600"
              />
            </div>
          </div>
          <div className="mt-4 flex gap-3">
            <button
              type="submit"
              className="flex-1 rounded-lg bg-violet-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-700 active:bg-violet-800"
            >
              Ajouter
            </button>
            <button
              type="button"
              onClick={() => setShowScanner(true)}
              className="flex items-center gap-2 rounded-lg border-2 border-violet-600 px-4 py-2.5 text-sm font-semibold text-violet-600 transition-colors hover:bg-violet-50 active:bg-violet-100"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
              </svg>
              Scanner
            </button>
          </div>
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
                            className="ml-1 rounded-lg p-1.5 text-zinc-300 transition-colors hover:bg-violet-50 hover:text-violet-500"
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
