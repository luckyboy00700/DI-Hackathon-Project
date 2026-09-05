import { getServerClient } from '@/lib/db/client';
import { Card } from '@/components/ui/card';
import { EmptyState, ErrorState } from '@/components/features/states';

export const metadata = { title: 'Skill Passport — Amanah' };

type Entry = {
  apprentice_name: string;
  competency: string;
  mentor_name: string;
  trade_category: string;
  signed_at: string;
};

/**
 * T071 / FR-021 — read-only share view resolved by an unguessable token. passport_by_token()
 * returns competencies, mentor and date only: no contact details, no date of birth.
 */
export default async function SharedPassportPage({
  params,
}: {
  params: Promise<{ shareToken: string }>;
}) {
  const { shareToken } = await params;
  const supabase = await getServerClient();
  const { data, error } = await supabase.rpc('passport_by_token', { p_token: shareToken });

  if (error) {
    return (
      <ErrorState
        title="This passport link is not valid"
        whatToDo="Check the link is complete, or ask the apprentice to share it again."
      />
    );
  }

  const entries = (data ?? []) as Entry[];
  if (entries.length === 0) {
    return (
      <EmptyState
        title="Nothing to show yet"
        description="This passport has no signed competencies on it."
      />
    );
  }

  return (
    <>
      <h1 className="text-2xl font-semibold">{entries[0]!.apprentice_name}</h1>
      <p className="text-base text-muted-foreground">
        Verified apprenticeship record. Each entry was signed by the practitioner named beside it.
      </p>
      <ul className="flex flex-col gap-3">
        {entries.map((entry) => (
          <li key={`${entry.competency}-${entry.signed_at}`}>
            <Card className="flex flex-col gap-1">
              <h2 className="text-base font-semibold">{entry.competency}</h2>
              <p className="text-sm capitalize text-muted-foreground">
                {entry.trade_category.replace(/_/g, ' ')} · signed by {entry.mentor_name} on{' '}
                {new Date(entry.signed_at).toLocaleDateString()}
              </p>
            </Card>
          </li>
        ))}
      </ul>
    </>
  );
}
