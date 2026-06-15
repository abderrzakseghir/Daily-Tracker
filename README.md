# 📊 Daily Tracker

**Application mobile-first pour préparer vos Daily Scrum en toute simplicité.**

![Next.js](https://img.shields.io/badge/Next.js-14-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38bdf8)
![PWA](https://img.shields.io/badge/PWA-Ready-purple)

## 🎯 À propos

Daily Tracker est une application web progressive (PWA) conçue pour les développeurs et équipes agiles. Elle permet de :

- ✅ **Tracker ses tâches** quotidiennes par catégorie
- 📋 **Planifier** les tâches du lendemain
- 🎤 **Présenter** son daily en mode optimisé
- 📄 **Exporter** des rapports PDF professionnels
- 🔥 **Maintenir** un streak de productivité
- 🏆 **Gagner** des badges et monter en niveau

## 🏗️ Architecture globale

```mermaid
graph TB
    subgraph "Frontend - Next.js 14"
        A[App Router] --> B[Pages]
        B --> B1[Dashboard]
        B --> B2[History]
        B --> B3[Daily Meeting]
        B --> B4[Reports]
        B --> B5[Settings]
        
        A --> C[Components]
        C --> C1[UI Components]
        C --> C2[Feature Components]
        C --> C3[Layout Components]
    end
    
    subgraph "State Management"
        D[Zustand Store] --> E[Persist Middleware]
        E --> F[LocalStorage]
    end
    
    subgraph "PWA"
        G[Service Worker] --> H[Push Notifications]
        G --> I[Offline Mode]
    end
    
    B --> D
```

## 📂 Structure du projet

```
📁 daily-tracker/
├── 📁 app/
│   ├── 📁 dashboard/       # Page principale
│   │   └── README.md       # Documentation
│   ├── 📁 history/         # Historique calendrier
│   │   └── README.md
│   ├── 📁 daily-meeting/   # Mode présentation
│   │   └── README.md
│   ├── 📁 reports/         # Export PDF
│   │   └── README.md
│   ├── 📁 settings/        # Paramètres
│   │   └── README.md
│   ├── 📁 api/             # Routes API
│   ├── layout.tsx          # Layout principal
│   └── page.tsx            # Login
├── 📁 components/
│   ├── 📁 ui/              # Composants réutilisables
│   ├── 📁 features/        # Composants métier
│   └── 📁 layout/          # Navigation, AppLayout
├── 📁 lib/
│   ├── store.ts            # Store Zustand
│   └── utils.ts            # Utilitaires
├── 📁 types/
│   └── index.ts            # Types TypeScript
├── 📁 public/
│   ├── manifest.json       # PWA manifest
│   └── sw.js               # Service worker
└── README.md
```

## 🚀 Installation

```bash
# Cloner le repo
git clone https://github.com/abderrzakseghir/Daily-Tracker.git
cd Daily-Tracker

# Installer les dépendances
npm install

# Lancer en développement
npm run dev
```

L'application sera disponible sur [http://localhost:3000](http://localhost:3000)

## 🔧 Scripts disponibles

| Commande | Description |
|----------|-------------|
| `npm run dev` | Démarre le serveur de développement |
| `npm run build` | Build de production |
| `npm run start` | Lance le serveur de production |
| `npm run lint` | Analyse le code avec ESLint |

## 📱 Flux utilisateur principal

```mermaid
flowchart TD
    A[Login / Créer compte] --> B[Dashboard]
    
    B --> C{Journée en cours}
    C --> D[Ajouter tâches]
    C --> E[Planifier demain]
    C --> F[Noter blocages]
    
    D --> G[Valider journée]
    E --> G
    F --> G
    
    G --> H{Streak +1 🔥}
    H --> I[Gamification Update]
    I --> J{Nouveau badge ?}
    J -->|Oui| K[Notification 🏆]
    J -->|Non| L[Fin]
    K --> L
    
    B --> M[Historique]
    M --> N[Modifier jour passé]
    N --> O{Jour validé ?}
    O -->|Non| P[Éditer directement]
    O -->|Oui| Q[Confirmer déverrouillage]
    Q --> P
    
    B --> R[Daily Meeting]
    R --> S[Présenter au daily]
    
    B --> T[Rapports]
    T --> U[Générer PDF]
```

## 🎮 Système de gamification

```mermaid
graph LR
    subgraph "Progression"
        A[Tâche complétée] -->|+5 XP| B[XP Total]
        C[Journée validée] -->|+10 XP| B
        D[Streak maintenu] -->|+20 XP| B
        
        B --> E{Level Up ?}
        E -->|XP >= 100| F[Niveau +1]
        F --> G[XP reset]
    end
    
    subgraph "Badges"
        H[first_task] --> I["Première tâche 🌱"]
        J[streak_3] --> K["3 jours consécutifs 🔥"]
        L[streak_7] --> M["7 jours consécutifs 💪"]
        N[productive_50] --> O["50 tâches 🚀"]
    end
```

## 🛠️ Technologies

| Technologie | Usage |
|-------------|-------|
| **Next.js 14** | Framework React avec App Router |
| **TypeScript** | Typage statique |
| **Tailwind CSS** | Styling utilitaire |
| **Zustand** | State management |
| **Chart.js** | Graphiques |
| **jsPDF** | Génération PDF |
| **date-fns** | Manipulation de dates |
| **Framer Motion** | Animations |
| **Lucide React** | Icônes |

## 📖 Documentation par page

Chaque page dispose de sa propre documentation avec diagrammes Mermaid :

- [Dashboard](app/dashboard/README.md) - Page principale
- [Historique](app/history/README.md) - Calendrier et édition
- [Daily Meeting](app/daily-meeting/README.md) - Mode présentation
- [Rapports](app/reports/README.md) - Export PDF
- [Paramètres](app/settings/README.md) - Configuration

## 🔐 Sécurité

- Authentification par code PIN (4-6 chiffres)
- Données stockées localement dans le localStorage
- Aucune donnée envoyée à un serveur externe par défaut

## Variables d'environnement (optionnel)

Créez un fichier `.env.local` pour activer les fonctionnalités cloud :

```env
# Vercel Blob Storage (optionnel)
BLOB_READ_WRITE_TOKEN=votre_token

# Web Push (optionnel)
NEXT_PUBLIC_VAPID_PUBLIC_KEY=votre_cle_publique
VAPID_PRIVATE_KEY=votre_cle_privee
VAPID_SUBJECT=mailto:votre@email.com
```

## 🎨 Thème

L'application supporte le mode sombre/clair avec trois options :
- 🌙 **Sombre** - Interface dark
- ☀️ **Clair** - Interface light
- 💻 **Système** - Suit les préférences OS

## 📱 PWA

Daily Tracker est installable comme application native :

1. Ouvrir l'application dans Chrome/Edge
2. Cliquer sur "Installer" dans la barre d'adresse
3. L'app apparaît dans vos applications

### Fonctionnalités PWA

- ✅ Installation sur écran d'accueil
- ✅ Fonctionnement hors-ligne
- ✅ Notifications push (rappels de validation)
- ✅ Icônes adaptatives

## 📊 Flux de données

```mermaid
graph LR
    A[User Input] --> B[Zustand Store]
    B --> C[Persist Middleware]
    C --> D[LocalStorage]
    D --> C
    C --> B
    B --> E[React Components]
```

## 📄 Licence

MIT - Libre d'utilisation et de modification.

---

Développé avec ❤️ pour les équipes agiles
