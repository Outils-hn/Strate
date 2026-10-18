# Strate

Petite appli web pour trouver quelles épaisseurs d'isolation empiler afin d'atteindre l'épaisseur dessinée en coupe.

## Fonctions (V1)

- **Catalogue** pré-rempli avec Isover ISORESIST 1000 031 F (40 → 200 mm), modifiable : ajout/retrait d'épaisseurs, autres produits, type souple / semi-rigide / rigide, λ.
- **Combinaisons** : épaisseur cible, tolérance − / +, 1 à 3 couches max ; résultats classés (moins de couches, plus petit écart, couches équilibrées), avec schéma des couches et valeur R.
- **Épaisseur la plus proche** : la combinaison réalisable juste en dessous et juste au-dessus de l'épaisseur dessinée.
- **Commande** (V2) : surface + repère par zone, bouton « + Commande » sur chaque combinaison, récap par épaisseur (m² avec chute, paquets arrondis au supérieur, multipacs, prix catalogue CHF HT) et copie en texte pour un mail.
- Le catalogue (m²/paquet et prix par épaisseur inclus), la commande et les dernières saisies sont gardés dans le navigateur.

## Utilisation

Une seule page : `index.html`. Hébergeable telle quelle avec GitHub Pages.

