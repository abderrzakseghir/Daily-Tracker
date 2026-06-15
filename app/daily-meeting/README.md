# Daily Meeting - Mode Présentation

## Description

La page **Daily Meeting** offre une vue optimisée pour les réunions Daily Scrum. Elle affiche clairement les trois questions classiques du daily : ce qui a été fait, ce qui va être fait, et les blocages.

## Fonctionnalités

- 🎯 Vue centrée et épurée
- 📝 Hier : tâches réalisées
- 📋 Aujourd'hui : tâches prévues
- ⚠️ Blocages en évidence
- 📱 Parfait pour présentation écran

## Architecture

```mermaid
graph TB
    subgraph "Daily Meeting Page"
        A[Page Daily Meeting] --> B[Header centré]
        A --> C[Card Hier]
        A --> D[Card Aujourd'hui]
        A --> E[Card Blocages]
        
        B --> B1[Icône Presentation]
        B --> B2[Titre "Mode Daily Meeting"]
        B --> B3[Date du jour]
        
        C --> C1[Titre avec icône ✅]
        C --> C2[Stats: N tâches, Xh]
        C --> C3[Liste des tâches]
        
        D --> D1[Titre avec icône 🕐]
        D --> D2[Liste plannedTasks]
        
        E --> E1[Titre avec icône ⚠️]
        E --> E2[Texte des blocages]
    end
```

## Format Daily Scrum

```mermaid
graph LR
    subgraph "Les 3 questions"
        A[❓ Qu'ai-je fait hier ?] --> B[yesterdayEntry.tasks]
        C[❓ Que vais-je faire ?] --> D[todayEntry.plannedTasks]
        E[❓ Des blocages ?] --> F[entry.blockers]
    end
```

## Flux de données

```mermaid
sequenceDiagram
    participant U as Utilisateur
    participant D as Daily Meeting
    participant S as Store
    participant E as Entries

    U->>D: Ouvre la page
    D->>S: get entries
    S-->>D: All entries
    
    D->>D: format(today, 'yyyy-MM-dd')
    D->>D: format(yesterday, 'yyyy-MM-dd')
    
    D->>E: find(e => e.date === today)
    E-->>D: todayEntry
    
    D->>E: find(e => e.date === yesterday)
    E-->>D: yesterdayEntry
    
    D-->>U: Affiche les 3 sections
```

## Structure des données affichées

```mermaid
graph TB
    subgraph "Hier (yesterdayEntry)"
        A1[tasks] --> A2[description]
        A1 --> A3[category]
        A1 --> A4[duration]
    end
    
    subgraph "Aujourd'hui (todayEntry)"
        B1[plannedTasks] --> B2[description]
        B1 --> B3[category]
    end
    
    subgraph "Blocages"
        C1[todayEntry.blockers]
        C2[ou yesterdayEntry.blockers]
    end
```

## Composants utilisés

| Composant | Description |
|-----------|-------------|
| `DailyMeetingView` | Composant principal d'affichage |
| `Card` | Container pour chaque section |
| `Badge` | Catégorie des tâches |
| `ChevronRight` | Icône de liste |

## Style de présentation

```mermaid
graph TB
    subgraph "Layout"
        A[max-w-2xl] --> B[mx-auto]
        B --> C[space-y-6]
        C --> D[Cards full-width]
    end
    
    subgraph "Cards"
        E[variant=bordered]
        F[Padding confortable]
        G[Lisibilité maximale]
    end
```

## Icônes par section

| Section | Icône | Couleur |
|---------|-------|---------|
| Hier | ✅ CheckCircle | Vert success |
| Aujourd'hui | 🕐 Clock | Bleu accent |
| Blocages | ⚠️ AlertTriangle | Orange warning |

## Cas de fallback

```mermaid
flowchart TD
    A{yesterdayEntry existe ?}
    A -->|Oui| B[Affiche tasks]
    A -->|Non| C["Aucune tâche hier"]
    
    D{todayEntry.plannedTasks ?}
    D -->|Oui| E[Affiche planned]
    D -->|Non| F{yesterdayEntry.plannedTasks ?}
    F -->|Oui| G[Affiche planned d'hier]
    F -->|Non| H["Aucune tâche prévue"]
    
    I{blockers exist ?}
    I -->|Oui| J[Affiche blockers]
    I -->|Non| K["Aucun blocage"]
```

## Code exemple

```tsx
// Récupération des entrées
const today = format(new Date(), 'yyyy-MM-dd');
const yesterday = format(subDays(new Date(), 1), 'yyyy-MM-dd');

const todayEntry = entries.find((e) => e.date === today);
const yesterdayEntry = entries.find((e) => e.date === yesterday);

// Affichage
<DailyMeetingView
  todayEntry={todayEntry}
  yesterdayEntry={yesterdayEntry}
/>
```

## Conseils d'utilisation

1. **Ouvrir juste avant le daily** - Les données sont à jour
2. **Partager son écran** - Vue optimisée pour la visibilité
3. **Lire de haut en bas** - Suit le format classique du daily
4. **Mentionner les blocages** - Section mise en évidence en orange
