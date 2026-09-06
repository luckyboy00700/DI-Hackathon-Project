import { Badge, Card } from '@/components/ui/card';
import { EmptyState } from '@/components/features/states';

export type ApprenticeDocumentRow = {
  id: string;
  documentType: string;
  note: string | null;
  uploadedAt: string;
};

const label = (value: string) => value.replace(/_/g, ' ');

export function ApprenticeDocumentList({ rows }: { rows: ApprenticeDocumentRow[] }) {
  if (rows.length === 0) {
    return (
      <EmptyState
        title="No documents yet"
        description="Liability waivers and volunteer hour logs you add will appear here."
      />
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {rows.map((row) => (
        <li key={row.id}>
          <Card className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge>{label(row.documentType)}</Badge>
              <span className="text-sm text-muted-foreground">
                Added {new Date(row.uploadedAt).toLocaleDateString()}
              </span>
            </div>
            {row.note ? <p className="text-base text-muted-foreground">{row.note}</p> : null}
          </Card>
        </li>
      ))}
    </ul>
  );
}
