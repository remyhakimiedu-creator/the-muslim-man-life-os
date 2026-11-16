import {
  CategoryScale,
  Chart as ChartJS,
  Filler,
  LineElement,
  LinearScale,
  PointElement,
  RadialLinearScale,
  Tooltip,
} from 'chart.js';
import { Line, Radar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, RadialLinearScale, PointElement, LineElement, Filler, Tooltip);
ChartJS.defaults.color = '#98989F';
ChartJS.defaults.borderColor = 'rgba(255,255,255,0.08)';
ChartJS.defaults.font.family =
  '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", system-ui, sans-serif';
ChartJS.defaults.font.size = 11;

const BLUE = '#0A84FF';
const EMERALD = '#10B981';

const tooltip = {
  backgroundColor: 'rgba(28,28,30,0.96)',
  borderColor: 'rgba(255,255,255,0.12)',
  borderWidth: 1,
  titleColor: '#F5F5F0',
  bodyColor: '#F5F5F0',
  padding: 10,
  cornerRadius: 10,
  boxPadding: 4,
  usePointStyle: true,
};

/**
 * Weekly training volume (left axis) against the estimated 1RM of one lift
 * (right axis). The final point is the week in progress, so it is drawn dashed.
 */
export function OverloadChart({ series, exerciseName, partialLast = false }) {
  const last = partialLast ? series.length - 1 : -1;
  const dashed = (ctx) => (ctx.p1DataIndex === last ? [5, 4] : undefined);

  const data = {
    labels: series.map((w, i) => (i === last ? 'This wk' : w.label)),
    datasets: [
      {
        label: 'Weekly volume',
        data: series.map((w) => w.volume),
        yAxisID: 'y',
        borderColor: BLUE,
        backgroundColor: 'rgba(10,132,255,0.14)',
        pointBackgroundColor: BLUE,
        fill: true,
        tension: 0.35,
        borderWidth: 2,
        pointRadius: 3,
        pointHoverRadius: 5,
        segment: { borderDash: dashed },
      },
      {
        label: `Est. 1RM · ${exerciseName}`,
        data: series.map((w) => w.e1rm),
        yAxisID: 'y1',
        borderColor: EMERALD,
        backgroundColor: EMERALD,
        pointBackgroundColor: EMERALD,
        tension: 0.35,
        borderWidth: 2,
        pointRadius: 3,
        pointHoverRadius: 5,
        spanGaps: true,
        segment: { borderDash: dashed },
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 500 },
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { display: false },
      tooltip: {
        ...tooltip,
        callbacks: {
          label: (ctx) =>
            ctx.parsed.y == null ? null : `${ctx.dataset.label}: ${ctx.parsed.y.toLocaleString('en-MY')} kg`,
        },
      },
    },
    scales: {
      x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkipPadding: 8 } },
      y: {
        position: 'left',
        beginAtZero: true,
        ticks: { maxTicksLimit: 5, color: BLUE, callback: (v) => (v >= 1000 ? `${v / 1000}k` : v) },
      },
      y1: {
        position: 'right',
        grace: '15%',
        grid: { drawOnChartArea: false },
        ticks: { maxTicksLimit: 5, color: EMERALD },
      },
    },
  };

  return (
    <div className="h-[210px]">
      <Line
        data={data}
        options={options}
        role="img"
        aria-label={`Line chart of weekly training volume and estimated one-rep max for ${exerciseName}`}
      />
    </div>
  );
}

/** Working sets per week for each muscle group, against a 10-set reference ring. */
export function BalanceRadar({ balance, guide = 10 }) {
  const data = {
    labels: balance.map((b) => b.group),
    datasets: [
      {
        label: 'Sets per week',
        data: balance.map((b) => b.setsPerWeek),
        borderColor: EMERALD,
        backgroundColor: 'rgba(16,185,129,0.22)',
        pointBackgroundColor: EMERALD,
        borderWidth: 2,
        pointRadius: 3,
      },
      {
        label: 'Guide',
        data: balance.map(() => guide),
        borderColor: 'rgba(212,175,55,0.7)',
        backgroundColor: 'transparent',
        borderDash: [4, 4],
        borderWidth: 1.5,
        pointRadius: 0,
        pointHitRadius: 0,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 500 },
    plugins: {
      legend: { display: false },
      tooltip: {
        ...tooltip,
        filter: (item) => item.datasetIndex === 0,
        callbacks: { label: (ctx) => `${ctx.parsed.r} sets / week` },
      },
    },
    scales: {
      r: {
        beginAtZero: true,
        angleLines: { color: 'rgba(255,255,255,0.1)' },
        grid: { color: 'rgba(255,255,255,0.1)' },
        pointLabels: { color: '#F5F5F0', font: { size: 11, weight: 600 } },
        ticks: { backdropColor: 'transparent', color: '#98989F', maxTicksLimit: 4, font: { size: 10 } },
      },
    },
  };

  return (
    <div className="h-[250px]">
      <Radar
        data={data}
        options={options}
        role="img"
        aria-label={`Radar chart of weekly sets: ${balance.map((b) => `${b.group} ${b.setsPerWeek}`).join(', ')}`}
      />
    </div>
  );
}
