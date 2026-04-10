import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || "465"),
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

function formatCHF(n: number) {
  return n.toLocaleString("fr-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export async function POST(request: Request) {
  try {
    const { invoiceId } = await request.json();
    if (!invoiceId) return Response.json({ error: "Missing invoiceId" }, { status: 400 });

    const { data: invoice } = await supabase
      .from("mi_invoices")
      .select("*, mi_clients(*)")
      .eq("id", invoiceId)
      .single();

    if (!invoice) return Response.json({ error: "Invoice not found" }, { status: 404 });

    const client = invoice.mi_clients;
    if (!client?.email) return Response.json({ error: "Le client n'a pas d'email" }, { status: 400 });

    const { data: settings } = await supabase
      .from("mi_user_settings")
      .select("*")
      .eq("user_id", invoice.user_id)
      .single();

    const senderName = settings?.company_name || invoice.sender_name || "Merciinternet";
    const items = (invoice.items || []) as Array<{ description: string; quantity: number; unit_price: number; tva_rate: number }>;

    const itemsHtml = items.map((item) => {
      const lineTotal = item.quantity * item.unit_price;
      return `<tr>
        <td style="padding:8px 12px;border-bottom:1px solid #eee">${item.description}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right">${item.quantity}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right">${formatCHF(item.unit_price)} CHF</td>
        <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right">${formatCHF(lineTotal)} CHF</td>
      </tr>`;
    }).join("");

    const emailHtml = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:600px;margin:0 auto;color:#333">
      <div style="background:#7C3AED;color:white;padding:24px;border-radius:12px 12px 0 0">
        <h1 style="margin:0;font-size:18px">${senderName}</h1>
        <p style="margin:8px 0 0;opacity:0.8;font-size:14px">Facture ${invoice.invoice_number}</p>
      </div>
      <div style="padding:24px;border:1px solid #eee;border-top:none;border-radius:0 0 12px 12px">
        <p>Bonjour ${client.name},</p>
        <p style="margin:16px 0">Veuillez trouver ci-dessous le détail de la facture <strong>${invoice.invoice_number}</strong> d'un montant de <strong>${formatCHF(invoice.total)} CHF</strong>.</p>

        <table style="width:100%;border-collapse:collapse;margin:24px 0">
          <thead>
            <tr style="background:#f4f4f5">
              <th style="padding:8px 12px;text-align:left;font-size:11px;text-transform:uppercase">Description</th>
              <th style="padding:8px 12px;text-align:right;font-size:11px;text-transform:uppercase">Qté</th>
              <th style="padding:8px 12px;text-align:right;font-size:11px;text-transform:uppercase">Prix unit.</th>
              <th style="padding:8px 12px;text-align:right;font-size:11px;text-transform:uppercase">Total</th>
            </tr>
          </thead>
          <tbody>${itemsHtml}</tbody>
        </table>

        <div style="text-align:right;margin:16px 0">
          <p style="font-size:13px;color:#666">Sous-total HT : ${formatCHF(invoice.subtotal)} CHF</p>
          <p style="font-size:13px;color:#666">TVA : ${formatCHF(invoice.tva_amount)} CHF</p>
          <p style="font-size:18px;font-weight:700;color:#7C3AED;margin-top:8px">Total : ${formatCHF(invoice.total)} CHF</p>
        </div>

        ${invoice.due_date ? `<p style="margin:16px 0;font-size:13px;color:#666"><strong>Échéance :</strong> ${invoice.due_date}</p>` : ""}
        ${invoice.notes ? `<p style="margin:16px 0;font-size:13px;color:#666;background:#fafafa;padding:12px;border-radius:8px">${invoice.notes}</p>` : ""}
        ${settings?.default_payment_terms ? `<p style="font-size:12px;color:#999">Conditions : ${settings.default_payment_terms}</p>` : ""}

        <p style="margin:24px 0 0;font-size:13px;color:#666">
          Pour consulter ou imprimer cette facture, cliquez sur le lien ci-dessous :
        </p>
        <a href="${process.env.NEXT_PUBLIC_SITE_URL || "https://merciinternet.ch"}/api/invoice/pdf?id=${invoice.id}" style="display:inline-block;margin:12px 0;padding:10px 24px;background:#7C3AED;color:white;text-decoration:none;border-radius:8px;font-size:13px;font-weight:600">
          Voir la facture
        </a>

        <p style="margin:24px 0 0;font-size:12px;color:#bbb">
          Envoyé depuis Merciinternet.ch
        </p>
      </div>
    </div>`;

    await transporter.sendMail({
      from: `"${senderName}" <factures@merciinternet.ch>`,
      to: client.email,
      subject: `Facture ${invoice.invoice_number} — ${formatCHF(invoice.total)} CHF`,
      html: emailHtml,
    });

    // Update status to sent
    await supabase.from("mi_invoices").update({ status: "sent" }).eq("id", invoice.id);

    return Response.json({ ok: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return Response.json({ error: msg }, { status: 500 });
  }
}
