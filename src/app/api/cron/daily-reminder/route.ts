import { NextResponse, type NextRequest } from "next/server";
import { todayIn } from "@/lib/dates";
import { hourIn } from "@/lib/reminder";
import { sendReminder } from "@/lib/reminder-send";
import { sendClientMessages } from "@/lib/client-messages-send";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Runs every hour (vercel.json). Sends each organization's daily reminder
 * once a day, at the hour set in its settings, in its own timezone.
 * Vercel calls it with "Authorization: Bearer <CRON_SECRET>".
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Not allowed" }, { status: 401 });
  }

  const db = createAdminClient();
  const { data: orgs } = await db
    .from("organizations")
    .select("id, name, timezone, reminder_hour, last_reminder_on")
    .eq("reminder_enabled", true);

  const report: { org: string; result: string }[] = [];
  for (const org of orgs ?? []) {
    const today = todayIn(org.timezone);
    if (org.last_reminder_on === today) {
      report.push({ org: org.name, result: "already sent today" });
      continue;
    }
    if (hourIn(org.timezone) !== org.reminder_hour) {
      report.push({ org: org.name, result: "not time yet" });
      continue;
    }
    // Claim today's run first, so an overlapping run can't send it twice.
    const { data: claimed } = await db
      .from("organizations")
      .update({ last_reminder_on: today })
      .eq("id", org.id)
      .or(`last_reminder_on.is.null,last_reminder_on.neq.${today}`)
      .select("id");
    if (!claimed?.length) {
      report.push({ org: org.name, result: "already sent today" });
      continue;
    }
    const { results } = await sendReminder(db, org.id);
    report.push({ org: org.name, result: results.map((r) => `${r.channel}: ${r.status}`).join(", ") });
  }
  // Client messages, at their own hour, for organizations that turned them on.
  const { data: msgOrgs } = await db
    .from("organizations")
    .select("id, name, timezone, client_msg_hour")
    .eq("client_msgs_enabled", true);
  for (const org of msgOrgs ?? []) {
    if (hourIn(org.timezone) !== org.client_msg_hour) continue;
    const results = await sendClientMessages(db, org.id);
    report.push({
      org: org.name,
      result: `client messages: ${results.filter((r) => r.status === "sent").length} sent, ${
        results.filter((r) => r.status !== "sent").length
      } not sent`,
    });
  }
  console.log(`[daily-reminder] ${JSON.stringify(report)}`);
  return NextResponse.json({ ok: true, report });
}
