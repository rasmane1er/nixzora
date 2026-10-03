import { defineMessages } from '../define';

/**
 * Department names by category slug. Category records are written in English by staff; known
 * departments are shown in the visitor's language, others as stored.
 */
export const departments = defineMessages({
  en: {
    computers: 'Computers',
    laptops: 'Laptops',
    desktops: 'Desktops',
    monitors: 'Monitors',
    audio: 'Audio',
    headphones: 'Headphones',
    speakers: 'Speakers',
    phones: 'Phones',
    'smart-home': 'Smart home',
    gaming: 'Gaming',
    accessories: 'Accessories',
    keyboards: 'Keyboards',
    mice: 'Mice',
    wearables: 'Wearables',
    'other-electronics': 'Other electronics',
  },
  fr: {
    computers: 'Ordinateurs',
    laptops: 'Ordinateurs portables',
    desktops: 'Ordinateurs de bureau',
    monitors: 'Écrans',
    audio: 'Audio',
    headphones: 'Casques et écouteurs',
    speakers: 'Enceintes',
    phones: 'Téléphones',
    'smart-home': 'Maison connectée',
    gaming: 'Jeux vidéo',
    accessories: 'Accessoires',
    keyboards: 'Claviers',
    mice: 'Souris',
    wearables: 'Objets connectés',
    'other-electronics': 'Autre électronique',
  },
  es: {
    computers: 'Computadoras',
    laptops: 'Laptops',
    desktops: 'Computadoras de escritorio',
    monitors: 'Monitores',
    audio: 'Audio',
    headphones: 'Audífonos',
    speakers: 'Bocinas',
    phones: 'Teléfonos',
    'smart-home': 'Casa inteligente',
    gaming: 'Videojuegos',
    accessories: 'Accesorios',
    keyboards: 'Teclados',
    mice: 'Ratones',
    wearables: 'Dispositivos vestibles',
    'other-electronics': 'Otros electrónicos',
  },
});
