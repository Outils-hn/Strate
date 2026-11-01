# Journal des versions — Strate

Les versions anciennes n'ont pas de date : elles viennent du journal tenu jusqu'ici dans le `README.md`.

## 15.3 — 31 octobre 2026

- Sélecteur d'applis et liens vers les fiches d'Index sur GitHub Pages (`https://outils-hn.github.io/<Appli>/`) à la place des adresses Lovable.

## 15.2 — 31 octobre 2026

- Publication sur GitHub Pages sous `https://outils-hn.github.io/Strate/` (compte renommé `outils-hn`).
- Adresses de l'Accueil et de Trame mises à jour dans le sélecteur d'applis et le lien « Suggestion / bug ».

## 15.1

- Chaque produit peut être lié à sa fiche technique dans Index (recherche dans la bibliothèque, lien partagé avec le catalogue commun, ouverture directe de la fiche).

## 15

- Catalogue commun à l'équipe (produits avec prix, m²/colis et colis/palette, systèmes de fixation) dans la base de Masse : lecture libre, partage protégé par le PIN de Masse.
- Modifications locales gardées tant qu'elles ne sont pas envoyées ; sans réseau, Strate continue avec la copie du poste.
- Script SQL : `supabase/strate-catalogue.sql` (à exécuter une fois).

## 14

- Style « Épure » de la famille (Format, Index, Linear, Masse, Trame) avec le jaune laine de verre comme couleur propre, sélecteur des 6 applis, pied de page avec « À propos ».
- Champs qui acceptent « 1'200 », virgule ou point ; tolérance négative, cible hors catalogue et surface négative signalées.
- Bon de commande PDF au style Épure avec police embarquée (m² correct).
- Check-up automatique dans un navigateur.

## 13.2

- Données ISORESIST corrigées d'après la fiche Isover (prix, m² par colis, colis par palette).
- Vocabulaire Isover « colis » / « palette », colis par palette réglables épaisseur par épaisseur.

## 13

- Style de la famille Masse (barre de navigation, cartes blanches, titres en petites capitales, accent brique, chiffres en chasse fixe et milliers à la suisse, tuiles de résultats).
- Page qui ne déborde plus sur téléphone.

## 12.1

- Bon de commande PDF téléchargé directement (jsPDF, livré dans `vendor/`, sans connexion Internet), signature Hugo N.

## 12

- Nouveau visuel « dessin technique » (gris béton, graphite, jaune laine de verre réservé aux couches dessinées avec le symbole d'isolant des plans).
- Combinaison recommandée en grand + autres combinaisons en lignes, total de la commande en tête, réglages et fixations repliables.

## 11

- Livraisons en plusieurs fois (X % du total, solde proposé automatiquement, historique, exports de la livraison en cours).
- Guide de démarrage et aides « ? ».

## 10

- Mélange de 2 produits (1re couche côté mur + couches suivantes).
- Fixations : chevilles HFT (1re couche, choisies selon la fixation max) et spirales Drall-Fix / Drillfast (couches suivantes, selon l'abaque), en pièces et boîtes, avec alerte si aucune ne convient ; catalogue des fixations modifiable.

## 9

- Code découpé en fichiers + tests automatiques (aucun changement visible).

## 8

- Choix du produit à modifier directement dans le catalogue.
- Masse volumique (kg/m³) avec type déduit automatiquement.

## 7

- Versions 6 et 7 : affichage soigné en mode sombre, deux colonnes sur PC, bouton de thème Auto / Clair / Sombre.
- Bon de commande PDF classé par façade puis par étage.

## 5

- Sauvegarde / restauration dans un fichier (avec fusion du catalogue d'un collègue).
- Commandes nommées, prix CHF/m² par combinaison et tri « le moins cher », zones modifiables, date des prix.
- Surface saisie sous forme de calcul (12,5*3,2+8).

## 4

- Import d'un tableau : coller le tableau d'une fiche technique (PDF, Excel, Power Query), choisir les colonnes, créer ou mettre à jour un produit.

## 3

- Copie vers Excel : zones (façade, étage) copiées avec mise en forme ; en-tête au 1er collage, puis seulement les nouvelles zones. Récap de commande copiable aussi.

## 2

- Commande : surface + repère par zone, bouton « + Commande » sur chaque combinaison, récap par épaisseur (m² avec chute, colis arrondis au supérieur, palettes, prix catalogue CHF HT) et copie en texte pour un mail.

## 1

- Première version : catalogue pré-rempli Isover ISORESIST 1000 031 F (40 → 200 mm), modifiable ; combinaisons de 1 à 3 couches avec tolérance, classées et illustrées avec la valeur R ; épaisseur la plus proche en dessous et au-dessus.
