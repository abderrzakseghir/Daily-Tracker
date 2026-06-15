# Paramètres - Configuration

## Description

La page **Paramètres** permet de personnaliser l'application : profil, thème, notifications et gestion des données.

## Fonctionnalités

- 👤 Affichage du profil utilisateur
- 🎨 Choix du thème (clair/sombre/système)
- 🔔 Configuration des notifications push
- 💾 Export des données en JSON
- 🗑️ Suppression des données

## Architecture

```mermaid
graph TB
    subgraph "Settings Page"
        A[Page Paramètres] --> B[Header]
        A --> C[Profile Card]
        A --> D[Appearance Card]
        A --> E[Notifications Card]
        A --> F[Data Card]
        A --> G[App Info]
        
        C --> C1[Avatar initiales]
        C --> C2[Nom utilisateur]
        C --> C3[Date inscription]
        C --> C4[Stats: Entrées, Tâches, Badges]
        
        D --> D1[Select thème]
        
        E --> E1[Status notifications]
        E --> E2[Bouton activer]
        E --> E3[Heures de rappel]
        
        F --> F1[Export JSON]
        F --> F2[Zone danger]
        F --> F3[Delete all data]
    end
```

## Gestion du thème

```mermaid
sequenceDiagram
    participant U as Utilisateur
    participant S as Settings
    participant T as ThemeProvider
    participant L as LocalStorage

    U->>S: Change thème
    S->>T: setTheme(value)
    T->>L: Sauvegarde préférence
    T->>T: Applique classe 'dark' ou 'light'
    T-->>S: Mise à jour UI
```

## Options de thème

```mermaid
graph LR
    A[system] --> |Suit OS| B{Préférence système}
    B -->|Dark mode| C[dark]
    B -->|Light mode| D[light]
    
    E[light] --> D
    F[dark] --> C
```

## Notifications Push

```mermaid
sequenceDiagram
    participant U as Utilisateur
    participant S as Settings
    participant N as Notification API
    participant SW as Service Worker

    U->>S: Clic "Activer"
    S->>N: Notification.requestPermission()
    N-->>S: 'granted' | 'denied'
    
    alt Permission accordée
        S->>SW: navigator.serviceWorker.ready
        SW->>SW: pushManager.subscribe()
        SW-->>S: PushSubscription
        S->>S: Notification test
        S-->>U: "Notifications activées !"
    else Permission refusée
        S-->>U: "Notifications refusées"
    end
```

## Heures de rappel par défaut

```mermaid
graph LR
    A[16:55] --> |1er rappel| B[Journée non validée ?]
    C[17:30] --> |2e rappel| B
    D[18:00] --> |Dernier rappel| B
    
    B -->|Oui| E[Envoie notification]
    B -->|Non| F[Pas de notification]
```

## Export des données

```mermaid
flowchart TB
    A[Clic Export] --> B[Collecte données]
    B --> C[user sans PIN]
    B --> D[entries]
    B --> E[exportedAt]
    
    C --> F[JSON.stringify]
    D --> F
    E --> F
    
    F --> G[Blob]
    G --> H[URL.createObjectURL]
    H --> I[Download link]
    I --> J[Fichier .json]
```

## Structure de l'export

```json
{
  "user": {
    "id": "uuid",
    "name": "Prénom",
    "settings": { ... },
    "gamification": { ... },
    "createdAt": "2026-06-01T..."
  },
  "entries": [
    {
      "id": "uuid",
      "date": "2026-06-15",
      "tasks": [ ... ],
      "validated": true
    }
  ],
  "exportedAt": "2026-06-15T18:00:00Z"
}
```

## Zone de danger

```mermaid
graph TB
    A[Clic "Supprimer mes données"] --> B{Confirmation}
    B -->|Annuler| C[Rien]
    B -->|Confirmer| D[localStorage.clear]
    D --> E[Redirect vers /]
    E --> F[Nouveau compte possible]
```

## Composants utilisés

| Composant | Description |
|-----------|-------------|
| `Card` | Container pour chaque section |
| `Select` | Sélection du thème |
| `Button` | Actions (export, delete) |
| `Badge` | Status notifications |

## États des notifications

| État | Badge | Action |
|------|-------|--------|
| Non supporté | - | Message d'erreur |
| Non demandé | - | Bouton "Activer" |
| Accordé | ✅ Activées | Affiche heures |
| Refusé | - | Instructions manuelles |

## Code exemple

```tsx
// Changement de thème
const { theme, setTheme } = useTheme();
setTheme('dark'); // ou 'light' ou 'system'

// Export données
const handleExportData = () => {
  const data = {
    user: { ...user, pin: undefined },
    entries,
    exportedAt: new Date().toISOString(),
  };
  
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  });
  
  // Téléchargement...
};

// Suppression
const handleDeleteAll = () => {
  if (confirm('Êtes-vous sûr ?')) {
    localStorage.clear();
    router.push('/');
  }
};
```

## Informations de l'app

- Version : 1.0.0
- Développé avec ❤️ pour les équipes agiles
