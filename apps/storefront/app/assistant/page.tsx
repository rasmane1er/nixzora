import { type Metadata } from 'next';
import { getT } from '@/lib/i18n';
import { AssistantChat } from './AssistantChat';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT('assistant');
  return { title: t('metaTitle'), description: t('metaDescription') };
}

export default async function AssistantPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const { q } = await searchParams;
  const initial = typeof q === 'string' ? q.trim().slice(0, 1_000) : '';
  const t = await getT('assistant');
  const examples = [t('example1'), t('example2'), t('example3'), t('example4')];
  return (
    <div className="wrap section">
      <div className="assistant-head">
        <p className="eyebrow">{t('eyebrow')}</p>
        <h1>{t('title')}</h1>
        <p className="muted">{t('lead')}</p>
      </div>
      <AssistantChat initialQuery={initial} examples={examples} />
    </div>
  );
}
