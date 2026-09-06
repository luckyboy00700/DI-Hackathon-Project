import { cn } from '@/lib/utils';

type LogoProps = { size?: 'sm' | 'lg'; className?: string };

const sizes = {
  sm: { padding: 'px-3 py-1', text: 'text-lg', border: 'border-2' },
  lg: { padding: 'px-6 py-3', text: 'text-4xl sm:text-5xl', border: 'border-4' },
};

/** The Amanah wordmark: coral chip with a navy outline, navy display type, a diamond flourish
 * at each corner — the brand's one fixed combination. */
export function Logo({ size = 'sm', className }: LogoProps) {
  const s = sizes[size];

  return (
    <span
      className={cn(
        'relative inline-flex items-center rounded-2xl border-background bg-primary shadow-lg',
        s.border,
        s.padding,
        className,
      )}
    >
      <span
        className={cn(
          'font-[family-name:var(--font-display)] font-black italic tracking-tight text-primary-foreground',
          s.text,
        )}
      >
        Amanah
      </span>
      {size === 'lg' ? (
        <>
          <Diamond className="top-[-6%] left-[57%] h-5 w-5" />
          <Diamond className="top-[10%] left-[68%] h-3.5 w-3.5" />
          <Diamond className="top-[72%] left-[10%] h-5 w-5" />
          <Diamond className="top-[92%] left-[21%] h-3.5 w-3.5" />
        </>
      ) : null}
    </span>
  );
}

function Diamond({ className }: { className: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'absolute -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[3px] bg-white shadow-sm',
        className,
      )}
    />
  );
}
