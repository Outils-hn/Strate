# Strate

Petite appli web pour trouver quelles épaisseurs d'isolation empiler afin d'atteindre l'épaisseur dessinée en coupe.

## Fonctions (V1)

- **Catalogue** pré-rempli avec Isover ISORESIST 1000 031 F (40 → 200 mm), modifiable : ajout/retrait d'épaisseurs, autres produits, type souple / semi-rigide / rigide, λ.
- **Combinaisons** : épaisseur cible, tolérance − / +, 1 à 3 couches max ; résultats classés (moins de couches, plus petit écart, couches équilibrées), avec schéma des couches et valeur R.
- **Épaisseur la plus proche** : la combinaison réalisable juste en dessous et juste au-dessus de l'épaisseur dessinée.
- **Commande** (V2) : surface + repère par zone, bouton « + Commande » sur chaque combinaison, récap par épaisseur (m² avec chute, colis arrondis au supérieur, palettes, prix catalogue CHF HT) et copie en texte pour un mail.
- **Import d'un tableau** (V4) : coller le tableau d'une fiche technique (PDF, Excel, Power Query), choisir les colonnes, créer ou mettre à jour un produit.
- **Copie vers Excel** (V3) : zones (façade, étage) copiées avec mise en forme ; en-tête au 1er collage, puis seulement les nouvelles zones. Récap de commande copiable aussi.
- **V5** : sauvegarde / restauration dans un fichier (avec fusion du catalogue d'un collègue), commandes nommées, prix CHF/m² par combinaison et tri « le moins cher », zones modifiables, date des prix, surface saisie sous forme de calcul (12,5*3,2+8).
- **V6-V7** : affichage soigné en mode sombre, deux colonnes sur PC, bouton de thème Auto / Clair / Sombre, bon de commande PDF classé par façade puis par étage.
- **V8** : choix du produit à modifier directement dans le catalogue, masse volumique (kg/m³) avec type déduit automatiquement.
- **V9** : code découpé en fichiers + tests automatiques (aucun changement visible).
- **V10** : mélange de 2 produits (1re couche côté mur + couches suivantes) ; fixations : chevilles HFT (1re couche, choisies selon la fixation max) et spirales Drall-Fix / Drillfast (couches suivantes, selon l'abaque), en pièces et boîtes, avec alerte si aucune ne convient ; catalogue des fixations modifiable.
- **V11** : livraisons en plusieurs fois (X % du total, solde proposé automatiquement, historique, exports de la livraison en cours), guide de démarrage et aides « ? ».
- **V12** : nouveau visuel « dessin technique » (gris béton, graphite, jaune laine de verre réservé aux couches dessinées avec le symbole d'isolant des plans), recommandée en grand + autres combinaisons en lignes, total de la commande en tête, réglages et fixations repliables.
- **V12.1** : bon de commande PDF téléchargé directement (jsPDF, livré dans `vendor/`, sans connexion Internet), signature Hugo N.
- **V13** : style de la famille Masse (barre de navigation, cartes blanches, titres en petites capitales, accent brique, chiffres en chasse fixe et milliers à la suisse, tuiles de résultats), page qui ne déborde plus sur téléphone.
- **V13.2** : données ISORESIST corrigées d'après la fiche Isover (prix, m² par colis, colis par palette), vocabulaire Isover « colis » / « palette », colis par palette réglables épaisseur par épaisseur.
- **V14** : style « Épure » de la famille (Format, Index, Linear, Masse, Trame) avec le jaune laine de verre comme couleur propre, sélecteur des 6 applis, pied de page avec « À propos » ; champs qui acceptent « 1'200 », virgule ou point ; tolérance négative, cible hors catalogue et surface négative signalées ; bon de commande PDF au style Épure avec police embarquée (m² correct) ; check-up automatique dans un navigateur.
- **V15** : catalogue commun à l'équipe (produits avec prix, m²/colis et colis/palette, systèmes de fixation) dans la base de Masse ; lecture libre, partage protégé par le PIN de Masse ; modifications locales gardées tant qu'elles ne sont pas envoyées ; sans réseau, Strate continue avec la copie du poste. Script SQL : `supabase/strate-catalogue.sql` (à exécuter une fois).
- **V15.1** : chaque produit peut être lié à sa fiche technique dans Index (recherche dans la bibliothèque, lien partagé avec le catalogue commun, ouverture directe de la fiche).
- **V15.2** : publication sur GitHub Pages sous `https://outils-hn.github.io/Strate/` (compte renommé `outils-hn`) ; adresses de l'Accueil et de Trame mises à jour dans le sélecteur d'applis et le lien « Suggestion / bug ».
- **V15.3** : sélecteur d'applis et liens vers les fiches d'Index sur GitHub Pages (`https://outils-hn.github.io/<Appli>/`) à la place des adresses Lovable.
- **V15.4** : réglage clair / sombre commun à toutes les applis ; le mode « Auto » est retiré (clair ou sombre seulement).
- Le catalogue (m²/colis, colis/palette et prix par épaisseur inclus), la commande et les dernières saisies sont gardés dans le navigateur.

## Organisation du code

- `index.html` : la page (structure).
- `styles.css` : l'apparence.
- `js/core.js` : les calculs (combinaisons, prix, commande, import…), sans lien avec la page : c'est la partie testée.
- `js/app.js` : l'interface (boutons, affichage, sauvegarde dans le navigateur).
- `tests/core.test.js` : les tests automatiques.
- `vendor/` : jsPDF 2.5.1 et jsPDF-AutoTable 3.8.2 (licence MIT, voir les fichiers LICENSE), chargés au premier export PDF ; `vendor/fonts/` : IBM Plex Sans (licence OFL) pour le PDF.
- `e2e/checkup.mjs` : check-up dans un navigateur, lancé par GitHub sur chaque branche (résultats sur la branche « captures/… »).

Hébergé tel quel avec GitHub Pages, aucune installation nécessaire.

## Tests

`npm test` (ou `node --test`) vérifie les calculs : combinaisons, classement, colis, import, migration des anciennes sauvegardes…
Ils tournent aussi automatiquement sur GitHub à chaque modification (onglet « Actions ») : une coche verte sur la demande de fusion = rien de cassé.

