import type { PlanInput } from "../planner/types";
import { formatM } from "../lib/format";

interface Props {
  input: PlanInput;
  disabled?: boolean;
  onChange: (input: PlanInput) => void;
}

export default function ConfigPanel({ input, disabled, onChange }: Props) {
  const { config } = input;

  function updateConfig(patch: Partial<typeof config>) {
    const newConfig = { ...config, ...patch };
    let bosses = [...input.bosses];
    // Adjust boss array size when numBosses changes
    if (patch.numBosses !== undefined) {
      const n = patch.numBosses;
      if (n > bosses.length) {
        const hp = config.bossHp;
        while (bosses.length < n) {
          bosses.push({ fullHp: hp, hpRemaining: hp });
        }
      } else {
        bosses = bosses.slice(0, n);
      }
      // Also adjust each member's damageByBoss / statsByBoss length
      const members = input.members.map((m) => {
        const dmg = [...m.damageByBoss];
        while (dmg.length < n) dmg.push(0);
        const stats = m.statsByBoss ? [...m.statsByBoss] : null;
        if (stats) {
          while (stats.length < n) stats.push(null);
          return { ...m, damageByBoss: dmg.slice(0, n), statsByBoss: stats.slice(0, n) };
        }
        return { ...m, damageByBoss: dmg.slice(0, n) };
      });
      onChange({ ...input, config: newConfig, bosses, members });
      return;
    }
    onChange({ ...input, config: newConfig, bosses });
  }

  return (
    <details className="border rounded-lg mb-4">
      <summary className="px-4 py-2 cursor-pointer font-medium text-gray-700 select-none">
        ⚙ Config
      </summary>
      <div className="px-4 py-3 grid grid-cols-1 sm:grid-cols-3 gap-4">
        <label className="flex flex-col gap-1 text-sm text-gray-600">
          Number of Bosses
          <input
            type="number"
            min={1}
            max={10}
            disabled={disabled}
            value={config.numBosses}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10);
              if (!isNaN(v) && v >= 1 && v <= 10) updateConfig({ numBosses: v });
            }}
            className="border rounded px-2 py-1 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-gray-600">
          Default Boss HP (M)
          <input
            type="number"
            min={1}
            disabled={disabled}
            value={config.bossHp / 1_000_000}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              if (!isNaN(v) && v > 0) updateConfig({ bossHp: Math.round(v * 1_000_000) });
            }}
            className="border rounded px-2 py-1 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-gray-600">
          Default Rounds per Member
          <input
            type="number"
            min={1}
            max={30}
            disabled={disabled}
            value={config.maxRoundsPerMember}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10);
              if (!isNaN(v) && v >= 1) updateConfig({ maxRoundsPerMember: v });
            }}
            className="border rounded px-2 py-1 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </label>
      </div>
    </details>
  );
}
