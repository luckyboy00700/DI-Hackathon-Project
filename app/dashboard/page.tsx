import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getServerClient } from '@/lib/db/client';
import { getSessionUser } from '@/lib/auth/session';
import { Badge, Card } from '@/components/ui/card';
import { Tabs } from '@/components/ui/tabs';
import { EmptyState } from '@/components/features/states';
import { WrongRoleNotice } from '@/components/features/dashboard/WrongRoleNotice';
import { ApprenticeDocumentUpload } from '@/components/features/documents/ApprenticeDocumentUpload';
import {
  ApprenticeDocumentList,
  type ApprenticeDocumentRow,
} from '@/components/features/documents/ApprenticeDocumentList';

export const metadata = { title: 'Your dashboard — Amanah' };

type Supabase = Awaited<ReturnType<typeof getServerClient>>;

type ApplicationRow = {
  id: string;
  status: string;
  tradeCategory: string;
  businessName: string;
};

type AgreementRow = {
  id: string;
  applicationId: string;
  hourlyRate: number;
  weeklyHours: number;
  durationWeeks: number;
};

type PassportRow = { id: string; competency: string; signedAt: string; mentor: string };

type GuardianConsentRow = { applicationId: string; tradeCategory: string; recordedAt: string };

async function loadApplications(supabase: Supabase, apprenticeId: string) {
  const { data: applications } = await supabase
    .from('applications')
    .select('id, status, placement_id')
    .eq('apprentice_id', apprenticeId)
    .order('created_at', { ascending: false });

  const rows = (applications ?? []) as Array<{
    id: string;
    status: string;
    placement_id: string;
  }>;
  if (rows.length === 0) return { applications: [] as ApplicationRow[], applicationIds: [] as string[] };

  const placementIds = [...new Set(rows.map((r) => r.placement_id))];
  const { data: placements } = await supabase
    .from('placements')
    .select('id, trade_category, business_id')
    .in('id', placementIds);
  const placementRows = (placements ?? []) as Array<{
    id: string;
    trade_category: string;
    business_id: string;
  }>;
  const placementById = new Map(placementRows.map((p) => [p.id, p]));

  const businessIds = [...new Set(placementRows.map((p) => p.business_id))];
  const { data: businesses } = businessIds.length
    ? await supabase.from('profiles').select('id, display_name').in('id', businessIds)
    : { data: [] };
  const businessNames = new Map(
    ((businesses ?? []) as Array<{ id: string; display_name: string }>).map((b) => [
      b.id,
      b.display_name,
    ]),
  );

  return {
    applications: rows.map((row) => {
      const placement = placementById.get(row.placement_id);
      return {
        id: row.id,
        status: row.status,
        tradeCategory: placement?.trade_category ?? '',
        businessName: placement ? (businessNames.get(placement.business_id) ?? 'Business') : 'Business',
      };
    }),
    applicationIds: rows.map((r) => r.id),
  };
}

async function loadAgreements(supabase: Supabase, applicationIds: string[]): Promise<AgreementRow[]> {
  if (applicationIds.length === 0) return [];
  const { data } = await supabase
    .from('agreements')
    .select('id, application_id, hourly_rate, weekly_hours, duration_weeks')
    .in('application_id', applicationIds);
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    id: row.id as string,
    applicationId: row.application_id as string,
    hourlyRate: Number(row.hourly_rate),
    weeklyHours: Number(row.weekly_hours),
    durationWeeks: Number(row.duration_weeks),
  }));
}

async function loadGuardianConsents(
  supabase: Supabase,
  applicationIds: string[],
): Promise<GuardianConsentRow[]> {
  if (applicationIds.length === 0) return [];
  const { data } = await supabase
    .from('guardian_consents')
    .select('application_id, recorded_at')
    .in('application_id', applicationIds);
  return ((data ?? []) as Array<{ application_id: string; recorded_at: string }>).map((row) => ({
    applicationId: row.application_id,
    tradeCategory: '',
    recordedAt: row.recorded_at,
  }));
}

async function loadApprenticeDocuments(
  supabase: Supabase,
  apprenticeId: string,
): Promise<ApprenticeDocumentRow[]> {
  const { data } = await supabase
    .from('apprentice_documents')
    .select('id, document_type, note, uploaded_at')
    .eq('apprentice_id', apprenticeId)
    .order('uploaded_at', { ascending: false });
  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    id: row.id as string,
    documentType: row.document_type as string,
    note: row.note as string | null,
    uploadedAt: row.uploaded_at as string,
  }));
}

async function loadPassport(
  supabase: Supabase,
  apprenticeId: string,
): Promise<{ entries: PassportRow[]; shareToken: string | undefined }> {
  const [{ data: entries }, { data: profile }] = await Promise.all([
    supabase
      .from('competency_entries')
      .select('id, competency, signed_at, mentor_id')
      .order('signed_at', { ascending: false }),
    supabase.from('profiles').select('passport_share_token').eq('id', apprenticeId).maybeSingle(),
  ]);

  const records = (entries ?? []) as Array<{
    id: string;
    competency: string;
    signed_at: string;
    mentor_id: string;
  }>;
  const mentorIds = [...new Set(records.map((r) => r.mentor_id))];
  const { data: mentors } = mentorIds.length
    ? await supabase.from('profiles').select('id, display_name').in('id', mentorIds)
    : { data: [] };
  const mentorNames = new Map(
    ((mentors ?? []) as Array<{ id: string; display_name: string }>).map((m) => [
      m.id,
      m.display_name,
    ]),
  );

  return {
    entries: records.map((r) => ({
      id: r.id,
      competency: r.competency,
      signedAt: r.signed_at,
      mentor: mentorNames.get(r.mentor_id) ?? 'Mentor',
    })),
    shareToken: profile?.passport_share_token as string | undefined,
  };
}

