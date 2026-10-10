'use server';

import { SizeChartSaveSchema } from '@nixzora/validation';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { api, errorMessage } from '@/lib/api';
import { getT } from '@/lib/i18n';

const PATH = '/sell/size-charts';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Creates a size chart, or saves one (p10-26). The form checks the chart first. */
export async function saveSizeChart(form: FormData): Promise<void> {
  const id = String(form.get('id') ?? '');
  const parsed = SizeChartSaveSchema.safeParse({
    name: form.get('name'),
    categoryId: form.get('categoryId'),
    text: form.get('text'),
    note: form.get('note') ?? undefined,
  });
  if (!parsed.success) {
    redirect(`${PATH}?error=${encodeURIComponent(parsed.error.issues[0]!.message)}`);
  }
  let message: string | null = null;
  try {
    await api(UUID.test(id) ? `/seller/size-charts/${id}` : '/seller/size-charts', {
      method: UUID.test(id) ? 'PUT' : 'POST',
      body: parsed.data,
    });
  } catch (error) {
    message = errorMessage(error);
  }
  revalidatePath(PATH);
  const t = await getT('sizeGuide');
  redirect(
    message
      ? `${PATH}?error=${encodeURIComponent(message)}`
      : `${PATH}?notice=${encodeURIComponent(t('saved'))}`,
  );
}

export async function deleteSizeChart(form: FormData): Promise<void> {
  const id = String(form.get('id') ?? '');
  if (!UUID.test(id)) redirect(PATH);
  let message: string | null = null;
  try {
    await api(`/seller/size-charts/${id}`, { method: 'DELETE' });
  } catch (error) {
    message = errorMessage(error);
  }
  revalidatePath(PATH);
  const t = await getT('sizeGuide');
  redirect(
    message
      ? `${PATH}?error=${encodeURIComponent(message)}`
      : `${PATH}?notice=${encodeURIComponent(t('deleted'))}`,
  );
}
