import { defineMessages } from '../define';

/** Pre-orders (p10-30): on cards, product pages, cart, orders, and the listing editors. */
export const preorders = defineMessages({
  en: {
    badge: 'Pre-order',
    shipsFrom: 'Ships from {date}',
    pdpNote:
      'Order now and it ships from {date}. You pay today, and you can cancel any time before release day.',
    button: 'Pre-order · {price}',
    buttonPlain: 'Pre-order',
    cartLine: 'Pre-order · ships from {date}',
    cartMixed:
      'Your order ships together once the pre-order is released on {date}. To get the other items sooner, order them separately.',
    orderNote: 'Pre-order: ships from {date}. You can cancel until then.',
    sellerShipsOn: 'Pre-order · ships from {date}',
    releaseLabel: 'Pre-order release date (optional)',
    releaseHint:
      'Sell it before it’s in stock: shoppers order now and it ships from this day. The stock you enter is how many you can pre-sell. Leave empty for a normal listing. Up to {max} days ahead.',
    problem_INVALID: 'Enter the release date as a date.',
    problem_NOT_FUTURE: 'The release date has to be after today.',
    problem_TOO_FAR: 'The release date can be up to {max} days from today.',
  },
  fr: {
    badge: 'Précommande',
    shipsFrom: 'Expédié à partir du {date}',
    pdpNote:
      'Commandez maintenant : l’article est expédié à partir du {date}. Vous payez aujourd’hui et pouvez annuler à tout moment avant le jour de sortie.',
    button: 'Précommander · {price}',
    buttonPlain: 'Précommander',
    cartLine: 'Précommande · expédiée à partir du {date}',
    cartMixed:
      'Votre commande sera expédiée en une fois à la sortie de la précommande, le {date}. Pour recevoir les autres articles plus tôt, commandez-les séparément.',
    orderNote: 'Précommande : expédiée à partir du {date}. Vous pouvez annuler jusque-là.',
    sellerShipsOn: 'Précommande · à expédier à partir du {date}',
    releaseLabel: 'Date de sortie pour précommande (facultatif)',
    releaseHint:
      'Vendez avant d’avoir le stock : les clients commandent maintenant et l’article est expédié à partir de ce jour. Le stock saisi correspond au nombre de précommandes possibles. Laissez vide pour une annonce normale. Jusqu’à {max} jours à l’avance.',
    problem_INVALID: 'Saisissez la date de sortie sous forme de date.',
    problem_NOT_FUTURE: 'La date de sortie doit être après aujourd’hui.',
    problem_TOO_FAR: 'La date de sortie peut être au plus dans {max} jours.',
  },
  es: {
    badge: 'Preventa',
    shipsFrom: 'Se envía desde el {date}',
    pdpNote:
      'Pídelo ahora y se envía desde el {date}. Pagas hoy y puedes cancelar en cualquier momento antes del día de lanzamiento.',
    button: 'Reservar · {price}',
    buttonPlain: 'Reservar',
    cartLine: 'Preventa · se envía desde el {date}',
    cartMixed:
      'Tu pedido se envía junto cuando salga la preventa, el {date}. Para recibir antes los demás artículos, pídelos por separado.',
    orderNote: 'Preventa: se envía desde el {date}. Puedes cancelar hasta entonces.',
    sellerShipsOn: 'Preventa · enviar desde el {date}',
    releaseLabel: 'Fecha de lanzamiento para preventa (opcional)',
    releaseHint:
      'Vende antes de tener stock: los clientes piden ahora y se envía desde ese día. El stock que pongas es cuántas unidades puedes prevender. Déjalo vacío para un anuncio normal. Hasta {max} días de antelación.',
    problem_INVALID: 'Escribe la fecha de lanzamiento como fecha.',
    problem_NOT_FUTURE: 'La fecha de lanzamiento debe ser posterior a hoy.',
    problem_TOO_FAR: 'La fecha de lanzamiento puede ser como máximo dentro de {max} días.',
  },
});
