"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Client {
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  postal_code: string;
}

interface InvoiceItem {
  description: string;
  quantity: number;
  unit_price: number;
  tva_rate: number;
}

interface Invoice {
  id: string;
  invoice_number: string;
  status: string;
  issue_date: string;
  due_date: string;
  items: InvoiceItem[];
  subtotal: number;
  tva_rate: number;
  tva_amount: number;
  total: number;
  notes: string;
  client_id: string | null;
  sender_name: string;
  sender_email: string;
  mi_clients?: Client;
}

interface UserSettings {
  company_name: string;
  address: string;
  city: string;
  postal_code: string;
  email: string;
  phone: string;
  next_invoice_number: number;
  default_tva_rate: number;
  default_payment_terms: string;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft: { label: "Brouillon", color: "bg-zinc-100 text-zinc-600" },
  sent: { label: "Envoyée", color: "bg-blue-100 text-blue-700" },
  paid: { label: "Payée", color: "bg-emerald-100 text-emerald-700" },
  overdue: { label: "En retard", color: "bg-red-100 text-red-700" },
  cancelled: { label: "Annulée", color: "bg-zinc-100 text-zinc-400" },
};

function formatCHF(n: number) {
  return n.toLocaleString("fr-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function Facturation() {
  const supabase = createClient();
  const router = useRouter();
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [view, setView] = useState<"list" | "create" | "clients" | "settings">("list");

  // Create form state
  const [selectedClientId, setSelectedClientId] = useState("");
  const [items, setItems] = useState<InvoiceItem[]>([{ description: "", quantity: 1, unit_price: 0, tva_rate: 8.1 }]);
  const [notes, setNotes] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [issueDate, setIssueDate] = useState(new Date().toISOString().split("T")[0]);

  // Client form
  const [clientForm, setClientForm] = useState({ name: "", company: "", email: "", phone: "", address: "", city: "", postal_code: "" });

  // Settings form
  const [settingsForm, setSettingsForm] = useState<UserSettings>({
    company_name: "", address: "", city: "", postal_code: "", email: "", phone: "",
    next_invoice_number: 1, default_tva_rate: 8.1, default_payment_terms: "30 jours",
  });

  const loadData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/auth/login"); return; }
    setUser(user);

    const [invRes, cliRes, setRes] = await Promise.all([
      supabase.from("mi_invoices").select("*, mi_clients(name, company, email)").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("mi_clients").select("*").eq("user_id", user.id).order("name"),
      supabase.from("mi_user_settings").select("*").eq("user_id", user.id).single(),
    ]);

    if (invRes.data) setInvoices(invRes.data);
    if (cliRes.data) setClients(cliRes.data);
    if (setRes.data) {
      setSettings(setRes.data);
      setSettingsForm(setRes.data);
    }
    setLoading(false);
  }, [supabase, router]);

  useEffect(() => { loadData(); }, [loadData]);

  // Calculate totals
  const subtotal = items.reduce((s, i) => s + i.quantity * i.unit_price, 0);
  const tvaAmount = items.reduce((s, i) => s + (i.quantity * i.unit_price * i.tva_rate / 100), 0);
  const total = subtotal + tvaAmount;

  async function saveSettings() {
    if (!user) return;
    await supabase.from("mi_user_settings").upsert({ user_id: user.id, ...settingsForm });
    setSettings(settingsForm);
    setView("list");
    loadData();
  }

  async function addClient() {
    if (!user || !clientForm.name.trim()) return;
    await supabase.from("mi_clients").insert({ user_id: user.id, ...clientForm });
    setClientForm({ name: "", company: "", email: "", phone: "", address: "", city: "", postal_code: "" });
    loadData();
  }

  async function deleteClient(id: string) {
    await supabase.from("mi_clients").delete().eq("id", id);
    loadData();
  }

  async function createInvoice() {
    if (!user || items.length === 0) return;
    const invNumber = settings?.next_invoice_number || 1;
    const invoiceNumber = `F-${String(invNumber).padStart(4, "0")}`;

    await supabase.from("mi_invoices").insert({
      user_id: user.id,
      client_id: selectedClientId || null,
      invoice_number: invoiceNumber,
      status: "draft",
      issue_date: issueDate,
      due_date: dueDate || null,
      items,
      subtotal,
      tva_rate: items[0]?.tva_rate || 8.1,
      tva_amount: tvaAmount,
      total,
      notes,
      sender_name: settings?.company_name || "",
      sender_email: settings?.email || "",
    });

    // Increment invoice number
    await supabase.from("mi_user_settings").upsert({
      user_id: user.id,
      next_invoice_number: invNumber + 1,
    });

    setItems([{ description: "", quantity: 1, unit_price: 0, tva_rate: 8.1 }]);
    setNotes("");
    setSelectedClientId("");
    setView("list");
    loadData();
  }

  async function updateStatus(id: string, status: string) {
    await supabase.from("mi_invoices").update({ status }).eq("id", id);
    loadData();
  }

  function viewPDF(id: string) {
    window.open(`/api/invoice/pdf?id=${id}`, "_blank");
  }

  function downloadPDF(id: string, invoiceNumber: string) {
    const w = window.open(`/api/invoice/pdf?id=${id}`, "_blank");
    if (w) {
      w.onload = () => {
        w.document.title = `Facture_${invoiceNumber}`;
        setTimeout(() => w.print(), 500);
      };
    }
  }

  const [sending, setSending] = useState<string | null>(null);

  async function sendInvoice(id: string) {
    setSending(id);
    try {
      const res = await fetch("/api/invoice/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId: id }),
      });
      const data = await res.json();
      if (!res.ok) alert(data.error || "Erreur d'envoi");
      else {
        alert("Facture envoyée par email !");
        loadData();
      }
    } catch { alert("Erreur de connexion"); }
    finally { setSending(null); }
  }

  async function deleteInvoice(id: string) {
    await supabase.from("mi_invoices").delete().eq("id", id);
    loadData();
  }

  function addItem() {
    setItems([...items, { description: "", quantity: 1, unit_price: 0, tva_rate: 8.1 }]);
  }

  function updateItem(index: number, field: keyof InvoiceItem, value: string | number) {
    const updated = [...items];
    (updated[index] as unknown as Record<string, unknown>)[field] = value;
    setItems(updated);
  }

  function removeItem(index: number) {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 pb-24">
      <header className="sticky top-0 z-40 border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <Link href="/dashboard" className="flex items-center gap-2 text-zinc-500 hover:text-zinc-700">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            <span className="text-sm font-medium">Dashboard</span>
          </Link>
          <h1 className="text-lg font-bold"><span className="text-violet-600">Facturation</span></h1>
          <button onClick={() => setView("settings")} className="rounded-lg p-2 text-zinc-500 hover:bg-zinc-100">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          </button>
        </div>
      </header>

      {/* Tabs */}
      <div className="mx-auto max-w-4xl px-4 pt-3">
        <div className="flex rounded-xl bg-white p-1 shadow-sm border border-zinc-100">
          {[
            { key: "list" as const, label: `Factures (${invoices.length})` },
            { key: "create" as const, label: "+ Nouvelle" },
            { key: "clients" as const, label: `Clients (${clients.length})` },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setView(tab.key)}
              className={`flex-1 rounded-lg py-2 text-xs font-semibold transition-all ${view === tab.key ? "bg-violet-600 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-700"}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-4 pt-4">
        {/* ═══ INVOICE LIST ═══ */}
        {view === "list" && (
          <div className="space-y-3">
            {invoices.length === 0 ? (
              <div className="rounded-2xl bg-white p-8 shadow-sm text-center">
                <div className="text-4xl mb-3">📄</div>
                <p className="text-sm font-medium text-zinc-700">Aucune facture</p>
                <p className="text-xs text-zinc-400 mt-1">Créez votre première facture</p>
                <button onClick={() => setView("create")} className="mt-4 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700">
                  Créer une facture
                </button>
              </div>
            ) : (
              invoices.map((inv) => {
                const st = STATUS_LABELS[inv.status] || STATUS_LABELS.draft;
                const clientName = inv.mi_clients?.company || inv.mi_clients?.name || "—";
                return (
                  <div key={inv.id} className="rounded-xl bg-white p-4 shadow-sm border border-zinc-100">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-zinc-800">{inv.invoice_number}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${st.color}`}>{st.label}</span>
                      </div>
                      <span className="text-sm font-bold text-zinc-800">{formatCHF(inv.total)} CHF</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-zinc-500">{clientName}</p>
                        <p className="text-[10px] text-zinc-400">{inv.issue_date}</p>
                      </div>
                      <div className="flex gap-1 flex-wrap justify-end">
                        <button onClick={() => viewPDF(inv.id)} className="rounded-lg bg-violet-50 px-2 py-1 text-[10px] font-medium text-violet-600 hover:bg-violet-100">Voir</button>
                        <button onClick={() => downloadPDF(inv.id, inv.invoice_number)} className="rounded-lg bg-zinc-100 px-2 py-1 text-[10px] font-medium text-zinc-600 hover:bg-zinc-200">Télécharger</button>
                        {inv.status === "draft" && inv.client_id && (
                          <button onClick={() => sendInvoice(inv.id)} disabled={sending === inv.id} className="rounded-lg bg-blue-50 px-2 py-1 text-[10px] font-medium text-blue-600 hover:bg-blue-100 disabled:opacity-50">
                            {sending === inv.id ? "Envoi..." : "Envoyer"}
                          </button>
                        )}
                        {inv.status === "draft" && (
                          <button onClick={() => updateStatus(inv.id, "sent")} className="rounded-lg bg-blue-50 px-2 py-1 text-[10px] font-medium text-blue-600 hover:bg-blue-100">Envoyée</button>
                        )}
                        {inv.status === "sent" && (
                          <button onClick={() => updateStatus(inv.id, "paid")} className="rounded-lg bg-emerald-50 px-2 py-1 text-[10px] font-medium text-emerald-600 hover:bg-emerald-100">Payée</button>
                        )}
                        <button onClick={() => deleteInvoice(inv.id)} className="rounded-lg bg-red-50 px-2 py-1 text-[10px] font-medium text-red-500 hover:bg-red-100">Suppr.</button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* ═══ CREATE INVOICE ═══ */}
        {view === "create" && (
          <div className="space-y-4">
            {!settings?.company_name && (
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
                <p className="text-sm text-amber-800">Configurez vos coordonnées avant de créer une facture.</p>
                <button onClick={() => setView("settings")} className="mt-2 text-sm font-semibold text-amber-700 underline">Configurer</button>
              </div>
            )}

            {/* Client */}
            <div className="rounded-xl bg-white p-4 shadow-sm">
              <label className="mb-2 block text-xs font-semibold text-zinc-500">Client</label>
              <select
                value={selectedClientId}
                onChange={(e) => setSelectedClientId(e.target.value)}
                className="w-full rounded-lg border border-zinc-200 px-3 py-2.5 text-base focus:border-violet-500 focus:outline-none"
              >
                <option value="">— Sélectionner un client —</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.company || c.name} — {c.name}</option>
                ))}
              </select>
              {clients.length === 0 && (
                <button onClick={() => setView("clients")} className="mt-2 text-xs text-violet-600 underline">Ajouter un client d&apos;abord</button>
              )}
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-white p-4 shadow-sm">
                <label className="mb-2 block text-xs font-semibold text-zinc-500">Date de facture</label>
                <input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} className="w-full rounded-lg border border-zinc-200 px-3 py-2.5 text-base focus:border-violet-500 focus:outline-none" />
              </div>
              <div className="rounded-xl bg-white p-4 shadow-sm">
                <label className="mb-2 block text-xs font-semibold text-zinc-500">Échéance</label>
                <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-full rounded-lg border border-zinc-200 px-3 py-2.5 text-base focus:border-violet-500 focus:outline-none" />
              </div>
            </div>

            {/* Items */}
            <div className="rounded-xl bg-white p-4 shadow-sm">
              <label className="mb-3 block text-xs font-semibold text-zinc-500">Prestations / Articles</label>
              <div className="space-y-3">
                {items.map((item, i) => (
                  <div key={i} className="rounded-lg border border-zinc-100 p-3 space-y-2">
                    <input
                      type="text"
                      value={item.description}
                      onChange={(e) => updateItem(i, "description", e.target.value)}
                      placeholder="Description"
                      className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-base focus:border-violet-500 focus:outline-none"
                    />
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-[10px] text-zinc-400 mb-1">Quantité</label>
                        <input type="number" min="1" value={item.quantity} onChange={(e) => updateItem(i, "quantity", parseInt(e.target.value) || 1)} className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none" />
                      </div>
                      <div>
                        <label className="block text-[10px] text-zinc-400 mb-1">Prix unitaire CHF</label>
                        <input type="number" min="0" step="0.05" value={item.unit_price || ""} onChange={(e) => updateItem(i, "unit_price", parseFloat(e.target.value) || 0)} className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none" />
                      </div>
                      <div>
                        <label className="block text-[10px] text-zinc-400 mb-1">TVA</label>
                        <select value={item.tva_rate} onChange={(e) => updateItem(i, "tva_rate", parseFloat(e.target.value))} className="w-full rounded-lg border border-zinc-200 px-2 py-2 text-sm focus:border-violet-500 focus:outline-none">
                          <option value={8.1}>8.1%</option>
                          <option value={2.5}>2.5%</option>
                          <option value={0}>0%</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-zinc-400">Ligne : {formatCHF(item.quantity * item.unit_price)} CHF</span>
                      {items.length > 1 && (
                        <button onClick={() => removeItem(i)} className="text-xs text-red-400 hover:text-red-600">Supprimer</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <button onClick={addItem} className="mt-3 w-full rounded-lg border-2 border-dashed border-zinc-200 py-2 text-xs font-medium text-zinc-500 hover:border-violet-300 hover:text-violet-600">
                + Ajouter une ligne
              </button>
            </div>

            {/* Totals */}
            <div className="rounded-xl bg-white p-4 shadow-sm space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">Sous-total HT</span>
                <span className="font-semibold">{formatCHF(subtotal)} CHF</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">TVA</span>
                <span className="font-semibold">{formatCHF(tvaAmount)} CHF</span>
              </div>
              <div className="flex justify-between text-base font-bold border-t border-zinc-100 pt-2">
                <span>Total TTC</span>
                <span className="text-violet-600">{formatCHF(total)} CHF</span>
              </div>
            </div>

            {/* Notes */}
            <div className="rounded-xl bg-white p-4 shadow-sm">
              <label className="mb-2 block text-xs font-semibold text-zinc-500">Notes (optionnel)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Conditions de paiement, informations bancaires..."
                rows={3}
                className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm focus:border-violet-500 focus:outline-none"
              />
            </div>

            <button
              onClick={createInvoice}
              disabled={items.every((i) => !i.description || i.unit_price === 0)}
              className="w-full rounded-lg bg-violet-600 py-3 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
            >
              Créer la facture
            </button>
          </div>
        )}

        {/* ═══ CLIENTS ═══ */}
        {view === "clients" && (
          <div className="space-y-4">
            {/* Client list */}
            {clients.length > 0 && (
              <div className="space-y-2">
                {clients.map((c) => (
                  <div key={c.id} className="flex items-center justify-between rounded-xl bg-white p-4 shadow-sm">
                    <div>
                      <p className="text-sm font-semibold text-zinc-800">{c.company || c.name}</p>
                      <p className="text-xs text-zinc-500">{c.name}{c.email ? ` — ${c.email}` : ""}</p>
                    </div>
                    <button onClick={() => deleteClient(c.id)} className="text-xs text-red-400 hover:text-red-600">Supprimer</button>
                  </div>
                ))}
              </div>
            )}

            {/* Add client form */}
            <div className="rounded-xl bg-white p-4 shadow-sm space-y-3">
              <h3 className="text-sm font-semibold text-zinc-700">Ajouter un client</h3>
              <div className="grid grid-cols-2 gap-3">
                <input type="text" value={clientForm.name} onChange={(e) => setClientForm({ ...clientForm, name: e.target.value })} placeholder="Nom *" className="rounded-lg border border-zinc-200 px-3 py-2.5 text-base focus:border-violet-500 focus:outline-none" />
                <input type="text" value={clientForm.company} onChange={(e) => setClientForm({ ...clientForm, company: e.target.value })} placeholder="Entreprise" className="rounded-lg border border-zinc-200 px-3 py-2.5 text-base focus:border-violet-500 focus:outline-none" />
                <input type="email" value={clientForm.email} onChange={(e) => setClientForm({ ...clientForm, email: e.target.value })} placeholder="Email" className="rounded-lg border border-zinc-200 px-3 py-2.5 text-base focus:border-violet-500 focus:outline-none" />
                <input type="tel" value={clientForm.phone} onChange={(e) => setClientForm({ ...clientForm, phone: e.target.value })} placeholder="Téléphone" className="rounded-lg border border-zinc-200 px-3 py-2.5 text-base focus:border-violet-500 focus:outline-none" />
                <input type="text" value={clientForm.address} onChange={(e) => setClientForm({ ...clientForm, address: e.target.value })} placeholder="Adresse" className="col-span-2 rounded-lg border border-zinc-200 px-3 py-2.5 text-base focus:border-violet-500 focus:outline-none" />
                <input type="text" value={clientForm.city} onChange={(e) => setClientForm({ ...clientForm, city: e.target.value })} placeholder="Ville" className="rounded-lg border border-zinc-200 px-3 py-2.5 text-base focus:border-violet-500 focus:outline-none" />
                <input type="text" value={clientForm.postal_code} onChange={(e) => setClientForm({ ...clientForm, postal_code: e.target.value })} placeholder="NPA" className="rounded-lg border border-zinc-200 px-3 py-2.5 text-base focus:border-violet-500 focus:outline-none" />
              </div>
              <button onClick={addClient} disabled={!clientForm.name.trim()} className="w-full rounded-lg bg-violet-600 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50">
                Ajouter le client
              </button>
            </div>
          </div>
        )}

        {/* ═══ SETTINGS ═══ */}
        {view === "settings" && (
          <div className="rounded-xl bg-white p-4 shadow-sm space-y-4">
            <h3 className="text-sm font-semibold text-zinc-700">Vos coordonnées (apparaissent sur les factures)</h3>
            <div className="grid grid-cols-2 gap-3">
              <input type="text" value={settingsForm.company_name} onChange={(e) => setSettingsForm({ ...settingsForm, company_name: e.target.value })} placeholder="Nom / Raison sociale *" className="col-span-2 rounded-lg border border-zinc-200 px-3 py-2.5 text-base focus:border-violet-500 focus:outline-none" />
              <input type="text" value={settingsForm.address} onChange={(e) => setSettingsForm({ ...settingsForm, address: e.target.value })} placeholder="Adresse" className="col-span-2 rounded-lg border border-zinc-200 px-3 py-2.5 text-base focus:border-violet-500 focus:outline-none" />
              <input type="text" value={settingsForm.city} onChange={(e) => setSettingsForm({ ...settingsForm, city: e.target.value })} placeholder="Ville" className="rounded-lg border border-zinc-200 px-3 py-2.5 text-base focus:border-violet-500 focus:outline-none" />
              <input type="text" value={settingsForm.postal_code} onChange={(e) => setSettingsForm({ ...settingsForm, postal_code: e.target.value })} placeholder="NPA" className="rounded-lg border border-zinc-200 px-3 py-2.5 text-base focus:border-violet-500 focus:outline-none" />
              <input type="email" value={settingsForm.email} onChange={(e) => setSettingsForm({ ...settingsForm, email: e.target.value })} placeholder="Email" className="rounded-lg border border-zinc-200 px-3 py-2.5 text-base focus:border-violet-500 focus:outline-none" />
              <input type="tel" value={settingsForm.phone} onChange={(e) => setSettingsForm({ ...settingsForm, phone: e.target.value })} placeholder="Téléphone" className="rounded-lg border border-zinc-200 px-3 py-2.5 text-base focus:border-violet-500 focus:outline-none" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] text-zinc-400 mb-1">TVA par défaut</label>
                <select value={settingsForm.default_tva_rate} onChange={(e) => setSettingsForm({ ...settingsForm, default_tva_rate: parseFloat(e.target.value) })} className="w-full rounded-lg border border-zinc-200 px-3 py-2.5 text-base focus:border-violet-500 focus:outline-none">
                  <option value={8.1}>8.1%</option>
                  <option value={2.5}>2.5%</option>
                  <option value={0}>0%</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-zinc-400 mb-1">Conditions de paiement</label>
                <input type="text" value={settingsForm.default_payment_terms} onChange={(e) => setSettingsForm({ ...settingsForm, default_payment_terms: e.target.value })} className="w-full rounded-lg border border-zinc-200 px-3 py-2.5 text-base focus:border-violet-500 focus:outline-none" />
              </div>
            </div>
            <button onClick={saveSettings} className="w-full rounded-lg bg-violet-600 py-2.5 text-sm font-semibold text-white hover:bg-violet-700">
              Enregistrer
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
