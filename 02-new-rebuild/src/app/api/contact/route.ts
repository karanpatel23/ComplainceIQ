import { NextRequest, NextResponse } from "next/server";
import { contactSchema } from "@/lib/contact-schema";
import { sendLeadNotification } from "@/lib/email";
import { checkRateLimit } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || request.headers.get("x-real-ip") || "anonymous";
  const rateLimit = checkRateLimit(ip);

  if (!rateLimit.allowed) {
    return NextResponse.json({ ok: false, message: "Too many inquiries from this network. Please wait and try again." }, { status: 429 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid request body." }, { status: 400 });
  }

  const parsed = contactSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, message: "Please correct the highlighted fields.", errors: parsed.error.flatten().fieldErrors }, { status: 422 });
  }

  try {
    await sendLeadNotification(parsed.data);

    // Database persistence is intentionally optional in this foundation.
    // When SAVE_LEADS_TO_DATABASE=true, wire Prisma Client to prisma/schema.prisma and save parsed.data here.

    return NextResponse.json({ ok: true, message: "Thank you. Your inquiry has been received and our team will review it shortly." });
  } catch (error) {
    console.error("Contact inquiry failed", error);
    return NextResponse.json({ ok: false, message: "We could not submit your inquiry right now. Please email sales@royalengitech.com directly or try again later." }, { status: 500 });
  }
}
