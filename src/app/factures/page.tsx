"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getReceipt } from "@/lib/receiptStorage";

// ─── Types ──────────────────────────────────────────────────────────────────

interface ReceiptEntry {
  id: string;
  receiptId: string;
  description: string;
  amount: number;
  date: string;
  category: string;
  type: "expense" | "paidBill" | "billToPay";
  monthKey: string;
}

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
  { id: "materiel", icon: "💻", name: "Matériel" },
  { id: "logiciel", icon: "🖥️", name: "Logiciel / Abo" },
  { id: "comptable", icon: "📊", name: "Comptable / Fiduciaire" },
  { id: "bureau", icon: "🏢", name: "Loyer bureau" },
  { id: "deplacement", icon: "🚗", name: "Déplacement pro" },
  { id: "formation", icon: "📚", name: "Formation" },
  { id: "marketing", icon: "📣", name: "Marketing / Pub" },
  { id: "soustraitance", icon: "🤝", name: "Sous-traitance" },
] as const;

function getCategoryInfo(id: string) {
  return CATEGORIES.find((c) => c.id === id) || { id: "autre", icon: "📦", name: "Autre" };
}

function formatCHF(amount: number): string {
  return amount.toLocaleString("fr-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const MONTH_NAMES = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("fr-CH", { day: "numeric", month: "short", year: "numeric" });
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function Factures() {
  const [entries, setEntries] = useState<ReceiptEntry[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [viewerImage, setViewerImage] = useState<string | null>(null);

  // Scan all months in localStorage for entries with receiptId
  useEffect(() => {
    const allEntries: ReceiptEntry[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith("mi-budget-")) continue;

      const monthKey = key.replace("mi-budget-", "");

      try {
        const data = JSON.parse(localStorage.getItem(key) || "{}");

        // Expenses with receiptId
        if (data.expenses) {
          for (const exp of data.expenses) {
            if (exp.receiptId) {
              allEntries.push({
                id: exp.id,
                receiptId: exp.receiptId,
                description: exp.description || "Dépense",
                amount: exp.amount,
                date: exp.date,
                category: exp.category || "autre",
                type: "expense",
                monthKey,
              });
            }
          }
        }

        // Paid bills with receiptId
        if (data.paidBills) {
          for (const bill of data.paidBills) {
            if (bill.receiptId) {
              allEntries.push({
                id: bill.id,
                receiptId: bill.receiptId,
                description: bill.name || "Facture payée",
                amount: bill.amount,
                date: bill.date,
                category: bill.category || "autre",
                type: "paidBill",
                monthKey,
              });
            }
          }
        }

        // Bills to pay with receiptId (if we ever add it)
        if (data.billsToPay) {
          for (const bill of data.billsToPay) {
            if (bill.receiptId) {
              allEntries.push({
                id: bill.id,
                receiptId: bill.receiptId,
                description: bill.name || "Facture à payer",
                amount: bill.amount,
                date: bill.dueDate,
                category: bill.category || "autre",
                type: "billToPay",
                monthKey,
              });
            }
          }
        }
      } catch { /* ignore */ }
    }

    // Sort by date descending
    allEntries.sort((a, b) => b.date.localeCompare(a.date));
    setEntries(allEntries);
    setLoaded(true);
  }, []);

  // Group by month
  const grouped: Record<string, ReceiptEntry[]> = {};
  for (const entry of entries) {
    const [year, month] = entry.monthKey.split("-");
    const label = `${MONTH_NAMES[parseInt(month) - 1]} ${year}`;
    if (!grouped[label]) grouped[label] = [];
    grouped[label].push(entry);
  }

  async function viewReceipt(receiptId: string) {
    const img = await getReceipt(receiptId);
    if (img) setViewerImage(img);
  }

  if (!loaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 pb-24">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-lg sm:max-w-none items-center justify-between px-4 py-3">
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
            <span className="text-violet-600">Mes</span> factures
          </h1>
          <div className="w-16" />
        </div>
      </header>

      {/* Content */}
      <div className="mx-auto max-w-lg sm:max-w-none px-4 pt-4 space-y-4">
        {entries.length === 0 ? (
          <div className="rounded-2xl bg-white p-8 shadow-sm border border-zinc-100 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100">
              <svg className="h-8 w-8 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-zinc-700">Aucune facture scannée</p>
            <p className="mt-1 text-xs text-zinc-400">
              Scannez vos tickets et factures depuis le dashboard pour les retrouver ici
            </p>
            <Link
              href="/dashboard"
              className="mt-4 inline-block rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700"
            >
              Aller au dashboard
            </Link>
          </div>
        ) : (
          Object.entries(grouped).map(([monthLabel, monthEntries]) => (
            <div key={monthLabel}>
              <h2 className="mb-2 text-sm font-semibold text-zinc-500">{monthLabel}</h2>
              <div className="rounded-2xl bg-white shadow-sm border border-zinc-100 overflow-hidden">
                {monthEntries.map((entry, i) => {
                  const cat = getCategoryInfo(entry.category);
                  return (
                    <button
                      key={entry.id}
                      onClick={() => viewReceipt(entry.receiptId)}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-violet-50 ${
                        i > 0 ? "border-t border-zinc-100" : ""
                      }`}
                    >
                      <span className="text-2xl">{cat.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-zinc-900">{entry.description}</div>
                        <div className="text-xs text-zinc-400">
                          {formatDate(entry.date)}
                          {entry.type === "paidBill" && " · Facture payée"}
                          {entry.type === "billToPay" && " · Facture à payer"}
                        </div>
                      </div>
                      <div className="text-sm font-semibold text-zinc-900">{formatCHF(entry.amount)} CHF</div>
                      <svg className="h-4 w-4 text-violet-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                      </svg>
                    </button>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Receipt Viewer */}
      {viewerImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={() => setViewerImage(null)}>
          <div className="relative max-h-[90vh] max-w-lg mx-4" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setViewerImage(null)}
              className="absolute -top-3 -right-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-lg text-zinc-500 hover:text-zinc-800"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={viewerImage} alt="Facture scannée" className="max-h-[85vh] w-full rounded-2xl object-contain bg-white shadow-2xl" />
          </div>
        </div>
      )}
    </div>
  );
}
