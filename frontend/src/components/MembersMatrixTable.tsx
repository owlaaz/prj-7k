import { useState, useCallback, useId } from "react";
import type { PlanInput, Member } from "../planner/types";
import { formatM, parseM, bossName } from "../lib/format";

const MAX_MEMBERS = 30;

interface Props {
  input: PlanInput;
  disabled?: boolean;
  onChange: (input: PlanInput) => void;
}

type CellMode = "totals" | "avg";

function newMember(numBosses: number, defaultRounds: number): Member {
  return {
    id: `m-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    name: "",
    roundsRemaining: defaultRounds,
    damageByBoss: Array(numBosses).fill(0),
    statsByBoss: Array(numBosses).fill(null),
  };
}

export default function MembersMatrixTable({ input, disabled, onChange }: Props) {
  const [cellMode, setCellMode] = useState<CellMode>("totals");
  const numBosses = input.config.numBosses;
  const members = input.members;

  // When locked, always show avg-only for a clean read-only view
  const effectiveMode: CellMode = disabled ? "avg" : cellMode;

  const uid = useId();

  function updateMember(idx: number, patch: Partial<Member>) {
    const next = members.map((m, i) => (i === idx ? { ...m, ...patch } : m));
    onChange({ ...input, members: next });
  }

  function updateStat(memberIdx: number, bossIdx: number, field: "totalDamage" | "totalRounds", raw: number) {
    const m = members[memberIdx];
    const stats = m.statsByBoss ? [...m.statsByBoss] : Array(numBosses).fill(null);
    const prev = stats[bossIdx] ?? { totalDamage: 0, totalRounds: 0 };
    const next = { ...prev, [field]: raw };
    stats[bossIdx] = next;
    // Derive avg
    const avg = next.totalRounds > 0 ? Math.round(next.totalDamage / next.totalRounds) : 0;
    const dmg = [...m.damageByBoss];
    dmg[bossIdx] = avg;
    updateMember(memberIdx, { statsByBoss: stats, damageByBoss: dmg });
  }

  function updateAvg(memberIdx: number, bossIdx: number, rawVal: number) {
    const m = members[memberIdx];
    const dmg = [...m.damageByBoss];
    dmg[bossIdx] = rawVal;
    updateMember(memberIdx, { damageByBoss: dmg });
  }

  function removeMember(idx: number) {
    onChange({ ...input, members: members.filter((_, i) => i !== idx) });
  }

  function addMember() {
    if (members.length >= MAX_MEMBERS) return;
    onChange({
      ...input,
      members: [...members, newMember(numBosses, input.config.maxRoundsPerMember)],
    });
  }

  function addThirtyRows() {
    const toAdd = Math.max(0, MAX_MEMBERS - members.length);
    if (toAdd === 0) return;
    const newOnes = Array.from({ length: toAdd }, () =>
      newMember(numBosses, input.config.maxRoundsPerMember)
    );
    onChange({ ...input, members: [...members, ...newOnes] });
  }

  function clearAll() {
    if (!confirm("Clear all members?")) return;
    onChange({ ...input, members: [] });
  }

  return (
    <div>
      {/* Toolbar — hidden when locked */}
      {!disabled && (
        <div className="flex flex-wrap gap-2 mb-3 items-center">
          <button
            disabled={members.length >= MAX_MEMBERS}
            onClick={addMember}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            + Add Member
          </button>
          <button
            disabled={members.length >= MAX_MEMBERS}
            onClick={addThirtyRows}
            className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50"
          >
            Add to 30
          </button>
          <button
            disabled={members.length === 0}
            onClick={clearAll}
            className="px-3 py-1.5 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50"
          >
            Clear All
          </button>
          <label className="flex items-center gap-1.5 text-sm text-gray-600 ml-auto">
            <input
              type="checkbox"
              checked={cellMode === "avg"}
              onChange={(e) => setCellMode(e.target.checked ? "avg" : "totals")}
            />
            Avg only mode
          </label>
        </div>
      )}

      {members.length === 0 && (
        <p className="text-sm text-gray-400 italic py-4 text-center">
          No members yet. Add some above or import a CSV.
        </p>
      )}

      {members.length > 0 && (
        <div className="overflow-x-auto rounded-lg border">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-3 py-2 text-left text-gray-500">#</th>
                <th className="px-3 py-2 text-left text-gray-500">Name</th>
                <th className="px-3 py-2 text-left text-gray-500 whitespace-nowrap">Rounds Left</th>
                {Array.from({ length: numBosses }, (_, b) => (
                  <th
                    key={b}
                    className="px-3 py-2 text-center text-gray-500 min-w-[120px] whitespace-nowrap"
                  >
                    {bossName(b)}
                  </th>
                ))}
                {!disabled && <th className="px-3 py-2" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {members.map((m, i) => {
                const allZero = m.damageByBoss.every((d) => !d);
                return (
                  <tr
                    key={m.id}
                    className={`hover:bg-gray-50 ${allZero ? "bg-yellow-50" : ""}`}
                  >
                    <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                    {/* Name */}
                    <td className="px-3 py-2">
                      {disabled ? (
                        <span className="text-gray-800 font-medium">{m.name || `Member ${i + 1}`}</span>
                      ) : (
                        <input
                          value={m.name}
                          placeholder={`Member ${i + 1}`}
                          onChange={(e) => updateMember(i, { name: e.target.value })}
                          className="border-b border-transparent hover:border-gray-300 focus:border-blue-400 bg-transparent outline-none w-28 py-0.5"
                        />
                      )}
                    </td>
                    {/* Rounds Left */}
                    <td className="px-3 py-2">
                      {disabled ? (
                        <span className="text-gray-700 font-mono">{m.roundsRemaining}</span>
                      ) : (
                        <input
                          type="number"
                          min={0}
                          max={input.config.maxRoundsPerMember}
                          value={m.roundsRemaining}
                          onChange={(e) => {
                            const v = parseInt(e.target.value, 10);
                            if (!isNaN(v) && v >= 0)
                              updateMember(i, { roundsRemaining: v });
                          }}
                          className="border rounded w-16 px-2 py-1 text-center"
                        />
                      )}
                    </td>
                    {/* Boss columns */}
                    {Array.from({ length: numBosses }, (_, b) => {
                      const stat = m.statsByBoss?.[b];
                      const avg = m.damageByBoss[b] ?? 0;

                      if (effectiveMode === "avg") {
                        return (
                          <td key={b} className="px-3 py-2 text-center">
                            {disabled ? (
                              <span className={`font-mono font-semibold ${avg > 0 ? "text-blue-700" : "text-gray-300"}`}>
                                {avg > 0 ? formatM(avg) : "—"}
                              </span>
                            ) : (
                              <input
                                type="number"
                                min={0}
                                step={0.1}
                                value={avg / 1_000_000}
                                onChange={(e) => {
                                  const v = parseFloat(e.target.value);
                                  updateAvg(i, b, isNaN(v) || v < 0 ? 0 : Math.round(v * 1_000_000));
                                }}
                                className="border rounded w-24 px-2 py-1 text-right text-xs"
                                placeholder="Avg (M)"
                              />
                            )}
                          </td>
                        );
                      }

                      // Totals mode (only reached when not locked)
                      const tdmg = stat?.totalDamage ?? 0;
                      const trnd = stat?.totalRounds ?? 0;
                      return (
                        <td key={b} className="px-2 py-1">
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-1">
                              <span className="text-gray-400 text-xs w-8">Dmg</span>
                              <input
                                type="number"
                                min={0}
                                step={0.1}
                                value={tdmg / 1_000_000}
                                onChange={(e) => {
                                  const v = parseFloat(e.target.value);
                                  updateStat(i, b, "totalDamage", isNaN(v) || v < 0 ? 0 : Math.round(v * 1_000_000));
                                }}
                                className="border rounded w-20 px-1 py-0.5 text-right text-xs"
                                placeholder="0 M"
                              />
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-gray-400 text-xs w-8">Rnd</span>
                              <input
                                type="number"
                                min={0}
                                value={trnd}
                                onChange={(e) => {
                                  const v = parseInt(e.target.value, 10);
                                  updateStat(i, b, "totalRounds", isNaN(v) || v < 0 ? 0 : v);
                                }}
                                className="border rounded w-20 px-1 py-0.5 text-right text-xs"
                                placeholder="0"
                              />
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-gray-400 text-xs w-8">Avg</span>
                              <span className="text-xs font-mono text-blue-700 w-20 text-right">
                                {avg > 0 ? formatM(avg) : "—"}
                              </span>
                            </div>
                          </div>
                        </td>
                      );
                    })}
                    {/* Remove — hidden when locked */}
                    {!disabled && (
                      <td className="px-3 py-2">
                        <button
                          onClick={() => removeMember(i)}
                          className="text-gray-400 hover:text-red-500 text-lg leading-none"
                          title="Remove member"
                        >
                          ×
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
