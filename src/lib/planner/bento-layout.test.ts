import { describe, expect, it } from "vitest";
import {
  BENTO_TILE_DEFAULTS,
  bentoSpanClassName,
  bentoTileInput,
  orderDeviation,
  packBento,
} from "./bento-layout";

const title = bentoTileInput("title");
const schedule = bentoTileInput("schedule");
const faculty = bentoTileInput("faculty");
const description = bentoTileInput("description");
const credits = bentoTileInput("credits");
const seats = bentoTileInput("seats");
const attributes = bentoTileInput("attributes");

function rowWaste(placement: { span: number }[], columns = 3): number {
  let waste = 0;
  let space = columns;
  for (const tile of placement) {
    if (tile.span <= space) {
      space -= tile.span;
      if (space === 0) space = columns;
    } else {
      waste += space;
      space = columns - tile.span;
      if (space === 0) space = columns;
    }
  }
  if (space < columns) waste += space;
  return waste;
}

function placementIds(placement: { id: string }[]): string[] {
  return placement.map((t) => t.id);
}

describe("orderDeviation", () => {
  it("returns zero when placement matches preferred order", () => {
    const tiles = [title, schedule, seats, credits];
    const placement = [
      { id: "title", span: 2 },
      { id: "schedule", span: 1 },
      { id: "seats", span: 1 },
      { id: "credits", span: 2 },
    ];
    expect(orderDeviation(placement, tiles)).toBe(0);
  });

  it("counts inversions when stats are reversed", () => {
    const tiles = [title, seats, credits];
    const placement = [
      { id: "title", span: 3 },
      { id: "credits", span: 1 },
      { id: "seats", span: 2 },
    ];
    expect(orderDeviation(placement, tiles)).toBe(1);
  });
});

describe("packBento", () => {
  it("packs a typical section with zero wasted cells", () => {
    const tiles = [
      title,
      schedule,
      faculty,
      description,
      seats,
      credits,
      attributes,
    ];
    const packed = packBento(tiles, 3);
    expect(packed[0]?.id).toBe("title");
    expect(rowWaste(packed)).toBe(0);
    expect(packed).toHaveLength(tiles.length);
  });

  it("packs title and schedule on one row when possible", () => {
    const packed = packBento([title, schedule], 3);
    expect(packed.map((t) => t.span)).toEqual([2, 1]);
    expect(rowWaste(packed)).toBe(0);
    expect(placementIds(packed)).toEqual(["title", "schedule"]);
  });

  it("prefers seats before credits when both are present", () => {
    const packed = packBento([title, seats, credits], 3);
    expect(placementIds(packed)).toEqual(["title", "seats", "credits"]);
    expect(rowWaste(packed)).toBe(0);
  });

  it("places schedule before credits when both follow title", () => {
    const packed = packBento([title, credits, schedule], 3);
    expect(placementIds(packed)).toEqual(["title", "schedule", "credits"]);
    expect(rowWaste(packed)).toBe(0);
  });

  it("pins title to the first placement", () => {
    const packed = packBento([credits, seats, title, faculty], 3);
    expect(packed[0]?.id).toBe("title");
  });

  it("minimizes waste when perfect tiling is impossible", () => {
    const packed = packBento([credits], 3);
    expect(packed).toEqual([{ id: "credits", span: 2 }]);
    expect(rowWaste(packed)).toBe(1);
  });

  it("is deterministic for the same input", () => {
    const tiles = [title, schedule, description, seats, credits, attributes];
    const a = packBento(tiles, 3);
    const b = packBento(tiles, 3);
    expect(a).toEqual(b);
  });

  it("returns empty array for no tiles", () => {
    expect(packBento([], 3)).toEqual([]);
  });
});

describe("bentoSpanClassName", () => {
  it("maps span 1 to single column at sm and lg", () => {
    expect(bentoSpanClassName(1)).toBe("sm:col-span-1 lg:col-span-1");
  });

  it("maps span 2 to full sm row and half lg row", () => {
    expect(bentoSpanClassName(2)).toBe("sm:col-span-2 lg:col-span-2");
  });

  it("maps span 3 to full row at sm and lg", () => {
    expect(bentoSpanClassName(3)).toBe("sm:col-span-2 lg:col-span-3");
  });
});

describe("BENTO_TILE_DEFAULTS", () => {
  it("defines preferred order from title through attributes", () => {
    expect(BENTO_TILE_DEFAULTS.title.priority).toBe(0);
    expect(BENTO_TILE_DEFAULTS.schedule.priority).toBe(1);
    expect(BENTO_TILE_DEFAULTS.faculty.priority).toBe(2);
    expect(BENTO_TILE_DEFAULTS.description.priority).toBe(3);
    expect(BENTO_TILE_DEFAULTS.sectionInfo.priority).toBe(4);
    expect(BENTO_TILE_DEFAULTS.registration.priority).toBe(5);
    expect(BENTO_TILE_DEFAULTS.seats.priority).toBe(6);
    expect(BENTO_TILE_DEFAULTS.credits.priority).toBe(7);
    expect(BENTO_TILE_DEFAULTS.attributes.priority).toBe(8);
  });
});

describe("bentoTileInput", () => {
  it("uses shared defaults for schedule and description widths", () => {
    expect(bentoTileInput("schedule").sizes).toEqual([1, 2, 3]);
    expect(bentoTileInput("description").sizes).toEqual([1, 2, 3]);
    expect(bentoTileInput("schedule").priority).toBeLessThan(
      bentoTileInput("description").priority,
    );
  });
});
