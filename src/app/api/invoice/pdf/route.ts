import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function formatCHF(n: number) {
  return n.toLocaleString("fr-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const invoiceId = searchParams.get("id");
  if (!invoiceId) return new Response("Missing id", { status: 400 });

  // Load invoice + client + settings
  const { data: invoice } = await supabase
    .from("mi_invoices")
    .select("*, mi_clients(*)")
    .eq("id", invoiceId)
    .single();

  if (!invoice) return new Response("Invoice not found", { status: 404 });

  const { data: settings } = await supabase
    .from("mi_user_settings")
    .select("*")
    .eq("user_id", invoice.user_id)
    .single();

  const client = invoice.mi_clients;
  const items = (invoice.items || []) as Array<{ description: string; quantity: number; unit_price: number; tva_rate: number }>;

  // Generate HTML invoice
  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Facture ${invoice.invoice_number}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, sans-serif; color: #1a1a2e; padding: 40px; max-width: 800px; margin: 0 auto; font-size: 13px; }
    .header { display: flex; justify-content: space-between; margin-bottom: 40px; }
    .sender { max-width: 300px; }
    .sender h1 { font-size: 20px; color: #7C3AED; margin-bottom: 8px; }
    .sender p { color: #666; font-size: 12px; line-height: 1.6; }
    .invoice-info { text-align: right; }
    .invoice-info h2 { font-size: 28px; font-weight: 800; color: #1a1a2e; margin-bottom: 8px; }
    .invoice-info p { font-size: 12px; color: #666; line-height: 1.6; }
    .client-box { background: #f8f8fc; border-radius: 8px; padding: 20px; margin-bottom: 30px; }
    .client-box h3 { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #999; margin-bottom: 8px; }
    .client-box p { font-size: 13px; line-height: 1.6; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    th { background: #7C3AED; color: white; text-align: left; padding: 10px 12px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
    th:last-child, td:last-child { text-align: right; }
    td { padding: 10px 12px; border-bottom: 1px solid #eee; font-size: 13px; }
    tr:last-child td { border-bottom: none; }
    .totals { margin-left: auto; width: 280px; }
    .totals table { margin-bottom: 0; }
    .totals td { padding: 6px 12px; border: none; font-size: 13px; }
    .totals tr:last-child td { font-size: 16px; font-weight: 700; color: #7C3AED; border-top: 2px solid #7C3AED; padding-top: 10px; }
    .notes { margin-top: 30px; padding: 16px; background: #fafafa; border-radius: 8px; font-size: 12px; color: #666; line-height: 1.6; }
    .footer { margin-top: 40px; text-align: center; font-size: 10px; color: #bbb; }
    @media print { body { padding: 20px; } }
  </style>
</head>
<body>
  <div class="header">
    <div class="sender">
      <h1>${settings?.company_name || invoice.sender_name || "Merciinternet"}</h1>
      ${settings?.address ? `<p>${settings.address}</p>` : ""}
      ${settings?.postal_code || settings?.city ? `<p>${settings?.postal_code || ""} ${settings?.city || ""}</p>` : ""}
      ${settings?.email ? `<p>${settings.email}</p>` : ""}
      ${settings?.phone ? `<p>${settings.phone}</p>` : ""}
    </div>
    <div class="invoice-info">
      <h2>${invoice.invoice_number}</h2>
      <p><strong>Date :</strong> ${invoice.issue_date}</p>
      ${invoice.due_date ? `<p><strong>Échéance :</strong> ${invoice.due_date}</p>` : ""}
      <p><strong>Statut :</strong> ${invoice.status === "paid" ? "Payée" : invoice.status === "sent" ? "Envoyée" : "Brouillon"}</p>
    </div>
  </div>

  ${client ? `
  <div class="client-box">
    <h3>Facturé à</h3>
    <p><strong>${client.company || client.name}</strong></p>
    ${client.company && client.name ? `<p>${client.name}</p>` : ""}
    ${client.address ? `<p>${client.address}</p>` : ""}
    ${client.postal_code || client.city ? `<p>${client.postal_code || ""} ${client.city || ""}</p>` : ""}
    ${client.email ? `<p>${client.email}</p>` : ""}
  </div>
  ` : ""}

  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th>Qté</th>
        <th>Prix unit.</th>
        <th>TVA</th>
        <th>Total</th>
      </tr>
    </thead>
    <tbody>
      ${items.map((item) => {
        const lineTotal = item.quantity * item.unit_price;
        return `<tr>
          <td>${item.description}</td>
          <td>${item.quantity}</td>
          <td>${formatCHF(item.unit_price)} CHF</td>
          <td>${item.tva_rate}%</td>
          <td>${formatCHF(lineTotal)} CHF</td>
        </tr>`;
      }).join("")}
    </tbody>
  </table>

  <div class="totals">
    <table>
      <tr>
        <td>Sous-total HT</td>
        <td>${formatCHF(invoice.subtotal)} CHF</td>
      </tr>
      <tr>
        <td>TVA</td>
        <td>${formatCHF(invoice.tva_amount)} CHF</td>
      </tr>
      <tr>
        <td>Total TTC</td>
        <td>${formatCHF(invoice.total)} CHF</td>
      </tr>
    </table>
  </div>

  ${invoice.notes ? `<div class="notes"><strong>Notes :</strong><br>${invoice.notes}</div>` : ""}

  ${settings?.default_payment_terms ? `<div class="notes"><strong>Conditions de paiement :</strong> ${settings.default_payment_terms}</div>` : ""}

  <div class="footer">
    Généré par Merciinternet.ch — ${new Date().toLocaleDateString("fr-CH")}
  </div>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
    },
  });
}
