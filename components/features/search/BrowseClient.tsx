'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge, Card } from '@/components/ui/card';
import { Field, Select } from '@/components/ui/field';
import { ErrorState, LoadingState } from '@/components/features/states';
import { SearchEmptyState } from './EmptyState';
import { useMasjidOptions } from './useMasjidOptions';
import {
  searchPlacements,
  type MasjidOption,
  type SearchResultRow,
} from '@/app/(public)/search/actions';

const TRADES = [
  'electrical', 'plumbing', 'carpentry', 'hvac', 'welding', 'masonry',
  'automotive', 'landscaping', 'print_design', 'photography', 'videography', 'upholstery',
];

const label = (value: string) => value.replace(/_/g, ' ');

type State =
  | { phase: 'idle' }
  | { phase: 'done'; rows: SearchResultRow[]; total: number }
  | { phase: 'error'; message: string };

export function BrowseClient() {
  const initialMasjid = useSearchParams().get('masjid') ?? '';
  const ranInitialSearch = useRef(false);

  const [radiusKm, setRadiusKm] = useState(25);
  const [trade, setTrade] = useState('');
  const [organizationId, setOrganizationId] = useState(initialMasjid);
  const { options: masjidOptions } = useMasjidOptions(true);
  const [state, setState] = useState<State>({ phase: 'idle' });
  const [pending, startTransition] = useTransition();

  function run(nextRadius = radiusKm, nextOrganizationId = organizationId) {
    setRadiusKm(nextRadius);
    setOrganizationId(nextOrganizationId);
    startTransition(async () => {
      const result = await searchPlacements({
        distanceKm: nextRadius,
        tradeCategory: trade === '' ? undefined : trade,
        organizationId: nextOrganizationId === '' ? undefined : nextOrganizationId,
        page: 1,
      });
      setState(
        result.ok
          ? { phase: 'done', rows: result.results, total: result.totalCount }
          : { phase: 'error', message: result.message },
      );
    });
  }

  useEffect(() => {
    if (initialMasjid && !ranInitialSearch.current) {
      ranInitialSearch.current = true;
      run(radiusKm, initialMasjid);
    }
  });

  return (
    <div className="flex flex-col gap-4">
      <Filters
        radiusKm={radiusKm}
        trade={trade}
        organizationId={organizationId}
        masjidOptions={masjidOptions}
        pending={pending}
        onRadiusChange={setRadiusKm}
        onTradeChange={setTrade}
        onOrganizationChange={setOrganizationId}
        onSearch={() => run()}
      />
      <Results state={state} pending={pending} radiusKm={radiusKm} onWidenRadius={run} />
    </div>
  );
}

function Filters(props: {
  radiusKm: number;
  trade: string;
  organizationId: string;
  masjidOptions: MasjidOption[];
  pending: boolean;
  onRadiusChange: (km: number) => void;
  onTradeChange: (trade: string) => void;
  onOrganizationChange: (organizationId: string) => void;
  onSearch: () => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <RadiusField value={props.radiusKm} onChange={props.onRadiusChange} />
      <TradeField value={props.trade} onChange={props.onTradeChange} />
      <MasjidField
        value={props.organizationId}
        options={props.masjidOptions}
        onChange={props.onOrganizationChange}
      />
      <Button onClick={props.onSearch} disabled={props.pending}>
        {props.pending ? 'Searching…' : 'Search placements'}
      </Button>
    </div>
  );
}

function RadiusField({ value, onChange }: { value: number; onChange: (km: number) => void }) {
  return (
    <Field label="Distance from you" htmlFor="radius">
      <Select id="radius" value={value} onChange={(e) => onChange(Number(e.target.value))}>
        {[5, 10, 25, 50, 100].map((km) => (
          <option key={km} value={km}>
            Within {km} km
          </option>
        ))}
      </Select>
    </Field>
  );
}

function TradeField({ value, onChange }: { value: string; onChange: (trade: string) => void }) {
  return (
    <Field label="Trade" htmlFor="trade" hint="Leave as any to see everything nearby.">
      <Select id="trade" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Any trade</option>
        {TRADES.map((t) => (
          <option key={t} value={t}>
            {label(t)}
          </option>
        ))}
      </Select>
    </Field>
  );
}

function MasjidField(props: {
  value: string;
  options: MasjidOption[];
  onChange: (organizationId: string) => void;
}) {
  return (
    <Field
      label="Local masjid"
      htmlFor="masjid"
      hint="Subset to placements from businesses that masjid has verified."
    >
      <Select id="masjid" value={props.value} onChange={(e) => props.onChange(e.target.value)}>
        <option value="">All masjids</option>
        {props.options.map((option) => (
          <option key={option.organizationId} value={option.organizationId}>
            {option.displayName}
            {option.distanceKm !== null ? ` — ${option.distanceKm} km` : ''}
          </option>
        ))}
      </Select>
    </Field>
  );
}

function Results(props: {
  state: State;
  pending: boolean;
  radiusKm: number;
  onWidenRadius: (km: number) => void;
}) {
  if (props.pending) return <LoadingState label="Finding placements near you…" />;
  if (props.state.phase === 'error') {
    return <ErrorState title="We could not run that search" whatToDo={props.state.message} />;
  }
  if (props.state.phase !== 'done') return null;
  if (props.state.rows.length === 0) {
    return (
      <SearchEmptyState
        currentRadiusKm={props.radiusKm}
        onWidenRadius={props.onWidenRadius}
        onSaveAlert={() => undefined}
      />
    );
  }
  return <ResultList rows={props.state.rows} total={props.state.total} />;
}

function ResultList({ rows, total }: { rows: SearchResultRow[]; total: number }) {
  return (
    <section aria-label="Search results" className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        {total} placement{total === 1 ? '' : 's'} found, nearest first.
      </p>
      {rows.map((row) => (
        <Card key={row.placementId} className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-semibold capitalize">{label(row.tradeCategory)}</h3>
            <Badge>{row.distanceKm} km away</Badge>
          </div>
          <p className="text-base text-muted-foreground">{row.businessName}</p>
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <dt className="text-muted-foreground">Pay</dt>
              <dd className="font-medium">${row.hourlyRate.toFixed(2)}/hour</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Schedule</dt>
              <dd className="font-medium">
                {row.weeklyHours} hrs/week for {row.durationWeeks} weeks
              </dd>
            </div>
            <div className="col-span-2">
              <dt className="text-muted-foreground">Starts</dt>
              <dd className="font-medium">{row.startWindowStart}</dd>
            </div>
          </dl>
        </Card>
      ))}
    </section>
  );
}
