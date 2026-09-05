'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { ErrorState, SuccessState } from '@/components/features/states';
import { createPlacement } from '@/app/(business)/placements/actions';
import {
  HazardField,
  ScheduleAndPayFields,
  TradeAndDescriptionFields,
} from './PlacementFields';

type Outcome =
  | { kind: 'idle' }
  | { kind: 'draft'; reason: string }
  | { kind: 'published' }
  | { kind: 'error'; message: string };

function readForm(formData: FormData) {
  return {
    tradeCategory: formData.get('tradeCategory'),
    description: formData.get('description'),
    postalCode: formData.get('postalCode'),
    region: formData.get('region'),
    durationWeeks: Number(formData.get('durationWeeks')),
    weeklyHours: Number(formData.get('weeklyHours')),
    hourlyRate: Number(formData.get('hourlyRate')),
    capacity: Number(formData.get('capacity')),
    startWindowStart: formData.get('startWindowStart'),
    startWindowEnd: formData.get('startWindowEnd'),
    requiredCertifications: [],
    ageRestrictionCategory: formData.get('ageRestrictionCategory'),
  };
}

export function PlacementForm() {
  const [outcome, setOutcome] = useState<Outcome>({ kind: 'idle' });
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await createPlacement(readForm(formData));
      if (!result.ok) {
        setOutcome({ kind: 'error', message: result.message });
        return;
      }
      setOutcome(
        result.status === 'open'
          ? { kind: 'published' }
          : { kind: 'draft', reason: result.draftReason ?? 'This placement was saved as a draft.' },
      );
    });
  }

  return (
    <form action={onSubmit} className="flex flex-col gap-4">
      <FormOutcome outcome={outcome} />
      <TradeAndDescriptionFields />
      <ScheduleAndPayFields />
      <HazardField />
      <Button type="submit" disabled={pending}>
        {pending ? 'Saving…' : 'Save placement'}
      </Button>
    </form>
  );
}

function FormOutcome({ outcome }: { outcome: Outcome }) {
  if (outcome.kind === 'error') {
    return <ErrorState title="This placement was not saved" whatToDo={outcome.message} />;
  }
  if (outcome.kind === 'draft') {
    return <ErrorState title="Saved as a draft, not published" whatToDo={outcome.reason} />;
  }
  if (outcome.kind === 'published') {
    return (
      <SuccessState
        title="Placement published"
        detail="Apprentices within range can now find this placement in search."
      />
    );
  }
  return null;
}
