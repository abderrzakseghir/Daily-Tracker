# Dashboard - Page Principale

## Description

La page **Dashboard** est le cœur de l'application Daily Tracker. Elle permet de gérer votre journée en temps réel : ajouter des tâches, suivre le temps de travail, et valider votre journée pour maintenir votre streak.

## Fonctionnalités

- ✅ Ajouter des tâches réalisées avec catégorie et durée
- 📋 Planifier les tâches de demain
- ⚠️ Noter les blocages rencontrés
- 🎯 Valider la journée
- 📊 Visualiser les statistiques en temps réel
- 🔥 Suivre le streak et la gamification

## Architecture

```mermaid
graph TB
    subgraph "Dashboard Page"
        A[Page Dashboard] --> B[Header]
        A --> C[Quick Stats]
        A --> D[Main Content Grid]
        
        B --> B1[Greeting]
        B --> B2[Date]
        
        C --> C1[Tasks Count]
        C --> C2[Work Time]
        C --> C3[Streak]
        
        D --> E[Left Column - Tasks]
        D --> F[Right Column - Stats]
        
        E --> E1[Task Form]
        E --> E2[Task List]
        E --> E3[Planned Tasks]
        E --> E4[Blockers]
        
        F --> F1[Day Validation]
        F --> F2[Category Chart]
        F --> F3[AI Summary]
        F --> F4[Gamification Card]
    end
```

## Flux de données

```mermaid
sequenceDiagram
    participant U as Utilisateur
    participant D as Dashboard
    participant S as Store (Zustand)
    participant L as LocalStorage

    U->>D: Ouvre la page
    D->>S: loadEntries()
    S->>L: Récupère les données
    L-->>S: Données utilisateur
    S->>S: getOrCreateTodayEntry()
    S-->>D: currentEntry

    U->>D: Ajoute une tâche
    D->>S: addTask(taskData)
    S->>S: Met à jour currentEntry
    S->>L: Sauvegarde automatique
    S-->>D: Mise à jour UI

    U->>D: Valide la journée
    D->>S: validateDay(entryId)
    S->>S: validated = true
    S->>S: updateGamification()
    S->>S: checkBadges()
    S-->>D: Animation de célébration
```

## Composants utilisés

| Composant | Fichier | Description |
|-----------|---------|-------------|
| TaskForm | `components/features/task-form.tsx` | Formulaire d'ajout/édition de tâche |
| TaskCard | `components/features/task-card.tsx` | Affichage d'une tâche avec actions |
| PlannedTaskList | `components/features/planned-task-list.tsx` | Liste des tâches prévues |
| DayValidation | `components/features/day-validation.tsx` | Bouton et stats de validation |
| CategoryChart | `components/features/category-chart.tsx` | Graphique de répartition |
| GamificationCard | `components/features/gamification-card.tsx` | Niveau, XP, badges |

## États du Dashboard

```mermaid
stateDiagram-v2
    [*] --> Loading: Ouverture page
    Loading --> EmptyDay: Aucune tâche
    Loading --> InProgress: Tâches présentes
    
    EmptyDay --> InProgress: Ajout tâche
    InProgress --> InProgress: Ajout/Modif/Suppression tâche
    InProgress --> Validated: Clic "Valider ma journée"
    
    Validated --> [*]: Journée terminée
    
    note right of Validated
        La journée validée
        apparaît dans l'historique
        et compte pour le streak
    end note
```

## Catégories disponibles

| Catégorie | Couleur | Icône |
|-----------|---------|-------|
| Développement | 🔵 Bleu | Code |
| Réunion | 🟣 Violet | Users |
| Support | 🟠 Orange | HelpCircle |
| Formation | 🟢 Vert | GraduationCap |
| Documentation | 🔵 Cyan | FileText |
| Recherche | 🩷 Rose | Search |
| Personnel | 🟣 Indigo | User |
| Autre | ⚫ Gris | MoreHorizontal |

## Durées prédéfinies

- ⏱️ 15 minutes
- ⏱️ 30 minutes
- 🕐 1 heure
- 🕑 2 heures
- 🕓 4 heures
- ⏱️ Personnalisé (en minutes)

## Responsive Design

```mermaid
graph LR
    subgraph "Mobile (< 1024px)"
        M1[Stats: 3 colonnes]
        M2[Contenu: 1 colonne]
        M3[Navigation: Bottom bar]
    end
    
    subgraph "Desktop (>= 1024px)"
        D1[Stats: 3 colonnes]
        D2[Contenu: 2 colonnes]
        D3[Navigation: Sidebar]
    end
```

## Code exemple

```tsx
// Ajouter une tâche
addTask({
  description: "Correction bug authentification",
  category: "development",
  duration: "2h",
  completed: false
});

// Valider la journée
await validateDay(currentEntry.id);
```
