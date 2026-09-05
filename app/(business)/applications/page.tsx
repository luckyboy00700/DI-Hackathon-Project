import { getServerClient } from '@/lib/db/client';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth/session';
import { Badge, Card } from '@/components/ui/card';
import { EmptyState } from '@/components/features/states';
import { DecideButtons } from '@/components/features/applications/DecideButtons';
import { WithdrawButton } from '@/components/features/applications/WithdrawButton';

export const metadata = { title: 'Applicants — Amanah' };

type Row = {
  id: string;
  status: 'submitted' | 'under_review' | 'accepted' | 'declined' | 'withdrawn';
  availability: string;
  statement: string;
  needs_consent: boolean;
  has_consent: boolean;
  apprentice_name: string;
  trade_category: string;
};

type Supabase = Awaited<ReturnType<typeof getServerClient>>;

async function loadApplicants(supabase: Supabase, businessId: string): Promise<Row[]> {
  const { data } = await supabase
    .from('applications')
    .select(
      `id, status, availability, statement, apprentice_id,
       profiles!applications_apprentice_id_fkey(display_name),
       placements!inner(business_id, trade_category)`,
    )
    .eq('placements.business_id', businessId)
    .order('created_at', { ascending: false });

  return Promise.all(
    (data ?? []).map(async (raw) => {
      const record = raw as unknown as {
        id: string;
        status: Row['status'];
        availability: string;
        statement: string;
        profiles: { display_name: string } | null;
        placements: { trade_category: string };
      };
      const [{ data: needsConsent }, { data: hasConsent }] = await Promise.all([
        supabase.rpc('application_needs_guardian_consent', { p_application: record.id }),
        supabase.rpc('application_has_guardian_consent', { p_application: record.id }),
      ]);
      return {
        id: record.id,
        status: record.status,
        availability: record.availability,
        statement: record.statement,
        needs_consent: Boolean(needsConsent),
        has_consent: Boolean(hasConsent),
        apprentice_name: record.profiles?.display_name ?? 'Applicant',
        trade_category: record.placements?.trade_category ?? '',
      };
    }),
  );
}

export default async function ApplicantsPage() {
  const user = await getSessionUser();
  if (!user) redirect('/signin');

  const supabase = await getServerClient();
  const rows = await loadApplicants(supabase, user.id);

  return (
    <>
      <h1 className="text-2xl font-semibold">Applicants</h1>
      <p className="text-base text-muted-foreground">
        Contact details stay hidden until you accept. Applicants under 18 need a signed guardian
        consent on file first.
      </p>

      {rows.length === 0 ? (
        <EmptyState
          title="No applications yet"
          description="When apprentices apply to your published placements, they appear here."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((row) => (
            <li key={row.id}>
              <ApplicantCard row={row} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function ApplicantCard({ row }: { row: Row }) {
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold">{row.apprentice_name}</h2>
        <StatusBadge status={row.status} />
        {row.needs_consent ? (
          <Badge tone={row.has_consent ? 'success' : 'warning'}>
            {row.has_consent ? 'Guardian consent on file' : 'Awaiting guardian consent'}
          </Badge>
        ) : null}
      </div>
      <p className="text-sm capitalize text-muted-foreground">
        {row.trade_category.replace(/_/g, ' ')} · available {row.availability}
      </p>
      <p className="text-base">{row.statement}</p>

      {/*
        Deliberately worded differently from ERROR_MESSAGES.GUARDIAN_CONSENT_REQUIRED. This is a
        standing hint about the applicant's state; that one is the response to a failed attempt.
        Identical copy for the two made them indistinguishable to a reader — and to a test.
      */}
      {row.needs_consent && !row.has_consent ? (
        <p className="text-sm text-warning">
          This applicant is under 18. You can accept them once their guardian&apos;s signed consent
          is uploaded.
        </p>
      ) : null}

      {row.status === 'submitted' || row.status === 'under_review' ? (
        <DecideButtons applicationId={row.id} />
      ) : null}
      {row.status === 'accepted' ? <WithdrawButton applicationId={row.id} actor="business" /> : null}
    </Card>
  );
}

function StatusBadge({ status }: { status: Row['status'] }) {
  if (status === 'accepted') return <Badge tone="success">Accepted</Badge>;
  if (status === 'declined') return <Badge tone="danger">Declined</Badge>;
  if (status === 'withdrawn') return <Badge tone="danger">Ended</Badge>;
  return <Badge>Awaiting your decision</Badge>;
}
