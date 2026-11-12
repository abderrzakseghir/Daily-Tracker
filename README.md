# Daily Tracker

Application web (PWA) pour suivre ses tâches quotidiennes, les planifier sur un calendrier
et les synchroniser avec Jira. Pensée pour préparer les Daily Scrum. Interface en français,
mobile et desktop.

## Fonctionnalités

| | |
|---|---|
| **Journée** | Ajout rapide en langage naturel, points de 1 à 10 par tâche, durée calculée automatiquement, liste réordonnable par glisser-déposer, agenda du jour, humeur / énergie, bloquants, notes, validation de la journée |
| **Planning** | Calendrier semaine / jours ouvrés / jour : tâches en cartes placées aux bons horaires, glisser-déposer (heure et jour), redimensionnement de la durée, pause déjeuner, ligne « maintenant » |
| **Jira** | Connexion OAuth, création de tickets depuis les tâches (assignés, avec estimation), liaison à un ticket existant, import de ses tickets, worklog automatique quand une tâche est terminée et mis à jour si la durée ou l'horaire change, passage optionnel du ticket à « Terminé » |
| **Historique** | Calendrier mensuel façon heatmap, séries de jours validés, recherche plein texte, modification de n'importe quelle journée passée |
| **Rapports** | Temps réalisé par jour et par catégorie, répartition, humeur et énergie, top tickets Jira, tableau détaillé, export PDF et CSV |
| **Daily meeting** | Hier / aujourd'hui / bloquants, mode présentation, copie formatée pour Slack ou Teams, chrono de parole |
| **Au quotidien** | Minuteur focus (temps mesuré par tâche), tâches récurrentes (daily, revue…), report des tâches non terminées, rappel push de fin de journée, raccourcis clavier, mode sombre, export JSON |

### Points → temps

Chaque tâche reçoit des points de 1 à 10. Deux modes au choix (Paramètres) :

- **Répartir la journée** (par défaut) : la capacité de la journée, pause déduite, est partagée
  au prorata des points entre les tâches sans durée forcée. Exemple sur 7h30 : 6 / 3 / 1 points
  donnent 4h30 / 2h15 / 45 min.
- **Minutes par point** : durée = points × N minutes.

Les tâches s'enchaînent depuis le début de journée et sont découpées autour de la pause
déjeuner et des tâches à horaire fixe. Une tâche déplacée sur le calendrier garde son horaire.

### Ajout rapide

```
Corriger le login !7 #dev 1h30 @14h +PROJ
```

`!7` points · `#réunion` catégorie · `1h30` durée forcée · `@14h` horaire fixe ·
`+PROJ` crée le ticket Jira · `PROJ-123` lie un ticket existant.

Raccourcis : `N` nouvelle tâche · `←` `→` jour précédent / suivant · `T` aujourd'hui.

## Architecture

```
Navigateur (Next.js, React, SWR)
   │  cookie de session httpOnly signé (HMAC)
   ▼
Routes API Next.js (Vercel) ──► Supabase Postgres (clé service_role, RLS fermé)
   │
   ├──► Google OAuth 2.0 (connexion)
   └──► Jira Cloud REST v3 (OAuth 3LO, jetons stockés côté serveur, rafraîchis automatiquement)
```

- `app/` : pages et routes API (`app/api/*` renvoient toujours `{ success, data?, error? }`)
- `lib/planner.ts` : calcul points → durées → horaires (partagé client/serveur, testé)
- `lib/server/` : session, Supabase, Jira, accès aux données (serveur uniquement)
- `lib/client/data.ts` : hooks SWR et actions avec mises à jour optimistes
- `components/features/` : calendrier, vue Journée, éditeur, import Jira…
- `supabase/schema.sql` : schéma de la base

## Mise en route

### 1. Supabase

1. Créez un projet sur [supabase.com](https://supabase.com) (l'offre gratuite suffit).
2. **SQL Editor** : collez puis exécutez [`supabase/schema.sql`](supabase/schema.sql).
3. **Project Settings → API** : récupérez l'URL du projet et la clé `service_role`.

> Astuce : l'intégration Supabase du Marketplace Vercel renseigne ces variables automatiquement.

### 2. Google OAuth (connexion)

Dans [Google Cloud Console → Identifiants](https://console.cloud.google.com/apis/credentials),
ouvrez votre client OAuth « Application Web », puis :

- **Origines JavaScript autorisées** : `https://votre-app.vercel.app` et `http://localhost:3000`
- **URI de redirection autorisées**, à recopier exactement :
  - `https://votre-app.vercel.app/api/auth/google/callback`
  - `http://localhost:3000/api/auth/google/callback`

> **Erreur `redirect_uri_mismatch` ?** L'URI envoyée à Google est maintenant toujours
> `APP_URL + /api/auth/google/callback`. Ouvrez `/api/health` sur votre site : il affiche
> l'URI exacte à déclarer.

Si l'écran de consentement est en mode « Test », ajoutez chaque utilisateur (10 maximum) dans
**Utilisateurs test**, ou publiez l'application.

### 3. Jira (optionnel)

Sur [developer.atlassian.com → My apps](https://developer.atlassian.com/console/myapps/), dans
votre app OAuth 2.0 (3LO) :

- **Authorization → Callback URL** : `https://votre-app.vercel.app/api/auth/jira/callback`.
  Atlassian n'accepte qu'une seule URL : utilisez une app distincte pour le local si besoin.
- **Permissions → Jira API** : `read:jira-user`, `read:jira-work`, `write:jira-work`,
  plus `read:account` (User identity API).

### 4. Variables d'environnement

Copiez [`.env.example`](.env.example) en `.env.local` pour le local. Sur Vercel, ajoutez les
mêmes variables dans **Settings → Environment Variables** :

| Variable | Obligatoire | Rôle |
|---|---|---|
| `APP_URL` | ✅ | URL publique canonique, sans `/` final |
| `SESSION_SECRET` | ✅ | 32+ caractères aléatoires |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | ✅ | Connexion Google |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Base de données |
| `JIRA_CLIENT_ID`, `JIRA_CLIENT_SECRET` | Jira | Intégration Jira |
| `ALLOWED_EMAILS` | — | Liste blanche d'e-mails (séparés par des virgules) |
| `MAX_USERS` | — | 10 par défaut |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `CRON_SECRET` | — | Rappel push de fin de journée (cron dans `vercel.json`) |

Redéployez après chaque modification de variable.

### 5. Lancer

```bash
npm install
npm run dev         # http://localhost:3000
npm test            # tests (planificateur, saisie rapide, API + synchro Jira simulée)
npm run type-check
npm run lint
npm run build
```

### Migration depuis l'ancienne version

Les données de l'ancienne version étaient stockées dans le navigateur. À la première connexion,
la vue Journée propose de les **importer** dans votre compte (tâches, durées, bloquants,
validations).
