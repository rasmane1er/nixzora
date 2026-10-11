import { defineMessages } from '../define';

/** "Get it by" (p10-37): the delivery-date chips on search and listing pages. */
export const arriveBy = defineMessages({
  en: {
    label: 'Get it by',
    chip: 'By {date}',
    any: 'Any time',
    a11y: 'Show only what arrives by {date}',
    active: 'Arriving by {date}',
  },
  fr: {
    label: 'Livré avant le',
    chip: 'D’ici {date}',
    any: 'Peu importe',
    a11y: 'Afficher seulement ce qui arrive d’ici {date}',
    active: 'Livré d’ici {date}',
  },
  es: {
    label: 'Recíbelo antes del',
    chip: 'Antes del {date}',
    any: 'Cuando sea',
    a11y: 'Mostrar solo lo que llega antes del {date}',
    active: 'Llega antes del {date}',
  },
});
