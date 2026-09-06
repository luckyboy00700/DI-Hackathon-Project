import { redirect } from 'next/navigation';
import { getServerClient } from '@/lib/db/client';
import { getSessionUser } from '@/lib/auth/session';
import { Badge, Card } from '@/components/ui/card';
import { Tabs } from '@/components/ui/tabs';
import { EmptyState } from '@/components/features/states';
import { CertificationUpload } from '@/components/features/verification/CertificationUpload';
import {
  OrganizationReviewList,
  type PendingOrganization,
} from '@/components/features/verification/OrganizationReviewList';
import { EndorseForm, type Candidate } from '@/components/features/profile/EndorseForm';
import {
  EndorsementList,
  type EndorsementReference,
} from '@/components/features/profile/EndorsementList';

export const metadata = { title: 'Your dashboard — Amanah' };

type Supabase = Awaited<ReturnType<typeof getServerClient>>;
type Status = 'unverified' | 'verified' | 'revoked';

type DirectoryRow = {
  placementId: string;
  businessName: string;
  tradeCategory: string;
  placementStatus: string;
  apprenticeName: string | null;
  applicationStatus: string | null;
};

async function loadOwnStatus(supabase: Supabase, organizationId: string): Promise<Status> {
  const { data } = await supabase
    .from('organizations')
    .select('verification_status')
    .eq('profile_id', organizationId)
    .maybeSingle();
  return (data?.verification_status as Status | undefined) ?? 'unverified';
}

type CertRow = { organization_id: string; document_path: string; note: string | null };

async function loadPendingOrganizations(
  supabase: Supabase,
  callerId: string,
): Promise<PendingOrganization[]> {
  const [{ data: orgs }, { data: certs }] = await Promise.all([
    supabase
      .from('organizations')
      .select('profile_id')
      .eq('verification_status', 'unverified')
      .neq('profile_id', callerId),
    supabase
      .from('organization_certifications')
      .select('organization_id, document_path, note')
      .order('submitted_at', { ascending: false }),
  ]);

  const pendingIds = new Set(((orgs ?? []) as Array<{ profile_id: string }>).map((o) => o.profile_id));
  const latestByOrg = new Map<string, CertRow>();
  for (const row of (certs ?? []) as CertRow[]) {
    if (pendingIds.has(row.organization_id) && !latestByOrg.has(row.organization_id)) {
      latestByOrg.set(row.organization_id, row);
    }
  }
  if (latestByOrg.size === 0) return [];

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, display_name')
    .in('id', Array.from(latestByOrg.keys()));

  const results: PendingOrganization[] = [];
  for (const profile of (profiles ?? []) as Array<{ id: string; display_name: string }>) {
    const cert = latestByOrg.get(profile.id);
    if (!cert) continue;
    const { data: signed } = await supabase.storage
      .from('organization-certifications')
      .createSignedUrl(cert.document_path, 600);
    results.push({
      organizationId: profile.id,
      displayName: profile.display_name,
      note: cert.note,
      documentUrl: signed?.signedUrl ?? null,
    });
  }
  return results;
}

async function loadDirectory(supabase: Supabase, masjidId: string): Promise<DirectoryRow[]> {
  const { data } = await supabase
    .from('masjid_routed_apprenticeships')
    .select(
      'placement_id, business_id, trade_category, placement_status, apprentice_id, application_status',
    )
    .eq('masjid_id', masjidId);

  const rows = (data ?? []) as Array<{
    placement_id: string;
    business_id: string;
    trade_category: string;
    placement_status: string;
    apprentice_id: string | null;
    application_status: string | null;
  }>;
  if (rows.length === 0) return [];

  const profileIds = [
    ...new Set(rows.flatMap((r) => [r.business_id, r.apprentice_id].filter(Boolean) as string[])),
  ];
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, display_name')
    .in('id', profileIds);
  const names = new Map(
    ((profiles ?? []) as Array<{ id: string; display_name: string }>).map((p) => [
      p.id,
      p.display_name,
    ]),
  );

  return rows.map((row) => ({
    placementId: row.placement_id,
    businessName: names.get(row.business_id) ?? 'Business',
    tradeCategory: row.trade_category,
    placementStatus: row.placement_status,
    apprenticeName: row.apprentice_id ? (names.get(row.apprentice_id) ?? 'Apprentice') : null,
    applicationStatus: row.application_status,
  }));
}

