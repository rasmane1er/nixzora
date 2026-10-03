# ADR-0011: Review insights and product copy suggestions

- Status: accepted
- Date: 2026-10-03
- Roadmap: p6-03 (AI enrichment), p6-04 (review summaries)

## Context

Shoppers skim reviews for what people like and dislike; staff write product descriptions by
hand. Both are good uses of a language model, and both are places where a model can make things
up: a fake "9 out of 10 owners", a battery life the product does not have.

## Decision

**Facts first, model second.** The numbers and lists are computed in code; a model may only write
the sentence around them, and its text is thrown away unless it passes a check.

### Review insights ("What customers say")

- `analyzeReviews` splits approved reviews into clauses (at sentence ends and "but", "however",
  "though"), tags 12 aspects (battery, display, sound, comfort, build, performance, keyboard,
  noise, portability, setup, connectivity, value) and scores each clause: complaint words, then
  praise words, then the review's star rating.
- Pros and cons count **distinct reviews**; an aspect praised and criticized equally is in
  neither list. At least 3 approved reviews are needed.
- The summary sentence is a template, or Claude's text when `AI_DRIVER=anthropic` and within the
  daily budget. `groundSummary` rejects it if it has any number we did not compute, a price, a
  link, or more than 500 characters. Shoppers see "AI summary" only when the model's text was used.
- Rebuilt through the outbox (`reviews.product.changed`) when a review is approved, rejected or
  edited, and at startup when the analysis version or model changes (hash of reviews + version
  - model, so unchanged products cost nothing).

### Product copy suggestions (Ops Center)

- "Suggest description" in the product editor returns a draft; it is never saved automatically.
- `checkCopy` rejects drafts with numbers not in the title, description or specs, prices, links,
  store superlatives ("best", "#1") or odd length, and says why; the editor then shows the
  template draft and the reason.

Both features log to `ai_requests` (`review_insights`, `product_copy`) and appear on the AI
operations page with cost, latency and the share of grounded answers.

## Consequences

- Works with no model at all (templates), so staging costs nothing until a key is added.
- Keyword aspects miss some phrasing; the vocabulary is versioned (`ANALYSIS_VERSION`) and every
  change is covered by unit tests.
- Demo reviews in the seed come from accounts named "… (demo)" that cannot sign in.
