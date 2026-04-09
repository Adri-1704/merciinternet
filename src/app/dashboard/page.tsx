"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import ReceiptScanner from "@/components/ReceiptScanner";
import GamificationBar from "@/components/GamificationBar";
import GamificationPanel from "@/components/GamificationPanel";
import { saveReceipt, getReceipt } from "@/lib/receiptStorage";
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
  receiptId?: string;
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
  type: 'perso' | 'pro';
}

interface PaidBill {
  id: string;
  name: string;
  amount: number;
  date: string;
  category: string;
  receiptId?: string;
}

interface BillToPay {
  id: string;
  name: string;
  amount: number;
  dueDate: string;
  paid: boolean;
  category?: string;
}

interface BudgetData {
  income: number;
  incomes: IncomePerson[];
  savingsGoal: number;
  expenses: Expense[];
  mode: 'particulier' | 'independant';
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
  return { income: 0, incomes: [], savingsGoal: 0, expenses: [], mode: 'independant', invoices: [], bankAccounts: [], paidBills: [], billsToPay: [] };
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
      if (!data.mode) data.mode = 'independant';
      if (!data.invoices) data.invoices = [];
      if (!data.bankAccounts) data.bankAccounts = [];
      if (!data.paidBills) data.paidBills = [];
      if (!data.billsToPay) data.billsToPay = [];
      return data;
    }
  } catch {
    /* ignore */
  }
  return defaultBudget();
}

