'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Field, Select } from '@/components/ui/field';
import type { MasjidOption } from '@/app/(public)/search/actions';
import { useMasjidOptions } from './useMasjidOptions';

/**
 * Lets a visitor subset the board to placements from businesses that a specific local masjid
 * (or other community hub) has verified, before they even open the full search filters.
 */
export function MasjidPicker({ hasSession }: { hasSession: boolean }) {
  const { options, loaded } = useMasjidOptions(hasSession);

  if (!hasSession) {
    return (
      <p className="text-base text-muted-foreground">
        <a href="/signin" className="font-medium text-primary underline">
          Sign in
        </a>{' '}
        to see local masjids and browse the apprenticeships they vouch for.
      </p>
    );
  }

  if (!loaded) {
    return <p className="text-base text-muted-foreground">Loading nearby masjids…</p>;
  }

  if (options.length === 0) {
    return (
      <p className="text-base text-muted-foreground">
        No local masjid has verified a business here yet.
      </p>
    );
  }

  return <MasjidPickerForm options={options} />;
}

function MasjidPickerForm({ options }: { options: MasjidOption[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState('');

  return (
    <div className="flex flex-col gap-3">
      <Field
        label="Local masjid"
        htmlFor="landing-masjid"
        hint="Only businesses that masjid has verified will show up."
      >
        <Select id="landing-masjid" value={selected} onChange={(e) => setSelected(e.target.value)}>
          <option value="">Choose a masjid</option>
          {options.map((option) => (
            <option key={option.organizationId} value={option.organizationId}>
              {option.displayName}
              {option.distanceKm !== null ? ` — ${option.distanceKm} km` : ''}
            </option>
          ))}
        </Select>
      </Field>
      <Button
        variant="secondary"
        className="w-full"
        disabled={selected === ''}
        onClick={() => router.push(`/browse?masjid=${selected}`)}
      >
        Browse their apprenticeships
      </Button>
    </div>
  );
}
