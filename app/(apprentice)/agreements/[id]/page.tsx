import { getServerClient } from '@/lib/db/client';
import { ErrorState } from '@/components/features/states';
import { AgreementView, type AgreementRecord } from '@/components/features/agreements/AgreementView';

export const metadata = { title: 'Your agreement — Amanah' };

/**
 * Both parties load this same route against the same row; RLS (0012) restricts it to the
 * apprentice and the owning business.
 */
export default async function AgreementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await getServerClient();

  const { data } = await supabase
    .from('agreements')
    .select(
      `duration_weeks, weekly_hours, hourly_rate, total_estimated_hours, estimated_gross_pay,
       mentorship_milestones, safety_obligations, termination_terms, generated_at`,
    )
    .eq('id', id)
    .maybeSingle();

  if (!data) {
    return (
      <ErrorState
        title="This agreement is not available"
        whatToDo="It may not exist, or you may not be a party to it. Check the link from your applications list."
      />
    );
  }

  return (
    <>
      <h1 className="text-2xl font-semibold">Apprenticeship agreement</h1>
      <p className="text-base text-muted-foreground">
        This is the shared record both you and your mentor agreed to. It cannot be edited once
        issued.
      </p>
      <a
        href={`/agreements/${id}/pdf`}
        className="inline-flex min-h-11 w-full items-center justify-center rounded-(--radius-control) border border-border bg-surface px-4 text-base font-medium hover:bg-muted sm:w-auto"
      >
        Download as PDF
      </a>
      <AgreementView agreement={data as unknown as AgreementRecord} />
    </>
  );
}
