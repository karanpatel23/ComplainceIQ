import nodemailer from "nodemailer";
import type { ContactFormInput } from "./contact-schema";

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char] ?? char));
}

export async function sendLeadNotification(lead: ContactFormInput) {
  const required = ["SMTP_HOST", "SMTP_USER", "SMTP_PASSWORD", "CONTACT_TO_EMAIL", "CONTACT_FROM_EMAIL"] as const;
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.warn(`Contact email skipped. Missing environment variables: ${missing.join(", ")}`);
    return { configured: false };
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
  });

  const rows = [
    ["Name", lead.name],
    ["Company", lead.companyName],
    ["Email", lead.email],
    ["Phone", lead.phone],
    ["Country", lead.country],
    ["Interest", lead.interest],
    ["Message", lead.message],
  ];

  await transporter.sendMail({
    to: process.env.CONTACT_TO_EMAIL,
    from: process.env.CONTACT_FROM_EMAIL,
    replyTo: lead.email,
    subject: `Royal Engitech product inquiry from ${lead.companyName}`,
    text: rows.map(([label, value]) => `${label}: ${value}`).join("\n"),
    html: `<h2>New Royal Engitech business inquiry</h2><table>${rows
      .map(([label, value]) => `<tr><td><strong>${escapeHtml(label)}</strong></td><td>${escapeHtml(value).replace(/\n/g, "<br />")}</td></tr>`)
      .join("")}</table>`,
  });

  return { configured: true };
}
