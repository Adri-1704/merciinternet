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
      return {
        params: { ...DEFAULT_PARAMS, ...(data.params || {}) },
        forecastCA: { ...DEFAULT_FORECAST_CA, ...(data.forecastCA || {}) },
        actualCA: data.actualCA || {},
        aslCA: { ...DEFAULT_ASL_CA, ...(data.aslCA || {}) },
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
    const { params, forecastCA, actualCA, aslCA, overrides } = plan;
    let balanceForecast = params.startingBalance;
    let balanceReal = params.startingBalance;

    const computed = MONTHS.map((m) => {
      const ov = overrides[m.num] || {};
      const caForecast = forecastCA[m.num] || 0;
      const caActual = actualCA[m.num] || 0;
      const caAsl = aslCA[m.num] || 0;

      const autoMargin = caForecast * (params.funkyfeetMarginPercent / 100);
      const autoAslMargin = caAsl * (params.aslMarginPercent / 100);
      const autoBar = m.num >= params.barStartMonth && m.num <= params.barEndMonth ? params.barSalary : 0;
      const autoAsl = m.num === params.aslSaleMonth ? params.aslSaleAmount : 0;
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
  const finalBalanceReal = rows.length ? rows[rows.length - 1].balanceReal : 0;
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
            label="Solde réel fin année"
            value={chf(finalBalanceReal)}
            accent={finalBalanceReal >= plan.params.objective ? "success" : finalBalanceReal >= 0 ? "neutral" : "danger"}
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

        {/* ─── REAL vs FORECAST ─── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <KpiCard label="CA YTD réalisé (jan → 23 avr.)" value={chf(25000)} accent="neutral" />
          <KpiCard label="CA prévu (avril → déc)" value={chf(totalForecastCA)} accent="neutral" />
          <KpiCard
            label="CA FunkyFeet réel saisi"
            value={chf(totalActualCA)}
            accent={totalActualCA > 0 ? "success" : "neutral"}
          />
        </div>
        <p className="text-xs text-gray-500 -mt-3 px-1">
          Objectif année : <strong>300 000 CHF</strong> (25 000 YTD + 275 000 reste à faire).
          La marge YTD (~6 875 CHF = 25k × 27,5%) n'est pas dans le tableau : ajoute-la au solde de départ dans les paramètres si tu veux en tenir compte.
        </p>

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
                label="Vente ASL — montant (CHF)"
                value={plan.params.aslSaleAmount}
                onChange={(v) => updateParams({ aslSaleAmount: v })}
                step={5000}
              />
              <ParamInput
                label="Vente ASL — mois"
                value={plan.params.aslSaleMonth}
                onChange={(v) => updateParams({ aslSaleMonth: v })}
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
                      />
                    </td>
                    <td className="px-1 py-0.5 text-right bg-blue-50">
                      <EditableCell
                        value={r.caActual}
                        onChange={(v) => updateActualCA(r.month.num, v)}
                        placeholder="—"
                      />
                    </td>
                    <td className="px-1 py-0.5 text-right">
                      <OverridableCell
                        value={r.marginForecast}
                        auto={r.autoMargin}
                        overridden={r.overrides.margin !== undefined}
                        onChange={(v) => setOverride(r.month.num, "margin", v)}
                        onReset={() => clearOverride(r.month.num, "margin")}
                      />
                    </td>
                    <td className="px-1 py-0.5 text-right bg-blue-50">
                      <EditableCell
                        value={r.caAsl}
                        onChange={(v) => updateAslCA(r.month.num, v)}
                        placeholder="—"
                      />
                    </td>
                    <td className="px-1 py-0.5 text-right">
                      <OverridableCell
                        value={r.aslMargin}
                        auto={r.autoAslMargin}
                        overridden={r.overrides.aslMargin !== undefined}
                        onChange={(v) => setOverride(r.month.num, "aslMargin", v)}
                        onReset={() => clearOverride(r.month.num, "aslMargin")}
                      />
                    </td>
                    <td className="px-1 py-0.5 text-right">
                      <OverridableCell
                        value={r.bar}
                        auto={r.autoBar}
                        overridden={r.overrides.bar !== undefined}
                        onChange={(v) => setOverride(r.month.num, "bar", v)}
                        onReset={() => clearOverride(r.month.num, "bar")}
                      />
                    </td>
                    <td className="px-1 py-0.5 text-right">
                      <OverridableCell
                        value={r.asl}
                        auto={r.autoAsl}
                        overridden={r.overrides.asl !== undefined}
                        onChange={(v) => setOverride(r.month.num, "asl", v)}
                        onReset={() => clearOverride(r.month.num, "asl")}
                      />
                    </td>
                    <td className="px-1 py-0.5 text-right">
                      <OverridableCell
                        value={r.foire}
                        auto={r.autoFoire}
                        overridden={r.overrides.foire !== undefined}
                        onChange={(v) => setOverride(r.month.num, "foire", v)}
                        onReset={() => clearOverride(r.month.num, "foire")}
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
                      />
                    </td>
                    <td className="px-1 py-0.5 text-right">
                      <OverridableCell
                        value={r.businessCost}
                        auto={r.autoBusiness}
                        overridden={r.overrides.businessCost !== undefined}
                        onChange={(v) => setOverride(r.month.num, "businessCost", v)}
                        onReset={() => clearOverride(r.month.num, "businessCost")}
                      />
                    </td>
                    <td className="px-1 py-0.5 text-right">
                      <OverridableCell
                        value={r.debt}
                        auto={r.autoDebt}
                        overridden={r.overrides.debt !== undefined}
                        onChange={(v) => setOverride(r.month.num, "debt", v)}
                        onReset={() => clearOverride(r.month.num, "debt")}
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
                    <td className={`px-1.5 py-1 text-right tabular-nums font-bold whitespace-nowrap ${r.balanceReal >= 0 ? "text-emerald-800 bg-emerald-50" : "text-rose-700 bg-rose-50"}`}>
                      {chfShort(r.balanceReal)}
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
                    {chfShort(rows.length ? rows[rows.length - 1].balanceReal : 0)}
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
}: {
  value: number;
  onChange: (v: number) => void;
  placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value.toString());

  useEffect(() => {
    if (!editing) setDraft(value.toString());
  }, [value, editing]);

  if (editing) {
    return (
      <input
        type="number"
        value={draft}
        autoFocus
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          const v = parseFloat(draft);
          if (!Number.isNaN(v)) onChange(v);
          else onChange(0);
          setEditing(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") {
            setDraft(value.toString());
            setEditing(false);
          }
        }}
        className="w-16 md:w-20 text-right border border-blue-400 rounded px-1 py-0.5 text-[10px] md:text-[11px] tabular-nums bg-white"
      />
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="w-full text-right tabular-nums text-blue-900 hover:bg-blue-100 rounded px-0.5 py-0.5 font-semibold whitespace-nowrap"
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
}: {
  value: number;
  auto: number;
  overridden: boolean;
  onChange: (v: number) => void;
  onReset: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value.toString());

  useEffect(() => {
    if (!editing) setDraft(value.toString());
  }, [value, editing]);

  if (editing) {
    return (
      <input
        type="number"
        value={draft}
        autoFocus
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          const v = parseFloat(draft);
          if (!Number.isNaN(v)) {
            // Si la nouvelle valeur == auto, on clear l'override
            if (Math.abs(v - auto) < 0.001) onReset();
            else onChange(v);
          }
          setEditing(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") {
            setDraft(value.toString());
            setEditing(false);
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
        onClick={() => setEditing(true)}
        className={`text-right tabular-nums rounded px-0.5 py-0.5 whitespace-nowrap ${displayColor}`}
        title={overridden ? `Override manuel (auto = ${chfShort(auto)})` : "Clic pour override"}
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
