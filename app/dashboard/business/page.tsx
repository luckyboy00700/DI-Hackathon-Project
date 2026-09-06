import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getServerClient } from '@/lib/db/client';
import { getSessionUser } from '@/lib/auth/session';
import { Badge, Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs } from '@/components/ui/tabs';
import { EmptyState, ErrorState } from '@/components/features/states';
import { ERROR_MESSAGES } from '@/lib/errors';
import { WrongRoleNotice } from '@/components/features/dashboard/WrongRoleNotice';
import { DecideButtons } from '@/components/features/applications/DecideButtons';
import { BusinessDocumentUpload } from '@/components/features/documents/BusinessDocumentUpload';
import {
  BusinessDocumentList,
  type BusinessDocumentRow,
} from '@/components/features/documents/BusinessDocumentList';

export const metadata = { title: 'Your dashboard — Amanah' };

type Supabase = Awaited<ReturnType<typeof getServerClient>>;

type ApplicantRow = {
  id: string;
  status: string;
  availability: string;
  statement: string;
  needsConsent: boolean;
  hasConsent: boolean;
  apprenticeName: string;
  tradeCategory: string;
};

async function loadApplicants(supabase: Supabase, businessId: string): Promise<ApplicantRow[]> {
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
        status: string;
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
        needsConsent: Boolean(needsConsent),
        hasConsent: Boolean(hasConsent),
        apprenticeName: record.profiles?.display_name ?? 'Applicant',
        tradeCategory: record.placements?.trade_category ?? '',
      };
    }),
  );
}

async function loadBusinessDocuments(
  supabase: Supabase,
  businessId: string,
): Promise<BusinessDocumentRow[]> {
  const { data } = await supabase
    .from('business_documents')
    .select('id, document_type, label, expires_on, uploaded_at')
    .eq('business_id', businessId)
    .order('uploaded_at', { ascending: false });
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    id: row.id as string,
    documentType: row.document_type as string,
    label: row.label as string,
    expiresOn: row.expires_on as string | null,
    uploadedAt: row.uploaded_at as string,
  }));
}

export default async function BusinessDashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect('/signin');

  if (user.accountType !== 'business') {
    return (
      <WrongRoleNotice
        roleLabel="businesses"
        otherDashboards={[
          { href: '/dashboard', label: 'apprentices' },
          { href: '/dashboard/masjid', label: 'organizations' },
        ]}
      />
    );
  }

  const supabase = await getServerClient();
  const [{ data: business }, applicants, documents] = await Promise.all([
    supabase.from('businesses').select('verification_status').eq('profile_id', user.id).maybeSingle(),
    loadApplicants(supabase, user.id),
    loadBusinessDocuments(supabase, user.id),
  ]);

  const verified = business?.verification_status === 'verified';
  const active = applicants.filter((a) => a.status === 'accepted');
  const pending = applicants.filter((a) => a.status === 'submitted' || a.status === 'under_review');
  const completed = applicants.filter((a) => a.status === 'withdrawn' || a.status === 'declined');

  return (
    <>
      <h1 className="text-2xl font-semibold">Your dashboard</h1>

      {!verified ? (
        <ErrorState title="Your business is not verified yet" whatToDo={ERROR_MESSAGES.BUSINESS_NOT_VERIFIED} />
      ) : null}

      <Link href="/placements/new">
        <Button className="w-full sm:w-auto">Publish a placement</Button>
      </Link>

      <Tabs tabs={buildTabs({ active, pending, completed, documents })} />
    </>
  );
}

function buildTabs(data: {
  active: ApplicantRow[];
  pending: ApplicantRow[];
  completed: ApplicantRow[];
  documents: BusinessDocumentRow[];
}) {
  return [
    {
      id: 'board',
      label: 'Apprenticeships',
      content: (
        <ApprenticeshipsBoard active={data.active} pending={data.pending} completed={data.completed} />
      ),
    },
    {
      id: 'applicants',
      label: 'Applicants',
      content: <ApplicantsQueue rows={data.pending} />,
    },
    {
      id: 'verification',
      label: 'Verification',
      content: <VerificationPanel rows={data.documents} />,
    },
  ];
}

function ApprenticeshipsBoard({
  active,
  pending,
  completed,
}: {
  active: ApplicantRow[];
  pending: ApplicantRow[];
  completed: ApplicantRow[];
}) {
  return (
    <div className="flex flex-col gap-6 lg:grid lg:grid-cols-3 lg:gap-4">
      <StatusColumn title="Active" rows={active} tone="success" />
      <StatusColumn title="Pending" rows={pending} tone="warning" />
      <StatusColumn title="Completed" rows={completed} tone="neutral" />
    </div>
  );
}

function StatusColumn({
  title,
  rows,
  tone,
}: {
  title: string;
  rows: ApplicantRow[];
  tone: 'success' | 'warning' | 'neutral';
}) {
  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold">
        {title} <Badge tone={tone === 'neutral' ? undefined : tone}>{rows.length}</Badge>
      </h2>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing here yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((row) => (
            <li key={row.id}>
              <Card className="flex flex-col gap-1">
                <p className="text-base font-medium capitalize">
                  {row.tradeCategory.replace(/_/g, ' ')}
                </p>
                <p className="text-sm text-muted-foreground">{row.apprenticeName}</p>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ApplicantsQueue({ rows }: { rows: ApplicantRow[] }) {
  if (rows.length === 0) {
    return (
      <EmptyState
        title="No applicants waiting"
        description="When apprentices apply to your published placements, they appear here."
      />
    );
  }
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((row) => (
        <li key={row.id}>
          <Card className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold">{row.apprenticeName}</h3>
              {row.needsConsent ? (
                <Badge tone={row.hasConsent ? 'success' : 'warning'}>
                  {row.hasConsent ? 'Guardian consent on file' : 'Awaiting guardian consent'}
                </Badge>
              ) : null}
            </div>
            <p className="text-sm capitalize text-muted-foreground">
              {row.tradeCategory.replace(/_/g, ' ')} · available {row.availability}
            </p>
            <p className="text-base">{row.statement}</p>
            <DecideButtons applicationId={row.id} />
          </Card>
        </li>
      ))}
    </ul>
  );
}

function VerificationPanel({ rows }: { rows: BusinessDocumentRow[] }) {
  return (
    <div className="flex flex-col gap-4">
      <BusinessDocumentList rows={rows} />
      <BusinessDocumentUpload />
    </div>
  );
}
