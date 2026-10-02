import { type Metadata } from 'next';
import { AssistantChat } from './AssistantChat';

export const metadata: Metadata = {
  title: 'Shopping assistant',
  description: 'Describe what you need in your own words and get a compared shortlist.',
};

const EXAMPLES = [
  'A quiet laptop for coding under $1,500',
  'Headphones for long flights, under $250',
  'A big monitor for spreadsheets',
  'A gift for someone who runs every morning',
];

export default async function AssistantPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const { q } = await searchParams;
  const initial = typeof q === 'string' ? q.trim().slice(0, 1_000) : '';
  return (
    <div className="wrap section">
      <div className="assistant-head">
        <p className="eyebrow">Shopping assistant</p>
        <h1>Tell us what you need</h1>
        <p className="muted">
          Describe it in your own words: budget, what it is for, what matters to you. Every product
          and price comes from our live catalog.
        </p>
      </div>
      <AssistantChat initialQuery={initial} examples={EXAMPLES} />
    </div>
  );
}
