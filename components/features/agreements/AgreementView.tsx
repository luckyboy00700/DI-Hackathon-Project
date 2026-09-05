import { Card } from '@/components/ui/card';

export type AgreementRecord = {
  duration_weeks: number;
  weekly_hours: number;
  hourly_rate: number;
  total_estimated_hours: number;
  estimated_gross_pay: number;
  mentorship_milestones: string[];
  safety_obligations: string[];
  termination_terms: string;
  generated_at: string;
};

/**
 * T062 / FR-016. Renders the single stored agreement row, so both parties are literally reading
 * the same record — that is what makes the two copies identical rather than merely similar.
 */
export function AgreementView({ agreement }: { agreement: AgreementRecord }) {
  return (
    <article className="flex flex-col gap-4">
      <Card className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Terms</h2>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <Term label="Length" value={`${agreement.duration_weeks} weeks`} />
          <Term label="Hours" value={`${agreement.weekly_hours} per week`} />
          <Term label="Pay rate" value={`$${Number(agreement.hourly_rate).toFixed(2)} per hour`} />
          <Term label="Estimated total hours" value={`${agreement.total_estimated_hours}`} />
          <Term
            label="Estimated gross pay"
            value={`$${Number(agreement.estimated_gross_pay).toFixed(2)}`}
          />
          <Term label="Issued" value={new Date(agreement.generated_at).toLocaleDateString()} />
        </dl>
        <p className="text-sm text-muted-foreground">
          Wages are paid directly by the business. This platform records the terms; it does not
          process payment.
        </p>
      </Card>

      <Card className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Mentorship milestones</h2>
        <ul className="list-disc pl-5 text-base">
          {agreement.mentorship_milestones.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      </Card>

      <Card className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Safety and equipment</h2>
        <ul className="list-disc pl-5 text-base">
          {agreement.safety_obligations.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      </Card>

      <Card className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Ending this placement</h2>
        <p className="text-base">{agreement.termination_terms}</p>
      </Card>
    </article>
  );
}

function Term({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
