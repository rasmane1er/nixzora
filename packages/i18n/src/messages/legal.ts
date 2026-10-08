import { defineMessages } from '../define';

/** About, return and shipping policies, privacy policy and terms of service. */
export const legal = defineMessages({
  en: {
    lastUpdated: 'Last updated {date}',
    translationNote: 'This translation is provided for convenience; the English version prevails.',

    // About
    aboutTitle: 'About NIXZORA',
    aboutDescription: 'Computers and electronics, explained: who we are and how NIXZORA works.',
    aboutIntro:
      'NIXZORA sells computers and electronics with clear specs and honest advice. Tell our shopping assistant what you need in your own words, and it finds products that fit, explains why, and builds the cart.',
    aboutTrustTitle: 'A marketplace you can trust',
    aboutTrustBody:
      'Next to our own products, independent stores sell on NIXZORA. Every store is verified before it opens, every listing is reviewed before it goes live, and every order, whoever ships it, has the same checkout, the same <returns>30-day returns</returns> and the same support.',
    aboutDataTitle: 'How we treat your data',
    aboutDataBody:
      'Card details never reach our servers, and you can download or delete your data at any time from your account. Read the <privacy>privacy policy</privacy>.',
    aboutSellTitle: 'Sell with us',
    aboutSellBody: 'Run a store? <sell>Open a NIXZORA store</sell>.',

    // Return policy
    returnsTitle: 'Return policy',
    returnsDescription: 'Returns and refunds at NIXZORA.',
    returnsWindowTitle: '30 days',
    returnsWindowBody:
      'You can return most items within 30 days of delivery, in their original condition and with their accessories. This includes items from marketplace sellers.',
    returnsHowTitle: 'How to return',
    returnsHowBody:
      'Open the order in <orders>Your orders</orders>, choose “Return or replace items”, pick the items and a reason. We approve it and tell you how to send it back. Follow the steps in <returns>Returns & refunds</returns>.',
    returnsRefundsTitle: 'Refunds',
    returnsRefundsBody:
      'When the item arrives back with us, we refund what you paid for it to the card you used, including its share of tax, less its share of any coupon discount. Banks usually show the refund within 5–10 business days.',
    returnsDamagedTitle: 'Damaged or wrong items',
    returnsDamagedBody:
      'Choose “Arrived damaged” or “Wrong item sent” as the reason. Questions? <contact>Contact us</contact>.',

    // Shipping policy
    shippingTitle: 'Shipping policy',
    shippingDescription: 'Where, when and how NIXZORA ships.',
    shippingWhereTitle: 'Where we ship',
    shippingWhereBody: 'Addresses in the United States.',
    shippingCostTitle: 'Cost',
    shippingCostBody:
      'Free on orders over $99 (after any coupon); $9.99 below that. The cart shows the exact amount, and how much more you need for free shipping, before you pay.',
    shippingWhenTitle: 'When it ships',
    shippingWhenBody:
      'Most orders ship within 1–2 business days. You get an email with tracking when your parcel leaves, and delivery dates from the carrier are estimates.',
    shippingSellersTitle: 'Orders from more than one seller',
    shippingSellersBody:
      'Items sold by marketplace stores ship from those stores, so one order can arrive in several parcels. Each one has its own tracking on the order page.',
    shippingProblemsTitle: 'Problems with a delivery',
    shippingProblemsBody:
      'If a parcel is late, damaged or missing, <contact>tell us</contact> and we will sort it out with the carrier.',

    // Privacy policy
    privacyTitle: 'Privacy policy',
    privacyDescription: 'What NIXZORA collects, why, who it is shared with and how to delete it.',
    privacyIntro:
      'NIXZORA sells computers and electronics online and in our mobile app. This page explains what we collect, why, who we share it with and the choices you have. We do not sell your personal information and we do not show ads.',
    privacyCollectTitle: 'What we collect',
    privacyCollectAccount:
      '<b>Account details</b>: your email, name and, if you set one, a password (stored only as a salted hash). If you sign in with Google or Apple we receive your email address, your name (Apple shares it only the first time) and an account identifier from that provider. We never receive your Google or Apple password.',
    privacyCollectOrders:
      '<b>Orders</b>: items, prices, shipping and billing addresses, phone number and order history.',
    privacyCollectPayments:
      '<b>Payments</b>: card details go directly to our payment processor, Stripe. We keep only the payment status, card brand and last four digits.',
    privacyCollectActivity:
      '<b>Shopping activity</b>: your cart, saved products, the products you view, reviews you write and messages you send to the shopping assistant. Before you sign in, product views are tied to a random id stored in your browser or the app, not to you.',
    privacyCollectDevice:
      '<b>Device and security data</b>: IP address, browser or device type, sign-in history and, in the app, a push-notification token if you allow notifications.',
    privacyUseTitle: 'Why we use it',
    privacyUseOrders:
      'To take, ship and support your orders, including receipts and delivery updates.',
    privacyUseAccount:
      'To run your account and keep it secure (sign-in, two-step verification, fraud checks).',
    privacyUseRecommend:
      'To answer shopping questions and recommend products from our catalog ("similar products", "recommended for you"). "Customers also viewed" only shows products several different shoppers looked at, never one person\'s browsing.',
    privacyUseLegal: 'To meet tax, accounting and legal obligations.',
    privacyUseMarketing:
      'To email you offers, only if you opted in. Turn them off at any time in <preferences>your preferences</preferences>.',
    privacyShareTitle: 'Who we share it with',
    privacyShareIntro:
      'Only service providers that help us run the store, under contract and for these purposes:',
    privacyShareAws: 'Amazon Web Services (hosting, storage and order emails)',
    privacyShareStripe: 'Stripe (payments)',
    privacyShareSignIn: 'Google and Apple (only if you choose to sign in with them)',
    privacySharePush: 'Expo, Apple and Google push services (app notifications, if you allow them)',
    privacyShareAi:
      'AI providers (Anthropic, Voyage AI) when the shopping assistant uses them: only the text of your assistant conversation is sent, never your account, address or order details',
    privacyShareCarriers: 'Shipping carriers (your name and delivery address)',
    privacyShareSellers:
      'Marketplace stores you buy from (your name, delivery address and the items they ship; never your email, phone or card)',
    privacyShareSentry:
      'Sentry (crash reports from the app: device model, app version and your account number; never your IP address, email or messages)',
    privacyShareLaw: 'We may also disclose information when the law requires it.',
    privacyCookiesTitle: 'Cookies',
    privacyCookiesBody:
      'We use only the cookies the store needs to work: keeping you signed in, remembering your cart and protecting sign-in. We do not use advertising or cross-site tracking cookies.',
    privacyRetentionTitle: 'How long we keep it',
    privacyRetentionBody:
      'Account data stays while your account is open. Order and payment records are kept for as long as tax and accounting law requires (generally seven years), without a sign-in once you close your account. Product views are deleted after 180 days. Security logs are kept for up to one year.',
    privacyChoicesTitle: 'Your choices',
    privacyChoicesUpdate: 'See and update your details in <account>your account</account>.',
    privacyChoicesClose:
      'Close your account at any time in the app (Account → Delete account) or by emailing us. We erase your profile, addresses, saved products and linked Google or Apple sign-in.',
    privacyChoicesCopy:
      'Ask for a copy of your data, or a correction, by emailing <email>{email}</email>. We reply within 30 days.',
    privacyChoicesNotifications: 'Turn off notifications in your phone settings.',
    privacySecurityTitle: 'Security',
    privacySecurityBody:
      'Connections are encrypted (HTTPS), data is encrypted at rest, and staff access is limited and logged. No system is perfectly secure; if we learn of a breach that affects you we will tell you.',
    privacyChildrenTitle: 'Children',
    privacyChildrenBody:
      'NIXZORA is not directed to children under 13, and we do not knowingly collect their data.',
    privacyChangesTitle: 'Changes and contact',
    privacyChangesBody:
      'We will post changes here and update the date above. Questions: <email>{email}</email>.',

    // Terms of service
    termsTitle: 'Terms of service',
    termsDescription: 'The terms for shopping at NIXZORA.',
    termsIntro:
      'These terms apply when you use the NIXZORA website or app. By shopping with us you agree to them. Our <privacy>privacy policy</privacy> explains how we handle your data.',
    termsAccountTitle: 'Your account',
    termsAccountBody:
      'Keep your sign-in details safe and tell us if you think someone else is using your account. You can sign in with an email and password, or with Google or Apple. You can close your account at any time.',
    termsOrdersTitle: 'Orders and prices',
    termsOrdersBody:
      'Prices are shown in US dollars and include any discount shown at checkout; sales tax and shipping are added before you pay. An order is accepted when we send the confirmation email. If an item turns out to be unavailable or mispriced, we will tell you and refund anything you paid for it.',
    termsShippingTitle: 'Shipping',
    termsShippingBody:
      'Shipping is free on orders over $99 and $9.99 below that, unless checkout shows otherwise. Delivery dates are estimates.',
    termsReturnsTitle: 'Returns and refunds',
    termsReturnsBody:
      'You can return most items within 30 days of delivery in their original condition. Start a return from your order page. Refunds go back to the original payment method once we receive the item.',
    termsProductTitle: 'Product information and the assistant',
    termsProductBody:
      'We try to keep specifications, stock and prices accurate. The shopping assistant suggests products from our catalog; check the product page before you buy, as the product page and checkout are what count.',
    termsReviewsTitle: 'Reviews and content',
    termsReviewsBody:
      'Reviews must be honest and about the product. We may remove content that is unlawful, abusive, misleading or off-topic.',
    termsMarketplaceTitle: 'Items sold by other stores',
    termsMarketplaceBody:
      'Some items are sold and shipped by independent stores on NIXZORA; the product page shows who sells each one. Every order uses the same checkout, returns and support, and NIXZORA takes the payment.',
    termsUseTitle: 'Acceptable use',
    termsUseBody:
      "Do not misuse the store: no scraping at scale, interfering with the service, reselling accounts or buying on someone else's payment method without permission.",
    termsLiabilityTitle: 'Liability',
    termsLiabilityBody:
      "Products come with the manufacturer's warranty and any rights you have under the law, which these terms do not limit. Otherwise, to the extent the law allows, our liability for an order is limited to the amount you paid for it.",
    termsChangesTitle: 'Changes and contact',
    termsChangesBody:
      'We may update these terms and will post changes here. Questions: <email>{email}</email>.',
  },
  fr: {
    lastUpdated: 'Dernière mise à jour : {date}',
    translationNote:
      'Cette traduction est fournie à titre indicatif ; la version anglaise fait foi.',

    aboutTitle: 'À propos de NIXZORA',
    aboutDescription:
      'L’informatique et l’électronique, expliquées : qui nous sommes et comment fonctionne NIXZORA.',
    aboutIntro:
      'NIXZORA vend des ordinateurs et de l’électronique avec des caractéristiques claires et des conseils honnêtes. Décrivez à notre assistant d’achat ce qu’il vous faut, avec vos propres mots : il trouve les produits adaptés, explique pourquoi et prépare le panier.',
    aboutTrustTitle: 'Une marketplace digne de confiance',
    aboutTrustBody:
      'À côté de nos propres produits, des boutiques indépendantes vendent sur NIXZORA. Chaque boutique est vérifiée avant son ouverture, chaque annonce est examinée avant sa mise en ligne, et chaque commande, quel que soit l’expéditeur, bénéficie du même paiement, des mêmes <returns>retours sous 30 jours</returns> et de la même assistance.',
    aboutDataTitle: 'Comment nous traitons vos données',
    aboutDataBody:
      'Les données de carte n’atteignent jamais nos serveurs, et vous pouvez télécharger ou supprimer vos données à tout moment depuis votre compte. Consultez la <privacy>politique de confidentialité</privacy>.',
    aboutSellTitle: 'Vendre avec nous',
    aboutSellBody: 'Vous avez une boutique ? <sell>Ouvrez une boutique NIXZORA</sell>.',

    returnsTitle: 'Politique de retour',
    returnsDescription: 'Retours et remboursements chez NIXZORA.',
    returnsWindowTitle: '30 jours',
    returnsWindowBody:
      'Vous pouvez retourner la plupart des articles dans les 30 jours suivant la livraison, dans leur état d’origine et avec leurs accessoires. Cela inclut les articles des vendeurs de la marketplace.',
    returnsHowTitle: 'Comment effectuer un retour',
    returnsHowBody:
      'Ouvrez la commande dans <orders>Vos commandes</orders>, choisissez « Retourner ou remplacer des articles », puis sélectionnez les articles et un motif. Nous approuvons le retour et vous indiquons comment renvoyer l’article. Suivez les étapes dans <returns>Retours et remboursements</returns>.',
    returnsRefundsTitle: 'Remboursements',
    returnsRefundsBody:
      'Dès que l’article nous est revenu, nous remboursons le montant payé sur la carte utilisée, y compris la part de taxe correspondante, déduction faite de la part de toute remise par coupon. Les banques affichent généralement le remboursement sous 5 à 10 jours ouvrés.',
    returnsDamagedTitle: 'Articles endommagés ou erronés',
    returnsDamagedBody:
      'Choisissez « Arrivé endommagé » ou « Mauvais article envoyé » comme motif. Des questions ? <contact>Contactez-nous</contact>.',

    shippingTitle: 'Politique de livraison',
    shippingDescription: 'Où, quand et comment NIXZORA livre.',
    shippingWhereTitle: 'Zones de livraison',
    shippingWhereBody: 'Adresses aux États-Unis.',
    shippingCostTitle: 'Frais',
    shippingCostBody:
      'Livraison offerte pour les commandes de plus de 99 $ (après application d’un éventuel coupon) ; 9,99 $ en dessous. Le panier indique le montant exact, et ce qu’il manque pour bénéficier de la livraison offerte, avant le paiement.',
    shippingWhenTitle: 'Délai d’expédition',
    shippingWhenBody:
      'La plupart des commandes sont expédiées sous 1 à 2 jours ouvrés. Vous recevez un e-mail avec le suivi lorsque votre colis part, et les dates de livraison du transporteur sont des estimations.',
    shippingSellersTitle: 'Commandes de plusieurs vendeurs',
    shippingSellersBody:
      'Les articles vendus par les boutiques de la marketplace sont expédiés par ces boutiques : une même commande peut donc arriver en plusieurs colis. Chacun dispose de son propre suivi sur la page de la commande.',
    shippingProblemsTitle: 'Problèmes de livraison',
    shippingProblemsBody:
      'Si un colis est en retard, endommagé ou manquant, <contact>prévenez-nous</contact> et nous réglerons le problème avec le transporteur.',

    privacyTitle: 'Politique de confidentialité',
    privacyDescription:
      'Ce que NIXZORA collecte, pourquoi, avec qui ces données sont partagées et comment les supprimer.',
    privacyIntro:
      'NIXZORA vend des ordinateurs et de l’électronique en ligne et dans notre application mobile. Cette page explique ce que nous collectons, pourquoi, avec qui nous le partageons et les choix dont vous disposez. Nous ne vendons pas vos informations personnelles et nous n’affichons pas de publicité.',
    privacyCollectTitle: 'Ce que nous collectons',
    privacyCollectAccount:
      '<b>Informations de compte</b> : votre e-mail, votre nom et, si vous en définissez un, un mot de passe (stocké uniquement sous forme de hachage salé). Si vous vous connectez avec Google ou Apple, nous recevons votre adresse e-mail, votre nom (Apple ne le transmet que la première fois) et un identifiant de compte de ce fournisseur. Nous ne recevons jamais votre mot de passe Google ou Apple.',
    privacyCollectOrders:
      '<b>Commandes</b> : articles, prix, adresses de livraison et de facturation, numéro de téléphone et historique des commandes.',
    privacyCollectPayments:
      '<b>Paiements</b> : les données de carte sont transmises directement à notre prestataire de paiement, Stripe. Nous ne conservons que le statut du paiement, la marque de la carte et ses quatre derniers chiffres.',
    privacyCollectActivity:
      '<b>Activité d’achat</b> : votre panier, les produits enregistrés, les produits que vous consultez, les avis que vous rédigez et les messages que vous envoyez à l’assistant d’achat. Avant votre connexion, les consultations de produits sont associées à un identifiant aléatoire stocké dans votre navigateur ou l’application, et non à vous.',
    privacyCollectDevice:
      '<b>Données d’appareil et de sécurité</b> : adresse IP, type de navigateur ou d’appareil, historique de connexion et, dans l’application, un jeton de notification push si vous autorisez les notifications.',
    privacyUseTitle: 'Pourquoi nous les utilisons',
    privacyUseOrders:
      'Pour enregistrer, expédier et suivre vos commandes, y compris les reçus et les informations de livraison.',
    privacyUseAccount:
      'Pour gérer votre compte et le sécuriser (connexion, vérification en deux étapes, contrôles antifraude).',
    privacyUseRecommend:
      'Pour répondre aux questions d’achat et recommander des produits de notre catalogue (« produits similaires », « recommandés pour vous »). « Les clients ont aussi consulté » ne montre que des produits consultés par plusieurs clients différents, jamais la navigation d’une seule personne.',
    privacyUseLegal: 'Pour respecter nos obligations fiscales, comptables et légales.',
    privacyUseMarketing:
      'Pour vous envoyer des offres par e-mail, uniquement si vous l’avez accepté. Désactivez-les à tout moment dans <preferences>vos préférences</preferences>.',
    privacyShareTitle: 'Avec qui nous les partageons',
    privacyShareIntro:
      'Uniquement avec des prestataires qui nous aident à faire fonctionner la boutique, sous contrat et pour ces finalités :',
    privacyShareAws: 'Amazon Web Services (hébergement, stockage et e-mails de commande)',
    privacyShareStripe: 'Stripe (paiements)',
    privacyShareSignIn:
      'Google et Apple (uniquement si vous choisissez de vous connecter avec eux)',
    privacySharePush:
      'Les services push d’Expo, Apple et Google (notifications de l’application, si vous les autorisez)',
    privacyShareAi:
      'Des fournisseurs d’IA (Anthropic, Voyage AI) lorsque l’assistant d’achat y fait appel : seul le texte de votre conversation avec l’assistant est transmis, jamais les informations de votre compte, votre adresse ou vos commandes',
    privacyShareCarriers: 'Les transporteurs (votre nom et votre adresse de livraison)',
    privacyShareSellers:
      'Les boutiques du marketplace chez qui vous achetez (votre nom, votre adresse de livraison et les articles qu’elles expédient ; jamais votre e-mail, votre téléphone ni votre carte)',
    privacyShareSentry:
      'Sentry (rapports de plantage de l’app : modèle d’appareil, version de l’app et numéro de compte ; jamais votre adresse IP, votre e-mail ni vos messages)',
    privacyShareLaw: 'Nous pouvons également divulguer des informations lorsque la loi l’exige.',
    privacyCookiesTitle: 'Cookies',
    privacyCookiesBody:
      'Nous utilisons uniquement les cookies nécessaires au fonctionnement de la boutique : vous garder connecté, mémoriser votre panier et protéger la connexion. Nous n’utilisons pas de cookies publicitaires ni de suivi intersites.',
    privacyRetentionTitle: 'Durée de conservation',
    privacyRetentionBody:
      'Les données du compte sont conservées tant que votre compte est ouvert. Les enregistrements de commandes et de paiements sont conservés aussi longtemps que l’exige la législation fiscale et comptable (généralement sept ans), sans possibilité de connexion une fois votre compte fermé. Les consultations de produits sont supprimées au bout de 180 jours. Les journaux de sécurité sont conservés jusqu’à un an.',
    privacyChoicesTitle: 'Vos choix',
    privacyChoicesUpdate:
      'Consultez et mettez à jour vos informations dans <account>votre compte</account>.',
    privacyChoicesClose:
      'Fermez votre compte à tout moment dans l’application (Compte → Supprimer le compte) ou en nous écrivant par e-mail. Nous effaçons votre profil, vos adresses, vos produits enregistrés et la connexion Google ou Apple associée.',
    privacyChoicesCopy:
      'Demandez une copie de vos données, ou leur rectification, en écrivant à <email>{email}</email>. Nous répondons sous 30 jours.',
    privacyChoicesNotifications:
      'Désactivez les notifications dans les réglages de votre téléphone.',
    privacySecurityTitle: 'Sécurité',
    privacySecurityBody:
      'Les connexions sont chiffrées (HTTPS), les données sont chiffrées au repos, et l’accès du personnel est limité et journalisé. Aucun système n’est parfaitement sûr ; si nous apprenons une violation de données qui vous concerne, nous vous en informerons.',
    privacyChildrenTitle: 'Enfants',
    privacyChildrenBody:
      'NIXZORA ne s’adresse pas aux enfants de moins de 13 ans, et nous ne collectons pas sciemment leurs données.',
    privacyChangesTitle: 'Modifications et contact',
    privacyChangesBody:
      'Nous publierons les modifications ici et mettrons à jour la date ci-dessus. Questions : <email>{email}</email>.',

    termsTitle: 'Conditions d’utilisation',
    termsDescription: 'Les conditions applicables aux achats sur NIXZORA.',
    termsIntro:
      'Les présentes conditions s’appliquent lorsque vous utilisez le site ou l’application NIXZORA. En effectuant un achat chez nous, vous les acceptez. Notre <privacy>politique de confidentialité</privacy> explique comment nous traitons vos données.',
    termsAccountTitle: 'Votre compte',
    termsAccountBody:
      'Protégez vos identifiants de connexion et prévenez-nous si vous pensez que quelqu’un d’autre utilise votre compte. Vous pouvez vous connecter avec une adresse e-mail et un mot de passe, ou avec Google ou Apple. Vous pouvez fermer votre compte à tout moment.',
    termsOrdersTitle: 'Commandes et prix',
    termsOrdersBody:
      'Les prix sont affichés en dollars américains et incluent toute remise indiquée lors du paiement ; la taxe de vente et les frais de livraison sont ajoutés avant le paiement. Une commande est acceptée lorsque nous envoyons l’e-mail de confirmation. Si un article s’avère indisponible ou affiché à un prix erroné, nous vous en informerons et vous rembourserons toute somme payée pour celui-ci.',
    termsShippingTitle: 'Livraison',
    termsShippingBody:
      'La livraison est offerte pour les commandes de plus de 99 $ et coûte 9,99 $ en dessous, sauf indication contraire lors du paiement. Les dates de livraison sont des estimations.',
    termsReturnsTitle: 'Retours et remboursements',
    termsReturnsBody:
      'Vous pouvez retourner la plupart des articles dans les 30 jours suivant la livraison, dans leur état d’origine. Lancez un retour depuis la page de votre commande. Le remboursement est effectué sur le moyen de paiement d’origine dès réception de l’article.',
    termsProductTitle: 'Informations produit et assistant',
    termsProductBody:
      'Nous nous efforçons de maintenir exacts les caractéristiques, les stocks et les prix. L’assistant d’achat suggère des produits de notre catalogue ; vérifiez la fiche produit avant d’acheter, car ce sont la fiche produit et la page de paiement qui font foi.',
    termsReviewsTitle: 'Avis et contenus',
    termsReviewsBody:
      'Les avis doivent être sincères et porter sur le produit. Nous pouvons supprimer tout contenu illicite, injurieux, trompeur ou hors sujet.',
    termsMarketplaceTitle: 'Articles vendus par d’autres boutiques',
    termsMarketplaceBody:
      'Certains articles sont vendus et expédiés par des boutiques indépendantes sur NIXZORA ; la fiche produit indique qui vend chacun d’eux. Chaque commande bénéficie du même paiement, des mêmes retours et du même service client, et c’est NIXZORA qui encaisse le paiement.',
    termsUseTitle: 'Utilisation acceptable',
    termsUseBody:
      'N’utilisez pas la boutique de manière abusive : pas d’extraction de données à grande échelle, pas d’entrave au service, pas de revente de comptes ni d’achat avec le moyen de paiement d’autrui sans son autorisation.',
    termsLiabilityTitle: 'Responsabilité',
    termsLiabilityBody:
      'Les produits bénéficient de la garantie du fabricant et de tous les droits que vous confère la loi, que les présentes conditions ne limitent pas. Pour le reste, dans la mesure permise par la loi, notre responsabilité au titre d’une commande est limitée au montant que vous avez payé pour celle-ci.',
    termsChangesTitle: 'Modifications et contact',
    termsChangesBody:
      'Nous pouvons mettre à jour ces conditions et publierons les modifications ici. Questions : <email>{email}</email>.',
  },
  es: {
    lastUpdated: 'Última actualización: {date}',
    translationNote: 'Esta traducción se ofrece por conveniencia; prevalece la versión en inglés.',

    aboutTitle: 'Acerca de NIXZORA',
    aboutDescription:
      'Computación y electrónica, explicadas: quiénes somos y cómo funciona NIXZORA.',
    aboutIntro:
      'NIXZORA vende computadoras y electrónica con especificaciones claras y consejos honestos. Dile a nuestro asistente de compras lo que necesitas con tus propias palabras: encuentra los productos adecuados, explica por qué y arma el carrito.',
    aboutTrustTitle: 'Un marketplace confiable',
    aboutTrustBody:
      'Junto a nuestros propios productos, tiendas independientes venden en NIXZORA. Cada tienda se verifica antes de abrir, cada publicación se revisa antes de estar disponible, y cada pedido, sin importar quién lo envíe, tiene el mismo proceso de pago, las mismas <returns>devoluciones en 30 días</returns> y el mismo soporte.',
    aboutDataTitle: 'Cómo tratamos tus datos',
    aboutDataBody:
      'Los datos de tu tarjeta nunca llegan a nuestros servidores, y puedes descargar o eliminar tus datos en cualquier momento desde tu cuenta. Lee la <privacy>política de privacidad</privacy>.',
    aboutSellTitle: 'Vende con nosotros',
    aboutSellBody: '¿Tienes una tienda? <sell>Abre una tienda en NIXZORA</sell>.',

    returnsTitle: 'Política de devoluciones',
    returnsDescription: 'Devoluciones y reembolsos en NIXZORA.',
    returnsWindowTitle: '30 días',
    returnsWindowBody:
      'La mayoría de los artículos se pueden devolver dentro de los 30 días posteriores a la entrega, en su estado original y con sus accesorios. Esto incluye los artículos de vendedores del marketplace.',
    returnsHowTitle: 'Cómo hacer una devolución',
    returnsHowBody:
      'Abre el pedido en <orders>Tus pedidos</orders>, elige “Devolver o reemplazar artículos” y selecciona los artículos y un motivo. Aprobamos la devolución y te indicamos cómo enviarlo de vuelta. Sigue los pasos en <returns>Devoluciones y reembolsos</returns>.',
    returnsRefundsTitle: 'Reembolsos',
    returnsRefundsBody:
      'Cuando el artículo nos llega de vuelta, reembolsamos lo que pagaste por él a la tarjeta que usaste, incluida su parte de impuestos y descontada su parte de cualquier cupón de descuento. Los bancos suelen mostrar el reembolso en 5 a 10 días hábiles.',
    returnsDamagedTitle: 'Artículos dañados o equivocados',
    returnsDamagedBody:
      'Elige “Llegó dañado” o “Se envió un artículo equivocado” como motivo. ¿Tienes preguntas? <contact>Contáctanos</contact>.',

    shippingTitle: 'Política de envíos',
    shippingDescription: 'Dónde, cuándo y cómo envía NIXZORA.',
    shippingWhereTitle: 'Dónde enviamos',
    shippingWhereBody: 'Direcciones en Estados Unidos.',
    shippingCostTitle: 'Costo',
    shippingCostBody:
      'Gratis en pedidos de más de $99 (después de aplicar cualquier cupón); $9.99 por debajo de ese monto. El carrito muestra el monto exacto, y cuánto te falta para el envío gratis, antes de pagar.',
    shippingWhenTitle: 'Cuándo se envía',
    shippingWhenBody:
      'La mayoría de los pedidos se envían en 1 a 2 días hábiles. Recibes un correo electrónico con el rastreo cuando sale tu paquete, y las fechas de entrega de la paquetería son estimadas.',
    shippingSellersTitle: 'Pedidos de más de un vendedor',
    shippingSellersBody:
      'Los artículos vendidos por tiendas del marketplace se envían desde esas tiendas, así que un pedido puede llegar en varios paquetes. Cada uno tiene su propio rastreo en la página del pedido.',
    shippingProblemsTitle: 'Problemas con una entrega',
    shippingProblemsBody:
      'Si un paquete llega tarde, dañado o no llega, <contact>avísanos</contact> y lo resolveremos con la paquetería.',

    privacyTitle: 'Política de privacidad',
    privacyDescription: 'Qué recopila NIXZORA, por qué, con quién se comparte y cómo eliminarlo.',
    privacyIntro:
      'NIXZORA vende computadoras y electrónica en línea y en nuestra app móvil. Esta página explica qué recopilamos, por qué, con quién lo compartimos y qué opciones tienes. No vendemos tu información personal y no mostramos anuncios.',
    privacyCollectTitle: 'Qué recopilamos',
    privacyCollectAccount:
      '<b>Datos de la cuenta</b>: tu correo electrónico, tu nombre y, si defines una, una contraseña (almacenada solo como hash con sal). Si inicias sesión con Google o Apple, recibimos tu dirección de correo electrónico, tu nombre (Apple solo lo comparte la primera vez) y un identificador de cuenta de ese proveedor. Nunca recibimos tu contraseña de Google o Apple.',
    privacyCollectOrders:
      '<b>Pedidos</b>: artículos, precios, direcciones de envío y facturación, número de teléfono e historial de pedidos.',
    privacyCollectPayments:
      '<b>Pagos</b>: los datos de la tarjeta van directamente a nuestro procesador de pagos, Stripe. Solo guardamos el estado del pago, la marca de la tarjeta y los últimos cuatro dígitos.',
    privacyCollectActivity:
      '<b>Actividad de compra</b>: tu carrito, los productos guardados, los productos que ves, las reseñas que escribes y los mensajes que envías al asistente de compras. Antes de que inicies sesión, las visitas a productos se asocian a un identificador aleatorio guardado en tu navegador o en la app, no a ti.',
    privacyCollectDevice:
      '<b>Datos del dispositivo y de seguridad</b>: dirección IP, tipo de navegador o dispositivo, historial de inicios de sesión y, en la app, un token de notificaciones push si permites las notificaciones.',
    privacyUseTitle: 'Para qué lo usamos',
    privacyUseOrders:
      'Para recibir, enviar y dar soporte a tus pedidos, incluidos los recibos y las actualizaciones de entrega.',
    privacyUseAccount:
      'Para administrar tu cuenta y mantenerla segura (inicio de sesión, verificación en dos pasos, controles contra fraude).',
    privacyUseRecommend:
      'Para responder preguntas de compra y recomendar productos de nuestro catálogo (“productos similares”, “recomendados para ti”). “Otros clientes también vieron” solo muestra productos que vieron varios compradores distintos, nunca la navegación de una sola persona.',
    privacyUseLegal: 'Para cumplir obligaciones fiscales, contables y legales.',
    privacyUseMarketing:
      'Para enviarte ofertas por correo, solo si lo aceptaste. Desactívalas cuando quieras en <preferences>tus preferencias</preferences>.',
    privacyShareTitle: 'Con quién lo compartimos',
    privacyShareIntro:
      'Solo con proveedores de servicios que nos ayudan a operar la tienda, bajo contrato y para estos fines:',
    privacyShareAws: 'Amazon Web Services (alojamiento, almacenamiento y correos de pedidos)',
    privacyShareStripe: 'Stripe (pagos)',
    privacyShareSignIn: 'Google y Apple (solo si eliges iniciar sesión con ellos)',
    privacySharePush:
      'Los servicios push de Expo, Apple y Google (notificaciones de la app, si las permites)',
    privacyShareAi:
      'Proveedores de IA (Anthropic, Voyage AI) cuando el asistente de compras los usa: solo se envía el texto de tu conversación con el asistente, nunca los datos de tu cuenta, tu dirección ni tus pedidos',
    privacyShareCarriers: 'Empresas de paquetería (tu nombre y dirección de entrega)',
    privacyShareSellers:
      'Las tiendas del marketplace a las que compras (tu nombre, dirección de entrega y los artículos que envían; nunca tu correo, teléfono ni tarjeta)',
    privacyShareSentry:
      'Sentry (informes de fallos de la app: modelo del dispositivo, versión de la app y tu número de cuenta; nunca tu dirección IP, correo ni mensajes)',
    privacyShareLaw: 'También podemos divulgar información cuando la ley lo exija.',
    privacyCookiesTitle: 'Cookies',
    privacyCookiesBody:
      'Solo usamos las cookies que la tienda necesita para funcionar: mantener tu sesión iniciada, recordar tu carrito y proteger el inicio de sesión. No usamos cookies publicitarias ni de seguimiento entre sitios.',
    privacyRetentionTitle: 'Cuánto tiempo lo conservamos',
    privacyRetentionBody:
      'Los datos de la cuenta se conservan mientras tu cuenta esté abierta. Los registros de pedidos y pagos se conservan durante el tiempo que exija la ley fiscal y contable (generalmente siete años), sin acceso mediante inicio de sesión una vez que cierras tu cuenta. Las visitas a productos se eliminan después de 180 días. Los registros de seguridad se conservan hasta un año.',
    privacyChoicesTitle: 'Tus opciones',
    privacyChoicesUpdate: 'Consulta y actualiza tus datos en <account>tu cuenta</account>.',
    privacyChoicesClose:
      'Cierra tu cuenta en cualquier momento en la app (Cuenta → Eliminar cuenta) o escribiéndonos por correo electrónico. Borramos tu perfil, tus direcciones, tus productos guardados y el inicio de sesión vinculado de Google o Apple.',
    privacyChoicesCopy:
      'Solicita una copia de tus datos, o una corrección, escribiendo a <email>{email}</email>. Respondemos en un plazo de 30 días.',
    privacyChoicesNotifications: 'Desactiva las notificaciones en la configuración de tu teléfono.',
    privacySecurityTitle: 'Seguridad',
    privacySecurityBody:
      'Las conexiones están cifradas (HTTPS), los datos están cifrados en reposo y el acceso del personal es limitado y queda registrado. Ningún sistema es perfectamente seguro; si nos enteramos de una filtración que te afecte, te lo diremos.',
    privacyChildrenTitle: 'Menores',
    privacyChildrenBody:
      'NIXZORA no está dirigida a menores de 13 años y no recopilamos sus datos de forma intencional.',
    privacyChangesTitle: 'Cambios y contacto',
    privacyChangesBody:
      'Publicaremos los cambios aquí y actualizaremos la fecha de arriba. Preguntas: <email>{email}</email>.',

    termsTitle: 'Términos de uso',
    termsDescription: 'Los términos para comprar en NIXZORA.',
    termsIntro:
      'Estos términos se aplican cuando usas el sitio web o la app de NIXZORA. Al comprar con nosotros, los aceptas. Nuestra <privacy>política de privacidad</privacy> explica cómo tratamos tus datos.',
    termsAccountTitle: 'Tu cuenta',
    termsAccountBody:
      'Mantén seguros tus datos de inicio de sesión y avísanos si crees que alguien más está usando tu cuenta. Puedes iniciar sesión con un correo electrónico y una contraseña, o con Google o Apple. Puedes cerrar tu cuenta en cualquier momento.',
    termsOrdersTitle: 'Pedidos y precios',
    termsOrdersBody:
      'Los precios se muestran en dólares estadounidenses e incluyen cualquier descuento mostrado al pagar; el impuesto sobre las ventas y el envío se agregan antes de pagar. Un pedido se acepta cuando enviamos el correo de confirmación. Si un artículo resulta no estar disponible o tener un precio incorrecto, te lo diremos y te reembolsaremos lo que hayas pagado por él.',
    termsShippingTitle: 'Envíos',
    termsShippingBody:
      'El envío es gratis en pedidos de más de $99 y cuesta $9.99 por debajo de ese monto, salvo que el proceso de pago indique otra cosa. Las fechas de entrega son estimadas.',
    termsReturnsTitle: 'Devoluciones y reembolsos',
    termsReturnsBody:
      'La mayoría de los artículos se pueden devolver dentro de los 30 días posteriores a la entrega, en su estado original. Inicia una devolución desde la página de tu pedido. Los reembolsos se hacen al método de pago original una vez que recibimos el artículo.',
    termsProductTitle: 'Información de productos y el asistente',
    termsProductBody:
      'Procuramos mantener exactas las especificaciones, el inventario y los precios. El asistente de compras sugiere productos de nuestro catálogo; revisa la página del producto antes de comprar, ya que lo que cuenta es la página del producto y el proceso de pago.',
    termsReviewsTitle: 'Reseñas y contenido',
    termsReviewsBody:
      'Las reseñas deben ser honestas y tratar sobre el producto. Podemos eliminar contenido ilegal, ofensivo, engañoso o fuera de tema.',
    termsMarketplaceTitle: 'Artículos vendidos por otras tiendas',
    termsMarketplaceBody:
      'Algunos artículos los venden y envían tiendas independientes en NIXZORA; la página del producto indica quién vende cada uno. Todos los pedidos usan el mismo pago, las mismas devoluciones y el mismo soporte, y NIXZORA cobra el pago.',
    termsUseTitle: 'Uso aceptable',
    termsUseBody:
      'No hagas un uso indebido de la tienda: no se permite la extracción masiva de datos, interferir con el servicio, revender cuentas ni comprar con el método de pago de otra persona sin su permiso.',
    termsLiabilityTitle: 'Responsabilidad',
    termsLiabilityBody:
      'Los productos incluyen la garantía del fabricante y todos los derechos que te otorga la ley, que estos términos no limitan. Por lo demás, en la medida en que la ley lo permita, nuestra responsabilidad por un pedido se limita al monto que pagaste por él.',
    termsChangesTitle: 'Cambios y contacto',
    termsChangesBody:
      'Podemos actualizar estos términos y publicaremos los cambios aquí. Preguntas: <email>{email}</email>.',
  },
});
