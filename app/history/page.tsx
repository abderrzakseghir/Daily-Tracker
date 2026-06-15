'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { AppLayout } from '@/components/layout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Modal } from '@/components/ui/modal';
import { CalendarView, TaskCard, TaskForm, PlannedTaskList } from '@/components/features';
import { DailyEntry, Task, CATEGORY_LABELS } from '@/types';
import { formatDate, formatTime } from '@/lib/utils';
import { calculateTotalMinutes } from '@/lib/calculations';
import { 
  Search, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  Tag, 
  Unlock,
  Lock,
  Pencil,
  Plus,
  AlertTriangle
} from 'lucide-react';

export default function HistoryPage() {
  const router = useRouter();
  const { 
    isAuthenticated,
    _hasHydrated,
    entries, 
    currentEntry,
    logout,
    setCurrentEntry,
    unlockDay,
    validateDay,
    addTask,
    updateTask,
    removeTask,
    addPlannedTask,
    removePlannedTask,
    updateEntry,
  } = useStore();
  
  const [selectedDate, setSelectedDate] = React.useState(new Date());
  const [searchQuery, setSearchQuery] = React.useState('');
  const [searchResults, setSearchResults] = React.useState<DailyEntry[]>([]);
  const [isSearching, setIsSearching] = React.useState(false);
  const [isEditing, setIsEditing] = React.useState(false);
  const [editingTask, setEditingTask] = React.useState<Task | null>(null);
  const [showUnlockModal, setShowUnlockModal] = React.useState(false);

  React.useEffect(() => {
    if (_hasHydrated && !isAuthenticated) {
      router.push('/');
    }
  }, [_hasHydrated, isAuthenticated, router]);

  const selectedDateStr = selectedDate.toISOString().split('T')[0];
  const selectedEntry = entries.find((e) => e.date === selectedDateStr);

  // When selecting a date, set it as current entry for editing
  React.useEffect(() => {
    if (selectedEntry && isEditing) {
      setCurrentEntry(selectedEntry.id);
    }
  }, [selectedEntry, isEditing, setCurrentEntry]);

  // Search functionality
  React.useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const query = searchQuery.toLowerCase();

    const results = entries.filter((entry) => {
      const taskMatch = entry.tasks.some(
        (task) =>
          task.description.toLowerCase().includes(query) ||
          CATEGORY_LABELS[task.category].toLowerCase().includes(query)
      );
      const plannedMatch = entry.plannedTasks.some(
        (task) =>
          task.description.toLowerCase().includes(query) ||
          CATEGORY_LABELS[task.category].toLowerCase().includes(query)
      );
      const blockerMatch = entry.blockers.toLowerCase().includes(query);
      return taskMatch || plannedMatch || blockerMatch;
    });

    setSearchResults(results);
  }, [searchQuery, entries]);

  const handleStartEditing = () => {
    if (selectedEntry?.validated) {
      setShowUnlockModal(true);
    } else if (selectedEntry) {
      setCurrentEntry(selectedEntry.id);
      setIsEditing(true);
    }
  };

  const handleUnlockAndEdit = async () => {
    if (selectedEntry) {
      await unlockDay(selectedEntry.id);
      setCurrentEntry(selectedEntry.id);
      setIsEditing(true);
      setShowUnlockModal(false);
    }
  };

  const handleStopEditing = () => {
    setIsEditing(false);
    setEditingTask(null);
  };

  const handleRevalidate = async () => {
    if (selectedEntry) {
      await validateDay(selectedEntry.id);
      setIsEditing(false);
    }
  };

  const handleToggleTask = (taskId: string) => {
    const task = currentEntry?.tasks.find(t => t.id === taskId);
    if (task) {
      updateTask(taskId, { completed: !task.completed });
    }
  };

  const handleEditTask = (task: Task) => {
    setEditingTask(task);
  };

  const handleUpdateTask = (data: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => {
    if (editingTask) {
      updateTask(editingTask.id, data);
      setEditingTask(null);
    }
  };

  const handleBlockersChange = (value: string) => {
    if (currentEntry) {
      updateEntry(currentEntry.id, { blockers: value });
    }
  };

  // Get the entry to display (either selected or current if editing)
  const displayEntry = isEditing && currentEntry ? currentEntry : selectedEntry;

  if (!_hasHydrated || !isAuthenticated) {
    return null;
  }

  return (
    <AppLayout onLogout={logout}>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">Historique</h1>
          <p className="text-muted">
            Consultez, recherchez et modifiez vos journées passées
          </p>
        </div>

        {/* Search */}
        <div className="relative">
          <Input
            placeholder="Rechercher par mot-clé (bug, API, réunion...)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            icon={<Search className="h-4 w-4" />}
          />
        </div>

        {/* Search Results */}
        {isSearching && (
          <Card variant="bordered">
            <CardHeader>
              <CardTitle className="text-base">
                Résultats de recherche ({searchResults.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {searchResults.length > 0 ? (
                <div className="space-y-4">
                  {searchResults.map((entry) => (
                    <div
                      key={entry.id}
                      className="border-b border-border pb-4 last:border-0 last:pb-0"
                    >
                      <button
                        onClick={() => {
                          setSelectedDate(new Date(entry.date));
                          setSearchQuery('');
                          setIsEditing(false);
                        }}
                        className="flex items-center justify-between w-full text-left hover:bg-muted/10 rounded-lg p-2 -m-2"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{formatDate(entry.date, 'long')}</p>
                            {entry.validated && (
                              <CheckCircle2 className="h-4 w-4 text-success" />
                            )}
                          </div>
                          <p className="text-sm text-muted">
                            {entry.tasks.length} tâches • {formatTime(calculateTotalMinutes(entry.tasks))}
                          </p>
                        </div>
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-center text-muted py-4">
                  Aucun résultat pour "{searchQuery}"
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Main Content */}
        {!isSearching && (
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Calendar */}
            <CalendarView
              entries={entries}
              selectedDate={selectedDate}
              onSelectDate={(date) => {
                setSelectedDate(date);
                setIsEditing(false);
                setEditingTask(null);
              }}
            />

            {/* Day Details */}
            <Card variant="bordered">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Calendar className="h-5 w-5 text-accent" />
                    {formatDate(selectedDate, 'long')}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    {displayEntry?.validated ? (
                      <Badge variant="success">
                        <Lock className="h-3 w-3" />
                        Validé
                      </Badge>
                    ) : displayEntry ? (
                      <Badge variant="warning">
                        <Unlock className="h-3 w-3" />
                        Non validé
                      </Badge>
                    ) : null}
                  </div>
                </div>
                {displayEntry && (
                  <div className="flex items-center gap-2 mt-2">
                    {!isEditing ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleStartEditing}
                      >
                        <Pencil className="h-4 w-4" />
                        Modifier
                      </Button>
                    ) : (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleStopEditing}
                        >
                          Terminer
                        </Button>
                        {!displayEntry.validated && (
                          <Button
                            variant="success"
                            size="sm"
                            onClick={handleRevalidate}
                          >
                            <Lock className="h-4 w-4" />
                            Valider
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                )}
              </CardHeader>
              <CardContent>
                {displayEntry ? (
                  <div className="space-y-6">
                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-center gap-3 rounded-xl bg-muted/10 p-3">
                        <Tag className="h-5 w-5 text-accent" />
                        <div>
                          <p className="text-lg font-bold">
                            {displayEntry.tasks.length}
                          </p>
                          <p className="text-xs text-muted">Tâches</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 rounded-xl bg-muted/10 p-3">
                        <Clock className="h-5 w-5 text-accent" />
                        <div>
                          <p className="text-lg font-bold">
                            {formatTime(calculateTotalMinutes(displayEntry.tasks))}
                          </p>
                          <p className="text-xs text-muted">Travail</p>
                        </div>
                      </div>
                    </div>

                    {/* Add Task Form (when editing) */}
                    {isEditing && (
                      <div className="border border-dashed border-border rounded-xl p-4">
                        <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                          <Plus className="h-4 w-4" />
                          Ajouter une tâche
                        </h4>
                        {editingTask ? (
                          <TaskForm
                            mode="edit"
                            initialTask={editingTask}
                            onSubmit={handleUpdateTask}
                            onCancel={() => setEditingTask(null)}
                          />
                        ) : (
                          <TaskForm onSubmit={addTask} />
                        )}
                      </div>
                    )}

                    {/* Tasks */}
                    {displayEntry.tasks.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium mb-3">
                          Tâches réalisées
                        </h4>
                        <div className="space-y-2">
                          {displayEntry.tasks.map((task) => (
                            <TaskCard
                              key={task.id}
                              task={task}
                              onToggle={isEditing ? handleToggleTask : undefined}
                              onEdit={isEditing ? handleEditTask : undefined}
                              onDelete={isEditing ? removeTask : undefined}
                              readonly={!isEditing}
                            />
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Planned Tasks */}
                    <div>
                      <h4 className="text-sm font-medium mb-3">
                        Tâches prévues
                      </h4>
                      {isEditing ? (
                        <PlannedTaskList
                          tasks={displayEntry.plannedTasks}
                          onAdd={addPlannedTask}
                          onRemove={removePlannedTask}
                        />
                      ) : displayEntry.plannedTasks.length > 0 ? (
                        <div className="space-y-2">
                          {displayEntry.plannedTasks.map((task) => (
                            <div
                              key={task.id}
                              className="flex items-center gap-2 text-sm text-muted"
                            >
                              <span>•</span>
                              <span>{task.description}</span>
                              <Badge variant="outline" className="text-xs">
                                {CATEGORY_LABELS[task.category]}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted">Aucune tâche prévue</p>
                      )}
                    </div>

                    {/* Blockers */}
                    <div>
                      <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-warning" />
                        Blocages
                      </h4>
                      {isEditing ? (
                        <Textarea
                          placeholder="Ex: Attente accès VPN, besoin validation métier..."
                          value={displayEntry.blockers}
                          onChange={(e) => handleBlockersChange(e.target.value)}
                          rows={3}
                        />
                      ) : displayEntry.blockers ? (
                        <p className="text-sm text-muted whitespace-pre-wrap">
                          {displayEntry.blockers}
                        </p>
                      ) : (
                        <p className="text-sm text-muted">Aucun blocage</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted">
                    <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>Aucune entrée pour ce jour</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Unlock Confirmation Modal */}
      <Modal
        isOpen={showUnlockModal}
        onClose={() => setShowUnlockModal(false)}
        title="Déverrouiller cette journée ?"
        description="Vous pourrez modifier les tâches, mais il faudra re-valider ensuite."
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 p-4 rounded-xl bg-warning/10 border border-warning/20">
            <AlertTriangle className="h-5 w-5 text-warning shrink-0" />
            <div className="text-sm">
              <p className="font-medium">Attention</p>
              <p className="text-muted mt-1">
                Cette journée est validée. En la déverrouillant, vous pourrez ajouter ou supprimer des tâches, 
                mais elle ne sera plus comptabilisée dans votre streak jusqu'à ce que vous la validiez à nouveau.
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowUnlockModal(false)}>
              Annuler
            </Button>
            <Button variant="warning" onClick={handleUnlockAndEdit}>
              <Unlock className="h-4 w-4" />
              Déverrouiller
            </Button>
          </div>
        </div>
      </Modal>
    </AppLayout>
  );
}
