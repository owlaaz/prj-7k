import type { PlanInput } from "../planner/types";
import { formatM, bossName } from "../lib/format";

interface Props {
  input: PlanInput;
  disabled?: boolean;
  onChange: (input: PlanInput) => void;
}

export default function BossPanel({ input, disabled, onChange }: Props) {
  function updateBoss(idx: number, field: "hpRemaining" | "fullHp", rawVal: number) {
    const bosses = input.bosses.map((b, i) => (i === idx ? { ...b, [field]: rawVal } : b));
    onChange({ ...input, bosses });
  }

  function resetBoss(idx: number) {
    const bosses = input.bosses.map((b, i) =>
      i === idx ? { ...b, hpRemaining: b.fullHp } : b
    );
    onChange({ ...input, bosses });
  }

  function resetAll() {
    const bosses = input.bosses.map((b) => ({ ...b, hpRemaining: b.fullHp }));
    onChange({ ...input, bosses });
  }

  return (
    <div className="border rounded-lg mb-4 overflow-hidden">
      <div className="px-4 py-2 bg-gray-50 font-medium text-gray-700 flex items-center justify-between">
        <span>Boss Status (Mid-Event Recheck)</span>
        <button
          onClick={resetAll}
          disabled={disabled}
          className="text-xs text-blue-600 hover:underline disabled:opacity-50"
        >
          Reset all to Full
        </button>
      </div>
      <div className="divide-y">
        {input.bosses.map((boss, b) => {
          const done = boss.fullHp - boss.hpRemaining;
          const pct = boss.fullHp > 0 ? (done / boss.fullHp) * 100 : 0;
          const cleared = boss.hpRemaining <= 0;

          return (
            <div key={b} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="w-20 text-sm font-semibold text-gray-700">
                {bossName(b)}
                {cleared && (
                  <span className="ml-2 text-xs text-green-600 font-medium">(Cleared)</span>
                )}
              </div>

              {/* Full HP (display-only) */}
              <div className="flex items-center gap-1 text-sm text-gray-500">
                <span className="w-16">Full HP:</span>
                <span className="font-mono">{formatM(boss.fullHp)}</span>
              </div>

              {/* Remaining HP */}
              <label className="flex items-center gap-1 text-sm">
                <span className="text-gray-500 w-28">Remaining HP (M):</span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  disabled={disabled}
                  value={boss.hpRemaining / 1_000_000}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    if (!isNaN(v) && v >= 0) updateBoss(b, "hpRemaining", Math.round(v * 1_000_000));
                  }}
                  className="border rounded px-2 py-1 w-24 text-sm disabled:opacity-50"
                />
              </label>

              {/* Progress bar */}
              <div className="flex-1 min-w-[80px]">
                <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
                  <div
                    className="h-2 rounded-full bg-blue-500 transition-all"
                    style={{ width: `${Math.min(100, pct)}%` }}
                  />
                </div>
                <div className="text-xs text-gray-400 mt-0.5">
                  {formatM(done)} done
                </div>
              </div>

              <button
                onClick={() => resetBoss(b)}
                disabled={disabled}
                className="text-xs text-gray-500 hover:text-blue-600 hover:underline disabled:opacity-50"
              >
                Reset
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
