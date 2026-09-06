import Link from 'next/link';

type DashboardHref = '/dashboard' | '/dashboard/business' | '/dashboard/masjid';
type DashboardLink = { href: DashboardHref; label: string };

/** Shown when a signed-in account opens a dashboard meant for a different role. */
export function WrongRoleNotice({
  roleLabel,
  otherDashboards,
}: {
  roleLabel: string;
  otherDashboards: DashboardLink[];
}) {
  return (
    <>
      <h1 className="text-2xl font-semibold">Your dashboard</h1>
      <p className="text-base text-muted-foreground">
        This dashboard is for {roleLabel}. Everyone else has their own:{' '}
        {otherDashboards.map((link, index) => (
          <span key={link.href}>
            {index > 0 ? ' and ' : ''}
            <Link href={link.href} className="font-medium text-primary underline">
              {link.label}
            </Link>
          </span>
        ))}
        .
      </p>
    </>
  );
}
