// §4.1 Planning input model

export interface BossConfig {
  fullHp: number;
  hpRemaining: number;
}

export interface StatByBoss {
  totalDamage: number; // raw
  totalRounds: number;
}

export interface Member {
  id: string;
  name: string;
  roundsRemaining: number;
  /** avg damage per round vs each boss (canonical; used by optimizer) */
  damageByBoss: number[];
  /** optional totals for deriving avg in the UI */
  statsByBoss?: (StatByBoss | null)[];
}

export interface PlanConfig {
  numBosses: number;
  bossHp: number;
  maxRoundsPerMember: number;
}

export interface PlanInput {
  config: PlanConfig;
  bosses: BossConfig[];
  members: Member[];
}

// §4.2 Plan output model

export interface ContributorEntry {
  memberId: string;
  name: string;
  rounds: number;
  dmgPerRound: number;
  damage: number;
}

export interface PerBossResult {
  bossIndex: number;
  hp: number;
  damageDealt: number;
  overkill: number;
  roundsUsed: number;
  contributors: ContributorEntry[];
}

export interface AssignmentEntry {
  bossIndex: number;
  rounds: number;
  dmgPerRound: number;
  damage: number;
}

export interface PerMemberResult {
  memberId: string;
  name: string;
  totalRoundsUsed: number;
  roundsRemaining: number;
  assignments: AssignmentEntry[];
}

export interface PlanResult {
  feasible: boolean;
  totalRoundsUsed: number;
  lowerBoundRounds: number;
  solverUsed: "ilp" | "greedy";
  optimal: boolean;
  perBoss: PerBossResult[];
  perMember: PerMemberResult[];
  warnings: string[];
}

// §4.3 Planning record (from DB / API)
export interface PlanningRecord {
  id: number;
  name: string;
  locked: boolean;
  parentId: number | null;
  data: PlanInput;
  result: PlanResult | null;
  createdAt: string;
  updatedAt: string;
}

export interface PlanningListItem {
  id: number;
  name: string;
  locked: boolean;
  parentId: number | null;
  memberCount: number;
  bossCount: number;
  createdAt: string;
  updatedAt: string;
}
