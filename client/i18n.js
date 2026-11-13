/* MALACONDA PROTOTYPE - language selector (EN, DE, FR, IT, ES).
   English stays in the HTML and the scripts. This file swaps each exact English text (and attribute) for its translation,
   also for what the pages draw later, and remembers the choice on every page. Same storage key as the classic site. */
(function () {
  var OFF = document.documentElement.getAttribute("data-i18n") === "off";   // the admin stays in English
  var LANGS = ["en", "de", "fr", "it", "es"], KEY = "malaconda-lang", IDX = { de: 0, fr: 1, it: 2, es: 3 };
  var LABELS = { en: "English", de: "Deutsch", fr: "Français", it: "Italiano", es: "Español" };

  // "English text": [de, fr, it, es]

  // dates drawn by the pages in English ("05 Nov 2026", "November") are rewritten in the visitor's language
  var LOC = { de: "de-CH", fr: "fr-CH", it: "it-CH", es: "es-ES" };
  var MON = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Sept: 8, Oct: 9, Nov: 10, Dec: 11 };
  var MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  var cap = function (t) { return t.charAt(0).toUpperCase() + t.slice(1); };
  function fmtDate(m, l, o) { return new Date(Date.UTC(+m[o + 2], MON[m[o + 1]], +m[o])).toLocaleDateString(LOC[l], { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }); }
  function fmtMonth(name, l, year) { var d = new Date(Date.UTC(+(year || 2026), MONTHS.indexOf(name), 1)); return cap(d.toLocaleDateString(LOC[l], year ? { month: "long", year: "numeric", timeZone: "UTC" } : { month: "long", timeZone: "UTC" })); }
  var DATE = "(\\d{2}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sept?|Oct|Nov|Dec) (\\d{4})", MNAME = "(" + MONTHS.join("|") + ")";

  var D = {
    "Some days are scripted. Malaconda is for the moment you break the script. A sparkling soda with bold flavours developed by Switzerland’s Barkeeper of the Year and a dangerous amount of fizz. Made to be enjoyed straight from the bottle or mixed into something unexpected. Go on. Give in to temptation.": ["Manche Tage sind vorgeschrieben. Malaconda ist für den Moment, in dem du aus dem Drehbuch ausbrichst. Eine Sparkling Soda mit kräftigen Aromen, entwickelt vom Schweizer Barkeeper des Jahres, und einer gefährlichen Menge Kohlensäure. Pur aus der Flasche oder gemixt zu etwas Unerwartetem. Na los. Gib der Versuchung nach.", "Certains jours sont écrits d’avance. Malaconda, c’est pour le moment où vous brisez le scénario. Un soda pétillant aux saveurs audacieuses, imaginé par le Barkeeper de l’année en Suisse, avec une dose dangereuse de bulles. À savourer au goulot ou mixé dans quelque chose d’inattendu. Allez. Cédez à la tentation.", "Alcuni giorni sono già scritti. Malaconda è per il momento in cui rompi il copione. Una soda frizzante dai gusti decisi, creata dal Barkeeper dell’anno svizzero, con una dose pericolosa di bollicine. Da gustare dritta dalla bottiglia o mixata in qualcosa di inaspettato. Dai. Cedi alla tentazione.", "Algunos días están escritos de antemano. Malaconda es para el momento en que rompes el guion. Un refresco con gas de sabores atrevidos, creado por el Barkeeper del año de Suiza, con una dosis peligrosa de burbujas. Para disfrutar directo de la botella o mezclado en algo inesperado. Vamos. Cede a la tentación."],
    "Every bottle carries more than soda. It carries the bite of the snake. Born where the jungle keeps watch.": ["Jede Flasche enthält mehr als Soda. Sie trägt den Biss der Schlange. Geboren dort, wo der Dschungel Wache hält.", "Chaque bouteille porte plus que du soda. Elle porte la morsure du serpent. Née là où la jungle veille.", "Ogni bottiglia contiene più di una soda. Porta il morso del serpente. Nata dove la giungla veglia.", "Cada botella lleva más que refresco. Lleva la mordedura de la serpiente. Nacida donde la selva vigila."],
    "Citrusy · Floral": ["Zitrusfrisch · Blumig", "Citronné · Floral", "Agrumato · Floreale", "Cítrico · Floral"],
    "Fruity · Exotic": ["Fruchtig · Exotisch", "Fruité · Exotique", "Fruttato · Esotico", "Afrutado · Exótico"],
    "The one that bites back.": ["Die, die zurückbeisst.", "Celle qui mord en retour.", "Quella che morde di rimando.", "La que muerde de vuelta."],
    "She doesn't need to bite. She charms.": ["Sie muss nicht beissen. Sie verzaubert.", "Elle n’a pas besoin de mordre. Elle charme.", "Non ha bisogno di mordere. Incanta.", "No necesita morder. Encanta."],
    "Tart": ["Herb", "Acidulé", "Aspro", "Ácido"],
    "Fruity": ["Fruchtig", "Fruité", "Fruttato", "Afrutado"],
    "Tropical": ["Tropisch", "Tropical", "Tropicale", "Tropical"],
    "Carbonated coconut water, lulo purée (20%), peppermint tea, cane sugar, citric acid.": ["Kohlensäurehaltiges Kokoswasser, Lulo-Püree (20%), Pfefferminztee, Rohrzucker, Zitronensäure.", "Eau de coco gazéifiée, purée de lulo (20 %), thé à la menthe poivrée, sucre de canne, acide citrique.", "Acqua di cocco gassata, purea di lulo (20%), tè alla menta piperita, zucchero di canna, acido citrico.", "Agua de coco carbonatada, puré de lulo (20 %), té de menta piperita, azúcar de caña, ácido cítrico."],
    "Carbonated coconut water, guava purée (20%), cane sugar, citric acid, natural guava essence.": ["Kohlensäurehaltiges Kokoswasser, Guavenpüree (20%), Rohrzucker, Zitronensäure, natürliches Guavenaroma.", "Eau de coco gazéifiée, purée de goyave (20 %), sucre de canne, acide citrique, arôme naturel de goyave.", "Acqua di cocco gassata, purea di guava (20%), zucchero di canna, acido citrico, aroma naturale di guava.", "Agua de coco carbonatada, puré de guayaba (20 %), azúcar de caña, ácido cítrico, esencia natural de guayaba."],
    "Made in Switzerland": ["Hergestellt in der Schweiz", "Fabriqué en Suisse", "Prodotto in Svizzera", "Fabricado en Suiza"],
    "Give your customers something that makes them slither through your doors.": ["Gib deinen Gästen etwas, das sie durch deine Türen schlängeln lässt.", "Offrez à vos clients de quoi les faire se faufiler jusqu’à votre porte.", "Dai ai tuoi clienti qualcosa che li faccia scivolare attraverso le tue porte.", "Dale a tus clientes algo que los haga deslizarse por tus puertas."],
    "Stock the temptation. Watch them surrender.": ["Hab die Versuchung auf Lager. Sieh zu, wie sie sich ergeben.", "Stockez la tentation. Regardez-les céder.", "Tieni in magazzino la tentazione. Guarda come si arrendono.", "Ten la tentación en stock. Míralos rendirse."],
    "You already know the right businesses.": ["Du kennst die richtigen Betriebe bereits.", "Vous connaissez déjà les bons établissements.", "Conosci già le attività giuste.", "Ya conoces los negocios adecuados."],
    "Be the one who brought the snake to town.": ["Sei der, der die Schlange in die Stadt gebracht hat.", "Soyez celui qui a ramené le serpent en ville.", "Sii tu quello che ha portato il serpente in città.", "Sé quien trajo la serpiente a la ciudad."],
    "Get rewarded for every order.": ["Lass dich für jede Bestellung belohnen.", "Soyez récompensé à chaque commande.", "Vieni premiato per ogni ordine.", "Gana una recompensa por cada pedido."],
    "You already know the right businesses. Be the one who brought the snake to town.": ["Du kennst die richtigen Betriebe bereits. Sei der, der die Schlange in die Stadt gebracht hat.", "Vous connaissez déjà les bons établissements. Soyez celui qui a ramené le serpent en ville.", "Conosci già le attività giuste. Sii tu quello che ha portato il serpente in città.", "Ya conoces los negocios adecuados. Sé quien trajo la serpiente a la ciudad."],
    "Get rewarded for every order, and every reorder, from the venues you introduce.": ["Du wirst für jede Bestellung und jede Nachbestellung der von dir vorgestellten Betriebe belohnt.", "Vous êtes récompensé pour chaque commande, et chaque réapprovisionnement, des établissements que vous présentez.", "Vieni premiato per ogni ordine, e ogni riordino, dei locali che presenti.", "Recibes una recompensa por cada pedido, y cada repetición, de los locales que presentas."],
    "Order. Partnerships. Press.": ["Bestellung. Partnerschaften. Presse.", "Commande. Partenariats. Presse.", "Ordini. Partnership. Stampa.", "Pedidos. Alianzas. Prensa."],
    "Or just a bite of curiosity.": ["Oder einfach ein Biss Neugier.", "Ou simplement une morsure de curiosité.", "O solo un morso di curiosità.", "O solo un mordisco de curiosidad."],
    "One price list for every venue. Boxes of 24 bottles, from 5 boxes.": ["Eine Preisliste für jeden Betrieb. Kartons zu 24 Flaschen, ab 5 Kartons.", "Une seule grille de prix pour chaque établissement. Caisses de 24 bouteilles, à partir de 5 caisses.", "Un unico listino per ogni locale. Cartoni da 24 bottiglie, da 5 cartoni.", "Una sola lista de precios para cada local. Cajas de 24 botellas, desde 5 cajas."],
    "Minimum order 5 boxes of 24 bottles. Delivery within 4 weeks.": ["Mindestbestellung 5 Kartons zu 24 Flaschen. Lieferung innerhalb von 4 Wochen.", "Commande minimale : 5 caisses de 24 bouteilles. Livraison sous 4 semaines.", "Ordine minimo: 5 cartoni da 24 bottiglie. Consegna entro 4 settimane.", "Pedido mínimo: 5 cajas de 24 botellas. Entrega en 4 semanas."],
    "1 box = 12 bottles of 20 cl. Delivery within 5 working days, or free pickup.": ["1 Karton = 12 Flaschen à 20 cl. Lieferung innerhalb von 5 Werktagen oder kostenlose Abholung.", "1 caisse = 12 bouteilles de 20 cl. Livraison sous 5 jours ouvrés, ou retrait gratuit.", "1 cartone = 12 bottiglie da 20 cl. Consegna entro 5 giorni lavorativi, o ritiro gratuito.", "1 caja = 12 botellas de 20 cl. Entrega en 5 días laborables, o recogida gratuita."],
    "1 box = 12 bottles of 20 cl. Mix both flavours freely. Delivery within 5 working days, or free pickup.": ["1 Karton = 12 Flaschen à 20 cl. Beide Sorten frei mischbar. Lieferung innerhalb von 5 Werktagen oder kostenlose Abholung.", "1 caisse = 12 bouteilles de 20 cl. Mélangez librement les deux saveurs. Livraison sous 5 jours ouvrés, ou retrait gratuit.", "1 cartone = 12 bottiglie da 20 cl. Mescola liberamente i due gusti. Consegna entro 5 giorni lavorativi, o ritiro gratuito.", "1 caja = 12 botellas de 20 cl. Mezcla libremente los dos sabores. Entrega en 5 días laborables, o recogida gratuita."],
    "Subtotal": ["Zwischensumme", "Sous-total", "Subtotale", "Subtotal"],
    "Subtotal (VAT incl.)": ["Zwischensumme (inkl. MwSt.)", "Sous-total (TVA incluse)", "Subtotale (IVA incl.)", "Subtotal (IVA incl.)"],
    "Delivery fee or free pickup: chosen at checkout.": ["Lieferkosten oder kostenlose Abholung: wird an der Kasse gewählt.", "Frais de livraison ou retrait gratuit : au choix lors du paiement.", "Spese di consegna o ritiro gratuito: a scelta al pagamento.", "Gastos de envío o recogida gratuita: se elige al pagar."],
    "Delivery or free pickup": ["Lieferung oder kostenlose Abholung", "Livraison ou retrait gratuit", "Consegna o ritiro gratuito", "Entrega o recogida gratuita"],
    "At checkout": ["An der Kasse", "Au paiement", "Al pagamento", "Al pagar"],
    "Free pickup": ["Kostenlose Abholung", "Retrait gratuit", "Ritiro gratuito", "Recogida gratuita"],
    "free pickup": ["kostenlose Abholung", "retrait gratuit", "ritiro gratuito", "recogida gratuita"],
    "Pickup": ["Abholung", "Retrait", "Ritiro", "Recogida"],
    "Delivered in Switzerland within 5 working days.": ["Lieferung in der Schweiz innerhalb von 5 Werktagen.", "Livraison en Suisse sous 5 jours ouvrés.", "Consegna in Svizzera entro 5 giorni lavorativi.", "Entrega en Suiza en 5 días laborables."],
    "No delivery fee. We email you to arrange the pickup.": ["Keine Lieferkosten. Wir schreiben dir, um die Abholung zu organisieren.", "Pas de frais de livraison. Nous vous écrivons pour organiser le retrait.", "Nessuna spesa di consegna. Ti scriviamo per organizzare il ritiro.", "Sin gastos de envío. Te escribimos para organizar la recogida."],
    "Enter your name.": ["Gib deinen Namen ein.", "Saisissez votre nom.", "Inserisci il tuo nome.", "Escribe tu nombre."],
    "Fill in your delivery address, or choose the free pickup.": ["Gib deine Lieferadresse ein oder wähle die kostenlose Abholung.", "Renseignez votre adresse de livraison, ou choisissez le retrait gratuit.", "Inserisci l’indirizzo di consegna, oppure scegli il ritiro gratuito.", "Rellena tu dirección de entrega, o elige la recogida gratuita."],
    "(for the carrier)": ["(für den Zusteller)", "(pour le transporteur)", "(per il corriere)", "(para el transportista)"],
    ". We email you to arrange the pickup.": [". Wir schreiben dir, um die Abholung zu organisieren.", ". Nous vous écrivons pour organiser le retrait.", ". Ti scriviamo per organizzare il ritiro.", ". Te escribimos para organizar la recogida."],
    ". Delivery within 5 working days.": [". Lieferung innerhalb von 5 Werktagen.", ". Livraison sous 5 jours ouvrés.", ". Consegna entro 5 giorni lavorativi.", ". Entrega en 5 días laborables."],
    "Collected": ["Abgeholt", "Retiré", "Ritirato", "Recogido"],
    "A little more to order": ["Noch etwas mehr zum Bestellen", "Encore un peu pour commander", "Ancora un po’ per ordinare", "Un poco más para pedir"],
    "The minimum order is": ["Die Mindestbestellung beträgt", "La commande minimale est de", "L’ordine minimo è di", "El pedido mínimo es de"],
    "Change my quantities": ["Meine Mengen ändern", "Modifier mes quantités", "Modifica le mie quantità", "Cambiar mis cantidades"],
    /* header, footer, menu */
    "Flavors": ["Sorten", "Saveurs", "Gusti", "Sabores"],
    "Story": ["Geschichte", "Histoire", "Storia", "Historia"],
    "Pros": ["Profis", "Pros", "Pro", "Profesionales"],
    "Ambassadors": ["Botschafter", "Ambassadeurs", "Ambasciatori", "Embajadores"],
    "Contact": ["Kontakt", "Contact", "Contatti", "Contacto"],
    "Shop": ["Shop", "Boutique", "Shop", "Tienda"],
    "Shop now": ["Jetzt kaufen", "Acheter", "Acquista", "Comprar"],
    "Shop now →": ["Jetzt kaufen →", "Acheter →", "Acquista →", "Comprar →"],
    "Cart": ["Warenkorb", "Panier", "Carrello", "Carrito"],
    "Menu": ["Menü", "Menu", "Menu", "Menú"],
    "Log in": ["Anmelden", "Se connecter", "Accedi", "Iniciar sesión"],
    "My account": ["Mein Konto", "Mon compte", "Il mio account", "Mi cuenta"],
    "My prices": ["Meine Preise", "Mes prix", "I miei prezzi", "Mis precios"],
    "My space": ["Mein Bereich", "Mon espace", "Il mio spazio", "Mi espacio"],
    "Newsletter": ["Newsletter", "Newsletter", "Newsletter", "Boletín"],
    "Join": ["Abonnieren", "S’inscrire", "Iscriviti", "Suscribirme"],
    "You're on the list.": ["Du bist auf der Liste.", "Vous êtes sur la liste.", "Sei nella lista.", "Ya estás en la lista."],
    "© 2026 Malaconda. All rights reserved.": ["© 2026 Malaconda. Alle Rechte vorbehalten.", "© 2026 Malaconda. Tous droits réservés.", "© 2026 Malaconda. Tutti i diritti riservati.", "© 2026 Malaconda. Todos los derechos reservados."],
    "Instagram ↗": ["Instagram ↗", "Instagram ↗", "Instagram ↗", "Instagram ↗"],
    "Language": ["Sprache", "Langue", "Lingua", "Idioma"],
    "Malaconda home": ["Malaconda Startseite", "Accueil Malaconda", "Home Malaconda", "Inicio Malaconda"],
    "Main": ["Hauptmenü", "Principal", "Principale", "Principal"],
    "Footer": ["Fusszeile", "Pied de page", "Piè di pagina", "Pie de página"],
    "Switch to day mode": ["Zum Tagmodus wechseln", "Passer au mode jour", "Passa alla modalità giorno", "Cambiar al modo día"],
    "Switch to night mode": ["Zum Nachtmodus wechseln", "Passer au mode nuit", "Passa alla modalità notte", "Cambiar al modo noche"],
    "Switch day or night mode": ["Tag- oder Nachtmodus wechseln", "Changer de mode jour ou nuit", "Cambia modalità giorno o notte", "Cambiar modo día o noche"],
    "Night mode": ["Nachtmodus", "Mode nuit", "Modalità notte", "Modo noche"],

    /* cart drawer */
    "Your cart": ["Dein Warenkorb", "Votre panier", "Il tuo carrello", "Tu carrito"],
    "Close cart": ["Warenkorb schliessen", "Fermer le panier", "Chiudi il carrello", "Cerrar el carrito"],
    "Your cart is empty.": ["Dein Warenkorb ist leer.", "Votre panier est vide.", "Il tuo carrello è vuoto.", "Tu carrito está vacío."],
    "Your cart is empty": ["Dein Warenkorb ist leer", "Votre panier est vide", "Il tuo carrello è vuoto", "Tu carrito está vacío"],
    "Pick a flavour": ["Sorte wählen", "Choisir une saveur", "Scegli un gusto", "Elige un sabor"],
    "View cart": ["Warenkorb ansehen", "Voir le panier", "Vedi il carrello", "Ver el carrito"],
    "Checkout": ["Zur Kasse", "Commander", "Cassa", "Pagar"],
    "Create an account": ["Konto erstellen", "Créer un compte", "Crea un account", "Crear una cuenta"],

    /* home */
    "The fruit": ["Die Frucht, die", "Le fruit que", "Il frutto che", "La fruta que"],
    "nobody": ["niemand", "personne", "nessuno", "nadie"],
    "was meant to": ["anfassen", "ne devait", "doveva", "debía"],
    "touch": ["sollte", "toucher", "toccare", "tocar"],
    "Every bottle carries more than soda": ["Jede Flasche enthält mehr als Soda", "Chaque bouteille contient plus qu’un soda", "Ogni bottiglia contiene più di una soda", "Cada botella lleva más que un refresco"],
    "Bottles on ice": ["Flaschen auf Eis", "Bouteilles sur glace", "Bottiglie sul ghiaccio", "Botellas sobre hielo"],
    "Malaconda bottles on ice": ["Malaconda-Flaschen auf Eis", "Bouteilles Malaconda sur glace", "Bottiglie Malaconda sul ghiaccio", "Botellas Malaconda sobre hielo"],
    "Pick your poison": ["Wähle dein Gift", "Choisissez votre poison", "Scegli il tuo veleno", "Elige tu veneno"],
    "Flavours, swipe or use the arrow keys": ["Sorten: wischen oder Pfeiltasten benutzen", "Saveurs, faites glisser ou utilisez les flèches", "Gusti, scorri o usa le frecce", "Sabores, desliza o usa las flechas"],
    "Flavour": ["Sorte", "Saveur", "Gusto", "Sabor"],
    "Biting Lulo bottle": ["Flasche Biting Lulo", "Bouteille Biting Lulo", "Bottiglia Biting Lulo", "Botella Biting Lulo"],
    "Sweet Guava bottle": ["Flasche Sweet Guava", "Bouteille Sweet Guava", "Bottiglia Sweet Guava", "Botella Sweet Guava"],
    "Citrus": ["Zitrus", "Agrumes", "Agrumi", "Cítrico"],
    "Floral": ["Blumig", "Floral", "Floreale", "Floral"],
    "Green": ["Grün", "Vert", "Verde", "Verde"],
    "Dry": ["Trocken", "Sec", "Secco", "Seco"],
    "Ripe": ["Reif", "Mûr", "Maturo", "Maduro"],
    "Soft": ["Weich", "Doux", "Morbido", "Suave"],
    "Cloud-forest citrus with a temper.": ["Nebelwald-Zitrus mit Temperament.", "Agrume de forêt de nuages, avec du caractère.", "Agrume della foresta di nebbia, con carattere.", "Cítrico del bosque de niebla, con carácter."],
    "Soft, floral, pink all the way through.": ["Weich, blumig, durch und durch rosa.", "Doux, floral, rose jusqu’au bout.", "Morbida, floreale, rosa fino in fondo.", "Suave, floral, rosa de principio a fin."],
    "Add to cart": ["In den Warenkorb", "Ajouter au panier", "Aggiungi al carrello", "Añadir al carrito"],
    "Fewer boxes": ["Weniger Kartons", "Moins de caisses", "Meno cartoni", "Menos cajas"],
    "Boxes": ["Kartons", "Caisses", "Cartoni", "Cajas"],
    "More boxes": ["Mehr Kartons", "Plus de caisses", "Più cartoni", "Más cajas"],
    "Ingredients": ["Zutaten", "Ingrédients", "Ingredienti", "Ingredientes"],
    "Natural ingredients": ["Natürliche Zutaten", "Ingrédients naturels", "Ingredienti naturali", "Ingredientes naturales"],
    "Clean hydration": ["Reine Erfrischung", "Hydratation pure", "Idratazione pulita", "Hidratación limpia"],
    "Maximum carbonation": ["Maximale Kohlensäure", "Pétillance maximale", "Massima effervescenza", "Máximas burbujas"],
    "Developed by Switzerland’s Barkeeper of the Year": ["Entwickelt vom Schweizer Barkeeper des Jahres", "Imaginé par le Barkeeper de l’année en Suisse", "Creata dal Barkeeper dell’anno svizzero", "Creado por el Barkeeper del año de Suiza"],
    "Why Malaconda": ["Warum Malaconda", "Pourquoi Malaconda", "Perché Malaconda", "Por qué Malaconda"],
    "She doesn't chase": ["Sie jagt nicht,", "Elle ne chasse pas,", "Lei non insegue,", "Ella no persigue,"],
    "She": ["sie", "elle", "lei", "ella"],
    "waits": ["wartet", "attend", "aspetta", "espera"],
    "Mala": ["Mala", "Mala", "Mala", "Mala"],
    "means bad in Spanish.": ["heisst auf Spanisch schlecht.", "veut dire mauvais en espagnol.", "significa cattiva in spagnolo.", "significa «mala» en español."],
    "Conda": ["Conda", "Conda", "Conda", "Conda"],
    "is the snake. Three friends from Medellín gave that name to a drink that tastes like the opposite.": ["ist die Schlange. Drei Freunde aus Medellín gaben diesen Namen einem Getränk, das nach dem Gegenteil schmeckt.", "est le serpent. Trois amis de Medellín ont donné ce nom à une boisson qui a le goût du contraire.", "è il serpente. Tre amici di Medellín hanno dato questo nome a una bevanda che sa di tutto il contrario.", "es la serpiente. Tres amigos de Medellín le dieron ese nombre a una bebida que sabe a lo contrario."],
    "Lulo grows where a snake keeps watch. Guava is the bait. The flavours were developed by the Swiss Barkeeper of the Year, and the bubbles do the rest.": ["Lulo wächst dort, wo eine Schlange wacht. Guave ist der Köder. Die Aromen stammen vom Schweizer Barkeeper des Jahres, den Rest erledigen die Bläschen.", "Le lulo pousse là où veille un serpent. La goyave est l’appât. Les saveurs ont été imaginées par le Barkeeper de l’année en Suisse, et les bulles font le reste.", "Il lulo cresce dove veglia un serpente. La guava è l’esca. I gusti sono stati creati dal Barkeeper dell’anno svizzero, al resto pensano le bollicine.", "El lulo crece donde vigila una serpiente. La guayaba es el cebo. Los sabores los creó el Barkeeper del año de Suiza, y las burbujas hacen el resto."],
    "Malaconda coasters in yellow, coral and black": ["Malaconda-Untersetzer in Gelb, Koralle und Schwarz", "Sous-verres Malaconda en jaune, corail et noir", "Sottobicchieri Malaconda in giallo, corallo e nero", "Posavasos Malaconda en amarillo, coral y negro"],
    "Biting Lulo bottles racked up on a pool table": ["Biting-Lulo-Flaschen aufgereiht auf einem Billardtisch", "Bouteilles Biting Lulo alignées sur un billard", "Bottiglie Biting Lulo allineate su un tavolo da biliardo", "Botellas Biting Lulo alineadas sobre una mesa de billar"],
    "Bring the snake to your business": ["Hol die Schlange in dein Geschäft", "Faites entrer le serpent dans votre établissement", "Porta il serpente nel tuo locale", "Lleva la serpiente a tu negocio"],
    "Pro access →": ["Zugang für Profis →", "Accès pros →", "Accesso pro →", "Acceso profesionales →"],
    "Pro login": ["Profi-Login", "Connexion pros", "Login pro", "Acceso profesionales"],
    "Not everyone gets bitten": ["Nicht jeder wird gebissen", "Tout le monde n’est pas mordu", "Non tutti vengono morsi", "No a todos los muerde"],
    "Become an ambassador →": ["Botschafter werden →", "Devenir ambassadeur →", "Diventa ambasciatore →", "Hazte embajador →"],
    "Talk to the snake": ["Sprich mit der Schlange", "Parlez au serpent", "Parla con il serpente", "Habla con la serpiente"],
    "Topic": ["Thema", "Sujet", "Argomento", "Asunto"],
    "General": ["Allgemein", "Général", "Generale", "General"],
    "Order": ["Bestellung", "Commande", "Ordine", "Pedido"],
    "Partner": ["Partnerschaft", "Partenariat", "Partnership", "Alianza"],
    "Press": ["Presse", "Presse", "Stampa", "Prensa"],
    "Name": ["Name", "Nom", "Nome", "Nombre"],
    "Email": ["E-Mail", "E-mail", "E-mail", "Correo electrónico"],
    "Message": ["Nachricht", "Message", "Messaggio", "Mensaje"],
    "Send message →": ["Nachricht senden →", "Envoyer le message →", "Invia il messaggio →", "Enviar mensaje →"],
    "Instagram": ["Instagram", "Instagram", "Instagram", "Instagram"],

    /* cart and checkout */
    "Payment": ["Zahlung", "Paiement", "Pagamento", "Pago"],
    "Checkout steps": ["Schritte zur Kasse", "Étapes de la commande", "Passaggi del checkout", "Pasos del pago"],
    "Keep shopping": ["Weiter einkaufen", "Continuer mes achats", "Continua gli acquisti", "Seguir comprando"],
    "Your order": ["Deine Bestellung", "Votre commande", "Il tuo ordine", "Tu pedido"],
    "Checkout →": ["Zur Kasse →", "Commander →", "Vai alla cassa →", "Ir a pagar →"],
    "Total (VAT incl.)": ["Total (inkl. MwSt.)", "Total (TVA incluse)", "Totale (IVA incl.)", "Total (IVA incl.)"],
    "Edit cart": ["Warenkorb ändern", "Modifier le panier", "Modifica il carrello", "Editar el carrito"],
    "Checkout": ["Zur Kasse", "Commander", "Cassa", "Pagar"],
    "Contact": ["Kontakt", "Contact", "Contatti", "Contacto"],
    "Delivery": ["Lieferung", "Livraison", "Consegna", "Entrega"],
    "Guest": ["Gast", "Invité", "Ospite", "Invitado"],
    "Add a box before paying.": ["Füge vor der Zahlung einen Karton hinzu.", "Ajoutez une caisse avant de payer.", "Aggiungi un cartone prima di pagare.", "Añade una caja antes de pagar."],
    "We send your order confirmation here. No account needed.": ["Hierhin senden wir deine Bestellbestätigung. Kein Konto nötig.", "Nous envoyons votre confirmation de commande ici. Aucun compte nécessaire.", "Qui ti inviamo la conferma dell’ordine. Nessun account necessario.", "Aquí te enviamos la confirmación del pedido. No hace falta cuenta."],
    "Create my account": ["Mein Konto erstellen", "Créer mon compte", "Crea il mio account", "Crear mi cuenta"],
    "Password": ["Passwort", "Mot de passe", "Password", "Contraseña"],
    "Street and number": ["Strasse und Nummer", "Rue et numéro", "Via e numero", "Calle y número"],
    "Postcode": ["Postleitzahl", "Code postal", "CAP", "Código postal"],
    "City": ["Ort", "Ville", "Città", "Ciudad"],
    "Phone (for the carrier)": ["Telefon (für den Zusteller)", "Téléphone (pour le transporteur)", "Telefono (per il corriere)", "Teléfono (para el transportista)"],
    "Secure card payment by Stripe.": ["Sichere Kartenzahlung über Stripe.", "Paiement sécurisé par carte avec Stripe.", "Pagamento sicuro con carta tramite Stripe.", "Pago seguro con tarjeta a través de Stripe."],
    "Test mode": ["Testmodus", "Mode test", "Modalità test", "Modo de prueba"],
    "Card number": ["Kartennummer", "Numéro de carte", "Numero della carta", "Número de tarjeta"],
    "Expiry": ["Ablaufdatum", "Expiration", "Scadenza", "Caducidad"],
    "MM / YY": ["MM / JJ", "MM / AA", "MM / AA", "MM / AA"],
    "CVC": ["CVC", "CVC", "CVC", "CVC"],
    "Prototype: no real payment. Any test card works, for example 4242 4242 4242 4242.": ["Prototyp: keine echte Zahlung. Jede Testkarte funktioniert, zum Beispiel 4242 4242 4242 4242.", "Prototype : aucun paiement réel. Toute carte de test convient, par exemple 4242 4242 4242 4242.", "Prototipo: nessun pagamento reale. Va bene qualsiasi carta di test, ad esempio 4242 4242 4242 4242.", "Prototipo: sin pago real. Sirve cualquier tarjeta de prueba, por ejemplo 4242 4242 4242 4242."],
    /* payment step (Stripe Payment Element) */
    "Free": ["Kostenlos", "Offerte", "Gratuita", "Gratis"],
    "Total": ["Total", "Total", "Totale", "Total"],
    "Paid": ["Bezahlt", "Payée", "Pagato", "Pagado"],
    "Try again": ["Erneut versuchen", "Réessayer", "Riprova", "Reintentar"],
    "Full name": ["Vollständiger Name", "Nom complet", "Nome completo", "Nombre completo"],
    "Address": ["Adresse", "Adresse", "Indirizzo", "Dirección"],
    "Processing…": ["Wird verarbeitet…", "Traitement en cours…", "Elaborazione in corso…", "Procesando…"],
    "Loading the secure payment form…": ["Das sichere Zahlungsformular wird geladen…", "Chargement du formulaire de paiement sécurisé…", "Caricamento del modulo di pagamento sicuro…", "Cargando el formulario de pago seguro…"],
    "Card, Apple Pay, Google Pay or TWINT. Payments are handled by Stripe: your card details never touch our server.": ["Karte, Apple Pay, Google Pay oder TWINT. Die Zahlung läuft über Stripe: Deine Kartendaten erreichen nie unseren Server.", "Carte, Apple Pay, Google Pay ou TWINT. Le paiement est géré par Stripe : vos données de carte ne passent jamais par notre serveur.", "Carta, Apple Pay, Google Pay o TWINT. Il pagamento è gestito da Stripe: i dati della tua carta non passano mai dal nostro server.", "Tarjeta, Apple Pay, Google Pay o TWINT. El pago lo gestiona Stripe: los datos de tu tarjeta nunca pasan por nuestro servidor."],
    "Almost there.": ["Fast geschafft.", "Presque fini.", "Quasi fatto.", "Casi listo."],
    "Your payment is being confirmed. We email you as soon as it goes through.": ["Deine Zahlung wird bestätigt. Wir schreiben dir, sobald sie durch ist.", "Votre paiement est en cours de confirmation. Nous vous écrivons dès qu’il est passé.", "Il tuo pagamento è in conferma. Ti scriviamo non appena va a buon fine.", "Tu pago se está confirmando. Te escribimos en cuanto se complete."],
    "Payment not completed.": ["Zahlung nicht abgeschlossen.", "Paiement non abouti.", "Pagamento non completato.", "Pago no completado."],
    "Nothing was charged. Your cart is still here.": ["Es wurde nichts abgebucht. Dein Warenkorb ist noch da.", "Rien n’a été débité. Votre panier est toujours là.", "Non è stato addebitato nulla. Il tuo carrello è ancora qui.", "No se ha cobrado nada. Tu carrito sigue aquí."],
    "Checking your payment…": ["Zahlung wird geprüft…", "Vérification du paiement…", "Verifica del pagamento…", "Comprobando el pago…"],
    "Continue": ["Weiter", "Continuer", "Continua", "Continuar"],
    "Confirm your password": ["Passwort bestätigen", "Confirmez votre mot de passe", "Conferma la tua password", "Confirma tu contraseña"],
    "To pay with your pro prices, confirm your password.": ["Bestätige dein Passwort, um mit deinen Profi-Preisen zu bezahlen.", "Pour payer avec vos prix pro, confirmez votre mot de passe.", "Per pagare con i tuoi prezzi pro, conferma la tua password.", "Para pagar con tus precios pro, confirma tu contraseña."],
    "Nothing was charged. Your selection is still here.": ["Es wurde nichts abgebucht. Deine Auswahl ist noch da.", "Rien n’a été débité. Votre sélection est toujours là.", "Non è stato addebitato nulla. La tua selezione è ancora qui.", "No se ha cobrado nada. Tu selección sigue aquí."],
    /* pro, ambassador and customer spaces, statement */
    "Pro space": ["Profi-Bereich", "Espace pro", "Area pro", "Espacio profesional"],
    "Ambassador space": ["Botschafter-Bereich", "Espace ambassadeur", "Area ambasciatore", "Espacio de embajador"],
    "Your prices, your orders and your recommendations.": ["Deine Preise, deine Bestellungen und deine Empfehlungen.", "Vos prix, vos commandes et vos recommandations.", "I tuoi prezzi, i tuoi ordini e le tue raccomandazioni.", "Tus precios, tus pedidos y tus recomendaciones."],
    "Your code, your venues and your statements.": ["Dein Code, deine Lokale und deine Abrechnungen.", "Votre code, vos établissements et vos relevés.", "Il tuo codice, i tuoi locali e i tuoi estratti.", "Tu código, tus locales y tus extractos."],
    "My orders": ["Meine Bestellungen", "Mes commandes", "I miei ordini", "Mis pedidos"],
    "Recommend a pro": ["Einen Profi empfehlen", "Recommander un pro", "Consiglia un pro", "Recomendar un profesional"],
    "Account": ["Konto", "Compte", "Account", "Cuenta"],
    "Venues": ["Lokale", "Établissements", "Locali", "Locales"],
    "Statements": ["Abrechnungen", "Relevés", "Estratti", "Extractos"],
    "Code and link": ["Code und Link", "Code et lien", "Codice e link", "Código y enlace"],
    "These prices also show on the website while you are logged in, with a live total for any quantity.": ["Diese Preise siehst du auch auf der Website, solange du angemeldet bist, mit Live-Gesamtbetrag für jede Menge.", "Ces prix s’affichent aussi sur le site tant que vous êtes connecté, avec un total en direct pour toute quantité.", "Questi prezzi compaiono anche sul sito finché sei connesso, con il totale in tempo reale per qualsiasi quantità.", "Estos precios también se muestran en la web mientras estás conectado, con el total al instante para cualquier cantidad."],
    "per bottle": ["pro Flasche", "par bouteille", "a bottiglia", "por botella"],
    "Negotiated price": ["Verhandelter Preis", "Prix négocié", "Prezzo negoziato", "Precio negociado"],
    "Volume pricing, per order (all flavours together)": ["Mengenpreise pro Bestellung (alle Sorten zusammen)", "Tarifs dégressifs par commande (toutes saveurs confondues)", "Prezzi a volume per ordine (tutti i gusti insieme)", "Precios por volumen, por pedido (todos los sabores juntos)"],
    "Boxes in the order": ["Kartons in der Bestellung", "Caisses dans la commande", "Cartoni nell’ordine", "Cajas en el pedido"],
    "Discount": ["Rabatt", "Remise", "Sconto", "Descuento"],
    "Volume tiers do not apply to your account.": ["Für dein Konto gelten keine Mengenrabatte.", "Les tarifs dégressifs ne s’appliquent pas à votre compte.", "Gli sconti a volume non si applicano al tuo account.", "Los descuentos por volumen no se aplican a tu cuenta."],
    "On your next order": ["Auf deine nächste Bestellung", "Sur votre prochaine commande", "Sul tuo prossimo ordine", "En tu próximo pedido"],
    "Your first confirmed order is": ["Deine erste bestätigte Bestellung kostet", "Votre première commande confirmée est à", "Il tuo primo ordine confermato è a", "Tu primer pedido confirmado tiene"],
    "(welcome offer).": ["(Willkommensangebot).", "(offre de bienvenue).", "(offerta di benvenuto).", "(oferta de bienvenida)."],
    "No welcome offer or credit is pending.": ["Kein Willkommensangebot und kein Guthaben ausstehend.", "Aucune offre de bienvenue ni aucun crédit en attente.", "Nessuna offerta di benvenuto o credito in sospeso.", "No hay oferta de bienvenida ni crédito pendiente."],
    "Your negotiated prices replace the welcome offer and the referral credit.": ["Deine verhandelten Preise ersetzen das Willkommensangebot und das Empfehlungsguthaben.", "Vos prix négociés remplacent l’offre de bienvenue et le crédit de recommandation.", "I tuoi prezzi negoziati sostituiscono l’offerta di benvenuto e il credito di raccomandazione.", "Tus precios negociados sustituyen la oferta de bienvenida y el crédito de recomendación."],
    "See my prices on the site →": ["Meine Preise auf der Website ansehen →", "Voir mes prix sur le site →", "Vedi i miei prezzi sul sito →", "Ver mis precios en la web →"],
    "See my prices →": ["Meine Preise ansehen →", "Voir mes prix →", "Vedi i miei prezzi →", "Ver mis precios →"],
    "Total excl. VAT": ["Total ohne MwSt.", "Total hors TVA", "Totale IVA esclusa", "Total sin IVA"],
    "Requested, waiting for confirmation": ["Angefragt, wartet auf Bestätigung", "Demandée, en attente de confirmation", "Richiesto, in attesa di conferma", "Solicitado, pendiente de confirmación"],
    "Tracking number to come": ["Sendungsnummer folgt", "Numéro de suivi à venir", "Numero di tracciamento in arrivo", "Número de seguimiento próximamente"],
    "waiting for payment": ["wartet auf Zahlung", "en attente de paiement", "in attesa di pagamento", "pendiente de pago"],
    "Placed": ["Eingegangen", "Reçue", "Ricevuto", "Recibido"],
    "Invoice sent": ["Rechnung gesendet", "Facture envoyée", "Fattura inviata", "Factura enviada"],
    "Shipped": ["Versendet", "Expédiée", "Spedito", "Enviado"],
    "Delivered": ["Geliefert", "Livrée", "Consegnato", "Entregado"],
    "Cancelled": ["Storniert", "Annulée", "Annullato", "Cancelado"],
    "In person visit": ["Besuch vor Ort", "Visite en personne", "Visita di persona", "Visita en persona"],
    "Website request": ["Anfrage über die Website", "Demande via le site", "Richiesta dal sito", "Solicitud desde la web"],
    "Website": ["Website", "Site web", "Sito web", "Sitio web"],
    "Other": ["Andere", "Autre", "Altro", "Otro"],
    "Cash": ["Bar", "Espèces", "Contanti", "Efectivo"],
    "Bank transfer": ["Banküberweisung", "Virement bancaire", "Bonifico bancario", "Transferencia bancaria"],
    "Card in person": ["Karte vor Ort", "Carte en personne", "Carta di persona", "Tarjeta en persona"],
    "Card (online)": ["Karte (online)", "Carte (en ligne)", "Carta (online)", "Tarjeta (en línea)"],
    "Swiss Post": ["Die Post", "La Poste Suisse", "Posta Svizzera", "Correos de Suiza"],
    "Own delivery": ["Eigene Lieferung", "Livraison propre", "Consegna propria", "Entrega propia"],
    "Your code": ["Dein Code", "Votre code", "Il tuo codice", "Tu código"],
    "Your link": ["Dein Link", "Votre lien", "Il tuo link", "Tu enlace"],
    "Copy link": ["Link kopieren", "Copier le lien", "Copia il link", "Copiar enlace"],
    "Earned": ["Verdient", "Gagné", "Guadagnato", "Ganado"],
    "Used": ["Verwendet", "Utilisé", "Utilizzato", "Usado"],
    "Available": ["Verfügbar", "Disponible", "Disponibile", "Disponible"],
    "Recommended": ["Empfohlen", "Recommandé", "Consigliato", "Recomendado"],
    "Credit earned": ["Guthaben verdient", "Crédit gagné", "Credito guadagnato", "Crédito ganado"],
    "Waiting for first order": ["Wartet auf erste Bestellung", "En attente de la première commande", "In attesa del primo ordine", "A la espera del primer pedido"],
    "No recommendations yet.": ["Noch keine Empfehlungen.", "Aucune recommandation pour l’instant.", "Nessuna raccomandazione per ora.", "Aún no hay recomendaciones."],
    "Link copied.": ["Link kopiert.", "Lien copié.", "Link copiato.", "Enlace copiado."],
    "Copy the link above.": ["Kopiere den Link oben.", "Copiez le lien ci-dessus.", "Copia il link qui sopra.", "Copia el enlace de arriba."],
    "Login": ["Login", "Identifiant", "Accesso", "Acceso"],
    "Company details": ["Firmendaten", "Informations de l’entreprise", "Dati dell’azienda", "Datos de la empresa"],
    "Delivery street and number": ["Lieferadresse (Strasse und Nummer)", "Adresse de livraison (rue et numéro)", "Indirizzo di consegna (via e numero)", "Dirección de entrega (calle y número)"],
    "Billing address (if different)": ["Rechnungsadresse (falls abweichend)", "Adresse de facturation (si différente)", "Indirizzo di fatturazione (se diverso)", "Dirección de facturación (si es distinta)"],
    "VAT number": ["MwSt.-Nummer", "Numéro de TVA", "Partita IVA", "Número de IVA"],
    "Commission earned": ["Verdiente Provision", "Commission gagnée", "Commissione maturata", "Comisión generada"],
    "Paid out": ["Ausgezahlt", "Versée", "Pagata", "Pagada"],
    "To be paid": ["Zu zahlen", "À verser", "Da pagare", "Por pagar"],
    "Commission until": ["Provision bis", "Commission jusqu’au", "Commissione fino al", "Comisión hasta"],
    "Commissionable revenue": ["Provisionspflichtiger Umsatz", "Chiffre d’affaires commissionnable", "Fatturato soggetto a commissione", "Ingresos comisionables"],
    "Commission": ["Provision", "Commission", "Commissione", "Comisión"],
    "Active": ["Aktiv", "Actif", "Attivo", "Activo"],
    "Account created": ["Konto erstellt", "Compte créé", "Account creato", "Cuenta creada"],
    "Commission period ended": ["Provisionszeitraum beendet", "Période de commission terminée", "Periodo di commissione terminato", "Periodo de comisión terminado"],
    "No venues yet.": ["Noch keine Lokale.", "Aucun établissement pour l’instant.", "Nessun locale per ora.", "Aún no hay locales."],
    "By month": ["Nach Monat", "Par mois", "Per mese", "Por mes"],
    "Download statement (PDF)": ["Abrechnung herunterladen (PDF)", "Télécharger le relevé (PDF)", "Scarica l’estratto (PDF)", "Descargar el extracto (PDF)"],
    "Open": ["Öffnen", "Ouvrir", "Apri", "Abrir"],
    "No commission yet.": ["Noch keine Provision.", "Aucune commission pour l’instant.", "Nessuna commissione per ora.", "Aún no hay comisión."],
    "Introduce a venue": ["Ein Lokal vorstellen", "Présenter un établissement", "Presenta un locale", "Presentar un local"],
    "When a venue asks for pro access, it enters your code or uses your link. Your name can also be given by the venue or by the founders.": ["Wenn ein Lokal Profi-Zugang anfragt, gibt es deinen Code ein oder nutzt deinen Link. Dein Name kann auch vom Lokal oder von den Gründern angegeben werden.", "Lorsqu’un établissement demande un accès pro, il saisit votre code ou utilise votre lien. Votre nom peut aussi être indiqué par l’établissement ou par les fondateurs.", "Quando un locale richiede l’accesso pro, inserisce il tuo codice o usa il tuo link. Il tuo nome può essere indicato anche dal locale o dai fondatori.", "Cuando un local solicita acceso profesional, introduce tu código o usa tu enlace. Tu nombre también puede indicarlo el local o los fundadores."],
    "Code": ["Code", "Code", "Codice", "Código"],
    "IBAN for payouts": ["IBAN für Auszahlungen", "IBAN pour les versements", "IBAN per i pagamenti", "IBAN para los pagos"],
    "Commission statement": ["Provisionsabrechnung", "Relevé de commission", "Estratto commissioni", "Extracto de comisiones"],
    "← Back": ["← Zurück", "← Retour", "← Indietro", "← Volver"],
    "Download CSV": ["CSV herunterladen", "Télécharger le CSV", "Scarica il CSV", "Descargar CSV"],
    "Print or save as PDF": ["Drucken oder als PDF speichern", "Imprimer ou enregistrer en PDF", "Stampa o salva come PDF", "Imprimir o guardar como PDF"],
    "Period": ["Zeitraum", "Période", "Periodo", "Periodo"],
    "Issued": ["Ausgestellt", "Émis le", "Emesso il", "Emitido el"],
    "Ambassador": ["Botschafter", "Ambassadeur", "Ambasciatore", "Embajador"],
    "Paid to": ["Ausgezahlt an", "Versé à", "Pagato a", "Pagado a"],
    "IBAN missing": ["IBAN fehlt", "IBAN manquant", "IBAN mancante", "Falta el IBAN"],
    "Rate": ["Satz", "Taux", "Aliquota", "Tasa"],
    "adjustment: paid order cancelled": ["Korrektur: bezahlte Bestellung storniert", "ajustement : commande payée annulée", "rettifica: ordine pagato annullato", "ajuste: pedido pagado cancelado"],
    "This statement is not available.": ["Diese Abrechnung ist nicht verfügbar.", "Ce relevé n’est pas disponible.", "Questo estratto non è disponibile.", "Este extracto no está disponible."],
    "Prices": ["Preise", "Prix", "Prezzi", "Precios"],
    "Pay and order": ["Bezahlen und bestellen", "Payer et commander", "Paga e ordina", "Pagar y pedir"],
    "Prefer an invoice or to talk first?": ["Lieber eine Rechnung oder erst sprechen?", "Vous préférez une facture ou en parler d’abord ?", "Preferisci una fattura o parlarne prima?", "¿Prefieres una factura o hablar primero?"],
    "Message us": ["Schreib uns", "Écrivez-nous", "Scrivici", "Escríbenos"],
    "Total to pay": ["Zu zahlender Betrag", "Total à payer", "Totale da pagare", "Total a pagar"],
    "Change quantities": ["Mengen ändern", "Modifier les quantités", "Modifica le quantità", "Cambiar las cantidades"],
    "Referral credit": ["Empfehlungsguthaben", "Crédit de recommandation", "Credito di raccomandazione", "Crédito de recomendación"],
    "Pro payment": ["Zahlung (Profi)", "Paiement pro", "Pagamento pro", "Pago profesional"],
    "Log in to pay with your prices.": ["Melde dich an, um mit deinen Preisen zu bezahlen.", "Connectez-vous pour payer avec vos prix.", "Accedi per pagare con i tuoi prezzi.", "Inicia sesión para pagar con tus precios."],
    "Fill in the delivery address.": ["Gib die Lieferadresse ein.", "Renseignez l’adresse de livraison.", "Inserisci l’indirizzo di consegna.", "Introduce la dirección de entrega."],
    "Date": ["Datum", "Date", "Data", "Fecha"],
    "Your confirmation goes to": ["Deine Bestätigung geht an", "Votre confirmation est envoyée à", "La tua conferma viene inviata a", "Tu confirmación se envía a"],
    ". Delivery within 4 weeks.": [". Lieferung innerhalb von 4 Wochen.", ". Livraison sous 4 semaines.", ". Consegna entro 4 settimane.", ". Entrega en 4 semanas."],
    "The invoice goes to": ["Die Rechnung geht an", "La facture est envoyée à", "La fattura viene inviata a", "La factura se envía a"],
    "Enter a valid email.": ["Gib eine gültige E-Mail-Adresse ein.", "Saisissez une adresse e-mail valide.", "Inserisci un indirizzo e-mail valido.", "Introduce un correo electrónico válido."],
    "Password: at least 8 characters.": ["Passwort: mindestens 8 Zeichen.", "Mot de passe : au moins 8 caractères.", "Password: almeno 8 caratteri.", "Contraseña: al menos 8 caracteres."],
    "An account with this email already exists.": ["Mit dieser E-Mail-Adresse existiert bereits ein Konto.", "Un compte existe déjà avec cet e-mail.", "Esiste già un account con questo indirizzo e-mail.", "Ya existe una cuenta con este correo electrónico."],
    "Enter your name and a valid email.": ["Gib deinen Namen und eine gültige E-Mail-Adresse ein.", "Saisissez votre nom et une adresse e-mail valide.", "Inserisci il tuo nome e un indirizzo e-mail valido.", "Introduce tu nombre y un correo electrónico válido."],
    "Choose at least one box.": ["Wähle mindestens einen Karton.", "Choisissez au moins une caisse.", "Scegli almeno un cartone.", "Elige al menos una caja."],
    "Log in with your pro account.": ["Melde dich mit deinem Profi-Konto an.", "Connectez-vous avec votre compte pro.", "Accedi con il tuo account pro.", "Inicia sesión con tu cuenta profesional."],
    "Too many attempts. Try again later.": ["Zu viele Versuche. Bitte versuche es später erneut.", "Trop de tentatives. Réessayez plus tard.", "Troppi tentativi. Riprova più tardi.", "Demasiados intentos. Inténtalo de nuevo más tarde."],
    "Something went wrong.": ["Etwas ist schiefgelaufen.", "Une erreur est survenue.", "Qualcosa è andato storto.", "Algo salió mal."],
    "Payments are not configured yet.": ["Zahlungen sind noch nicht eingerichtet.", "Les paiements ne sont pas encore configurés.", "I pagamenti non sono ancora configurati.", "Los pagos aún no están configurados."],
    "The payment form could not be loaded. Check your connection.": ["Das Zahlungsformular konnte nicht geladen werden. Prüfe deine Verbindung.", "Le formulaire de paiement n’a pas pu être chargé. Vérifiez votre connexion.", "Non è stato possibile caricare il modulo di pagamento. Controlla la connessione.", "No se pudo cargar el formulario de pago. Revisa tu conexión."],
    "Thank you.": ["Danke.", "Merci.", "Grazie.", "Gracias."],
    "Track my order": ["Meine Bestellung verfolgen", "Suivre ma commande", "Segui il mio ordine", "Seguir mi pedido"],
    "Back to the site": ["Zurück zur Website", "Retour au site", "Torna al sito", "Volver al sitio"],
    "Create an account to follow your order.": ["Erstelle ein Konto, um deine Bestellung zu verfolgen.", "Créez un compte pour suivre votre commande.", "Crea un account per seguire il tuo ordine.", "Crea una cuenta para seguir tu pedido."],
    "Wrong email or password.": ["E-Mail oder Passwort falsch.", "E-mail ou mot de passe incorrect.", "E-mail o password errati.", "Correo o contraseña incorrectos."],
    "Enter your email in the contact block, or log in.": ["Gib deine E-Mail im Kontaktbereich ein oder melde dich an.", "Saisissez votre e-mail dans le bloc contact, ou connectez-vous.", "Inserisci la tua e-mail nel blocco contatti, oppure accedi.", "Introduce tu correo en el bloque de contacto, o inicia sesión."],
    "Fill in your name and delivery address.": ["Gib deinen Namen und deine Lieferadresse an.", "Renseignez votre nom et votre adresse de livraison.", "Inserisci il tuo nome e l’indirizzo di consegna.", "Indica tu nombre y tu dirección de entrega."],
    "Check your card details.": ["Prüfe deine Kartendaten.", "Vérifiez les données de votre carte.", "Controlla i dati della carta.", "Revisa los datos de tu tarjeta."],
    "demo accounts": ["Demo-Konten", "comptes de démo", "account demo", "cuentas de demostración"],
    "Prototype: see": ["Prototyp: siehe", "Prototype : voir les", "Prototipo: vedi gli", "Prototipo: mira las"],

    /* for pros */
    "Behind the bar.": ["Hinter der Bar.", "Derrière le bar.", "Dietro il bancone.", "Detrás de la barra."],
    "The best bars, restaurants, clubs, hotels and distributors serve Malaconda to their clients.": ["Die besten Bars, Restaurants, Clubs, Hotels und Händler servieren Malaconda ihren Gästen.", "Les meilleurs bars, restaurants, clubs, hôtels et distributeurs servent Malaconda à leurs clients.", "I migliori bar, ristoranti, club, hotel e distributori servono Malaconda ai loro clienti.", "Los mejores bares, restaurantes, clubes, hoteles y distribuidores sirven Malaconda a sus clientes."],
    "Request access ↓": ["Zugang anfragen ↓", "Demander l’accès ↓", "Richiedi l’accesso ↓", "Solicitar acceso ↓"],
    "Already a pro? Log in": ["Schon Profi? Anmelden", "Déjà pro ? Connectez-vous", "Sei già un pro? Accedi", "¿Ya eres profesional? Inicia sesión"],
    "Wholesale prices": ["Grosshandelspreise", "Prix de gros", "Prezzi all’ingrosso", "Precios al por mayor"],
    "Volume pricing": ["Mengenpreise", "Prix dégressifs", "Prezzi a volume", "Precios por volumen"],
    "The more you buy, the cheaper it gets.": ["Je mehr du kaufst, desto günstiger wird es.", "Plus vous achetez, moins c’est cher.", "Più compri, meno paghi.", "Cuanto más compras, más barato sale."],
    "Serve it to your clients.": ["Serviere es deinen Gästen.", "Servez-le à vos clients.", "Servila ai tuoi clienti.", "Sírvela a tus clientes."],
    "Wholesale prices appear when you log in. Until then, a box of 12 × 20 cl is": ["Die Grosshandelspreise erscheinen nach der Anmeldung. Bis dahin kostet ein Karton mit 12 × 20 cl", "Les prix de gros s’affichent une fois connecté. D’ici là, une caisse de 12 × 20 cl coûte", "I prezzi all’ingrosso compaiono dopo l’accesso. Fino ad allora, un cartone da 12 × 20 cl costa", "Los precios al por mayor aparecen al iniciar sesión. Hasta entonces, una caja de 12 × 20 cl cuesta"],
    "Delivery within 4 weeks.": ["Lieferung innerhalb von 4 Wochen.", "Livraison sous 4 semaines.", "Consegna entro 4 settimane.", "Entrega en 4 semanas."],
    "Business": ["Betrieb", "Établissement", "Attività", "Negocio"],
    "Type": ["Art", "Type", "Tipo", "Tipo"],
    "Bar": ["Bar", "Bar", "Bar", "Bar"],
    "Restaurant": ["Restaurant", "Restaurant", "Ristorante", "Restaurante"],
    "Club": ["Club", "Club", "Club", "Club"],
    "Hotel": ["Hotel", "Hôtel", "Hotel", "Hotel"],
    "Distributor": ["Händler", "Distributeur", "Distributore", "Distribuidor"],
    "Contact name": ["Ansprechperson", "Nom du contact", "Nome del referente", "Nombre de contacto"],
    "Phone": ["Telefon", "Téléphone", "Telefono", "Teléfono"],
    "Recommended by (code or name)": ["Empfohlen von (Code oder Name)", "Recommandé par (code ou nom)", "Consigliato da (codice o nome)", "Recomendado por (código o nombre)"],
    "Optional": ["Optional", "Facultatif", "Facoltativo", "Opcional"],
    "Anything we should know": ["Was wir wissen sollten", "Ce qu’il faut savoir", "Cosa dobbiamo sapere", "Algo que debamos saber"],
    "Request access →": ["Zugang anfragen →", "Demander l’accès →", "Richiedi l’accesso →", "Solicitar acceso →"],

    /* ambassadors */
    "Become an ambassador ↓": ["Botschafter werden ↓", "Devenir ambassadeur ↓", "Diventa ambasciatore ↓", "Hazte embajador ↓"],
    "Already one? Log in": ["Schon dabei? Anmelden", "Déjà ambassadeur ? Connectez-vous", "Lo sei già? Accedi", "¿Ya lo eres? Inicia sesión"],
    "Your own code": ["Dein eigener Code", "Votre propre code", "Il tuo codice", "Tu propio código"],
    "Share your link or code. Venues that name you are yours.": ["Teile deinen Link oder Code. Betriebe, die dich nennen, gehören dir.", "Partagez votre lien ou votre code. Les établissements qui vous citent sont les vôtres.", "Condividi il tuo link o codice. I locali che ti citano sono tuoi.", "Comparte tu enlace o código. Los locales que te nombren son tuyos."],
    "Paid on every order": ["Bezahlt bei jeder Bestellung", "Payé à chaque commande", "Pagato a ogni ordine", "Pagado en cada pedido"],
    "Monthly statements": ["Monatsabrechnungen", "Relevés mensuels", "Estratti mensili", "Extractos mensuales"],
    "See each venue and each payout in your own space.": ["Sieh jeden Betrieb und jede Auszahlung in deinem Bereich.", "Consultez chaque établissement et chaque versement dans votre espace.", "Vedi ogni locale e ogni pagamento nel tuo spazio.", "Consulta cada local y cada pago en tu espacio."],
    "Know the right venues?": ["Kennst du die richtigen Betriebe?", "Vous connaissez les bons établissements ?", "Conosci i locali giusti?", "¿Conoces los locales adecuados?"],
    "Tell us who you are and which venues you know.": ["Sag uns, wer du bist und welche Betriebe du kennst.", "Dites-nous qui vous êtes et quels établissements vous connaissez.", "Dicci chi sei e quali locali conosci.", "Cuéntanos quién eres y qué locales conoces."],
    "Instagram / TikTok": ["Instagram / TikTok", "Instagram / TikTok", "Instagram / TikTok", "Instagram / TikTok"],
    "Your network": ["Dein Netzwerk", "Votre réseau", "La tua rete", "Tu red"],
    "Venues you know, your role in the scene": ["Betriebe, die du kennst, deine Rolle in der Szene", "Les établissements que vous connaissez, votre rôle dans la scène", "I locali che conosci, il tuo ruolo nella scena", "Los locales que conoces, tu papel en la escena"],
    "Apply →": ["Bewerben →", "Postuler →", "Candidati →", "Postular →"],

    /* login, account, pro checkout */
    "Pro login": ["Profi-Login", "Connexion pros", "Login pro", "Acceso profesionales"],
    "Ambassador login": ["Botschafter-Login", "Connexion ambassadeurs", "Login ambasciatori", "Acceso embajadores"],
    "Create account": ["Konto erstellen", "Créer un compte", "Crea account", "Crear cuenta"],
    "Create your account": ["Erstelle dein Konto", "Créez votre compte", "Crea il tuo account", "Crea tu cuenta"],
    "Already registered?": ["Schon registriert?", "Déjà inscrit ?", "Già registrato?", "¿Ya estás registrado?"],
    "New here?": ["Neu hier?", "Nouveau ici ?", "Nuovo qui?", "¿Eres nuevo?"],
    "Venue or ambassador?": ["Betrieb oder Botschafter?", "Établissement ou ambassadeur ?", "Locale o ambasciatore?", "¿Local o embajador?"],
    "My account": ["Mein Konto", "Mon compte", "Il mio account", "Mi cuenta"],
    "Your orders and delivery details.": ["Deine Bestellungen und Lieferangaben.", "Vos commandes et vos informations de livraison.", "I tuoi ordini e i dati di consegna.", "Tus pedidos y datos de entrega."],
    "Orders": ["Bestellungen", "Commandes", "Ordini", "Pedidos"],
    "Details": ["Angaben", "Informations", "Dati", "Datos"],
    "Date": ["Datum", "Date", "Data", "Fecha"],
    "Items": ["Artikel", "Articles", "Articoli", "Artículos"],
    "Total incl. VAT": ["Total inkl. MwSt.", "Total (TVA incluse)", "Totale (IVA incl.)", "Total (IVA incl.)"],
    "Parcel": ["Paket", "Colis", "Pacco", "Paquete"],
    "Status": ["Status", "Statut", "Stato", "Estado"],
    "Not shipped yet": ["Noch nicht versendet", "Pas encore expédié", "Non ancora spedito", "Aún no enviado"],
    "Track parcel": ["Paket verfolgen", "Suivre le colis", "Segui il pacco", "Seguir el paquete"],
    "No tracking number": ["Keine Sendungsnummer", "Pas de numéro de suivi", "Nessun numero di tracciamento", "Sin número de seguimiento"],
    "No orders yet.": ["Noch keine Bestellungen.", "Aucune commande pour l’instant.", "Ancora nessun ordine.", "Todavía no hay pedidos."],
    "Order again →": ["Nochmals bestellen →", "Commander à nouveau →", "Ordina di nuovo →", "Pedir de nuevo →"],
    "Delivery details": ["Lieferangaben", "Informations de livraison", "Dati di consegna", "Datos de entrega"],
    "Save details": ["Angaben speichern", "Enregistrer", "Salva i dati", "Guardar datos"],
    "Details saved.": ["Angaben gespeichert.", "Informations enregistrées.", "Dati salvati.", "Datos guardados."],
    "Change password": ["Passwort ändern", "Changer le mot de passe", "Cambia password", "Cambiar contraseña"],
    "Current password": ["Aktuelles Passwort", "Mot de passe actuel", "Password attuale", "Contraseña actual"],
    "New password": ["Neues Passwort", "Nouveau mot de passe", "Nuova password", "Nueva contraseña"],
    "Choose your password": ["Wähle dein Passwort", "Choisissez votre mot de passe", "Scegli la tua password", "Elige tu contraseña"],
    "Repeat": ["Wiederholen", "Répéter", "Ripeti", "Repetir"],
    "At least 8 characters.": ["Mindestens 8 Zeichen.", "Au moins 8 caractères.", "Almeno 8 caratteri.", "Al menos 8 caracteres."],
    "Save password": ["Passwort speichern", "Enregistrer le mot de passe", "Salva la password", "Guardar contraseña"],
    "Update password": ["Passwort aktualisieren", "Mettre à jour le mot de passe", "Aggiorna la password", "Actualizar contraseña"],
    "Password updated.": ["Passwort aktualisiert.", "Mot de passe mis à jour.", "Password aggiornata.", "Contraseña actualizada."],
    "Passwords do not match.": ["Die Passwörter stimmen nicht überein.", "Les mots de passe ne correspondent pas.", "Le password non coincidono.", "Las contraseñas no coinciden."],
    "Current password is wrong.": ["Das aktuelle Passwort ist falsch.", "Le mot de passe actuel est incorrect.", "La password attuale è errata.", "La contraseña actual es incorrecta."],
    "Choose a different password.": ["Wähle ein anderes Passwort.", "Choisissez un autre mot de passe.", "Scegli una password diversa.", "Elige una contraseña diferente."],
    "Your temporary password must be replaced before you continue.": ["Dein temporäres Passwort muss ersetzt werden, bevor du weitermachst.", "Votre mot de passe temporaire doit être remplacé avant de continuer.", "La tua password temporanea va sostituita prima di continuare.", "Debes cambiar tu contraseña temporal antes de continuar."],
    "Nothing to pay yet": ["Noch nichts zu bezahlen", "Rien à payer pour l’instant", "Ancora niente da pagare", "Aún nada que pagar"],
    "Choose your quantities on the site, with your own prices.": ["Wähle deine Mengen auf der Website, mit deinen eigenen Preisen.", "Choisissez vos quantités sur le site, avec vos propres prix.", "Scegli le quantità sul sito, con i tuoi prezzi.", "Elige tus cantidades en el sitio, con tus propios precios."],
    "See my prices": ["Meine Preise ansehen", "Voir mes prix", "Vedi i miei prezzi", "Ver mis precios"],
    "Pay your order": ["Bezahle deine Bestellung", "Payez votre commande", "Paga il tuo ordine", "Paga tu pedido"],
    "Venue": ["Betrieb", "Établissement", "Locale", "Local"]
  };

  // texts that carry a number or a name: [pattern, [de, fr, it, es]] ($1, $2 are filled in)
  var P = [
    [/^1 box = (\d+) bottles of 20 cl\. Minimum order (\d+) boxes\. Pay by card, delivery within 4 weeks\. Prefer an invoice or to talk first\?$/, ["1 Karton = $1 Flaschen à 20 cl. Mindestbestellung $2 Kartons. Zahlung per Karte, Lieferung innerhalb von 4 Wochen. Lieber eine Rechnung oder erst sprechen?", "1 caisse = $1 bouteilles de 20 cl. Commande minimale : $2 caisses. Paiement par carte, livraison sous 4 semaines. Vous préférez une facture ou en parler d’abord ?", "1 cartone = $1 bottiglie da 20 cl. Ordine minimo: $2 cartoni. Pagamento con carta, consegna entro 4 settimane. Preferisci una fattura o parlarne prima?", "1 caja = $1 botellas de 20 cl. Pedido mínimo: $2 cajas. Pago con tarjeta, entrega en 4 semanas. ¿Prefieres una factura o hablar primero?"]],
    [/^per bottle · (CHF [\d.,’']+) per box of (\d+) · excl\. VAT$/, ["pro Flasche · $1 pro Karton à $2 · ohne MwSt.", "par bouteille · $1 par caisse de $2 · hors TVA", "a bottiglia · $1 a cartone da $2 · IVA esclusa", "por botella · $1 por caja de $2 · sin IVA"]],
    [/^per box of (\d+) · excl\. VAT$/, ["pro Karton à $1 · ohne MwSt.", "par caisse de $1 · hors TVA", "a cartone da $1 · IVA esclusa", "por caja de $1 · sin IVA"]],
    [/^(\d+) bottles of 20 cl each, (CHF [\d.,’']+) per box$/, ["$1 Flaschen à 20 cl, $2 pro Karton", "$1 bouteilles de 20 cl, $2 par caisse", "$1 bottiglie da 20 cl, $2 a cartone", "$1 botellas de 20 cl, $2 por caja"]],
    [/^Minimum order: (\d+) boxes of (\d+) bottles\. All flavours count together\.$/, ["Mindestbestellung: $1 Kartons zu $2 Flaschen. Alle Sorten zählen zusammen.", "Commande minimale : $1 caisses de $2 bouteilles. Toutes les saveurs comptent ensemble.", "Ordine minimo: $1 cartoni da $2 bottiglie. Tutti i gusti contano insieme.", "Pedido mínimo: $1 cajas de $2 botellas. Todos los sabores cuentan juntos."]],
    [/^Choose quantities to see your total\. Minimum order: (\d+) boxes\. Prices exclude VAT\.$/, ["Wähle Mengen, um dein Total zu sehen. Mindestbestellung: $1 Kartons. Preise ohne MwSt.", "Choisissez vos quantités pour voir votre total. Commande minimale : $1 caisses. Prix hors TVA.", "Scegli le quantità per vedere il totale. Ordine minimo: $1 cartoni. Prezzi IVA esclusa.", "Elige las cantidades para ver tu total. Pedido mínimo: $1 cajas. Precios sin IVA."]],
    [/^of (\d+) bottles, all flavours together\. You have (\d+)\.$/, ["zu $1 Flaschen, alle Sorten zusammen. Du hast $2.", "de $1 bouteilles, toutes saveurs confondues. Vous en avez $2.", "da $1 bottiglie, tutti i gusti insieme. Ne hai $2.", "de $1 botellas, todos los sabores juntos. Tienes $2."]],
    [/^Delivery · (CHF [\d.,’']+)$/, ["Lieferung · $1", "Livraison · $1", "Consegna · $1", "Entrega · $1"]],
    [/^incl\. delivery (CHF [\d.,’']+)$/, ["inkl. Lieferung $1", "livraison incluse $1", "consegna inclusa $1", "entrega incluida $1"]],
    [/^(1) box$/, ["$1 Karton", "$1 caisse", "$1 cartone", "$1 caja"]],
    [/^(\d+) boxes$/, ["$1 Kartons", "$1 caisses", "$1 cartoni", "$1 cajas"]],
    [/^(1) box of 12$/, ["$1 Karton à 12", "$1 caisse de 12", "$1 cartone da 12", "$1 caja de 12"]],
    [/^(\d+) boxes of 12$/, ["$1 Kartons à 12", "$1 caisses de 12", "$1 cartoni da 12", "$1 cajas de 12"]],
    [/^(CHF [\d.,’']+) per box of 12$/, ["$1 pro Karton à 12", "$1 par caisse de 12", "$1 per cartone da 12", "$1 por caja de 12"]],
    [/^(CHF [\d.,’']+) per box$/, ["$1 pro Karton", "$1 par caisse", "$1 per cartone", "$1 por caja"]],
    [/^(1) box × (CHF [\d.,’']+)$/, ["$1 Karton × $2", "$1 caisse × $2", "$1 cartone × $2", "$1 caja × $2"]],
    [/^(\d+) boxes × (CHF [\d.,’']+)$/, ["$1 Kartons × $2", "$1 caisses × $2", "$1 cartoni × $2", "$1 cajas × $2"]],
    [/^First order −(\d+%)$/, ["Erste Bestellung −$1", "Première commande −$1", "Primo ordine −$1", "Primer pedido −$1"]],
    [/^first order −(\d+%)$/, ["erste Bestellung −$1", "première commande −$1", "primo ordine −$1", "primer pedido −$1"]],
    [/^(\d+%) off your first order is applied\.$/, ["$1 Rabatt auf deine erste Bestellung ist angewendet.", "$1 de remise sur votre première commande est appliquée.", "Lo sconto del $1 sul tuo primo ordine è applicato.", "El $1 de descuento en tu primer pedido está aplicado."]],
    [/^Create an account and get (\d+%) on your first order\.$/, ["Erstelle ein Konto und erhalte $1 Rabatt auf deine erste Bestellung.", "Créez un compte et obtenez $1 de remise sur votre première commande.", "Crea un account e ottieni il $1 di sconto sul tuo primo ordine.", "Crea una cuenta y obtén un $1 de descuento en tu primer pedido."]],
    [/^Your first order is (\d+%) off\.$/, ["Deine erste Bestellung kostet $1 weniger.", "Votre première commande est à −$1.", "Il tuo primo ordine ha il $1 di sconto.", "Tu primer pedido tiene un $1 de descuento."]],
    [/^Fewer (.+)$/, ["Weniger $1", "Moins de $1", "Meno $1", "Menos $1"]],
    [/^More (.+)$/, ["Mehr $1", "Plus de $1", "Più $1", "Más $1"]],
    [/^Boxes of (.+)$/, ["Kartons mit $1", "Caisses de $1", "Cartoni di $1", "Cajas de $1"]],
    [/^Pay (CHF [\d.,’']+)$/, ["$1 bezahlen", "Payer $1", "Paga $1", "Pagar $1"]],
    [/^VAT (\d+(?:\.\d+)?%) included$/, ["inkl. $1 MwSt.", "TVA $1 incluse", "IVA $1 inclusa", "IVA $1 incluido"]],
    [/^Order ([MP]-\w+)$/, ["Bestellung $1", "Commande $1", "Ordine $1", "Pedido $1"]],
    [new RegExp("^" + DATE + "$"), function (m, l) { return fmtDate(m, l, 1); }],
    [new RegExp("^paid " + DATE + "$"), function (m, l) { return ["bezahlt am ", "payé le ", "pagato il ", "pagado el "][IDX[l]] + fmtDate(m, l, 1); }],
    [new RegExp("^Paid out on " + DATE + "$"), function (m, l) { return ["Ausgezahlt am ", "Versé le ", "Pagato il ", "Pagado el "][IDX[l]] + fmtDate(m, l, 1); }],
    [new RegExp("^commission until " + DATE + "$"), function (m, l) { return ["Provision bis ", "commission jusqu’au ", "commissione fino al ", "comisión hasta "][IDX[l]] + fmtDate(m, l, 1); }],
    [new RegExp("^" + MNAME + "$"), function (m, l) { return fmtMonth(m[1], l); }],
    [new RegExp("^" + MNAME + " (\\d{4})$"), function (m, l) { return fmtMonth(m[1], l, m[2]); }],
    [new RegExp("^No commission in " + MNAME + " (\\d{4})\\.$"), function (m, l) { return ["Keine Provision im ", "Aucune commission en ", "Nessuna commissione a ", "Sin comisión en "][IDX[l]] + fmtMonth(m[1], l, m[2]) + "."; }],
    [/^Pro space · (.+)$/, ["Profi-Bereich · $1", "Espace pro · $1", "Area pro · $1", "Espacio profesional · $1"]],
    [/^Ambassador space · (.+)$/, ["Botschafter-Bereich · $1", "Espace ambassadeur · $1", "Area ambasciatore · $1", "Espacio de embajador · $1"]],
    [/^My account · (.+)$/, ["Mein Konto · $1", "Mon compte · $1", "Il mio account · $1", "Mi cuenta · $1"]],
    [/^(.+) per box$/, ["$1 pro Karton", "$1 par caisse", "$1 a cartone", "$1 por caja"]],
    [/^(\d+(?:-\d+|\+)) boxes$/, ["$1 Kartons", "$1 caisses", "$1 cartoni", "$1 cajas"]],
    [/^Below the (\d+)-box threshold$/, ["Unter der Schwelle von $1 Kartons", "Sous le seuil de $1 caisses", "Sotto la soglia di $1 cartoni", "Por debajo del umbral de $1 cajas"]],
    [/^on your next order from your referral credit \((\d+%) available, (\d+%) maximum per order\)\.$/, ["auf deine nächste Bestellung aus deinem Empfehlungsguthaben ($1 verfügbar, maximal $2 pro Bestellung).", "sur votre prochaine commande grâce à votre crédit de recommandation ($1 disponibles, $2 maximum par commande).", "sul tuo prossimo ordine grazie al tuo credito di raccomandazione ($1 disponibile, massimo $2 per ordine).", "en tu próximo pedido gracias a tu crédito de recomendación ($1 disponible, máximo $2 por pedido)."]],
    [/^Recommend another bar, restaurant, club, hotel or shop\. They get −(\d+%) on their first order\. You get −(\d+%) on a next order once their first order reaches (\d+) boxes\. Credits add up, up to −(\d+%) per order\.$/, ["Empfiehl eine andere Bar, ein Restaurant, einen Club, ein Hotel oder einen Shop. Sie erhalten −$1 auf ihre erste Bestellung. Du erhältst −$2 auf eine nächste Bestellung, sobald ihre erste Bestellung $3 Kartons erreicht. Guthaben summieren sich, bis zu −$4 pro Bestellung.", "Recommandez un autre bar, restaurant, club, hôtel ou commerce. Il obtient −$1 sur sa première commande. Vous obtenez −$2 sur une prochaine commande dès que sa première commande atteint $3 caisses. Les crédits se cumulent, jusqu’à −$4 par commande.", "Consiglia un altro bar, ristorante, club, hotel o negozio. Ottiene −$1 sul primo ordine. Tu ottieni −$2 su un prossimo ordine quando il suo primo ordine raggiunge $3 cartoni. I crediti si sommano, fino a −$4 per ordine.", "Recomienda otro bar, restaurante, club, hotel o tienda. Obtiene −$1 en su primer pedido. Tú obtienes −$2 en un próximo pedido cuando su primer pedido alcance $3 cajas. Los créditos se acumulan, hasta −$4 por pedido."]],
    [/^Commission: (\d+(?:\.\d+)?%) of net invoiced revenue excl\. VAT, for (\d+) months from each venue['’]s first paid order\.$/, ["Provision: $1 des fakturierten Nettoumsatzes ohne MwSt., für $2 Monate ab der ersten bezahlten Bestellung jedes Lokals.", "Commission : $1 du chiffre d’affaires net facturé hors TVA, pendant $2 mois à compter de la première commande payée de chaque établissement.", "Commissione: $1 dei ricavi netti fatturati, IVA esclusa, per $2 mesi dal primo ordine pagato di ogni locale.", "Comisión: $1 de los ingresos netos facturados sin IVA, durante $2 meses desde el primer pedido pagado de cada local."]],
    [/^Amounts in CHF, excluding VAT\. Commission is (\d+(?:\.\d+)?)% of the net invoiced amount of paid orders, for (\d+) months from each venue['’]s first paid order\. (Paid|To be paid) by bank transfer to the IBAN above\.$/, function (m, l) {
      var paid = m[3] === "Paid", i = IDX[l];
      return [
        "Beträge in CHF, ohne MwSt. Die Provision beträgt " + m[1] + " % des fakturierten Nettobetrags bezahlter Bestellungen, für " + m[2] + " Monate ab der ersten bezahlten Bestellung jedes Lokals. " + (paid ? "Per Banküberweisung auf die oben genannte IBAN bezahlt." : "Wird per Banküberweisung auf die oben genannte IBAN bezahlt."),
        "Montants en CHF, hors TVA. La commission est de " + m[1] + " % du montant net facturé des commandes payées, pendant " + m[2] + " mois à compter de la première commande payée de chaque établissement. " + (paid ? "Versée par virement bancaire sur l’IBAN ci-dessus." : "À verser par virement bancaire sur l’IBAN ci-dessus."),
        "Importi in CHF, IVA esclusa. La commissione è il " + m[1] + " % dell’importo netto fatturato degli ordini pagati, per " + m[2] + " mesi dal primo ordine pagato di ogni locale. " + (paid ? "Pagata tramite bonifico bancario all’IBAN sopra indicato." : "Da pagare tramite bonifico bancario all’IBAN sopra indicato."),
        "Importes en CHF, sin IVA. La comisión es el " + m[1] + " % del importe neto facturado de los pedidos pagados, durante " + m[2] + " meses desde el primer pedido pagado de cada local. " + (paid ? "Pagada por transferencia bancaria al IBAN indicado arriba." : "Se pagará por transferencia bancaria al IBAN indicado arriba.")
      ][i];
    }],
    [/^VAT (\d+(?:\.\d+)?%)$/, ["MwSt. $1", "TVA $1", "IVA $1", "IVA $1"]],
    [/^Volume (−\d+%)$/, ["Mengenrabatt $1", "Remise de volume $1", "Sconto sul volume $1", "Descuento por volumen $1"]],
    [/^Welcome (−\d+%)$/, ["Willkommensrabatt $1", "Bienvenue $1", "Benvenuto $1", "Bienvenida $1"]],
    [/^Referral credit (−\d+%)$/, ["Empfehlungsguthaben $1", "Crédit de recommandation $1", "Credito di raccomandazione $1", "Crédito de recomendación $1"]],
    [/^(\d+) boxes? of (Biting Lulo|Sweet Guava)$/, function (m, l) { var n = +m[1], w = { de: n === 1 ? "Karton" : "Kartons", fr: n === 1 ? "caisse de" : "caisses de", it: n === 1 ? "cartone di" : "cartoni di", es: n === 1 ? "caja de" : "cajas de" }[l]; return m[1] + " " + w + " " + m[2]; }],
    [/^Hello (.+)\.$/, ["Hallo $1.", "Bonjour $1.", "Ciao $1.", "Hola $1."]],
    [/^Signed in as$/, ["Angemeldet als", "Connecté en tant que", "Connesso come", "Sesión iniciada como"]],
    [/^Your order, (.+)$/, ["Deine Bestellung, $1", "Votre commande, $1", "Il tuo ordine, $1", "Tu pedido, $1"]],
    [/^(.+) - MALACONDA$/, ["$1 - MALACONDA", "$1 - MALACONDA", "$1 - MALACONDA", "$1 - MALACONDA"], false, true]
  ];
  var TITLE = {
    "MALACONDA - Sparkling soda from the Amazon": ["MALACONDA - Sparkling Soda aus dem Amazonas", "MALACONDA - Soda pétillant de l’Amazonie", "MALACONDA - Soda frizzante dell’Amazzonia", "MALACONDA - Refresco con gas del Amazonas"],
    "Payment - MALACONDA": ["Zahlung - MALACONDA", "Paiement - MALACONDA", "Pagamento - MALACONDA", "Pago - MALACONDA"],
    "Pro space - MALACONDA": ["Profi-Bereich - MALACONDA", "Espace pro - MALACONDA", "Area pro - MALACONDA", "Espacio profesional - MALACONDA"],
    "Ambassador space — MALACONDA": ["Botschafter-Bereich — MALACONDA", "Espace ambassadeur — MALACONDA", "Area ambasciatore — MALACONDA", "Espacio de embajador — MALACONDA"],
    "Commission statement - MALACONDA": ["Provisionsabrechnung - MALACONDA", "Relevé de commission - MALACONDA", "Estratto commissioni - MALACONDA", "Extracto de comisiones - MALACONDA"],
    "Pro payment - MALACONDA": ["Zahlung (Profi) - MALACONDA", "Paiement pro - MALACONDA", "Pagamento pro - MALACONDA", "Pago profesional - MALACONDA"],
    "Cart - MALACONDA": ["Warenkorb - MALACONDA", "Panier - MALACONDA", "Carrello - MALACONDA", "Carrito - MALACONDA"]
  };

  var lang = "en", ATTRS = ["alt", "placeholder", "aria-label", "title"];
  var orig = new WeakMap(), origA = new WeakMap(), busy = false;

  function pick(arr, l) { return arr[IDX[l]]; }
  function tr(text, l) {
    var key = text.replace(/\s+/g, " ").trim();
    if (!key) return null;
    if (D[key]) return pick(D[key], l);
    for (var i = 0; i < P.length; i++) { var m = key.match(P[i][0]); if (m && !P[i][3]) { var r = P[i][1]; return typeof r === "function" ? r(m, l) : pick(r, l).replace(/\$(\d)/g, function (_, n) { return m[n]; }); } }
    return null;
  }
  function textNode(n, l) {
    var p = n.parentNode; if (!p || /^(SCRIPT|STYLE|TEXTAREA)$/.test(p.nodeName)) return;
    var rec = orig.get(n), cur = n.nodeValue;
    // when the page rewrote the text itself, the new value is the new English
    var en = rec && cur === rec.tr ? rec.en : cur;
    if (l === "en") { if (n.nodeValue !== en) n.nodeValue = en; orig.set(n, { en: en, tr: en }); return; }
    var t = tr(en, l);
    if (t == null) { orig.set(n, { en: en, tr: en }); if (n.nodeValue !== en) n.nodeValue = en; return; }
    var lead = (en.match(/^\s*/) || [""])[0], trail = (en.match(/\s*$/) || [""])[0];
    var out = lead + t + trail;
    if (n.nodeValue !== out) n.nodeValue = out;   // writing the same text again would re-trigger the observer forever
    orig.set(n, { en: en, tr: out });
  }
  function attrs(el, l) {
    ATTRS.forEach(function (a) {
      if (!el.hasAttribute || !el.hasAttribute(a)) return;
      var rec = origA.get(el) || {}, cur = el.getAttribute(a), r = rec[a];
      var en = r && cur === r.tr ? r.en : cur;
      var t = l === "en" ? en : tr(en, l);
      var out = t == null ? en : t;
      if (cur !== out) el.setAttribute(a, out);
      rec[a] = { en: en, tr: out }; origA.set(el, rec);
    });
  }
  function walk(root, l) {
    if (root.nodeType === 3) return textNode(root, l);
    if (root.nodeType !== 1) return;
    if (/^(SCRIPT|STYLE)$/.test(root.nodeName)) return;
    attrs(root, l);
    for (var c = root.firstChild; c; c = c.nextSibling) walk(c, l);
  }
  var titleEn = null;
  function head(l) {
    if (titleEn === null) titleEn = document.title;
    var t = l === "en" ? titleEn : (TITLE[titleEn] ? pick(TITLE[titleEn], l) : null);
    if (t == null && l !== "en") { var m = titleEn.match(/^(.+) - MALACONDA$/); if (m) { var inner = tr(m[1], l); if (inner) t = inner + " - MALACONDA"; } }
    document.title = t == null ? titleEn : t;
  }
  function apply(root) {
    busy = true;
    try { walk(root || document.body, lang); } finally { busy = false; }
  }

  function paintPicker() {
    document.querySelectorAll("[data-lang-val]").forEach(function (v) { v.textContent = lang.toUpperCase(); });
    document.querySelectorAll("[data-lang]").forEach(function (b) {
      b.setAttribute("aria-pressed", String(b.dataset.lang === lang));
      if (b.getAttribute("role") === "option") b.setAttribute("aria-selected", String(b.dataset.lang === lang));
    });
  }
  // keeps the reader where they are: texts change length, and what sits above the viewport must not push the page around
  function pageAnchor() {
    var el = document.elementFromPoint(Math.round(innerWidth / 2), Math.round(innerHeight * 0.35));
    return el && el !== document.body && el !== document.documentElement ? { el: el, top: el.getBoundingClientRect().top } : null;
  }
  function restoreAnchor(a) {
    if (!a || !a.el.isConnected) return;
    var d = a.el.getBoundingClientRect().top - a.top;
    if (Math.abs(d) < 1) return;
    var h = document.documentElement, was = h.style.scrollBehavior;
    h.style.scrollBehavior = "auto"; window.scrollBy(0, d); h.style.scrollBehavior = was;
  }
  function set(l, silent) {
    var anchor = silent ? null : pageAnchor();
    lang = LANGS.indexOf(l) > -1 ? l : "en";
    document.documentElement.lang = lang;
    try { if (!silent) localStorage.setItem(KEY, lang); } catch (e) {}
    head(lang); if (document.body) apply(document.body); paintPicker();
    restoreAnchor(anchor);
    document.dispatchEvent(new CustomEvent("langchange", { detail: lang }));
  }
  function initial() {
    if (OFF) return "en";
    var saved = null; try { saved = localStorage.getItem(KEY); } catch (e) {}
    var q = (location.search.match(/[?&]lang=(\w\w)/) || [])[1];
    var browser = (navigator.language || "").toLowerCase().slice(0, 2);
    return LANGS.indexOf(q) > -1 ? q : LANGS.indexOf(saved) > -1 ? saved : LANGS.indexOf(browser) > -1 ? browser : "en";
  }

  // the language menu in the header (same look as the topic menu of the contact form) and the row of buttons in the footer; common.js asks for them
  function selectHtml() {
    if (OFF) return "";
    return '<div class="dd dd--lang" data-lang-dd><button class="dd__btn" type="button" role="combobox" aria-haspopup="listbox" aria-expanded="false" aria-label="Language"><span class="dd__val" data-lang-val>' + lang.toUpperCase() + '</span><svg viewBox="0 0 16 16" aria-hidden="true"><path d="m3 6 5 5 5-5"/></svg></button>' +
      '<ul class="dd__list" role="listbox" aria-label="Language" hidden>' + LANGS.map(function (l) { return '<li role="option" data-lang="' + l + '" lang="' + l + '" aria-selected="' + (l === lang) + '">' + LABELS[l] + "</li>"; }).join("") + "</ul></div>";
  }
  function buttonsHtml() {
    if (OFF) return "";
    return '<div class="lang-row" role="group" aria-label="Language">' + LANGS.map(function (l) { return '<button type="button" class="lang-btn" data-lang="' + l + '" aria-pressed="false" lang="' + l + '" title="' + LABELS[l] + '">' + l.toUpperCase() + "</button>"; }).join("") + "</div>";
  }

  var langDd = function (n) { return n && n.closest ? n.closest("[data-lang-dd]") : null; };
  function ddMark(dd, n) {
    var o = dd.querySelectorAll("[role=option]"); n = Math.max(0, Math.min(o.length - 1, n)); dd._cur = n;
    o.forEach(function (x, j) { x.classList.toggle("is-cur", j === n); });
  }
  function ddOpen(dd) { dd.querySelector(".dd__list").hidden = false; dd.querySelector(".dd__btn").setAttribute("aria-expanded", "true"); dd.classList.add("is-open"); ddMark(dd, LANGS.indexOf(lang)); }
  function ddClose(dd) { dd.querySelector(".dd__list").hidden = true; dd.querySelector(".dd__btn").setAttribute("aria-expanded", "false"); dd.classList.remove("is-open"); }
  function ddCloseAll(except) { document.querySelectorAll("[data-lang-dd].is-open").forEach(function (d) { if (d !== except) ddClose(d); }); }
  document.addEventListener("click", function (e) {
    var dd = langDd(e.target), btn = e.target.closest && e.target.closest("[data-lang-dd] .dd__btn");
    if (btn && dd) { var open = dd.classList.contains("is-open"); ddCloseAll(); if (!open) ddOpen(dd); return; }
    if (dd && e.target.closest("[role=option]")) { ddClose(dd); dd.querySelector(".dd__btn").focus({ preventScroll: true }); return; }
    ddCloseAll(dd);
  });
  document.addEventListener("keydown", function (e) {
    var dd = langDd(e.target); if (!dd) return;
    var isOpen = dd.classList.contains("is-open");
    if (["ArrowDown", "ArrowUp", "Enter", " "].indexOf(e.key) > -1) {
      e.preventDefault();
      if (!isOpen) ddOpen(dd);
      else if (e.key === "ArrowDown") ddMark(dd, dd._cur + 1);
      else if (e.key === "ArrowUp") ddMark(dd, dd._cur - 1);
      else { var o = dd.querySelectorAll("[role=option]")[dd._cur]; ddClose(dd); if (o) set(o.dataset.lang); dd.querySelector(".dd__btn").focus({ preventScroll: true }); }
    } else if (e.key === "Escape" && isOpen) { e.preventDefault(); ddClose(dd); } else if (e.key === "Tab") ddClose(dd);
  });
  document.addEventListener("mouseover", function (e) { var o = e.target.closest && e.target.closest("[data-lang-dd] [role=option]"); if (o) ddMark(langDd(o), Array.prototype.indexOf.call(o.parentNode.children, o)); });

  document.addEventListener("click", function (e) { var b = e.target.closest && e.target.closest("[data-lang]"); if (b && b.dataset.lang) set(b.dataset.lang); });

  lang = initial();
  document.documentElement.lang = lang;
  function boot() {
    set(lang, true);
    // everything the pages draw later (cart, checkout, spaces) is translated as it appears
    new MutationObserver(function (list) {
      if (busy || lang === "en") return;
      busy = true;
      try { list.forEach(function (m) { if (m.type === "characterData") textNode(m.target, lang); else m.addedNodes.forEach(function (n) { walk(n, lang); }); }); } finally { busy = false; }
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();

  window.I18n = { get: function () { return lang; }, set: set, selectHtml: selectHtml, buttonsHtml: buttonsHtml, apply: apply, t: function (s) { return lang === "en" ? s : (tr(s, lang) || s); } };
})();
