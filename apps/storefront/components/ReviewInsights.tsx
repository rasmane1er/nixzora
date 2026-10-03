import { type ReviewInsights as Insights } from '@nixzora/validation';
import { getFormat, getT } from '@/lib/i18n';

/** "What customers say": summary plus praised / criticized themes, all counted from reviews. */
export async function ReviewInsights({ insights }: { insights: Insights }) {
  const t = await getT('productPage');
  const f = await getFormat();
  return (
    <section className="insights" aria-labelledby="insights-title">
      <div className="insights__head">
        <h3 id="insights-title">{t('whatCustomersSay')}</h3>
        <span className="insights__badge" title={t('summarizedFrom')}>
          {insights.aiWritten
            ? t('aiSummaryOf', { count: insights.reviewCount })
            : t('summaryOf', { count: insights.reviewCount })}
        </span>
      </div>
      <p>{insights.summary}</p>
      {insights.pros.length || insights.cons.length ? (
        <div className="insights__themes">
          {insights.pros.length ? (
            <ul aria-label={t('customersLike')}>
              {insights.pros.map((theme) => (
                <li key={theme.label} className="insights__pro">
                  <span aria-hidden="true">+</span> {theme.label}
                  <span className="muted"> · {f.number(theme.mentions)}</span>
                </li>
              ))}
            </ul>
          ) : null}
          {insights.cons.length ? (
            <ul aria-label={t('customersMention')}>
              {insights.cons.map((theme) => (
                <li key={theme.label} className="insights__con">
                  <span aria-hidden="true">−</span> {theme.label}
                  <span className="muted"> · {f.number(theme.mentions)}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      <p className="muted" style={{ fontSize: 13 }}>
        {t('insightsNote')}
      </p>
    </section>
  );
}
