'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CheckCircle2, Flame, Trophy, PartyPopper } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface DayValidationProps {
  onValidate: () => void;
  isValidated: boolean;
  taskCount: number;
  totalMinutes: number;
  streak: number;
  isLoading?: boolean;
}

export function DayValidation({
  onValidate,
  isValidated,
  taskCount,
  totalMinutes,
  streak,
  isLoading = false,
}: DayValidationProps) {
  const [showCelebration, setShowCelebration] = React.useState(false);

  const handleValidate = () => {
    onValidate();
    setShowCelebration(true);
    setTimeout(() => setShowCelebration(false), 3000);
  };

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) return `${mins} min`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}min`;
  };

  if (isValidated) {
    return (
      <Card variant="bordered" className="border-success/50 bg-success/5">
        <CardContent className="flex items-center justify-center gap-3 py-6">
          <CheckCircle2 className="h-6 w-6 text-success" />
          <span className="text-lg font-medium text-success">
            Journée validée !
          </span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card variant="elevated" className="relative overflow-hidden">
      {/* Celebration animation */}
      <AnimatePresence>
        {showCelebration && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="absolute inset-0 flex items-center justify-center bg-success/10 backdrop-blur-sm z-10"
          >
            <div className="text-center">
              <PartyPopper className="h-12 w-12 text-success mx-auto mb-2" />
              <p className="text-lg font-semibold text-success">
                Bravo ! 🎉
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-warning" />
          Valider ma journée
        </CardTitle>
        <CardDescription>
          Finalisez votre journée pour l'ajouter à votre historique
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Summary */}
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="rounded-xl bg-muted/10 p-3">
            <p className="text-2xl font-bold">{taskCount}</p>
            <p className="text-xs text-muted">Tâches</p>
          </div>
          <div className="rounded-xl bg-muted/10 p-3">
            <p className="text-2xl font-bold">{formatTime(totalMinutes)}</p>
            <p className="text-xs text-muted">Travail</p>
          </div>
          <div className="rounded-xl bg-muted/10 p-3">
            <div className="flex items-center justify-center gap-1">
              <Flame className="h-5 w-5 text-warning" />
              <span className="text-2xl font-bold">{streak}</span>
            </div>
            <p className="text-xs text-muted">Streak</p>
          </div>
        </div>

        {/* Validate button */}
        <Button
          size="xl"
          variant="success"
          onClick={handleValidate}
          disabled={taskCount === 0 || isLoading}
          isLoading={isLoading}
          className="w-full"
        >
          <CheckCircle2 className="h-5 w-5" />
          Valider ma journée
        </Button>

        {taskCount === 0 && (
          <p className="text-center text-sm text-muted">
            Ajoutez au moins une tâche pour valider
          </p>
        )}
      </CardContent>
    </Card>
  );
}
