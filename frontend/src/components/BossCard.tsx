import type { PerBossResult } from "../planner/types";
import { formatM, bossName } from "../lib/format";

interface Props {
  result: PerBossResult;
}

export default function BossCard({ result }: Props) {
  const pct = result.hp > 0 ? Math.min(100, (result.damageDealt / result.hp) * 100) : 100;
  const overkillPct =
    result.hp > 0
      ? Math.min(20, (result.overkill / result.hp) * 100)
      : 0;

  return (
    <div className="border rounded-xl p-4 bg-white shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-gray-800">{bossName(result.bossIndex)}</h3>
        <span className="text-xs text-gray-400">{result.roundsUsed} round(s)</span>
      </div>

      {/* Progress bar */}
      <div className="h-3 rounded-full bg-gray-100 overflow-hidden mb-2 relative">
        <div
          className="h-3 rounded-l-full bg-blue-500 absolute left-0"
          style={{ width: `${Math.min(100, pct - overkillPct)}%` }}
        />
        {overkillPct > 0 && (
          <div
            className="h-3 bg-orange-400 absolute"
            style={{
              left: `${Math.min(100, pct - overkillPct)}%`,
              width: `${overkillPct}%`,
            }}
          />
        )}
        <div className="h-3 w-0.5 bg-red-500 absolute" style={{ left: "100%" }} />
      </div>

      <div className="text-xs text-gray-500 mb-3 flex gap-4">
        <span>HP: {formatM(result.hp)}</span>
        <span>Dealt: {formatM(result.damageDealt)}</span>
        <span className={result.overkill > 0 ? "text-orange-500" : ""}>
          Overkill: {formatM(result.overkill)}
        </span>
      </div>

      {/* Contributors */}
      {result.contributors.length > 0 && (
        <table className="w-full text-xs">
          <thead>
            <tr className="text-gray-400">
              <th className="text-left pb-1">Member</th>
              <th className="text-right pb-1">Rounds</th>
              <th className="text-right pb-1">Dmg/Round</th>
              <th className="text-right pb-1">Total</th>
            </tr>
          </thead>
          <tbody>
            {result.contributors.map((c) => (
              <tr key={c.memberId} className="border-t border-gray-50">
                <td className="py-0.5 text-gray-700">{c.name || c.memberId}</td>
                <td className="text-right text-gray-600">{c.rounds}</td>
                <td className="text-right text-gray-600">{formatM(c.dmgPerRound)}</td>
                <td className="text-right font-medium text-blue-700">{formatM(c.damage)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