/** Businesses and apprentices this organization may vouch for — excluding operated businesses. */
async function loadVouchCandidates(supabase: Supabase, organizationId: string): Promise<Candidate[]> {
  const [{ data: businesses }, { data: apprentices }, { data: operated }, { data: given }] =
    await Promise.all([
      supabase.from('profiles').select('id, display_name').eq('account_type', 'business'),
      supabase.from('profiles').select('id, display_name').eq('account_type', 'apprentice'),
      supabase
        .from('organization_operated_businesses')
        .select('business_id')
        .eq('organization_id', organizationId),
      supabase.from('endorsements').select('business_subject_id, apprentice_subject_id')
        .eq('organization_id', organizationId),
    ]);

  const excluded = new Set(
    ((operated ?? []) as Array<{ business_id: string }>).map((row) => row.business_id),
  );
  const vouchedFor = new Set(
    ((given ?? []) as Array<{ business_subject_id: string | null; apprentice_subject_id: string | null }>)
      .map((row) => row.business_subject_id ?? row.apprentice_subject_id)
      .filter(Boolean),
  );

  const businessCandidates = ((businesses ?? []) as Array<{ id: string; display_name: string }>)
    .filter((row) => row.id !== organizationId && !excluded.has(row.id) && !vouchedFor.has(row.id))
    .map((row) => ({ id: row.id, name: row.display_name, subjectType: 'business' as const }));

  const apprenticeCandidates = ((apprentices ?? []) as Array<{ id: string; display_name: string }>)
    .filter((row) => !vouchedFor.has(row.id))
    .map((row) => ({ id: row.id, name: row.display_name, subjectType: 'apprentice' as const }));

  return [...businessCandidates, ...apprenticeCandidates];
}

async function loadOwnEndorsements(
  supabase: Supabase,
  organizationId: string,
  organizationName: string,
): Promise<EndorsementReference[]> {
  const { data } = await supabase
    .from('endorsements')
    .select('id, created_at')
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false });

  return ((data ?? []) as Array<{ id: string; created_at: string }>).map((row) => ({
    id: row.id,
    organizationName,
    createdAt: row.created_at,
  }));
}

export default async function OrganizationDashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect('/signin');

  if (user.accountType !== 'organization') {
    return (
      <>
        <h1 className="text-2xl font-semibold">Your dashboard</h1>
        <p className="text-base text-muted-foreground">
          This dashboard is for organizations — masjids and other community hubs.
        </p>
      </>
    );
  }

  const supabase = await getServerClient();
  const status = await loadOwnStatus(supabase, user.id);
  const [pending, directory, candidates, given] = await Promise.all([
    loadPendingOrganizations(supabase, user.id),
    loadDirectory(supabase, user.id),
    loadVouchCandidates(supabase, user.id),
    loadOwnEndorsements(supabase, user.id, user.displayName),
  ]);

  return (
    <>
      <h1 className="text-2xl font-semibold">Your dashboard</h1>
      <Tabs
        tabs={[
          {
            id: 'directory',
            label: 'Directory',
            content: <DirectoryPanel rows={directory} />,
          },
          {
            id: 'action-center',
            label: 'Action Center',
            content: <ActionCenterPanel pending={pending} candidates={candidates} given={given} />,
          },
          {
            id: 'verification',
            label: 'Verification',
            content: <VerificationPanel status={status} />,
          },
        ]}
      />
    </>
  );
}

function VerificationPanel({ status }: { status: Status }) {
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold">Your status</h2>
        <StatusBadge status={status} />
      </div>
      {status === 'verified' ? (
        <p className="text-base text-muted-foreground">
          You are verified and appear as a masjid option on the board.
        </p>
      ) : (
        <CertificationUpload />
      )}
    </Card>
  );
}

function StatusBadge({ status }: { status: Status }) {
  if (status === 'verified') return <Badge tone="success">Verified</Badge>;
  if (status === 'revoked') return <Badge tone="danger">Revoked</Badge>;
  return <Badge tone="warning">Unverified</Badge>;
}

function DirectoryPanel({ rows }: { rows: DirectoryRow[] }) {
  if (rows.length === 0) {
    return (
      <EmptyState
        title="Nothing routed through you yet"
        description="Placements from businesses you've verified will appear here, whether or not an apprentice has applied."
      />
    );
  }
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((row) => (
        <li key={`${row.placementId}-${row.apprenticeName ?? 'open'}`}>
          <Card className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold capitalize">
                {row.tradeCategory.replace(/_/g, ' ')}
              </h3>
              <Badge>{row.placementStatus}</Badge>
              {row.applicationStatus ? <Badge tone="success">{row.applicationStatus}</Badge> : null}
            </div>
            <p className="text-sm text-muted-foreground">{row.businessName}</p>
            {row.apprenticeName ? (
              <p className="text-sm text-muted-foreground">Applicant: {row.apprenticeName}</p>
            ) : null}
          </Card>
        </li>
      ))}
    </ul>
  );
}

function ActionCenterPanel({
  pending,
  candidates,
  given,
}: {
  pending: PendingOrganization[];
  candidates: Candidate[];
  given: EndorsementReference[];
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Organizations awaiting review</h2>
        <OrganizationReviewList organizations={pending} />
      </div>
      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Issue a community vouch</h2>
        <EndorseForm candidates={candidates} />
      </div>
      <EndorsementList endorsements={given} subjectLabel="anyone yet" />
    </div>
  );
}
