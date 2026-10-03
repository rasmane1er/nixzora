import { defineMessages } from '../define';

/** A marketplace seller's public storefront page. */
export const store = defineMessages({
  en: {
    metaTitle: '{name} on NIXZORA',
    metaDescription: 'Shop {name} on NIXZORA.',
    marketplaceSeller: 'Marketplace seller',
    sales: '{count, plural, one {# sale} other {# sales}}',
    since: 'Since {date}',
    shipsIn: '{count, plural, one {Ships in # business day} other {Ships in # business days}}',
    covered: 'Orders are covered by NIXZORA’s secure checkout and 30-day returns.',
    questions: 'Questions?',
    website: 'Website',
    noProducts: 'No products listed right now.',
  },
  fr: {
    metaTitle: '{name} sur NIXZORA',
    metaDescription: 'Achetez chez {name} sur NIXZORA.',
    marketplaceSeller: 'Vendeur de la marketplace',
    sales: '{count, plural, one {# vente} other {# ventes}}',
    since: 'Depuis {date}',
    shipsIn:
      '{count, plural, one {Expédition sous # jour ouvré} other {Expédition sous # jours ouvrés}}',
    covered:
      'Les commandes bénéficient du paiement sécurisé de NIXZORA et des retours sous 30 jours.',
    questions: 'Des questions ?',
    website: 'Site web',
    noProducts: 'Aucun produit en vente pour le moment.',
  },
  es: {
    metaTitle: '{name} en NIXZORA',
    metaDescription: 'Compra en {name} en NIXZORA.',
    marketplaceSeller: 'Vendedor del marketplace',
    sales: '{count, plural, one {# venta} other {# ventas}}',
    since: 'Desde {date}',
    shipsIn: '{count, plural, one {Envía en # día hábil} other {Envía en # días hábiles}}',
    covered: 'Los pedidos tienen el pago seguro de NIXZORA y devoluciones dentro de 30 días.',
    questions: '¿Preguntas?',
    website: 'Sitio web',
    noProducts: 'No hay productos publicados en este momento.',
  },
});
