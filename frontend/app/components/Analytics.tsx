"use client";
import useSWR from "swr";
import { useMemo } from "react";
import { Bar, Line, Pie } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const fetcher = (url: string) => fetch(url).then((r) => r.json());
const API =
  process.env.NEXT_PUBLIC_API_BASE ||
  (typeof window !== "undefined"
    ? `${window.location.protocol}//${window.location.hostname}:8000`
    : "");

type Timeseries = { date: string; morning_liters: number; evening_liters: number };
type Animal = {
  _id?: string;
  name?: string;
  node_name?: string;
  milk_yield_timeseries?: Timeseries[];
};

type PerAnimal = {
  animal_id: string;
  name?: string;
  avg_morning_liters: number;
  avg_evening_liters: number;
  avg_total_liters: number;
};

export function Analytics() {
  const { data: analyticsData } = useSWR<{ per_animal: PerAnimal[]; overall: any }>(
    `${API}/analytics/milk`,
    fetcher,
    { refreshInterval: 60000 }
  );
  const { data: animalsData } = useSWR<Animal[]>(`${API}/animals`, fetcher, { refreshInterval: 60000 });

  // Calculate statistics
  const stats = useMemo(() => {
    const perAnimal = analyticsData?.per_animal || [];
    const totalMorning = perAnimal.reduce((sum, a) => sum + a.avg_morning_liters, 0);
    const totalEvening = perAnimal.reduce((sum, a) => sum + a.avg_evening_liters, 0);
    const totalAvg = perAnimal.reduce((sum, a) => sum + a.avg_total_liters, 0);
    const avgPerAnimal = perAnimal.length > 0 ? totalAvg / perAnimal.length : 0;
    const topPerformer = perAnimal.length > 0
      ? perAnimal.reduce((top, a) => (a.avg_total_liters > top.avg_total_liters ? a : top), perAnimal[0])
      : null;

    return {
      totalAnimals: perAnimal.length,
      totalDailyAvg: totalAvg.toFixed(2),
      avgPerAnimal: avgPerAnimal.toFixed(2),
      totalMorning: totalMorning.toFixed(2),
      totalEvening: totalEvening.toFixed(2),
      topPerformer: topPerformer ? (topPerformer.name || topPerformer.animal_id.slice(0, 6)) : "N/A",
      topPerformerYield: topPerformer ? topPerformer.avg_total_liters.toFixed(2) : "0",
    };
  }, [analyticsData]);

  // Time series data - aggregate all animals by date
  const timeSeriesData = useMemo(() => {
    if (!animalsData) return null;

    const dateMap = new Map<string, { morning: number; evening: number; count: number }>();

    animalsData.forEach((animal) => {
      animal.milk_yield_timeseries?.forEach((entry) => {
        const dateKey = entry.date.slice(0, 10); // YYYY-MM-DD
        const existing = dateMap.get(dateKey) || { morning: 0, evening: 0, count: 0 };
        dateMap.set(dateKey, {
          morning: existing.morning + entry.morning_liters,
          evening: existing.evening + entry.evening_liters,
          count: existing.count + 1,
        });
      });
    });

    const sortedDates = Array.from(dateMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-30); // Last 30 days

    return {
      labels: sortedDates.map(([date]) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })),
      morning: sortedDates.map(([, data]) => data.morning),
      evening: sortedDates.map(([, data]) => data.evening),
      total: sortedDates.map(([, data]) => data.morning + data.evening),
    };
  }, [animalsData]);

  // Chart data
  const labels = (analyticsData?.per_animal || []).map((a) => a.name || a.animal_id.slice(0, 8));
  const morning = (analyticsData?.per_animal || []).map((a) => a.avg_morning_liters);
  const evening = (analyticsData?.per_animal || []).map((a) => a.avg_evening_liters);
  const total = (analyticsData?.per_animal || []).map((a) => a.avg_total_liters);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "top" as const, labels: { color: "#ffffff", usePointStyle: true } },
      tooltip: {
        backgroundColor: "rgba(0, 0, 0, 0.8)",
        titleColor: "#fff",
        bodyColor: "#fff",
        borderColor: "rgba(255, 255, 255, 0.1)",
        borderWidth: 1,
      },
    },
    scales: {
      x: {
        ticks: { color: "#ffffff", maxRotation: 45 },
        grid: { color: "rgba(255, 255, 255, 0.1)" },
      },
      y: {
        ticks: { color: "#ffffff" },
        beginAtZero: true,
        grid: { color: "rgba(255, 255, 255, 0.1)" },
      },
    },
  };

  const lineChartOptions = {
    ...chartOptions,
    plugins: {
      ...chartOptions.plugins,
      filler: {
        propagate: false,
      },
    },
    elements: {
      line: {
        tension: 0.4,
        fill: true,
      },
      point: {
        radius: 3,
        hoverRadius: 6,
      },
    },
  };

  return (
    <div className="mx-auto w-full max-w-7xl p-4 pb-[calc(96px+env(safe-area-inset-bottom))]">
      <div className="glass mb-4 rounded-2xl px-4 py-3">
        <h2 className="text-xl font-semibold">Milk Production Analytics</h2>
      </div>


      {/* Statistics Cards */}
      <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="glass rounded-2xl p-4">
          <div className="text-sm opacity-70">Total Daily Average</div>
          <div className="mt-1 text-2xl font-bold">{stats.totalDailyAvg}L</div>
          <div className="mt-1 text-xs opacity-60">Across all animals</div>
        </div>
        <div className="glass rounded-2xl p-4">
          <div className="text-sm opacity-70">Average per Animal</div>
          <div className="mt-1 text-2xl font-bold">{stats.avgPerAnimal}L</div>
          <div className="mt-1 text-xs opacity-60">{stats.totalAnimals} animals tracked</div>
        </div>
        <div className="glass rounded-2xl p-4">
          <div className="text-sm opacity-70">Top Performer</div>
          <div className="mt-1 text-2xl font-bold">{stats.topPerformer}</div>
          <div className="mt-1 text-xs opacity-60">{stats.topPerformerYield}L average</div>
        </div>
        <div className="glass rounded-2xl p-4">
          <div className="text-sm opacity-70">Daily Breakdown</div>
          <div className="mt-1 text-lg font-semibold">Morning: {stats.totalMorning}L</div>
          <div className="text-lg font-semibold">Evening: {stats.totalEvening}L</div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Time Series Line Chart */}
        <div className="glass rounded-2xl p-4">
          <h3 className="mb-4 text-lg font-semibold">Daily Milk Yield Trend (Last 30 Days)</h3>
          <div className="h-[300px]">
            {timeSeriesData ? (
              <Line
                data={{
                  labels: timeSeriesData.labels,
                  datasets: [
                    {
                      label: "Morning",
                      data: timeSeriesData.morning,
                      borderColor: "#60a5fa",
                      backgroundColor: "rgba(96, 165, 250, 0.1)",
                      fill: true,
                    },
                    {
                      label: "Evening",
                      data: timeSeriesData.evening,
                      borderColor: "#f59e0b",
                      backgroundColor: "rgba(245, 158, 11, 0.1)",
                      fill: true,
                    },
                    {
                      label: "Total Daily",
                      data: timeSeriesData.total,
                      borderColor: "#10b981",
                      backgroundColor: "rgba(16, 185, 129, 0.1)",
                      fill: true,
                    },
                  ],
                }}
                options={lineChartOptions}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm opacity-60">Loading time series data...</div>
            )}
          </div>
        </div>

        {/* Average Yield by Animal - Bar Chart */}
        <div className="glass rounded-2xl p-4">
          <h3 className="mb-4 text-lg font-semibold">Average Yield by Animal</h3>
          <div className="h-[300px]">
            {labels.length > 0 ? (
              <Bar
                data={{
                  labels,
                  datasets: [
                    { label: "Morning Avg", data: morning, backgroundColor: "#60a5fa" },
                    { label: "Evening Avg", data: evening, backgroundColor: "#f59e0b" },
                    { label: "Total Avg", data: total, backgroundColor: "#10b981" },
                  ],
                }}
                options={chartOptions}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm opacity-60">No data available</div>
            )}
          </div>
        </div>

        {/* Pie Chart - Animal Contribution */}
        <div className="glass rounded-2xl p-4">
          <h3 className="mb-4 text-lg font-semibold">Production Distribution</h3>
          <div className="h-[300px]">
            {total.length > 0 ? (
              <Pie
                data={{
                  labels,
                  datasets: [
                    {
                      data: total,
                      backgroundColor: [
                        "#60a5fa",
                        "#f59e0b",
                        "#10b981",
                        "#8b5cf6",
                        "#ec4899",
                        "#06b6d4",
                        "#84cc16",
                        "#f97316",
                      ].slice(0, total.length),
                      borderWidth: 2,
                      borderColor: "var(--background)",
                    },
                  ],
                }}
                options={{
                  ...chartOptions,
                  plugins: {
                    ...chartOptions.plugins,
                    legend: { position: "bottom" as const, labels: { color: "#ffffff", padding: 12 } },
                  },
                }}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm opacity-60">No data available</div>
            )}
          </div>
        </div>

        {/* Total Production Comparison */}
        <div className="glass rounded-2xl p-4">
          <h3 className="mb-4 text-lg font-semibold">Total Production Comparison</h3>
          <div className="h-[300px]">
            {labels.length > 0 ? (
              <Bar
                data={{
                  labels,
                  datasets: [
                    {
                      label: "Total Daily Average (Liters)",
                      data: total,
                      backgroundColor: total.map((_, i) => {
                        const colors = ["#60a5fa", "#f59e0b", "#10b981", "#8b5cf6", "#ec4899"];
                        return colors[i % colors.length];
                      }),
                      borderRadius: 8,
                    },
                  ],
                }}
                options={{
                  ...chartOptions,
                  indexAxis: "y" as const,
                  plugins: {
                    ...chartOptions.plugins,
                    legend: { display: false },
                  },
                }}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm opacity-60">No data available</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}



