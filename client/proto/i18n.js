/* MALACONDA PROTOTYPE - language selector (EN, DE, FR, IT, ES).
   English stays in the HTML and the scripts. This file swaps each exact English text (and attribute) for its translation,
   also for what the pages draw later, and remembers the choice on every page. Same storage key as the classic site. */
(function () {
  var LANGS = ["en", "de", "fr", "it", "es"], KEY = "malaconda-lang", IDX = { de: 0, fr: 1, it: 2, es: 3 };
  var LABELS = { en: "English", de: "Deutsch", fr: "Français", it: "Italiano", es: "Español" };

  // "English text": [de, fr, it, es]
  var D = {
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
    "A sparkling soda with bold flavours developed by Switzerland’s Bartender of the Year and a serious amount of fizz. Made to be enjoyed straight from the bottle or mixed into something unexpected. Go on, give in to temptation.": [
      "Eine Sparkling Soda mit kräftigen Aromen, entwickelt vom Schweizer Bartender des Jahres, und eine ordentliche Portion Kohlensäure. Pur aus der Flasche oder gemixt zu etwas Unerwartetem. Komm schon, gib der Versuchung nach.",
      "Un soda pétillant aux saveurs audacieuses, imaginé par le Bartender de l’année en Suisse, avec une sérieuse dose de bulles. À savourer au goulot ou mixé dans quelque chose d’inattendu. Allez, cédez à la tentation.",
      "Una soda frizzante dai gusti decisi, creata dal Bartender dell’anno svizzero, con una bella dose di bollicine. Da gustare dritta dalla bottiglia o mixata in qualcosa di inaspettato. Dai, cedi alla tentazione.",
      "Un refresco con gas de sabores atrevidos, creado por el Bartender del año de Suiza, con una buena dosis de burbujas. Para disfrutar directo de la botella o mezclado en algo inesperado. Vamos, cede a la tentación."],
    "Every bottle carries more than soda. It carries the bite of Malaconda. Brewed in Colombia, bound for the bold.": [
      "Jede Flasche enthält mehr als Soda. Sie trägt den Biss von Malaconda in sich. In Kolumbien gebraut, für die Mutigen bestimmt.",
      "Chaque bouteille contient plus qu’un soda. Elle porte la morsure de Malaconda. Brassée en Colombie, destinée aux audacieux.",
      "Ogni bottiglia contiene più di una soda. Porta il morso di Malaconda. Nata in Colombia, destinata agli audaci.",
      "Cada botella lleva más que un refresco. Lleva el mordisco de Malaconda. Hecha en Colombia, para los atrevidos."],
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
    "Crisp acidity strikes first, refreshes second.": ["Knackige Säure schlägt zuerst zu, erfrischt danach.", "L’acidité vive frappe d’abord, rafraîchit ensuite.", "L’acidità netta colpisce per prima, poi rinfresca.", "La acidez nítida ataca primero y refresca después."],
    "Soft, floral, pink all the way through.": ["Weich, blumig, durch und durch rosa.", "Doux, floral, rose jusqu’au bout.", "Morbida, floreale, rosa fino in fondo.", "Suave, floral, rosa de principio a fin."],
    "The sweet one you shouldn't trust.": ["Die Süsse, der du nicht trauen solltest.", "La douce à qui il ne faut pas se fier.", "La dolce di cui non fidarti.", "La dulce en la que no debes confiar."],
    "Add to cart": ["In den Warenkorb", "Ajouter au panier", "Aggiungi al carrello", "Añadir al carrito"],
    "1 box = 12 bottles of 20 cl. Delivery within 4 weeks.": ["1 Karton = 12 Flaschen à 20 cl. Lieferung innerhalb von 4 Wochen.", "1 caisse = 12 bouteilles de 20 cl. Livraison sous 4 semaines.", "1 cartone = 12 bottiglie da 20 cl. Consegna entro 4 settimane.", "1 caja = 12 botellas de 20 cl. Entrega en 4 semanas."],
    "Fewer boxes": ["Weniger Kartons", "Moins de caisses", "Meno cartoni", "Menos cajas"],
    "Boxes": ["Kartons", "Caisses", "Cartoni", "Cajas"],
    "More boxes": ["Mehr Kartons", "Plus de caisses", "Più cartoni", "Más cajas"],
    "Ingredients": ["Zutaten", "Ingrédients", "Ingredienti", "Ingredientes"],
    "Carbonated water, lulo juice (8%), cane sugar, citric acid, natural flavours, steviol glycosides.": ["Kohlensäurehaltiges Wasser, Lulo-Saft (8%), Rohrzucker, Zitronensäure, natürliche Aromen, Steviolglycoside.", "Eau gazéifiée, jus de lulo (8%), sucre de canne, acide citrique, arômes naturels, glycosides de stéviol.", "Acqua gassata, succo di lulo (8%), zucchero di canna, acido citrico, aromi naturali, glicosidi steviolici.", "Agua carbonatada, zumo de lulo (8%), azúcar de caña, ácido cítrico, aromas naturales, glucósidos de esteviol."],
    "Carbonated water, guava purée (8%), cane sugar, citric acid, natural flavours, steviol glycosides.": ["Kohlensäurehaltiges Wasser, Guavenpüree (8%), Rohrzucker, Zitronensäure, natürliche Aromen, Steviolglycoside.", "Eau gazéifiée, purée de goyave (8%), sucre de canne, acide citrique, arômes naturels, glycosides de stéviol.", "Acqua gassata, purea di guava (8%), zucchero di canna, acido citrico, aromi naturali, glicosidi steviolici.", "Agua carbonatada, puré de guayaba (8%), azúcar de caña, ácido cítrico, aromas naturales, glucósidos de esteviol."],
    "Natural ingredients": ["Natürliche Zutaten", "Ingrédients naturels", "Ingredienti naturali", "Ingredientes naturales"],
    "Clean hydration": ["Reine Erfrischung", "Hydratation pure", "Idratazione pulita", "Hidratación limpia"],
    "Maximum carbonation": ["Maximale Kohlensäure", "Pétillance maximale", "Massima effervescenza", "Máximas burbujas"],
    "Developed by Switzerland’s Bartender of the Year": ["Entwickelt vom Schweizer Bartender des Jahres", "Imaginé par le Bartender de l’année en Suisse", "Creata dal Bartender dell’anno svizzero", "Creado por el Bartender del año de Suiza"],
    "Why Malaconda": ["Warum Malaconda", "Pourquoi Malaconda", "Perché Malaconda", "Por qué Malaconda"],
    "She doesn't chase": ["Sie jagt nicht,", "Elle ne chasse pas,", "Lei non insegue,", "Ella no persigue,"],
    "She": ["sie", "elle", "lei", "ella"],
    "waits": ["wartet", "attend", "aspetta", "espera"],
    "Mala": ["Mala", "Mala", "Mala", "Mala"],
    "means bad in Spanish.": ["heisst auf Spanisch schlecht.", "veut dire mauvais en espagnol.", "significa cattiva in spagnolo.", "significa «mala» en español."],
    "Conda": ["Conda", "Conda", "Conda", "Conda"],
    "is the snake. Three friends from Medellín gave that name to a drink that tastes like the opposite.": ["ist die Schlange. Drei Freunde aus Medellín gaben diesen Namen einem Getränk, das nach dem Gegenteil schmeckt.", "est le serpent. Trois amis de Medellín ont donné ce nom à une boisson qui a le goût du contraire.", "è il serpente. Tre amici di Medellín hanno dato questo nome a una bevanda che sa di tutto il contrario.", "es la serpiente. Tres amigos de Medellín le dieron ese nombre a una bebida que sabe a lo contrario."],
    "Lulo grows where a snake keeps watch. Guava is the bait. The flavours were developed by the Swiss Bartender of the Year, and the bubbles do the rest.": ["Lulo wächst dort, wo eine Schlange wacht. Guave ist der Köder. Die Aromen stammen vom Schweizer Bartender des Jahres, den Rest erledigen die Bläschen.", "Le lulo pousse là où veille un serpent. La goyave est l’appât. Les saveurs ont été imaginées par le Bartender de l’année en Suisse, et les bulles font le reste.", "Il lulo cresce dove veglia un serpente. La guava è l’esca. I gusti sono stati creati dal Bartender dell’anno svizzero, al resto pensano le bollicine.", "El lulo crece donde vigila una serpiente. La guayaba es el cebo. Los sabores los creó el Bartender del año de Suiza, y las burbujas hacen el resto."],
    "Malaconda coasters in yellow, coral and black": ["Malaconda-Untersetzer in Gelb, Koralle und Schwarz", "Sous-verres Malaconda en jaune, corail et noir", "Sottobicchieri Malaconda in giallo, corallo e nero", "Posavasos Malaconda en amarillo, coral y negro"],
    "Biting Lulo bottles racked up on a pool table": ["Biting-Lulo-Flaschen aufgereiht auf einem Billardtisch", "Bouteilles Biting Lulo alignées sur un billard", "Bottiglie Biting Lulo allineate su un tavolo da biliardo", "Botellas Biting Lulo alineadas sobre una mesa de billar"],
    "Bring the snake to your business": ["Hol die Schlange in dein Geschäft", "Faites entrer le serpent dans votre établissement", "Porta il serpente nel tuo locale", "Lleva la serpiente a tu negocio"],
    "Give your customers something different.": ["Gib deinen Gästen etwas Anderes.", "Offrez à vos clients quelque chose de différent.", "Dai ai tuoi clienti qualcosa di diverso.", "Dale a tus clientes algo diferente."],
    "Bring MALACONDA into your business and let them discover their new favourite soda.": ["Bring MALACONDA in dein Geschäft und lass sie ihre neue Lieblings-Soda entdecken.", "Faites entrer MALACONDA dans votre établissement et laissez-les découvrir leur nouveau soda préféré.", "Porta MALACONDA nel tuo locale e lascia che scoprano la loro nuova soda preferita.", "Lleva MALACONDA a tu negocio y deja que descubran su nuevo refresco favorito."],
    "Pro access →": ["Zugang für Profis →", "Accès pros →", "Accesso pro →", "Acceso profesionales →"],
    "Pro login": ["Profi-Login", "Connexion pros", "Login pro", "Acceso profesionales"],
    "Not everyone gets bitten": ["Nicht jeder wird gebissen", "Tout le monde n’est pas mordu", "Non tutti vengono morsi", "No a todos los muerde"],
    "Good connections should pay off. Introduce MALACONDA to the right businesses and get rewarded when they order.": ["Gute Kontakte sollen sich lohnen. Stelle MALACONDA den richtigen Betrieben vor und werde belohnt, wenn sie bestellen.", "Les bonnes relations doivent être récompensées. Présentez MALACONDA aux bons établissements et soyez récompensé quand ils commandent.", "Le buone conoscenze devono ripagare. Presenta MALACONDA ai locali giusti e ricevi una ricompensa quando ordinano.", "Los buenos contactos deben dar frutos. Presenta MALACONDA a los negocios adecuados y recibe una recompensa cuando pidan."],
    "Become an ambassador →": ["Botschafter werden →", "Devenir ambassadeur →", "Diventa ambasciatore →", "Hazte embajador →"],
    "Talk to the snake": ["Sprich mit der Schlange", "Parlez au serpent", "Parla con il serpente", "Habla con la serpiente"],
    "Orders, partnerships, press or just a bite of curiosity.": ["Bestellungen, Partnerschaften, Presse oder einfach ein Biss Neugier.", "Commandes, partenariats, presse ou simple morsure de curiosité.", "Ordini, partnership, stampa o semplicemente un morso di curiosità.", "Pedidos, alianzas, prensa o simplemente un mordisco de curiosidad."],
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
    "1 box = 12 bottles of 20 cl. Mix both flavours freely. Delivery within 4 weeks.": ["1 Karton = 12 Flaschen à 20 cl. Beide Sorten frei mischbar. Lieferung innerhalb von 4 Wochen.", "1 caisse = 12 bouteilles de 20 cl. Mélangez librement les deux saveurs. Livraison sous 4 semaines.", "1 cartone = 12 bottiglie da 20 cl. Mescola liberamente i due gusti. Consegna entro 4 settimane.", "1 caja = 12 botellas de 20 cl. Mezcla libremente los dos sabores. Entrega en 4 semanas."],
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
    "One price list for every venue, from your first box.": ["Eine Preisliste für jeden Betrieb, ab dem ersten Karton.", "Une seule grille de prix pour chaque établissement, dès la première caisse.", "Un solo listino per ogni locale, dal primo cartone.", "Una sola lista de precios para cada local, desde la primera caja."],
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
    "Know the venues that should pour Malaconda? Introduce them and earn when they order.": ["Du kennst Betriebe, die Malaconda ausschenken sollten? Stelle sie vor und verdiene, wenn sie bestellen.", "Vous connaissez des établissements qui devraient servir Malaconda ? Présentez-les et gagnez quand ils commandent.", "Conosci i locali che dovrebbero servire Malaconda? Presentali e guadagna quando ordinano.", "¿Conoces locales que deberían servir Malaconda? Preséntalos y gana cuando pidan."],
    "Become an ambassador ↓": ["Botschafter werden ↓", "Devenir ambassadeur ↓", "Diventa ambasciatore ↓", "Hazte embajador ↓"],
    "Already one? Log in": ["Schon dabei? Anmelden", "Déjà ambassadeur ? Connectez-vous", "Lo sei già? Accedi", "¿Ya lo eres? Inicia sesión"],
    "Your own code": ["Dein eigener Code", "Votre propre code", "Il tuo codice", "Tu propio código"],
    "Share your link or code. Venues that name you are yours.": ["Teile deinen Link oder Code. Betriebe, die dich nennen, gehören dir.", "Partagez votre lien ou votre code. Les établissements qui vous citent sont les vôtres.", "Condividi il tuo link o codice. I locali che ti citano sono tuoi.", "Comparte tu enlace o código. Los locales que te nombren son tuyos."],
    "Paid on every order": ["Bezahlt bei jeder Bestellung", "Payé à chaque commande", "Pagato a ogni ordine", "Pagado en cada pedido"],
    "You earn on what the venues you introduce buy.": ["Du verdienst an dem, was die von dir vorgestellten Betriebe kaufen.", "Vous gagnez sur ce qu’achètent les établissements que vous présentez.", "Guadagni su ciò che acquistano i locali che presenti.", "Ganas con lo que compran los locales que presentas."],
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
    [/^Hello (.+)\.$/, ["Hallo $1.", "Bonjour $1.", "Ciao $1.", "Hola $1."]],
    [/^Signed in as$/, ["Angemeldet als", "Connecté en tant que", "Connesso come", "Sesión iniciada como"]],
    [/^Your order, (.+)$/, ["Deine Bestellung, $1", "Votre commande, $1", "Il tuo ordine, $1", "Tu pedido, $1"]],
    [/^(.+) - MALACONDA$/, ["$1 - MALACONDA", "$1 - MALACONDA", "$1 - MALACONDA", "$1 - MALACONDA"], false, true]
  ];
  var TITLE = {
    "MALACONDA - Sparkling soda from the Amazon": ["MALACONDA - Sparkling Soda aus dem Amazonas", "MALACONDA - Soda pétillant de l’Amazonie", "MALACONDA - Soda frizzante dell’Amazzonia", "MALACONDA - Refresco con gas del Amazonas"],
    "Payment - MALACONDA": ["Zahlung - MALACONDA", "Paiement - MALACONDA", "Pagamento - MALACONDA", "Pago - MALACONDA"],
    "Cart - MALACONDA": ["Warenkorb - MALACONDA", "Panier - MALACONDA", "Carrello - MALACONDA", "Carrito - MALACONDA"]
  };

  var lang = "en", ATTRS = ["alt", "placeholder", "aria-label", "title"];
  var orig = new WeakMap(), origA = new WeakMap(), busy = false;

  function pick(arr, l) { return arr[IDX[l]]; }
  function tr(text, l) {
    var key = text.replace(/\s+/g, " ").trim();
    if (!key) return null;
    if (D[key]) return pick(D[key], l);
    for (var i = 0; i < P.length; i++) { var m = key.match(P[i][0]); if (m && !P[i][3]) return pick(P[i][1], l).replace(/\$(\d)/g, function (_, n) { return m[n]; }); }
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
    n.nodeValue = out; orig.set(n, { en: en, tr: out });
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
    document.querySelectorAll("[data-lang-select]").forEach(function (s) { s.value = lang; });
    document.querySelectorAll("[data-lang]").forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.lang === lang)); });
  }
  function set(l, silent) {
    lang = LANGS.indexOf(l) > -1 ? l : "en";
    document.documentElement.lang = lang;
    try { if (!silent) localStorage.setItem(KEY, lang); } catch (e) {}
    head(lang); if (document.body) apply(document.body); paintPicker();
    document.dispatchEvent(new CustomEvent("langchange", { detail: lang }));
  }
  function initial() {
    var saved = null; try { saved = localStorage.getItem(KEY); } catch (e) {}
    var q = (location.search.match(/[?&]lang=(\w\w)/) || [])[1];
    var browser = (navigator.language || "").toLowerCase().slice(0, 2);
    return LANGS.indexOf(q) > -1 ? q : LANGS.indexOf(saved) > -1 ? saved : LANGS.indexOf(browser) > -1 ? browser : "en";
  }

  // the language row used in the header (a select) and the footer (buttons); common.js asks for them
  function selectHtml() {
    return '<select class="lang-select" data-lang-select aria-label="Language">' + LANGS.map(function (l) { return '<option value="' + l + '">' + l.toUpperCase() + "</option>"; }).join("") + "</select>";
  }
  function buttonsHtml() {
    return '<div class="lang-row" role="group" aria-label="Language">' + LANGS.map(function (l) { return '<button type="button" class="lang-btn" data-lang="' + l + '" aria-pressed="false" lang="' + l + '" title="' + LABELS[l] + '">' + l.toUpperCase() + "</button>"; }).join("") + "</div>";
  }

  document.addEventListener("change", function (e) { var s = e.target.closest && e.target.closest("[data-lang-select]"); if (s) set(s.value); });
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
