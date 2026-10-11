import { defineMessages } from '../define';

/** Store vacation mode (p10-32): what shoppers see, and the setting in Seller Central. */
export const vacation = defineMessages({
  en: {
    awayBanner: '{store} is away until {date}. Save it for later and order once they’re back.',
    awayBannerOpen: '{store} is away for now. Save it for later and order once they’re back.',
    awayShort: 'Store away · back {date}',
    awayShortOpen: 'Store away',
    cartLine: '{store} is away until {date}. You can order this once they’re back.',
    cartLineOpen: '{store} is away for now. You can order this once they’re back.',
    storeBanner: 'This store is away until {date}. You can browse, but orders open again then.',
    storeBannerOpen: 'This store is away for now. You can browse, but orders are paused.',
    note: 'A note from the store: “{message}”',
    title: 'Vacation mode',
    lead: 'Going away? Turn on vacation mode and new orders pause while you’re gone. Your listings stay visible with the day you’re back, so shoppers can save them, and orders open again automatically that day. Orders already placed still need to ship.',
    from: 'First day away',
    until: 'Back on (optional)',
    untilHint: 'Leave empty to turn it off yourself.',
    message: 'Message to shoppers (optional)',
    start: 'Turn on vacation mode',
    update: 'Save changes',
    end: 'I’m back: take orders again',
    statusAway: 'Your store is away. New orders are paused until {date}.',
    statusAwayOpen: 'Your store is away. New orders are paused until you turn this off.',
    statusScheduled: 'Vacation mode starts {from}.',
    saved: 'Vacation mode saved.',
    endedNotice: 'Welcome back: your store is taking orders again.',
    opsAway: 'Away until {date}',
    opsAwayOpen: 'Away',
  },
  fr: {
    awayBanner:
      '{store} est absent jusqu’au {date}. Mettez l’article de côté et commandez à son retour.',
    awayBannerOpen:
      '{store} est absent pour le moment. Mettez l’article de côté et commandez à son retour.',
    awayShort: 'Boutique absente · retour le {date}',
    awayShortOpen: 'Boutique absente',
    cartLine:
      '{store} est absent jusqu’au {date}. Vous pourrez commander cet article à son retour.',
    cartLineOpen:
      '{store} est absent pour le moment. Vous pourrez commander cet article à son retour.',
    storeBanner:
      'Cette boutique est absente jusqu’au {date}. Vous pouvez la parcourir ; les commandes reprendront à cette date.',
    storeBannerOpen:
      'Cette boutique est absente pour le moment. Vous pouvez la parcourir, mais les commandes sont suspendues.',
    note: 'Un mot de la boutique : « {message} »',
    title: 'Mode vacances',
    lead: 'Vous partez ? Activez le mode vacances : les nouvelles commandes sont suspendues pendant votre absence. Vos annonces restent visibles avec votre date de retour, les clients peuvent les mettre de côté, et les commandes reprennent automatiquement ce jour-là. Les commandes déjà passées doivent toujours être expédiées.',
    from: 'Premier jour d’absence',
    until: 'Retour le (facultatif)',
    untilHint: 'Laissez vide pour le désactiver vous-même.',
    message: 'Message aux clients (facultatif)',
    start: 'Activer le mode vacances',
    update: 'Enregistrer',
    end: 'Je suis de retour : reprendre les commandes',
    statusAway:
      'Votre boutique est absente. Les nouvelles commandes sont suspendues jusqu’au {date}.',
    statusAwayOpen:
      'Votre boutique est absente. Les nouvelles commandes sont suspendues jusqu’à ce que vous le désactiviez.',
    statusScheduled: 'Le mode vacances commence le {from}.',
    saved: 'Mode vacances enregistré.',
    endedNotice: 'Bon retour : votre boutique reprend les commandes.',
    opsAway: 'Absente jusqu’au {date}',
    opsAwayOpen: 'Absente',
  },
  es: {
    awayBanner: '{store} está ausente hasta el {date}. Guárdalo para después y pide cuando vuelva.',
    awayBannerOpen: '{store} está ausente por ahora. Guárdalo para después y pide cuando vuelva.',
    awayShort: 'Tienda ausente · vuelve el {date}',
    awayShortOpen: 'Tienda ausente',
    cartLine: '{store} está ausente hasta el {date}. Podrás pedir esto cuando vuelva.',
    cartLineOpen: '{store} está ausente por ahora. Podrás pedir esto cuando vuelva.',
    storeBanner:
      'Esta tienda está ausente hasta el {date}. Puedes ver sus productos; los pedidos se reanudan ese día.',
    storeBannerOpen:
      'Esta tienda está ausente por ahora. Puedes ver sus productos, pero los pedidos están en pausa.',
    note: 'Una nota de la tienda: «{message}»',
    title: 'Modo vacaciones',
    lead: '¿Te vas? Activa el modo vacaciones y los pedidos nuevos se pausan mientras no estás. Tus productos siguen visibles con el día de tu regreso, los clientes pueden guardarlos y los pedidos se reanudan solos ese día. Los pedidos ya hechos aún deben enviarse.',
    from: 'Primer día de ausencia',
    until: 'Vuelvo el (opcional)',
    untilHint: 'Déjalo vacío para desactivarlo tú.',
    message: 'Mensaje para los clientes (opcional)',
    start: 'Activar el modo vacaciones',
    update: 'Guardar cambios',
    end: 'Ya volví: aceptar pedidos',
    statusAway: 'Tu tienda está ausente. Los pedidos nuevos están en pausa hasta el {date}.',
    statusAwayOpen:
      'Tu tienda está ausente. Los pedidos nuevos están en pausa hasta que lo desactives.',
    statusScheduled: 'El modo vacaciones empieza el {from}.',
    saved: 'Modo vacaciones guardado.',
    endedNotice: 'Bienvenido de nuevo: tu tienda vuelve a aceptar pedidos.',
    opsAway: 'Ausente hasta el {date}',
    opsAwayOpen: 'Ausente',
  },
});
