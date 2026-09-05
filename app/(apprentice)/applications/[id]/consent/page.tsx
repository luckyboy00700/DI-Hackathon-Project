import { ConsentUpload } from '@/components/features/applications/ConsentUpload';

export const metadata = { title: 'Guardian consent — Amanah' };

export default async function ConsentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <>
      <h1 className="text-2xl font-semibold">Guardian consent</h1>
      <p className="text-base text-muted-foreground">
        Because you are under 18, a parent or guardian must sign a consent form before a mentor can
        accept you. Upload the signed form here.
      </p>
      <ConsentUpload applicationId={id} />
    </>
  );
}
