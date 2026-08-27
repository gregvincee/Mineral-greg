# Mineral-greg

Service HTTP minimal qui calcule une fourchette et une médiane de prix à partir de résultats de ventes eBay pour des cartes de collection. Le service ne remplace pas une expertise de prix : il expose un indicateur fondé sur les résultats retournés par le fournisseur.

## Démarrage local

Le projet requiert **Node.js 18 ou supérieur** et pnpm.

```bash
pnpm install
cp .env.example .env
# renseignez EBAY_APP_ID et, si l’API est consommée par un navigateur,
# les origines autorisées dans ALLOWED_ORIGINS
PORT=3001 EBAY_APP_ID="votre-valeur" pnpm start
```

## Configuration

| Variable | Requise | Rôle |
|---|---:|---|
| `PORT` | Oui au démarrage | Port fourni par l’environnement d’hébergement. |
| `EBAY_APP_ID` | Oui pour la recherche | Identifiant d’application du fournisseur de données. Ne pas le versionner. |
| `ALLOWED_ORIGINS` | Oui pour un client web distinct | Liste d’origines séparées par des virgules autorisées à appeler l’API depuis un navigateur. |

## Endpoints

| Méthode | Route | Résultat |
|---|---|---|
| `GET` | `/health` | État minimal du service. |
| `GET` | `/api/ebay-price?query=...` | `{ found, median, low, high, count }` lorsque des ventes valides sont retournées. |

Les recherches sont normalisées, limitées à 120 caractères et protégées par une limite mémoire de **30 requêtes par minute et par adresse IP**. Les erreurs du fournisseur sont volontairement retournées comme indisponibilité générique plutôt qu’avec le détail interne.

## Validation

```bash
pnpm test
node --check server.js
```

La CI exécute l’installation verrouillée, le contrôle de syntaxe et les tests sur chaque push et pull request vers `main`.
