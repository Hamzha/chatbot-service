import { Resend } from "resend";
import { EMAIL_FROM } from "@/lib/email/resend";
import type { EscalationRecord } from "@/lib/db/escalationRepo";

let _resend: Resend | null = null;

function getResendClient(): Resend {
    if (!_resend) {
        _resend = new Resend(process.env.RESEND_API_KEY);
    }
    return _resend;
}

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function renderTranscript(entries: EscalationRecord["transcriptSnapshot"]): string {
    if (entries.length === 0) {
        return '<p style="color:#666;font-size:12px;font-style:italic;">No transcript captured.</p>';
    }
    const tail = entries.slice(-5);
    const rows = tail
        .map((e) => {
            const who = e.role === "user" ? "User" : "Bot";
            const color = e.role === "user" ? "#0f766e" : "#475569";
            return `<div style="margin:6px 0;"><strong style="color:${color};">${who}:</strong> ${escapeHtml(e.content)}</div>`;
        })
        .join("");
    return `<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:12px;font-size:13px;line-height:1.5;">${rows}</div>`;
}

export async function sendEscalationEmail(params: {
    to: string;
    record: EscalationRecord;
}): Promise<void> {
    const { to, record } = params;
    if (!process.env.RESEND_API_KEY) {
        console.warn("[escalation-email] RESEND_API_KEY not set; skipping notification.");
        return;
    }
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const ticketUrl = `${appUrl}/dashboard/inbox/${record.id}`;
    const subject = `New chatbot escalation — ${record.contact.name}`;
    const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color:#1e293b;">
            <h2 style="margin-bottom: 4px;">New escalation ticket</h2>
            <p style="color:#64748b; margin-top:0;">A visitor to your chatbot asked to speak with a human.</p>

            <h3 style="margin-bottom: 4px;">Contact</h3>
            <p style="margin:0;"><strong>Name:</strong> ${escapeHtml(record.contact.name)}</p>
            <p style="margin:0;"><strong>Email:</strong> <a href="mailto:${escapeHtml(record.contact.email)}">${escapeHtml(record.contact.email)}</a></p>

            ${record.message
            ? `<h3 style="margin-bottom: 4px;">Their message</h3><p style="white-space:pre-wrap;">${escapeHtml(record.message)}</p>`
            : ""
        }

            <h3 style="margin-bottom: 4px;">Recent transcript</h3>
            ${renderTranscript(record.transcriptSnapshot)}

            <p style="margin-top:20px;">
                <a href="${ticketUrl}" style="display:inline-block; background-color:#0f766e; color:#fff; padding:10px 20px; text-decoration:none; border-radius:6px;">
                    Open ticket in dashboard
                </a>
            </p>
            <p style="color:#94a3b8; font-size:12px;">Reason: ${escapeHtml(record.reason)} · Ticket ${record.id}</p>
        </div>
    `;

    try {
        await getResendClient().emails.send({
            from: EMAIL_FROM,
            to,
            subject,
            html,
        });
    } catch (err) {
        console.error("[escalation-email] send failed", err);
    }
}
