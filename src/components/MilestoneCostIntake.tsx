"use client";

import { useState, type FormEvent } from "react";
import { createCost, moneyInput, usd, type MilestoneCost } from "@/lib/costs";

export function MilestoneCostIntake({ cost, editable, onSave }: {
  cost?: MilestoneCost;
  editable: boolean;
  onSave: (cost: MilestoneCost) => void;
}) {
  const [estimated, setEstimated] = useState(moneyInput(cost?.estimatedCents));
  const [actual, setActual] = useState(moneyInput(cost?.actualCents));
  const [paid, setPaid] = useState(moneyInput(cost?.paidCents));
  const [responsible, setResponsible] = useState(cost?.responsible ?? "");
  const [payee, setPayee] = useState(cost?.payee ?? "");
  const [reference, setReference] = useState(cost?.reference ?? "");
  const [paymentDate, setPaymentDate] = useState(cost?.paymentDate ?? "");
  const [notes, setNotes] = useState(cost?.notes ?? "");
  const [error, setError] = useState<string | null>(null);

  function save(event: FormEvent) {
    event.preventDefault();
    if (!editable) return;
    try {
      const next = createCost({ estimated, actual, paid, responsible, payee, reference, paymentDate, notes });
      onSave(next);
      setError(null);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not save this cost.");
    }
  }

  const outstanding = cost?.actualCents == null ? null : Math.max(cost.actualCents - (cost.paidCents ?? 0), 0);
  return (
    <details className="cost-intake" open={Boolean(cost)}>
      <summary>
        Cost intake · {cost ? `${usd(cost.actualCents)} actual · ${usd(outstanding)} outstanding` : "No cost recorded"}
      </summary>
      <p className="small">Amounts are in USD. Leave unknown amounts blank; enter 0 for no charge. Paid is the total paid to date.</p>
      <form onSubmit={save}>
        <fieldset disabled={!editable}>
          <div className="cost-amounts">
            <label className="field">Estimated cost (USD)
              <input inputMode="decimal" value={estimated} onChange={(event) => setEstimated(event.target.value)} placeholder="Not yet estimated" />
            </label>
            <label className="field">Actual cost (USD)
              <input inputMode="decimal" value={actual} onChange={(event) => setActual(event.target.value)} placeholder="Not yet confirmed" />
            </label>
            <label className="field">Paid to date (USD)
              <input inputMode="decimal" value={paid} onChange={(event) => setPaid(event.target.value)} placeholder="Not yet entered" />
            </label>
          </div>
          <div className="row2">
            <label className="field">Responsible person
              <input value={responsible} onChange={(event) => setResponsible(event.target.value)} placeholder="Who owns this cost" required />
            </label>
            <label className="field">Payee / vendor
              <input value={payee} onChange={(event) => setPayee(event.target.value)} />
            </label>
            <label className="field">Latest payment date
              <input type="date" value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} />
            </label>
            <label className="field">Invoice or receipt reference
              <input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Document name or reference number" />
            </label>
          </div>
          <label className="field">Cost notes
            <textarea className="short" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="What the cost covers, approvals, or payment details" />
          </label>
          {error && <p className="err" role="alert">{error}</p>}
          {editable && <button className="btn ghost" type="submit">Save cost</button>}
        </fieldset>
      </form>
      {cost && <p className="small" role="status">Saved {new Date(cost.updatedAt).toLocaleString()}. Estimated {usd(cost.estimatedCents)} · paid {usd(cost.paidCents)}.</p>}
    </details>
  );
}
