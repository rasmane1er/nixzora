import { defineMessages } from '../define';

/** Saved cards, 1-click and cancelling a just-placed order (p10-09). */
export const wallet = defineMessages({
  en: {
    savedCardsTitle: 'Saved cards',
    cardLabel: '{brand} ending in {last4}',
    expires: 'Expires {month}/{year}',
    expiredTag: 'Expired',
    defaultTag: 'Used for 1-click',
    makeDefault: 'Use for 1-click',
    removeCard: 'Remove',
    removed: 'Card removed.',
    defaultChanged: '1-click now uses this card.',
    noCards:
      'No saved cards. Tick “Save this card” when you pay, and the card appears here for 1-click.',
    cardsNote:
      'Your card number stays with our payment provider, Stripe. NIXZORA keeps only the brand, the last four digits and the expiry date, to show you which card is which.',
    payWith: 'Pay with',
    placeOrder: 'Place order',
    newCard: 'A new card',
    saveCard: 'Save this card for next time (1-click)',
    saveCardHint: 'Kept by our payment provider. Remove it any time in Your account.',
    oneClick: 'Buy now with 1-click',
    oneClickNote: 'Ships to {name}, {city} · {card}',
    oneClickChange: 'Change',
    placedTitle: 'Order placed. Thank you!',
    cancelOrder: 'Cancel order',
    cancelUntil: 'Changed your mind? You can cancel until {time}.',
    cancelConfirm: 'Cancel this order? You’ll get a full refund.',
    cancelled: 'Order cancelled. Your refund is on its way to your card.',
    keepOrder: 'Keep order',
  },
  fr: {
    savedCardsTitle: 'Cartes enregistrées',
    cardLabel: '{brand} se terminant par {last4}',
    expires: 'Expire {month}/{year}',
    expiredTag: 'Expirée',
    defaultTag: 'Utilisée pour l’achat en 1 clic',
    makeDefault: 'Utiliser pour l’achat en 1 clic',
    removeCard: 'Supprimer',
    removed: 'Carte supprimée.',
    defaultChanged: 'L’achat en 1 clic utilise désormais cette carte.',
    noCards:
      'Aucune carte enregistrée. Cochez « Enregistrer cette carte » au paiement et elle apparaîtra ici pour l’achat en 1 clic.',
    cardsNote:
      'Le numéro de votre carte reste chez notre prestataire de paiement, Stripe. NIXZORA ne garde que la marque, les quatre derniers chiffres et la date d’expiration, pour vous aider à les reconnaître.',
    payWith: 'Payer avec',
    placeOrder: 'Passer la commande',
    newCard: 'Une nouvelle carte',
    saveCard: 'Enregistrer cette carte pour la prochaine fois (1 clic)',
    saveCardHint:
      'Conservée par notre prestataire de paiement. Supprimez-la à tout moment dans Votre compte.',
    oneClick: 'Acheter en 1 clic',
    oneClickNote: 'Livraison à {name}, {city} · {card}',
    oneClickChange: 'Modifier',
    placedTitle: 'Commande passée. Merci !',
    cancelOrder: 'Annuler la commande',
    cancelUntil: 'Vous avez changé d’avis ? Vous pouvez annuler jusqu’à {time}.',
    cancelConfirm: 'Annuler cette commande ? Vous serez remboursé intégralement.',
    cancelled: 'Commande annulée. Votre remboursement arrive sur votre carte.',
    keepOrder: 'Garder la commande',
  },
  es: {
    savedCardsTitle: 'Tarjetas guardadas',
    cardLabel: '{brand} terminada en {last4}',
    expires: 'Vence {month}/{year}',
    expiredTag: 'Vencida',
    defaultTag: 'Se usa para comprar en 1 clic',
    makeDefault: 'Usar para comprar en 1 clic',
    removeCard: 'Quitar',
    removed: 'Tarjeta quitada.',
    defaultChanged: 'Ahora la compra en 1 clic usa esta tarjeta.',
    noCards:
      'No hay tarjetas guardadas. Marca «Guardar esta tarjeta» al pagar y aparecerá aquí para comprar en 1 clic.',
    cardsNote:
      'El número de tu tarjeta queda en nuestro proveedor de pagos, Stripe. NIXZORA solo guarda la marca, los últimos cuatro dígitos y la fecha de vencimiento, para que sepas cuál es cuál.',
    payWith: 'Pagar con',
    placeOrder: 'Realizar pedido',
    newCard: 'Una tarjeta nueva',
    saveCard: 'Guardar esta tarjeta para la próxima vez (1 clic)',
    saveCardHint: 'La guarda nuestro proveedor de pagos. Quítala cuando quieras en Tu cuenta.',
    oneClick: 'Comprar ahora en 1 clic',
    oneClickNote: 'Se envía a {name}, {city} · {card}',
    oneClickChange: 'Cambiar',
    placedTitle: '¡Pedido realizado! Gracias.',
    cancelOrder: 'Cancelar pedido',
    cancelUntil: '¿Cambiaste de opinión? Puedes cancelar hasta las {time}.',
    cancelConfirm: '¿Cancelar este pedido? Recibirás un reembolso completo.',
    cancelled: 'Pedido cancelado. Tu reembolso va en camino a tu tarjeta.',
    keepOrder: 'Mantener el pedido',
  },
});

const BRANDS: Record<string, string> = {
  visa: 'Visa',
  mastercard: 'Mastercard',
  amex: 'American Express',
  discover: 'Discover',
  diners: 'Diners Club',
  jcb: 'JCB',
  unionpay: 'UnionPay',
};

/** "visa" → "Visa": the card network as printed on the card. */
export function cardBrand(brand: string): string {
  return BRANDS[brand.toLowerCase()] ?? brand.charAt(0).toUpperCase() + brand.slice(1);
}
