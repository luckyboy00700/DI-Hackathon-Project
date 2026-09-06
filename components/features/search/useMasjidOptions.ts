import { useEffect, useState } from 'react';
import { listMasjidOptions, type MasjidOption } from '@/app/(public)/search/actions';

/** Shared fetch for the masjid picker on the landing page and the filter on the browse page. */
export function useMasjidOptions(enabled: boolean) {
  const [options, setOptions] = useState<MasjidOption[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setLoaded(true);
      return;
    }
    listMasjidOptions().then((result) => {
      if (result.ok) setOptions(result.options);
      setLoaded(true);
    });
  }, [enabled]);

  return { options, loaded };
}