export default async function ApprenticeDashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect('/signin');

  if (user.accountType !== 'apprentice') {
    return (
      <WrongRoleNotice
        roleLabel="apprentices"
        otherDashboards={[
          { href: '/dashboard/business', label: 'businesses' },
          { href: '/dashboard/masjid', label: 'organizations' },
        ]}
      />
    );
  }

  const supabase = await getServerClient();
  const { applications, applicationIds } = await loadApplications(supabase, user.id);
  const [agreements, guardianConsents, documents, passport] = await Promise.all([
    loadAgreements(supabase, applicationIds),
    loadGuardianConsents(supabase, applicationIds),
    loadApprenticeDocuments(supabase, user.id),
    loadPassport(supabase, user.id),
  ]);

  return (
    <>
      <h1 className="text-2xl font-semibold">Your dashboard</h1>
      <Tabs
        tabs={buildTabs({ applications, agreements, guardianConsents, documents, passport })}
      />
    </>
  );
}

function buildTabs(data: {
  applications: ApplicationRow[];
  agreements: AgreementRow[];
  guardianConsents: GuardianConsentRow[];
  documents: ApprenticeDocumentRow[];
  passport: { entries: PassportRow[]; shareToken: string | undefined };
}) {
  return [
    {
      id: 'passport',
      label: 'Skill Passport',
      content: (
        <PassportPanel entries={data.passport.entries} shareToken={data.passport.shareToken} />
      ),
    },
    {
      id: 'placements',
      label: 'Placements',
      content: <PlacementsPanel applications={data.applications} />,
    },
    {
      id: 'documents',
      label: 'Documents',
      content: (
        <DocumentsPanel guardianConsents={data.guardianConsents} documents={data.documents} />
      ),
    },
    {
      id: 'agreements',
      label: 'Agreements',
      content: <AgreementsPanel agreements={data.agreements} />,
    },
  ];
}

function PassportPanel({
  entries,
  shareToken,
}: {
  entries: PassportRow[];
  shareToken: string | undefined;
}) {
  return (
    <div className="flex flex-col gap-3">
      {shareToken ? (
        <Card className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">Share link</h2>
          <code className="overflow-x-auto rounded-(--radius-control) bg-muted p-2 text-sm">
            /passport/{shareToken}
          </code>
        </Card>
      ) : null}
      {entries.length === 0 ? (
        <EmptyState
          title="No competencies signed yet"
          description="Once you start a placement, your mentor can sign off the skills you demonstrate."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {entries.map((entry) => (
            <li key={entry.id}>
              <Card className="flex flex-col gap-1">
                <h3 className="text-base font-semibold">{entry.competency}</h3>
                <p className="text-sm text-muted-foreground">
                  Signed by {entry.mentor} on {new Date(entry.signedAt).toLocaleDateString()}
                </p>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PlacementsPanel({ applications }: { applications: ApplicationRow[] }) {
  if (applications.length === 0) {
    return (
      <EmptyState
        title="No applications yet"
        description="Browse placements and apply to start your first apprenticeship."
        action={
          <Link href="/browse" className="text-sm font-medium text-primary underline">
            Browse placements
          </Link>
        }
      />
    );
  }
  return (
    <ul className="flex flex-col gap-3">
      {applications.map((row) => (
        <li key={row.id}>
          <Card className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold capitalize">
                {row.tradeCategory.replace(/_/g, ' ')}
              </h3>
              <StatusBadge status={row.status} />
            </div>
            <p className="text-sm text-muted-foreground">{row.businessName}</p>
          </Card>
        </li>
      ))}
    </ul>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'accepted') return <Badge tone="success">Accepted</Badge>;
  if (status === 'declined') return <Badge tone="danger">Declined</Badge>;
  if (status === 'withdrawn') return <Badge tone="danger">Ended</Badge>;
  return <Badge>Awaiting decision</Badge>;
}

function DocumentsPanel({
  guardianConsents,
  documents,
}: {
  guardianConsents: GuardianConsentRow[];
  documents: ApprenticeDocumentRow[];
}) {
  return (
    <div className="flex flex-col gap-4">
      {guardianConsents.length > 0 ? (
        <Card className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">Guardian consent on file</h2>
          <ul className="flex flex-col gap-1">
            {guardianConsents.map((row) => (
              <li key={row.applicationId} className="text-sm text-muted-foreground">
                Recorded {new Date(row.recordedAt).toLocaleDateString()}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
      <ApprenticeDocumentList rows={documents} />
      <ApprenticeDocumentUpload />
    </div>
  );
}

function AgreementsPanel({ agreements }: { agreements: AgreementRow[] }) {
  if (agreements.length === 0) {
    return (
      <EmptyState
        title="No agreements yet"
        description="Once a business accepts your application, your agreement appears here."
      />
    );
  }
  return (
    <ul className="flex flex-col gap-3">
      {agreements.map((row) => (
        <li key={row.id}>
          <Card className="flex flex-col gap-2">
            <p className="text-base font-medium">
              ${row.hourlyRate.toFixed(2)}/hour · {row.weeklyHours} hrs/week for {row.durationWeeks}{' '}
              weeks
            </p>
            <Link href={`/agreements/${row.id}`} className="text-sm font-medium text-primary underline">
              View agreement
            </Link>
          </Card>
        </li>
      ))}
    </ul>
  );
}
