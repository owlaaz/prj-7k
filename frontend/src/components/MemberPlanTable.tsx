import { useState } from "react";
import type { PerMemberResult } from "../planner/types";
import { formatM, bossName } from "../lib/format";

interface Props {
  members: PerMemberResult[];
}

type SortKey = "name" | "rounds" | "damage";

export default function MemberPlanTable({ members }: Props) {
  const [sort, setSort] = useState<SortKey>("rounds");
  const [asc, setAsc] = useState(false);
  const [search, setSearch] = useState("");

  function toggleSort(key: SortKey) {
    if (sort === key) setAsc((a) => !a);
    else { setSort(key); setAsc(false); }
  }

  const sorted = [...members]
    .filter((m) => m.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      let diff = 0;
      if (sort === "name") diff = a.name.localeCompare(b.name);
      else if (sort === "rounds") diff = a.totalRoundsUsed - b.totalRoundsUsed;
      else if (sort === "damage")
        diff =
          a.assignments.reduce((s, x) => s + x.damage, 0) -
          b.assignments.reduce((s, x) => s + x.damage, 0);
      return asc ? diff : -diff;
    });

  function arrow(key: SortKey) {
    if (sort !== key) return "";
    return asc ? " ▲" : " ▼";
  }

  return (
    <div>
      <div className="mb-2">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search members…"
          className="border rounded px-3 py-1.5 text-sm w-full max-w-xs"
        />
      </div>
      <div className="overflow-x-auto rounded-lg border">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th
                className="px-3 py-2 text-left cursor-pointer select-none hover:text-blue-600"
                onClick={() => toggleSort("name")}
              >
                Member{arrow("name")}
              </th>
              <th
                className="px-3 py-2 text-right cursor-pointer select-none hover:text-blue-600 whitespace-nowrap"
                onClick={() => toggleSort("rounds")}
              >
                Rounds Used{arrow("rounds")}
              </th>
              <th className="px-3 py-2 text-right text-gray-500 whitespace-nowrap">Rounds Free</th>
              <th className="px-3 py-2 text-left text-gray-500">Assignments</th>
              <th
                className="px-3 py-2 text-right cursor-pointer select-none hover:text-blue-600 whitespace-nowrap"
                onClick={() => toggleSort("damage")}
              >
                Total Damage{arrow("damage")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sorted.map((m) => {
              const totalDmg = m.assignments.reduce((s, x) => s + x.damage, 0);
              const assignStr = m.assignments
                .map((a) => `${bossName(a.bossIndex)} ×${a.rounds}`)
                .join(", ");
              return (
                <tr key={m.memberId} className="hover:bg-gray-50">
                  <td className="px-3 py-2 font-medium text-gray-800">
                    {m.name || m.memberId}
                  </td>
                  <td className="px-3 py-2 text-right text-gray-700">
                    {m.totalRoundsUsed}
                  </td>
                  <td className="px-3 py-2 text-right text-gray-500">
                    {m.roundsRemaining}
                  </td>
                  <td className="px-3 py-2 text-gray-600 text-xs">{assignStr}</td>
                  <td className="px-3 py-2 text-right font-mono text-blue-700">
                    {formatM(totalDmg)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
