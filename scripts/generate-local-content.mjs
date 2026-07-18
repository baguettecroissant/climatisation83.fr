import fs from 'fs';
import path from 'path';

const INPUT_FILE = path.resolve('src/data/communes.json');

// Haversine distance formula
function haversineDistance(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return 0;
  const R = 6371; // Radius of earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Seeded random for deterministic variations per city
function createSeededRandom(seed) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  }
  return function() {
    let t = h += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Nested Spintax parser to choose synonyms randomly based on the seed
function spin(text, rand) {
  let spun = text;
  while (spun.includes('{')) {
    spun = spun.replace(/{([^{}]+)}/g, (match, choices) => {
      const options = choices.split('|');
      return options[Math.floor(rand() * options.length)];
    });
  }
  return spun;
}

const microRegions = [
  {
    id: "toulon-metropole",
    name: "Toulon Métropole & Rade",
    cities: ["toulon", "la-seyne-sur-mer", "la-garde", "ollioules", "six-fours-les-plages", "la-valette-du-var", "saint-mandrier-sur-mer", "carqueiranne", "le-pradet", "saint-cyr-sur-mer", "bandol", "sanary-sur-mer"],
    description: "l'îlot de chaleur urbain de la rade de Toulon et les collines résidentielles du Faron, soumis à une forte canicule et à l'humidité du littoral",
    typeHabitat: "appartement de centre-ville toulonnais, copropriété moderne ou villa sur les collines d'Ollioules ou du Faron",
    acType: "climatisation réversible multi-split ou gainable basse pression ultra-discrète",
    landmark: "la rade de Toulon, le Mont Faron, l'opéra de Toulon ou les plages du Mourillon",
    standing: 1.15,
    guideSlug: "split-mural-vs-gainable-var"
  },
  {
    id: "est-littoral",
    name: "Golfe de Saint-Tropez & Estérel",
    cities: ["frejus", "saint-raphael", "sainte-maxime", "saint-tropez", "cogolin", "cavalaire-sur-mer", "roquebrune-sur-argens", "grimaud", "gassin", "ramatuelle", "les-adrets-de-l-esterel", "puget-sur-argens"],
    description: "l'ensoleillement maximal du golfe de Saint-Tropez et de la côte de l'Estérel, exposé au sel marin corrosif et à la chaleur humide",
    typeHabitat: "villa provençale moderne, propriété de standing avec piscine, mas provençal rénové ou appartement face à la mer",
    acType: "climatisation gainable invisible avec régulation par zone (Airzone) ou système multi-split avec traitement anticorrosion marine",
    landmark: "le massif de l'Estérel, le golfe de Saint-Tropez, l'amphithéâtre de Fréjus ou la citadelle de Saint-Tropez",
    standing: 1.3,
    guideSlug: "climatiser-villa-provencale-murs-epais"
  },
  {
    id: "hyeres-maures",
    name: "Plaine des Maures & Côte d'Or",
    cities: ["hyeres", "bormes-les-mimosas", "le-lavandou", "la-londe-les-maures", "cuers", "sollies-pont", "pierrefeu-du-var", "gareoult", "rocbaron", "sollies-toucas", "sollies-ville", "le-luc", "vidauban", "les-arcs"],
    description: "l'influence maritime directe des îles d'Or combinée à l'effet cuvette thermique de la plaine des Maures",
    typeHabitat: "mas provençal traditionnel, bastide sur les collines des Maures ou appartement résidentiel près des ports",
    acType: "pompe à chaleur air-air réversible avec régulation intelligente ou climatisation gainable silencieuse",
    landmark: "les îles d'Or (Porquerolles), la presqu'île de Giens, le fort de Brégançon ou le massif des Maures",
    standing: 1.2,
    guideSlug: "entretien-clim-milieu-mediterraneen"
  },
  {
    id: "arriere-pays-haut-var",
    name: "Arrière-Pays & Haut-Var",
    cities: ["draguignan", "brignoles", "saint-maximin-la-sainte-baume", "lorgues", "salernes", "fayence", "barjols", "tourves", "saint-zacharie", "flayosc", "le-muy", "tourrettes", "aups", "cotignac", "regusse", "salernes", "trans-en-provence"],
    description: "les canicules sèches extrêmes en été (pics à 40°C) et les hivers froids de l'arrière-pays varois",
    typeHabitat: "bastide provençale en pierre, maison de village historique, mas dans le haut-Var ou villa récente",
    acType: "pompe à chaleur réversible Inverter A+++ haute performance (indispensable chaud/froid toute l'année)",
    landmark: "les gorges du Verdon, le lac de Sainte-Croix, la basilique de Saint-Maximin ou les vignobles du haut-Var",
    standing: 1.05,
    guideSlug: "climatisation-haut-var"
  }
];

function getMicroRegion(slug) {
  const match = microRegions.find(r => r.cities.includes(slug) || r.cities.some(c => slug.includes(c)));
  return match || microRegions[0]; // Default to Toulon Métropole
}

// ----------------------------------------------------
// Deep Spintax Generators with multiple variation paths
// ----------------------------------------------------

function generateIntroText(c, installers, distance, region, rand, btu, savings, surfaceKm2, density) {
  let introTemplates = [
    // Variation 1
    `{Située au cœur de la magnifique région de|Nichée au sein du territoire de|Implantée dans la zone de} ${region.name}, la commune de **{nom}** ({codePostal}) {doit faire face à d'importants enjeux énergétiques et climatiques|fait face à des étés de plus en plus chauds sous l'influence du climat méditerranéen}. {Comptant actuellement {population} résidents établis sur un territoire de {surface} km², la gestion du confort d'été y est une priorité absolue.|Avec une population de {population} habitants et une densité de {density} hab/km², les besoins en climatisation performante augmentent chaque année.}

    {L'effet combiné de {description} rend l'air parfois étouffant durant les mois les plus chauds, de juin à septembre.|En raison de {description}, les factures de climatisation en été et de chauffage en hiver peuvent s'envoler sans un système régulé.} {L'architecture résidentielle à {nom}, caractérisée par un bâti de type {typeHabitat}, requiert une intégration technique très propre.|Pour équiper des habitations typiques comme {typeHabitat}, le choix d'un système de climatisation réversible intelligent est indispensable.}

    {Pour assurer une température idéale de 22°C dans un logement de 100 m² à {nom}, la puissance théorique recommandée est de {btu} kW.|Les bilans thermiques réalisés dans la zone de {nom} préconisent en moyenne une puissance de {btu} kW pour couvrir les besoins d'une villa standard.} {L'installation d'une PAC réversible air-air A+++ permet d'économiser environ {savings} € par an par rapport à de simples radiateurs électriques.|Cette solution aérothermique de pointe réduit les factures d'énergie de près de {savings} € par an tout en purifiant l'air ambiant.} {Grâce à la proximité des axes, les techniciens frigoristes agréés basés à seulement {distance} km de Toulon interviennent sous des délais record.|La commune n'étant située qu'à {distance} km de Toulon, les installateurs locaux proposent des visites de conception gratuites très rapidement.}`,

    // Variation 2
    `{À {nom} ({codePostal}), le confort thermique est indissociable de la qualité de vie varoise.|Pour les {population} habitants de la commune de {nom} ({codePostal}), s'équiper d'une climatisation de standing est devenu un investissement thermique stratégique.} {Sur ce territoire de {surface} km², la densité résidentielle de {density} hab/km² impose de choisir des compresseurs extérieurs extrêmement silencieux pour préserver le voisinage.|S'étendant sur {surface} km², la localité combine le charme architectural provençal et des exigences d'intégration technique modernes.}

    {Les spécificités climatiques locales, marquées par {description}, justifient pleinement l'adoption de {acType}.|Face à {description}, les propriétaires se tournent en priorité vers {acType} pour leur habitat.} {Les bâtis traditionnels ou modernes de type {typeHabitat} exigent une étude technique préalable avant toute pose de liaisons frigorifiques.|Pour des propriétés exigeantes telles que {typeHabitat}, l'intégration esthétique doit être invisible et sans goulottes plastiques.}

    {Un dimensionnement précis de {btu} kW est généralement requis pour garantir une fraîcheur optimale lors des pics de canicule.|Les techniciens Qualipac RGE estiment à {btu} kW la puissance nécessaire pour un volume d'environ 250 m³.} {Grâce aux coefficients de performance (COP) de 4.5+, cette transition génère {savings} € d'économies annuelles sur le budget électricité.|Cette démarche permet de réduire l'empreinte carbone du logement tout en économisant {savings} € par an.} {La ville se trouve à {distance} km de l'agglomération toulonnaise, assurant une couverture technique quotidienne par nos équipes.|N'étant qu'à {distance} km de Toulon, {nom} bénéficie d'antennes techniques locales très réactives pour la pose et la mise en service.}`,

    // Variation 3
    `La gestion de la température à **{nom}** ({codePostal}) est {un sujet crucial pour les {population} habitants.|devenue une préoccupation majeure face aux étés de plus en plus chauds du Var.} S'étendant sur {surface} km² avec une densité de {density} hab/km², la commune de {nom} subit des conditions météorologiques méditerranéennes intenses.

    Les habitations locales, principalement de type {typeHabitat}, nécessitent des systèmes thermodynamiques adaptés comme {acType} pour pallier {description}. {Ce type d'installation permet d'assurer un rafraîchissement efficace sans gaspillage d'énergie.|Le but est de garantir une efficacité énergétique maximale tout en s'intégrant au style provençal.}

    {Une puissance de {btu} kW est conseillée pour maintenir un confort thermique parfait en été.|L'évaluation technique moyenne recommande {btu} kW pour les habitations de ce secteur.} {L'adoption d'un tel système permet d'économiser environ {savings} € par an par rapport à un chauffage électrique classique.|Ce choix génère un gain économique de {savings} € par an, amortissant rapidement l'investissement.} {Grâce à une distance de seulement {distance} km de la préfecture de Toulon, les interventions de pose et de maintenance s'effectuent sous des délais optimaux.|Située à {distance} km de Toulon, la localité est idéalement desservie par nos artisans qualifiés RGE.}`,

    // Variation 4
    `{Avec ses {population} habitants et sa configuration géographique unique de {surface} km²,|La localité de} **{nom}** ({codePostal}) {nécessite des installations de chauffage et climatisation durables.|requiert des solutions de génie thermique adaptées à son environnement.} La densité urbaine de {density} hab/km² et {description} font de la climatisation réversible un choix incontournable pour les propriétaires.

    Le parc immobilier, composé en grande partie de {typeHabitat}, est idéalement équipé avec {acType}. Ce système répond à la fois aux exigences esthétiques locales et aux contraintes énergétiques actuelles.

    {Le calcul thermique pour une maison type à {nom} donne une puissance requise de {btu} kW.|Un dimensionnement de {btu} kW est généralement préconisé par les experts locaux.} {Les économies d'énergie générées atteignent {savings} € par an, un atout majeur pour réduire son budget.|Le passage à la pompe à chaleur air-air réduit la consommation d'électricité, ce qui représente environ {savings} € d'économies annuelles.} {À seulement {distance} km de Toulon, nos techniciens frigoristes certifiés assurent un suivi et un SAV de proximité.|Nos équipes interviennent rapidement depuis Toulon, située à {distance} km, pour installer votre climatisation réversible.}`
  ];

  const template = introTemplates[Math.floor(rand() * introTemplates.length)];

  const replaced = template
    .replace(/{nom}/g, c.nom)
    .replace(/{codePostal}/g, c.codePostal)
    .replace(/{population}/g, c.population.toLocaleString('fr-FR'))
    .replace(/{surface}/g, surfaceKm2)
    .replace(/{density}/g, density)
    .replace(/{description}/g, region.description)
    .replace(/{typeHabitat}/g, region.typeHabitat)
    .replace(/{btu}/g, btu)
    .replace(/{savings}/g, savings)
    .replace(/{distance}/g, distance)
    .replace(/{acType}/g, region.acType);

  return spin(replaced, rand);
}

function generateChallengeText(c, region, altitude, rand) {
  let challengeTemplates = [
    // Variation 1
    `{Installer une unité extérieure de climatisation à|La pose d'un compresseur de climatisation réversible à} **{nom}** {doit respecter scrupuleusement les règles locales d'urbanisme (PLU).|est soumise à des réglementations strictes d'intégration visuelle et acoustique.} {À une altitude de {altitude} mètres, l'orientation du groupe extérieur doit être réfléchie pour ne pas gêner le voisinage.|Située à une altitude moyenne de {altitude} mètres, la commune applique des normes restrictives sur les modifications de façade.} {Si votre projet se situe dans le périmètre d'un site historique protégé ou sous l'avis des Architectes des Bâtiments de France (ABF) du Var, aucune liaison frigorifique ne doit être visible de la rue.|Les règlements de copropriété ou les avis ABF locaux imposent de camoufler le bloc extérieur sous un cache-clim ventilé assorti aux enduits provençaux.} {Pour valider vos droits, vous pouvez consulter le cadastre sur [le site officiel du Géoportail de l'urbanisme](https://www.geoportail-urbanisme.gouv.fr/) ou déposer une déclaration préalable en mairie de {nom}.|Prenez conseil auprès du service d'urbanisme de la mairie de {nom} pour vous assurer de la conformité du modèle envisagé.}
    
    {Pour les appartements et villas de la région, la solution préconisée est {acType}.|Afin de préserver l'authenticité des façades et l'esthétique des intérieurs, les frigoristes recommandent {acType}.} {Ces équipements de classe A+++ garantissent un fonctionnement silencieux à 19 dB, idéal pour respecter la tranquillité nocturne.|Ce type d'intégration permet de distribuer l'air de manière homogène dans les pièces de nuit sans aucun impact visuel.} {La pose sur silent-blocks amortisseurs élimine les transmissions vibratoires dans la dalle en béton.|Les supports au sol anti-vibrations sont indispensables pour éviter les nuisances sonores directes ou indirectes.}`,

    // Variation 2
    `{Le défi d'une installation de climatisation à|Les contraintes techniques de pose d'une pompe à chaleur à} **{nom}** {résident dans l'adéquation entre performance thermique et exigences esthétiques.|tiennent à la fois à l'implantation des blocs extérieurs et aux règles de copropriété.} {À l'altitude de {altitude} mètres, les variations de température exigent une pose fiable pour résister aux intempéries.|À cette altitude moyenne de {altitude} mètres, l'unité extérieure doit être protégée du rayonnement solaire direct pour maintenir un SEER optimal.} {Il est impératif de déposer une déclaration préalable de travaux (DP) en mairie de {nom} avant toute pose sur mur porteur.|Le Plan Local d'Urbanisme (PLU) interdit toute goulotte plastique apparente sur les façades des bastides provençales.} {Vérifiez les restrictions paysagères sur le [Géoportail de l'urbanisme](https://www.geoportail-urbanisme.gouv.fr/) pour éviter toute demande de mise en conformité a posteriori.|Les Architectes des Bâtiments de France (ABF) rejettent régulièrement les blocs extérieurs non peints ou non masqués.}
    
    {L'utilisation de {acType} permet de s'affranchir des contraintes esthétiques les plus strictes.|La pose de {acType} est la réponse technique idéale pour les propriétés de la commune.} {Le niveau sonore intérieur descend sous le seuil d'audibilité humaine, favorisant un confort optimal.|La technologie Inverter régule la puissance en continu, ce qui évite les pics de bruit au démarrage du compresseur.} {Les installateurs locaux intègrent des cache-climats en aluminium laqué pour fondre le système dans l'environnement.|Des habillages sur mesure en bois noble traité ou en composite de couleur ocre permettent une intégration paysagère parfaite.}`,

    // Variation 3
    `À **{nom}**, l'installation d'un système de climatisation réversible ne se fait pas à la légère. Avec une altitude de {altitude} mètres, le climat local présente des variations thermiques qui exigent un matériel robuste et une pose adaptée.
    
    Le Plan Local d'Urbanisme (PLU) de la mairie de {nom} encadre strictement la pose de groupes extérieurs sur les façades. Les installations visibles depuis l'espace public doivent être validées via une déclaration préalable. Nous vous invitons à consulter le [Géoportail de l'urbanisme](https://www.geoportail-urbanisme.gouv.fr/) pour prendre connaissance des contraintes réglementaires de votre zone.
    
    Pour pallier ces contraintes, la solution idéale réside dans **{acType}**. {Ce système offre une intégration visuelle totale tout en limitant les nuisances sonores.|Son montage permet de conserver l'esthétique provençale de votre bien immobilier.} Les fixations sont réalisées avec des amortisseurs de vibrations pour protéger la structure en pierre ou en parpaing.`,

    // Variation 4
    `La réussite d'un projet thermique à **{nom}** repose sur le respect des réglementations en vigueur. Située à {altitude} mètres d'altitude, la commune est soumise à des règles d'urbanisme destinées à préserver son identité paysagère.
    
    Toute modification de façade, comme l'ajout d'une console ou d'un compresseur de clim réversible, nécessite d'effectuer les démarches réglementaires en mairie de {nom}. Les liaisons frigorifiques doivent être encastrées ou dissimulées sous des habillages aux teintes locales. Le cadastre officiel de la commune est consultable sur le [Géoportail de l'urbanisme](https://www.geoportail-urbanisme.gouv.fr/).
    
    Pour concilier ces obligations et un confort d'été de standing, nos frigoristes préconisent l'usage de **{acType}**. {Cet équipement s'implante discrètement et offre des performances acoustiques haut de gamme.|Ce choix technique assure un confort invisible et silencieux, idéal pour les résidences exigeantes de la commune.}`
  ];

  const template = challengeTemplates[Math.floor(rand() * challengeTemplates.length)];

  const replaced = template
    .replace(/{nom}/g, c.nom)
    .replace(/{acType}/g, region.acType)
    .replace(/{altitude}/g, altitude)
    .replace(/{regionName}/g, region.name);

  return spin(replaced, rand);
}

function generateHelpText(c, installers, delai, rand, priceMin, priceMax) {
  let helpTemplates = [
    // Variation 1
    `{Afin d'amortir le coût de votre installation thermique à|Pour financer votre projet de climatisation réversible à} **{nom}**, {de nombreuses aides de l'État et primes énergies sont applicables en 2026.|vous pouvez bénéficier de subventions publiques importantes et de dispositifs fiscaux attractifs.} {L'obtention de la Prime CEE (Certificats d'Économie d'Énergie) et d'un taux de TVA réduit à 10% sur la pose impose obligatoirement de confier les travaux à un professionnel certifié RGE Qualipac.|Le recours à un installateur certifié Reconnu Garant de l'Environnement (RGE) est une condition essentielle pour déduire ces primes de votre reste à charge.} {Pour effectuer une simulation d'éligibilité gratuite, consultez le portail officiel de l'Agence de la transition écologique ([ADEME](https://www.ademe.fr/)) ou contactez un conseiller France Rénov' du Var.|Retrouvez les barèmes d'aides à jour et les conseils d'isolation sur le site de l'[ADEME](https://www.ademe.fr/) ou de l'Anah.}
    
    {Le marché de la climatisation autour de {nom} compte {installers} entreprises certifiées RGE Qualipac en activité.|On dénombre environ {installers} climaticiens qualifiés RGE capables d'intervenir rapidement sur {nom}.} {Une étude de conception et un devis gratuit sont généralement réalisés sous un délai de {delai} jours.|Les artisans partenaires s'engagent à planifier une visite technique chez vous sous {delai} jours.} {Pour l'installation complète d'un système multi-split de 3 pièces (salon + 2 chambres), prévoyez un budget moyen de {priceMin} € à {priceMax} € TTC posé.|Le budget moyen constaté pour équiper une habitation individuelle de 3 pièces avec un matériel Inverter A+++ oscille entre {priceMin} € et {priceMax} € TTC tout compris.}`,

    // Variation 2
    `{Financer sa pompe à chaleur réversible à|Réduire ses factures d'énergie à} **{nom}** {est grandement facilité par les dispositifs d'aide 2026.|est facilité par plusieurs primes d'État et incitations fiscales régionales.} En faisant appel à un climaticien qualifié **RGE Qualipac**, vous débloquez l'accès à la Prime CEE et au taux de TVA réduit à 10% sur la main-d'œuvre. De nombreuses informations d'éligibilité sont partagées par l'[ADEME](https://www.ademe.fr/) pour orienter les propriétaires du 83.
    
    {Le secteur de {nom} est couvert par {installers} professionnels du froid agréés RGE.|Notre réseau rassemble {installers} artisans de confiance opérant sur la localité de {nom}.} {Leur réactivité permet d'obtenir un rendez-vous technique sous {delai} jours.|Une visite de dimensionnement peut être organisée sous {delai} jours ouvrés.} Pour la pose d'une climatisation multi-split performante (3 pièces), comptez un investissement moyen de **{priceMin} € à {priceMax} € TTC posé**, selon la complexité du chantier.`,

    // Variation 3
    `Les dispositifs d'aide financière en 2026 permettent aux habitants de **{nom}** d'alléger considérablement le reste à charge de leurs travaux de rénovation énergétique. L'installation d'une pompe à chaleur air-air réversible ouvre droit à la Prime CEE et à la TVA réduite à 10% sur la pose, à condition exclusive de faire appel à un frigoriste certifié **RGE Qualipac**.
    
    Pour étudier vos droits et planifier vos travaux, vous pouvez consulter les guides de l'[ADEME](https://www.ademe.fr/). Actuellement, **{installers} entreprises qualifiées** interviennent régulièrement sur la commune de {nom}.
    
    Un devis personnalisé et gratuit peut vous être proposé sous **{delai} jours**. Le coût estimé pour équiper un logement de 3 pièces (système multi-split Inverter de marque premium) varie généralement de **{priceMin} € à {priceMax} € TTC posé**.`,

    // Variation 4
    `Pour équiper votre logement à **{nom}** avec un système de chauffage et de climatisation réversible, plusieurs aides sont à votre disposition. La Prime CEE (Certificats d'Économie d'Énergie) et la TVA à taux réduit de 10% s'appliquent directement sur votre facture, pour peu que votre installateur possède la certification **RGE Qualipac**.
    
    Les guides officiels de l'énergie et de la rénovation sont accessibles sur le portail de l'[ADEME](https://www.ademe.fr/). Sur la commune de {nom}, on compte **{installers} installateurs spécialisés** capables de concevoir votre réseau.
    
    Le délai moyen d'intervention pour un audit technique à domicile est de **{delai} jours**. Le budget à prévoir pour l'installation d'un équipement tri-split Inverter A+++ se situe entre **{priceMin} € et {priceMax} € TTC**, matériel et pose inclus.`
  ];

  const template = helpTemplates[Math.floor(rand() * helpTemplates.length)];

  const replaced = template
    .replace(/{nom}/g, c.nom)
    .replace(/{installers}/g, installers)
    .replace(/{delai}/g, delai)
    .replace(/{priceMin}/g, priceMin.toLocaleString('fr-FR'))
    .replace(/{priceMax}/g, priceMax.toLocaleString('fr-FR'));

  return spin(replaced, rand);
}

function generateAnecdoteText(c, region, rand) {
  let anecdoteTemplates = [
    // Variation 1
    `{L'intégration paysagère des systèmes de confort à|La préservation du patrimoine visuel et historique à} **{nom}** est une priorité, notamment en raison de la proximité de sites célèbres comme **{landmark}**. {Pour masquer l'unité extérieure fixée sur les murs en pierre ou les enduits ocre traditionnels, les installateurs proposent des cache-climats de standing.|Afin de respecter l'identité architecturale des ruelles et des propriétés de la commune, la pose d'un coffrage ventilé en aluminium thermolaqué est fortement recommandée.} {Ce dispositif esthétique protège le compresseur des rayons UV intenses du Var, prolongeant la durée de vie du fluide R32 et augmentant le rendement saisonnier.|Ces caches ajourés n'entravent pas la circulation d'air nécessaire aux échanges thermiques et atténuent le niveau sonore extérieur de près de 3 dB.}`,

    // Variation 2
    `{Pour conserver le charme unique des propriétés à|Afin de préserver le cachet historique des habitations de} **{nom}**, {la discrétion visuelle de votre pompe à chaleur est essentielle près de **{landmark}**.|les groupes extérieurs font l'objet d'une intégration minutieuse à proximité directe de **{landmark}**.} {Il est d'usage d'implanter le groupe extérieur au sol derrière un paravent végétal ou de l'habiller d'un coffrage en bois de standing.|Les installateurs du 83 conçoivent des structures d'intégration sur mesure en harmonie avec les façades provençales ou contemporaines.} {Ces coffrages robustes protègent l'échangeur des vents chargés de sable ou du climat sec et venteux (mistral) tout en éliminant toute nuisance sonore.|Ces habillages haut de gamme protègent les raccordements frigorifiques des intempéries et améliorent le SEER global de votre équipement.}`,

    // Variation 3
    `À **{nom}**, l'harmonie avec l'environnement naturel et les sites d'intérêt comme **{landmark}** impose de soigner l'intégration visuelle de votre climatiseur.
    
    Les techniciens varois privilégient l'installation de caches-climats ajourés en bois composite ou en aluminium laqué. Ce habillage permet d'intégrer parfaitement le groupe extérieur dans le décor provençal, tout en le protégeant du mistral et des rayons solaires directs. Ce dispositif permet également de réduire les vibrations et le bruit de fonctionnement, garantissant une tranquillité totale pour vous et vos voisins.`,

    // Variation 4
    `Le respect de l'architecture locale de **{nom}**, à proximité de **{landmark}**, est au centre des préoccupations d'aménagement. L'installation d'une climatisation réversible ne doit pas altérer le charme traditionnel du bâti.
    
    C'est pourquoi nos partenaires préconisent systématiquement la pose de caches extérieurs design ou l'implantation des compresseurs au sol, masqués par des végétaux. Ces aménagements protègent la machine de la poussière et prolongent sa durée de vie tout en respectant l'identité visuelle de la commune.`
  ];

  const template = anecdoteTemplates[Math.floor(rand() * anecdoteTemplates.length)];

  const replaced = template
    .replace(/{nom}/g, c.nom)
    .replace(/{landmark}/g, region.landmark);

  return spin(replaced, rand);
}

const faqPool = [
  {
    topic: "prix",
    q: "Quel est le prix moyen d'une climatisation réversible à {city} ?",
    a: "À {city}, pour un mono-split mural design de grande marque posé dans une seule pièce, comptez entre 1 200 € et 2 400 € TTC. Pour un système multi-split ou un gainable invisible desservant 3 à 4 pièces, le budget moyen oscille de 4 200 € à 10 000 € TTC selon les contraintes de pose et de régulation thermique."
  },
  {
    topic: "aides",
    q: "Quelles subventions énergies sont disponibles à {city} en 2026 ?",
    a: "La pose d'une climatisation réversible (PAC air-air) de classe A+++ à {city} ouvre droit aux primes CEE (Certificats d'Économie d'Énergie) versées par les fournisseurs d'énergie, ainsi qu'à un taux de TVA réduit à 10% sur la pose. Ces aides sont réservées aux installations réalisées par un artisan certifié RGE Qualipac."
  },
  {
    topic: "copropriete",
    q: "Faut-il l'autorisation de la mairie ou du syndic pour poser une clim à {city} ?",
    a: "Oui, toute installation modifiant l'aspect extérieur d'un bâtiment à {city} requiert l'accord préalable écrit du syndic de copropriété et le dépôt d'une déclaration préalable (DP) en mairie. Si vous êtes dans un périmètre classé ABF, l'accord des Architectes des Bâtiments de France est également requis."
  },
  {
    topic: "consommation",
    q: "Quelle économie de chauffage peut-on faire avec une PAC à {city} ?",
    a: "Grâce à des coefficients de performance (COP) élevés, une climatisation réversible consomme 1 kW d'électricité pour restituer plus de 4 kW de chaleur. En remplaçant des radiateurs électriques grille-pain à {city}, vous pouvez diviser vos factures de chauffage hivernal par 3 ou 4."
  },
  {
    topic: "bruit",
    q: "Existe-t-il des risques de nuisances sonores pour les voisins à {city} ?",
    a: "Pour éviter tout conflit de voisinage à {city}, les frigoristes Qualipac installent les compresseurs extérieurs sur des plots amortisseurs de vibrations (silent-blocks) et préconisent des modèles silencieux (Daikin, Mitsubishi Electric) équipés de modes nuit limitant le niveau sonore extérieur sous les 40 dB(A)."
  },
  {
    topic: "entretien",
    q: "L'entretien d'une climatisation réversible est-il obligatoire à {city} ?",
    a: "Conformément à la réglementation de 2020, un entretien bisannuel par un frigoriste certifié est obligatoire pour les pompes à chaleur d'une puissance supérieure à 4 kW. Dans le Var, en raison de l'humidité littorale et du mistral, un nettoyage annuel des filtres est fortement conseillé pour garantir la qualité de l'air."
  },
  {
    topic: "gainable",
    q: "Pourquoi choisir une climatisation gainable pour une villa à {city} ?",
    a: "La climatisation gainable est la solution invisible par excellence. L'unité intérieure est dissimulée en faux-plafond, et l'air est diffusé par des grilles de soufflage discrètes. Elle offre un confort acoustique exceptionnel (19 dB) et une régulation pièce par pièce intelligente (Airzone) idéale pour les villas de standing à {city}."
  },
  {
    topic: "residence",
    q: "Comment protéger sa résidence secondaire de l'humidité à {city} ?",
    a: "Grâce au mode déshumidification (Dry) ou hors-gel (10°C) programmable à distance via Wi-Fi, la climatisation réversible régule l'hygrométrie de votre résidence secondaire à {city} en votre absence. Elle protège vos peintures, boiseries et meubles haut de gamme du sel marin et des moisissures."
  },
  {
    topic: "puissance",
    q: "Comment déterminer la puissance idéale en kW pour mon logement à {city} ?",
    a: "Un calcul précis de puissance de climatisation à {city} s'appuie sur le volume des pièces, la hauteur sous plafond, la qualité de l'isolation et l'ensoleillement des vitrages. Généralement, les frigoristes varois prévoient environ 100 W par m² pour un logement standard, ajusté selon l'inertie du bâti."
  },
  {
    topic: "r32",
    q: "Qu'est-ce que le fluide R32 préconisé à {city} ?",
    a: "Le fluide R32 est le gaz réfrigérant écologique standard en 2026. Il présente un potentiel de réchauffement global (PRG) trois fois inférieur à l'ancien fluide R410A. Son utilisation est requise pour assurer la conformité F-Gas de votre système thermique réversible à {city}."
  }
];

function generateFAQs(cityName, rand) {
  const shuffled = [...faqPool].sort(() => rand() - 0.5);
  const picked = shuffled.slice(0, 5); // Pick 5 FAQs
  
  return picked.map(item => {
    const qSpun = spin(item.q, rand);
    const aSpun = spin(item.a, rand);
    return {
      q: qSpun.replace(/{city}/g, cityName),
      a: aSpun.replace(/{city}/g, cityName)
    };
  });
}

// ----------------------------------------------------
// Main Processing Loop
// ----------------------------------------------------
async function generateLocalContent() {
  try {
    if (!fs.existsSync(INPUT_FILE)) {
      throw new Error(`File ${INPUT_FILE} does not exist. Run fetch-cities first.`);
    }

    const communes = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf-8'));
    console.log(`Generating unique combinatorial texts for ${communes.length} Var communes...`);

    // Center coordinates Toulon: lat 43.1242, lon 5.9280
    const centerLat = 43.1242;
    const centerLon = 5.9280;

    const enriched = communes.map((c) => {
      const rand = createSeededRandom(c.slug);
      const region = getMicroRegion(c.slug);

      const lat = c.coordinates?.lat || centerLat;
      const lon = c.coordinates?.lon || centerLon;
      const distanceToCenter = Math.round(haversineDistance(lat, lon, centerLat, centerLon));
      
      const surfaceKm2 = c.surface ? parseFloat((c.surface / 100).toFixed(1)) : 0;
      const density = surfaceKm2 > 0 ? Math.round(c.population / surfaceKm2) : 0;
      
      // Altitude Var: variable, littoral vs haut-Var mountains
      let altitude = Math.round(5 + rand() * 45); // 5 to 50m (Littoral)
      if (region.id === "arriere-pays-haut-var") {
        altitude = Math.round(150 + rand() * 550); // 150 to 700m (Haut-Var)
      }

      // Standing calculations
      const baseStanding = region.standing;
      const localStandingMultiplier = baseStanding + (rand() * 0.12);

      // Climate & Market variables
      const installersCount = Math.round(6 + rand() * 12); // 6 to 18 premium installers
      const delaiMoyen = Math.round(1 + rand() * 2); // 1 to 3 days
      const hotDays = Math.round(20 + rand() * 20); // 20 to 40 hot days in 83

      // Math calculations for local authority data
      const btuRequired = (10 * (1 + (altitude / 1000))).toFixed(1);
      const savingsEstimated = Math.round(750 + rand() * 350);

      // Price brackets adjusted by standing
      const priceMin = Math.round(1200 * localStandingMultiplier);
      const priceMax = Math.round(3500 * localStandingMultiplier);
      const priceGainableMin = Math.round(4800 * localStandingMultiplier);
      const priceGainableMax = Math.round(11000 * localStandingMultiplier);

      // Generated spun texts
      const introText = generateIntroText(c, installersCount, distanceToCenter, region, rand, btuRequired, savingsEstimated, surfaceKm2, density);
      const accessibilityChallenge = generateChallengeText(c, region, altitude, rand);
      const localHelp = generateHelpText(c, installersCount, delaiMoyen, rand, priceMin, priceMax);
      const anecdotePatrimoine = generateAnecdoteText(c, region, rand);

      const geoportailLink = `https://www.geoportail.gouv.fr/carte?c=${lon},${lat}&z=14&l0=GEOGRAPHICALGRIDSYSTEMS.MAPS.SCAN-EXPRESS.STANDARD::GEOPORTAIL:OGC:WMTS(1)&permalink=yes`;
      const inseeLink = `https://www.insee.fr/fr/statistiques/dossier_complet/commune/${c.codeInsee}`;
      const departmentLink = `https://www.var.fr`;

      // Unique spun FAQs
      const faq = generateFAQs(c.nom, rand);

      // Stable technical characteristics
      const brandPreference = rand() > 0.5 ? "Mitsubishi Electric / Daikin (Gamme Premium Designer, 19 dB, Fluide R32)" : "Panasonic / Toshiba Inverter (Purification Plasma Ioniseur, contrôle IA)";
      const fluidType = "Fluide écologique R32 à faible empreinte carbone (Conformité F-Gas 2026)";
      const copRatio = `COP 4.5 à 5.1 / SEER A+++ (Technologie Hyper Inverter Varoise)`;
      const certifiedLevel = "Climaticien RGE Qualipac / Attestation réglementaire de manipulation des fluides";

      // Price Tiers object for page use
      const priceTiers = {
        splitMono: `${priceMin.toLocaleString('fr-FR')} €`,
        splitBi: `${Math.round(priceMin * 1.8).toLocaleString('fr-FR')} €`,
        splitTri: `${Math.round(priceMin * 2.5).toLocaleString('fr-FR')} €`,
        gainable: `${priceGainableMin.toLocaleString('fr-FR')} € – ${priceGainableMax.toLocaleString('fr-FR')} €`
      };

      // Guide contextual linking logic
      let featuredGuide = {
        title: "Aides financières climatisation 2026",
        slug: "aides-financieres-climatisation-2026"
      };

      if (region.guideSlug === "split-mural-vs-gainable-var") {
        featuredGuide = {
          title: "Split mural vs gainable dans le Var : quel système pour votre logement méditerranéen ?",
          slug: "split-mural-vs-gainable-var"
        };
      } else if (region.guideSlug === "climatiser-villa-provencale-murs-epais") {
        featuredGuide = {
          title: "Climatiser une villa provençale à murs épais : solutions pour combles et pièces de vie",
          slug: "climatiser-villa-provencale-murs-epais"
        };
      } else if (region.guideSlug === "entretien-clim-milieu-mediterraneen") {
        featuredGuide = {
          title: "Entretien clim en milieu méditerranéen : sel, poussière, pollen et filtres dans le Var",
          slug: "entretien-clim-milieu-mediterraneen"
        };
      } else if (region.guideSlug === "climatisation-haut-var") {
        featuredGuide = {
          title: "Climatisation dans le haut-Var : Draguignan, Brignoles — réversible indispensable toute l'année",
          slug: "climatisation-haut-var"
        };
      }

      return {
        ...c,
        intercommunalite: c.intercommunalite || `${region.name}`,
        marketData: {
          hotDays,
          installateursAgrees: installersCount,
          delaiMoyenJours: delaiMoyen
        },
        geographicData: {
          distanceToCenter,
          surfaceKm2,
          density,
          lat,
          lon,
          geoportailLink,
          inseeLink,
          departmentLink
        },
        altitude,
        introText,
        accessibilityChallenge,
        localHelp,
        anecdotePatrimoine,
        climCharacteristics: {
          brandPreference,
          fluidType,
          copRatio,
          certifiedLevel
        },
        faq,
        priceTiers,
        featuredGuide,
        standingMultiplier: localStandingMultiplier
      };
    });

    fs.writeFileSync(INPUT_FILE, JSON.stringify(enriched, null, 2), 'utf-8');
    console.log(`Successfully generated highly unique Spintax content inside ${INPUT_FILE}`);
  } catch (error) {
    console.error('Error generating local content:', error);
    process.exit(1);
  }
}

generateLocalContent();
