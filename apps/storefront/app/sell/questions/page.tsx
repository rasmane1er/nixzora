import { type QuestionWithProduct } from '@nixzora/validation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Notices, SellerNav } from '@/components/SellerNav';
import { api } from '@/lib/api';
import { getFormat, getT } from '@/lib/i18n';
import { param, type SearchParams } from '@/lib/params';
import { requireSeller } from '@/lib/sell';
import { answerFromPortal } from './actions';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT('community');
  return { title: t('sellerQuestionsTitle'), robots: { index: false } };
}

/** Shoppers' questions about the store's products that it has not answered (p10-05). */
export default async function SellerQuestionsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const seller = await requireSeller('/sell/questions');
  const [questions, c, f] = await Promise.all([
    api<QuestionWithProduct[]>('/seller/questions').catch((): QuestionWithProduct[] => []),
    getT('community'),
    getFormat(),
  ]);
  return (
    <div className="wrap section stack" style={{ gap: 20 }}>
      <SellerNav seller={seller} current="/sell/questions" />
      <Notices notice={param(params, 'notice')} error={param(params, 'error')} />
      <section className="stack" style={{ gap: 6 }}>
        <h2>{c('sellerQuestionsTitle')}</h2>
        <p className="muted" style={{ maxWidth: '70ch' }}>
          {c('sellerQuestionsLead')}
        </p>
      </section>
      {questions.length === 0 ? (
        <p className="card muted">{c('noSellerQuestions')}</p>
      ) : (
        <ul className="qa-list">
          {questions.map((q) => (
            <li key={q.id} className="card qa-item">
              <Link href={`/p/${q.product.slug}#questions`} className="muted">
                {q.product.title}
              </Link>
              <p className="qa-q">
                <strong>Q:</strong> {q.body}
              </p>
              <span className="muted qa-meta">
                {c('askedBy', { author: q.author, date: f.date(q.createdAt) })}
              </span>
              {q.answers.map((a) => (
                <div key={a.id} className="qa-a">
                  <p>
                    <strong>A:</strong> {a.body}
                  </p>
                  <span className="muted qa-meta">{c(`role_${a.role}`)}</span>
                </div>
              ))}
              <form action={answerFromPortal} className="form qa-answer">
                <input type="hidden" name="id" value={q.id} />
                <label className="sr-only" htmlFor={`answer-${q.id}`}>
                  {c('answerButton')}
                </label>
                <textarea
                  id={`answer-${q.id}`}
                  name="body"
                  rows={2}
                  minLength={2}
                  maxLength={1000}
                  required
                  placeholder={c('answerPlaceholder')}
                />
                <div>
                  <button className="btn btn--primary btn--sm" type="submit">
                    {c('postAnswer')}
                  </button>
                </div>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
