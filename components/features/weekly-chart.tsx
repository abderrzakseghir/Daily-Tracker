'use client';

import * as React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DayStats } from '@/types';
import { BarChart3 } from 'lucide-react';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface WeeklyChartProps {
  dailyStats: DayStats[];
  title?: string;
}

const DAYS_FR = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

export function WeeklyChart({
  dailyStats,
  title = 'Productivité hebdomadaire',
}: WeeklyChartProps) {
  const labels = dailyStats.map((stat, i) => DAYS_FR[i] || stat.date);

  const data = {
    labels,
    datasets: [
      {
        label: 'Tâches',
        data: dailyStats.map((stat) => stat.taskCount),
        backgroundColor: 'rgba(59, 130, 246, 0.8)',
        borderRadius: 6,
        yAxisID: 'y',
      },
      {
        label: 'Heures',
        data: dailyStats.map((stat) => stat.totalMinutes / 60),
        backgroundColor: 'rgba(16, 185, 129, 0.8)',
        borderRadius: 6,
        yAxisID: 'y1',
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    plugins: {
      legend: {
        display: true,
        position: 'top' as const,
        labels: {
          usePointStyle: true,
          pointStyle: 'circle',
          padding: 20,
          font: {
            size: 11,
          },
        },
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        padding: 12,
        titleFont: { size: 13 },
        bodyFont: { size: 12 },
      },
    },
    scales: {
      x: {
        grid: {
          display: false,
        },
        ticks: {
          font: {
            size: 11,
          },
        },
      },
      y: {
        type: 'linear' as const,
        display: true,
        position: 'left' as const,
        grid: {
          color: 'rgba(0, 0, 0, 0.05)',
        },
        ticks: {
          stepSize: 1,
          font: {
            size: 11,
          },
        },
        title: {
          display: true,
          text: 'Tâches',
          font: {
            size: 11,
          },
        },
      },
      y1: {
        type: 'linear' as const,
        display: true,
        position: 'right' as const,
        grid: {
          drawOnChartArea: false,
        },
        ticks: {
          font: {
            size: 11,
          },
        },
        title: {
          display: true,
          text: 'Heures',
          font: {
            size: 11,
          },
        },
      },
    },
  };

  return (
    <Card variant="bordered">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <BarChart3 className="h-5 w-5 text-accent" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <Bar data={data} options={options} />
        </div>
      </CardContent>
    </Card>
  );
}
