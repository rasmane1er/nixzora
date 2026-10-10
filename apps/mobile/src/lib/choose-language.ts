import { type Locale } from '@nixzora/i18n';
import { api } from './api';
import { language } from './i18n';

/**
 * Switches the app's language (saved on the phone) and, when signed in, the account's too, so the
 * website and emails follow the same choice. Used by Settings and the home screen footer.
 */
export function chooseLanguage(next: Locale, signedIn: boolean): void {
  void language.choose(next);
  if (signedIn) void api.me.setLanguage(next).catch(() => undefined);
}
