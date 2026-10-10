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
    auth_signin_added_subject: 'A new way to sign in was added to your NIXZORA account',
    auth_signin_added_text:
      '{method} was added to your NIXZORA account: {name}.\nIf this was not you, remove it and change your password: {link}',
    auth_method_passkey: 'A passkey',
    auth_method_device: 'Face ID / fingerprint sign-in',
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
    // HTML version of order emails (the text version above is always sent too)
    order_html_thanks: "Thanks for your order! Here's your receipt.",
    order_html_items: 'Items',
    order_html_itemDetail: 'Qty {quantity} · {variant}',
    order_html_subtotal: 'Subtotal',
    order_html_shipping: 'Shipping',
    order_html_tax: 'Tax',
    order_html_total: 'Total',
    order_html_shipTo: 'Shipping to',
    referral_aFriend: 'your friend',
    referral_reward_subject: 'You earned {amount} for inviting {friend}',
    referral_reward_text:
      '{friend} placed their first order with your invite, so we added {amount} to your NIXZORA balance. It comes off your next order automatically.\n\nSee your invites: {link}',
    order_giftWrap: 'Gift wrap: {amount}',
    order_html_giftWrap: 'Gift wrap',
    order_html_gift: 'Gift',
    order_giftNoPrices: 'Sent as a gift: no prices in the box.',
    order_giftFrom: 'From {from}',
    order_html_viewOrder: 'View your order',
    order_html_track: 'Track package',
    order_html_footer:
      'You received this email because you placed an order on NIXZORA. Questions? Just reply to this email.',

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
    seller_newOrder_heldSubject: 'New order {number}: on hold, do not ship yet',
    seller_orderCleared_subject: 'Order {number} is cleared: ship it now',
    seller_orderCleared_text:
      '{store}: we finished checking order {number}. Ship it and add the tracking number here: {link}\n',
    seller_payoutsVerified_subject: 'Payouts to {store} are on',
    seller_payoutsVerified_text:
      'Stripe has verified {store}. Earnings now go to your bank account with the daily payout once their holding period ends.\n\nEarnings: {link}\n',
    seller_payoutsActionNeeded_subject: 'Stripe needs something from {store}',
    seller_payoutsActionNeeded_text:
      'Stripe needs more information before it can pay {store}. Until then, earnings wait in your balance; nothing is lost.\n\nFinish it on Stripe: {link}\n',
    seller_payoutsResumed_subject: 'Payouts to {store} have restarted',
    seller_payoutsResumed_text:
      'We finished reviewing recent activity on {store}. Payouts have restarted: your available balance goes out with the next daily payout.\n\nEarnings: {link}\n',
    seller_applied_subject: 'We received your application for {store}',
    seller_applied_text:
      'Thanks for applying to sell on NIXZORA as {store}.\n\nNext, verify your identity and add a bank account with Stripe, so we can pay you. We review your application once that is done and email you the result. Meanwhile you can prepare your listings.\n\nSeller portal: {link}\n',
    seller_approved_subject: '{store} is open on NIXZORA',
    seller_approved_text:
      'Your application was approved: {store} is open. Listings you submit get a quick review before they appear in your store.\n\nYour store: {storeLink}\nSeller portal: {link}\n',
    seller_reinstated_subject: '{store} is open again',
    seller_reinstated_text:
      '{store} is open again. Listings you had live went back to drafts when the store was paused: submit them again to put them back in your store.\n\nSeller portal: {link}\n',
    seller_rejected_subject: 'Your application for {store}',
    seller_rejected_text:
      'We could not approve {store} on NIXZORA.{reason}\n\nQuestions? Reply to this email.\n',
    seller_suspended_subject: '{store} is paused',
    seller_suspended_text:
      'We paused {store} on NIXZORA: its listings are hidden from the store for now.{reason}\n\nQuestions? Reply to this email.\n\nSeller portal: {link}\n',
    seller_reason: '\n\nReason: {reason}',
    seller_newOrder_heldNote:
      'We are checking this order before it ships. Do not ship it yet: we will email you as soon as it is cleared.',
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
    alert_backInStock_subject: 'Back in stock: {title}',
    alert_backInStock_text:
      '{title} is back in stock at {price}. Stock can go quickly.\n\n{link}\n\nYou asked us to tell you. Turn these alerts off in your preferences: {prefs}\n',
    alert_priceDrop_subject: 'Price drop: {title} is now {price}',
    alert_priceDrop_text:
      '{title}, which you saved, is now {price} (was {was}).\n\n{link}\n\nTurn price and stock alerts off in your preferences: {prefs}\n',
    giftCard_subject: '{sender} sent you a {amount} NIXZORA gift card',
    giftCard_text:
      'Hi {recipient},\n\n{sender} sent you a NIXZORA gift card worth {amount}.\n{message}\nYour code: {code}\n\nTo use it, sign in and add the code under Your account › Gift cards: {link}\nThe balance is spent first at checkout. It never expires and has no fees.\n\nKeep this code private: anyone who has it can add the money to their account.\n',
    sub_failed_subject: 'We couldn’t charge your Subscribe & Save delivery',
    sub_failed_text:
      'Hi,\n\nWe couldn’t charge your card for Subscribe & Save order {number} ({items}).\n{problem}\n\nPay for it here to send it on its way: {payLink}\nOr choose another card for your subscriptions: {subsLink}\n',
    msg_new_subject: 'New message from {from}: {subject}',
    msg_new_text:
      '{from} wrote:\n\n{body}\n\nReply on NIXZORA: {link}\n\nFor your safety, keep conversations and payments on NIXZORA.\n',
    push_message_title: 'Message from {from}',
    sub_created_subject: 'You subscribed to {item}',
    sub_created_text:
      'You subscribed to {item}: {quantity} every {interval}, at {percent} off (10% when 3 or more subscriptions arrive together).\n\nWe charge {card} for each delivery until you cancel. Your next one is planned for {date}.\n\nChange, skip or cancel any time: {subsLink}\n',
    sub_paused_subject: 'Your Subscribe & Save deliveries are paused',
    sub_paused_text:
      'After {count} declined charges in a row we paused: {items}.\n\nUpdate your card and resume them here: {subsLink}\n',
    sub_skipped_subject: 'Your Subscribe & Save delivery was skipped',
    sub_skipped_text:
      'We couldn’t order {items} today: {reason}\nThe next delivery is planned for {date}.\n\nManage your subscriptions: {subsLink}\n',
    push_subFailed_title: 'Payment needed',
    push_subFailed_body: 'Your Subscribe & Save order {number} couldn’t be charged.',
    giftCard_sent_subject: 'Your gift card for {recipient} is on its way',
    giftCard_sent_text:
      'We emailed your {amount} NIXZORA gift card to {recipient} ({email}).\n\nOrder {number}: {orderLink}\n',
    push_backInStock_title: 'Back in stock',
    push_backInStock_body: '{title} is available again: {price}.',
    push_priceDrop_title: 'Price drop',
    push_priceDrop_body: '{title} is now {price} (was {was}).',
    plus_trial_subject: 'Welcome to NIXZORA Plus: your free trial has started',
    plus_trial_text:
      'Your 30-day free trial runs until {date}. Enjoy free 2-day delivery on items NIXZORA ships, free standard shipping on everything else, member deal prices and early access to lightning deals.\n\nAfter the trial, Plus renews at {price} {per} on {card} until you cancel. Cancel before {date} and you won’t be charged.\n\nManage your membership: {link}\n',
    plus_joined_subject: 'Welcome to NIXZORA Plus',
    plus_joined_text:
      'Thanks for joining. We charged {price} for your {plan} membership, which renews on {date} at {price} until you cancel.\n\nCancel any time; you keep the benefits until {date}: {link}\n',
    plus_renewed_subject: 'Your NIXZORA Plus membership renewed',
    plus_renewed_text:
      'We charged {price} for another {period} of NIXZORA Plus. Your next renewal is on {date}.\n\nManage your membership: {link}\n',
    plus_reminder_subject: 'NIXZORA Plus renews on {date}',
    plus_reminder_text:
      'Your {what} ends on {date}. Then Plus renews at {price} {per} on {card}.\n\nNothing to do if you’d like to keep it. To cancel, or to choose another card or plan: {link}\n',
    plus_reminder_trial: 'free trial',
    plus_reminder_period: 'current membership period',
    plus_noCard: 'the card you add before then',
    plus_failed_subject: 'We couldn’t renew your NIXZORA Plus membership',
    plus_failed_text:
      'Your Plus renewal of {price} couldn’t be charged{problem}. Your benefits continue until {graceDate} while we try again.\n\nPay now, with any card: {payLink}\n\nManage your membership: {link}\n',
    plus_ended_subject: 'Your NIXZORA Plus membership has ended',
    plus_ended_text:
      'Your Plus membership ended on {date}. Thanks for being a member.\n\nRejoin any time: {link}\n',
    plus_leaving_subject: 'You’ve cancelled NIXZORA Plus',
    plus_leaving_text:
      'Your membership won’t renew. You keep free shipping and member prices until {date}.\n\nChanged your mind? Keep Plus here: {link}\n',
    plus_per_MONTHLY: 'a month',
    plus_per_YEARLY: 'a year',
    plus_period_MONTHLY: 'month',
    plus_period_YEARLY: 'year',
    plus_plan_MONTHLY: 'monthly',
    plus_plan_YEARLY: 'yearly',
    push_plusFailed_title: 'NIXZORA Plus payment needed',
    push_plusFailed_body: 'Your Plus renewal couldn’t be charged. Your benefits continue for now.',
  },
  fr: {
    auth_duplicate_subject:
      'Quelqu’un a essayé de créer un compte NIXZORA avec votre adresse e-mail',
    auth_duplicate_text:
      'Si c’était vous, connectez-vous ou réinitialisez votre mot de passe sur {link}.',
    auth_signin_added_subject: 'Un nouveau moyen de connexion a été ajouté à votre compte NIXZORA',
    auth_signin_added_text:
      '{method} a été ajouté(e) à votre compte NIXZORA : {name}.\nSi ce n’était pas vous, supprimez-le et changez votre mot de passe : {link}',
    auth_method_passkey: 'Une clé d’accès',
    auth_method_device: 'La connexion par Face ID / empreinte',
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
    order_html_thanks: 'Merci pour votre commande ! Voici votre reçu.',
    order_html_items: 'Articles',
    order_html_itemDetail: 'Qté {quantity} · {variant}',
    order_html_subtotal: 'Sous-total',
    order_html_shipping: 'Livraison',
    order_html_tax: 'Taxes',
    order_html_total: 'Total',
    order_html_shipTo: 'Livraison à',
    referral_aFriend: 'votre ami',
    referral_reward_subject: 'Vous avez gagné {amount} en parrainant {friend}',
    referral_reward_text:
      '{friend} a passé sa première commande grâce à votre invitation : nous avons ajouté {amount} à votre solde NIXZORA. Il sera déduit de votre prochaine commande.\n\nVos invitations : {link}',
    order_giftWrap: 'Emballage cadeau : {amount}',
    order_html_giftWrap: 'Emballage cadeau',
    order_html_gift: 'Cadeau',
    order_giftNoPrices: 'Envoyé en cadeau : aucun prix dans le colis.',
    order_giftFrom: 'De la part de {from}',
    order_html_viewOrder: 'Voir votre commande',
    order_html_track: 'Suivre le colis',
    order_html_footer:
      'Vous recevez cet e-mail car vous avez passé une commande sur NIXZORA. Une question ? Répondez simplement à cet e-mail.',

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
    seller_newOrder_heldSubject:
      'Nouvelle commande {number} : en attente, ne l’expédiez pas encore',
    seller_orderCleared_subject: 'Commande {number} validée : expédiez-la maintenant',
    seller_orderCleared_text:
      '{store} : nous avons fini de vérifier la commande {number}. Expédiez-la et ajoutez le numéro de suivi ici : {link}\n',
    seller_payoutsVerified_subject: 'Les versements à {store} sont activés',
    seller_payoutsVerified_text:
      'Stripe a vérifié {store}. Vos revenus partent désormais sur votre compte bancaire avec le versement quotidien, une fois leur période de rétention terminée.\n\nRevenus : {link}\n',
    seller_payoutsActionNeeded_subject: 'Stripe a besoin d’informations pour {store}',
    seller_payoutsActionNeeded_text:
      'Stripe a besoin d’informations supplémentaires avant de pouvoir payer {store}. D’ici là, vos revenus restent dans votre solde ; rien n’est perdu.\n\nTerminer sur Stripe : {link}\n',
    seller_payoutsResumed_subject: 'Les versements à {store} ont repris',
    seller_payoutsResumed_text:
      'Nous avons fini de vérifier l’activité récente de {store}. Les versements ont repris : votre solde disponible part avec le prochain versement quotidien.\n\nRevenus : {link}\n',
    seller_applied_subject: 'Nous avons reçu votre candidature pour {store}',
    seller_applied_text:
      'Merci d’avoir demandé à vendre sur NIXZORA en tant que {store}.\n\nProchaine étape : vérifiez votre identité et ajoutez un compte bancaire avec Stripe, pour que nous puissions vous payer. Nous examinons votre candidature une fois cette étape terminée et vous écrivons le résultat. En attendant, vous pouvez préparer vos annonces.\n\nEspace vendeur : {link}\n',
    seller_approved_subject: '{store} est ouverte sur NIXZORA',
    seller_approved_text:
      'Votre candidature est acceptée : {store} est ouverte. Les annonces que vous soumettez passent une vérification rapide avant d’apparaître dans votre boutique.\n\nVotre boutique : {storeLink}\nEspace vendeur : {link}\n',
    seller_reinstated_subject: '{store} est de nouveau ouverte',
    seller_reinstated_text:
      '{store} est de nouveau ouverte. Vos annonces en ligne sont repassées en brouillon pendant la pause : soumettez-les à nouveau pour les remettre dans votre boutique.\n\nEspace vendeur : {link}\n',
    seller_rejected_subject: 'Votre candidature pour {store}',
    seller_rejected_text:
      'Nous n’avons pas pu accepter {store} sur NIXZORA.{reason}\n\nDes questions ? Répondez à cet e-mail.\n',
    seller_suspended_subject: '{store} est en pause',
    seller_suspended_text:
      'Nous avons mis {store} en pause sur NIXZORA : ses annonces sont masquées pour le moment.{reason}\n\nDes questions ? Répondez à cet e-mail.\n\nEspace vendeur : {link}\n',
    seller_reason: '\n\nMotif : {reason}',
    seller_newOrder_heldNote:
      'Nous vérifions cette commande avant son expédition. Ne l’expédiez pas encore : nous vous écrirons dès qu’elle sera validée.',
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
    alert_backInStock_subject: 'De retour en stock : {title}',
    alert_backInStock_text:
      '{title} est de nouveau en stock à {price}. Le stock peut partir vite.\n\n{link}\n\nVous nous avez demandé de vous prévenir. Désactivez ces alertes dans vos préférences : {prefs}\n',
    alert_priceDrop_subject: 'Baisse de prix : {title} est à {price}',
    alert_priceDrop_text:
      '{title}, que vous avez enregistré, est maintenant à {price} (au lieu de {was}).\n\n{link}\n\nDésactivez les alertes de prix et de stock dans vos préférences : {prefs}\n',
    giftCard_subject: '{sender} vous offre une carte cadeau NIXZORA de {amount}',
    giftCard_text:
      'Bonjour {recipient},\n\n{sender} vous offre une carte cadeau NIXZORA d’une valeur de {amount}.\n{message}\nVotre code : {code}\n\nPour l’utiliser, connectez-vous et ajoutez le code dans Votre compte › Cartes cadeaux : {link}\nLe solde est utilisé en premier au paiement. Il n’expire jamais et n’a aucun frais.\n\nGardez ce code pour vous : toute personne qui le possède peut ajouter cet argent à son compte.\n',
    sub_failed_subject: 'Nous n’avons pas pu débiter votre livraison Abonnez-vous et économisez',
    sub_failed_text:
      'Bonjour,\n\nNous n’avons pas pu débiter votre carte pour la commande Abonnez-vous et économisez {number} ({items}).\n{problem}\n\nPayez-la ici pour qu’elle parte : {payLink}\nOu choisissez une autre carte pour vos abonnements : {subsLink}\n',
    msg_new_subject: 'Nouveau message de {from} : {subject}',
    msg_new_text:
      '{from} a écrit :\n\n{body}\n\nRépondez sur NIXZORA : {link}\n\nPour votre sécurité, gardez les échanges et les paiements sur NIXZORA.\n',
    push_message_title: 'Message de {from}',
    sub_created_subject: 'Vous êtes abonné à {item}',
    sub_created_text:
      'Vous êtes abonné à {item} : {quantity} tous les {interval}, avec {percent} de réduction (10 % quand 3 abonnements ou plus arrivent ensemble).\n\nNous débitons {card} à chaque livraison jusqu’à ce que vous annuliez. La prochaine est prévue le {date}.\n\nModifiez, sautez ou annulez à tout moment : {subsLink}\n',
    sub_paused_subject: 'Vos livraisons Abonnez-vous et économisez sont en pause',
    sub_paused_text:
      'Après {count} refus de paiement d’affilée, nous avons mis en pause : {items}.\n\nMettez à jour votre carte et relancez-les ici : {subsLink}\n',
    sub_skipped_subject: 'Votre livraison Abonnez-vous et économisez a été sautée',
    sub_skipped_text:
      'Nous n’avons pas pu commander {items} aujourd’hui : {reason}\nLa prochaine livraison est prévue le {date}.\n\nGérez vos abonnements : {subsLink}\n',
    push_subFailed_title: 'Paiement nécessaire',
    push_subFailed_body: 'Votre commande d’abonnement {number} n’a pas pu être débitée.',
    giftCard_sent_subject: 'Votre carte cadeau pour {recipient} est en route',
    giftCard_sent_text:
      'Nous avons envoyé votre carte cadeau NIXZORA de {amount} à {recipient} ({email}).\n\nCommande {number} : {orderLink}\n',
    push_backInStock_title: 'De retour en stock',
    push_backInStock_body: '{title} est de nouveau disponible : {price}.',
    push_priceDrop_title: 'Baisse de prix',
    push_priceDrop_body: '{title} est maintenant à {price} (au lieu de {was}).',
    plus_trial_subject: 'Bienvenue dans NIXZORA Plus : votre essai gratuit commence',
    plus_trial_text:
      'Votre essai gratuit de 30 jours dure jusqu’au {date}. Profitez de la livraison gratuite en 2 jours sur les articles expédiés par NIXZORA, de la livraison standard gratuite sur tout le reste, des prix réservés aux membres et de l’accès anticipé aux offres éclair.\n\nAprès l’essai, Plus se renouvelle à {price} {per} sur {card} jusqu’à ce que vous annuliez. Annulez avant le {date} et vous ne serez pas débité.\n\nGérer votre abonnement : {link}\n',
    plus_joined_subject: 'Bienvenue dans NIXZORA Plus',
    plus_joined_text:
      'Merci de nous avoir rejoints. Nous avons débité {price} pour votre abonnement {plan}, qui se renouvelle le {date} à {price} jusqu’à ce que vous annuliez.\n\nAnnulez à tout moment ; vous gardez les avantages jusqu’au {date} : {link}\n',
    plus_renewed_subject: 'Votre abonnement NIXZORA Plus est renouvelé',
    plus_renewed_text:
      'Nous avons débité {price} pour un {period} de plus de NIXZORA Plus. Prochain renouvellement le {date}.\n\nGérer votre abonnement : {link}\n',
    plus_reminder_subject: 'NIXZORA Plus se renouvelle le {date}',
    plus_reminder_text:
      'Votre {what} se termine le {date}. Plus se renouvelle ensuite à {price} {per} sur {card}.\n\nRien à faire pour le garder. Pour annuler, ou choisir une autre carte ou formule : {link}\n',
    plus_reminder_trial: 'essai gratuit',
    plus_reminder_period: 'période d’abonnement en cours',
    plus_noCard: 'la carte que vous ajouterez d’ici là',
    plus_failed_subject: 'Nous n’avons pas pu renouveler votre abonnement NIXZORA Plus',
    plus_failed_text:
      'Le renouvellement de Plus ({price}) n’a pas pu être débité{problem}. Vos avantages continuent jusqu’au {graceDate} pendant que nous réessayons.\n\nPayer maintenant, avec n’importe quelle carte : {payLink}\n\nGérer votre abonnement : {link}\n',
    plus_ended_subject: 'Votre abonnement NIXZORA Plus a pris fin',
    plus_ended_text:
      'Votre abonnement Plus a pris fin le {date}. Merci d’avoir été membre.\n\nRevenez quand vous voulez : {link}\n',
    plus_leaving_subject: 'Vous avez résilié NIXZORA Plus',
    plus_leaving_text:
      'Votre abonnement ne sera pas renouvelé. Vous gardez la livraison gratuite et les prix membres jusqu’au {date}.\n\nVous changez d’avis ? Gardez Plus ici : {link}\n',
    plus_per_MONTHLY: 'par mois',
    plus_per_YEARLY: 'par an',
    plus_period_MONTHLY: 'mois',
    plus_period_YEARLY: 'an',
    plus_plan_MONTHLY: 'mensuel',
    plus_plan_YEARLY: 'annuel',
    push_plusFailed_title: 'Paiement NIXZORA Plus nécessaire',
    push_plusFailed_body:
      'Le renouvellement de Plus n’a pas pu être débité. Vos avantages continuent pour l’instant.',
  },
  es: {
    auth_duplicate_subject: 'Alguien intentó crear una cuenta de NIXZORA con tu correo electrónico',
    auth_duplicate_text: 'Si fuiste tú, inicia sesión o restablece tu contraseña en {link}.',
    auth_signin_added_subject: 'Se agregó una nueva forma de iniciar sesión a tu cuenta de NIXZORA',
    auth_signin_added_text:
      'Se agregó {method} a tu cuenta de NIXZORA: {name}.\nSi no fuiste tú, elimínalo y cambia tu contraseña: {link}',
    auth_method_passkey: 'una llave de acceso',
    auth_method_device: 'el inicio de sesión con Face ID / huella',
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
    order_html_thanks: '¡Gracias por tu pedido! Aquí tienes tu recibo.',
    order_html_items: 'Artículos',
    order_html_itemDetail: 'Cant. {quantity} · {variant}',
    order_html_subtotal: 'Subtotal',
    order_html_shipping: 'Envío',
    order_html_tax: 'Impuestos',
    order_html_total: 'Total',
    order_html_shipTo: 'Envío a',
    referral_aFriend: 'tu amigo',
    referral_reward_subject: 'Ganaste {amount} por invitar a {friend}',
    referral_reward_text:
      '{friend} hizo su primer pedido con tu invitación, así que añadimos {amount} a tu saldo de NIXZORA. Se descuenta en tu próximo pedido.\n\nTus invitaciones: {link}',
    order_giftWrap: 'Envoltorio de regalo: {amount}',
    order_html_giftWrap: 'Envoltorio de regalo',
    order_html_gift: 'Regalo',
    order_giftNoPrices: 'Enviado como regalo: sin precios en el paquete.',
    order_giftFrom: 'De parte de {from}',
    order_html_viewOrder: 'Ver tu pedido',
    order_html_track: 'Rastrear paquete',
    order_html_footer:
      'Recibes este correo porque hiciste un pedido en NIXZORA. ¿Preguntas? Responde a este correo.',

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
    seller_newOrder_heldSubject: 'Nuevo pedido {number}: en espera, no lo envíes todavía',
    seller_orderCleared_subject: 'Pedido {number} aprobado: envíalo ya',
    seller_orderCleared_text:
      '{store}: terminamos de revisar el pedido {number}. Envíalo y añade el número de seguimiento aquí: {link}\n',
    seller_payoutsVerified_subject: 'Los pagos a {store} están activados',
    seller_payoutsVerified_text:
      'Stripe verificó {store}. Tus ganancias ahora van a tu cuenta bancaria con el pago diario, cuando termina su periodo de retención.\n\nGanancias: {link}\n',
    seller_payoutsActionNeeded_subject: 'Stripe necesita algo de {store}',
    seller_payoutsActionNeeded_text:
      'Stripe necesita más información antes de poder pagar a {store}. Mientras tanto, tus ganancias esperan en tu saldo; no se pierde nada.\n\nTermínalo en Stripe: {link}\n',
    seller_payoutsResumed_subject: 'Los pagos a {store} se han reanudado',
    seller_payoutsResumed_text:
      'Terminamos de revisar la actividad reciente de {store}. Los pagos se han reanudado: tu saldo disponible sale con el próximo pago diario.\n\nGanancias: {link}\n',
    seller_applied_subject: 'Recibimos tu solicitud para {store}',
    seller_applied_text:
      'Gracias por solicitar vender en NIXZORA como {store}.\n\nSiguiente paso: verifica tu identidad y agrega una cuenta bancaria con Stripe, para que podamos pagarte. Revisamos tu solicitud cuando termines y te escribimos con el resultado. Mientras tanto, puedes preparar tus anuncios.\n\nPortal de vendedor: {link}\n',
    seller_approved_subject: '{store} está abierta en NIXZORA',
    seller_approved_text:
      'Tu solicitud fue aprobada: {store} está abierta. Los anuncios que envíes pasan una revisión rápida antes de aparecer en tu tienda.\n\nTu tienda: {storeLink}\nPortal de vendedor: {link}\n',
    seller_reinstated_subject: '{store} está abierta de nuevo',
    seller_reinstated_text:
      '{store} está abierta de nuevo. Los anuncios que tenías publicados volvieron a borrador durante la pausa: envíalos otra vez para que vuelvan a tu tienda.\n\nPortal de vendedor: {link}\n',
    seller_rejected_subject: 'Tu solicitud para {store}',
    seller_rejected_text:
      'No pudimos aprobar {store} en NIXZORA.{reason}\n\n¿Preguntas? Responde a este correo.\n',
    seller_suspended_subject: '{store} está en pausa',
    seller_suspended_text:
      'Pusimos {store} en pausa en NIXZORA: sus anuncios están ocultos por ahora.{reason}\n\n¿Preguntas? Responde a este correo.\n\nPortal de vendedor: {link}\n',
    seller_reason: '\n\nMotivo: {reason}',
    seller_newOrder_heldNote:
      'Estamos revisando este pedido antes del envío. No lo envíes todavía: te escribiremos en cuanto se apruebe.',
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
    alert_backInStock_subject: 'De nuevo disponible: {title}',
    alert_backInStock_text:
      '{title} vuelve a estar disponible por {price}. Puede agotarse pronto.\n\n{link}\n\nNos pediste que te avisáramos. Desactiva estos avisos en tus preferencias: {prefs}\n',
    alert_priceDrop_subject: 'Bajó de precio: {title} ahora cuesta {price}',
    alert_priceDrop_text:
      '{title}, que guardaste, ahora cuesta {price} (antes {was}).\n\n{link}\n\nDesactiva los avisos de precio y disponibilidad en tus preferencias: {prefs}\n',
    giftCard_subject: '{sender} te envió una tarjeta de regalo NIXZORA de {amount}',
    giftCard_text:
      'Hola {recipient}:\n\n{sender} te envió una tarjeta de regalo NIXZORA por {amount}.\n{message}\nTu código: {code}\n\nPara usarla, inicia sesión y agrega el código en Tu cuenta › Tarjetas de regalo: {link}\nEl saldo se usa primero al pagar. Nunca vence y no tiene cargos.\n\nNo compartas este código: cualquiera que lo tenga puede agregar el dinero a su cuenta.\n',
    sub_failed_subject: 'No pudimos cobrar tu entrega de Suscríbete y ahorra',
    sub_failed_text:
      'Hola:\n\nNo pudimos cobrar tu tarjeta para el pedido de Suscríbete y ahorra {number} ({items}).\n{problem}\n\nPágalo aquí para que salga: {payLink}\nO elige otra tarjeta para tus suscripciones: {subsLink}\n',
    msg_new_subject: 'Nuevo mensaje de {from}: {subject}',
    msg_new_text:
      '{from} escribió:\n\n{body}\n\nResponde en NIXZORA: {link}\n\nPor tu seguridad, mantén las conversaciones y los pagos en NIXZORA.\n',
    push_message_title: 'Mensaje de {from}',
    sub_created_subject: 'Te suscribiste a {item}',
    sub_created_text:
      'Te suscribiste a {item}: {quantity} cada {interval}, con {percent} de descuento (10 % cuando llegan juntas 3 suscripciones o más).\n\nCobramos a {card} en cada entrega hasta que canceles. La próxima está prevista para el {date}.\n\nCambia, salta o cancela cuando quieras: {subsLink}\n',
    sub_paused_subject: 'Tus entregas de Suscríbete y ahorra están en pausa',
    sub_paused_text:
      'Después de {count} cobros rechazados seguidos pausamos: {items}.\n\nActualiza tu tarjeta y reanúdalas aquí: {subsLink}\n',
    sub_skipped_subject: 'Se saltó tu entrega de Suscríbete y ahorra',
    sub_skipped_text:
      'Hoy no pudimos pedir {items}: {reason}\nLa próxima entrega está prevista para el {date}.\n\nAdministra tus suscripciones: {subsLink}\n',
    push_subFailed_title: 'Pago pendiente',
    push_subFailed_body: 'No pudimos cobrar tu pedido de suscripción {number}.',
    giftCard_sent_subject: 'Tu tarjeta de regalo para {recipient} va en camino',
    giftCard_sent_text:
      'Enviamos tu tarjeta de regalo NIXZORA de {amount} a {recipient} ({email}).\n\nPedido {number}: {orderLink}\n',
    push_backInStock_title: 'De nuevo disponible',
    push_backInStock_body: '{title} vuelve a estar disponible: {price}.',
    push_priceDrop_title: 'Bajó de precio',
    push_priceDrop_body: '{title} ahora cuesta {price} (antes {was}).',
    plus_trial_subject: 'Bienvenido a NIXZORA Plus: empezó tu prueba gratis',
    plus_trial_text:
      'Tu prueba gratis de 30 días dura hasta el {date}. Disfruta de envío gratis en 2 días en artículos que envía NIXZORA, envío estándar gratis en todo lo demás, precios para miembros y acceso anticipado a las ofertas relámpago.\n\nDespués de la prueba, Plus se renueva a {price} {per} en {card} hasta que canceles. Cancela antes del {date} y no se te cobrará.\n\nAdministra tu membresía: {link}\n',
    plus_joined_subject: 'Bienvenido a NIXZORA Plus',
    plus_joined_text:
      'Gracias por unirte. Cobramos {price} por tu membresía {plan}, que se renueva el {date} a {price} hasta que canceles.\n\nCancela cuando quieras; conservas los beneficios hasta el {date}: {link}\n',
    plus_renewed_subject: 'Tu membresía NIXZORA Plus se renovó',
    plus_renewed_text:
      'Cobramos {price} por otro {period} de NIXZORA Plus. Tu próxima renovación es el {date}.\n\nAdministra tu membresía: {link}\n',
    plus_reminder_subject: 'NIXZORA Plus se renueva el {date}',
    plus_reminder_text:
      'Tu {what} termina el {date}. Después, Plus se renueva a {price} {per} en {card}.\n\nNo tienes que hacer nada para conservarla. Para cancelar, o elegir otra tarjeta o plan: {link}\n',
    plus_reminder_trial: 'prueba gratis',
    plus_reminder_period: 'periodo actual de membresía',
    plus_noCard: 'la tarjeta que agregues antes',
    plus_failed_subject: 'No pudimos renovar tu membresía NIXZORA Plus',
    plus_failed_text:
      'No se pudo cobrar la renovación de Plus ({price}){problem}. Tus beneficios siguen hasta el {graceDate} mientras lo intentamos de nuevo.\n\nPaga ahora, con cualquier tarjeta: {payLink}\n\nAdministra tu membresía: {link}\n',
    plus_ended_subject: 'Tu membresía NIXZORA Plus terminó',
    plus_ended_text:
      'Tu membresía Plus terminó el {date}. Gracias por ser miembro.\n\nVuelve cuando quieras: {link}\n',
    plus_leaving_subject: 'Cancelaste NIXZORA Plus',
    plus_leaving_text:
      'Tu membresía no se renovará. Conservas el envío gratis y los precios para miembros hasta el {date}.\n\n¿Cambiaste de opinión? Conserva Plus aquí: {link}\n',
    plus_per_MONTHLY: 'al mes',
    plus_per_YEARLY: 'al año',
    plus_period_MONTHLY: 'mes',
    plus_period_YEARLY: 'año',
    plus_plan_MONTHLY: 'mensual',
    plus_plan_YEARLY: 'anual',
    push_plusFailed_title: 'Pago de NIXZORA Plus necesario',
    push_plusFailed_body:
      'No se pudo cobrar la renovación de Plus. Tus beneficios siguen por ahora.',
  },
});
