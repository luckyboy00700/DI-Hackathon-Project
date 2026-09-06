import { Suspense } from 'react';
import { BrowseClient } from '@/components/features/search/BrowseClient';

export const metadata = { title: 'Browse placements — Amanah' };

export default function BrowsePage() {
  return (
    <>
      <h1 className="text-2xl font-semibold">Find an apprenticeship</h1>
      <p className="text-base text-muted-foreground">
        Only verified businesses appear here, and placements you are not old enough for are never
        shown.
      </p>
      <Suspense>
        <BrowseClient />
      </Suspense>
    </>
  );
}
