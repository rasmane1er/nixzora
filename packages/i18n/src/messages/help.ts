import { defineMessages } from '../define';

/** Help center (FAQ) and the contact-support form. */
export const help = defineMessages({
  en: {
    // Help center
    metaTitle: 'Help center',
    metaDescription: 'Answers about orders, delivery, returns, payments and your NIXZORA account.',
    eyebrow: 'Help center',
    heading: 'How can we help?',
    intro: "Quick answers first. Can't find yours? We reply within one business day.",
    contactSupport: 'Contact support',
    trackPackage: 'Track a package',
    reportProblem: 'Report a problem',

    sectionOrders: 'Orders and delivery',
    faqWhereQ: 'Where is my order?',
    faqWhereA:
      'Open <orders>Your orders</orders> and choose “Track package”. Orders with items from marketplace sellers arrive in more than one parcel, each with its own tracking.',
    faqDeliveryTimeQ: 'How long does delivery take?',
    faqDeliveryTimeA:
      'Most orders ship within 1–2 business days. Delivery dates from the carrier are estimates. See the <shipping>shipping policy</shipping>.',
    faqCancelQ: 'Can I change or cancel an order?',
    faqCancelA:
      'Until it ships, <contactOrder>contact us</contactOrder> with the order number and we will cancel it and refund you. Once it has shipped, return it instead.',
    faqAbroadQ: 'Do you ship outside the United States?',
    faqAbroadA: 'Not yet: we deliver to US addresses only.',

    sectionReturns: 'Returns and refunds',
    faqReturnQ: 'How do I return something?',
    faqReturnA:
      'Within 30 days of delivery, open the order and choose “Return or replace items”. Follow its progress in <returns>Returns & refunds</returns>.',
    faqRefundQ: 'When do I get my money back?',
    faqRefundA:
      'When the item arrives back with us, we refund the card you paid with. Banks usually show it within 5–10 business days.',
    faqSellersQ: 'Items from marketplace sellers',
    faqSellersA:
      'They follow the same 30-day policy and you return them through NIXZORA, like everything else.',

    sectionPayments: 'Payments and prices',
    faqPaymentQ: 'Which payment methods do you take?',
    faqPaymentA: 'Cards, Apple Pay and Google Pay. See <payments>Payment methods</payments>.',
    faqCouponQ: 'How do I use a coupon?',
    faqCouponA:
      'Enter the code in your cart. Current offers are in <coupons>Coupons & promotions</coupons>.',
    faqTaxQ: 'Do you charge sales tax?',
    faqTaxA: 'Where the law requires it; the cart shows it before you pay.',

    sectionAccount: 'Your account',
    faqPasswordQ: 'I forgot my password',
    faqPasswordA: 'Use <forgot>Forgot password</forgot> on the sign-in page.',
    faqSafeQ: 'How do I keep my account safe?',
    faqSafeA:
      'Turn on two-step verification and review your devices in <security>Password & security</security>.',
    faqCloseQ: 'How do I close my account or get my data?',
    faqCloseA: 'Both are in <privacy>Privacy & your data</privacy>.',

    // Contact page
    contactMetaDescription: 'Write to NIXZORA customer support. We answer within one business day.',
    breadcrumb: 'Breadcrumb',
    contactIntro:
      'We answer by email within one business day. For a quick answer, try the <help>help center</help>.',

    // Contact form
    sentThanks: 'Thanks, we got your message. Your reference is <b>{reference}</b>.',
    sentAnswer: 'We answer by email within one business day.',
    sentFollow: 'You can also follow it in <support>Your support requests</support>.',
    topicLabel: 'What is it about?',
    topic_ORDER: 'An order',
    topic_DELIVERY: 'Delivery or tracking',
    topic_RETURN: 'A return or refund',
    topic_PAYMENT: 'Payment or billing',
    topic_ACCOUNT: 'My account',
    topic_PRODUCT: 'A product question',
    topic_PROBLEM: 'Report a problem with the site or app',
    topic_OTHER: 'Something else',
    yourName: 'Your name',
    emailForAnswer: 'Email for our answer',
    orderNumber: 'Order number',
    orderNumberHint: 'Optional, like NX-7KQ4M2.',
    subject: 'Subject',
    subjectPlaceholderProblem: 'e.g. The checkout button does nothing',
    subjectPlaceholder: 'e.g. Package not arrived',
    messageProblem: 'What happened, and what did you expect?',
    message: 'How can we help?',
    pageOrScreen: 'Page or screen',
    sending: 'Sending…',
    sendMessage: 'Send message',
  },
  fr: {
    metaTitle: 'Centre d’aide',
    metaDescription:
      'Réponses sur les commandes, la livraison, les retours, les paiements et votre compte NIXZORA.',
    eyebrow: 'Centre d’aide',
    heading: 'Comment pouvons-nous vous aider ?',
    intro:
      'Les réponses rapides d’abord. Vous ne trouvez pas la vôtre ? Nous répondons sous un jour ouvré.',
    contactSupport: 'Contacter l’assistance',
    trackPackage: 'Suivre un colis',
    reportProblem: 'Signaler un problème',

    sectionOrders: 'Commandes et livraison',
    faqWhereQ: 'Où est ma commande ?',
    faqWhereA:
      'Ouvrez <orders>Vos commandes</orders> et choisissez « Suivre le colis ». Les commandes contenant des articles de vendeurs de la marketplace arrivent en plusieurs colis, chacun avec son propre suivi.',
    faqDeliveryTimeQ: 'Quel est le délai de livraison ?',
    faqDeliveryTimeA:
      'La plupart des commandes sont expédiées sous 1 à 2 jours ouvrés. Les dates de livraison du transporteur sont des estimations. Consultez la <shipping>politique de livraison</shipping>.',
    faqCancelQ: 'Puis-je modifier ou annuler une commande ?',
    faqCancelA:
      'Tant qu’elle n’est pas expédiée, <contactOrder>contactez-nous</contactOrder> avec le numéro de commande : nous l’annulerons et vous rembourserons. Une fois expédiée, retournez-la plutôt.',
    faqAbroadQ: 'Livrez-vous en dehors des États-Unis ?',
    faqAbroadA: 'Pas encore : nous livrons uniquement à des adresses aux États-Unis.',

    sectionReturns: 'Retours et remboursements',
    faqReturnQ: 'Comment retourner un article ?',
    faqReturnA:
      'Dans les 30 jours suivant la livraison, ouvrez la commande et choisissez « Retourner ou remplacer des articles ». Suivez l’avancement dans <returns>Retours et remboursements</returns>.',
    faqRefundQ: 'Quand serai-je remboursé ?',
    faqRefundA:
      'Dès que l’article nous est revenu, nous remboursons la carte utilisée pour le paiement. Les banques l’affichent généralement sous 5 à 10 jours ouvrés.',
    faqSellersQ: 'Articles des vendeurs de la marketplace',
    faqSellersA:
      'Ils suivent la même politique de 30 jours et se retournent via NIXZORA, comme tout le reste.',

    sectionPayments: 'Paiements et prix',
    faqPaymentQ: 'Quels moyens de paiement acceptez-vous ?',
    faqPaymentA:
      'Cartes bancaires, Apple Pay et Google Pay. Consultez <payments>Moyens de paiement</payments>.',
    faqCouponQ: 'Comment utiliser un coupon ?',
    faqCouponA:
      'Saisissez le code dans votre panier. Les offres en cours se trouvent dans <coupons>Coupons et promotions</coupons>.',
    faqTaxQ: 'Facturez-vous la taxe de vente ?',
    faqTaxA: 'Lorsque la loi l’exige ; le panier l’affiche avant le paiement.',

    sectionAccount: 'Votre compte',
    faqPasswordQ: 'J’ai oublié mon mot de passe',
    faqPasswordA: 'Utilisez <forgot>Mot de passe oublié</forgot> sur la page de connexion.',
    faqSafeQ: 'Comment protéger mon compte ?',
    faqSafeA:
      'Activez la vérification en deux étapes et vérifiez vos appareils dans <security>Mot de passe et sécurité</security>.',
    faqCloseQ: 'Comment fermer mon compte ou obtenir mes données ?',
    faqCloseA: 'Les deux se trouvent dans <privacy>Confidentialité et données</privacy>.',

    contactMetaDescription: 'Écrivez au service client NIXZORA. Nous répondons sous un jour ouvré.',
    breadcrumb: 'Fil d’Ariane',
    contactIntro:
      'Nous répondons par e-mail sous un jour ouvré. Pour une réponse rapide, consultez le <help>centre d’aide</help>.',

    sentThanks:
      'Merci, nous avons bien reçu votre message. Votre référence est <b>{reference}</b>.',
    sentAnswer: 'Nous répondons par e-mail sous un jour ouvré.',
    sentFollow: 'Vous pouvez aussi la suivre dans <support>Vos demandes d’assistance</support>.',
    topicLabel: 'De quoi s’agit-il ?',
    topic_ORDER: 'Une commande',
    topic_DELIVERY: 'Livraison ou suivi',
    topic_RETURN: 'Un retour ou un remboursement',
    topic_PAYMENT: 'Paiement ou facturation',
    topic_ACCOUNT: 'Mon compte',
    topic_PRODUCT: 'Une question sur un produit',
    topic_PROBLEM: 'Signaler un problème sur le site ou l’application',
    topic_OTHER: 'Autre chose',
    yourName: 'Votre nom',
    emailForAnswer: 'E-mail pour notre réponse',
    orderNumber: 'Numéro de commande',
    orderNumberHint: 'Facultatif, par exemple NX-7KQ4M2.',
    subject: 'Objet',
    subjectPlaceholderProblem: 'ex. Le bouton de paiement ne fait rien',
    subjectPlaceholder: 'ex. Colis non reçu',
    messageProblem: 'Que s’est-il passé, et qu’attendiez-vous ?',
    message: 'Comment pouvons-nous vous aider ?',
    pageOrScreen: 'Page ou écran',
    sending: 'Envoi…',
    sendMessage: 'Envoyer le message',
  },
  es: {
    metaTitle: 'Centro de ayuda',
    metaDescription:
      'Respuestas sobre pedidos, entregas, devoluciones, pagos y tu cuenta de NIXZORA.',
    eyebrow: 'Centro de ayuda',
    heading: '¿Cómo podemos ayudarte?',
    intro: 'Primero, respuestas rápidas. ¿No encuentras la tuya? Respondemos en un día hábil.',
    contactSupport: 'Contactar a soporte',
    trackPackage: 'Rastrear un paquete',
    reportProblem: 'Reportar un problema',

    sectionOrders: 'Pedidos y entregas',
    faqWhereQ: '¿Dónde está mi pedido?',
    faqWhereA:
      'Abre <orders>Tus pedidos</orders> y elige “Rastrear paquete”. Los pedidos con artículos de vendedores del marketplace llegan en más de un paquete, cada uno con su propio rastreo.',
    faqDeliveryTimeQ: '¿Cuánto tarda la entrega?',
    faqDeliveryTimeA:
      'La mayoría de los pedidos se envían en 1 a 2 días hábiles. Las fechas de entrega de la paquetería son estimadas. Consulta la <shipping>política de envíos</shipping>.',
    faqCancelQ: '¿Puedo cambiar o cancelar un pedido?',
    faqCancelA:
      'Mientras no se haya enviado, <contactOrder>contáctanos</contactOrder> con el número de pedido y lo cancelaremos y te haremos el reembolso. Si ya se envió, devuélvelo.',
    faqAbroadQ: '¿Hacen envíos fuera de Estados Unidos?',
    faqAbroadA: 'Todavía no: solo entregamos en direcciones de Estados Unidos.',

    sectionReturns: 'Devoluciones y reembolsos',
    faqReturnQ: '¿Cómo devuelvo algo?',
    faqReturnA:
      'Dentro de los 30 días posteriores a la entrega, abre el pedido y elige “Devolver o reemplazar artículos”. Sigue el progreso en <returns>Devoluciones y reembolsos</returns>.',
    faqRefundQ: '¿Cuándo recibo mi dinero?',
    faqRefundA:
      'Cuando el artículo nos llega de vuelta, hacemos el reembolso a la tarjeta con la que pagaste. Los bancos suelen mostrarlo en 5 a 10 días hábiles.',
    faqSellersQ: 'Artículos de vendedores del marketplace',
    faqSellersA:
      'Siguen la misma política de 30 días y los devuelves a través de NIXZORA, como todo lo demás.',

    sectionPayments: 'Pagos y precios',
    faqPaymentQ: '¿Qué métodos de pago aceptan?',
    faqPaymentA: 'Tarjetas, Apple Pay y Google Pay. Consulta <payments>Métodos de pago</payments>.',
    faqCouponQ: '¿Cómo uso un cupón?',
    faqCouponA:
      'Ingresa el código en tu carrito. Las ofertas actuales están en <coupons>Cupones y promociones</coupons>.',
    faqTaxQ: '¿Cobran impuesto sobre las ventas?',
    faqTaxA: 'Donde la ley lo exige; el carrito lo muestra antes de que pagues.',

    sectionAccount: 'Tu cuenta',
    faqPasswordQ: 'Olvidé mi contraseña',
    faqPasswordA: 'Usa <forgot>Olvidé mi contraseña</forgot> en la página de inicio de sesión.',
    faqSafeQ: '¿Cómo mantengo segura mi cuenta?',
    faqSafeA:
      'Activa la verificación en dos pasos y revisa tus dispositivos en <security>Contraseña y seguridad</security>.',
    faqCloseQ: '¿Cómo cierro mi cuenta u obtengo mis datos?',
    faqCloseA: 'Ambas opciones están en <privacy>Privacidad y tus datos</privacy>.',

    contactMetaDescription:
      'Escribe al servicio de atención al cliente de NIXZORA. Respondemos en un día hábil.',
    breadcrumb: 'Ruta de navegación',
    contactIntro:
      'Respondemos por correo electrónico en un día hábil. Para una respuesta rápida, consulta el <help>centro de ayuda</help>.',

    sentThanks: 'Gracias, recibimos tu mensaje. Tu referencia es <b>{reference}</b>.',
    sentAnswer: 'Respondemos por correo electrónico en un día hábil.',
    sentFollow:
      'También puedes darle seguimiento en <support>Tus solicitudes de soporte</support>.',
    topicLabel: '¿De qué se trata?',
    topic_ORDER: 'Un pedido',
    topic_DELIVERY: 'Entrega o rastreo',
    topic_RETURN: 'Una devolución o reembolso',
    topic_PAYMENT: 'Pago o facturación',
    topic_ACCOUNT: 'Mi cuenta',
    topic_PRODUCT: 'Una pregunta sobre un producto',
    topic_PROBLEM: 'Reportar un problema con el sitio o la app',
    topic_OTHER: 'Otra cosa',
    yourName: 'Tu nombre',
    emailForAnswer: 'Correo electrónico para nuestra respuesta',
    orderNumber: 'Número de pedido',
    orderNumberHint: 'Opcional, por ejemplo NX-7KQ4M2.',
    subject: 'Asunto',
    subjectPlaceholderProblem: 'p. ej. El botón de pago no hace nada',
    subjectPlaceholder: 'p. ej. El paquete no ha llegado',
    messageProblem: '¿Qué pasó y qué esperabas?',
    message: '¿Cómo podemos ayudarte?',
    pageOrScreen: 'Página o pantalla',
    sending: 'Enviando…',
    sendMessage: 'Enviar mensaje',
  },
});
