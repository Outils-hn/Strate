# Strate

Petite appli web pour trouver quelles épaisseurs d'isolation empiler afin d'atteindre l'épaisseur dessinée en coupe.

## Fonctions (V1)

- **Catalogue** pré-rempli avec Isover ISORESIST 1000 031 F (40 → 200 mm), modifiable : ajout/retrait d'épaisseurs, autres produits, type souple / semi-rigide / rigide, λ.
- **Combinaisons** : épaisseur cible, tolérance − / +, 1 à 3 couches max ; résultats classés (moins de couches, plus petit écart, couches équilibrées), avec schéma des couches et valeur R.
- **Épaisseur la plus proche** : la combinaison réalisable juste en dessous et juste au-dessus de l'épaisseur dessinée.
- **Commande** (V2) : surface + repère par zone, bouton « + Commande » sur chaque combinaison, récap par épaisseur (m² avec chute, paquets arrondis au supérieur, multipacs, prix catalogue CHF HT) et copie en texte pour un mail.
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
- Le catalogue (m²/paquet et prix par épaisseur inclus), la commande et les dernières saisies sont gardés dans le navigateur.

## Organisation du code

- `index.html` : la page (structure).
- `styles.css` : l'apparence.
- `js/core.js` : les calculs (combinaisons, prix, commande, import…), sans lien avec la page : c'est la partie testée.
- `js/app.js` : l'interface (boutons, affichage, sauvegarde dans le navigateur).
- `tests/core.test.js` : les tests automatiques.
- `vendor/` : jsPDF 2.5.1 et jsPDF-AutoTable 3.8.2 (licence MIT, voir les fichiers LICENSE), chargés au premier export PDF.

Hébergé tel quel avec GitHub Pages, aucune installation nécessaire.

## Tests

`npm test` (ou `node --test`) vérifie les calculs : combinaisons, classement, paquets, import, migration des anciennes sauvegardes…
Ils tournent aussi automatiquement sur GitHub à chaque modification (onglet « Actions ») : une coche verte sur la demande de fusion = rien de cassé.

