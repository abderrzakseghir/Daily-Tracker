# Rapports - Export PDF

## Description

La page **Rapports** permet de générer des documents PDF professionnels à partir de vos données. Idéal pour les points avec votre manager, les bilans mensuels ou votre rapport d'alternance.

## Fonctionnalités

- 📄 Génération PDF avec jsPDF
- 📅 Rapports journalier/hebdomadaire/mensuel
- 🗓️ Période personnalisée
- 📊 Statistiques incluses
- 🎨 Mise en page professionnelle

## Architecture

```mermaid
graph TB
    subgraph "Reports Page"
        A[Page Rapports] --> B[Header]
        A --> C[Config Card]
        A --> D[Preview Card]
        A --> E[Quick Reports]
        
        C --> C1[Type de rapport]
        C --> C2[Titre personnalisé]
        C --> C3[Dates custom]
        
        D --> D1[Stats résumé]
        D --> D2[Table preview]
        D --> D3[Bouton download]
        
        E --> E1[Journalier]
        E --> E2[Hebdomadaire]
        E --> E3[Mensuel]
    end
```

## Flux de génération PDF

```mermaid
sequenceDiagram
    participant U as Utilisateur
    participant R as Reports Page
    participant J as jsPDF
    participant B as Browser

    U->>R: Configure rapport
    R->>R: Filtre entries par période
    R->>R: Calcule statistiques
    R-->>U: Affiche preview

    U->>R: Clic "Télécharger PDF"
    R->>R: setIsGenerating(true)
    
    R->>J: import('jspdf')
    R->>J: import('jspdf-autotable')
    
    R->>J: new jsPDF()
    R->>J: doc.text(title)
    R->>J: doc.text(période)
    R->>J: doc.text(stats)
    R->>J: autoTable(data)
    
    J->>B: doc.save(filename.pdf)
    B-->>U: Téléchargement fichier
    
    R->>R: setIsGenerating(false)
```

## Types de rapports

```mermaid
graph LR
    subgraph "Périodes"
        A[Daily] --> |Aujourd'hui| D[1 jour]
        B[Weekly] --> |Lun - Dim| D2[7 jours]
        C[Monthly] --> |1er - 30/31| D3[~30 jours]
        E[Custom] --> |Dates libres| D4[N jours]
    end
```

## Structure du PDF généré

```mermaid
graph TB
    subgraph "Document PDF"
        A[Titre] --> B[Sous-titre période]
        B --> C[Auteur]
        C --> D[Section Résumé]
        D --> E[Tableau des tâches]
        
        D --> D1[Tâches réalisées]
        D --> D2[Temps total]
        D --> D3[Jours validés]
        
        E --> E1[Date]
        E --> E2[Catégorie]
        E --> E3[Tâche]
        E --> E4[Durée]
    end
```

## Calculs effectués

```mermaid
flowchart TB
    A[Entries filtrées] --> B{Pour chaque entry}
    B --> C[Compte tasks.length]
    B --> D[Somme des durées]
    B --> E[validated === true]
    
    C --> F[totalTasks]
    D --> G[totalMinutes]
    E --> H[validatedDays]
    
    F --> I[Preview Stats]
    G --> I
    H --> I
```

## Personnalisation

| Option | Description |
|--------|-------------|
| Type | daily, weekly, monthly, custom |
| Titre | Texte personnalisé optionnel |
| Date début | Pour période custom |
| Date fin | Pour période custom |

## Aperçu du tableau

| Date | Catégorie | Tâche | Durée |
|------|-----------|-------|-------|
| 15/06/2026 | Développement | Correction bug auth | 2h |
| 15/06/2026 | Réunion | Point équipe | 30min |
| 14/06/2026 | Support | Ticket client | 1h |

## Code exemple

```tsx
// Génération PDF
const handleGeneratePDF = async () => {
  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');

  const doc = new jsPDF();
  
  // Titre
  doc.setFontSize(20);
  doc.text('Rapport Daily Tracker', 20, 20);
  
  // Table
  autoTable(doc, {
    startY: 85,
    head: [['Date', 'Catégorie', 'Tâche', 'Durée']],
    body: tableData,
    theme: 'striped',
    headStyles: { fillColor: [59, 130, 246] },
  });

  doc.save('rapport.pdf');
};
```

## Cas d'usage

```mermaid
graph TB
    subgraph "Utilisations"
        A[Daily Scrum] --> A1[Rapport journalier]
        B[Point Manager] --> B1[Rapport hebdomadaire]
        C[Bilan mensuel] --> C1[Rapport mensuel]
        D[Rapport alternance] --> D1[Période custom]
        E[Entretien annuel] --> E1[Rapport année]
    end
```
