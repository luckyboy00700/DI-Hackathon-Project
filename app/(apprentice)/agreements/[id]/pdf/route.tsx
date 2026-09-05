import { renderToBuffer } from '@react-pdf/renderer';
import { getServerClient } from '@/lib/db/client';
import { AgreementDocument } from '@/lib/pdf/AgreementDocument';
import type { AgreementRecord } from '@/components/features/agreements/AgreementView';

export const runtime = 'nodejs';

type Supabase = Awaited<ReturnType<typeof getServerClient>>;

async function displayName(supabase: Supabase, id: string | null): Promise<string> {
  if (!id) return 'Unknown';
  const { data } = await supabase.from('profiles').select('display_name').eq('id', id).maybeSingle();
  return (data?.display_name as string) ?? 'Unknown';
}

/**
 * T062 — downloadable agreement. The row is fetched through the caller's own session, so RLS
 * (0012) is what decides whether this 200s or 404s: a stranger with the id gets nothing.
 *
 * Party names are resolved with separate reads rather than embedded joins: placements.business_id
 * points at businesses, not profiles, so there is no profiles relationship to embed from here.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await getServerClient();

  const { data: agreement } = await supabase
    .from('agreements')
    .select(
      `application_id, duration_weeks, weekly_hours, hourly_rate, total_estimated_hours,
       estimated_gross_pay, mentorship_milestones, safety_obligations, termination_terms,
       generated_at`,
    )
    .eq('id', id)
    .maybeSingle();

  if (!agreement) {
    return new Response('This agreement is not available to you.', { status: 404 });
  }

  const { data: application } = await supabase
    .from('applications')
    .select('apprentice_id, placement_id')
    .eq('id', agreement.application_id as string)
    .maybeSingle();

  const { data: placement } = application
    ? await supabase
        .from('placements')
        .select('trade_category, business_id')
        .eq('id', application.placement_id as string)
        .maybeSingle()
    : { data: null };

  const [apprenticeName, businessName] = await Promise.all([
    displayName(supabase, (application?.apprentice_id as string) ?? null),
    displayName(supabase, (placement?.business_id as string) ?? null),
  ]);

  const buffer = await renderToBuffer(
    AgreementDocument({
      agreement: agreement as unknown as AgreementRecord,
      apprenticeName,
      businessName,
      tradeCategory: (placement?.trade_category as string) ?? '',
    }),
  );

  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="apprenticeship-agreement-${id}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
