import type { PlanInput } from "../planner/types";
import { formatM, parseM } from "./format";
import Papa from "papaparse";

export type ImportMode = "replace" | "merge";

export interface ImportResult {
  members: PlanInput["members"];
  warnings: string[];
  badCells: number;
}

/**
 * Export current member averages as CSV.
 * Columns: name,boss1,boss2,...bossN
 * Values use the M convention (§4.4).
 */
export function exportCsv(input: PlanInput, planName?: string): void {
  const numBosses = input.config.numBosses;
  const bossHeaders = Array.from({ length: numBosses }, (_, i) => `boss${i + 1}`);
  const rows: string[][] = [["name", ...bossHeaders]];

  for (const m of input.members) {
    const dmg = m.damageByBoss.slice(0, numBosses).map((d) => formatM(d ?? 0));
    rows.push([m.name, ...dmg]);
  }

  const csv = rows.map((r) => r.map(csvCell).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = planName ? `plan-${planName}.csv` : "plan.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function csvCell(v: string): string {
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

/**
 * Parse a CSV file and return member rows suitable for loading into the input grid.
 * Applies §7.7 import semantics: maps by header when available, pads/ignores extra cols,
 * loads bad cells as 0 and flags them, caps at MAX_MEMBERS.
 */
export function importCsv(
  csvText: string,
  numBosses: number,
  maxMembers: number,
  existingMembers: PlanInput["members"],
  mode: ImportMode
): ImportResult {
  const warnings: string[] = [];
  let badCells = 0;

  const parsed = Papa.parse<string[]>(csvText, {
    skipEmptyLines: true,
    header: false,
  });

  const rawRows = parsed.data as string[][];
  if (rawRows.length === 0) {
    return { members: existingMembers, warnings: ["CSV is empty"], badCells: 0 };
  }

  // Detect header row
  let dataRows = rawRows;
  let bossColIndices: number[] = [];
  let nameColIndex = 0;

  const firstRow = rawRows[0].map((c) => c.trim().toLowerCase());
  const hasHeader =
    firstRow.includes("name") || firstRow.some((c) => c.startsWith("boss"));

  if (hasHeader) {
    dataRows = rawRows.slice(1);
    nameColIndex = firstRow.indexOf("name");
    if (nameColIndex < 0) nameColIndex = 0;
    // Map boss columns by header
    for (let b = 0; b < numBosses; b++) {
      const idx = firstRow.indexOf(`boss${b + 1}`);
      bossColIndices.push(idx >= 0 ? idx : -1);
    }
    // Warn about missing columns
    const missing = bossColIndices.filter((i) => i < 0).length;
    if (missing > 0) warnings.push(`${missing} boss column(s) not found in header, padded with 0`);
  } else {
    // No header: map by position
    nameColIndex = 0;
    bossColIndices = Array.from({ length: numBosses }, (_, i) => i + 1);
    const maxCols = rawRows[0].length - 1;
    if (maxCols < numBosses) {
      warnings.push(`CSV has ${maxCols} damage column(s), expected ${numBosses}; missing columns padded with 0`);
    } else if (maxCols > numBosses) {
      warnings.push(`CSV has ${maxCols} damage column(s), expected ${numBosses}; extra columns ignored`);
    }
  }

  if (dataRows.length > maxMembers) {
    warnings.push(`CSV has ${dataRows.length} rows; only first ${maxMembers} imported`);
    dataRows = dataRows.slice(0, maxMembers);
  }

  const parsedMembers: PlanInput["members"] = dataRows.map((row, rowIdx) => {
    const name = (row[nameColIndex] ?? "").trim() || `Member ${rowIdx + 1}`;
    const damageByBoss: number[] = [];
    for (let b = 0; b < numBosses; b++) {
      const colIdx = bossColIndices[b];
      if (colIdx < 0 || colIdx >= row.length) {
        damageByBoss.push(0);
        continue;
      }
      const raw = row[colIdx].trim();
      if (raw === "" || raw === "-") {
        damageByBoss.push(0);
        continue;
      }
      const val = parseM(raw);
      if (isNaN(val)) {
        damageByBoss.push(0);
        badCells++;
      } else {
        damageByBoss.push(val);
      }
    }
    return {
      id: `csv-${Date.now()}-${rowIdx}`,
      name,
      roundsRemaining: 10,
      damageByBoss,
      statsByBoss: Array(numBosses).fill(null),
    };
  });

  if (mode === "replace") {
    return { members: parsedMembers, warnings, badCells };
  }

  // Merge by name: update existing, append new
  const merged = [...existingMembers];
  for (const pm of parsedMembers) {
    const existing = merged.find(
      (m) => m.name.trim().toLowerCase() === pm.name.trim().toLowerCase()
    );
    if (existing) {
      existing.damageByBoss = pm.damageByBoss;
      existing.statsByBoss = pm.statsByBoss;
    } else {
      if (merged.length < maxMembers) {
        merged.push(pm);
      } else {
        warnings.push(`${pm.name} skipped (roster full at ${maxMembers})`);
      }
    }
  }
  return { members: merged, warnings, badCells };
}
