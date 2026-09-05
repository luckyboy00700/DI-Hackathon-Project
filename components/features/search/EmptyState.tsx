'use client';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/features/states';

/**
 * T037 — spec edge case: a zero-result search must offer a way forward, never a dead end.
 */
export function SearchEmptyState({
  currentRadiusKm,
  onWidenRadius,
  onSaveAlert,
}: {
  currentRadiusKm: number;
  onWidenRadius: (km: number) => void;
  onSaveAlert: () => void;
}) {
  const widened = Math.min(currentRadiusKm * 2, 500);

  return (
    <EmptyState
      title="No placements match this search yet"
      description={`Nothing within ${currentRadiusKm} km fits these filters. New placements are posted through the spring, so it is worth widening the area or asking us to watch for you.`}
      action={
        <div className="flex w-full flex-col gap-2 sm:flex-row">
          <Button onClick={() => onWidenRadius(widened)} className="w-full sm:w-auto">
            Search within {widened} km instead
          </Button>
          <Button variant="secondary" onClick={onSaveAlert} className="w-full sm:w-auto">
            Tell me when something opens
          </Button>
        </div>
      }
    />
  );
}
