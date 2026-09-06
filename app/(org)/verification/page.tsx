import { redirect } from 'next/navigation';
import { getServerClient } from '@/lib/db/client';
import { getSessionUser } from '@/lib/auth/session';
import { Badge, Card } from '@/components/ui/card';
import { CertificationUpload } from '@/components/features/verification/CertificationUpload';
import {
  OrganizationReviewList,
  type PendingOrganization,
} from '@/components/features/verification/OrganizationReviewList';

export const metadata = { title: 'Organization verification — Amanah' };

type Supabase = Awaited<ReturnType<typeof getServerClient>>;
type Status = 'unverified' | 'verified' | 'revoked';

async function loadOwnStatus(supabase: Supabase, organizationId: string): Promise<Status> {
  const { data } = await supabase
    .from('organizations')
    .select('verification_status')
    .eq('profile_id', organizationId)
    .maybeSingle();
  return (data?.verification_status as Status | undefined) ?? 'unverified';
}

type CertRow = { organization_id: string; document_path: string; note: string | null };

/** The latest certification on file for each unverified organization other than the caller. */
async function loadLatestCertifications(
  supabase: Supabase,
  callerId: string,
): Promise<Map<string, CertRow>> {
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
  return latestByOrg;
}

async function loadPendingOrganizations(
  supabase: Supabase,
  callerId: string,
): Promise<PendingOrganization[]> {
  const latestByOrg = await loadLatestCertifications(supabase, callerId);
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

export default async function OrganizationVerificationPage() {
  const user = await getSessionUser();
  if (!user) redirect('/signin');

  if (user.accountType !== 'organization') {
    return (
      <>
        <h1 className="text-2xl font-semibold">Organization verification</h1>
        <p className="text-base text-muted-foreground">
          This page is for organizations — masjids and other community hubs — to verify their
          identity. Sign in with an organization account to use it.
        </p>
      </>
    );
  }

  const supabase = await getServerClient();
  const [status, pending] = await Promise.all([
    loadOwnStatus(supabase, user.id),
    loadPendingOrganizations(supabase, user.id),
  ]);

  return (
    <>
      <h1 className="text-2xl font-semibold">Organization verification</h1>
      <p className="text-base text-muted-foreground">
        Verified organizations appear as masjid options apprentices can browse by, and can review
        other organizations&apos; certifications in turn.
      </p>

      <Card className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">Your status</h2>
          <StatusBadge status={status} />
        </div>
        {status === 'verified' ? (
          <p className="text-base text-muted-foreground">
            {user.displayName} is verified and appears as a masjid option on the board.
          </p>
        ) : (
          <CertificationUpload />
        )}
      </Card>

      {status === 'verified' ? (
        <>
          <h2 className="text-lg font-semibold">Organizations awaiting review</h2>
          <OrganizationReviewList organizations={pending} />
        </>
      ) : null}
    </>
  );
}

function StatusBadge({ status }: { status: Status }) {
  if (status === 'verified') return <Badge tone="success">Verified</Badge>;
  if (status === 'revoked') return <Badge tone="danger">Revoked</Badge>;
  return <Badge tone="warning">Unverified</Badge>;
}
