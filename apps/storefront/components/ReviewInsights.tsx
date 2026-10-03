import { type ReviewInsights as Insights } from '@nixzora/validation';

/** "What customers say": summary plus praised / criticized themes, all counted from reviews. */
export function ReviewInsights({ insights }: { insights: Insights }) {
  return (
    <section className="insights" aria-labelledby="insights-title">
      <div className="insights__head">
        <h3 id="insights-title">What customers say</h3>
        <span className="insights__badge" title="Summarized from customer reviews">
          {insights.aiWritten ? 'AI summary' : 'Summary'} of {insights.reviewCount} reviews
        </span>
      </div>
      <p>{insights.summary}</p>
      {insights.pros.length || insights.cons.length ? (
        <div className="insights__themes">
          {insights.pros.length ? (
            <ul aria-label="Customers like">
              {insights.pros.map((theme) => (
                <li key={theme.label} className="insights__pro">
                  <span aria-hidden="true">+</span> {theme.label}
                  <span className="muted"> · {theme.mentions}</span>
                </li>
              ))}
            </ul>
          ) : null}
          {insights.cons.length ? (
            <ul aria-label="Customers mention">
              {insights.cons.map((theme) => (
                <li key={theme.label} className="insights__con">
                  <span aria-hidden="true">−</span> {theme.label}
                  <span className="muted"> · {theme.mentions}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      <p className="muted" style={{ fontSize: 13 }}>
        Based on approved reviews. Numbers are how many reviews mention each point.
      </p>
    </section>
  );
}
