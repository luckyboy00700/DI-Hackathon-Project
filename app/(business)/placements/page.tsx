import Link from 'next/link';
import { getServerClient } from '@/lib/db/client';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth/session';
import { Button } from '@/components/ui/button';
import { Badge, Card } from '@/components/ui/card';
import { EmptyState, ErrorState } from '@/components/features/states';
import { ERROR_MESSAGES } from '@/lib/errors';

export const metadata = { title: 'Your placements — Amanah' };

type PlacementRow = {
  id: string;
  trade_category: string;
  status: 'draft' | 'open' | 'withdrawn' | 'filled';
  hourly_rate: number;
  capacity: number;
  start_window_start: string;
};

export default async function PlacementsPage() {
  const user = await getSessionUser();
  if (!user) redirect('/signin');

  const supabase = await getServerClient();
  const [{ data: business }, { data: placements }] = await Promise.all([
    supabase.from('businesses').select('verification_status').eq('profile_id', user.id).maybeSingle(),
    supabase
      .from('placements')
      .select('id, trade_category, status, hourly_rate, capacity, start_window_start')
      .eq('business_id', user.id)
      .order('created_at', { ascending: false }),
  ]);

  const verified = business?.verification_status === 'verified';
  const rows = (placements ?? []) as PlacementRow[];

  return (
    <>
      <h1 className="text-2xl font-semibold">Your placements</h1>

      {!verified ? (
        <ErrorState
          title="Your business is not verified yet"
          whatToDo={ERROR_MESSAGES.BUSINESS_NOT_VERIFIED}
        />
      ) : null}

      <Link href="/placements/new">
        <Button className="w-full sm:w-auto">Publish a placement</Button>
      </Link>

      {rows.length === 0 ? (
        <EmptyState
          title="No placements yet"
          description="Once you publish a placement, apprentices nearby can find and apply to it."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((row) => (
            <li key={row.id}>
              <PlacementCard row={row} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function PlacementCard({ row }: { row: PlacementRow }) {
  return (
    <Card className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold capitalize">{row.trade_category.replace(/_/g, ' ')}</h2>
        <StatusBadge status={row.status} />
      </div>
      <p className="text-sm text-muted-foreground">
        ${Number(row.hourly_rate).toFixed(2)}/hour · {row.capacity} place
        {row.capacity === 1 ? '' : 's'} · starts {row.start_window_start}
      </p>
      {row.status === 'draft' ? (
        <p className="text-sm text-warning">
          This is a draft. It is not visible to apprentices until your business is verified.
        </p>
      ) : null}
    </Card>
  );
}

function StatusBadge({ status }: { status: PlacementRow['status'] }) {
  if (status === 'open') return <Badge tone="success">Live in search</Badge>;
  if (status === 'draft') return <Badge tone="warning">Draft</Badge>;
  if (status === 'withdrawn') return <Badge tone="danger">Withdrawn</Badge>;
  return <Badge>Filled</Badge>;
}
