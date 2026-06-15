'use client';

import * as React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Flame, Trophy, Zap, Target, TrendingUp } from 'lucide-react';
import { UserGamification, BADGES, BadgeType } from '@/types';
import { getExperienceProgress, calculateLevel } from '@/lib/calculations';

interface GamificationCardProps {
  gamification: UserGamification;
}

export function GamificationCard({ gamification }: GamificationCardProps) {
  const { current, required, percentage } = getExperienceProgress(
    gamification.experience
  );

  const earnedBadgeTypes = gamification.badges.map((b) => b.type);

  return (
    <div className="space-y-6">
      {/* Level & XP */}
      <Card variant="elevated">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between text-base">
            <span className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-warning" />
              Niveau {gamification.level}
            </span>
            <span className="text-sm font-normal text-muted">
              {gamification.experience} XP
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Progress value={percentage} variant="default" size="md" />
          <p className="mt-2 text-xs text-muted text-right">
            {current} / {required} XP pour le niveau {gamification.level + 1}
          </p>
        </CardContent>
      </Card>

      {/* Streak */}
      <Card variant="bordered">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-warning/10">
                <Flame className="h-6 w-6 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold">{gamification.streak}</p>
                <p className="text-sm text-muted">jours consécutifs</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted">Record</p>
              <p className="text-lg font-semibold">{gamification.longestStreak}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4">
        <Card variant="bordered">
          <CardContent className="py-4 text-center">
            <Target className="h-6 w-6 text-accent mx-auto mb-2" />
            <p className="text-2xl font-bold">{gamification.totalTasks}</p>
            <p className="text-xs text-muted">Tâches totales</p>
          </CardContent>
        </Card>
        <Card variant="bordered">
          <CardContent className="py-4 text-center">
            <TrendingUp className="h-6 w-6 text-success mx-auto mb-2" />
            <p className="text-2xl font-bold">
              {Math.floor(gamification.totalMinutes / 60)}h
            </p>
            <p className="text-xs text-muted">Heures totales</p>
          </CardContent>
        </Card>
      </div>

      {/* Badges */}
      <Card variant="bordered">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Zap className="h-5 w-5 text-accent" />
            Badges
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-3">
            {BADGES.map((badge) => {
              const isEarned = earnedBadgeTypes.includes(badge.type);
              return (
                <div
                  key={badge.type}
                  className={`flex flex-col items-center justify-center rounded-xl p-3 text-center transition-all ${
                    isEarned
                      ? 'bg-accent/10'
                      : 'bg-muted/10 opacity-40 grayscale'
                  }`}
                  title={badge.description}
                >
                  <span className="text-2xl mb-1">{badge.icon}</span>
                  <span className="text-xs font-medium line-clamp-1">
                    {badge.name}
                  </span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
