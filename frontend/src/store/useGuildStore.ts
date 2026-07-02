import { create } from "zustand";
import type { PlanInput, PlanResult, PlanningRecord } from "../planner/types";

const DRAFT_KEY = "guild_boss_draft";

interface GuildStore {
  record: PlanningRecord | null;
  input: PlanInput | null;
  result: PlanResult | null;
  dirty: boolean;

  setRecord: (r: PlanningRecord) => void;
  setInput: (input: PlanInput) => void;
  setResult: (result: PlanResult | null) => void;
  clearDraft: () => void;
  loadDraft: () => boolean;
}

function defaultInput(): PlanInput {
  return {
    config: { numBosses: 4, bossHp: 100_000_000, maxRoundsPerMember: 10 },
    bosses: Array.from({ length: 4 }, () => ({
      fullHp: 100_000_000,
      hpRemaining: 100_000_000,
    })),
    members: [],
  };
}

export const useGuildStore = create<GuildStore>((set, get) => ({
  record: null,
  input: null,
  result: null,
  dirty: false,

  setRecord(r) {
    set({ record: r, input: r.data, result: r.result, dirty: false });
  },

  setInput(input) {
    set({ input, dirty: true, result: null });
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ recordId: get().record?.id, input }));
    } catch {
      // ignore quota errors
    }
  },

  setResult(result) {
    set({ result });
  },

  clearDraft() {
    localStorage.removeItem(DRAFT_KEY);
    set({ record: null, input: defaultInput(), result: null, dirty: false });
  },

  loadDraft() {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return false;
      const { input } = JSON.parse(raw);
      if (input) {
        set({ input, dirty: true });
        return true;
      }
    } catch {
      // ignore
    }
    return false;
  },
}));

export { defaultInput };
