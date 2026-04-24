"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";

// ─── Types ───────────────────────────────────────────────────────────────────

interface PlanParams {
  funkyfeetMarginPercent: number;
  aslMarginPercent: number;
  aslSaleAmount: number;
  aslSaleMonth: number; // 1-12
  barSalary: number;
  barStartMonth: number;
  barEndMonth: number;
  foireValaisAmount: number;
  foireValaisMonth: number;
  fixedPrivate: number;
  fixedBusiness: number;
  fixedStartMonth: number;
  fixedEndMonth: number;
  debtTotal: number;
  debtMonthly: number;
  debtEndMonth: number;
  objective: number;
  startingBalance: number;
  anchorMonth: number;     // Mois de référence (fin de mois) pour fixer le solde
  anchorBalance: number;   // Solde fixé à la fin du mois de référence
  anchorEnabled: boolean;  // Si true, on cale le tableau sur l'ancre
}

type OverrideField = "margin" | "aslMargin" | "bar" | "asl" | "foire" | "privateCost" | "businessCost" | "debt";

type MonthOverrides = Partial<Record<OverrideField, number>>;

interface Plan2026 {
  params: PlanParams;
  forecastCA: Record<number, number>;
  actualCA: Record<number, number>;
  aslCA: Record<number, number>; // CA Atelier Suisse par mois (jusqu'à vente)
  aslSaleByMonth: Record<number, number>; // Vente ASL par mois (cash à la signature)
  dailyCA: Record<string, number>; // { "2026-04-24": 150 }
  overrides: Record<number, MonthOverrides>;
  notes: string;
  lastUpdate: string;
}

// ─── Defaults ────────────────────────────────────────────────────────────────

const DEFAULT_PARAMS: PlanParams = {
  funkyfeetMarginPercent: 27.5,
  aslMarginPercent: 30,
  aslSaleAmount: 70000,
  aslSaleMonth: 7,
  barSalary: 2200,
  barStartMonth: 4,
  barEndMonth: 9,
  foireValaisAmount: 12000,
  foireValaisMonth: 10,
  fixedPrivate: 4500,
  fixedBusiness: 2000,
  fixedStartMonth: 4,
  fixedEndMonth: 12,
  debtTotal: 12000,
  debtMonthly: 3000,
  debtEndMonth: 7,
  objective: 100000,
  startingBalance: 0,
  anchorMonth: 4,       // fin avril
  anchorBalance: 0,     // solde 0 CHF au 30 avril
  anchorEnabled: true,  // activé par défaut
};

// CA Atelier Suisse par mois (0 par défaut — à remplir selon activité réelle)
// L'ASL est toujours en activité jusqu'à la vente (juillet par défaut)
const DEFAULT_ASL_CA: Record<number, number> = {
  4: 0, 5: 0, 6: 0, 7: 0,
};

// Vente Atelier Suisse — paiement cash à la signature (achat pur)
// Par défaut : 70 000 CHF en juillet
const DEFAULT_ASL_SALE: Record<number, number> = {
  7: 70000,
};

// CA forecast année complète (jan → déc)
// Total cible 2026 : 300 000 CHF
// Jan-Mars = réalisé (~25k YTD à répartir selon ton actuel)
// Avril = en cours. Mai → Déc = projection saisonnière
const DEFAULT_FORECAST_CA: Record<number, number> = {
  1: 7000,
  2: 8000,
  3: 10000,
  4: 6000,
  5: 10000,
  6: 13000,
  7: 16000,
  8: 20000,
  9: 27000,
  10: 42000,
  11: 65000,
  12: 76000,
};

const MONTHS = [
  { num: 1, name: "Janvier", short: "Jan" },
  { num: 2, name: "Février", short: "Fév" },
  { num: 3, name: "Mars", short: "Mar" },
  { num: 4, name: "Avril", short: "Avr" },
  { num: 5, name: "Mai", short: "Mai" },
  { num: 6, name: "Juin", short: "Juin" },
  { num: 7, name: "Juillet", short: "Jul" },
  { num: 8, name: "Août", short: "Aoû" },
  { num: 9, name: "Septembre", short: "Sep" },
  { num: 10, name: "Octobre", short: "Oct" },
  { num: 11, name: "Novembre", short: "Nov" },
  { num: 12, name: "Décembre", short: "Déc" },
];

const STORAGE_KEY = "mi-plan-2026";

// ─── Storage ─────────────────────────────────────────────────────────────────

function loadPlan(): Plan2026 {
  if (typeof window === "undefined") {
    return {
      params: DEFAULT_PARAMS,
      forecastCA: DEFAULT_FORECAST_CA,
      actualCA: {},
      aslCA: DEFAULT_ASL_CA,
      aslSaleByMonth: DEFAULT_ASL_SALE,
      dailyCA: {},
      overrides: {},
      notes: "",
      lastUpdate: new Date().toISOString(),
    };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw) as Partial<Plan2026>;
      // Migration: si aslSaleByMonth absent mais params.aslSaleAmount > 0, on migre
      const legacySale: Record<number, number> = {};
      const legacyAmount = (data.params as PlanParams | undefined)?.aslSaleAmount;
      const legacyMonth = (data.params as PlanParams | undefined)?.aslSaleMonth;
      if (!data.aslSaleByMonth && legacyAmount && legacyMonth) {
        legacySale[legacyMonth] = legacyAmount;
      }
      return {
        params: { ...DEFAULT_PARAMS, ...(data.params || {}) },
        forecastCA: { ...DEFAULT_FORECAST_CA, ...(data.forecastCA || {}) },
        actualCA: data.actualCA || {},
        aslCA: { ...DEFAULT_ASL_CA, ...(data.aslCA || {}) },
        aslSaleByMonth: data.aslSaleByMonth || legacySale,
        dailyCA: data.dailyCA || {},
        overrides: data.overrides || {},
        notes: data.notes || "",
        lastUpdate: data.lastUpdate || new Date().toISOString(),
      };
    }
  } catch {
    /* ignore */
  }
  return {
    params: DEFAULT_PARAMS,
    forecastCA: DEFAULT_FORECAST_CA,
    actualCA: {},
    aslCA: DEFAULT_ASL_CA,
    aslSaleByMonth: DEFAULT_ASL_SALE,
    dailyCA: {},
    overrides: {},
    notes: "",
    lastUpdate: new Date().toISOString(),
  };
}

