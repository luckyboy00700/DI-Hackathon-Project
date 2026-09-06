import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Logo } from '@/components/ui/logo';
import { MasjidPicker } from '@/components/features/search/MasjidPicker';
import { getSessionUser } from '@/lib/auth/session';

export default async function LandingPage() {
  const user = await getSessionUser();

  return (
    <>
      <div className="flex flex-col items-start gap-3 py-2">
        <Logo size="lg" />
        <h1 className="text-2xl font-semibold text-foreground">Amanah Apprenticeship Board</h1>
      </div>
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
        <h2 className="text-lg font-semibold">Go through a local masjid</h2>
        <p className="text-base text-muted-foreground">
          Some businesses are verified through a masjid or community hub. Pick one to see only
          the apprenticeships and internships that come through them.
        </p>
        <MasjidPicker hasSession={user !== null} />
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

      <RunAMasjidCard />
    </>
  );
}

function RunAMasjidCard() {
  return (
    <Card className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Running a masjid or community hub?</h2>
      <p className="text-base text-muted-foreground">
        Verify your organization and submit a certification so members can find your
        apprenticeships and your vouching carries weight on the board.
      </p>
      <Link href="/verification">
        <Button variant="secondary" className="w-full">
          Verify your organization
        </Button>
      </Link>
    </Card>
  );
}
