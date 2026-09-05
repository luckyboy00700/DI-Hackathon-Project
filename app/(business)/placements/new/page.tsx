import Link from 'next/link';
import { PlacementForm } from '@/components/features/placements/PlacementForm';

export const metadata = { title: 'Publish a placement — Amanah' };

export default function NewPlacementPage() {
  return (
    <>
      <Link href="/placements" className="text-sm underline">
        Back to placements
      </Link>
      <h1 className="text-2xl font-semibold">Publish a placement</h1>
      <p className="text-base text-muted-foreground">
        Placements go live once your business is verified and the rate meets the legal minimum for
        the region.
      </p>
      <PlacementForm />
    </>
  );
}
