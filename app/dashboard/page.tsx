'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useStore } from '@/lib/store';
import { AppLayout } from '@/components/layout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { TaskCard, TaskForm, PlannedTaskList, DayValidation, CategoryChart, GamificationCard } from '@/components/features';
import { Task, Category } from '@/types';
import { formatDate, formatRelativeDate, formatTime } from '@/lib/utils';
import { calculateTotalMinutes, calculateCategoryBreakdown, generateLocalSummary } from '@/lib/calculations';
import { Sparkles, ListTodo, CalendarCheck, AlertTriangle, Flame } from 'lucide-react';

export default function DashboardPage() {
  const router = useRouter();
  const {
    user,
    isAuthenticated,
    _hasHydrated,
    currentEntry,
    entries,
    logout,
    loadEntries,
    addTask,
    updateTask,
    removeTask,
    addPlannedTask,
    removePlannedTask,
    updateEntry,
    validateDay,
  } = useStore();

  const [editingTask, setEditingTask] = React.useState<Task | null>(null);

  React.useEffect(() => {
    if (!_hasHydrated) return;
    if (!isAuthenticated) {
      router.push('/');
      return;
    }
    loadEntries();
  }, [_hasHydrated, isAuthenticated, router, loadEntries]);

  if (!_hasHydrated) return null;
  if (!isAuthenticated || !user || !currentEntry) {
    return null;
  }

  const totalMinutes = calculateTotalMinutes(currentEntry.tasks);
  const categoryBreakdown = calculateCategoryBreakdown(currentEntry.tasks);

  // Get last 7 days entries for summary
  const recentEntries = entries.filter(e => {
    const entryDate = new Date(e.date);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return entryDate >= weekAgo;
  });

  const weekSummary = generateLocalSummary(recentEntries);

  const handleToggleTask = (taskId: string) => {
    const task = currentEntry.tasks.find(t => t.id === taskId);
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
    updateEntry(currentEntry.id, { blockers: value });
  };

  return (
    <AppLayout onLogout={logout}>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">
            Bonjour, {user.name} 👋
          </h1>
          <p className="text-muted">
            {formatDate(new Date(), 'long')}
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card variant="bordered" className="text-center">
            <CardContent className="py-4">
              <ListTodo className="h-6 w-6 text-accent mx-auto mb-2" />
              <p className="text-2xl font-bold">{currentEntry.tasks.length}</p>
              <p className="text-xs text-muted">Tâches</p>
            </CardContent>
          </Card>
          <Card variant="bordered" className="text-center">
            <CardContent className="py-4">
              <CalendarCheck className="h-6 w-6 text-success mx-auto mb-2" />
              <p className="text-2xl font-bold">{formatTime(totalMinutes)}</p>
              <p className="text-xs text-muted">Travail</p>
            </CardContent>
          </Card>
          <Card variant="bordered" className="text-center">
            <CardContent className="py-4">
              <Flame className="h-6 w-6 text-warning mx-auto mb-2" />
              <p className="text-2xl font-bold">{user.gamification.streak}</p>
              <p className="text-xs text-muted">Streak</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Grid */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left Column - Tasks */}
          <div className="lg:col-span-2 space-y-6">
            {/* Today's Tasks */}
            <Card variant="bordered">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ListTodo className="h-5 w-5 text-accent" />
                  Ce que j'ai fait aujourd'hui
                </CardTitle>
                <CardDescription>
                  {currentEntry.tasks.length === 0
                    ? "Ajoutez votre première tâche"
                    : `${currentEntry.tasks.filter(t => t.completed).length}/${currentEntry.tasks.length} tâches complétées`}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Task Form */}
                {!currentEntry.validated && (
                  <div className="border-b border-border pb-4">
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

                {/* Task List */}
                {currentEntry.tasks.length > 0 ? (
                  <div className="space-y-3">
                    {currentEntry.tasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        onToggle={handleToggleTask}
                        onEdit={handleEditTask}
                        onDelete={removeTask}
                        readonly={currentEntry.validated}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted">
                    <ListTodo className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>Aucune tâche pour le moment</p>
                    <p className="text-sm">Commencez à ajouter ce que vous avez fait</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Planned Tasks */}
            <Card variant="bordered">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarCheck className="h-5 w-5 text-accent" />
                  Ce que je ferai demain
                </CardTitle>
              </CardHeader>
              <CardContent>
                <PlannedTaskList
                  tasks={currentEntry.plannedTasks}
                  onAdd={addPlannedTask}
                  onRemove={removePlannedTask}
                  readonly={currentEntry.validated}
                />
              </CardContent>
            </Card>

            {/* Blockers */}
            <Card variant="bordered" className="border-warning/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-warning" />
                  Blocages rencontrés
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  placeholder="Ex: Attente accès VPN, besoin validation métier..."
                  value={currentEntry.blockers}
                  onChange={(e) => handleBlockersChange(e.target.value)}
                  disabled={currentEntry.validated}
                  rows={3}
                />
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Stats & Validation */}
          <div className="space-y-6">
            {/* Validation */}
            <DayValidation
              onValidate={() => validateDay(currentEntry.id)}
              isValidated={currentEntry.validated}
              taskCount={currentEntry.tasks.length}
              totalMinutes={totalMinutes}
              streak={user.gamification.streak}
            />

            {/* Category Breakdown */}
            {currentEntry.tasks.length > 0 && (
              <CategoryChart breakdown={categoryBreakdown} />
            )}

            {/* Weekly Summary */}
            <Card variant="bordered">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Sparkles className="h-5 w-5 text-accent" />
                  Résumé IA
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted leading-relaxed">
                  {weekSummary}
                </p>
              </CardContent>
            </Card>

            {/* Gamification Preview */}
            <GamificationCard gamification={user.gamification} />
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
