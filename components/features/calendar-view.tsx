'use client';

import * as React from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, isSameDay, getDay, startOfWeek, addMonths, subMonths } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DailyEntry } from '@/types';
import { cn } from '@/lib/utils';
import { Calendar, ChevronLeft, ChevronRight, CheckCircle2 } from 'lucide-react';

interface CalendarViewProps {
  entries: DailyEntry[];
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
}

export function CalendarView({
  entries,
  selectedDate,
  onSelectDate,
}: CalendarViewProps) {
  const [currentMonth, setCurrentMonth] = React.useState(new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
  
  const days = eachDayOfInterval({ start: startDate, end: monthEnd });

  // Ensure we have full weeks
  while (days.length < 35) {
    const lastDay = days[days.length - 1];
    days.push(new Date(lastDay.getFullYear(), lastDay.getMonth(), lastDay.getDate() + 1));
  }

  const getEntryForDate = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return entries.find((e) => e.date === dateStr);
  };

  const weekDays = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

  return (
    <Card variant="bordered">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Calendar className="h-5 w-5 text-accent" />
            Historique
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium min-w-[120px] text-center capitalize">
              {format(currentMonth, 'MMMM yyyy', { locale: fr })}
            </span>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Week days header */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {weekDays.map((day) => (
            <div
              key={day}
              className="text-center text-xs font-medium text-muted py-1"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1">
          {days.map((day, idx) => {
            const entry = getEntryForDate(day);
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const isSelected = isSameDay(day, selectedDate);
            const isTodayDate = isToday(day);

            return (
              <button
                key={idx}
                onClick={() => onSelectDate(day)}
                disabled={!isCurrentMonth}
                className={cn(
                  'relative flex h-10 items-center justify-center rounded-lg text-sm transition-all',
                  'hover:bg-muted/10',
                  !isCurrentMonth && 'text-muted/30 cursor-default',
                  isSelected && 'bg-accent text-white hover:bg-accent',
                  isTodayDate && !isSelected && 'ring-2 ring-accent ring-inset'
                )}
              >
                {format(day, 'd')}
                {entry?.validated && !isSelected && (
                  <CheckCircle2 className="absolute -top-0.5 -right-0.5 h-3 w-3 text-success" />
                )}
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-4 mt-4 text-xs text-muted">
          <div className="flex items-center gap-1">
            <div className="h-3 w-3 rounded ring-2 ring-accent" />
            <span>Aujourd'hui</span>
          </div>
          <div className="flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3 text-success" />
            <span>Validé</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
