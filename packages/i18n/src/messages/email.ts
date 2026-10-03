import { defineMessages } from '../define';

/**
 * Emails and push notifications sent by the API, in the recipient's language. Bodies are plain
 * text: keep the line breaks (\n) and trailing newlines exactly as in English.
 */
export const email = defineMessages({
  en: {
    // Account (auth.*)
    auth_duplicate_subject: 'Someone tried to create a NIXZORA account with your email',
    auth_duplicate_text: 'If this was you, sign in or reset your password at {link}.',
    auth_verify_subject: 'Confirm your email for NIXZORA',
    auth_verify_text: 'Confirm your email address: {link}\nThis link expires in 24 hours.',
    auth_reset_subject: 'Reset your NIXZORA password',
    auth_reset_text:
      'Reset your password: {link}\nThis link expires in 30 minutes. If you did not ask for this, ignore this email.',

    // Order emails (orders.*): shared pieces
    order_line: '  {quantity} × {product} ({variant}) — {amount}',
    order_subtotal: 'Subtotal: {amount}',
    order_shipping: 'Shipping: {amount}',
    order_shippingFree: 'Free',
    order_tax: 'Tax: {amount}',
    order_total: 'Total: {amount}',
    order_parcelFrom: 'From {seller}: ',
    order_trackingNumber: '{carrier} tracking number {number}',
    order_details: 'Order details: {link}',
    order_refundDefaultReason: 'refund',

    order_receipt_subject: 'Your NIXZORA order {number}',
    order_receipt_text:
      'Thanks for your order!\n\nOrder {number}\n\n{lines}\n\n{totals}\n\nShipping to:\n{address}\n\nTrack your order: {link}\n',
    order_shipped_subject: 'Your order {number} is on its way',
    order_shipped_text:
      'Good news: order {number} has shipped.\n\n{tracking}Order details: {link}\n',
    order_cancelled_subject: 'Your order {number} was cancelled',
    order_cancelled_text:
      'Order {number} was cancelled and {amount} has been refunded to your original payment method. Refunds usually appear within 5–10 business days.\n\nOrder details: {link}\n',
    order_refunded_subject: 'A refund for order {number}',
    order_refunded_text:
      'We refunded {amount} for order {number} ({reason}). It usually appears on your statement within 5–10 business days.\n\nOrder details: {link}\n',
    order_delivered_subject: 'Delivered: order {number}',
    order_delivered_text:
      "Your order {number} was delivered. Enjoy it!\n\nSomething not right? You can start a return within 30 days from your order page: {link}\n\nWe'd love a review once you've tried it.\n",
    order_returnRequested_subject: 'We received your return request for {number}',
    order_returnRequested_text:
      "Thanks — we got your return request for order {number}. We'll review it within one business day and email you the next steps.\n\nOrder details: {link}\n",
    order_returnApproved_subject: 'Your return for {number} is approved',
    order_returnApproved_text:
      'Your return for order {number} is approved. Pack the items securely and send them to:\n\nNIXZORA Returns\n100 Warehouse Way\nUpper Marlboro, MD 20774\n\nWrite {number} on the box. We refund you as soon as it arrives.\n\nOrder details: {link}\n',
    order_returnRejected_subject: 'About your return for {number}',
    order_returnRejected_text:
      "We couldn't accept the return request for order {number}. Reply to this email if you have questions — we're happy to help.\n\nOrder details: {link}\n",

    // Support (support.received, support.reply)
    support_received_subject: 'We got your message ({reference})',
    support_greeting: 'Hi,',
    support_greetingName: 'Hi {name},',
    support_received_text:
      'Thanks for writing to NIXZORA. Your reference is {reference}.\nWe answer within one business day, by email to this address.\n\nYour message: {subject}\n\n— NIXZORA customer support',
    support_reply_subject: 'Re: {subject} ({reference})',
    support_reply_text: '{reply}\n\n— NIXZORA customer support\nReference {reference}',

    // Sellers (sellers.*)
    seller_payout_subject: 'Payout sent: {amount}',
    seller_payout_text:
      'We sent {amount} to the bank account on file for {store}. It usually arrives within 2 business days.\n\nDetails: {link}\n',
    seller_payout_textTest:
      'We sent {amount} to the bank account on file for {store}. (Test mode: no money moved.)\n\nDetails: {link}\n',
    seller_newOrder_subject: 'New order {number}: ship within 2 business days',
    seller_newOrder_line: '  {quantity} × {product} ({variant}), SKU {sku}',
    seller_newOrder_text:
      '{store} has a new order.\n\nOrder {number}\n{lines}\n\nYou earn {amount} after the {commission}% commission.\n\nShip it and add the tracking number here: {link}\n',

    // Push notifications for order events
    push_orderPaid_title: 'Order confirmed',
    push_orderPaid_body: 'We have your order {number}.',
    push_orderShipped_title: 'On its way',
    push_orderShipped_body: 'Order {number} has shipped.',
    push_orderDelivered_title: 'Delivered',
    push_orderDelivered_body: 'Order {number} was delivered.',
    push_orderCancelled_title: 'Order cancelled',
    push_orderCancelled_body: 'Order {number} was cancelled and refunded.',
    push_orderRefunded_title: 'Refund issued',
    push_orderRefunded_body: 'We refunded {amount} for order {number}.',
    push_orderRefunded_bodyNoAmount: 'We issued a refund for order {number}.',
    push_returnApproved_title: 'Return approved',
    push_returnApproved_body: 'Your return for order {number} was approved.',
    push_returnRejected_title: 'Return update',
    push_returnRejected_body: 'We could not accept the return for order {number}.',
  },
  fr: {
    auth_duplicate_subject:
      'Quelqu’un a essayé de créer un compte NIXZORA avec votre adresse e-mail',
    auth_duplicate_text:
      'Si c’était vous, connectez-vous ou réinitialisez votre mot de passe sur {link}.',
    auth_verify_subject: 'Confirmez votre adresse e-mail pour NIXZORA',
    auth_verify_text: 'Confirmez votre adresse e-mail : {link}\nCe lien expire dans 24 heures.',
    auth_reset_subject: 'Réinitialiser votre mot de passe NIXZORA',
    auth_reset_text:
      'Réinitialisez votre mot de passe : {link}\nCe lien expire dans 30 minutes. Si vous n’êtes pas à l’origine de cette demande, ignorez cet e-mail.',

    order_line: '  {quantity} × {product} ({variant}) — {amount}',
    order_subtotal: 'Sous-total : {amount}',
    order_shipping: 'Livraison : {amount}',
    order_shippingFree: 'Gratuite',
    order_tax: 'Taxes : {amount}',
    order_total: 'Total : {amount}',
    order_parcelFrom: 'Envoyé par {seller} : ',
    order_trackingNumber: 'Numéro de suivi {carrier} : {number}',
    order_details: 'Détails de la commande : {link}',
    order_refundDefaultReason: 'remboursement',

    order_receipt_subject: 'Votre commande NIXZORA {number}',
    order_receipt_text:
      'Merci pour votre commande !\n\nCommande {number}\n\n{lines}\n\n{totals}\n\nAdresse de livraison :\n{address}\n\nSuivre votre commande : {link}\n',
    order_shipped_subject: 'Votre commande {number} est en route',
    order_shipped_text:
      'Bonne nouvelle : votre commande {number} a été expédiée.\n\n{tracking}Détails de la commande : {link}\n',
    order_cancelled_subject: 'Votre commande {number} a été annulée',
    order_cancelled_text:
      'La commande {number} a été annulée et {amount} ont été remboursés sur votre moyen de paiement d’origine. Les remboursements apparaissent généralement sous 5 à 10 jours ouvrés.\n\nDétails de la commande : {link}\n',
    order_refunded_subject: 'Un remboursement pour la commande {number}',
    order_refunded_text:
      'Nous avons remboursé {amount} pour la commande {number} ({reason}). Le remboursement apparaît généralement sur votre relevé sous 5 à 10 jours ouvrés.\n\nDétails de la commande : {link}\n',
    order_delivered_subject: 'Livrée : commande {number}',
    order_delivered_text:
      'Votre commande {number} a été livrée. Profitez-en bien !\n\nUn problème ? Vous pouvez demander un retour dans les 30 jours depuis la page de votre commande : {link}\n\nN’hésitez pas à laisser un avis une fois le produit essayé.\n',
    order_returnRequested_subject: 'Nous avons reçu votre demande de retour pour {number}',
    order_returnRequested_text:
      'Merci, nous avons bien reçu votre demande de retour pour la commande {number}. Nous l’examinerons sous un jour ouvré et vous enverrons les prochaines étapes par e-mail.\n\nDétails de la commande : {link}\n',
    order_returnApproved_subject: 'Votre retour pour {number} est accepté',
    order_returnApproved_text:
      'Votre retour pour la commande {number} est accepté. Emballez soigneusement les articles et envoyez-les à :\n\nNIXZORA Returns\n100 Warehouse Way\nUpper Marlboro, MD 20774\n\nIndiquez {number} sur le colis. Nous vous remboursons dès sa réception.\n\nDétails de la commande : {link}\n',
    order_returnRejected_subject: 'À propos de votre retour pour {number}',
    order_returnRejected_text:
      'Nous n’avons pas pu accepter la demande de retour pour la commande {number}. Répondez à cet e-mail si vous avez des questions : nous sommes là pour vous aider.\n\nDétails de la commande : {link}\n',

    support_received_subject: 'Nous avons bien reçu votre message ({reference})',
    support_greeting: 'Bonjour,',
    support_greetingName: 'Bonjour {name},',
    support_received_text:
      'Merci d’avoir écrit à NIXZORA. Votre référence est {reference}.\nNous répondons sous un jour ouvré, par e-mail à cette adresse.\n\nVotre message : {subject}\n\n— Le service client NIXZORA',
    support_reply_subject: 'Re: {subject} ({reference})',
    support_reply_text: '{reply}\n\n— Le service client NIXZORA\nRéférence {reference}',

    seller_payout_subject: 'Versement envoyé : {amount}',
    seller_payout_text:
      'Nous avons envoyé {amount} sur le compte bancaire enregistré pour {store}. Le virement arrive généralement sous 2 jours ouvrés.\n\nDétails : {link}\n',
    seller_payout_textTest:
      'Nous avons envoyé {amount} sur le compte bancaire enregistré pour {store}. (Mode test : aucun argent n’a été transféré.)\n\nDétails : {link}\n',
    seller_newOrder_subject: 'Nouvelle commande {number} : à expédier sous 2 jours ouvrés',
    seller_newOrder_line: '  {quantity} × {product} ({variant}), SKU {sku}',
    seller_newOrder_text:
      '{store} a reçu une nouvelle commande.\n\nCommande {number}\n{lines}\n\nVous recevez {amount} après la commission de {commission} %.\n\nExpédiez-la et ajoutez le numéro de suivi ici : {link}\n',

    push_orderPaid_title: 'Commande confirmée',
    push_orderPaid_body: 'Nous avons bien reçu votre commande {number}.',
    push_orderShipped_title: 'En route',
    push_orderShipped_body: 'La commande {number} a été expédiée.',
    push_orderDelivered_title: 'Livrée',
    push_orderDelivered_body: 'La commande {number} a été livrée.',
    push_orderCancelled_title: 'Commande annulée',
    push_orderCancelled_body: 'La commande {number} a été annulée et remboursée.',
    push_orderRefunded_title: 'Remboursement effectué',
    push_orderRefunded_body: 'Nous avons remboursé {amount} pour la commande {number}.',
    push_orderRefunded_bodyNoAmount:
      'Nous avons effectué un remboursement pour la commande {number}.',
    push_returnApproved_title: 'Retour accepté',
    push_returnApproved_body: 'Votre retour pour la commande {number} a été accepté.',
    push_returnRejected_title: 'Mise à jour de votre retour',
    push_returnRejected_body: 'Nous n’avons pas pu accepter le retour pour la commande {number}.',
  },
  es: {
    auth_duplicate_subject: 'Alguien intentó crear una cuenta de NIXZORA con tu correo electrónico',
    auth_duplicate_text: 'Si fuiste tú, inicia sesión o restablece tu contraseña en {link}.',
    auth_verify_subject: 'Confirma tu correo electrónico para NIXZORA',
    auth_verify_text:
      'Confirma tu dirección de correo electrónico: {link}\nEste enlace vence en 24 horas.',
    auth_reset_subject: 'Restablece tu contraseña de NIXZORA',
    auth_reset_text:
      'Restablece tu contraseña: {link}\nEste enlace vence en 30 minutos. Si no lo solicitaste, ignora este correo.',

    order_line: '  {quantity} × {product} ({variant}) — {amount}',
    order_subtotal: 'Subtotal: {amount}',
    order_shipping: 'Envío: {amount}',
    order_shippingFree: 'Gratis',
    order_tax: 'Impuestos: {amount}',
    order_total: 'Total: {amount}',
    order_parcelFrom: 'De {seller}: ',
    order_trackingNumber: 'Número de rastreo de {carrier}: {number}',
    order_details: 'Detalles del pedido: {link}',
    order_refundDefaultReason: 'reembolso',

    order_receipt_subject: 'Tu pedido de NIXZORA {number}',
    order_receipt_text:
      '¡Gracias por tu pedido!\n\nPedido {number}\n\n{lines}\n\n{totals}\n\nEnvío a:\n{address}\n\nRastrea tu pedido: {link}\n',
    order_shipped_subject: 'Tu pedido {number} va en camino',
    order_shipped_text:
      'Buenas noticias: tu pedido {number} ya se envió.\n\n{tracking}Detalles del pedido: {link}\n',
    order_cancelled_subject: 'Tu pedido {number} fue cancelado',
    order_cancelled_text:
      'El pedido {number} fue cancelado y se reembolsaron {amount} a tu método de pago original. Los reembolsos suelen aparecer en un plazo de 5 a 10 días hábiles.\n\nDetalles del pedido: {link}\n',
    order_refunded_subject: 'Un reembolso para el pedido {number}',
    order_refunded_text:
      'Reembolsamos {amount} del pedido {number} ({reason}). Suele aparecer en tu estado de cuenta en un plazo de 5 a 10 días hábiles.\n\nDetalles del pedido: {link}\n',
    order_delivered_subject: 'Entregado: pedido {number}',
    order_delivered_text:
      'Tu pedido {number} fue entregado. ¡Que lo disfrutes!\n\n¿Algo no está bien? Puedes iniciar una devolución dentro de los 30 días desde la página de tu pedido: {link}\n\nNos encantaría que dejaras una reseña cuando lo hayas probado.\n',
    order_returnRequested_subject: 'Recibimos tu solicitud de devolución para {number}',
    order_returnRequested_text:
      'Gracias, recibimos tu solicitud de devolución del pedido {number}. La revisaremos en un día hábil y te enviaremos los siguientes pasos por correo.\n\nDetalles del pedido: {link}\n',
    order_returnApproved_subject: 'Tu devolución para {number} fue aprobada',
    order_returnApproved_text:
      'Tu devolución del pedido {number} fue aprobada. Empaca los artículos de forma segura y envíalos a:\n\nNIXZORA Returns\n100 Warehouse Way\nUpper Marlboro, MD 20774\n\nEscribe {number} en la caja. Te reembolsamos en cuanto llegue.\n\nDetalles del pedido: {link}\n',
    order_returnRejected_subject: 'Sobre tu devolución para {number}',
    order_returnRejected_text:
      'No pudimos aceptar la solicitud de devolución del pedido {number}. Responde a este correo si tienes preguntas; con gusto te ayudamos.\n\nDetalles del pedido: {link}\n',

    support_received_subject: 'Recibimos tu mensaje ({reference})',
    support_greeting: 'Hola:',
    support_greetingName: 'Hola, {name}:',
    support_received_text:
      'Gracias por escribir a NIXZORA. Tu número de referencia es {reference}.\nRespondemos en un día hábil, por correo a esta dirección.\n\nTu mensaje: {subject}\n\n— Atención al cliente de NIXZORA',
    support_reply_subject: 'Re: {subject} ({reference})',
    support_reply_text: '{reply}\n\n— Atención al cliente de NIXZORA\nReferencia {reference}',

    seller_payout_subject: 'Pago enviado: {amount}',
    seller_payout_text:
      'Enviamos {amount} a la cuenta bancaria registrada de {store}. Suele llegar en un plazo de 2 días hábiles.\n\nDetalles: {link}\n',
    seller_payout_textTest:
      'Enviamos {amount} a la cuenta bancaria registrada de {store}. (Modo de prueba: no se movió dinero).\n\nDetalles: {link}\n',
    seller_newOrder_subject: 'Nuevo pedido {number}: envíalo en un plazo de 2 días hábiles',
    seller_newOrder_line: '  {quantity} × {product} ({variant}), SKU {sku}',
    seller_newOrder_text:
      '{store} tiene un nuevo pedido.\n\nPedido {number}\n{lines}\n\nGanas {amount} después de la comisión del {commission} %.\n\nEnvíalo y agrega el número de rastreo aquí: {link}\n',

    push_orderPaid_title: 'Pedido confirmado',
    push_orderPaid_body: 'Recibimos tu pedido {number}.',
    push_orderShipped_title: 'Va en camino',
    push_orderShipped_body: 'El pedido {number} ya se envió.',
    push_orderDelivered_title: 'Entregado',
    push_orderDelivered_body: 'El pedido {number} fue entregado.',
    push_orderCancelled_title: 'Pedido cancelado',
    push_orderCancelled_body: 'El pedido {number} fue cancelado y reembolsado.',
    push_orderRefunded_title: 'Reembolso emitido',
    push_orderRefunded_body: 'Reembolsamos {amount} del pedido {number}.',
    push_orderRefunded_bodyNoAmount: 'Emitimos un reembolso para el pedido {number}.',
    push_returnApproved_title: 'Devolución aprobada',
    push_returnApproved_body: 'Tu devolución del pedido {number} fue aprobada.',
    push_returnRejected_title: 'Actualización de tu devolución',
    push_returnRejected_body: 'No pudimos aceptar la devolución del pedido {number}.',
  },
});
