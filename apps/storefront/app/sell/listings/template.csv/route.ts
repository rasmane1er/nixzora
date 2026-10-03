import { relayCsv } from '@/lib/csv-download';

export function GET() {
  return relayCsv('/seller/products/import/template');
}
