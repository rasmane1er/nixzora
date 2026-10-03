/** One namespace's messages in every language. French and Spanish must have exactly the
 * English keys: a missing or extra key fails the type check (and CI). */
export type Catalog<T extends Record<string, string>> = {
  en: T;
  fr: { [K in keyof T]: string };
  es: { [K in keyof T]: string };
};

export function defineMessages<T extends Record<string, string>>(catalog: Catalog<T>): Catalog<T> {
  return catalog;
}
