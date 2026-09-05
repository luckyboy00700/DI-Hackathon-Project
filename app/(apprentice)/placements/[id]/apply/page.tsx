import { ApplyForm } from '@/components/features/applications/ApplyForm';

export const metadata = { title: 'Apply — Amanah' };

export default async function ApplyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <>
      <h1 className="text-2xl font-semibold">Apply for this placement</h1>
      <p className="text-base text-muted-foreground">
        Your contact details are not shared with the business unless they accept you.
      </p>
      <ApplyForm placementId={id} />
    </>
  );
}