// Persist mode globally so it carries across months
function loadGlobalMode(): 'particulier' | 'independant' {
  if (typeof window === "undefined") return 'independant';
  try {
    return (localStorage.getItem('mi-mode') as 'particulier' | 'independant') || 'independant';
  } catch { return 'independant'; }
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
  const [scannerTarget, setScannerTarget] = useState<'expense' | 'paidBill' | 'billToPay'>('expense');
  const [newPersonName, setNewPersonName] = useState("");
  const [newPersonAmount, setNewPersonAmount] = useState("");
  const [gamData, setGamData] = useState<GamificationData | null>(null);
  const [showGamification, setShowGamification] = useState(false);
  const [newBadgeToast, setNewBadgeToast] = useState<string | null>(null);
  const [showInvoicePanel, setShowInvoicePanel] = useState(false);
  const [invoiceClient, setInvoiceClient] = useState("");
  const [invoiceAmount, setInvoiceAmount] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(todayStr());
  const [showTreasuryPanel, setShowTreasuryPanel] = useState<'perso' | 'pro' | null>(null);
  const [newAccountName, setNewAccountName] = useState("");
  const [newAccountBalance, setNewAccountBalance] = useState("");
  const showPaidBills = true;
  const [newBillName, setNewBillName] = useState("");
  const [newBillAmount, setNewBillAmount] = useState("");
  const [newBillDate, setNewBillDate] = useState(todayStr());
  const [newBillCategory, setNewBillCategory] = useState("autre");
  const [newBillToPayName, setNewBillToPayName] = useState("");
  const [newBillToPayAmount, setNewBillToPayAmount] = useState("");
  const [newBillToPayDate, setNewBillToPayDate] = useState(todayStr());
  const [newBillToPayCategory, setNewBillToPayCategory] = useState("autre");
  const [showExportModal, setShowExportModal] = useState(false);
  const [receiptViewer, setReceiptViewer] = useState<string | null>(null);
  const [fiduciaryEmail, setFiduciaryEmail] = useState("");
  const [fiduciaryName, setFiduciaryName] = useState("");
  const [showFiduciarySettings, setShowFiduciarySettings] = useState(false);
  const [fiduciarySent, setFiduciarySent] = useState(false);
  const isIndépendant = true;

  // Load data
  useEffect(() => {
    const data = loadBudget(monthKey);
    // Apply global mode preference
    const globalMode = loadGlobalMode();
    data.mode = globalMode;
    setBudget(data);
    setLoaded(true);
  }, [monthKey]);

  // Load fiduciary settings
  useEffect(() => {
    try {
      const raw = localStorage.getItem("mi-fiduciary");
      if (raw) {
        const data = JSON.parse(raw);
        setFiduciaryEmail(data.email || "");
        setFiduciaryName(data.name || "");
      }
    } catch { /* ignore */ }
  }, []);

  function saveFiduciary(email: string, name: string) {
    setFiduciaryEmail(email);
    setFiduciaryName(name);
    localStorage.setItem("mi-fiduciary", JSON.stringify({ email, name }));
  }

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

  const totalIncome = isIndépendant
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

  // Treasury computed values
  const PRO_CATEGORY_IDS: string[] = PRO_CATEGORIES.map((c) => c.id);
  const persoAccounts = budget.bankAccounts.filter((a) => a.type === 'perso');
  const proAccounts = budget.bankAccounts.filter((a) => a.type === 'pro');
  const totalPersoBalance = persoAccounts.reduce((s, a) => s + a.balance, 0);
  const totalProBalance = proAccounts.reduce((s, a) => s + a.balance, 0);

  const persoExpenses = budget.expenses.filter((e) => !PRO_CATEGORY_IDS.includes(e.category));
  const proExpenses = budget.expenses.filter((e) => PRO_CATEGORY_IDS.includes(e.category));
  const totalPersoExpenses = persoExpenses.reduce((s, e) => s + e.amount, 0);
  const totalProExpenses = proExpenses.reduce((s, e) => s + e.amount, 0);

  const persoIncome = budget.incomes.reduce((s, p) => s + p.amount, 0) || budget.income;
  const proIncome = totalPaidInvoices;

  const persoFlux = persoIncome - totalPersoExpenses;
  const proFlux = proIncome - totalProExpenses;

  const persoProjection = totalPersoBalance + persoFlux;
  const proProjection = totalProBalance + proFlux;

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
    expenses: { amount: number; category: string; description: string; date: string }[],
    receiptImage?: string
  ) {
    const receiptId = receiptImage ? crypto.randomUUID() : undefined;
    if (receiptImage && receiptId) {
      saveReceipt(receiptId, receiptImage).catch(() => {});
    }

    if (scannerTarget === 'paidBill') {
      const newBills: PaidBill[] = expenses.map((exp) => ({
        id: crypto.randomUUID(),
        name: exp.description || 'Facture scannée',
        amount: Math.round(exp.amount * 100) / 100,
        date: exp.date,
        category: exp.category,
        receiptId,
      }));
      persist({ ...budget, paidBills: [...budget.paidBills, ...newBills] });
      setShowScanner(false);
      return;
    }

    if (scannerTarget === 'billToPay') {
      const newBills: BillToPay[] = expenses.map((exp) => ({
        id: crypto.randomUUID(),
        name: exp.description || 'Facture scannée',
        amount: Math.round(exp.amount * 100) / 100,
        dueDate: exp.date,
        paid: false,
      }));
      persist({ ...budget, billsToPay: [...budget.billsToPay, ...newBills] });
      setShowScanner(false);
      return;
    }

    // Default: expense
    const newExpenses: Expense[] = expenses.map((exp) => ({
      id: crypto.randomUUID(),
      amount: Math.round(exp.amount * 100) / 100,
      category: exp.category,
      description: exp.description,
      date: exp.date,
      createdAt: new Date().toISOString(),
      receiptId,
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

  function openScanner(target: 'expense' | 'paidBill' | 'billToPay') {
    setScannerTarget(target);
    setShowScanner(true);
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
    setShowInvoicePanel(false);
  }

  function addBankAccount(type: 'perso' | 'pro') {
    const parsed = parseFloat(newAccountBalance);
    if (!newAccountName.trim() || isNaN(parsed)) return;
    const account: BankAccount = {
      id: crypto.randomUUID(),
      name: newAccountName.trim(),
      balance: Math.round(parsed * 100) / 100,
      type,
    };
    persist({ ...budget, bankAccounts: [...budget.bankAccounts, account] });
    setNewAccountName("");
    setNewAccountBalance("");
  }

  function deleteBankAccount(id: string) {
    persist({ ...budget, bankAccounts: budget.bankAccounts.filter((a) => a.id !== id) });
  }

  function updateAccountBalance(id: string, value: string) {
    const parsed = parseFloat(value);
    if (isNaN(parsed)) return;
    persist({
      ...budget,
      bankAccounts: budget.bankAccounts.map((a) =>
        a.id === id ? { ...a, balance: Math.round(parsed * 100) / 100 } : a
      ),
    });
  }

  function addPaidBill() {
    const parsed = parseFloat(newBillAmount);
    if (!newBillName.trim() || isNaN(parsed) || parsed <= 0) return;
    const bill: PaidBill = {
      id: crypto.randomUUID(),
      name: newBillName.trim(),
      amount: Math.round(parsed * 100) / 100,
      date: newBillDate,
      category: newBillCategory,
    };
    persist({ ...budget, paidBills: [...budget.paidBills, bill] });
    setNewBillName("");
    setNewBillAmount("");
    setNewBillDate(todayStr());
    setNewBillCategory("autre");
  }

  function deletePaidBill(id: string) {
    persist({ ...budget, paidBills: budget.paidBills.filter((b) => b.id !== id) });
  }

  function addBillToPay() {
    const parsed = parseFloat(newBillToPayAmount);
    if (!newBillToPayName.trim() || isNaN(parsed) || parsed <= 0) return;
    const bill: BillToPay = {
      id: crypto.randomUUID(),
      name: newBillToPayName.trim(),
      amount: Math.round(parsed * 100) / 100,
      dueDate: newBillToPayDate,
      paid: false,
      category: newBillToPayCategory,
    };
    persist({ ...budget, billsToPay: [...budget.billsToPay, bill] });
    setNewBillToPayName("");
    setNewBillToPayAmount("");
    setNewBillToPayDate(todayStr());
    setNewBillToPayCategory("autre");
  }

  const [payingBillId, setPayingBillId] = useState<string | null>(null);
  const [payFromAccount, setPayFromAccount] = useState<string>("");

  function markBillAsPaid(id: string) {
    const bill = budget.billsToPay.find((b) => b.id === id);
    if (!bill) return;

    // Create expense from bill
    const newExpense: Expense = {
      id: crypto.randomUUID(),
      amount: bill.amount,
      category: "autre",
      description: `Facture: ${bill.name}`,
      date: todayStr(),
      createdAt: new Date().toISOString(),
    };

    // Deduct from selected bank account
    const updatedAccounts = payFromAccount
      ? budget.bankAccounts.map((a) =>
          a.id === payFromAccount ? { ...a, balance: Math.round((a.balance - bill.amount) * 100) / 100 } : a
        )
      : budget.bankAccounts;

    persist({
      ...budget,
      billsToPay: budget.billsToPay.map((b) =>
        b.id === id ? { ...b, paid: true } : b
      ),
      expenses: [...budget.expenses, newExpense],
      bankAccounts: updatedAccounts,
    });

    setPayingBillId(null);
    setPayFromAccount("");
  }

  function unmarkBillAsPaid(id: string) {
    const bill = budget.billsToPay.find((b) => b.id === id);
    if (!bill) return;

    // Remove the expense that was created
    const updatedExpenses = budget.expenses.filter(
      (e) => !(e.description === `Facture: ${bill.name}` && e.amount === bill.amount)
    );

    persist({
      ...budget,
      billsToPay: budget.billsToPay.map((b) =>
        b.id === id ? { ...b, paid: false } : b
      ),
      expenses: updatedExpenses,
    });
  }

  function deleteBillToPay(id: string) {
    persist({ ...budget, billsToPay: budget.billsToPay.filter((b) => b.id !== id) });
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

  // ─── Export functions ────────────────────────────────────────────────────────

  const monthLabel = `${MONTH_NAMES[currentDate.getMonth()]} ${currentDate.getFullYear()}`;

  function exportCSV() {
    const lines: string[] = [];
    lines.push("Type,Date,Catégorie,Description,Montant CHF");

    // Dépenses
    for (const exp of budget.expenses) {
      const cat = getCategoryInfo(exp.category);
      lines.push(`Dépense,${exp.date},${cat.name},"${exp.description.replace(/"/g, '""')}",${exp.amount.toFixed(2)}`);
    }

    // Factures clients (indépendant)
    for (const inv of budget.invoices) {
      lines.push(`Facture client,${inv.date},,${inv.clientName.replace(/"/g, '""')},${inv.amount.toFixed(2)}`);
    }

    // Factures payées
    for (const bill of budget.paidBills) {
      const cat = getCategoryInfo(bill.category);
      lines.push(`Facture payée,${bill.date},${cat.name},"${bill.name.replace(/"/g, '""')}",${bill.amount.toFixed(2)}`);
    }

    // Factures à payer
    for (const bill of budget.billsToPay) {
      const cat = bill.category ? getCategoryInfo(bill.category) : { name: "Autre" };
      lines.push(`À payer${bill.paid ? " (payée)" : ""},${bill.dueDate},${cat.name},"${bill.name.replace(/"/g, '""')}",${bill.amount.toFixed(2)}`);
    }

    const csv = "\uFEFF" + lines.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `merciinternet_${monthKey}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setShowExportModal(false);
  }

  function exportPDF() {
    const totalExpenses = budget.expenses.reduce((s, e) => s + e.amount, 0);
    const totalIncome = isIndépendant
      ? budget.invoices.filter(i => i.paid).reduce((s, i) => s + i.amount, 0)
      : budget.incomes.length > 0
        ? budget.incomes.reduce((s, p) => s + p.amount, 0)
        : budget.income;

    // Grouper dépenses par catégorie
    const expByCategory: Record<string, number> = {};
    for (const exp of budget.expenses) {
      const cat = getCategoryInfo(exp.category);
      expByCategory[cat.name] = (expByCategory[cat.name] || 0) + exp.amount;
    }

    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Merciinternet — ${monthLabel}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 800px; margin: 0 auto; padding: 40px 20px; color: #333; }
    h1 { color: #7C3AED; font-size: 24px; margin-bottom: 4px; }
    h2 { color: #555; font-size: 18px; margin-top: 30px; border-bottom: 2px solid #7C3AED; padding-bottom: 6px; }
    .subtitle { color: #888; font-size: 14px; margin-bottom: 30px; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13px; }
    th { background: #f4f4f5; text-align: left; padding: 8px 10px; font-weight: 600; }
    td { padding: 8px 10px; border-bottom: 1px solid #e4e4e7; }
    .amount { text-align: right; font-weight: 600; }
    .total-row { background: #f9fafb; font-weight: 700; }
    .summary { display: flex; gap: 20px; margin-top: 20px; }
    .summary-card { flex: 1; padding: 16px; border-radius: 12px; text-align: center; }
    .summary-card.income { background: #ecfdf5; color: #059669; }
    .summary-card.expense { background: #fef2f2; color: #dc2626; }
    .summary-card.balance { background: #f5f3ff; color: #7c3aed; }
    .summary-card .label { font-size: 12px; margin-bottom: 4px; }
    .summary-card .value { font-size: 22px; font-weight: 700; }
    @media print { body { padding: 20px; } }
  </style>
</head>
<body>
  <h1>Merciinternet</h1>
  <p class="subtitle">Rapport financier — ${monthLabel}</p>

  <div class="summary">
    <div class="summary-card income"><div class="label">Revenus</div><div class="value">${formatCHF(totalIncome)} CHF</div></div>
    <div class="summary-card expense"><div class="label">Dépenses</div><div class="value">${formatCHF(totalExpenses)} CHF</div></div>
    <div class="summary-card balance"><div class="label">Solde</div><div class="value">${formatCHF(totalIncome - totalExpenses)} CHF</div></div>
  </div>

  ${budget.expenses.length > 0 ? `
  <h2>Dépenses</h2>
  <table>
    <thead><tr><th>Date</th><th>Catégorie</th><th>Description</th><th class="amount">Montant</th></tr></thead>
    <tbody>
      ${budget.expenses.sort((a, b) => a.date.localeCompare(b.date)).map(exp => {
        const cat = getCategoryInfo(exp.category);
        return `<tr><td>${exp.date}</td><td>${cat.icon} ${cat.name}</td><td>${exp.description}</td><td class="amount">${formatCHF(exp.amount)} CHF</td></tr>`;
      }).join("")}
      <tr class="total-row"><td colspan="3">Total dépenses</td><td class="amount">${formatCHF(totalExpenses)} CHF</td></tr>
    </tbody>
  </table>` : ""}

  ${Object.keys(expByCategory).length > 0 ? `
  <h2>Résumé par catégorie</h2>
  <table>
    <thead><tr><th>Catégorie</th><th class="amount">Montant</th></tr></thead>
    <tbody>
      ${Object.entries(expByCategory).sort((a, b) => b[1] - a[1]).map(([name, amount]) =>
        `<tr><td>${name}</td><td class="amount">${formatCHF(amount)} CHF</td></tr>`
      ).join("")}
    </tbody>
  </table>` : ""}

  ${budget.invoices.length > 0 ? `
  <h2>Factures clients</h2>
  <table>
    <thead><tr><th>Date</th><th>Client</th><th>Statut</th><th class="amount">Montant</th></tr></thead>
    <tbody>
      ${budget.invoices.map(inv =>
        `<tr><td>${inv.date}</td><td>${inv.clientName}</td><td>${inv.paid ? "Payée" : "En attente"}</td><td class="amount">${formatCHF(inv.amount)} CHF</td></tr>`
      ).join("")}
    </tbody>
  </table>` : ""}

  ${budget.paidBills.length > 0 ? `
  <h2>Factures payées</h2>
  <table>
    <thead><tr><th>Date</th><th>Catégorie</th><th>Nom</th><th class="amount">Montant</th></tr></thead>
    <tbody>
      ${budget.paidBills.map(bill => {
        const cat = getCategoryInfo(bill.category);
        return `<tr><td>${bill.date}</td><td>${cat.icon} ${cat.name}</td><td>${bill.name}</td><td class="amount">${formatCHF(bill.amount)} CHF</td></tr>`;
      }).join("")}
    </tbody>
  </table>` : ""}

  ${budget.billsToPay.length > 0 ? `
  <h2>Factures à payer</h2>
  <table>
    <thead><tr><th>Échéance</th><th>Catégorie</th><th>Nom</th><th>Statut</th><th class="amount">Montant</th></tr></thead>
    <tbody>
      ${budget.billsToPay.map(bill => {
        const cat = bill.category ? getCategoryInfo(bill.category) : { icon: "📦", name: "Autre" };
        return `<tr><td>${bill.dueDate}</td><td>${cat.icon} ${cat.name}</td><td>${bill.name}</td><td>${bill.paid ? "Payée" : "À payer"}</td><td class="amount">${formatCHF(bill.amount)} CHF</td></tr>`;
      }).join("")}
    </tbody>
  </table>` : ""}

  ${budget.bankAccounts.length > 0 ? `
  <h2>Trésorerie</h2>
  <table>
    <thead><tr><th>Compte</th><th>Type</th><th class="amount">Solde</th></tr></thead>
    <tbody>
      ${budget.bankAccounts.map(a =>
        `<tr><td>${a.name}</td><td>${a.type === "perso" ? "Personnel" : "Professionnel"}</td><td class="amount">${formatCHF(a.balance)} CHF</td></tr>`
      ).join("")}
    </tbody>
  </table>` : ""}

  <p style="margin-top:40px;color:#aaa;font-size:11px;text-align:center;">Généré par Merciinternet.ch — ${new Date().toLocaleDateString("fr-CH")}</p>
</body>
</html>`;

    const w = window.open("", "_blank");
    if (w) {
      w.document.write(html);
      w.document.close();
      setTimeout(() => w.print(), 500);
    }
    setShowExportModal(false);
  }

  function sendToFiduciary() {
    if (!fiduciaryEmail) {
      setShowFiduciarySettings(true);
      return;
    }

    // Generate CSV and download it
    exportCSV();

    // Build email summary
    const totalExpenses = budget.expenses.reduce((s, e) => s + e.amount, 0);
    const totalIncome = isIndépendant
      ? budget.invoices.filter(i => i.paid).reduce((s, i) => s + i.amount, 0)
      : budget.incomes.length > 0
        ? budget.incomes.reduce((s, p) => s + p.amount, 0)
        : budget.income;
    const totalPaidBills = budget.paidBills.reduce((s, b) => s + b.amount, 0);
    const totalBillsToPay = budget.billsToPay.filter(b => !b.paid).reduce((s, b) => s + b.amount, 0);

    const subject = encodeURIComponent(`Rapport comptable ${monthLabel} — Merciinternet`);
    const body = encodeURIComponent(
`Bonjour${fiduciaryName ? ` ${fiduciaryName}` : ""},

Veuillez trouver ci-joint le rapport comptable du mois de ${monthLabel}.

Résumé :
- Revenus : ${formatCHF(totalIncome)} CHF
- Dépenses : ${formatCHF(totalExpenses)} CHF
- Factures payées : ${formatCHF(totalPaidBills)} CHF
- Reste à payer : ${formatCHF(totalBillsToPay)} CHF
- Solde : ${formatCHF(totalIncome - totalExpenses)} CHF

Le fichier CSV est en pièce jointe.

Cordialement,
Envoyé depuis Merciinternet.ch`
    );

    // Small delay so CSV download happens first
    setTimeout(() => {
      window.open(`mailto:${fiduciaryEmail}?subject=${subject}&body=${body}`, "_self");
    }, 500);

    setFiduciarySent(true);
    setTimeout(() => setFiduciarySent(false), 3000);
    setShowExportModal(false);
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
                      className="w-24 rounded-lg border border-zinc-200 px-2 py-1 text-right text-base font-semibold focus:border-violet-500 focus:outline-none"
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
                className="flex-1 rounded-xl border border-zinc-200 px-3 py-2.5 text-base focus:border-violet-500 focus:outline-none"
              />
              <input
                type="number"
                value={newPersonAmount}
                onChange={(e) => setNewPersonAmount(e.target.value)}
                placeholder="Revenu"
                onKeyDown={(e) => e.key === "Enter" && addIncomePerson()}
                className="w-28 rounded-xl border border-zinc-200 px-3 py-2.5 text-base focus:border-violet-500 focus:outline-none"
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
                <div className="text-xs text-green-600 font-medium">Encaissé</div>
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
                  <div key={inv.id} className="rounded-xl bg-zinc-50 p-3">
                    <div className="flex items-center gap-2">
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
                    <button
                      onClick={() => toggleInvoicePaid(inv.id)}
                      className={`mt-2 w-full rounded-lg py-1.5 text-xs font-semibold transition-colors ${inv.paid ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-orange-100 text-orange-700 hover:bg-orange-200'}`}
                    >
                      {inv.paid ? '✅ Encaissée — Cliquer pour mettre en attente' : '⏳ En attente — Cliquer pour marquer encaissée'}
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
                  className="flex-1 rounded-xl border border-zinc-200 px-3 py-2.5 text-base focus:border-violet-500 focus:outline-none"
                />
                <input
                  type="number"
                  value={invoiceAmount}
                  onChange={(e) => setInvoiceAmount(e.target.value)}
                  placeholder="Montant"
                  className="w-28 rounded-xl border border-zinc-200 px-3 py-2.5 text-base focus:border-violet-500 focus:outline-none"
                />
              </div>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={invoiceDate}
                  onChange={(e) => setInvoiceDate(e.target.value)}
                  className="flex-1 rounded-xl border border-zinc-200 px-3 py-2.5 text-base focus:border-violet-500 focus:outline-none"
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
              Cliquez sur le statut pour basculer entre encaissée et en attente
            </p>
          </div>
        </div>
      )}

      {/* Treasury Panel */}
      {showTreasuryPanel && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40" onClick={() => setShowTreasuryPanel(null)}>
          <div className="w-full max-w-md max-h-[85vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-white p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold">
                {showTreasuryPanel === 'perso' ? 'Trésorerie personnelle' : 'Trésorerie professionnelle'}
              </h3>
              <button onClick={() => setShowTreasuryPanel(null)} className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {/* Section 1: Mes comptes */}
            <div className="mb-5">
              <h4 className="mb-2 text-sm font-semibold text-zinc-600">Mes comptes</h4>
              {(showTreasuryPanel === 'perso' ? persoAccounts : proAccounts).length > 0 && (
                <div className="mb-3 space-y-2">
                  {(showTreasuryPanel === 'perso' ? persoAccounts : proAccounts).map((account) => (
                    <div key={account.id} className="flex items-center gap-2 rounded-xl bg-zinc-50 p-3">
                      <div className={`h-2.5 w-2.5 rounded-full ${account.type === 'perso' ? 'bg-emerald-500' : 'bg-indigo-500'}`} />
                      <span className="flex-1 text-sm font-medium truncate">{account.name}</span>
                      <input
                        type="number"
                        defaultValue={account.balance}
                        onBlur={(e) => updateAccountBalance(account.id, e.target.value)}
                        className="w-28 rounded-lg border border-zinc-200 px-2 py-1 text-right text-base font-semibold focus:border-violet-500 focus:outline-none"
                      />
                      <span className="text-xs text-zinc-400">CHF</span>
                      <button onClick={() => deleteBankAccount(account.id)} className="rounded-lg p-1 text-zinc-300 hover:bg-red-50 hover:text-red-500">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  ))}
                  <div className={`flex justify-between rounded-xl p-3 text-sm font-bold ${showTreasuryPanel === 'perso' ? 'bg-emerald-50 text-emerald-700' : 'bg-indigo-50 text-indigo-700'}`}>
                    <span>Total comptes</span>
                    <span>{formatCHF(showTreasuryPanel === 'perso' ? totalPersoBalance : totalProBalance)} CHF</span>
                  </div>
                </div>
              )}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newAccountName}
                  onChange={(e) => setNewAccountName(e.target.value)}
                  placeholder="Nom du compte"
                  className="flex-1 rounded-xl border border-zinc-200 px-3 py-2.5 text-base focus:border-violet-500 focus:outline-none"
                />
                <input
                  type="number"
                  value={newAccountBalance}
                  onChange={(e) => setNewAccountBalance(e.target.value)}
                  placeholder="Solde"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      addBankAccount(showTreasuryPanel!);
                    }
                  }}
                  className="w-28 rounded-xl border border-zinc-200 px-3 py-2.5 text-base focus:border-violet-500 focus:outline-none"
                />
                <button
                  onClick={() => addBankAccount(showTreasuryPanel!)}
                  className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700"
                >
                  +
                </button>
              </div>
            </div>

            {/* Section 2: Flux du mois */}
            <div className="mb-5">
              <h4 className="mb-2 text-sm font-semibold text-zinc-600">Flux du mois</h4>
              <div className="space-y-2">
                <div className="flex justify-between rounded-xl bg-green-50 p-3 text-sm">
                  <span className="text-green-700 font-medium">
                    {showTreasuryPanel === 'perso' ? 'Revenus' : 'Factures encaissées'}
                  </span>
                  <span className="text-green-700 font-bold">
                    +{formatCHF(showTreasuryPanel === 'perso' ? persoIncome : proIncome)} CHF
                  </span>
                </div>
                <div className="flex justify-between rounded-xl bg-red-50 p-3 text-sm">
                  <span className="text-red-600 font-medium">Dépenses</span>
                  <span className="text-red-600 font-bold">
                    -{formatCHF(showTreasuryPanel === 'perso' ? totalPersoExpenses : totalProExpenses)} CHF
                  </span>
                </div>
                <div className={`flex justify-between rounded-xl p-3 text-sm font-bold ${(showTreasuryPanel === 'perso' ? persoFlux : proFlux) >= 0 ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                  <span>Solde du mois</span>
                  <span>{(showTreasuryPanel === 'perso' ? persoFlux : proFlux) >= 0 ? '+' : ''}{formatCHF(showTreasuryPanel === 'perso' ? persoFlux : proFlux)} CHF</span>
                </div>
              </div>
            </div>

            {/* Section 3: Projection */}
            <div>
              <h4 className="mb-2 text-sm font-semibold text-zinc-600">Projection fin de mois</h4>
              <div className={`rounded-xl p-4 text-center ${(showTreasuryPanel === 'perso' ? persoProjection : proProjection) >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                <div className={`text-2xl font-bold ${(showTreasuryPanel === 'perso' ? persoProjection : proProjection) >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                  {formatCHF(showTreasuryPanel === 'perso' ? persoProjection : proProjection)} CHF
                </div>
                <div className="mt-1 text-xs text-zinc-500">
                  Solde comptes ({formatCHF(showTreasuryPanel === 'perso' ? totalPersoBalance : totalProBalance)}) + Flux du mois ({(showTreasuryPanel === 'perso' ? persoFlux : proFlux) >= 0 ? '+' : ''}{formatCHF(showTreasuryPanel === 'perso' ? persoFlux : proFlux)})
                </div>
              </div>
            </div>
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
        <div className="mx-auto flex max-w-lg sm:max-w-none items-center justify-between px-4 py-3">
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
            <Link
              href="/previsions"
              className="hidden sm:flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-violet-700"
              aria-label="Prévisions annuelles"
              title="Prévisions annuelles"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Prévisions
            </Link>
            <Link
              href="/factures"
              className="hidden sm:flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-violet-700"
              title="Mes factures"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
              </svg>
              Factures
            </Link>
            <button
              onClick={() => setShowExportModal(true)}
              className="hidden sm:flex items-center gap-1.5 rounded-lg border-2 border-violet-600 px-3 py-1.5 text-xs font-semibold text-violet-600 transition-colors hover:bg-violet-50"
              title="Exporter pour fiduciaire"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export
            </button>
          </div>
        </div>
      </header>

      {/* Mobile buttons */}
      <div className="mx-auto max-w-lg sm:max-w-none px-4 pt-3 pb-1">
        {/* Mobile buttons: Prévisions + Factures + Export */}
        <div className="flex gap-2 mt-2 sm:hidden">
          <Link
            href="/previsions"
            className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-violet-700"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Prévisions
          </Link>
          <Link
            href="/factures"
            className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-violet-700"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
            </svg>
            Factures
          </Link>
          <button
            onClick={() => setShowExportModal(true)}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border-2 border-violet-600 px-3 py-2 text-xs font-semibold text-violet-600 transition-colors hover:bg-violet-50"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export
          </button>
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

      <main className="mx-auto max-w-lg sm:max-w-none px-4 pb-8 pt-4">
        {/* Summary Cards */}
        <div className="mb-6 grid grid-cols-2 gap-3">
          {/* Income / Invoices card */}
          {isIndépendant ? (
            <>
              {/* Facturé ce mois */}
              <div
                className="dashboard-card cursor-pointer rounded-xl bg-white p-4"
                onClick={() => setShowInvoicePanel(true)}
              >
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs font-medium text-zinc-500">Facturé ce mois</span>
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
                      <span className="text-green-600">Encaissé</span>
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
                <div className="mb-1 text-xs font-medium text-green-100">Encaissé</div>
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
          <div className={`dashboard-card rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 p-4 ${isIndépendant ? 'col-span-1' : ''}`}>
            <div className="mb-1 text-xs font-medium text-violet-100">Dépenses du mois</div>
            <div className="text-xl font-bold text-white">
              {formatCHF(totalExpenses)}
              <span className="ml-1 text-xs font-normal text-violet-200">CHF</span>
            </div>
          </div>

          {/* Remaining */}
          <div className="dashboard-card rounded-xl bg-white p-4">
            <div className="mb-1 text-xs font-medium text-zinc-500">{isIndépendant ? 'Reste' : 'Reste à dépenser'}</div>
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

        {/* Treasury Section */}
        <div className={`mb-6 grid gap-3 ${isIndépendant ? 'grid-cols-2' : 'grid-cols-1'}`}>
          {/* Trésorerie personnelle */}
          <div
            className="cursor-pointer rounded-xl bg-gradient-to-br from-emerald-50 to-green-50 p-4 border border-emerald-100 transition-shadow hover:shadow-md"
            onClick={() => setShowTreasuryPanel('perso')}
          >
            <div className="mb-2 flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-emerald-500" />
              <span className="text-xs font-semibold text-emerald-700">Trésorerie perso</span>
            </div>
            <div className="text-lg font-bold text-zinc-900">
              {formatCHF(totalPersoBalance)}
              <span className="ml-1 text-xs font-normal text-zinc-400">CHF</span>
            </div>
            <div className="mt-2 space-y-0.5">
              <div className="flex justify-between text-[11px]">
                <span className="text-zinc-500">Flux du mois</span>
                <span className={persoFlux >= 0 ? 'text-green-600 font-medium' : 'text-red-500 font-medium'}>
                  {persoFlux >= 0 ? '+' : ''}{formatCHF(persoFlux)}
                </span>
              </div>
              <div className="flex justify-between text-[11px]">
                <span className="text-zinc-500">Estimation fin mois</span>
                <span className={`font-semibold ${persoProjection >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                  {formatCHF(persoProjection)}
                </span>
              </div>
            </div>
          </div>

          {/* Trésorerie professionnelle (independant only) */}
          {isIndépendant && (
            <div
              className="cursor-pointer rounded-xl bg-gradient-to-br from-indigo-50 to-blue-50 p-4 border border-indigo-100 transition-shadow hover:shadow-md"
              onClick={() => setShowTreasuryPanel('pro')}
            >
              <div className="mb-2 flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-indigo-500" />
                <span className="text-xs font-semibold text-indigo-700">Trésorerie pro</span>
              </div>
              <div className="text-lg font-bold text-zinc-900">
                {formatCHF(totalProBalance)}
                <span className="ml-1 text-xs font-normal text-zinc-400">CHF</span>
              </div>
              <div className="mt-2 space-y-0.5">
                <div className="flex justify-between text-[11px]">
                  <span className="text-zinc-500">Flux du mois</span>
                  <span className={proFlux >= 0 ? 'text-green-600 font-medium' : 'text-red-500 font-medium'}>
                    {proFlux >= 0 ? '+' : ''}{formatCHF(proFlux)}
                  </span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-zinc-500">Estimation fin mois</span>
                  <span className={`font-semibold ${proProjection >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                    {formatCHF(proProjection)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Paid Bills Section */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-zinc-700">
              Factures payées
            </h2>
          </div>

          {showPaidBills && (
            <div className="rounded-xl bg-white p-4 shadow-sm space-y-3">
              {budget.paidBills.length > 0 && (
                <div className="space-y-2">
                  {budget.paidBills.sort((a, b) => b.date.localeCompare(a.date)).map((bill) => {
                    const cat = getCategoryInfo(bill.category);
                    return (
                      <div key={bill.id} className="flex items-center gap-2 rounded-lg bg-zinc-50 p-2.5">
                        <span className="text-lg">{cat.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-zinc-800 truncate">{bill.name}</div>
                          <div className="text-[11px] text-zinc-400">{formatDate(bill.date)}</div>
                        </div>
                        <span className="text-sm font-semibold text-zinc-700">{formatCHF(bill.amount)}</span>
                        <button onClick={() => deletePaidBill(bill.id)} className="rounded p-1 text-zinc-300 hover:bg-red-50 hover:text-red-500">
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </div>
                    );
                  })}
                  <div className="flex justify-between rounded-lg bg-amber-50 p-2.5 text-sm font-bold text-amber-700">
                    <span>Total payé</span>
                    <span>{formatCHF(budget.paidBills.reduce((s, b) => s + b.amount, 0))} CHF</span>
                  </div>
                </div>
              )}

              <div className="border-t border-zinc-100 pt-3">
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={newBillName}
                    onChange={(e) => setNewBillName(e.target.value)}
                    placeholder="Nom de la facture"
                    className="col-span-2 rounded-lg border border-zinc-200 px-3 py-2 text-base focus:border-violet-500 focus:outline-none"
                  />
                  <input
                    type="number"
                    value={newBillAmount}
                    onChange={(e) => setNewBillAmount(e.target.value)}
                    placeholder="Montant CHF"
                    className="rounded-lg border border-zinc-200 px-3 py-2 text-base focus:border-violet-500 focus:outline-none"
                  />
                  <input
                    type="date"
                    value={newBillDate}
                    onChange={(e) => setNewBillDate(e.target.value)}
                    className="rounded-lg border border-zinc-200 px-3 py-2 text-base focus:border-violet-500 focus:outline-none"
                  />
                  <select
                    value={newBillCategory}
                    onChange={(e) => setNewBillCategory(e.target.value)}
                    className="rounded-lg border border-zinc-200 px-3 py-2 text-base focus:border-violet-500 focus:outline-none"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                    ))}
                  </select>
                  <button
                    onClick={addPaidBill}
                    className="rounded-lg bg-violet-600 py-2 text-sm font-semibold text-white hover:bg-violet-700"
                  >
                    Ajouter
                  </button>
                </div>
                <p className="mt-2 text-center text-[11px] text-zinc-400">
                  Ces factures sont suivies mais ne sont pas déduites de votre budget
                </p>
                <button
                  onClick={() => openScanner('paidBill')}
                  className="mt-2 w-full flex items-center justify-center gap-2 rounded-lg border-2 border-violet-600 py-2 text-sm font-semibold text-violet-600 hover:bg-violet-50"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" /><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" /></svg>
                  Scanner une facture
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Bills To Pay (independant mode) */}
        {isIndépendant && (
          <div className="mb-6">
            <h2 className="mb-3 text-sm font-semibold text-zinc-700">
              À payer
              {budget.billsToPay.filter(b => !b.paid).length > 0 && (
                <span className="ml-2 inline-flex items-center justify-center rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white">
                  {budget.billsToPay.filter(b => !b.paid).length}
                </span>
              )}
            </h2>
            <div className="rounded-xl bg-white p-4 shadow-sm space-y-3">
              {budget.billsToPay.length > 0 && (
                <div className="space-y-2">
                  {budget.billsToPay.sort((a, b) => a.dueDate.localeCompare(b.dueDate)).map((bill) => (
                    <div key={bill.id} className={`rounded-lg p-2.5 ${bill.paid ? 'bg-green-50' : 'bg-red-50'}`}>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 min-w-0">
                          <div className={`text-sm font-medium ${bill.paid ? 'text-green-700 line-through' : 'text-zinc-800'}`}>
                            {bill.category && <span className="mr-1">{getCategoryInfo(bill.category).icon}</span>}
                            {bill.name}
                          </div>
                          <div className="text-[11px] text-zinc-400">Échéance : {formatDate(bill.dueDate)}</div>
                        </div>
                        <span className={`text-sm font-semibold ${bill.paid ? 'text-green-600' : 'text-red-600'}`}>{formatCHF(bill.amount)} CHF</span>
                        <button onClick={() => deleteBillToPay(bill.id)} className="rounded p-1 text-zinc-300 hover:bg-red-100 hover:text-red-500">
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </div>
                      {bill.paid ? (
                        <button
                          onClick={() => unmarkBillAsPaid(bill.id)}
                          className="mt-2 w-full rounded-lg py-1.5 text-xs font-semibold bg-green-200 text-green-800 hover:bg-green-300 transition-colors"
                        >
                          ✅ Payée — Cliquer pour annuler
                        </button>
                      ) : payingBillId === bill.id ? (
                        <div className="mt-2 space-y-2">
                          <select
                            value={payFromAccount}
                            onChange={(e) => setPayFromAccount(e.target.value)}
                            className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-base focus:border-violet-500 focus:outline-none"
                          >
                            <option value="">Sans déduire d&apos;un compte</option>
                            {budget.bankAccounts.map((a) => (
                              <option key={a.id} value={a.id}>
                                {a.name} ({formatCHF(a.balance)} CHF)
                              </option>
                            ))}
                          </select>
                          <div className="flex gap-2">
                            <button
                              onClick={() => markBillAsPaid(bill.id)}
                              className="flex-1 rounded-lg bg-violet-600 py-2 text-xs font-semibold text-white hover:bg-violet-700"
                            >
                              Confirmer le paiement
                            </button>
                            <button
                              onClick={() => { setPayingBillId(null); setPayFromAccount(""); }}
                              className="rounded-lg border border-zinc-200 px-3 py-2 text-xs text-zinc-500 hover:bg-zinc-50"
                            >
                              Annuler
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setPayingBillId(bill.id)}
                          className="mt-2 w-full rounded-lg py-1.5 text-xs font-semibold bg-red-200 text-red-800 hover:bg-red-300 transition-colors"
                        >
                          💳 Marquer comme payée
                        </button>
                      )}
                    </div>
                  ))}
                  <div className="flex justify-between rounded-lg bg-red-50 p-2.5 text-sm font-bold text-red-700">
                    <span>Reste à payer</span>
                    <span>{formatCHF(budget.billsToPay.filter(b => !b.paid).reduce((s, b) => s + b.amount, 0))} CHF</span>
                  </div>
                </div>
              )}
              <div className="border-t border-zinc-100 pt-3">
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={newBillToPayName}
                    onChange={(e) => setNewBillToPayName(e.target.value)}
                    placeholder="Nom (fournisseur, taxe...)"
                    className="col-span-2 rounded-lg border border-zinc-200 px-3 py-2 text-base focus:border-violet-500 focus:outline-none"
                  />
                  <input
                    type="number"
                    value={newBillToPayAmount}
                    onChange={(e) => setNewBillToPayAmount(e.target.value)}
                    placeholder="Montant CHF"
                    className="rounded-lg border border-zinc-200 px-3 py-2 text-base focus:border-violet-500 focus:outline-none"
                  />
                  <input
                    type="date"
                    value={newBillToPayDate}
                    onChange={(e) => setNewBillToPayDate(e.target.value)}
                    className="rounded-lg border border-zinc-200 px-3 py-2 text-base focus:border-violet-500 focus:outline-none"
                  />
                  <select
                    value={newBillToPayCategory}
                    onChange={(e) => setNewBillToPayCategory(e.target.value)}
                    className="col-span-2 rounded-lg border border-zinc-200 px-3 py-2 text-base focus:border-violet-500 focus:outline-none"
                  >
                    {ALL_CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={addBillToPay}
                  className="mt-2 w-full rounded-lg bg-red-600 py-2 text-sm font-semibold text-white hover:bg-red-700"
                >
                  Ajouter une facture à payer
                </button>
                <button
                  onClick={() => openScanner('billToPay')}
                  className="mt-2 w-full flex items-center justify-center gap-2 rounded-lg border-2 border-red-600 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" /><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" /></svg>
                  Scanner une facture
                </button>
              </div>
            </div>
          </div>
        )}

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
                {isIndépendant && (
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
              onClick={() => openScanner('expense')}
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
                          {exp.receiptId && (
                            <button
                              onClick={() => {
                                getReceipt(exp.receiptId!).then((img) => {
                                  if (img) setReceiptViewer(img);
                                });
                              }}
                              className="rounded-lg p-1.5 text-violet-400 transition-colors hover:bg-violet-50 hover:text-violet-600"
                              aria-label="Voir le reçu"
                              title="Voir le reçu"
                            >
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                              </svg>
                            </button>
                          )}
                          <button
                            onClick={() => deleteExpense(exp.id)}
                            className="rounded-lg p-1.5 text-zinc-300 transition-colors hover:bg-violet-50 hover:text-violet-500"
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

      {/* Receipt Viewer */}
      {receiptViewer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={() => setReceiptViewer(null)}>
          <div className="relative max-h-[90vh] max-w-lg mx-4" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setReceiptViewer(null)}
              className="absolute -top-3 -right-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-lg text-zinc-500 hover:text-zinc-800"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={receiptViewer} alt="Reçu scanné" className="max-h-[85vh] w-full rounded-2xl object-contain bg-white shadow-2xl" />
          </div>
        </div>
      )}

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40" onClick={() => setShowExportModal(false)}>
          <div className="w-full max-w-md rounded-t-2xl sm:rounded-2xl bg-white p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-zinc-800 mb-1">Exporter {monthLabel}</h2>
            <p className="text-sm text-zinc-500 mb-5">Choisissez le format d&apos;export pour votre fiduciaire</p>

            <div className="space-y-3">
              {/* Send to fiduciary */}
              <button
                onClick={sendToFiduciary}
                className="w-full flex items-center gap-4 rounded-xl border-2 border-violet-300 bg-violet-50 p-4 text-left transition-colors hover:border-violet-500"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-200 text-violet-700">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <div className="text-sm font-semibold text-violet-800">
                    Envoyer à {fiduciaryName || "ma fiduciaire"}
                  </div>
                  <div className="text-xs text-violet-600">
                    {fiduciaryEmail ? `${fiduciaryEmail} — CSV + résumé par email` : "Configurer l'email de votre fiduciaire"}
                  </div>
                </div>
              </button>

              <button
                onClick={exportCSV}
                className="w-full flex items-center gap-4 rounded-xl border-2 border-zinc-200 p-4 text-left transition-colors hover:border-emerald-400 hover:bg-emerald-50"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 font-bold text-sm">CSV</div>
                <div>
                  <div className="text-sm font-semibold text-zinc-800">Export CSV</div>
                  <div className="text-xs text-zinc-500">Compatible Excel, Google Sheets, logiciels comptables</div>
                </div>
              </button>

              <button
                onClick={exportPDF}
                className="w-full flex items-center gap-4 rounded-xl border-2 border-zinc-200 p-4 text-left transition-colors hover:border-red-400 hover:bg-red-50"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100 text-red-600 font-bold text-sm">PDF</div>
                <div>
                  <div className="text-sm font-semibold text-zinc-800">Export PDF</div>
                  <div className="text-xs text-zinc-500">Rapport complet avec résumé, idéal pour la fiduciaire</div>
                </div>
              </button>
            </div>

            {/* Fiduciary settings link */}
            <button
              onClick={() => { setShowExportModal(false); setShowFiduciarySettings(true); }}
              className="mt-3 w-full text-center text-xs text-violet-600 underline"
            >
              {fiduciaryEmail ? "Modifier l'email fiduciaire" : "Configurer l'email fiduciaire"}
            </button>

            <button
              onClick={() => setShowExportModal(false)}
              className="mt-3 w-full rounded-lg border border-zinc-200 py-2.5 text-sm font-medium text-zinc-500 hover:bg-zinc-50"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Fiduciary Settings Modal */}
      {showFiduciarySettings && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40" onClick={() => setShowFiduciarySettings(false)}>
          <div className="w-full max-w-md rounded-t-2xl sm:rounded-2xl bg-white p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-zinc-800 mb-1">Ma fiduciaire</h2>
            <p className="text-sm text-zinc-500 mb-5">Configurez les coordonnées de votre fiduciaire pour l&apos;envoi mensuel</p>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-500">Nom de la fiduciaire</label>
                <input
                  type="text"
                  value={fiduciaryName}
                  onChange={(e) => setFiduciaryName(e.target.value)}
                  placeholder="Ex: Fiduciaire Dupont SA"
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2.5 text-base focus:border-violet-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-500">Email</label>
                <input
                  type="email"
                  value={fiduciaryEmail}
                  onChange={(e) => setFiduciaryEmail(e.target.value)}
                  placeholder="comptabilite@fiduciaire.ch"
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2.5 text-base focus:border-violet-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="mt-5 flex gap-3">
              <button
                onClick={() => setShowFiduciarySettings(false)}
                className="flex-1 rounded-lg border border-zinc-200 py-2.5 text-sm font-medium text-zinc-500 hover:bg-zinc-50"
              >
                Annuler
              </button>
              <button
                onClick={() => {
                  saveFiduciary(fiduciaryEmail, fiduciaryName);
                  setShowFiduciarySettings(false);
                }}
                className="flex-1 rounded-lg bg-violet-600 py-2.5 text-sm font-semibold text-white hover:bg-violet-700"
              >
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Fiduciary sent toast */}
      {fiduciarySent && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white shadow-lg">
          CSV téléchargé — email prêt à envoyer
        </div>
      )}
    </div>
  );
}
