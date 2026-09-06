import Image from 'next/image';
import { cn } from '@/lib/utils';

type LogoProps = { size?: 'sm' | 'lg'; className?: string };

const sizes = {
  sm: 'h-10 w-auto',
  lg: 'h-24 w-auto sm:h-28',
};

/** The official Amanah brand mark. */
export function Logo({ size = 'sm', className }: LogoProps) {
  return (
    <Image
      src="/logo.png"
      alt="Amanah"
      width={441}
      height={201}
      priority={size === 'lg'}
      className={cn(sizes[size], className)}
    />
  );
}
