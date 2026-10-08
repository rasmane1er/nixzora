import { type Locale } from './locale';
import * as catalogs from './messages';

/**
 * Names for product specs and variant options, shared by the website and the app.
 * Known keys use productPage.spec_<key> / option_<name>; anything else is spelled out from the
 * key, with a unit suffix shown in brackets: "battery_hours" → "Battery (hours)".
 */
const UNITS: Record<string, Record<Locale, string>> = {
  gb: { en: 'GB', fr: 'Go', es: 'GB' },
  tb: { en: 'TB', fr: 'To', es: 'TB' },
  in: { en: 'inches', fr: 'pouces', es: 'pulgadas' },
  kg: { en: 'kg', fr: 'kg', es: 'kg' },
  g: { en: 'g', fr: 'g', es: 'g' },
  hz: { en: 'Hz', fr: 'Hz', es: 'Hz' },
  hours: { en: 'hours', fr: 'heures', es: 'horas' },
  days: { en: 'days', fr: 'jours', es: 'días' },
  min: { en: 'minutes', fr: 'minutes', es: 'minutos' },
  mah: { en: 'mAh', fr: 'mAh', es: 'mAh' },
  w: { en: 'W', fr: 'W', es: 'W' },
  mm: { en: 'mm', fr: 'mm', es: 'mm' },
  cm: { en: 'cm', fr: 'cm', es: 'cm' },
  ml: { en: 'ml', fr: 'ml', es: 'ml' },
  l: { en: 'litres', fr: 'litres', es: 'litros' },
};
const WORDS: Record<string, string> = {
  cpu: 'CPU',
  gpu: 'GPU',
  ram: 'RAM',
  ssd: 'SSD',
  usb: 'USB',
  wifi: 'Wi-Fi',
  anc: 'ANC',
  spf: 'SPF',
};

function spelledOut(key: string, locale: Locale): string {
  const parts = key.split('_');
  const unit = parts.length > 1 ? UNITS[parts[parts.length - 1]!]?.[locale] : undefined;
  const text = (unit ? parts.slice(0, -1) : parts).map((w) => WORDS[w] ?? w).join(' ');
  const cased = text.charAt(0).toUpperCase() + text.slice(1);
  return unit ? `${cased} (${unit})` : cased;
}

const page = (locale: Locale) => catalogs.productPage[locale] as Record<string, string>;

/** "battery_hours" → "Battery (hours)" / "Autonomie (heures)". */
export function specLabel(key: string, locale: Locale): string {
  return page(locale)[`spec_${key}`] ?? spelledOut(key, locale);
}

/** "size" → "Size" / "Taille" / "Talla". */
export function optionLabel(name: string, locale: Locale): string {
  return page(locale)[`option_${name}`] ?? spelledOut(name, locale);
}
