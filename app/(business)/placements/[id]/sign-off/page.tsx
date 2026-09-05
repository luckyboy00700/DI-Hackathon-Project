import { redirect } from 'next/navigation';
import { getServerClient } from '@/lib/db/client';
import { getSessionUser } from '@/lib/auth/session';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/features/states';
import { SignOffForm } from '@/components/features/passport/SignOffForm';

export const metadata = { title: 'Sign off competencies — Amanah' };

type Active = { id: string; apprentice_name: string };

export default async function SignOffPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) redirect('/signin');

  const supabase = await getServerClient();
  const { data } = await supabase
    .from('applications')
    .select('id, profiles!applications_apprentice_id_fkey(display_name)')
    .eq('placement_id', id)
    .eq('status', 'accepted');

  const active: Active[] = (data ?? []).map((raw) => {
    const record = raw as unknown as { id: string; profiles: { display_name: string } };
    return { id: record.id, apprentice_name: record.profiles?.display_name ?? 'Apprentice' };
  });

  return (
    <>
      <h1 className="text-2xl font-semibold">Sign off competencies</h1>
      <p className="text-base text-muted-foreground">
        Each entry becomes a permanent, signed record on the apprentice&apos;s Skill Passport.
      </p>

      {active.length === 0 ? (
        <EmptyState
          title="Nobody is placed here yet"
          description="Once you accept an applicant and the placement starts, you can sign off what they demonstrate."
        />
      ) : (
        active.map((application) => (
          <Card key={application.id} className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold">{application.apprentice_name}</h2>
            <SignOffForm applicationId={application.id} />
          </Card>
        ))
      )}
    </>
  );
}
