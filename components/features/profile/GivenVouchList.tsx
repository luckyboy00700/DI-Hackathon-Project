import { Card } from '@/components/ui/card';

export type GivenVouch = {
  id: string;
  subjectName: string;
  subjectType: 'apprentice' | 'business';
  createdAt: string;
};

/** The organization's own view of its vouches: who was vouched for, not who's vouching. */
export function GivenVouchList({ vouches }: { vouches: GivenVouch[] }) {
  if (vouches.length === 0) {
    return (
      <Card>
        <p className="text-base text-muted-foreground">You have not vouched for anyone yet.</p>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold">Vouches you have given</h2>
      <ul className="flex flex-col gap-2">
        {vouches.map((vouch) => (
          <li key={vouch.id} className="flex flex-wrap items-baseline gap-2">
            <span className="text-base font-medium">{vouch.subjectName}</span>
            <span className="text-sm text-muted-foreground">
              ({vouch.subjectType}) — vouched on {new Date(vouch.createdAt).toLocaleDateString()}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
