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

export default function Heatmap(props: HeatmapProps) {
  const cellSize = () => props.cellSize ?? 12;
  const gap = 2;

  const grid = createMemo(() => generateHeatmapGrid(props.data, props.days));

  const toMonRow = (jsDay: number) => (jsDay === 0 ? 6 : jsDay - 1);

  const today = toDateKey(new Date());

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

  const tooltipText = (cell: HeatmapCell) => {
    const count = cell.count;
    const label = count === 0 ? 'No tomates' : `${count} tomate${count !== 1 ? 's' : ''}`;
    return `${label} on ${cell.date}`;
  };

  const ariaLabel = (cell: HeatmapCell) => {
    const count = cell.count;
    return `${cell.date}: ${count} session${count !== 1 ? 's' : ''}`;
  };

  const labelWidth = 24;

  // Store refs to all real (non-null) cell elements as a 2D array [col][row]
  // so we can navigate between them with arrow keys.
  let cellRefs: (HTMLDivElement | null)[][] = [];

  const handleCellKeyDown = (
    e: KeyboardEvent,
    colIdx: number,
    rowIdx: number,
  ) => {
    if (e.key === 'Enter' || e.key === ' ') {
      // Cells have no click action beyond focus; prevent scroll on Space
      e.preventDefault();
      return;
    }

    let targetCol = colIdx;
    let targetRow = rowIdx;

    if (e.key === 'ArrowRight') {
      targetCol = colIdx + 1;
    } else if (e.key === 'ArrowLeft') {
      targetCol = colIdx - 1;
    } else if (e.key === 'ArrowDown') {
      targetRow = rowIdx + 1;
    } else if (e.key === 'ArrowUp') {
      targetRow = rowIdx - 1;
    } else {
      return;
    }

    e.preventDefault();

    const cols = cellRefs;
    // Clamp column
    if (targetCol < 0 || targetCol >= cols.length) return;
    // Clamp row within 0-6
    if (targetRow < 0 || targetRow > 6) return;

    // Find closest non-null cell in the target column/row direction
    const tryFocus = (c: number, r: number): boolean => {
      const ref = cols[c]?.[r];
      if (ref) {
        ref.focus();
        return true;
      }
      return false;
    };

    if (!tryFocus(targetCol, targetRow)) {
      // For left/right, try the same row index in adjacent columns
      // For up/down, try the same col index in adjacent rows
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        // Try scanning further in the same direction
        const direction = e.key === 'ArrowRight' ? 1 : -1;
        let c = targetCol;
        while (c >= 0 && c < cols.length) {
          if (tryFocus(c, targetRow)) return;
          c += direction;
        }
      } else {
        const direction = e.key === 'ArrowDown' ? 1 : -1;
        let r = targetRow;
        while (r >= 0 && r <= 6) {
          if (tryFocus(targetCol, r)) return;
          r += direction;
        }
      }
    }
  };

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

      {/* Grid with day labels */}
      <div class="flex">
        {/* Day labels column */}
        <div
          class="flex flex-col flex-shrink-0"
          style={{
            width: `${labelWidth}px`,
            gap: `${gap}px`,
          }}
          aria-hidden="true"
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

        {/* Heatmap cells — ARIA grid: role="grid" > role="row" > role="gridcell" */}
        {/*
          The visual layout uses CSS grid with grid-auto-flow: column (column-major),
          but ARIA grid requires row-major DOM order. We render 7 rows, each containing
          one cell per week-column, to satisfy the grid/row/gridcell hierarchy while
          keeping the same visual appearance via CSS grid placed on the outer wrapper.
        */}
        <div
          role="grid"
          aria-label="Session history heatmap"
          style={{
            display: 'grid',
            "grid-template-rows": `repeat(7, ${cellSize()}px)`,
            "grid-auto-flow": "column",
            "grid-auto-columns": `${cellSize()}px`,
            gap: `${gap}px`,
          }}
        >
          <For each={Array.from({ length: 7 }, (_, rowIdx) => rowIdx)}>
            {(rowIdx) => (
              <div
                role="row"
                style={{
                  display: 'contents',
                }}
              >
                <For each={columns()}>
                  {(col, colIdxFn) => {
                    const colIdx = colIdxFn();
                    const cell = col[rowIdx];
                    if (cell) {
                      return (
                        <div
                          role="gridcell"
                          class="rounded-sm"
                          style={{
                            width: `${cellSize()}px`,
                            height: `${cellSize()}px`,
                            "background-color": getIntensityColor(cell.count),
                            // Ensure explicit grid placement so column-major order is preserved
                            "grid-column": `${colIdx + 1}`,
                            "grid-row": `${rowIdx + 1}`,
                          }}
                          title={tooltipText(cell)}
                          aria-label={ariaLabel(cell)}
                          aria-current={cell.date === today ? 'date' : undefined}
                          tabIndex={0}
                          onKeyDown={(e) => handleCellKeyDown(e, colIdx, rowIdx)}
                          ref={(el) => {
                            if (!cellRefs[colIdx]) cellRefs[colIdx] = [];
                            cellRefs[colIdx][rowIdx] = el;
                          }}
                        />
                      );
                    }
                    return (
                      <div
                        role="gridcell"
                        aria-hidden="true"
                        style={{
                          width: `${cellSize()}px`,
                          height: `${cellSize()}px`,
                          "grid-column": `${colIdx + 1}`,
                          "grid-row": `${rowIdx + 1}`,
                        }}
                      />
                    );
                  }}
                </For>
              </div>
            )}
          </For>
        </div>
      </div>
    </div>
  );
}
