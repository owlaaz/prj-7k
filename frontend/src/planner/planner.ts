import type { PlanInput, PlanResult, PerBossResult, PerMemberResult } from "./types";

/** §6.1 – Necessary feasibility check (per-boss) */
function feasibilityCheck(input: PlanInput): Map<number, { maxDmg: number; hp: number }> {
  const infeasible = new Map<number, { maxDmg: number; hp: number }>();
  input.bosses.forEach((boss, b) => {
    if (boss.hpRemaining <= 0) return; // already cleared
    const maxDmg = input.members.reduce(
      (sum, m) => sum + (m.damageByBoss[b] ?? 0) * m.roundsRemaining,
      0
    );
    if (maxDmg < boss.hpRemaining) {
      infeasible.set(b, { maxDmg, hp: boss.hpRemaining });
    }
  });
  return infeasible;
}

/** §6.2 – Lower bound on total rounds */
function computeLowerBound(input: PlanInput): number {
  let lb = 0;
  input.bosses.forEach((boss, b) => {
    if (boss.hpRemaining <= 0) return;
    // Sort members by dmg[b] desc, give each up to 10 rounds (relaxed)
    const sorted = [...input.members]
      .map((m) => m.damageByBoss[b] ?? 0)
      .filter((d) => d > 0)
      .sort((a, z) => z - a);
    let hp = boss.hpRemaining;
    for (const d of sorted) {
      if (hp <= 0) break;
      const rounds = Math.min(10, Math.ceil(hp / d));
      lb += rounds;
      hp -= rounds * d;
    }
    if (hp > 0) lb += 0; // infeasible boss – skip
  });
  return lb;
}

/** §6.4 – Greedy fallback */
function solveGreedy(input: PlanInput): number[][] {
  const N = input.members.length;
  const M = input.bosses.length;
  const assign: number[][] = Array.from({ length: N }, () => Array(M).fill(0));
  const remaining = input.bosses.map((b) => Math.max(0, b.hpRemaining));
  const capLeft = input.members.map((m) => m.roundsRemaining);

  let progress = true;
  while (progress) {
    progress = false;
    let bestVal = -1;
    let bestI = -1;
    let bestB = -1;

    for (let i = 0; i < N; i++) {
      if (capLeft[i] <= 0) continue;
      for (let b = 0; b < M; b++) {
        if (remaining[b] <= 0) continue;
        const d = input.members[i].damageByBoss[b] ?? 0;
        if (d <= 0) continue;
        if (d > bestVal) {
          bestVal = d;
          bestI = i;
          bestB = b;
        }
      }
    }

    if (bestI < 0) break;

    const d = input.members[bestI].damageByBoss[bestB];
    const r = Math.min(capLeft[bestI], Math.ceil(remaining[bestB] / d));
    assign[bestI][bestB] += r;
    remaining[bestB] -= r * d;
    capLeft[bestI] -= r;
    progress = true;
  }

  return assign;
}

/** Build a PlanResult from an assignment matrix */
function buildResult(
  input: PlanInput,
  assign: number[][],
  lowerBoundRounds: number,
  solverUsed: "ilp" | "greedy",
  warnings: string[]
): PlanResult {
  const N = input.members.length;
  const M = input.bosses.length;

  let totalRoundsUsed = 0;
  const perBoss: PerBossResult[] = [];
  const perMember: PerMemberResult[] = [];

  for (let b = 0; b < M; b++) {
    const boss = input.bosses[b];
    if (boss.hpRemaining <= 0) continue;

    let damageDealt = 0;
    const contributors = [];
    let roundsUsed = 0;

    for (let i = 0; i < N; i++) {
      const r = assign[i][b];
      if (r <= 0) continue;
      const d = input.members[i].damageByBoss[b] ?? 0;
      const dmg = r * d;
      damageDealt += dmg;
      roundsUsed += r;
      totalRoundsUsed += r;
      contributors.push({
        memberId: input.members[i].id,
        name: input.members[i].name,
        rounds: r,
        dmgPerRound: d,
        damage: dmg,
      });
    }

    const overkill = Math.max(0, damageDealt - boss.hpRemaining);
    if (damageDealt < boss.hpRemaining) {
      warnings.push(
        `Boss ${b + 1} not killed: dealt ${damageDealt}, needed ${boss.hpRemaining} (short ${boss.hpRemaining - damageDealt})`
      );
    }

    perBoss.push({
      bossIndex: b,
      hp: boss.hpRemaining,
      damageDealt,
      overkill,
      roundsUsed,
      contributors,
    });
  }

  for (let i = 0; i < N; i++) {
    const assignments = [];
    let totalRounds = 0;
    for (let b = 0; b < M; b++) {
      const r = assign[i][b];
      if (r <= 0) continue;
      const d = input.members[i].damageByBoss[b] ?? 0;
      assignments.push({ bossIndex: b, rounds: r, dmgPerRound: d, damage: r * d });
      totalRounds += r;
    }
    if (totalRounds > 0) {
      // Verify cap
      if (totalRounds > input.members[i].roundsRemaining) {
        warnings.push(
          `Member ${input.members[i].name} assigned ${totalRounds} rounds but cap is ${input.members[i].roundsRemaining}`
        );
      }
      perMember.push({
        memberId: input.members[i].id,
        name: input.members[i].name,
        totalRoundsUsed: totalRounds,
        roundsRemaining: input.members[i].roundsRemaining - totalRounds,
        assignments,
      });
    }
  }

  const feasible = warnings.filter((w) => w.includes("not killed")).length === 0;
  const optimal = totalRoundsUsed === lowerBoundRounds;

  return {
    feasible,
    totalRoundsUsed,
    lowerBoundRounds,
    solverUsed,
    optimal,
    perBoss,
    perMember,
    warnings,
  };
}

/**
 * Main entry point — calls ILP (glpk.js) and falls back to greedy.
 * Returns §4.2 PlanResult.
 */
export async function computePlan(input: PlanInput): Promise<PlanResult> {
  const warnings: string[] = [];
  const lowerBoundRounds = computeLowerBound(input);

  // Necessary feasibility check
  const infeasibleBosses = feasibilityCheck(input);
  if (infeasibleBosses.size > 0) {
    infeasibleBosses.forEach(({ maxDmg, hp }, b) => {
      warnings.push(
        `Boss ${b + 1} is infeasible: max reachable damage ${maxDmg}, needs ${hp} (short ${hp - maxDmg})`
      );
    });
    // Still try to plan the feasible bosses
  }

  // Try ILP
  try {
    const { solveIlp } = await import("./ilp");
    const assign = await solveIlp(input);
    if (assign) {
      return buildResult(input, assign, lowerBoundRounds, "ilp", warnings);
    }
  } catch (e) {
    warnings.push("ILP solver failed; using greedy fallback");
  }

  // Greedy fallback
  const assign = solveGreedy(input);
  return buildResult(input, assign, lowerBoundRounds, "greedy", warnings);
}
