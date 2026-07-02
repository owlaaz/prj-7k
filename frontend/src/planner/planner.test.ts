import { describe, it, expect } from "vitest";
import { computePlan } from "./planner";
import type { PlanInput } from "./types";

function makeInput(
  members: { name: string; dmg: number[]; rounds?: number }[],
  bossHps: number[]
): PlanInput {
  return {
    config: { numBosses: bossHps.length, bossHp: 100, maxRoundsPerMember: 10 },
    bosses: bossHps.map((hp) => ({ fullHp: hp, hpRemaining: hp })),
    members: members.map((m, i) => ({
      id: `m${i}`,
      name: m.name,
      roundsRemaining: m.rounds ?? 10,
      damageByBoss: m.dmg,
    })),
  };
}

// §6.6 Micro-example
describe("§6.6 micro-example", () => {
  it("achieves lower bound of 4 rounds", async () => {
    const input = makeInput(
      [
        { name: "A", dmg: [60, 10] },
        { name: "B", dmg: [50, 55] },
        { name: "C", dmg: [10, 50] },
      ],
      [100, 100]
    );
    const result = await computePlan(input);
    expect(result.feasible).toBe(true);
    expect(result.totalRoundsUsed).toBe(4);
    expect(result.lowerBoundRounds).toBe(4);
    expect(result.optimal).toBe(true);
    // Every boss ≥ HP
    for (const pb of result.perBoss) {
      expect(pb.damageDealt).toBeGreaterThanOrEqual(pb.hp);
    }
  });
});

// Infeasible case
describe("infeasible roster", () => {
  it("reports feasible=false when boss cannot die", async () => {
    const input = makeInput(
      [{ name: "Weak", dmg: [5, 5] }],
      [1000, 1000]
    );
    const result = await computePlan(input);
    expect(result.feasible).toBe(false);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});

// Single huge member
describe("single huge member", () => {
  it("one member kills both bosses alone", async () => {
    const input = makeInput(
      [{ name: "Titan", dmg: [200, 200] }],
      [100, 100]
    );
    const result = await computePlan(input);
    expect(result.feasible).toBe(true);
    expect(result.totalRoundsUsed).toBe(2);
  });
});

// Contention: member B is contested between bosses
describe("member contention", () => {
  it("assigns each member to boss where they contribute best", async () => {
    const input = makeInput(
      [
        { name: "Spec1", dmg: [100, 1] },
        { name: "Spec2", dmg: [1, 100] },
      ],
      [100, 100]
    );
    const result = await computePlan(input);
    expect(result.feasible).toBe(true);
    expect(result.totalRoundsUsed).toBe(2);
  });
});

// Near-boundary capacity
describe("near-boundary capacity", () => {
  it("uses exactly the needed rounds, respecting caps", async () => {
    const input = makeInput(
      [
        { name: "M1", dmg: [10], rounds: 10 },
        { name: "M2", dmg: [10], rounds: 3 },
      ],
      [100]
    );
    const result = await computePlan(input);
    expect(result.feasible).toBe(true);
    // 10 rounds needed: M1 provides up to 10, M2 up to 3
    for (const pm of result.perMember) {
      const member = input.members.find((m) => m.id === pm.memberId)!;
      expect(pm.totalRoundsUsed).toBeLessThanOrEqual(member.roundsRemaining);
    }
    for (const pb of result.perBoss) {
      expect(pb.damageDealt).toBeGreaterThanOrEqual(pb.hp);
    }
  });
});

// Mid-event recheck
describe("mid-event recheck", () => {
  it("excludes cleared bosses and spent members", async () => {
    const input: PlanInput = {
      config: { numBosses: 3, bossHp: 100, maxRoundsPerMember: 10 },
      bosses: [
        { fullHp: 100, hpRemaining: 0 },   // already cleared
        { fullHp: 100, hpRemaining: 50 },  // partially done
        { fullHp: 100, hpRemaining: 100 }, // untouched
      ],
      members: [
        { id: "m0", name: "Spent", roundsRemaining: 0, damageByBoss: [60, 60, 60] },
        { id: "m1", name: "Remaining", roundsRemaining: 5, damageByBoss: [60, 60, 60] },
      ],
    };
    const result = await computePlan(input);
    // Boss 0 should not appear in planning (cleared)
    expect(result.perBoss.find((pb) => pb.bossIndex === 0)).toBeUndefined();
    // "Spent" member should contribute 0 rounds
    const spent = result.perMember.find((pm) => pm.memberId === "m0");
    expect(spent?.totalRoundsUsed ?? 0).toBe(0);
    // Remaining bosses should be killed
    for (const pb of result.perBoss) {
      expect(pb.damageDealt).toBeGreaterThanOrEqual(pb.hp);
    }
  });
});
