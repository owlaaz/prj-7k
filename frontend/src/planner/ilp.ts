import type { PlanInput } from "./types";

/**
 * §6.3 – Exact ILP via glpk.js (client-side, no backend solver).
 *
 * Variables: x[i][b] = rounds member i spends on boss b (integer ≥ 0)
 * Two-phase:
 *   Phase 1: minimize total rounds Σ x[i][b]
 *   Phase 2: fix total = R*, minimize overkill Σ(Σ d[i][b]*x[i][b] − H[b])
 */
export async function solveIlp(input: PlanInput): Promise<number[][] | null> {
  // Dynamic import so the heavy WASM loads only when needed
  const GLPK = await import("glpk.js");
  const glpk = await (GLPK.default as () => Promise<unknown>)() as GlpkInstance;

  const members = input.members;
  const bosses = input.bosses;
  const N = members.length;
  const M = bosses.length;

  // Only plan live bosses
  const liveBossIndices = bosses
    .map((b, i) => ({ b, i }))
    .filter(({ b }) => b.hpRemaining > 0)
    .map(({ i }) => i);

  if (liveBossIndices.length === 0) {
    return Array.from({ length: N }, () => Array(M).fill(0));
  }

  // Variable names: x_i_b
  function varName(i: number, b: number) {
    return `x_${i}_${b}`;
  }

  // Build variable list
  const vars: Record<string, { obj: number; bnds: { type: number; ub: number; lb: number } }> = {};
  for (let i = 0; i < N; i++) {
    for (const b of liveBossIndices) {
      const name = varName(i, b);
      vars[name] = {
        obj: 1, // minimize total rounds (Phase 1)
        bnds: { type: glpk.GLP_DB, ub: members[i].roundsRemaining, lb: 0 },
      };
    }
  }

  // Constraints
  const subjectTo: GlpkConstraint[] = [];

  // Member cap: for each i, Σ_b x[i][b] ≤ R_i
  for (let i = 0; i < N; i++) {
    const vars_i = liveBossIndices.map((b) => ({ name: varName(i, b), coef: 1 }));
    if (vars_i.length === 0) continue;
    subjectTo.push({
      name: `cap_${i}`,
      vars: vars_i,
      bnds: { type: glpk.GLP_UP, ub: members[i].roundsRemaining, lb: 0 },
    });
  }

  // Boss kill: for each live b, Σ_i d[i][b]*x[i][b] ≥ H_b
  for (const b of liveBossIndices) {
    const hp = bosses[b].hpRemaining;
    const vars_b = members
      .map((m, i) => ({ name: varName(i, b), coef: m.damageByBoss[b] ?? 0 }))
      .filter((v) => v.coef > 0);
    if (vars_b.length === 0) continue;
    subjectTo.push({
      name: `kill_${b}`,
      vars: vars_b,
      bnds: { type: glpk.GLP_LO, ub: 0, lb: hp },
    });
  }

  // All variables integer
  const generals: string[] = Object.keys(vars);

  const lp: GlpkModel = {
    name: "guild_boss_phase1",
    objective: { direction: glpk.GLP_MIN, name: "obj", vars: Object.entries(vars).map(([n, v]) => ({ name: n, coef: v.obj })) },
    subjectTo,
    generals,
    bounds: Object.entries(vars).map(([n, v]) => ({ name: n, ...v.bnds })),
  };

  const opts = { msglev: glpk.GLP_MSG_OFF, presol: true };
  const result1 = glpk.solve(lp, opts);

  if (result1.result.status !== glpk.GLP_OPT && result1.result.status !== glpk.GLP_FEAS) {
    return null; // infeasible or error
  }

  const R_star = Math.round(result1.result.z);

  // Phase 2: fix total rounds = R*, minimize overkill
  // Overkill for boss b = Σ_i d[i][b]*x[i][b] - H_b
  // Minimize Σ_b Σ_i d[i][b]*x[i][b] (equivalent, since Σ H_b is constant)
  const vars2: Record<string, { obj: number; bnds: { type: number; ub: number; lb: number } }> = {};
  for (let i = 0; i < N; i++) {
    for (const b of liveBossIndices) {
      const name = varName(i, b);
      const d = members[i].damageByBoss[b] ?? 0;
      vars2[name] = {
        obj: d, // minimize total damage dealt (minimizes overkill)
        bnds: { type: glpk.GLP_DB, ub: members[i].roundsRemaining, lb: 0 },
      };
    }
  }

  const subjectTo2 = [...subjectTo];
  // Add total rounds = R* constraint
  subjectTo2.push({
    name: "total_rounds",
    vars: Object.keys(vars2).map((n) => ({ name: n, coef: 1 })),
    bnds: { type: glpk.GLP_FX, ub: R_star, lb: R_star },
  });

  const lp2: GlpkModel = {
    name: "guild_boss_phase2",
    objective: { direction: glpk.GLP_MIN, name: "obj2", vars: Object.entries(vars2).map(([n, v]) => ({ name: n, coef: v.obj })) },
    subjectTo: subjectTo2,
    generals: Object.keys(vars2),
    bounds: Object.entries(vars2).map(([n, v]) => ({ name: n, ...v.bnds })),
  };

  const result2 = glpk.solve(lp2, opts);
  const useResult = (result2.result.status === glpk.GLP_OPT || result2.result.status === glpk.GLP_FEAS)
    ? result2
    : result1;

  // Extract solution
  const assign: number[][] = Array.from({ length: N }, () => Array(M).fill(0));
  const vals = useResult.result.vars;
  for (let i = 0; i < N; i++) {
    for (const b of liveBossIndices) {
      assign[i][b] = Math.round(vals[varName(i, b)] ?? 0);
    }
  }

  return assign;
}

// Minimal GLPK type shims (glpk.js doesn't ship great TS types)
interface GlpkVarEntry { name: string; coef: number }
interface GlpkBounds { type: number; ub: number; lb: number }
interface GlpkConstraint { name: string; vars: GlpkVarEntry[]; bnds: GlpkBounds }
interface GlpkModel {
  name: string;
  objective: { direction: number; name: string; vars: GlpkVarEntry[] };
  subjectTo: GlpkConstraint[];
  generals?: string[];
  bounds?: Array<{ name: string } & GlpkBounds>;
}
interface GlpkInstance {
  GLP_MIN: number; GLP_MAX: number;
  GLP_MSG_OFF: number; GLP_MSG_ALL: number;
  GLP_OPT: number; GLP_FEAS: number; GLP_INFEAS: number; GLP_NOFEAS: number;
  GLP_LO: number; GLP_UP: number; GLP_DB: number; GLP_FX: number; GLP_FR: number;
  solve(model: GlpkModel, opts?: object): { result: { status: number; z: number; vars: Record<string, number> } };
}
