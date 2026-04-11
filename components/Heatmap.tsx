import { For, createMemo } from 'solid-js';

type HeatmapProps = {
  data: Record<string, number>;
  days: number;
  cellSize?: number;
};

type HeatmapCell = {
  date: string;
  count: number;
  dayOfWeek: number;
};

const INTENSITY_COLORS = [
  '#F3F4F6',
  '#FCA5A5',
  '#EF4444',
  '#DC2626',
  '#991B1B',
] as const;

const DAY_LABELS = ['Mon', '', 'Wed', '', 'Fri', '', ''] as const;

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const;

const getIntensityColor = (count: number): string => {
  if (count === 0) return INTENSITY_COLORS[0];
  if (count === 1) return INTENSITY_COLORS[1];
  if (count <= 3) return INTENSITY_COLORS[2];
  if (count <= 5) return INTENSITY_COLORS[3];
  return INTENSITY_COLORS[4];
};

const toDateKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const generateHeatmapGrid = (
  data: Record<string, number>,
  days: number,
): HeatmapCell[] => {
  const cells: HeatmapCell[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const key = toDateKey(date);
    cells.push({
      date: key,
      count: data[key] ?? 0,
      dayOfWeek: date.getDay(),
    });
  }

  return cells;
};

type MonthLabel = { label: string; column: number };
type YearLabel = { year: number; column: number };

export default function Heatmap(props: HeatmapProps) {
  const cellSize = () => props.cellSize ?? 12;
  const gap = 2;

  const grid = createMemo(() => generateHeatmapGrid(props.data, props.days));

  const toMonRow = (jsDay: number) => (jsDay === 0 ? 6 : jsDay - 1);

  const columns = createMemo(() => {
    const cells = grid();
    const cols: (HeatmapCell | null)[][] = [];
    let currentCol: (HeatmapCell | null)[] = Array(7).fill(null);

    const firstRow = cells.length > 0 ? toMonRow(cells[0].dayOfWeek) : 0;
    for (let r = 0; r < firstRow; r++) {
      currentCol[r] = null;
    }

    for (const cell of cells) {
      const row = toMonRow(cell.dayOfWeek);
      if (row === 0 && currentCol.some((c) => c !== null)) {
        cols.push(currentCol);
        currentCol = Array(7).fill(null);
      }
      currentCol[row] = cell;
    }

    if (currentCol.some((c) => c !== null)) {
      cols.push(currentCol);
    }

    return cols;
  });

  const monthLabels = createMemo(() => {
    const cols = columns();
    const labels: MonthLabel[] = [];
    let lastMonth = -1;

    for (let c = 0; c < cols.length; c++) {
      const firstCell = cols[c].find((cell) => cell !== null);
      if (firstCell) {
        const month = Number.parseInt(firstCell.date.split('-')[1], 10) - 1;
        if (month !== lastMonth) {
          labels.push({ label: MONTH_NAMES[month], column: c });
          lastMonth = month;
        }
      }
    }

    return labels;
  });

  const yearLabels = createMemo(() => {
    const cols = columns();
    const labels: YearLabel[] = [];
    let lastYear = -1;
    let yearsFound = 0;

    for (let c = 0; c < cols.length; c++) {
      const firstCell = cols[c].find((cell) => cell !== null);
      if (firstCell) {
        const year = Number.parseInt(firstCell.date.split('-')[0], 10);
        if (year !== lastYear) {
          yearsFound++;
          // Only emit the label if there is a genuine year boundary mid-grid
          // (i.e. this is not the very first column of the grid)
          if (c > 0) {
            labels.push({ year, column: c });
          }
          lastYear = year;
        }
      }
    }

    // Only return labels when the grid actually spans two different years
    return yearsFound > 1 ? labels : [];
  });

  const tooltipText = (cell: HeatmapCell) => {
    const count = cell.count;
    const label = count === 0 ? 'No tomates' : `${count} tomate${count !== 1 ? 's' : ''}`;
    return `${label} on ${cell.date}`;
  };

  const labelWidth = 24;

  return (
    <div class="w-full overflow-x-auto">
      {/* Month labels */}
      <div class="flex" style={{ "padding-left": `${labelWidth}px` }}>
        <For each={monthLabels()}>
          {(ml, i) => {
            const nextCol = () => {
              const labels = monthLabels();
              const idx = i();
              return idx < labels.length - 1 ? labels[idx + 1].column : columns().length;
            };
            const width = () => (nextCol() - ml.column) * (cellSize() + gap);
            return (
              <span
                class="text-[9px] text-gray-400 inline-block overflow-hidden"
                style={{ width: `${width()}px`, "min-width": `${width()}px` }}
              >
                {ml.label}
              </span>
            );
          }}
        </For>
      </div>

      {/* Year boundary labels (only rendered when grid spans two calendar years) */}
      {yearLabels().length > 0 && (
        <div class="relative" style={{ "padding-left": `${labelWidth}px`, height: "14px" }}>
          <For each={yearLabels()}>
            {(yl) => {
              const left = () => yl.column * (cellSize() + gap);
              return (
                <span
                  class="absolute text-[9px] font-semibold text-gray-500 leading-none"
                  style={{ left: `${left()}px` }}
                >
                  {yl.year}
                </span>
              );
            }}
          </For>
        </div>
      )}

      {/* Grid with day labels */}
      <div class="flex">
        {/* Day labels column */}
        <div
          class="flex flex-col flex-shrink-0"
          style={{
            width: `${labelWidth}px`,
            gap: `${gap}px`,
          }}
        >
          <For each={DAY_LABELS}>
            {(label) => (
              <span
                class="text-[9px] text-gray-400 leading-none flex items-center"
                style={{ height: `${cellSize()}px` }}
              >
                {label}
              </span>
            )}
          </For>
        </div>

        {/* Heatmap cells - CSS Grid: 7 rows, auto columns */}
        <div
          class="grid"
          style={{
            "grid-template-rows": `repeat(7, ${cellSize()}px)`,
            "grid-auto-flow": "column",
            "grid-auto-columns": `${cellSize()}px`,
            gap: `${gap}px`,
          }}
        >
          <For each={columns()}>
            {(col) => (
              <For each={col}>
                {(cell) =>
                  cell ? (
                    <div
                      class="rounded-sm"
                      style={{
                        width: `${cellSize()}px`,
                        height: `${cellSize()}px`,
                        "background-color": getIntensityColor(cell.count),
                      }}
                      title={tooltipText(cell)}
                    />
                  ) : (
                    <div
                      style={{
                        width: `${cellSize()}px`,
                        height: `${cellSize()}px`,
                      }}
                    />
                  )
                }
              </For>
            )}
          </For>
        </div>
      </div>
    </div>
  );
}
