# Historique - Calendrier et Recherche

## Description

La page **Historique** permet de naviguer dans vos journées passées grâce à un calendrier interactif. Vous pouvez consulter, rechercher et **modifier** n'importe quelle journée, même validée.

## Fonctionnalités

- 📅 Vue calendrier mensuelle
- 🔍 Recherche par mot-clé
- ✏️ Modification des journées passées
- 🔓 Déverrouillage des journées validées
- 📊 Visualisation des statistiques par jour

## Architecture

```mermaid
graph TB
    subgraph "History Page"
        A[Page Historique] --> B[Header]
        A --> C[Search Bar]
        A --> D[Main Grid]
        
        C --> C1[Input recherche]
        C --> C2[Résultats instantanés]
        
        D --> E[CalendarView]
        D --> F[Day Details Card]
        
        E --> E1[Navigation mois]
        E --> E2[Grille jours]
        E --> E3[Indicateurs validation]
        
        F --> F1[Stats du jour]
        F --> F2[Task Form si édition]
        F --> F3[Liste des tâches]
        F --> F4[Planned Tasks]
        F --> F5[Blockers]
    end
```

## Flux de modification d'une journée

```mermaid
sequenceDiagram
    participant U as Utilisateur
    participant H as History Page
    participant M as Modal
    participant S as Store

    U->>H: Sélectionne une date
    H->>S: Récupère l'entrée
    S-->>H: Affiche les détails

    U->>H: Clic "Modifier"
    
    alt Journée non validée
        H->>H: Active mode édition
    else Journée validée
        H->>M: Affiche modal confirmation
        U->>M: Confirme déverrouillage
        M->>S: unlockDay(entryId)
        S->>S: validated = false
        S-->>H: Active mode édition
    end

    U->>H: Modifie les tâches
    H->>S: addTask() / updateTask() / removeTask()
    S-->>H: Mise à jour UI

    U->>H: Clic "Valider"
    H->>S: validateDay(entryId)
    S-->>H: Journée re-validée
```

## États de la page

```mermaid
stateDiagram-v2
    [*] --> Viewing: Sélection date
    
    Viewing --> Searching: Saisie recherche
    Searching --> Viewing: Clear recherche
    Searching --> Viewing: Clic sur résultat
    
    Viewing --> EditMode: Clic "Modifier"
    Viewing --> UnlockModal: Clic "Modifier" (jour validé)
    
    UnlockModal --> Viewing: Annuler
    UnlockModal --> EditMode: Confirmer
    
    EditMode --> Viewing: Clic "Terminer"
    EditMode --> Viewing: Clic "Valider"
    
    state EditMode {
        [*] --> AddingTask
        AddingTask --> EditingTask: Clic edit
        EditingTask --> AddingTask: Save/Cancel
    }
```

## Recherche intelligente

La recherche parcourt :
- Les descriptions des tâches
- Les catégories
- Les tâches planifiées
- Les blocages

```mermaid
graph LR
    A[Query: "bug"] --> B{Filtrage}
    B --> C[Tasks.description]
    B --> D[Category labels]
    B --> E[PlannedTasks]
    B --> F[Blockers]
    
    C --> G[Résultats fusionnés]
    D --> G
    E --> G
    F --> G
    
    G --> H[Affichage instantané]
```

## Composants clés

| Composant | Description |
|-----------|-------------|
| `CalendarView` | Calendrier mensuel avec navigation |
| `TaskCard` | Affichage de tâche avec mode édition |
| `TaskForm` | Formulaire d'ajout/modification |
| `PlannedTaskList` | Liste des tâches prévues |
| `Modal` | Confirmation de déverrouillage |

## Actions disponibles en mode édition

```mermaid
graph TB
    subgraph "Mode Édition"
        A[Ajouter tâche] --> B[TaskForm]
        C[Modifier tâche] --> B
        D[Supprimer tâche] --> E[Confirmation]
        F[Toggle completed] --> G[Update task]
        H[Modifier blockers] --> I[Textarea]
        J[Ajouter planned] --> K[PlannedTaskList]
        L[Supprimer planned] --> K
    end
```

## Icônes et états

| État | Icône | Description |
|------|-------|-------------|
| Validé | 🔒 Lock (vert) | Journée verrouillée |
| Non validé | 🔓 Unlock (orange) | Modifiable directement |
| Aujourd'hui | Ring bleu | Date actuelle |
| Avec entrée | ✅ Check | Journée avec données |

## Code exemple

```tsx
// Déverrouiller une journée
const handleUnlockAndEdit = async () => {
  await unlockDay(selectedEntry.id);
  setCurrentEntry(selectedEntry.id);
  setIsEditing(true);
};

// Rechercher
const results = entries.filter((entry) => {
  return entry.tasks.some(task => 
    task.description.toLowerCase().includes(query)
  );
});
```
