export type BentoTileId =
  | "title"
  | "schedule"
  | "faculty"
  | "description"
  | "sectionInfo"
  | "registration"
  | "seats"
  | "credits"
  | "attributes";

type BentoTileInput = {
  id: string;
  sizes: readonly number[];
  priority: number;
};

export const BENTO_TILE_DEFAULTS: Record<
  BentoTileId,
  { sizes: readonly number[]; priority: number }
> = {
  title: { sizes: [2, 3], priority: 0 },
  schedule: { sizes: [1, 2, 3], priority: 1 },
  faculty: { sizes: [1, 2], priority: 2 },
  seats: { sizes: [1, 2], priority: 3 },
  description: { sizes: [2, 3], priority: 4 },
  sectionInfo: { sizes: [2, 3], priority: 5 },
  registration: { sizes: [1, 2], priority: 6 },
  credits: { sizes: [1, 2], priority: 7 },
  attributes: { sizes: [1, 2], priority: 8 },
};

export function bentoTileInput(id: BentoTileId): BentoTileInput {
  const defaults = BENTO_TILE_DEFAULTS[id];
  return { id, sizes: defaults.sizes, priority: defaults.priority };
}

type PackedBentoTile = {
  id: string;
  span: number;
};

type LayoutCandidate = {
  placement: PackedBentoTile[];
  waste: number;
  rows: number;
  orderDeviation: number;
  sizeSum: number;
};

function countRows(placement: PackedBentoTile[], columns: number): number {
  let rows = 0;
  let space = columns;
  for (const tile of placement) {
    if (tile.span <= space) {
      space -= tile.span;
      if (space === 0) {
        rows++;
        space = columns;
      }
      continue;
    }
    if (space < columns) rows++;
    space = columns - tile.span;
    if (space === 0) {
      rows++;
      space = columns;
    }
  }
  if (space < columns) rows++;
  return rows;
}

function priorityKey(
  placement: PackedBentoTile[],
  tiles: BentoTileInput[],
): number[] {
  const byId = new Map(tiles.map((t) => [t.id, t.priority]));
  return placement.map((p) => byId.get(p.id) ?? Number.MAX_SAFE_INTEGER);
}

function comparePriorityKeys(a: number[], b: number[]): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const av = a[i] ?? Number.MAX_SAFE_INTEGER;
    const bv = b[i] ?? Number.MAX_SAFE_INTEGER;
    if (av !== bv) return av - bv;
  }
  return 0;
}

/** Count pairs out of preferred priority order in the packed sequence. */
export function orderDeviation(
  placement: PackedBentoTile[],
  tiles: BentoTileInput[],
): number {
  const preferredOrder = [...tiles]
    .sort((a, b) => a.priority - b.priority)
    .map((t) => t.id);
  const position = new Map(placement.map((p, index) => [p.id, index]));
  let inversions = 0;
  for (let i = 0; i < preferredOrder.length; i++) {
    for (let j = i + 1; j < preferredOrder.length; j++) {
      const earlier = position.get(preferredOrder[i]!);
      const later = position.get(preferredOrder[j]!);
      if (earlier != null && later != null && earlier > later) inversions++;
    }
  }
  return inversions;
}

function isBetterCandidate(
  next: LayoutCandidate,
  best: LayoutCandidate | null,
  tiles: BentoTileInput[],
): boolean {
  if (!best) return true;
  if (next.waste !== best.waste) return next.waste < best.waste;
  if (next.rows !== best.rows) return next.rows < best.rows;
  if (next.orderDeviation !== best.orderDeviation) {
    return next.orderDeviation < best.orderDeviation;
  }
  if (next.sizeSum !== best.sizeSum) return next.sizeSum > best.sizeSum;
  return (
    comparePriorityKeys(
      priorityKey(next.placement, tiles),
      priorityKey(best.placement, tiles),
    ) < 0
  );
}

/**
 * Pack bento tiles into rows of `columns` width, minimizing empty cells.
 * Prefers preferred reading order, then larger tile sizes when still tied.
 */
export function packBento(
  tiles: BentoTileInput[],
  columns = 3,
): PackedBentoTile[] {
  if (tiles.length === 0) return [];

  const hasTitle = tiles.some((t) => t.id === "title");
  let bestPlacement: PackedBentoTile[] | null = null;
  let bestCandidate: LayoutCandidate | null = null;

  function search(
    remaining: BentoTileInput[],
    placement: PackedBentoTile[],
    spaceInRow: number,
    waste: number,
    sizeSum: number,
    isFirstRow: boolean,
  ): void {
    if (remaining.length === 0) {
      const candidate: LayoutCandidate = {
        placement,
        waste: waste + spaceInRow,
        rows: countRows(placement, columns),
        orderDeviation: orderDeviation(placement, tiles),
        sizeSum,
      };
      if (isBetterCandidate(candidate, bestCandidate, tiles)) {
        bestCandidate = candidate;
        bestPlacement = candidate.placement;
      }
      return;
    }

    let candidates = remaining;
    if (isFirstRow && hasTitle) {
      const title = remaining.find((t) => t.id === "title");
      if (title) candidates = [title];
    }

    const sorted = [...candidates].sort((a, b) => a.priority - b.priority);

    for (const tile of sorted) {
      const sizes = [...tile.sizes].sort((a, b) => b - a);
      for (const span of sizes) {
        const nextRemaining = remaining.filter((t) => t.id !== tile.id);
        const nextPlacement = [...placement, { id: tile.id, span }];

        if (span <= spaceInRow) {
          search(
            nextRemaining,
            nextPlacement,
            spaceInRow - span,
            waste,
            sizeSum + span,
            false,
          );
        } else {
          search(
            nextRemaining,
            nextPlacement,
            columns - span,
            waste + spaceInRow,
            sizeSum + span,
            false,
          );
        }
      }
    }
  }

  search(tiles, [], columns, 0, 0, true);

  if (bestPlacement) return bestPlacement;

  return tiles.map((t) => ({
    id: t.id,
    span: t.sizes[t.sizes.length - 1] ?? 1,
  }));
}

/** Tailwind grid span classes for packed bento tiles. */
export function bentoSpanClassName(span: number): string {
  const smSpan = span >= 2 ? 2 : 1;
  const parts = [smSpan === 2 ? "sm:col-span-2" : "sm:col-span-1"];
  if (span === 1) parts.push("lg:col-span-1");
  else if (span === 2) parts.push("lg:col-span-2");
  else if (span >= 3) parts.push("lg:col-span-3");
  return parts.join(" ");
}
