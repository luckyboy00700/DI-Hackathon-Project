import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default function LandingPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold text-foreground">Amanah Apprenticeship Board</h1>
      <p className="text-base text-muted-foreground">
        Paid summer apprenticeships with verified trade and creative-studio mentors in your
        neighbourhood.
      </p>

      <Card className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Looking for an apprenticeship</h2>
        <p className="text-base text-muted-foreground">
          Search placements near you by trade, schedule, and distance.
        </p>
        <Link href="/browse">
          <Button className="w-full">Browse placements</Button>
        </Link>
      </Card>

      <Card className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Offering an apprenticeship</h2>
        <p className="text-base text-muted-foreground">
          Verified businesses can publish a placement and review applicants.
        </p>
        <Link href="/placements">
          <Button variant="secondary" className="w-full">
            Manage placements
          </Button>
        </Link>
      </Card>
    </>
  );
}
