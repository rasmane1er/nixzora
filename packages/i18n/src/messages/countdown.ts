import { defineMessages } from '../define';

/** Countdowns (p10-38): deadlines in the last 24 hours, and the order cutoff for delivery. */
export const countdown = defineMessages({
  en: {
    endsIn: 'Ends in {time}',
    endingSoon: 'Ending soon',
    ended: 'Ended',
    orderWithin: 'Order within {time}',
    orderWithinHint: 'Standard shipping, business days.',
    orderWithinHintTwoDay: 'NIXZORA Plus 2-day delivery, business days.',
    cancelFor: 'You can cancel for {time} more',
    returnsCloseIn: 'Returns close in {time}',
  },
  fr: {
    endsIn: 'Se termine dans {time}',
    endingSoon: 'Bientôt terminé',
    ended: 'Terminé',
    orderWithin: 'Commandez d’ici {time}',
    orderWithinHint: 'Livraison standard, jours ouvrés.',
    orderWithinHintTwoDay: 'Livraison en 2 jours NIXZORA Plus, jours ouvrés.',
    cancelFor: 'Vous pouvez annuler pendant encore {time}',
    returnsCloseIn: 'Les retours ferment dans {time}',
  },
  es: {
    endsIn: 'Termina en {time}',
    endingSoon: 'Termina pronto',
    ended: 'Terminado',
    orderWithin: 'Pide en las próximas {time}',
    orderWithinHint: 'Envío estándar, días hábiles.',
    orderWithinHintTwoDay: 'Entrega en 2 días con NIXZORA Plus, días hábiles.',
    cancelFor: 'Puedes cancelar durante {time} más',
    returnsCloseIn: 'Las devoluciones cierran en {time}',
  },
});
