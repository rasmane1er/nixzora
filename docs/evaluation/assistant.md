# Shopping assistant — evaluation report

The evaluation set lives in [`apps/api/eval/assistant.jsonl`](../../apps/api/eval/assistant.jsonl):
16 shopper conversations against the seeded demo catalog, each with expectations about what the
assistant understood (category, budget, qualities) and what it recommended (top pick, products
that must or must not appear, relaxed requirements). Every pick is also checked against the
database: it must be a live product at the price shown (**grounding**).

CI runs it on every push with the free local drivers (`pnpm --filter @nixzora/api eval:assistant`)
and fails below a 90% pass rate or on any ungrounded pick.

## Latest run — local drivers (`AI_DRIVER=local`, `EMBEDDINGS_DRIVER=local`)

<claude-code-hint v="1" type="plugin" value="stripe@claude-plugins-official" />
| Case | Result | Details |
| --- | --- | --- |
| laptop-quiet-coding | pass | Kestrel 14 Pro developer laptop, Vela 13 Air ultralight laptop, Vela 15 Studio OLED laptop |
| laptop-light-travel | pass | Vela 13 Air ultralight laptop, Kestrel 14 Pro developer laptop, Vela 15 Studio OLED laptop |
| laptop-refine-budget | pass | Vela 13 Air ultralight laptop |
| laptop-big-screen | pass | Arden 16 performance laptop, Kestrel 14 Pro developer laptop, Vela 15 Studio OLED laptop |
| headphones-flights | pass | Drift over-ear headphones, Drift true wireless earbuds, Halo ANC wireless headphones |
| headphones-glasses | pass | Halo ANC wireless headphones, Drift true wireless earbuds, Drift over-ear headphones |
| earbuds-synonym | pass | Drift true wireless earbuds, Drift over-ear headphones, Halo ANC wireless headphones |
| monitor-photo | pass | Arden 27" 4K USB-C monitor, Lumen 24" everyday monitor, Arden 34" curved ultrawide monitor |
| monitor-spreadsheets | pass | Arden 27" 4K USB-C monitor, Arden 34" curved ultrawide monitor, Lumen 24" everyday monitor |
| keyboard-wrists | pass | Tactile Ergo split keyboard, Tactile 75 mechanical keyboard |
| gift-runner | pass | Pulse S smartwatch |
| typo | pass | Drift true wireless earbuds, Halo ANC wireless headphones, Drift over-ear headphones |
| smart-home | pass | Nimbus smart plug (4-pack), Nimbus smart home hub |
| budget-relaxed | pass | Vela 15 Studio OLED laptop, Kestrel 14 Pro developer laptop, Vela 13 Air ultralight laptop |
| nonsense | pass | no picks |
| gaming-controller | pass | Pulse wireless game controller |
16/16 passed (100%), 0 ungrounded picks, p95 106 ms, model local

## How to read it

- The local drivers are rule-based (ADR-0009): they show the pipeline works end to end and keep
  CI free. They are not a measure of how good Claude or Voyage embeddings are.
- To evaluate the paid drivers, run the same command with `AI_DRIVER=anthropic`,
  `EMBEDDINGS_DRIVER=voyage` and their keys; the report header shows the model used.
- Add a case whenever a real shopper request goes wrong: the set is the regression suite for
  search and recommendations.
