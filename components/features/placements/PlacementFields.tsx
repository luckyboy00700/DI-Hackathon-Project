'use client';

import { Field, Input, Select, Textarea } from '@/components/ui/field';

export const TRADES = [
  'electrical', 'plumbing', 'carpentry', 'hvac', 'welding', 'masonry',
  'automotive', 'landscaping', 'print_design', 'photography', 'videography', 'upholstery',
];

export const HAZARDS = [
  { value: 'none', label: 'No special hazard — open to under-18 apprentices' },
  { value: 'heavy_equipment', label: 'Heavy equipment (18+ only)' },
  { value: 'high_voltage', label: 'High voltage (18+ only)' },
  { value: 'confined_space', label: 'Confined space (18+ only)' },
  { value: 'other_hazardous', label: 'Other hazardous work (18+ only)' },
];

export const REGIONS = ['US-MI', 'US-OH', 'US-IL', 'US-IN', 'US-NY', 'US-TX'];

export function TradeAndDescriptionFields() {
  return (
    <>
      <Field label="Trade" htmlFor="tradeCategory">
        <Select id="tradeCategory" name="tradeCategory" required defaultValue="electrical">
          {TRADES.map((t) => (
            <option key={t} value={t}>
              {t.replace(/_/g, ' ')}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="What the apprentice will do" htmlFor="description" hint="At least 20 characters.">
        <Textarea id="description" name="description" required minLength={20} maxLength={2000} />
      </Field>
    </>
  );
}

export function ScheduleAndPayFields() {
  return (
    <div className="grid grid-cols-2 gap-3">
      <Field label="Postal code" htmlFor="postalCode">
        <Input id="postalCode" name="postalCode" required defaultValue="48201" />
      </Field>
      <Field label="Region" htmlFor="region" hint="Sets the legal wage floor.">
        <Select id="region" name="region" required defaultValue="US-MI">
          {REGIONS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Weeks" htmlFor="durationWeeks">
        <Input id="durationWeeks" name="durationWeeks" type="number" min={1} max={52} required defaultValue={10} />
      </Field>
      <Field label="Hours per week" htmlFor="weeklyHours">
        <Input id="weeklyHours" name="weeklyHours" type="number" min={1} max={40} required defaultValue={20} />
      </Field>
      <Field label="Hourly rate (USD)" htmlFor="hourlyRate">
        <Input id="hourlyRate" name="hourlyRate" type="number" step="0.25" min={0} required defaultValue={18} />
      </Field>
      <Field label="How many apprentices" htmlFor="capacity">
        <Input id="capacity" name="capacity" type="number" min={1} max={50} required defaultValue={1} />
      </Field>
      <Field label="Earliest start" htmlFor="startWindowStart">
        <Input id="startWindowStart" name="startWindowStart" type="date" required defaultValue="2026-06-15" />
      </Field>
      <Field label="Latest start" htmlFor="startWindowEnd">
        <Input id="startWindowEnd" name="startWindowEnd" type="date" required defaultValue="2026-06-30" />
      </Field>
    </div>
  );
}

export function HazardField() {
  return (
    <Field
      label="Hazard classification"
      htmlFor="ageRestrictionCategory"
      hint="Anything other than 'no special hazard' hides this placement from under-18 applicants."
    >
      <Select id="ageRestrictionCategory" name="ageRestrictionCategory" required defaultValue="none">
        {HAZARDS.map((h) => (
          <option key={h.value} value={h.value}>
            {h.label}
          </option>
        ))}
      </Select>
    </Field>
  );
}
