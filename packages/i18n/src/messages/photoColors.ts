import { defineMessages } from '../define';

/** Photos per color (p10-29): swatches on cards, and tagging photos in the editors. */
export const photoColors = defineMessages({
  en: {
    swatches: 'Colors: {colors}',
    more: '+{count}',
    seeColor: 'See it in {color}',
    showsColor: 'Shows color',
    everyColor: 'Every color',
    colorHint:
      'Give each color its own photos: shoppers who choose a color see its photos first, and cards show the color’s photo.',
  },
  fr: {
    swatches: 'Couleurs : {colors}',
    more: '+{count}',
    seeColor: 'Voir en {color}',
    showsColor: 'Couleur montrée',
    everyColor: 'Toutes les couleurs',
    colorHint:
      'Donnez à chaque couleur ses photos : les clients qui choisissent une couleur voient d’abord ses photos, et les cartes montrent sa photo.',
  },
  es: {
    swatches: 'Colores: {colors}',
    more: '+{count}',
    seeColor: 'Verlo en {color}',
    showsColor: 'Color que muestra',
    everyColor: 'Todos los colores',
    colorHint:
      'Da a cada color sus propias fotos: quien elige un color ve primero sus fotos, y las tarjetas muestran la foto de ese color.',
  },
});
