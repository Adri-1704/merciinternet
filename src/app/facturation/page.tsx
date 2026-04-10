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
  iban: string;
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
  const [docType, setDocType] = useState<"invoice" | "quote">("invoice");

  // Client form
  const [clientForm, setClientForm] = useState({ name: "", company: "", email: "", phone: "", address: "", city: "", postal_code: "" });

  // Settings form
  const [settingsForm, setSettingsForm] = useState<UserSettings>({
    company_name: "", address: "", city: "", postal_code: "", email: "", phone: "",
    next_invoice_number: 1, default_tva_rate: 8.1, default_payment_terms: "30 jours", iban: "",
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

    let docNumber: string;
    if (docType === "quote") {
      const quoteCount = invoices.filter((i) => i.invoice_number.startsWith("D-")).length;
      docNumber = `D-${String(quoteCount + 1).padStart(4, "0")}`;
    } else {
      const invNumber = settings?.next_invoice_number || 1;
      docNumber = `F-${String(invNumber).padStart(4, "0")}`;
    }

    await supabase.from("mi_invoices").insert({
      user_id: user.id,
      client_id: selectedClientId || null,
      invoice_number: docNumber,
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

    // Increment invoice number only for invoices
    if (docType === "invoice") {
      const invNumber = settings?.next_invoice_number || 1;
      await supabase.from("mi_user_settings").upsert({
        user_id: user.id,
        next_invoice_number: invNumber + 1,
      });
    }

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

  async function downloadPDF(id: string, invoiceNumber: string) {
    const { jsPDF } = await import("jspdf");
    const inv = invoices.find((i) => i.id === id);
    if (!inv) return;

    const client = inv.mi_clients;
    const items = (inv.items || []) as InvoiceItem[];
    const doc = new jsPDF();
    const w = doc.internal.pageSize.getWidth();
    let y = 20;

    // Header
    doc.setFontSize(20);
    doc.setTextColor(124, 58, 237);
    doc.text(settings?.company_name || "Merciinternet", 14, y);
    doc.setFontSize(22);
    doc.setTextColor(26, 26, 46);
    doc.text(inv.invoice_number, w - 14, y, { align: "right" });
    y += 10;

    // Sender info
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 100);
    if (settings?.address) { doc.text(settings.address, 14, y); y += 4; }
    if (settings?.postal_code || settings?.city) { doc.text(`${settings?.postal_code || ""} ${settings?.city || ""}`, 14, y); y += 4; }
    if (settings?.email) { doc.text(settings.email, 14, y); y += 4; }
    if (settings?.phone) { doc.text(settings.phone, 14, y); y += 4; }

    // Invoice info right side
    let yr = 30;
    doc.text(`Date : ${inv.issue_date}`, w - 14, yr, { align: "right" }); yr += 4;
    if (inv.due_date) { doc.text(`Échéance : ${inv.due_date}`, w - 14, yr, { align: "right" }); yr += 4; }
    y = Math.max(y, yr) + 10;

    // Client box
    if (client) {
      doc.setFillColor(248, 248, 252);
      doc.roundedRect(14, y, w - 28, 24, 2, 2, "F");
      doc.setFontSize(8);
      doc.setTextColor(150, 150, 150);
      doc.text("FACTURÉ À", 18, y + 5);
      doc.setFontSize(11);
      doc.setTextColor(26, 26, 46);
      doc.text(client.company || client.name || "", 18, y + 11);
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      const clientLine2 = [client.name !== client.company ? client.name : "", client.email].filter(Boolean).join(" — ");
      if (clientLine2) doc.text(clientLine2, 18, y + 17);
      y += 30;
    }

    // Table header
    y += 5;
    doc.setFillColor(124, 58, 237);
    doc.rect(14, y, w - 28, 8, "F");
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text("Description", 18, y + 5.5);
    doc.text("Qté", 110, y + 5.5);
    doc.text("Prix unit.", 125, y + 5.5);
    doc.text("TVA", 155, y + 5.5);
    doc.text("Total", w - 18, y + 5.5, { align: "right" });
    y += 10;

    // Table rows
    doc.setTextColor(50, 50, 50);
    doc.setFontSize(9);
    for (const item of items) {
      const lineTotal = item.quantity * item.unit_price;
      doc.text(item.description || "", 18, y + 4);
      doc.text(String(item.quantity), 113, y + 4);
      doc.text(`${formatCHF(item.unit_price)}`, 125, y + 4);
      doc.text(`${item.tva_rate}%`, 155, y + 4);
      doc.text(`${formatCHF(lineTotal)}`, w - 18, y + 4, { align: "right" });
      doc.setDrawColor(230, 230, 230);
      doc.line(14, y + 7, w - 14, y + 7);
      y += 9;
    }

    // Totals
    y += 5;
    const totX = 130;
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text("Sous-total HT", totX, y);
    doc.text(`${formatCHF(inv.subtotal)} CHF`, w - 18, y, { align: "right" });
    y += 6;
    doc.text("TVA", totX, y);
    doc.text(`${formatCHF(inv.tva_amount)} CHF`, w - 18, y, { align: "right" });
    y += 8;
    doc.setDrawColor(124, 58, 237);
    doc.setLineWidth(0.5);
    doc.line(totX, y - 2, w - 14, y - 2);
    doc.setFontSize(13);
    doc.setTextColor(124, 58, 237);
    doc.text("Total TTC", totX, y + 4);
    doc.text(`${formatCHF(inv.total)} CHF`, w - 18, y + 4, { align: "right" });

    // Notes
    if (inv.notes) {
      y += 20;
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.text(`Notes : ${inv.notes}`, 14, y, { maxWidth: w - 28 });
    }

    // QR-Bill payment section (if IBAN is configured)
    const iban = settings?.iban?.replace(/\s/g, "") || "";
    if (iban && iban.startsWith("CH")) {
      const QRCode = (await import("qrcode")).default;

      // Build Swiss QR code payload (SPC format)
      const senderName = settings?.company_name || "";
      const senderAddress = settings?.address || "";
      const senderPostal = settings?.postal_code || "";
      const senderCity = settings?.city || "";
      const clientName = client?.company || client?.name || "";
      const clientAddress = client?.address || "";
      const clientPostal = client?.postal_code || "";
      const clientCity = client?.city || "";

      const qrPayload = [
        "SPC",           // QR Type
        "0200",          // Version
        "1",             // Coding Type (UTF-8)
        iban,            // IBAN
        "S",             // Address type (Structured)
        senderName,      // Creditor Name
        senderAddress,   // Street
        "",              // Building number
        senderPostal,    // Postal code
        senderCity,      // City
        "CH",            // Country
        "",              // Ultimate Creditor (7 empty fields)
        "", "", "", "", "", "",
        inv.total.toFixed(2), // Amount
        "CHF",           // Currency
        "S",             // Debtor address type
        clientName,
        clientAddress,
        "",
        clientPostal,
        clientCity,
        "CH",
        "NON",           // Reference type (NON = no reference)
        "",              // Reference
        `Facture ${inv.invoice_number}`, // Additional info
        "EPD",           // Trailer
      ].join("\n");

      try {
        const qrDataUrl = await QRCode.toDataURL(qrPayload, { width: 170, margin: 0, errorCorrectionLevel: "M" });

        // Add new page for QR-Bill section
        doc.addPage();

        // Dashed separation line
        doc.setDrawColor(0);
        doc.setLineDashPattern([2, 2], 0);
        doc.line(0, 10, w, 10);
        doc.setLineDashPattern([], 0);

        // Receipt (left side)
        doc.setFontSize(11);
        doc.setTextColor(0);
        doc.text("Récépissé", 5, 18);

        doc.setFontSize(6);
        doc.setTextColor(0);
        doc.text("Compte / Payable à", 5, 25);
        doc.setFontSize(8);
        doc.text(iban.replace(/(.{4})/g, "$1 ").trim(), 5, 29);
        doc.text(senderName, 5, 33);
        if (senderPostal || senderCity) doc.text(`${senderPostal} ${senderCity}`, 5, 37);

        doc.setFontSize(6);
        doc.text("Payable par", 5, 48);
        doc.setFontSize(8);
        doc.text(clientName, 5, 52);
        if (clientPostal || clientCity) doc.text(`${clientPostal} ${clientCity}`, 5, 56);

        doc.setFontSize(6);
        doc.text("Monnaie", 5, 68);
        doc.text("Montant", 25, 68);
        doc.setFontSize(8);
        doc.text("CHF", 5, 72);
        doc.text(formatCHF(inv.total), 25, 72);

        doc.setFontSize(6);
        doc.text("Point de dépôt", 5, 82);

        // Payment part (right side)
        const px = 62;
        doc.setFontSize(11);
        doc.text("Section paiement", px, 18);

        // QR Code
        doc.addImage(qrDataUrl, "PNG", px, 22, 46, 46);

        // Swiss cross in center of QR
        const cx = px + 23 - 3.5;
        const cy = 22 + 23 - 3.5;
        doc.setFillColor(0, 0, 0);
        doc.rect(cx, cy, 7, 7, "F");
        doc.setFillColor(255, 255, 255);
        doc.rect(cx + 1.5, cy + 2.5, 4, 2, "F");
        doc.rect(cx + 2.5, cy + 1.5, 2, 4, "F");

        // Payment info right of QR
        const infoX = px + 52;
        doc.setFontSize(6);
        doc.setTextColor(0);
        doc.text("Monnaie", infoX, 25);
        doc.text("Montant", infoX + 20, 25);
        doc.setFontSize(8);
        doc.text("CHF", infoX, 29);
        doc.text(formatCHF(inv.total), infoX + 20, 29);

        doc.setFontSize(6);
        doc.text("Compte / Payable à", px, 73);
        doc.setFontSize(8);
        doc.text(iban.replace(/(.{4})/g, "$1 ").trim(), px, 77);
        doc.text(senderName, px, 81);
        if (senderPostal || senderCity) doc.text(`${senderPostal} ${senderCity}`, px, 85);

        doc.setFontSize(6);
        doc.text("Informations supplémentaires", px, 93);
        doc.setFontSize(8);
        doc.text(`Facture ${inv.invoice_number}`, px, 97);

        doc.setFontSize(6);
        doc.text("Payable par", px, 105);
        doc.setFontSize(8);
        doc.text(clientName, px, 109);
        if (clientPostal || clientCity) doc.text(`${clientPostal} ${clientCity}`, px, 113);

      } catch (e) {
        console.error("QR generation failed:", e);
      }
    }

    // Footer on last page
    doc.setFontSize(8);
    doc.setTextColor(180, 180, 180);
    doc.text(`Généré par Merciinternet.ch — ${new Date().toLocaleDateString("fr-CH")}`, w / 2, 285, { align: "center" });

    doc.save(`Facture_${invoiceNumber}.pdf`);
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

  async function convertToInvoice(id: string) {
    if (!user) return;
    const invNumber = settings?.next_invoice_number || 1;
    const invoiceNumber = `F-${String(invNumber).padStart(4, "0")}`;
    await supabase.from("mi_invoices").update({ invoice_number: invoiceNumber }).eq("id", id);
    await supabase.from("mi_user_settings").upsert({ user_id: user.id, next_invoice_number: invNumber + 1 });
    loadData();
  }

  async function deleteInvoice(id: string) {
    await supabase.from("mi_invoices").delete().eq("id", id);
    loadData();
  }

  async function duplicateInvoice(id: string) {
    if (!user) return;
    const inv = invoices.find((i) => i.id === id);
    if (!inv) return;
    const invNumber = settings?.next_invoice_number || (invoices.length + 1);
    const invoiceNumber = `F-${String(invNumber).padStart(4, "0")}`;

    await supabase.from("mi_invoices").insert({
      user_id: user.id,
      client_id: inv.client_id,
      invoice_number: invoiceNumber,
      status: "draft",
      issue_date: new Date().toISOString().split("T")[0],
      due_date: inv.due_date,
      items: inv.items,
      subtotal: inv.subtotal,
      tva_rate: inv.tva_rate,
      tva_amount: inv.tva_amount,
      total: inv.total,
      notes: inv.notes,
      sender_name: inv.sender_name,
      sender_email: inv.sender_email,
    });

    await supabase.from("mi_user_settings").upsert({
      user_id: user.id,
      next_invoice_number: invNumber + 1,
    });

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
            { key: "list" as const, label: `Documents (${invoices.length})` },
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
                      <div className="flex items-center gap-2">
                        {inv.invoice_number.startsWith("D-") && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">Devis</span>
                        )}
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
                            {sending === inv.id ? "Envoi..." : "📧 Envoyer"}
                          </button>
                        )}
                        {inv.status === "sent" && (
                          <button onClick={() => updateStatus(inv.id, "paid")} className="rounded-lg bg-emerald-50 px-2 py-1 text-[10px] font-medium text-emerald-600 hover:bg-emerald-100">Payée</button>
                        )}
                        {inv.invoice_number.startsWith("D-") && (
                          <button onClick={() => convertToInvoice(inv.id)} className="rounded-lg bg-amber-50 px-2 py-1 text-[10px] font-medium text-amber-700 hover:bg-amber-100">→ Facture</button>
                        )}
                        <button onClick={() => duplicateInvoice(inv.id)} className="rounded-lg bg-zinc-50 px-2 py-1 text-[10px] font-medium text-zinc-600 hover:bg-zinc-100">Dupliquer</button>
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

            {/* Type: Facture / Devis */}
            <div className="flex rounded-xl bg-white p-1 shadow-sm border border-zinc-100">
              <button
                onClick={() => setDocType("invoice")}
                className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition-all ${docType === "invoice" ? "bg-violet-600 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-700"}`}
              >
                Facture
              </button>
              <button
                onClick={() => setDocType("quote")}
                className={`flex-1 rounded-lg py-2.5 text-sm font-semibold transition-all ${docType === "quote" ? "bg-amber-500 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-700"}`}
              >
                Devis
              </button>
            </div>

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
              {docType === "quote" ? "Créer le devis" : "Créer la facture"}
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
            <div>
              <label className="block text-[10px] text-zinc-400 mb-1">IBAN (pour QR-facture suisse)</label>
              <input type="text" value={settingsForm.iban || ""} onChange={(e) => setSettingsForm({ ...settingsForm, iban: e.target.value.toUpperCase() })} placeholder="CH00 0000 0000 0000 0000 0" className="w-full rounded-lg border border-zinc-200 px-3 py-2.5 text-base font-mono focus:border-violet-500 focus:outline-none" />
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
