import { redirect } from 'next/navigation';
import { getServerClient } from '@/lib/db/client';
import { getSessionUser } from '@/lib/auth/session';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/features/states';

export const metadata = { title: 'Your Skill Passport — Amanah' };

export default async function PassportPage() {
  const user = await getSessionUser();
  if (!user) redirect('/signin');

  const supabase = await getServerClient();
  // mentor_id points at businesses, not profiles, so there is no direct profiles relationship to
  // embed here — the mentor's name is resolved in a second read.
  const [{ data: entries }, { data: profile }] = await Promise.all([
    supabase
      .from('competency_entries')
      .select('id, competency, signed_at, mentor_id')
      .order('signed_at', { ascending: false }),
    supabase.from('profiles').select('passport_share_token').eq('id', user.id).maybeSingle(),
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

  const rows = records.map((record) => ({
    id: record.id,
    competency: record.competency,
    signedAt: record.signed_at,
    mentor: mentorNames.get(record.mentor_id) ?? 'Mentor',
  }));

  return (
    <>
      <h1 className="text-2xl font-semibold">Your Skill Passport</h1>
      <p className="text-base text-muted-foreground">
        Every entry was signed by a practitioner who watched you do the work. You cannot edit them
        — that is what makes them worth something.
      </p>
      <ShareLink token={profile?.passport_share_token as string | undefined} />
      <EntryList rows={rows} />
    </>
  );
}

function ShareLink({ token }: { token: string | undefined }) {
  if (!token) return null;
  return (
    <Card className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold">Share link</h2>
      <p className="text-sm text-muted-foreground">
        Read-only. Shows your competencies and who signed them — never your contact details.
      </p>
      <code className="overflow-x-auto rounded-(--radius-control) bg-muted p-2 text-sm">
        /passport/{token}
      </code>
    </Card>
  );
}

function EntryList({
  rows,
}: {
  rows: { id: string; competency: string; signedAt: string; mentor: string }[];
}) {
  if (rows.length === 0) {
    return (
      <EmptyState
        title="No competencies signed yet"
        description="Once you start a placement, your mentor can sign off the skills you demonstrate."
      />
    );
  }
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((row) => (
        <li key={row.id}>
          <Card className="flex flex-col gap-1">
            <h3 className="text-base font-semibold">{row.competency}</h3>
            <p className="text-sm text-muted-foreground">
              Signed by {row.mentor} on {new Date(row.signedAt).toLocaleDateString()}
            </p>
          </Card>
        </li>
      ))}
    </ul>
  );
}
