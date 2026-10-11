import { warrantyLabel } from '@nixzora/i18n';
import { WARRANTY_CHOICES } from '@nixzora/validation';
import { getT } from '@/lib/i18n';

/** Warranty tracker (p10-33): the warranty field in listing editors; empty means none. */
export async function WarrantySelect({ value }: { value: number | null | undefined }) {
  const t = await getT('warranty');
  const choices: number[] = [...WARRANTY_CHOICES];
  if (value && !choices.includes(value)) choices.push(value);
  choices.sort((a, b) => a - b);
  return (
    <label>
      {t('editorLabel')}
      <select
        name="warrantyMonths"
        defaultValue={value ? String(value) : ''}
        style={{ maxWidth: 220 }}
      >
        <option value="">{t('editorNone')}</option>
        {choices.map((months) => (
          <option key={months} value={months}>
            {warrantyLabel(t, months)}
          </option>
        ))}
      </select>
      <span className="hint">{t('editorHint')}</span>
    </label>
  );
}
