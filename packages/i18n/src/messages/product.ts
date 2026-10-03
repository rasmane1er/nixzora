import { defineMessages } from '../define';

/** Product cards, rails and prices, shared by the catalog pages. */
export const product = defineMessages({
  en: {
    from: 'From',
    was: 'was',
    inStock: 'In stock',
    soldOut: 'Sold out',
    products: '{count, plural, one {# product} other {# products}}',
    scrollLeft: 'Scroll left',
    scrollRight: 'Scroll right',
  },
  fr: {
    from: 'À partir de',
    was: 'au lieu de',
    inStock: 'En stock',
    soldOut: 'Épuisé',
    products: '{count, plural, one {# produit} other {# produits}}',
    scrollLeft: 'Défiler vers la gauche',
    scrollRight: 'Défiler vers la droite',
  },
  es: {
    from: 'Desde',
    was: 'antes',
    inStock: 'Disponible',
    soldOut: 'Agotado',
    products: '{count, plural, one {# producto} other {# productos}}',
    scrollLeft: 'Desplazar a la izquierda',
    scrollRight: 'Desplazar a la derecha',
  },
});
