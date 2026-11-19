import { ActionForm } from "@/components/action-form";
import { shortDate, type ISODate } from "@/lib/dates";
import { money } from "@/lib/format";
import { PAYMENT_LABELS, type PaymentMethod } from "@/lib/schedule";
import { saveFinalPayment } from "../payment-actions";

type Props = {
  bookingId: string;
  paid: boolean;
  paidOn: ISODate | null;
  method: PaymentMethod | null;
  amountCents: number | null;
  /** Balance due from the estimate, to suggest as the amount. */
  balanceCents: number | null;
  today: ISODate;
};

/** The final payment, recorded after the party. */
export function FinalPayment({ bookingId, paid, paidOn, method, amountCents, balanceCents, today }: Props) {
  const suggested = amountCents ?? (balanceCents && balanceCents > 0 ? balanceCents : null);
  return (
    <section className="panel grid gap-3 print:hidden" aria-labelledby="final-payment-title">
      <h2 id="final-payment-title" className="text-lg font-bold">
        Final payment
      </h2>
      <p className={`m-0 text-sm ${paid ? "" : "text-muted"}`}>
        {paid && paidOn && method
          ? `Received ${shortDate(paidOn)} by ${PAYMENT_LABELS[method].toLowerCase()}${amountCents ? `, ${money(amountCents)}` : ""}.`
          : balanceCents && balanceCents > 0
            ? `Not received yet. Balance due from the estimate: ${money(balanceCents)}.`
            : "Not received yet."}
      </p>
      <ActionForm action={saveFinalPayment} submitLabel="Save final payment">
        <input type="hidden" name="id" value={bookingId} />
        <label className="flex min-h-11 items-center gap-2 font-semibold">
          <input type="checkbox" name="paid" defaultChecked={paid} className="h-5 w-5 accent-[var(--brand)]" />
          Final payment received
        </label>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="field">
            Date received
            <input className="input" type="date" name="on" defaultValue={paidOn ?? today} />
          </label>
          <label className="field">
            Paid by
            <select className="input" name="method" defaultValue={method ?? ""}>
              <option value="">Choose…</option>
              {(Object.keys(PAYMENT_LABELS) as PaymentMethod[]).map((m) => (
                <option key={m} value={m}>
                  {PAYMENT_LABELS[m]}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Amount ($, optional)
            <input
              className="input"
              name="amount"
              inputMode="decimal"
              defaultValue={suggested ? String(suggested / 100) : ""}
            />
          </label>
        </div>
      </ActionForm>
    </section>
  );
}
