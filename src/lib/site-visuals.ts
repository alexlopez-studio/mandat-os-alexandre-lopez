export type SiteVisual = {
  src: string
  alt: string
  credit?: string
  sourceUrl?: string
  recommendedUse: string
}

export const siteVisuals = {
  portraitCutout: {
    src: '/alexandre-lopez-no-background.png',
    alt: 'Alexandre Lopez, conseiller immobilier iad France en Provence Verte et Verdon',
    recommendedUse: 'Usage limité : hero de la homepage uniquement, pour éviter la répétition du portrait sur tout le site',
  },
  cotignacVillage: {
    src: '/village-cotignac.jpg',
    alt: 'Village de Cotignac en Provence Verte et Verdon',
    recommendedUse: 'Territoire, marché local, ancrage Provence Verte & Verdon',
  },
  cotignacHouse: {
    src: '/maison-bleue-cotignac.jpg',
    alt: 'Maison et ruelle à Cotignac en Provence Verte et Verdon',
    recommendedUse: 'Habitat local, achat, audit, projection immobilière',
  },
  sellingHouse: {
    src: 'https://images.pexels.com/photos/13935476/pexels-photo-13935476.jpeg?auto=compress&cs=tinysrgb&w=1800',
    alt: 'Maison en Provence avec jardin, utilisée pour illustrer une vente immobilière',
    credit: 'Pexels',
    sourceUrl: 'https://www.pexels.com/photo/exterior-of-a-house-13935476/',
    recommendedUse: 'Page vendre, estimation, mise en valeur d’un bien',
  },
  buyingHouse: {
    src: 'https://images.pexels.com/photos/32802440/pexels-photo-32802440.jpeg?auto=compress&cs=tinysrgb&w=1800',
    alt: 'Maison de village en Provence pour illustrer un projet d’achat immobilier',
    credit: 'Pexels',
    sourceUrl: 'https://www.pexels.com/photo/charming-rustic-house-in-provence-france-32802440/',
    recommendedUse: 'Page acheter, projection acquéreur, habitat provençal',
  },
  auditFacade: {
    src: 'https://images.pexels.com/photos/36403734/pexels-photo-36403734.jpeg?auto=compress&cs=tinysrgb&w=1800',
    alt: 'Façade de maison provençale à observer pour un audit immobilier',
    credit: 'Pexels',
    sourceUrl: 'https://www.pexels.com/photo/charming-provence-house-with-green-shutters-36403734/',
    recommendedUse: 'Page audit, points de vigilance, état du bâti',
  },
  contactVillage: {
    src: 'https://images.pexels.com/photos/29864399/pexels-photo-29864399.jpeg?auto=compress&cs=tinysrgb&w=1800',
    alt: 'Rue et bâtiments colorés en Provence pour illustrer le contact local',
    credit: 'Pexels',
    sourceUrl: 'https://www.pexels.com/photo/charming-buildings-in-provence-alpes-cote-d-azur-29864399/',
    recommendedUse: 'Page contact, ambiance locale, proximité',
  },
  verdonLandscape: {
    src: '/gorges-du-verdon.jpg',
    alt: 'Gorges du Verdon en Provence Verte et Verdon',
    recommendedUse: 'Respiration territoire uniquement, usage secondaire',
  },
  vineyardLandscape: {
    src: '/vignobles-var.jpg',
    alt: 'Vignobles dans le Var',
    recommendedUse: 'Ambiance secondaire uniquement, éviter pour audit immobilier',
  },
} satisfies Record<string, SiteVisual>

export const editorialVisuals = {
  vendre: {
    heroImage: siteVisuals.sellingHouse.src,
    heroAlt: siteVisuals.sellingHouse.alt,
    featureImage: siteVisuals.cotignacVillage.src,
    featureAlt: siteVisuals.cotignacVillage.alt,
    label: 'Vente immobilière',
    note: 'Positionner, valoriser, négocier avec méthode.',
    focus: 'Vendre au bon prix, avec une stratégie claire.',
  },
  acheter: {
    heroImage: siteVisuals.buyingHouse.src,
    heroAlt: siteVisuals.buyingHouse.alt,
    featureImage: siteVisuals.cotignacHouse.src,
    featureAlt: siteVisuals.cotignacHouse.alt,
    label: 'Projet d’achat',
    note: 'Cadrer la recherche et sécuriser chaque étape.',
    focus: 'Acheter avec des critères solides et un budget cohérent.',
  },
  audit: {
    heroImage: siteVisuals.auditFacade.src,
    heroAlt: siteVisuals.auditFacade.alt,
    featureImage: siteVisuals.buyingHouse.src,
    featureAlt: 'Maison provençale à analyser avant une décision immobilière',
    label: 'Audit immobilier',
    note: 'Observer le bâti, repérer les points utiles et décider avec recul.',
    focus: 'Repérer les points de vigilance avant de vous engager.',
  },
} as const
