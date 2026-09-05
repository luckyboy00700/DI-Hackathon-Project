import { Card } from '@/components/ui/card';

export type EndorsementReference = {
  id: string;
  organizationName: string;
  createdAt: string;
};

/**
 * T079 / FR-005 — endorsements render as a NAMED ORGANIZATIONAL REFERENCE and nothing more.
 * There is no character commentary to show here because the schema has nowhere to store any.
 */
export function EndorsementList({
  endorsements,
  subjectLabel,
}: {
  endorsements: EndorsementReference[];
  subjectLabel: string;
}) {
  if (endorsements.length === 0) {
    return (
      <Card>
        <p className="text-base text-muted-foreground">
          No community references yet for {subjectLabel}.
        </p>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold">Community references</h2>
      <p className="text-sm text-muted-foreground">
        These organizations vouch for {subjectLabel}. A reference records who vouched and when —
        not an opinion about the person.
      </p>
      <ul className="flex flex-col gap-2">
        {endorsements.map((endorsement) => (
          <li key={endorsement.id} className="flex flex-wrap items-baseline gap-2">
            <span className="text-base font-medium">{endorsement.organizationName}</span>
            <span className="text-sm text-muted-foreground">
              vouched on {new Date(endorsement.createdAt).toLocaleDateString()}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
