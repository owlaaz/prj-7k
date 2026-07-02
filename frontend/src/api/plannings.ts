import type { PlanningRecord, PlanningListItem, PlanInput, PlanResult } from "../planner/types";

// In dev, Vite proxies /api → backend (see vite.config.ts).
// In production builds, set VITE_API_BASE to the Kong gateway URL
// (e.g. https://api.example.com/api/plannings).
const BASE = import.meta.env.VITE_API_BASE ?? "/api/plannings";

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = new Error(body.error ?? `HTTP ${res.status}`);
    (err as Error & { status: number }).status = res.status;
    throw err;
  }
  if (res.status === 204) return undefined as unknown as T;
  return res.json();
}

export async function listPlannings(): Promise<PlanningListItem[]> {
  return handleResponse(await fetch(BASE));
}

export async function getPlan(id: number): Promise<PlanningRecord> {
  return handleResponse(await fetch(`${BASE}/${id}`));
}

export async function createPlan(
  data: PlanInput,
  name?: string
): Promise<PlanningRecord> {
  return handleResponse(
    await fetch(BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name ?? "Untitled plan", data }),
    })
  );
}

export async function updatePlan(
  id: number,
  fields: { name?: string; data?: PlanInput; result?: PlanResult | null }
): Promise<PlanningRecord> {
  return handleResponse(
    await fetch(`${BASE}/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(fields),
    })
  );
}

export async function duplicatePlan(
  id: number,
  name?: string
): Promise<PlanningRecord> {
  return handleResponse(
    await fetch(`${BASE}/${id}/duplicate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(name ? { name } : {}),
    })
  );
}

export async function lockPlan(id: number, locked: boolean): Promise<PlanningRecord> {
  return handleResponse(
    await fetch(`${BASE}/${id}/lock`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locked }),
    })
  );
}

export async function deletePlan(id: number): Promise<void> {
  return handleResponse(await fetch(`${BASE}/${id}`, { method: "DELETE" }));
}
