import { defineMessages } from '../define';

/** Delivery dates and carrier tracking (p10-04). */
export const delivery = defineMessages({
  en: {
    arrives: 'Arrives {range}',
    arrivesHint: 'If you order today before 2 pm ET. Business days, standard shipping.',
    expected: 'Expected {range}',
    trackingTitle: 'Tracking',
    noScans: 'No carrier scans yet. They appear here once the carrier has the parcel.',
    step_LABEL_CREATED: 'Label created',
    step_IN_TRANSIT: 'In transit',
    step_OUT_FOR_DELIVERY: 'Out for delivery',
    step_DELIVERED: 'Delivered',
    step_EXCEPTION: 'Delivery problem',
    step_OTHER: 'Update',
  },
  fr: {
    arrives: 'Livraison {range}',
    arrivesHint:
      'Pour une commande passée aujourd’hui avant 14 h (heure de l’Est). Jours ouvrés, livraison standard.',
    expected: 'Livraison prévue {range}',
    trackingTitle: 'Suivi',
    noScans:
      'Pas encore de scan du transporteur. Ils apparaîtront ici dès qu’il aura pris en charge le colis.',
    step_LABEL_CREATED: 'Étiquette créée',
    step_IN_TRANSIT: 'En transit',
    step_OUT_FOR_DELIVERY: 'En cours de livraison',
    step_DELIVERED: 'Livré',
    step_EXCEPTION: 'Problème de livraison',
    step_OTHER: 'Mise à jour',
  },
  es: {
    arrives: 'Llega {range}',
    arrivesHint: 'Si pides hoy antes de las 2 p. m. (hora del Este). Días hábiles, envío estándar.',
    expected: 'Llegada prevista {range}',
    trackingTitle: 'Seguimiento',
    noScans: 'Aún no hay escaneos del transportista. Aparecerán aquí cuando tenga el paquete.',
    step_LABEL_CREATED: 'Etiqueta creada',
    step_IN_TRANSIT: 'En tránsito',
    step_OUT_FOR_DELIVERY: 'En reparto',
    step_DELIVERED: 'Entregado',
    step_EXCEPTION: 'Problema de entrega',
    step_OTHER: 'Actualización',
  },
});
