import { defineMessages } from '../define';

/** The seller landing page, portal header, store settings and the Seller Agreement page. */
export const sell = defineMessages({
  en: {
    // Landing page
    metaTitle: 'Sell on NIXZORA',
    metaDescription: 'List your electronics on NIXZORA: reach shoppers who know what they want.',
    savedNotice: 'Saved. Continue your application any time.',
    appliedNotice: 'Application submitted. Next, connect Stripe so we can verify your business.',
    eyebrow: 'Sell on NIXZORA',
    heroTitle: 'Open your store on NIXZORA.',
    heroLead:
      'Reach shoppers who compare before they buy. List computers, audio and accessories alongside the NIXZORA catalog; our team reviews every store and listing.',
    continueApplication: 'Continue your application ({percent}% complete)',
    startApplication: 'Start your application',
    createAccountToStart: 'Create an account to start',
    heroTime: 'About 10 minutes. Save and finish later.',
    heroBadgeTitle: 'Payouts through Stripe',
    heroBadgeBody: 'No listing or monthly fees',
    heroImageAlt: 'A desk with a laptop, monitor, headphones, phone and game controller',
    stepApply: 'Apply',
    stepApplyBody: 'Six short steps: your business, you, your store, shipping, fees and review.',
    stepVerify: 'Verify',
    stepVerifyBody: 'Stripe confirms your identity and bank account. NIXZORA never sees them.',
    stepList: 'List',
    stepListBody: 'Add products with photos and specs. We review each listing before it goes live.',
    stepPaid: 'Get paid',
    stepPaidBody: 'You keep 88% of the item price, plus shipping, paid out to your bank.',

    // Overview and application status
    continueWithStripe: 'Continue with Stripe',
    connectStripe: 'Connect Stripe',
    checkBusiness: 'Business information',
    checkStore: 'Store information',
    checkIdentity: 'Identity verification',
    identityDone: 'Submitted to Stripe.',
    identityTodo: 'Stripe confirms who you are. NIXZORA never sees your ID.',
    checkPayment: 'Payment verification',
    paymentDone: 'Bank account verified. Payouts are switched on.',
    paymentChecking: 'Stripe is checking your bank details.',
    paymentTodo: 'Add your bank account on Stripe to receive payouts.',
    checkFinal: 'Final review',
    finalDone: 'Approved. Your store is open.',
    finalPending:
      'Our team reviews your store once Stripe verification is complete, usually within one business day.',
    contactSupport: 'Contact seller support.',
    statusApproved: 'Approved',
    statusUnderReview: 'Under review',
    statusWaiting: 'Waiting for verification',
    statusSuspended: 'Suspended',
    statusNotApproved: 'Not approved',
    checkFirstListing: 'First listing live',
    listingsLive: '{count} live.',
    firstListingTodo: 'Add a product, a photo, and submit it for review.',
    addListing: 'Add a listing',
    storeSuspended: 'Your store is suspended.',
    applicationNotApproved: 'Your application was not approved.',
    toShip: '{count, plural, one {# order is} other {# orders are}} waiting to ship.',
    shipNow: 'Ship now →',
    listingSummary:
      '{live} live · {review} in review · {drafts, plural, one {# draft} other {# drafts}} · {rate} commission',
    gettingStarted: 'Getting started',
    sellerApplication: 'Seller application',
    weWillEmail:
      "We'll email {email} when your application has been reviewed. You can prepare listings meanwhile.",
    srDone: '(done)',
    srTodo: '(to do)',

    // Seller portal header
    portal: 'Seller portal',
    viewStore: 'View your store →',
    navOverview: 'Overview',
    navOrders: 'Orders',
    navFeedback: 'Returns & ratings',
    navListings: 'Listings',
    navAnalytics: 'Analytics',
    navEarnings: 'Earnings',
    navSettings: 'Store settings',
    status_PENDING: 'Waiting for approval',
    status_ACTIVE: 'Approved',
    status_SUSPENDED: 'Suspended',
    status_REJECTED: 'Not approved',

    // Landing sections
    whyTitle: 'Why sell on NIXZORA?',
    whyFoundTitle: 'Get found by the right shoppers',
    whyFoundBody:
      'Our assistant matches shoppers to products by their specs, so well-described listings show up for the questions people actually ask.',
    whyFeesTitle: 'Simple seller fees',
    whyFeesBody:
      'One 12% commission on the item price. No listing fees, no monthly fee, no card-processing fee.',
    whyOrdersTitle: 'Easy order management',
    whyOrdersBody:
      'See what to ship, print the address, add tracking. Returns are handled with NIXZORA.',
    whyAnalyticsTitle: 'Sales analytics',
    whyAnalyticsBody:
      'Revenue, orders and best sellers by day, plus customer ratings of your store.',
    whySecureTitle: 'Secure payments',
    whySecureBody:
      'Customers pay NIXZORA; Stripe pays you out. Bank details never touch our servers.',
    feesTitle: 'Seller fees',
    feePerSale: 'per completed sale, on the item price',
    viewFeeSchedule: 'View the complete fee schedule →',
    feeCustomerPays: 'Customer pays for the item',
    feeCommission: 'NIXZORA commission',
    feeProceeds: 'Your proceeds',
    feeHint: 'Plus any shipping the customer pays, in full. Sales tax never reaches you.',
    faqTitle: 'Seller FAQ',
    faqChargeQ: 'How much does NIXZORA charge?',
    faqChargeA:
      'A 12% marketplace commission on the item price of each completed sale. There is no commission on shipping or tax, no listing fee and no monthly fee. See the <link>fee schedule</link>.',
    faqPaidQ: 'When do I get paid?',
    faqPaidA:
      'Earnings from a sale become available 14 days after you ship it (the hold covers delivery and most returns). Available earnings are paid to your bank through Stripe, at most once a day, from $10.',
    faqProductsQ: 'What products can I sell?',
    faqProductsA:
      'New computers and electronics: computers, monitors, audio, phones, smart home, gaming, accessories and wearables. Every listing is reviewed by our team before it goes live.',
    faqReturnsQ: 'How do returns work?',
    faqReturnsA:
      'Customers can return items within 30 days of delivery, through NIXZORA. The refund goes to their card and the commission on the refunded amount comes back to you.',
    faqDisputeQ: 'What happens if a customer disputes an order?',
    faqDisputeA:
      'NIXZORA support looks at the order, your tracking and the customer’s message, and decides under the Seller Agreement. Keep tracking numbers on every shipment.',
    faqApprovalQ: 'How long does seller approval take?',
    faqApprovalA:
      'Usually one business day after your Stripe verification is complete. You can prepare listings while you wait.',
    faqVerifyQ: 'What information is required for verification?',
    faqVerifyA:
      'Your business details and the owner’s legal name, date of birth and phone number on NIXZORA; your identity, bank account and tax details on Stripe’s secure forms.',

    // Store settings
    settingsTitle: 'Store settings',
    storeProfile: 'Store profile',
    storeName: 'Store name',
    contactEmail: 'Contact email',
    contactEmailHint: 'For orders and payouts.',
    aboutStore: 'About your store',
    aboutStoreHint: 'Shown on your store page.',
    category: 'Category',
    notSet: 'Not set',
    website: 'Website',
    supportEmail: 'Support email',
    supportPhone: 'Support phone',
    publicHint: 'Public.',
    branding: 'Branding',
    shipping: 'Shipping',
    carriers: 'Carriers',
    businessAndPayouts: 'Business and payouts',
    legalName: 'Legal name',
    storeAddress: 'Store address',
    commission: 'Commission',
    commissionValue: '{rate} of each sale',
    payoutHold: 'Payout hold',
    payoutHoldValue: '{days} days after shipping',
    payouts: 'Payouts',
    payoutsOn: 'On',
    payoutsTestMode: ' (test mode: no money moves)',
    payoutsVerifying: 'Being verified',
    payoutsNotSetUp: 'Not set up',
    stripeNeedsMore: 'Stripe needs a few more details before paying you out.',
    updatePayouts: 'Update payout details',
    setUpPayouts: 'Set up payouts',
    supportChanges:
      'Legal name, business address and store address changes go through seller support.',

    // Seller Agreement page
    policyMetaTitle: 'Seller Agreement and fees',
    policyMetaDescription:
      'The NIXZORA Seller Agreement, fee schedule and Marketplace Return Policy.',
    policyTitle: 'Seller Agreement',
    translationNote: 'This translation is provided for convenience; the English version prevails.',
    policyIntro:
      'This page is a summary of the rules every NIXZORA marketplace seller agrees to when they apply. NIXZORA is a demo marketplace: products, brands and prices are fictional.',
    policyAgreementTitle: 'Seller Agreement',
    policyAgreement1:
      'List only new products you have in stock, with accurate titles, photos, specs and prices. Every listing is reviewed before it goes live and can be removed if it breaks these rules.',
    policyAgreement2:
      'Ship within the time you set (1 or 2 business days) with a tracking number, from the United States, to the regions you chose.',
    policyAgreement3:
      'Keep your business, owner and payout details current. NIXZORA may suspend a store that gives false information, misses shipments repeatedly or receives serious complaints.',
    policyAgreement4:
      'Customers pay NIXZORA. Sellers never ask customers to pay outside NIXZORA or collect their contact details for marketing.',
    policyFeesTitle: 'Fee schedule',
    policyCommission: 'Commission',
    policyCommissionBody:
      "12% of the item price of each completed sale (your store's rate is shown in Store settings).",
    policyShipping: 'Shipping',
    policyShippingBody: 'No commission. Shipping paid by the customer is passed to you in full.',
    policyTax: 'Sales tax',
    policyTaxBody: 'No commission. NIXZORA collects and remits it as the marketplace facilitator.',
    policyCoupons: 'Coupons',
    policyCouponsBody: 'Funded by NIXZORA. You are paid on the price before the discount.',
    policyRefunds: 'Refunds',
    policyRefundsBody:
      'The refunded share of the item, minus the commission on it, is deducted from your earnings: the commission comes back to you.',
    policyCancellations: 'Cancellations',
    policyCancellationsBody: 'Orders cancelled before you ship cost you nothing.',
    policyCard: 'Card processing',
    policyCardBody: 'Included: NIXZORA pays it.',
    policyListingFees: 'Listing or monthly fees',
    policyListingFeesBody: 'None.',
    policyPayouts: 'Payouts',
    policyPayoutsBody:
      'Earnings become available 14 days after you ship (longer holds can apply to new stores). Available balances from $10 are paid to your bank through Stripe Connect, at most once a day.',
    policyExample:
      'Example: an item sold for $100 with $8 shipping earns you $100 + $8 − $12 = <b>$96</b>.',
    policyReturnsTitle: 'Marketplace Return & Refund Policy',
    policyReturns1:
      'Customers can return items within 30 days of delivery under the <link>NIXZORA return policy</link>, which covers marketplace items too.',
    policyReturns2:
      "NIXZORA receives return requests, decides them and refunds the customer's card. You see the requests for your items in your seller dashboard.",
    policyReturns3: 'Accept the returns NIXZORA approves; refunds of your items show in Earnings.',
    policyReturns4:
      "When a customer disputes an order, NIXZORA reviews the order, your tracking and the customer's message and decides under this agreement.",
    policyQuestions: 'Questions',
    policyContact: '<link>Contact seller support</link>.',
  },
  fr: {
    metaTitle: 'Vendre sur NIXZORA',
    metaDescription:
      'Proposez votre électronique sur NIXZORA : touchez des acheteurs qui savent ce qu’ils veulent.',
    savedNotice: 'Enregistré. Reprenez votre candidature quand vous le souhaitez.',
    appliedNotice:
      'Candidature envoyée. Prochaine étape : connectez Stripe pour que nous puissions vérifier votre entreprise.',
    eyebrow: 'Vendre sur NIXZORA',
    heroTitle: 'Ouvrez votre boutique sur NIXZORA.',
    heroLead:
      'Touchez des acheteurs qui comparent avant d’acheter. Proposez ordinateurs, audio et accessoires aux côtés du catalogue NIXZORA ; notre équipe examine chaque boutique et chaque annonce.',
    continueApplication: 'Reprendre votre candidature ({percent} % effectué)',
    startApplication: 'Commencer votre candidature',
    createAccountToStart: 'Créer un compte pour commencer',
    heroTime: 'Environ 10 minutes. Enregistrez et terminez plus tard.',
    heroBadgeTitle: 'Versements via Stripe',
    heroBadgeBody: 'Sans frais de mise en ligne ni abonnement',
    heroImageAlt:
      'Un bureau avec un ordinateur portable, un écran, un casque, un téléphone et une manette',
    stepApply: 'Candidater',
    stepApplyBody:
      'Six courtes étapes : votre entreprise, vous, votre boutique, l’expédition, les frais et la vérification.',
    stepVerify: 'Vérifier',
    stepVerifyBody:
      'Stripe confirme votre identité et votre compte bancaire. NIXZORA n’y a jamais accès.',
    stepList: 'Publier',
    stepListBody:
      'Ajoutez des produits avec photos et caractéristiques. Nous examinons chaque annonce avant sa mise en ligne.',
    stepPaid: 'Être payé',
    stepPaidBody:
      'Vous conservez 88 % du prix de l’article, plus l’expédition, versés sur votre compte bancaire.',

    continueWithStripe: 'Continuer avec Stripe',
    connectStripe: 'Connecter Stripe',
    checkBusiness: 'Informations sur l’entreprise',
    checkStore: 'Informations sur la boutique',
    checkIdentity: 'Vérification d’identité',
    identityDone: 'Transmis à Stripe.',
    identityTodo: 'Stripe confirme votre identité. NIXZORA ne voit jamais votre pièce d’identité.',
    checkPayment: 'Vérification du paiement',
    paymentDone: 'Compte bancaire vérifié. Les versements sont activés.',
    paymentChecking: 'Stripe vérifie vos coordonnées bancaires.',
    paymentTodo: 'Ajoutez votre compte bancaire sur Stripe pour recevoir vos versements.',
    checkFinal: 'Examen final',
    finalDone: 'Approuvée. Votre boutique est ouverte.',
    finalPending:
      'Notre équipe examine votre boutique une fois la vérification Stripe terminée, généralement sous un jour ouvré.',
    contactSupport: 'Contactez le support vendeurs.',
    statusApproved: 'Approuvée',
    statusUnderReview: 'En cours d’examen',
    statusWaiting: 'En attente de vérification',
    statusSuspended: 'Suspendue',
    statusNotApproved: 'Non approuvée',
    checkFirstListing: 'Première annonce en ligne',
    listingsLive: '{count} en ligne.',
    firstListingTodo: 'Ajoutez un produit et une photo, puis soumettez-le à l’examen.',
    addListing: 'Ajouter une annonce',
    storeSuspended: 'Votre boutique est suspendue.',
    applicationNotApproved: 'Votre candidature n’a pas été approuvée.',
    toShip:
      '{count, plural, one {# commande attend d’être expédiée.} other {# commandes attendent d’être expédiées.}}',
    shipNow: 'Expédier maintenant →',
    listingSummary:
      '{live} en ligne · {review} en examen · {drafts, plural, one {# brouillon} other {# brouillons}} · commission de {rate}',
    gettingStarted: 'Premiers pas',
    sellerApplication: 'Candidature vendeur',
    weWillEmail:
      'Nous vous écrirons à {email} une fois votre candidature examinée. Vous pouvez préparer vos annonces en attendant.',
    srDone: '(terminé)',
    srTodo: '(à faire)',

    portal: 'Espace vendeur',
    viewStore: 'Voir votre boutique →',
    navOverview: 'Vue d’ensemble',
    navOrders: 'Commandes',
    navFeedback: 'Retours et évaluations',
    navListings: 'Annonces',
    navAnalytics: 'Statistiques',
    navEarnings: 'Revenus',
    navSettings: 'Paramètres de la boutique',
    status_PENDING: 'En attente d’approbation',
    status_ACTIVE: 'Approuvée',
    status_SUSPENDED: 'Suspendue',
    status_REJECTED: 'Non approuvée',

    whyTitle: 'Pourquoi vendre sur NIXZORA ?',
    whyFoundTitle: 'Soyez trouvé par les bons acheteurs',
    whyFoundBody:
      'Notre assistant associe les acheteurs aux produits selon leurs caractéristiques : les annonces bien décrites apparaissent pour les questions que les gens posent vraiment.',
    whyFeesTitle: 'Des frais vendeur simples',
    whyFeesBody:
      'Une seule commission de 12 % sur le prix de l’article. Pas de frais d’annonce, pas d’abonnement mensuel, pas de frais de traitement des cartes.',
    whyOrdersTitle: 'Gestion des commandes facile',
    whyOrdersBody:
      'Voyez quoi expédier, imprimez l’adresse, ajoutez le suivi. Les retours sont gérés avec NIXZORA.',
    whyAnalyticsTitle: 'Statistiques de ventes',
    whyAnalyticsBody:
      'Chiffre d’affaires, commandes et meilleures ventes par jour, ainsi que les évaluations de votre boutique par les clients.',
    whySecureTitle: 'Paiements sécurisés',
    whySecureBody:
      'Les clients paient NIXZORA ; Stripe vous verse vos revenus. Vos coordonnées bancaires ne passent jamais par nos serveurs.',
    feesTitle: 'Frais vendeur',
    feePerSale: 'par vente finalisée, sur le prix de l’article',
    viewFeeSchedule: 'Voir le barème complet des frais →',
    feeCustomerPays: 'Le client paie l’article',
    feeCommission: 'Commission NIXZORA',
    feeProceeds: 'Votre recette',
    feeHint:
      'Plus l’intégralité des frais d’expédition payés par le client. La taxe de vente ne vous parvient jamais.',
    faqTitle: 'FAQ vendeurs',
    faqChargeQ: 'Combien NIXZORA prélève-t-il ?',
    faqChargeA:
      'Une commission de 12 % sur le prix de l’article de chaque vente finalisée. Aucune commission sur l’expédition ni sur les taxes, pas de frais d’annonce ni d’abonnement mensuel. Consultez le <link>barème des frais</link>.',
    faqPaidQ: 'Quand suis-je payé ?',
    faqPaidA:
      'Les revenus d’une vente deviennent disponibles 14 jours après l’expédition (ce délai couvre la livraison et la plupart des retours). Les revenus disponibles sont versés sur votre compte bancaire via Stripe, au plus une fois par jour, à partir de 10 $.',
    faqProductsQ: 'Quels produits puis-je vendre ?',
    faqProductsA:
      'De l’informatique et de l’électronique neuves : ordinateurs, écrans, audio, téléphones, maison connectée, jeux vidéo, accessoires et objets connectés. Chaque annonce est examinée par notre équipe avant sa mise en ligne.',
    faqReturnsQ: 'Comment fonctionnent les retours ?',
    faqReturnsA:
      'Les clients peuvent retourner un article dans les 30 jours suivant la livraison, via NIXZORA. Le remboursement est fait sur leur carte et la commission sur le montant remboursé vous est restituée.',
    faqDisputeQ: 'Que se passe-t-il si un client conteste une commande ?',
    faqDisputeA:
      'Le support NIXZORA examine la commande, votre suivi et le message du client, puis tranche selon le Contrat vendeur. Conservez un numéro de suivi pour chaque envoi.',
    faqApprovalQ: 'Combien de temps prend l’approbation ?',
    faqApprovalA:
      'Généralement un jour ouvré après la fin de votre vérification Stripe. Vous pouvez préparer vos annonces en attendant.',
    faqVerifyQ: 'Quelles informations sont nécessaires pour la vérification ?',
    faqVerifyA:
      'Les informations sur votre entreprise ainsi que le nom légal, la date de naissance et le numéro de téléphone du titulaire sur NIXZORA ; votre identité, votre compte bancaire et vos informations fiscales sur les formulaires sécurisés de Stripe.',

    settingsTitle: 'Paramètres de la boutique',
    storeProfile: 'Profil de la boutique',
    storeName: 'Nom de la boutique',
    contactEmail: 'E-mail de contact',
    contactEmailHint: 'Pour les commandes et les versements.',
    aboutStore: 'À propos de votre boutique',
    aboutStoreHint: 'Affiché sur la page de votre boutique.',
    category: 'Catégorie',
    notSet: 'Non définie',
    website: 'Site web',
    supportEmail: 'E-mail du service client',
    supportPhone: 'Téléphone du service client',
    publicHint: 'Public.',
    branding: 'Identité visuelle',
    shipping: 'Expédition',
    carriers: 'Transporteurs',
    businessAndPayouts: 'Entreprise et versements',
    legalName: 'Raison sociale',
    storeAddress: 'Adresse de la boutique',
    commission: 'Commission',
    commissionValue: '{rate} de chaque vente',
    payoutHold: 'Délai de versement',
    payoutHoldValue: '{days} jours après l’expédition',
    payouts: 'Versements',
    payoutsOn: 'Activés',
    payoutsTestMode: ' (mode test : aucun argent ne circule)',
    payoutsVerifying: 'En cours de vérification',
    payoutsNotSetUp: 'Non configurés',
    stripeNeedsMore:
      'Stripe a besoin de quelques informations supplémentaires avant de vous payer.',
    updatePayouts: 'Mettre à jour les informations de versement',
    setUpPayouts: 'Configurer les versements',
    supportChanges:
      'Les modifications de la raison sociale, de l’adresse de l’entreprise et de l’adresse de la boutique passent par le support vendeurs.',

    policyMetaTitle: 'Contrat vendeur et frais',
    policyMetaDescription:
      'Le Contrat vendeur NIXZORA, le barème des frais et la Politique de retour de la marketplace.',
    policyTitle: 'Contrat vendeur',
    translationNote:
      'Cette traduction est fournie à titre indicatif ; la version anglaise fait foi.',
    policyIntro:
      'Cette page résume les règles que chaque vendeur de la marketplace NIXZORA accepte lors de sa candidature. NIXZORA est une marketplace de démonstration : produits, marques et prix sont fictifs.',
    policyAgreementTitle: 'Contrat vendeur',
    policyAgreement1:
      'Ne proposez que des produits neufs que vous avez en stock, avec des titres, photos, caractéristiques et prix exacts. Chaque annonce est examinée avant sa mise en ligne et peut être retirée si elle enfreint ces règles.',
    policyAgreement2:
      'Expédiez dans le délai que vous avez fixé (1 ou 2 jours ouvrés) avec un numéro de suivi, depuis les États-Unis, vers les régions que vous avez choisies.',
    policyAgreement3:
      'Tenez à jour les informations sur votre entreprise, son titulaire et vos versements. NIXZORA peut suspendre une boutique qui fournit de fausses informations, manque des expéditions de façon répétée ou fait l’objet de plaintes graves.',
    policyAgreement4:
      'Les clients paient NIXZORA. Les vendeurs ne demandent jamais aux clients de payer en dehors de NIXZORA et ne collectent pas leurs coordonnées à des fins marketing.',
    policyFeesTitle: 'Barème des frais',
    policyCommission: 'Commission',
    policyCommissionBody:
      '12 % du prix de l’article de chaque vente finalisée (le taux de votre boutique figure dans les Paramètres de la boutique).',
    policyShipping: 'Expédition',
    policyShippingBody:
      'Aucune commission. Les frais d’expédition payés par le client vous sont reversés intégralement.',
    policyTax: 'Taxe de vente',
    policyTaxBody:
      'Aucune commission. NIXZORA la collecte et la reverse en tant que facilitateur de marketplace.',
    policyCoupons: 'Codes promo',
    policyCouponsBody: 'Financés par NIXZORA. Vous êtes payé sur le prix avant remise.',
    policyRefunds: 'Remboursements',
    policyRefundsBody:
      'La part remboursée de l’article, moins la commission correspondante, est déduite de vos revenus : la commission vous est restituée.',
    policyCancellations: 'Annulations',
    policyCancellationsBody: 'Les commandes annulées avant expédition ne vous coûtent rien.',
    policyCard: 'Traitement des cartes',
    policyCardBody: 'Inclus : NIXZORA le prend en charge.',
    policyListingFees: 'Frais d’annonce ou mensuels',
    policyListingFeesBody: 'Aucun.',
    policyPayouts: 'Versements',
    policyPayoutsBody:
      'Les revenus deviennent disponibles 14 jours après l’expédition (des délais plus longs peuvent s’appliquer aux nouvelles boutiques). Les soldes disponibles à partir de 10 $ sont versés sur votre compte bancaire via Stripe Connect, au plus une fois par jour.',
    policyExample:
      'Exemple : un article vendu 100 $ avec 8 $ d’expédition vous rapporte 100 $ + 8 $ − 12 $ = <b>96 $</b>.',
    policyReturnsTitle: 'Politique de retour et de remboursement de la marketplace',
    policyReturns1:
      'Les clients peuvent retourner un article dans les 30 jours suivant la livraison, selon la <link>politique de retour NIXZORA</link>, qui couvre aussi les articles de la marketplace.',
    policyReturns2:
      'NIXZORA reçoit les demandes de retour, statue et rembourse la carte du client. Vous voyez les demandes concernant vos articles dans votre espace vendeur.',
    policyReturns3:
      'Acceptez les retours approuvés par NIXZORA ; les remboursements de vos articles apparaissent dans Revenus.',
    policyReturns4:
      'Lorsqu’un client conteste une commande, NIXZORA examine la commande, votre suivi et le message du client, puis tranche selon ce contrat.',
    policyQuestions: 'Questions',
    policyContact: '<link>Contacter le support vendeurs</link>.',
  },
  es: {
    metaTitle: 'Vende en NIXZORA',
    metaDescription:
      'Publica tus productos electrónicos en NIXZORA: llega a compradores que saben lo que quieren.',
    savedNotice: 'Guardado. Continúa tu solicitud cuando quieras.',
    appliedNotice: 'Solicitud enviada. Ahora conecta Stripe para que podamos verificar tu negocio.',
    eyebrow: 'Vende en NIXZORA',
    heroTitle: 'Abre tu tienda en NIXZORA.',
    heroLead:
      'Llega a compradores que comparan antes de comprar. Publica computadoras, audio y accesorios junto al catálogo de NIXZORA; nuestro equipo revisa cada tienda y cada publicación.',
    continueApplication: 'Continuar tu solicitud ({percent}% completado)',
    startApplication: 'Comenzar tu solicitud',
    createAccountToStart: 'Crea una cuenta para comenzar',
    heroTime: 'Unos 10 minutos. Guarda y termina después.',
    heroBadgeTitle: 'Pagos a través de Stripe',
    heroBadgeBody: 'Sin cuotas de publicación ni mensuales',
    heroImageAlt:
      'Un escritorio con una laptop, un monitor, audífonos, un teléfono y un control de juegos',
    stepApply: 'Solicita',
    stepApplyBody: 'Seis pasos cortos: tu negocio, tú, tu tienda, envío, comisiones y revisión.',
    stepVerify: 'Verifica',
    stepVerifyBody: 'Stripe confirma tu identidad y tu cuenta bancaria. NIXZORA nunca las ve.',
    stepList: 'Publica',
    stepListBody:
      'Agrega productos con fotos y especificaciones. Revisamos cada publicación antes de que salga en línea.',
    stepPaid: 'Recibe tus pagos',
    stepPaidBody:
      'Te quedas con el 88% del precio del artículo, más el envío, depositado en tu banco.',

    continueWithStripe: 'Continuar con Stripe',
    connectStripe: 'Conectar Stripe',
    checkBusiness: 'Información del negocio',
    checkStore: 'Información de la tienda',
    checkIdentity: 'Verificación de identidad',
    identityDone: 'Enviado a Stripe.',
    identityTodo: 'Stripe confirma quién eres. NIXZORA nunca ve tu identificación.',
    checkPayment: 'Verificación de pagos',
    paymentDone: 'Cuenta bancaria verificada. Los pagos están activados.',
    paymentChecking: 'Stripe está revisando tus datos bancarios.',
    paymentTodo: 'Agrega tu cuenta bancaria en Stripe para recibir pagos.',
    checkFinal: 'Revisión final',
    finalDone: 'Aprobada. Tu tienda está abierta.',
    finalPending:
      'Nuestro equipo revisa tu tienda cuando termina la verificación de Stripe, normalmente en un día hábil.',
    contactSupport: 'Contacta al soporte para vendedores.',
    statusApproved: 'Aprobada',
    statusUnderReview: 'En revisión',
    statusWaiting: 'Esperando verificación',
    statusSuspended: 'Suspendida',
    statusNotApproved: 'No aprobada',
    checkFirstListing: 'Primera publicación en línea',
    listingsLive: '{count} en línea.',
    firstListingTodo: 'Agrega un producto y una foto, y envíalo a revisión.',
    addListing: 'Agregar una publicación',
    storeSuspended: 'Tu tienda está suspendida.',
    applicationNotApproved: 'Tu solicitud no fue aprobada.',
    toShip:
      '{count, plural, one {# pedido está esperando} other {# pedidos están esperando}} envío.',
    shipNow: 'Enviar ahora →',
    listingSummary:
      '{live} en línea · {review} en revisión · {drafts, plural, one {# borrador} other {# borradores}} · {rate} de comisión',
    gettingStarted: 'Primeros pasos',
    sellerApplication: 'Solicitud de vendedor',
    weWillEmail:
      'Te escribiremos a {email} cuando tu solicitud haya sido revisada. Mientras tanto, puedes preparar tus publicaciones.',
    srDone: '(hecho)',
    srTodo: '(pendiente)',

    portal: 'Portal de vendedores',
    viewStore: 'Ver tu tienda →',
    navOverview: 'Resumen',
    navOrders: 'Pedidos',
    navFeedback: 'Devoluciones y calificaciones',
    navListings: 'Publicaciones',
    navAnalytics: 'Estadísticas',
    navEarnings: 'Ganancias',
    navSettings: 'Configuración de la tienda',
    status_PENDING: 'Esperando aprobación',
    status_ACTIVE: 'Aprobada',
    status_SUSPENDED: 'Suspendida',
    status_REJECTED: 'No aprobada',

    whyTitle: '¿Por qué vender en NIXZORA?',
    whyFoundTitle: 'Llega a los compradores indicados',
    whyFoundBody:
      'Nuestro asistente conecta a los compradores con productos según sus especificaciones, así que las publicaciones bien descritas aparecen en las preguntas que la gente realmente hace.',
    whyFeesTitle: 'Comisiones simples',
    whyFeesBody:
      'Una sola comisión del 12% sobre el precio del artículo. Sin cargos por publicación, sin cuota mensual, sin cargo por procesamiento de tarjetas.',
    whyOrdersTitle: 'Gestión de pedidos sencilla',
    whyOrdersBody:
      'Ve qué enviar, imprime la dirección, agrega el rastreo. Las devoluciones se gestionan con NIXZORA.',
    whyAnalyticsTitle: 'Estadísticas de ventas',
    whyAnalyticsBody:
      'Ingresos, pedidos y más vendidos por día, además de las calificaciones de los clientes sobre tu tienda.',
    whySecureTitle: 'Pagos seguros',
    whySecureBody:
      'Los clientes le pagan a NIXZORA; Stripe te paga a ti. Tus datos bancarios nunca pasan por nuestros servidores.',
    feesTitle: 'Comisiones para vendedores',
    feePerSale: 'por venta completada, sobre el precio del artículo',
    viewFeeSchedule: 'Ver la tabla completa de comisiones →',
    feeCustomerPays: 'El cliente paga por el artículo',
    feeCommission: 'Comisión de NIXZORA',
    feeProceeds: 'Tus ingresos',
    feeHint:
      'Más todo el envío que pague el cliente. El impuesto sobre las ventas nunca llega a ti.',
    faqTitle: 'Preguntas frecuentes para vendedores',
    faqChargeQ: '¿Cuánto cobra NIXZORA?',
    faqChargeA:
      'Una comisión del 12% sobre el precio del artículo de cada venta completada. No hay comisión sobre el envío ni los impuestos, ni cargo por publicación ni cuota mensual. Consulta la <link>tabla de comisiones</link>.',
    faqPaidQ: '¿Cuándo recibo mis pagos?',
    faqPaidA:
      'Las ganancias de una venta están disponibles 14 días después de que la envías (la retención cubre la entrega y la mayoría de las devoluciones). Las ganancias disponibles se depositan en tu banco a través de Stripe, como máximo una vez al día, a partir de $10.',
    faqProductsQ: '¿Qué productos puedo vender?',
    faqProductsA:
      'Computadoras y electrónica nuevas: computadoras, monitores, audio, teléfonos, hogar inteligente, videojuegos, accesorios y dispositivos portátiles. Nuestro equipo revisa cada publicación antes de que salga en línea.',
    faqReturnsQ: '¿Cómo funcionan las devoluciones?',
    faqReturnsA:
      'Los clientes pueden devolver artículos dentro de los 30 días posteriores a la entrega, a través de NIXZORA. El reembolso se hace a su tarjeta y la comisión sobre el monto reembolsado se te devuelve.',
    faqDisputeQ: '¿Qué pasa si un cliente disputa un pedido?',
    faqDisputeA:
      'El soporte de NIXZORA revisa el pedido, tu rastreo y el mensaje del cliente, y decide según el Acuerdo de vendedor. Guarda los números de rastreo de cada envío.',
    faqApprovalQ: '¿Cuánto tarda la aprobación?',
    faqApprovalA:
      'Normalmente un día hábil después de que termina tu verificación en Stripe. Puedes preparar publicaciones mientras esperas.',
    faqVerifyQ: '¿Qué información se necesita para la verificación?',
    faqVerifyA:
      'Los datos de tu negocio y el nombre legal, la fecha de nacimiento y el teléfono del titular en NIXZORA; tu identidad, cuenta bancaria y datos fiscales en los formularios seguros de Stripe.',

    settingsTitle: 'Configuración de la tienda',
    storeProfile: 'Perfil de la tienda',
    storeName: 'Nombre de la tienda',
    contactEmail: 'Correo de contacto',
    contactEmailHint: 'Para pedidos y pagos.',
    aboutStore: 'Acerca de tu tienda',
    aboutStoreHint: 'Se muestra en la página de tu tienda.',
    category: 'Categoría',
    notSet: 'Sin definir',
    website: 'Sitio web',
    supportEmail: 'Correo de soporte',
    supportPhone: 'Teléfono de soporte',
    publicHint: 'Público.',
    branding: 'Imagen de marca',
    shipping: 'Envío',
    carriers: 'Transportistas',
    businessAndPayouts: 'Negocio y pagos',
    legalName: 'Nombre legal',
    storeAddress: 'Dirección de la tienda',
    commission: 'Comisión',
    commissionValue: '{rate} de cada venta',
    payoutHold: 'Retención de pagos',
    payoutHoldValue: '{days} días después del envío',
    payouts: 'Pagos',
    payoutsOn: 'Activados',
    payoutsTestMode: ' (modo de prueba: no se mueve dinero)',
    payoutsVerifying: 'En verificación',
    payoutsNotSetUp: 'Sin configurar',
    stripeNeedsMore: 'Stripe necesita algunos datos más antes de pagarte.',
    updatePayouts: 'Actualizar datos de pago',
    setUpPayouts: 'Configurar pagos',
    supportChanges:
      'Los cambios de nombre legal, dirección del negocio y dirección de la tienda se hacen a través del soporte para vendedores.',

    policyMetaTitle: 'Acuerdo de vendedor y comisiones',
    policyMetaDescription:
      'El Acuerdo de vendedor de NIXZORA, la tabla de comisiones y la Política de devoluciones del marketplace.',
    policyTitle: 'Acuerdo de vendedor',
    translationNote: 'Esta traducción se ofrece por conveniencia; la versión en inglés prevalece.',
    policyIntro:
      'Esta página resume las reglas que todo vendedor del marketplace de NIXZORA acepta al presentar su solicitud. NIXZORA es un marketplace de demostración: los productos, las marcas y los precios son ficticios.',
    policyAgreementTitle: 'Acuerdo de vendedor',
    policyAgreement1:
      'Publica solo productos nuevos que tengas en inventario, con títulos, fotos, especificaciones y precios exactos. Cada publicación se revisa antes de salir en línea y puede retirarse si incumple estas reglas.',
    policyAgreement2:
      'Envía dentro del plazo que fijaste (1 o 2 días hábiles) con número de rastreo, desde los Estados Unidos, a las regiones que elegiste.',
    policyAgreement3:
      'Mantén al día los datos de tu negocio, del titular y de pagos. NIXZORA puede suspender una tienda que dé información falsa, incumpla envíos repetidamente o reciba quejas graves.',
    policyAgreement4:
      'Los clientes le pagan a NIXZORA. Los vendedores nunca piden a los clientes que paguen fuera de NIXZORA ni recopilan sus datos de contacto para marketing.',
    policyFeesTitle: 'Tabla de comisiones',
    policyCommission: 'Comisión',
    policyCommissionBody:
      '12% del precio del artículo de cada venta completada (la tasa de tu tienda aparece en Configuración de la tienda).',
    policyShipping: 'Envío',
    policyShippingBody: 'Sin comisión. El envío que paga el cliente se te transfiere completo.',
    policyTax: 'Impuesto sobre las ventas',
    policyTaxBody: 'Sin comisión. NIXZORA lo cobra y lo entrega como facilitador del marketplace.',
    policyCoupons: 'Cupones',
    policyCouponsBody: 'Los financia NIXZORA. Se te paga sobre el precio antes del descuento.',
    policyRefunds: 'Reembolsos',
    policyRefundsBody:
      'La parte reembolsada del artículo, menos su comisión, se descuenta de tus ganancias: la comisión se te devuelve.',
    policyCancellations: 'Cancelaciones',
    policyCancellationsBody: 'Los pedidos cancelados antes de que envíes no te cuestan nada.',
    policyCard: 'Procesamiento de tarjetas',
    policyCardBody: 'Incluido: lo paga NIXZORA.',
    policyListingFees: 'Cargos por publicación o mensuales',
    policyListingFeesBody: 'Ninguno.',
    policyPayouts: 'Pagos',
    policyPayoutsBody:
      'Las ganancias están disponibles 14 días después del envío (pueden aplicarse retenciones más largas a tiendas nuevas). Los saldos disponibles desde $10 se depositan en tu banco a través de Stripe Connect, como máximo una vez al día.',
    policyExample:
      'Ejemplo: un artículo vendido por $100 con $8 de envío te deja $100 + $8 − $12 = <b>$96</b>.',
    policyReturnsTitle: 'Política de devoluciones y reembolsos del marketplace',
    policyReturns1:
      'Los clientes pueden devolver artículos dentro de los 30 días posteriores a la entrega según la <link>política de devoluciones de NIXZORA</link>, que también cubre los artículos del marketplace.',
    policyReturns2:
      'NIXZORA recibe las solicitudes de devolución, decide sobre ellas y reembolsa a la tarjeta del cliente. Ves las solicitudes de tus artículos en tu panel de vendedor.',
    policyReturns3:
      'Acepta las devoluciones que NIXZORA apruebe; los reembolsos de tus artículos aparecen en Ganancias.',
    policyReturns4:
      'Cuando un cliente disputa un pedido, NIXZORA revisa el pedido, tu rastreo y el mensaje del cliente, y decide según este acuerdo.',
    policyQuestions: 'Preguntas',
    policyContact: '<link>Contacta al soporte para vendedores</link>.',
  },
});
