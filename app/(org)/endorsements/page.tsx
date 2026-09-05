import { redirect } from 'next/navigation';
import { getServerClient } from '@/lib/db/client';
import { getSessionUser } from '@/lib/auth/session';
import { EndorseForm, type Candidate } from '@/components/features/profile/EndorseForm';
import { EndorsementList, type EndorsementReference } from '@/components/features/profile/EndorsementList';

export const metadata = { title: 'Community references — Amanah' };

type Supabase = Awaited<ReturnType<typeof getServerClient>>;

/** Businesses this organization may vouch for — excluding any it operates itself (FR-004). */
async function loadCandidates(supabase: Supabase, organizationId: string): Promise<Candidate[]> {
  const [{ data: businesses }, { data: operated }] = await Promise.all([
    supabase.from('profiles').select('id, display_name').eq('account_type', 'business'),
    supabase
      .from('organization_operated_businesses')
      .select('business_id')
      .eq('organization_id', organizationId),
  ]);

  const excluded = new Set(
    ((operated ?? []) as Array<{ business_id: string }>).map((row) => row.business_id),
  );

  return ((businesses ?? []) as Array<{ id: string; display_name: string }>)
    .filter((row) => row.id !== organizationId && !excluded.has(row.id))
    .map((row) => ({ id: row.id, name: row.display_name, subjectType: 'business' as const }));
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

export default async function EndorsementsPage() {
  const user = await getSessionUser();
  if (!user) redirect('/signin');

  const supabase = await getServerClient();
  const [candidates, given] = await Promise.all([
    loadCandidates(supabase, user.id),
    loadOwnEndorsements(supabase, user.id, user.displayName),
  ]);

  return (
    <>
      <h1 className="text-2xl font-semibold">Community references</h1>
      <p className="text-base text-muted-foreground">
        Vouching puts your organization&apos;s name beside a member as a reference. You are not
        asked to write anything about them, and nothing of the sort is stored.
      </p>

      <EndorseForm candidates={candidates} />

      <h2 className="text-lg font-semibold">References you have given</h2>
      <EndorsementList endorsements={given} subjectLabel="anyone yet" />
    </>
  );
}
