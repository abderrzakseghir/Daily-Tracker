'use client';

import * as React from 'react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import { Category, CATEGORY_LABELS, CATEGORY_COLORS } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart } from 'lucide-react';

ChartJS.register(ArcElement, Tooltip, Legend);

interface CategoryChartProps {
  breakdown: Record<Category, number>;
  title?: string;
}

export function CategoryChart({
  breakdown,
  title = 'Répartition des activités',
}: CategoryChartProps) {
  const filteredData = Object.entries(breakdown)
    .filter(([_, value]) => value > 0)
    .map(([key, value]) => ({
      category: key as Category,
      minutes: value,
    }));

  if (filteredData.length === 0) {
    return (
      <Card variant="bordered">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <PieChart className="h-5 w-5 text-accent" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-40 items-center justify-center text-muted">
            Aucune donnée disponible
          </div>
        </CardContent>
      </Card>
    );
  }

  const data = {
    labels: filteredData.map((d) => CATEGORY_LABELS[d.category]),
    datasets: [
      {
        data: filteredData.map((d) => d.minutes),
        backgroundColor: filteredData.map((d) => CATEGORY_COLORS[d.category]),
        borderColor: 'transparent',
        borderWidth: 0,
        hoverOffset: 4,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '65%',
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        padding: 12,
        titleFont: { size: 13 },
        bodyFont: { size: 12 },
        callbacks: {
          label: (context: { raw: number }) => {
            const minutes = context.raw;
            const hours = Math.floor(minutes / 60);
            const mins = minutes % 60;
            return hours > 0 ? `${hours}h ${mins}min` : `${mins} min`;
          },
        },
      },
    },
  };

  const totalMinutes = filteredData.reduce((sum, d) => sum + d.minutes, 0);
  const hours = Math.floor(totalMinutes / 60);

  return (
    <Card variant="bordered">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <PieChart className="h-5 w-5 text-accent" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative h-48">
          <Doughnut data={data} options={options} />
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold">{hours}h</span>
            <span className="text-xs text-muted">total</span>
          </div>
        </div>

        {/* Legend */}
        <div className="mt-4 grid grid-cols-2 gap-2">
          {filteredData.map((d) => (
            <div key={d.category} className="flex items-center gap-2">
              <div
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: CATEGORY_COLORS[d.category] }}
              />
              <span className="text-xs text-muted truncate">
                {CATEGORY_LABELS[d.category]}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
