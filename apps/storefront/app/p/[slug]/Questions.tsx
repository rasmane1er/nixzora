'use client';

import { type QuestionPage, type QuestionView } from '@nixzora/validation';
import { useState, useTransition } from 'react';
import { useFormat, useT } from '@/components/I18nProvider';
import { answerQuestion, askQuestion, loadQuestions } from './actions';

/**
 * Questions and answers on a product page (p10-05): search them, ask one (signed in), and
 * answer when you bought it, sell it or work at NIXZORA.
 */
export function Questions({
  slug,
  initial,
  signedIn,
}: {
  slug: string;
  initial: QuestionPage;
  signedIn: boolean;
}) {
  const c = useT('community');
  const f = useFormat();
  const [page, setPage] = useState(initial);
  const [questions, setQuestions] = useState<QuestionView[]>(initial.questions);
  const [search, setSearch] = useState('');
  const [asking, setAsking] = useState('');
  const [notice, setNotice] = useState<{ ok?: string; error?: string }>({});
  const [pending, start] = useTransition();

  const reload = (q: string, number = 1) =>
    start(async () => {
      const next = await loadQuestions(slug, { page: number, q });
      if (!next) return;
      setPage(next);
      setQuestions((current) => (number === 1 ? next.questions : [...current, ...next.questions]));
    });

  const replace = (updated: QuestionView) =>
    setQuestions((current) => current.map((q) => (q.id === updated.id ? updated : q)));

  return (
    <section className="section stack qa" aria-labelledby="qa-title" id="questions">
      <div className="section-head">
        <h2 id="qa-title">{c('qaTitle')}</h2>
        {initial.total ? (
          <span className="muted">{c('questionsCount', { count: initial.total })}</span>
        ) : null}
      </div>

      {initial.total > 3 ? (
        <form
          role="search"
          className="qa-search"
          onSubmit={(event) => {
            event.preventDefault();
            reload(search);
          }}
        >
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={c('qaSearch')}
            aria-label={c('qaSearch')}
          />
        </form>
      ) : null}

      {questions.length === 0 ? (
        <p className="muted">{search ? c('noMatchingQuestions') : c('noQuestions')}</p>
      ) : (
        <ul className="qa-list" aria-busy={pending}>
          {questions.map((question) => (
            <QuestionItem
              key={question.id}
              question={question}
              canAnswer={page.canAnswer}
              onAnswered={replace}
              date={(iso) => f.date(iso)}
            />
          ))}
        </ul>
      )}
      {page.page < page.totalPages ? (
        <button
          type="button"
          className="btn btn--secondary"
          style={{ justifySelf: 'start' }}
          disabled={pending}
          onClick={() => reload(search, page.page + 1)}
        >
          {c('moreQuestions')}
        </button>
      ) : null}

      {signedIn ? (
        <form
          className="form card qa-ask"
          onSubmit={(event) => {
            event.preventDefault();
            start(async () => {
              const result = await askQuestion(slug, asking);
              if (!result.ok) return setNotice({ error: result.error });
              setQuestions((current) => [result.data, ...current]);
              setAsking('');
              setNotice({ ok: c('asked') });
            });
          }}
        >
          <label>
            {c('askTitle')}
            <textarea
              value={asking}
              onChange={(event) => setAsking(event.target.value)}
              placeholder={c('askPlaceholder')}
              minLength={10}
              maxLength={500}
              rows={2}
              required
            />
          </label>
          {notice.error ? (
            <p className="banner banner--error" role="alert">
              {notice.error}
            </p>
          ) : notice.ok ? (
            <p className="banner banner--ok" role="status">
              {notice.ok}
            </p>
          ) : null}
          <div>
            <button className="btn btn--primary" type="submit" disabled={pending}>
              {c('askButton')}
            </button>
          </div>
        </form>
      ) : (
        <a
          className="btn btn--secondary"
          style={{ justifySelf: 'start' }}
          href={`/account/login?next=${encodeURIComponent(`/p/${slug}#questions`)}`}
        >
          {c('askSignIn')}
        </a>
      )}
    </section>
  );
}

function QuestionItem({
  question,
  canAnswer,
  onAnswered,
  date,
}: {
  question: QuestionView;
  canAnswer: boolean;
  onAnswered: (q: QuestionView) => void;
  date: (iso: string) => string;
}) {
  const c = useT('community');
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <li className="qa-item">
      <p className="qa-q">
        <strong>Q:</strong> {question.body}
      </p>
      <span className="muted qa-meta">
        {c('askedBy', { author: question.author, date: date(question.createdAt) })}
      </span>
      {question.answers.length ? (
        question.answers.map((answer) => (
          <div key={answer.id} className="qa-a">
            <p>
              <strong>A:</strong> {answer.body}
            </p>
            <span className="muted qa-meta">
              <span className={`badge badge--${answer.role.toLowerCase()}`}>
                {c(`role_${answer.role}`)}
              </span>{' '}
              {c('answerBy', { author: answer.author, date: date(answer.createdAt) })}
            </span>
          </div>
        ))
      ) : (
        <p className="muted qa-meta">{c('noAnswersYet')}</p>
      )}
      {canAnswer ? (
        open ? (
          <form
            className="form qa-answer"
            onSubmit={(event) => {
              event.preventDefault();
              start(async () => {
                const result = await answerQuestion(question.id, text);
                if (!result.ok) return setError(result.error);
                onAnswered(result.data);
                setText('');
                setOpen(false);
              });
            }}
          >
            <label className="sr-only" htmlFor={`answer-${question.id}`}>
              {c('answerButton')}
            </label>
            <textarea
              id={`answer-${question.id}`}
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder={c('answerPlaceholder')}
              minLength={2}
              maxLength={1000}
              rows={2}
              required
              autoFocus
            />
            {error ? (
              <p className="banner banner--error" role="alert">
                {error}
              </p>
            ) : null}
            <div>
              <button className="btn btn--primary btn--sm" type="submit" disabled={pending}>
                {c('postAnswer')}
              </button>
            </div>
          </form>
        ) : (
          <button type="button" className="chip" onClick={() => setOpen(true)}>
            {c('answerButton')}
          </button>
        )
      ) : null}
    </li>
  );
}
