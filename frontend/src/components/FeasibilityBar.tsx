import type { PlanInput } from "../planner/types";
import { formatM, bossName } from "../lib/format";

interface Props {
  input: PlanInput;
}

export default function FeasibilityBar({ input }: Props) {
  const numBosses = input.config.numBosses;

  return (
    <div className="flex flex-wrap gap-3 p-3 bg-gray-50 border rounded-lg text-sm mb-4">
      <span className="font-medium text-gray-600">
        Members: {input.members.length}
      </span>
      {Array.from({ length: numBosses }, (_, b) => {
        const boss = input.bosses[b];
        if (!boss || boss.hpRemaining <= 0)
          return (
            <span key={b} className="text-green-600 font-medium">
              {bossName(b)}: ✅ Cleared
            </span>
          );

        const maxDmg = input.members.reduce(
          (sum, m) => sum + (m.damageByBoss[b] ?? 0) * m.roundsRemaining,
          0
        );
        const feasible = maxDmg >= boss.hpRemaining;

        return (
          <span
            key={b}
            className={`font-medium ${feasible ? "text-green-700" : "text-red-600"}`}
          >
            {bossName(b)}: {formatM(maxDmg)} / {formatM(boss.hpRemaining)}
            {!feasible && (
              <span className="ml-1 text-xs">
                (short {formatM(boss.hpRemaining - maxDmg)})
              </span>
            )}
          </span>
        );
      })}
    </div>
  );
}
