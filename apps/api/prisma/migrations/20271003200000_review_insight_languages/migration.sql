-- "What customers say" in French and Spanish: model-written summaries per language.
ALTER TABLE "review_insights" ADD COLUMN "summaries" JSONB NOT NULL DEFAULT '{}';
