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
- Le catalogue (m²/paquet et prix par épaisseur inclus), la commande et les dernières saisies sont gardés dans le navigateur.

## Utilisation

Une seule page : `index.html`. Hébergeable telle quelle avec GitHub Pages.