function savePlan(plan: Plan2026) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...plan, lastUpdate: new Date().toISOString() }));
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function chf(n: number): string {
  if (Number.isNaN(n) || !Number.isFinite(n)) return "—";
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(Math.round(n));
  return sign + abs.toLocaleString("fr-CH").replace(/\u202F/g, " ") + " CHF";
}

function chfShort(n: number): string {
  if (Number.isNaN(n) || !Number.isFinite(n)) return "—";
  if (Math.abs(n) >= 10000) return Math.round(n / 1000) + " k";
  return Math.round(n).toLocaleString("fr-CH").replace(/\u202F/g, " ");
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

// ─── Keyboard navigation (Excel-like) ────────────────────────────────────────
// Colonnes éditables : 1=CA FF prévu, 2=CA FF réel, 3=Marge FF, 4=CA ASL,
// 5=Marge ASL, 6=Bar, 7=Vente ASL, 8=Foire VS, 10=Privé, 11=Entreprise, 12=Dette
const EDITABLE_COLS = [1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 12];
const TOTAL_ROWS = 12; // 12 mois

function focusCell(row: number, col: number) {
  const el = document.querySelector<HTMLElement>(`[data-cell="r${row}-c${col}"]`);
  if (!el) return;
  if (el.tagName === "INPUT") {
    el.focus();
    (el as HTMLInputElement).select?.();
  } else {
    // C'est un bouton → on entre en mode édition
    el.click();
  }
}

type NavDirection = "up" | "down" | "left" | "right";

function navigateFromCell(row: number, col: number, direction: NavDirection) {
  let nextRow = row;
  let nextCol = col;
  if (direction === "up") nextRow = Math.max(0, row - 1);
  else if (direction === "down") nextRow = Math.min(TOTAL_ROWS - 1, row + 1);
  else if (direction === "left") {
    const idx = EDITABLE_COLS.indexOf(col);
    if (idx > 0) nextCol = EDITABLE_COLS[idx - 1];
    else if (idx === 0 && row > 0) {
      nextRow = row - 1;
      nextCol = EDITABLE_COLS[EDITABLE_COLS.length - 1];
    }
  } else if (direction === "right") {
    const idx = EDITABLE_COLS.indexOf(col);
    if (idx >= 0 && idx < EDITABLE_COLS.length - 1) nextCol = EDITABLE_COLS[idx + 1];
    else if (idx === EDITABLE_COLS.length - 1 && row < TOTAL_ROWS - 1) {
      nextRow = row + 1;
      nextCol = EDITABLE_COLS[0];
    }
  }
  if (nextRow !== row || nextCol !== col) focusCell(nextRow, nextCol);
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function Plan2026Page() {
  const [plan, setPlan] = useState<Plan2026 | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [dailyDate, setDailyDate] = useState(todayISO());
  const [dailyAmount, setDailyAmount] = useState("");
  const [showParams, setShowParams] = useState(false);

  // Load
  useEffect(() => {
    setPlan(loadPlan());
    setLoaded(true);
  }, []);

  // Save on change
  useEffect(() => {
    if (loaded && plan) savePlan(plan);
  }, [plan, loaded]);

  const updateParams = (patch: Partial<PlanParams>) => {
    if (!plan) return;
    setPlan({ ...plan, params: { ...plan.params, ...patch } });
  };

  const updateForecastCA = (month: number, value: number) => {
    if (!plan) return;
    setPlan({ ...plan, forecastCA: { ...plan.forecastCA, [month]: value } });
  };

  const updateActualCA = (month: number, value: number) => {
    if (!plan) return;
    setPlan({ ...plan, actualCA: { ...plan.actualCA, [month]: value } });
  };

  const updateAslCA = (month: number, value: number) => {
    if (!plan) return;
    setPlan({ ...plan, aslCA: { ...plan.aslCA, [month]: value } });
  };

  const updateAslSale = (month: number, value: number) => {
    if (!plan) return;
    const next = { ...plan.aslSaleByMonth };
    if (value === 0) delete next[month];
    else next[month] = value;
    setPlan({ ...plan, aslSaleByMonth: next });
  };

  const addDailyCA = () => {
    if (!plan || !dailyAmount) return;
    const amount = parseFloat(dailyAmount);
    if (Number.isNaN(amount) || amount <= 0) return;
    const current = plan.dailyCA[dailyDate] || 0;
    const next = { ...plan.dailyCA, [dailyDate]: current + amount };
    // Auto-aggregate to actualCA for the month
    const month = parseInt(dailyDate.split("-")[1], 10);
    const monthlySum = Object.entries(next)
      .filter(([d]) => parseInt(d.split("-")[1], 10) === month)
      .reduce((s, [, v]) => s + v, 0);
    setPlan({
      ...plan,
      dailyCA: next,
      actualCA: { ...plan.actualCA, [month]: monthlySum },
    });
    setDailyAmount("");
  };

  const resetPlan = () => {
    if (!confirm("Réinitialiser le plan aux valeurs par défaut ? Toutes tes modifs seront perdues.")) return;
    setPlan({
      params: DEFAULT_PARAMS,
      forecastCA: DEFAULT_FORECAST_CA,
      actualCA: {},
      aslCA: DEFAULT_ASL_CA,
      aslSaleByMonth: DEFAULT_ASL_SALE,
      dailyCA: {},
      overrides: {},
      notes: "",
      lastUpdate: new Date().toISOString(),
    });
  };

  const setOverride = (month: number, field: OverrideField, value: number) => {
    if (!plan) return;
    const next = { ...(plan.overrides[month] || {}), [field]: value };
    setPlan({ ...plan, overrides: { ...plan.overrides, [month]: next } });
  };

  const clearOverride = (month: number, field: OverrideField) => {
    if (!plan) return;
    const monthOv = { ...(plan.overrides[month] || {}) };
    delete monthOv[field];
    const nextOv = { ...plan.overrides };
    if (Object.keys(monthOv).length === 0) delete nextOv[month];
    else nextOv[month] = monthOv;
    setPlan({ ...plan, overrides: nextOv });
  };

  const clearAllOverrides = () => {
    if (!plan) return;
    if (!confirm("Supprimer tous les overrides manuels et revenir aux valeurs calculées automatiquement ?")) return;
    setPlan({ ...plan, overrides: {} });
  };

  // ─── Calculations ──────────────────────────────────────────────────────────

  const rows = useMemo(() => {
    if (!plan) return [];
    const { params, forecastCA, actualCA, aslCA, aslSaleByMonth, overrides } = plan;
    let balanceForecast = params.startingBalance;
    let balanceReal = params.startingBalance;

    // Dernier mois avec un CA réel saisi (> 0)
    // Au-delà, le "Solde réel" sera masqué (affiché "—")
    const lastRealMonth = MONTHS.reduce((max, m) => {
      return (actualCA[m.num] || 0) > 0 ? m.num : max;
    }, 0);

    const computed = MONTHS.map((m) => {
      const ov = overrides[m.num] || {};
      const caForecast = forecastCA[m.num] || 0;
      const caActual = actualCA[m.num] || 0;
      const caAsl = aslCA[m.num] || 0;

      const autoMargin = caForecast * (params.funkyfeetMarginPercent / 100);
      const autoAslMargin = caAsl * (params.aslMarginPercent / 100);
      const autoBar = m.num >= params.barStartMonth && m.num <= params.barEndMonth ? params.barSalary : 0;
      const autoAsl = aslSaleByMonth[m.num] || 0;
      const autoFoire = m.num === params.foireValaisMonth ? params.foireValaisAmount : 0;
      const inFixedPeriod = m.num >= params.fixedStartMonth && m.num <= params.fixedEndMonth;
      const autoPrivate = inFixedPeriod ? params.fixedPrivate : 0;
      const autoBusiness = inFixedPeriod ? params.fixedBusiness : 0;
      const autoDebt = m.num <= params.debtEndMonth && m.num >= params.fixedStartMonth ? params.debtMonthly : 0;

      const marginForecast = ov.margin ?? autoMargin;
      const aslMargin = ov.aslMargin ?? autoAslMargin;
      const bar = ov.bar ?? autoBar;
      const asl = ov.asl ?? autoAsl;
      const foire = ov.foire ?? autoFoire;
      const privateCost = ov.privateCost ?? autoPrivate;
      const businessCost = ov.businessCost ?? autoBusiness;
      const debt = ov.debt ?? autoDebt;

      // Marge réelle basée sur CA réel saisi (0 si pas encore saisi)
      const marginReal = caActual * (params.funkyfeetMarginPercent / 100);
      // Si override manuel sur marge, on le respecte aussi pour la colonne réelle
      const marginRealEffective = ov.margin ?? marginReal;

      const totalInForecast = marginForecast + aslMargin + bar + asl + foire;
      const totalInReal = marginRealEffective + aslMargin + bar + asl + foire;
      const totalOut = privateCost + businessCost + debt;
      const netForecast = totalInForecast - totalOut;
      const netReal = totalInReal - totalOut;

      balanceForecast += netForecast;
      balanceReal += netReal;

      return {
        month: m,
        caForecast,
        caActual,
        caAsl,
        marginForecast,
        autoMargin,
        aslMargin,
        autoAslMargin,
        bar,
        autoBar,
        asl,
        autoAsl,
        foire,
        autoFoire,
        totalInForecast,
        totalInReal,
        privateCost,
        autoPrivate,
        businessCost,
        autoBusiness,
        debt,
        autoDebt,
        totalOut,
        netForecast,
        netReal,
        balanceForecast,
        balanceReal,
        hasReal: m.num <= lastRealMonth && lastRealMonth > 0,
        overrides: ov,
      };
    });

    // Ancrage : si activé, on décale les 2 séries de soldes (forecast + réel)
    // pour que le solde à la fin du mois d'ancrage soit égal à anchorBalance.
    if (params.anchorEnabled) {
      const anchorRow = computed.find((r) => r.month.num === params.anchorMonth);
      if (anchorRow) {
        const shiftForecast = params.anchorBalance - anchorRow.balanceForecast;
        const shiftReal = params.anchorBalance - anchorRow.balanceReal;
        computed.forEach((r) => {
          r.balanceForecast += shiftForecast;
          r.balanceReal += shiftReal;
        });
      }
    }

    return computed;
  }, [plan]);

  const finalBalance = rows.length ? rows[rows.length - 1].balanceForecast : 0;
  const lastRealRow = [...rows].reverse().find((r) => r.hasReal);
  const lastRealMonthName = lastRealRow?.month.name || null;
  const finalBalanceReal = lastRealRow?.balanceReal ?? null;
  const gap = plan ? plan.params.objective - finalBalance : 0;
  const cashNadir = rows.reduce((min, r) => Math.min(min, r.balanceForecast), Infinity);
  const cashNadirMonth = rows.find((r) => r.balanceForecast === cashNadir)?.month.name || "—";

  const totalForecastCA = Object.values(plan?.forecastCA || {}).reduce((s, v) => s + v, 0);
  const totalActualCA = Object.values(plan?.actualCA || {}).reduce((s, v) => s + v, 0);

  if (!loaded || !plan) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Chargement...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      {/* ─── HEADER ─── */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-900">← Dashboard</Link>
            <h1 className="text-xl font-bold text-gray-900">Plan Financier 2026</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowParams((s) => !s)}
              className="text-sm px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700"
            >
              {showParams ? "Masquer" : "Paramètres"}
            </button>
            <button
              onClick={resetPlan}
              className="text-sm px-3 py-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-700"
            >
              Réinitialiser
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* ─── KPIs ─── */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <KpiCard label="Objectif 31/12/2026" value={chf(plan.params.objective)} accent="primary" />
          <KpiCard
            label="Projection prévue fin année"
            value={chf(finalBalance)}
            accent={finalBalance >= plan.params.objective ? "success" : "warning"}
          />
          <KpiCard
            label={lastRealMonthName ? `Solde réel (fin ${lastRealMonthName})` : "Solde réel"}
            value={finalBalanceReal !== null ? chf(finalBalanceReal) : "—"}
            accent={
              finalBalanceReal === null
                ? "neutral"
                : finalBalanceReal >= plan.params.objective
                ? "success"
                : finalBalanceReal >= 0
                ? "neutral"
                : "danger"
            }
          />
          <KpiCard
            label={gap <= 0 ? "Objectif dépassé de" : "Écart à combler (prévu)"}
            value={chf(Math.abs(gap))}
            accent={gap <= 0 ? "success" : "danger"}
          />
          <KpiCard
            label={`Pic négatif (${cashNadirMonth})`}
            value={chf(cashNadir === Infinity ? 0 : cashNadir)}
            accent={cashNadir < 0 ? "danger" : "success"}
          />
        </div>

        {/* ─── VENTE ATELIER SUISSE — édition rapide ─── */}
        <div className="bg-white rounded-xl border-2 border-amber-400 p-4 md:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <div>
              <h2 className="text-base font-bold text-gray-900">🏢 Vente L&apos;Atelier Suisse</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Édition rapide. Tu peux aussi modifier directement la colonne "Vente ASL" dans le tableau.
              </p>
            </div>
            {Object.keys(plan.aslSaleByMonth).length > 0 && (
              <button
                onClick={() => {
                  if (confirm("Supprimer toutes les ventes Atelier Suisse ?")) {
                    setPlan({ ...plan, aslSaleByMonth: {} });
                  }
                }}
                className="text-xs px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold"
              >
                Tout effacer
              </button>
            )}
          </div>
          {Object.entries(plan.aslSaleByMonth).length === 0 ? (
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <p className="text-sm text-gray-600 mb-3">Aucune vente configurée.</p>
              <button
                onClick={() => updateAslSale(7, 70000)}
                className="text-sm px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-semibold"
              >
                + Ajouter une vente (70 000 CHF en juillet)
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {Object.entries(plan.aslSaleByMonth)
                .sort(([a], [b]) => parseInt(a, 10) - parseInt(b, 10))
                .map(([monthStr, amount]) => {
                  const monthNum = parseInt(monthStr, 10);
                  return (
                    <div key={monthNum} className="grid grid-cols-[1fr_1fr_auto] gap-3 items-end">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1 font-semibold">Mois</label>
                        <select
                          value={monthNum}
                          onChange={(e) => {
                            const newMonth = parseInt(e.target.value, 10);
                            if (newMonth === monthNum) return;
                            const next = { ...plan.aslSaleByMonth };
                            delete next[monthNum];
                            next[newMonth] = amount;
                            setPlan({ ...plan, aslSaleByMonth: next });
                          }}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
                        >
                          {MONTHS.map((m) => (
                            <option key={m.num} value={m.num}>
                              {m.name} 2026
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1 font-semibold">Montant (CHF)</label>
                        <input
                          type="number"
                          step={1000}
                          value={amount}
                          onChange={(e) => {
                            const v = parseFloat(e.target.value);
                            updateAslSale(monthNum, Number.isNaN(v) ? 0 : v);
                          }}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm tabular-nums font-semibold"
                        />
                      </div>
                      <button
                        onClick={() => updateAslSale(monthNum, 0)}
                        className="px-3 py-2 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold"
                        title="Supprimer cette vente"
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}
            </div>
          )}
        </div>

        {/* ─── REAL vs FORECAST CA ─── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <KpiCard
            label="CA FF total prévu (année)"
            value={chf(totalForecastCA)}
            accent="neutral"
          />
          <KpiCard
            label={lastRealMonthName ? `CA FF réel cumulé (→ ${lastRealMonthName})` : "CA FF réel cumulé"}
            value={chf(totalActualCA)}
            accent={totalActualCA > 0 ? "success" : "neutral"}
          />
          <KpiCard
            label="Progression vs objectif 300k"
            value={`${Math.round((totalActualCA / 300000) * 100)} %`}
            accent={totalActualCA >= 300000 ? "success" : totalActualCA >= 150000 ? "warning" : "neutral"}
          />
        </div>

        {/* ─── DAILY INPUT ─── */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-5">
          <h2 className="text-base font-bold text-gray-900 mb-3">Saisir une vente FunkyFeet du jour</h2>
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Date</label>
              <input
                type="date"
                value={dailyDate}
                onChange={(e) => setDailyDate(e.target.value)}
                min="2026-01-01"
                max="2026-12-31"
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Montant CHF</label>
              <input
                type="number"
                step="1"
                value={dailyAmount}
                onChange={(e) => setDailyAmount(e.target.value)}
                placeholder="Ex : 150"
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-32"
              />
            </div>
            <button
              onClick={addDailyCA}
              className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold"
            >
              Ajouter
            </button>
            <span className="text-xs text-gray-500 ml-2">
              Aujourd'hui cumulé : {chf(plan.dailyCA[todayISO()] || 0)}
            </span>
          </div>
          {Object.keys(plan.dailyCA).length > 0 && (
            <details className="mt-4">
              <summary className="text-xs text-violet-600 cursor-pointer hover:text-violet-800">
                Voir le détail jour par jour ({Object.keys(plan.dailyCA).length} entrées)
              </summary>
              <div className="mt-2 text-xs space-y-1 max-h-40 overflow-auto">
                {Object.entries(plan.dailyCA)
                  .sort((a, b) => b[0].localeCompare(a[0]))
                  .map(([date, amount]) => (
                    <div key={date} className="flex justify-between gap-4 py-1 border-b border-gray-100">
                      <span className="text-gray-700">{date}</span>
                      <span className="font-semibold text-gray-900">{chf(amount)}</span>
                      <button
                        onClick={() => {
                          if (!confirm(`Supprimer l'entrée du ${date} (${chf(amount)}) ?`)) return;
                          const next = { ...plan.dailyCA };
                          delete next[date];
                          const month = parseInt(date.split("-")[1], 10);
                          const monthlySum = Object.entries(next)
                            .filter(([d]) => parseInt(d.split("-")[1], 10) === month)
                            .reduce((s, [, v]) => s + v, 0);
                          setPlan({
                            ...plan,
                            dailyCA: next,
                            actualCA: { ...plan.actualCA, [month]: monthlySum },
                          });
                        }}
                        className="text-red-500 hover:text-red-700 text-[10px] uppercase tracking-wide"
                      >
                        suppr
                      </button>
                    </div>
                  ))}
              </div>
            </details>
          )}
        </div>

        {/* ─── PARAMS (collapsible) ─── */}
        {showParams && (
          <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-5 space-y-4">
            <h2 className="text-base font-bold text-gray-900">Paramètres du plan</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
              <ParamInput
                label="Marge nette FunkyFeet (%)"
                value={plan.params.funkyfeetMarginPercent}
                onChange={(v) => updateParams({ funkyfeetMarginPercent: v })}
                step={0.5}
              />
              <ParamInput
                label="Marge nette Atelier Suisse (%)"
                value={plan.params.aslMarginPercent}
                onChange={(v) => updateParams({ aslMarginPercent: v })}
                step={0.5}
              />
              <ParamInput
                label="Objectif solde 31/12 (CHF)"
                value={plan.params.objective}
                onChange={(v) => updateParams({ objective: v })}
                step={1000}
              />
              <ParamInput
                label="Solde de départ (CHF) — 1er janvier"
                value={plan.params.startingBalance}
                onChange={(v) => updateParams({ startingBalance: v })}
                step={500}
              />
              <div className="col-span-1 md:col-span-2 p-3 bg-violet-50 rounded-lg border border-violet-200">
                <label className="flex items-center gap-2 mb-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={plan.params.anchorEnabled}
                    onChange={(e) => updateParams({ anchorEnabled: e.target.checked })}
                    className="w-4 h-4"
                  />
                  <span className="text-sm font-semibold text-violet-900">
                    Ancrer le solde sur un mois précis
                  </span>
                </label>
                <p className="text-[11px] text-violet-800 mb-2">
                  Recadrage auto de la trésorerie : fixe le solde à une date connue, les autres mois se recalculent.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <ParamInput
                    label="Mois d'ancrage (1-12)"
                    value={plan.params.anchorMonth}
                    onChange={(v) => updateParams({ anchorMonth: v })}
                    min={1}
                    max={12}
                  />
                  <ParamInput
                    label="Solde fin de mois (CHF)"
                    value={plan.params.anchorBalance}
                    onChange={(v) => updateParams({ anchorBalance: v })}
                    step={500}
                  />
                </div>
              </div>
              <ParamInput
                label="Frais fixes privés / mois (CHF)"
                value={plan.params.fixedPrivate}
                onChange={(v) => updateParams({ fixedPrivate: v })}
                step={100}
              />
              <ParamInput
                label="Frais fixes entreprise / mois (CHF)"
                value={plan.params.fixedBusiness}
                onChange={(v) => updateParams({ fixedBusiness: v })}
                step={100}
              />
              <ParamInput
                label="Salaire bar / mois (CHF)"
                value={plan.params.barSalary}
                onChange={(v) => updateParams({ barSalary: v })}
                step={100}
              />
              <ParamInput
                label="Bar — début (mois)"
                value={plan.params.barStartMonth}
                onChange={(v) => updateParams({ barStartMonth: v })}
                min={1}
                max={12}
              />
              <ParamInput
                label="Bar — fin (mois)"
                value={plan.params.barEndMonth}
                onChange={(v) => updateParams({ barEndMonth: v })}
                min={1}
                max={12}
              />
              <ParamInput
                label="Foire du Valais — montant (CHF)"
                value={plan.params.foireValaisAmount}
                onChange={(v) => updateParams({ foireValaisAmount: v })}
                step={500}
              />
              <ParamInput
                label="Foire du Valais — mois"
                value={plan.params.foireValaisMonth}
                onChange={(v) => updateParams({ foireValaisMonth: v })}
                min={1}
                max={12}
              />
              <ParamInput
                label="Dette mensualité (CHF)"
                value={plan.params.debtMonthly}
                onChange={(v) => updateParams({ debtMonthly: v })}
                step={500}
              />
              <ParamInput
                label="Dette — dernier mois"
                value={plan.params.debtEndMonth}
                onChange={(v) => updateParams({ debtEndMonth: v })}
                min={1}
                max={12}
              />
            </div>
          </div>
        )}

        {/* ─── MAIN TABLE ─── */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 md:px-5 py-3 border-b border-gray-200 flex items-center justify-between gap-2">
            <h2 className="text-base font-bold text-gray-900">Prévisionnel mois par mois</h2>
            <div className="flex items-center gap-2">
              <span className="hidden md:inline text-xs text-gray-400">Cases bleues = éditables. Orange = override manuel.</span>
              {Object.keys(plan.overrides).length > 0 && (
                <button
                  onClick={clearAllOverrides}
                  className="text-xs px-2 py-1 rounded bg-amber-100 text-amber-800 hover:bg-amber-200"
                >
                  Reset overrides
                </button>
              )}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[10px] md:text-[11px]">
              <thead>
                <tr className="bg-gray-900 text-white">
                  <th className="px-2 py-1.5 text-left font-semibold whitespace-nowrap">Mois</th>
                  <th className="px-1.5 py-1.5 text-right font-semibold bg-blue-900 whitespace-nowrap">CA FF prévu</th>
                  <th className="px-1.5 py-1.5 text-right font-semibold bg-blue-900 whitespace-nowrap">CA FF réel</th>
                  <th className="px-1.5 py-1.5 text-right font-semibold whitespace-nowrap">Marge FF</th>
                  <th className="px-1.5 py-1.5 text-right font-semibold bg-blue-900 whitespace-nowrap">CA ASL</th>
                  <th className="px-1.5 py-1.5 text-right font-semibold whitespace-nowrap">Marge ASL</th>
                  <th className="px-1.5 py-1.5 text-right font-semibold whitespace-nowrap">Bar</th>
                  <th className="px-1.5 py-1.5 text-right font-semibold whitespace-nowrap">Vente ASL</th>
                  <th className="px-1.5 py-1.5 text-right font-semibold whitespace-nowrap">Foire VS</th>
                  <th className="px-1.5 py-1.5 text-right font-semibold bg-emerald-700 whitespace-nowrap">Total IN</th>
                  <th className="px-1.5 py-1.5 text-right font-semibold whitespace-nowrap">Privé</th>
                  <th className="px-1.5 py-1.5 text-right font-semibold whitespace-nowrap">Ent.</th>
                  <th className="px-1.5 py-1.5 text-right font-semibold whitespace-nowrap">Dette</th>
                  <th className="px-1.5 py-1.5 text-right font-semibold bg-rose-700 whitespace-nowrap">Total OUT</th>
                  <th className="px-1.5 py-1.5 text-right font-semibold whitespace-nowrap">Net</th>
                  <th className="px-1.5 py-1.5 text-right font-semibold bg-violet-700 whitespace-nowrap">Solde prévu</th>
                  <th className="px-1.5 py-1.5 text-right font-semibold bg-emerald-700 whitespace-nowrap">Solde réel</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.month.num} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                    <td className="px-2 py-1 font-semibold text-gray-900 whitespace-nowrap">{r.month.name}</td>
                    <td className="px-1 py-0.5 text-right bg-blue-50">
                      <EditableCell
                        value={r.caForecast}
                        onChange={(v) => updateForecastCA(r.month.num, v)}
                        row={i}
                        col={1}
                      />
                    </td>
                    <td className="px-1 py-0.5 text-right bg-blue-50">
                      <EditableCell
                        value={r.caActual}
                        onChange={(v) => updateActualCA(r.month.num, v)}
                        placeholder="—"
                        row={i}
                        col={2}
                      />
                    </td>
                    <td className="px-1 py-0.5 text-right">
                      <OverridableCell
                        value={r.marginForecast}
                        auto={r.autoMargin}
                        overridden={r.overrides.margin !== undefined}
                        onChange={(v) => setOverride(r.month.num, "margin", v)}
                        onReset={() => clearOverride(r.month.num, "margin")}
                        row={i}
                        col={3}
                      />
                    </td>
                    <td className="px-1 py-0.5 text-right bg-blue-50">
                      <EditableCell
                        value={r.caAsl}
                        onChange={(v) => updateAslCA(r.month.num, v)}
                        placeholder="—"
                        row={i}
                        col={4}
                      />
                    </td>
                    <td className="px-1 py-0.5 text-right">
                      <OverridableCell
                        value={r.aslMargin}
                        auto={r.autoAslMargin}
                        overridden={r.overrides.aslMargin !== undefined}
                        onChange={(v) => setOverride(r.month.num, "aslMargin", v)}
                        onReset={() => clearOverride(r.month.num, "aslMargin")}
                        row={i}
                        col={5}
                      />
                    </td>
                    <td className="px-1 py-0.5 text-right">
                      <OverridableCell
                        value={r.bar}
                        auto={r.autoBar}
                        overridden={r.overrides.bar !== undefined}
                        onChange={(v) => setOverride(r.month.num, "bar", v)}
                        onReset={() => clearOverride(r.month.num, "bar")}
                        row={i}
                        col={6}
                      />
                    </td>
                    <td className="px-1 py-0.5 text-right bg-blue-50">
                      <EditableCell
                        value={r.asl}
                        onChange={(v) => updateAslSale(r.month.num, v)}
                        placeholder="—"
                        row={i}
                        col={7}
                      />
                    </td>
                    <td className="px-1 py-0.5 text-right">
                      <OverridableCell
                        value={r.foire}
                        auto={r.autoFoire}
                        overridden={r.overrides.foire !== undefined}
                        onChange={(v) => setOverride(r.month.num, "foire", v)}
                        onReset={() => clearOverride(r.month.num, "foire")}
                        row={i}
                        col={8}
                      />
                    </td>
                    <td className="px-1.5 py-1 text-right tabular-nums font-semibold text-emerald-700 bg-emerald-50 whitespace-nowrap">
                      {chfShort(r.totalInForecast)}
                    </td>
                    <td className="px-1 py-0.5 text-right">
                      <OverridableCell
                        value={r.privateCost}
                        auto={r.autoPrivate}
                        overridden={r.overrides.privateCost !== undefined}
                        onChange={(v) => setOverride(r.month.num, "privateCost", v)}
                        onReset={() => clearOverride(r.month.num, "privateCost")}
                        row={i}
                        col={10}
                      />
                    </td>
                    <td className="px-1 py-0.5 text-right">
                      <OverridableCell
                        value={r.businessCost}
                        auto={r.autoBusiness}
                        overridden={r.overrides.businessCost !== undefined}
                        onChange={(v) => setOverride(r.month.num, "businessCost", v)}
                        onReset={() => clearOverride(r.month.num, "businessCost")}
                        row={i}
                        col={11}
                      />
                    </td>
                    <td className="px-1 py-0.5 text-right">
                      <OverridableCell
                        value={r.debt}
                        auto={r.autoDebt}
                        overridden={r.overrides.debt !== undefined}
                        onChange={(v) => setOverride(r.month.num, "debt", v)}
                        onReset={() => clearOverride(r.month.num, "debt")}
                        row={i}
                        col={12}
                      />
                    </td>
                    <td className="px-1.5 py-1 text-right tabular-nums font-semibold text-rose-700 bg-rose-50 whitespace-nowrap">
                      {chfShort(r.totalOut)}
                    </td>
                    <td className={`px-1.5 py-1 text-right tabular-nums font-semibold whitespace-nowrap ${r.netForecast >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                      {r.netForecast >= 0 ? "+" : ""}{chfShort(r.netForecast)}
                    </td>
                    <td className={`px-1.5 py-1 text-right tabular-nums font-bold whitespace-nowrap ${r.balanceForecast >= 0 ? "text-violet-800 bg-violet-50" : "text-rose-700 bg-rose-50"}`}>
                      {chfShort(r.balanceForecast)}
                    </td>
                    <td className={`px-1.5 py-1 text-right tabular-nums font-bold whitespace-nowrap ${!r.hasReal ? "text-gray-300 bg-gray-50" : r.balanceReal >= 0 ? "text-emerald-800 bg-emerald-50" : "text-rose-700 bg-rose-50"}`}>
                      {r.hasReal ? chfShort(r.balanceReal) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-100 border-t-2 border-gray-900 font-bold">
                  <td className="px-1.5 py-2">TOTAL</td>
                  <td className="px-1.5 py-2 text-right tabular-nums">{chfShort(totalForecastCA)}</td>
                  <td className="px-1.5 py-2 text-right tabular-nums">{chfShort(totalActualCA)}</td>
                  <td className="px-1.5 py-2 text-right tabular-nums">
                    {chfShort(rows.reduce((s, r) => s + r.marginForecast, 0))}
                  </td>
                  <td className="px-1.5 py-2 text-right tabular-nums">
                    {chfShort(rows.reduce((s, r) => s + r.caAsl, 0))}
                  </td>
                  <td className="px-1.5 py-2 text-right tabular-nums">
                    {chfShort(rows.reduce((s, r) => s + r.aslMargin, 0))}
                  </td>
                  <td className="px-1.5 py-2 text-right tabular-nums">{chfShort(rows.reduce((s, r) => s + r.bar, 0))}</td>
                  <td className="px-1.5 py-2 text-right tabular-nums">{chfShort(rows.reduce((s, r) => s + r.asl, 0))}</td>
                  <td className="px-1.5 py-2 text-right tabular-nums">{chfShort(rows.reduce((s, r) => s + r.foire, 0))}</td>
                  <td className="px-1.5 py-2 text-right tabular-nums text-emerald-700">
                    {chfShort(rows.reduce((s, r) => s + r.totalInForecast, 0))}
                  </td>
                  <td className="px-1.5 py-2 text-right tabular-nums">{chfShort(rows.reduce((s, r) => s + r.privateCost, 0))}</td>
                  <td className="px-1.5 py-2 text-right tabular-nums">{chfShort(rows.reduce((s, r) => s + r.businessCost, 0))}</td>
                  <td className="px-1.5 py-2 text-right tabular-nums">{chfShort(rows.reduce((s, r) => s + r.debt, 0))}</td>
                  <td className="px-1.5 py-2 text-right tabular-nums text-rose-700">
                    {chfShort(rows.reduce((s, r) => s + r.totalOut, 0))}
                  </td>
                  <td className="px-1.5 py-2 text-right tabular-nums text-emerald-700">
                    +{chfShort(rows.reduce((s, r) => s + r.netForecast, 0))}
                  </td>
                  <td className="px-1.5 py-2 text-right tabular-nums text-violet-800 bg-violet-100">
                    {chfShort(finalBalance)}
                  </td>
                  <td className="px-1.5 py-2 text-right tabular-nums text-emerald-800 bg-emerald-100">
                    {(() => {
                      const lastRealRow = [...rows].reverse().find((r) => r.hasReal);
                      return lastRealRow ? chfShort(lastRealRow.balanceReal) : "—";
                    })()}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* ─── ALERTE CASH ─── */}
        {cashNadir < 0 && (
          <div className="bg-amber-50 border-l-4 border-amber-500 rounded-lg p-4">
            <h3 className="font-bold text-amber-900 mb-1">⚠️ Alerte trésorerie</h3>
            <p className="text-sm text-amber-900">
              Tu seras en négatif cumulé jusqu'en {cashNadirMonth} avec un pic à {chf(cashNadir)}. Prévois une trésorerie tampon ou une ligne de crédit courte avant cette période.
            </p>
          </div>
        )}

        {/* ─── NOTES ─── */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 md:p-5">
          <h2 className="text-base font-bold text-gray-900 mb-3">Notes personnelles</h2>
          <textarea
            value={plan.notes}
            onChange={(e) => setPlan({ ...plan, notes: e.target.value })}
            placeholder="Idées, décisions, rappels..."
            rows={5}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-y"
          />
          <p className="text-xs text-gray-400 mt-2">
            Sauvegarde automatique. Dernière mise à jour : {new Date(plan.lastUpdate).toLocaleString("fr-CH")}
          </p>
        </div>
      </main>
    </div>
  );
}

// ─── Subcomponents ───────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: "primary" | "success" | "warning" | "danger" | "neutral";
}) {
  const accentClass = {
    primary: "border-l-violet-600 bg-violet-50",
    success: "border-l-emerald-500 bg-emerald-50",
    warning: "border-l-amber-500 bg-amber-50",
    danger: "border-l-rose-500 bg-rose-50",
    neutral: "border-l-gray-300 bg-gray-50",
  }[accent];

  return (
    <div className={`border-l-4 ${accentClass} rounded-lg p-3 md:p-4`}>
      <p className="text-[10px] md:text-xs uppercase tracking-wider text-gray-500 font-semibold mb-1">{label}</p>
      <p className="text-lg md:text-xl font-bold text-gray-900 tabular-nums">{value}</p>
    </div>
  );
}

function ParamInput({
  label,
  value,
  onChange,
  step = 1,
  min,
  max,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
}) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      <input
        type="number"
        step={step}
        min={min}
        max={max}
        value={value}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          if (!Number.isNaN(v)) onChange(v);
        }}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm tabular-nums"
      />
    </div>
  );
}

function EditableCell({
  value,
  onChange,
  placeholder,
  row,
  col,
}: {
  value: number;
  onChange: (v: number) => void;
  placeholder?: string;
  row?: number;
  col?: number;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value.toString());

  useEffect(() => {
    if (!editing) setDraft(value.toString());
  }, [value, editing]);

  const dataCell = row !== undefined && col !== undefined ? `r${row}-c${col}` : undefined;

  const commit = (nextDraft: string) => {
    const v = parseFloat(nextDraft);
    if (!Number.isNaN(v)) onChange(v);
    else onChange(0);
  };

  if (editing) {
    return (
      <input
        data-cell={dataCell}
        type="number"
        value={draft}
        autoFocus
        onChange={(e) => setDraft(e.target.value)}
        onFocus={(e) => e.target.select()}
        onBlur={() => {
          commit(draft);
          setEditing(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            commit(draft);
            setEditing(false);
            if (row !== undefined && col !== undefined) {
              setTimeout(() => navigateFromCell(row, col, "down"), 0);
            }
            e.preventDefault();
          } else if (e.key === "Tab") {
            commit(draft);
            setEditing(false);
            if (row !== undefined && col !== undefined) {
              setTimeout(() => navigateFromCell(row, col, e.shiftKey ? "left" : "right"), 0);
            }
            e.preventDefault();
          } else if (e.key === "Escape") {
            setDraft(value.toString());
            setEditing(false);
          } else if (e.key === "ArrowUp" || e.key === "ArrowDown" || e.key === "ArrowLeft" || e.key === "ArrowRight") {
            commit(draft);
            setEditing(false);
            if (row !== undefined && col !== undefined) {
              const dir = e.key === "ArrowUp" ? "up" : e.key === "ArrowDown" ? "down" : e.key === "ArrowLeft" ? "left" : "right";
              setTimeout(() => navigateFromCell(row, col, dir), 0);
            }
            e.preventDefault();
          }
        }}
        className="w-16 md:w-20 text-right border border-blue-400 rounded px-1 py-0.5 text-[10px] md:text-[11px] tabular-nums bg-white"
      />
    );
  }

  return (
    <button
      data-cell={dataCell}
      onClick={() => setEditing(true)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === "F2") {
          setEditing(true);
          e.preventDefault();
        } else if (
          row !== undefined &&
          col !== undefined &&
          (e.key === "ArrowUp" || e.key === "ArrowDown" || e.key === "ArrowLeft" || e.key === "ArrowRight")
        ) {
          const dir = e.key === "ArrowUp" ? "up" : e.key === "ArrowDown" ? "down" : e.key === "ArrowLeft" ? "left" : "right";
          navigateFromCell(row, col, dir);
          e.preventDefault();
        }
      }}
      className="w-full text-right tabular-nums text-blue-900 hover:bg-blue-100 focus:bg-blue-200 focus:outline focus:outline-2 focus:outline-blue-500 rounded px-0.5 py-0.5 font-semibold whitespace-nowrap"
    >
      {value !== 0 ? chfShort(value) : placeholder || "0"}
    </button>
  );
}

function OverridableCell({
  value,
  auto,
  overridden,
  onChange,
  onReset,
  row,
  col,
}: {
  value: number;
  auto: number;
  overridden: boolean;
  onChange: (v: number) => void;
  onReset: () => void;
  row?: number;
  col?: number;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value.toString());

  useEffect(() => {
    if (!editing) setDraft(value.toString());
  }, [value, editing]);

  const dataCell = row !== undefined && col !== undefined ? `r${row}-c${col}` : undefined;

  const commit = (nextDraft: string) => {
    const v = parseFloat(nextDraft);
    if (!Number.isNaN(v)) {
      if (Math.abs(v - auto) < 0.001) onReset();
      else onChange(v);
    }
  };

  if (editing) {
    return (
      <input
        data-cell={dataCell}
        type="number"
        value={draft}
        autoFocus
        onChange={(e) => setDraft(e.target.value)}
        onFocus={(e) => e.target.select()}
        onBlur={() => {
          commit(draft);
          setEditing(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            commit(draft);
            setEditing(false);
            if (row !== undefined && col !== undefined) {
              setTimeout(() => navigateFromCell(row, col, "down"), 0);
            }
            e.preventDefault();
          } else if (e.key === "Tab") {
            commit(draft);
            setEditing(false);
            if (row !== undefined && col !== undefined) {
              setTimeout(() => navigateFromCell(row, col, e.shiftKey ? "left" : "right"), 0);
            }
            e.preventDefault();
          } else if (e.key === "Escape") {
            setDraft(value.toString());
            setEditing(false);
          } else if (e.key === "ArrowUp" || e.key === "ArrowDown" || e.key === "ArrowLeft" || e.key === "ArrowRight") {
            commit(draft);
            setEditing(false);
            if (row !== undefined && col !== undefined) {
              const dir = e.key === "ArrowUp" ? "up" : e.key === "ArrowDown" ? "down" : e.key === "ArrowLeft" ? "left" : "right";
              setTimeout(() => navigateFromCell(row, col, dir), 0);
            }
            e.preventDefault();
          }
        }}
        className="w-16 md:w-20 text-right border border-amber-500 rounded px-1 py-0.5 text-[10px] md:text-[11px] tabular-nums bg-white"
      />
    );
  }

  const displayColor = overridden
    ? value < 0
      ? "text-rose-700 hover:bg-rose-100 font-bold"
      : "text-amber-700 hover:bg-amber-100 font-bold"
    : value !== 0
    ? "text-gray-700 hover:bg-gray-100"
    : "text-gray-300 hover:bg-gray-100";

  return (
    <div className="flex items-center justify-end gap-0.5">
      <button
        data-cell={dataCell}
        onClick={() => setEditing(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === "F2") {
            setEditing(true);
            e.preventDefault();
          } else if (
            row !== undefined &&
            col !== undefined &&
            (e.key === "ArrowUp" || e.key === "ArrowDown" || e.key === "ArrowLeft" || e.key === "ArrowRight")
          ) {
            const dir = e.key === "ArrowUp" ? "up" : e.key === "ArrowDown" ? "down" : e.key === "ArrowLeft" ? "left" : "right";
            navigateFromCell(row, col, dir);
            e.preventDefault();
          } else if (overridden && (e.key === "Delete" || e.key === "Backspace")) {
            onReset();
            e.preventDefault();
          }
        }}
        className={`text-right tabular-nums rounded px-0.5 py-0.5 whitespace-nowrap focus:outline focus:outline-2 focus:outline-amber-500 ${displayColor}`}
        title={overridden ? `Override manuel (auto = ${chfShort(auto)}) — Suppr pour reset` : "Clic pour override"}
      >
        {value !== 0 ? chfShort(value) : "—"}
      </button>
      {overridden && (
        <button
          onClick={onReset}
          className="text-amber-500 hover:text-amber-700 text-[9px] leading-none"
          title="Supprimer l'override (revenir à l'auto)"
        >
          ↺
        </button>
      )}
    </div>
  );
}
