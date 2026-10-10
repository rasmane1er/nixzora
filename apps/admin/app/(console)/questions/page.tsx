import { type QuestionWithProduct } from '@nixzora/validation';
import type { Metadata } from 'next';
import { ActionButton, Banner, Empty, PageHeader } from '@/components/ui';
import { load } from '@/lib/api';
import { param, type SearchParams } from '@/lib/format';
import { getFormat, getT } from '@/lib/i18n';
import { hideAnswer, hideQuestion } from './actions';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT('ops');
  return { title: t('nav_questions') };
}

/** Product questions and answers (p10-05): they go live at once; staff hide what breaks the rules. */
export default async function QuestionsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const [questions, c, f] = await Promise.all([
    load<QuestionWithProduct[]>('/admin/questions'),
    getT('community'),
    getFormat(),
  ]);
  return (
    <>
      <PageHeader title={c('opsQuestionsTitle')} />
      <Banner notice={param(params, 'notice')} error={param(params, 'error')} />
      <section className="card">
        {questions.length === 0 ? (
          <Empty>{c('noOpsQuestions')}</Empty>
        ) : (
          <ul
            className="plain-list"
            style={{ display: 'grid', gap: 16, listStyle: 'none', padding: 0 }}
          >
            {questions.map((q) => (
              <li key={q.id} style={{ borderBottom: '1px solid var(--line)', paddingBottom: 12 }}>
                <div className="muted">{q.product.title}</div>
                <p style={{ margin: '4px 0' }}>
                  <strong>Q:</strong> {q.body}{' '}
                  {q.status === 'HIDDEN' ? <span className="pill">{c('hidden')}</span> : null}
                </p>
                <div className="muted" style={{ fontSize: 13 }}>
                  {q.author} · {f.date(q.createdAt)}
                </div>
                {q.status !== 'HIDDEN' ? (
                  <ActionButton
                    action={hideQuestion}
                    label={c('hide')}
                    fields={{ id: q.id }}
                    tone="danger"
                  />
                ) : null}
                {q.answers.map((a) => (
                  <div key={a.id} style={{ marginLeft: 16, marginTop: 8 }}>
                    <p style={{ margin: 0 }}>
                      <strong>A ({c(`role_${a.role}`)}):</strong> {a.body}
                    </p>
                    <ActionButton
                      action={hideAnswer}
                      label={c('hide')}
                      fields={{ id: a.id }}
                      tone="danger"
                    />
                  </div>
                ))}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
