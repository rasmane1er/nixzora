import { type SearchSuggestions } from '@nixzora/validation';
import { type NextRequest, NextResponse } from 'next/server';
import { api } from '@/lib/api';

/** Suggestions for the header search box (p10-03). Never fails: no suggestions is fine. */
export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get('q') ?? '').slice(0, 100);
  const empty: SearchSuggestions = {
    completions: [],
    categories: [],
    brands: [],
    products: [],
    correction: null,
  };
  if (!q.trim()) return NextResponse.json(empty);
  const result = await api<SearchSuggestions>(`/catalog/suggest?q=${encodeURIComponent(q)}`, {
    auth: false,
  }).catch(() => empty);
  return NextResponse.json(result, { headers: { 'Cache-Control': 'private, max-age=30' } });
}
