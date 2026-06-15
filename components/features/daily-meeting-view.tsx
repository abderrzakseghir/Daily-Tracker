'use client';

import * as React from 'react';
import { DailyEntry, CATEGORY_LABELS } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDate, formatTime } from '@/lib/utils';
import { calculateTotalMinutes } from '@/lib/calculations';
import { Presentation, ChevronRight, CheckCircle, Clock, AlertTriangle } from 'lucide-react';

interface DailyMeetingViewProps {
  todayEntry?: DailyEntry;
  yesterdayEntry?: DailyEntry;
}

export function DailyMeetingView({
  todayEntry,
  yesterdayEntry,
}: DailyMeetingViewProps) {
  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <Presentation className="h-12 w-12 text-accent mx-auto mb-3" />
        <h1 className="text-2xl font-bold">Mode Daily Meeting</h1>
        <p className="text-muted">{formatDate(new Date(), 'long')}</p>
      </div>

      {/* Yesterday */}
      <Card variant="bordered">
        <CardHeader>
          <CardTitle className="text-lg">
            <CheckCircle className="h-5 w-5 text-success inline mr-2" />
            Ce que j'ai fait hier
          </CardTitle>
          {yesterdayEntry && (
            <CardDescription>
              {yesterdayEntry.tasks.length} tâches • {formatTime(calculateTotalMinutes(yesterdayEntry.tasks))}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          {yesterdayEntry && yesterdayEntry.tasks.length > 0 ? (
            <ul className="space-y-3">
              {yesterdayEntry.tasks.map((task) => (
                <li key={task.id} className="flex items-start gap-3">
                  <ChevronRight className="h-5 w-5 text-accent shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">{task.description}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className="text-xs">
                        {CATEGORY_LABELS[task.category]}
                      </Badge>
                      <span className="text-xs text-muted flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {task.duration === 'custom'
                          ? `${task.customDuration} min`
                          : task.duration}
                      </span>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted text-center py-4">
              Aucune tâche enregistrée hier
            </p>
          )}
        </CardContent>
      </Card>

      {/* Today */}
      <Card variant="bordered">
        <CardHeader>
          <CardTitle className="text-lg">
            <Clock className="h-5 w-5 text-accent inline mr-2" />
            Ce que je vais faire aujourd'hui
          </CardTitle>
        </CardHeader>
        <CardContent>
          {todayEntry && todayEntry.plannedTasks.length > 0 ? (
            <ul className="space-y-3">
              {todayEntry.plannedTasks.map((task) => (
                <li key={task.id} className="flex items-start gap-3">
                  <ChevronRight className="h-5 w-5 text-accent shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">{task.description}</p>
                    <Badge variant="outline" className="text-xs mt-1">
                      {CATEGORY_LABELS[task.category]}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          ) : yesterdayEntry?.plannedTasks && yesterdayEntry.plannedTasks.length > 0 ? (
            <ul className="space-y-3">
              {yesterdayEntry.plannedTasks.map((task) => (
                <li key={task.id} className="flex items-start gap-3">
                  <ChevronRight className="h-5 w-5 text-accent shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium">{task.description}</p>
                    <Badge variant="outline" className="text-xs mt-1">
                      {CATEGORY_LABELS[task.category]}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted text-center py-4">
              Aucune tâche prévue
            </p>
          )}
        </CardContent>
      </Card>

      {/* Blockers */}
      <Card variant="bordered" className="border-warning/50 bg-warning/5">
        <CardHeader>
          <CardTitle className="text-lg">
            <AlertTriangle className="h-5 w-5 text-warning inline mr-2" />
            Blocages
          </CardTitle>
        </CardHeader>
        <CardContent>
          {todayEntry?.blockers || yesterdayEntry?.blockers ? (
            <p className="whitespace-pre-wrap">
              {todayEntry?.blockers || yesterdayEntry?.blockers}
            </p>
          ) : (
            <p className="text-muted text-center py-4">
              Aucun blocage signalé
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
