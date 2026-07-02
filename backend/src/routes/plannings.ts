import { Router, type Request, type Response } from "express";
import type { PlanningModel } from "../generated/prisma/models/Planning";
import prisma from "../db";

const router = Router();

function parseId(param: string | string[] | undefined): number {
  const id = parseInt(Array.isArray(param) ? param[0]! : (param ?? ""), 10);
  return Number.isInteger(id) && id > 0 ? id : NaN;
}

// GET /api/plannings — list all plans
router.get("/", async (_req: Request, res: Response) => {
  try {
    const plannings = await prisma.planning.findMany({
      orderBy: { updatedAt: "desc" },
    });
    const list = plannings.map((p: PlanningModel) => {
      let memberCount = 0;
      let bossCount = 0;
      try {
        const data = JSON.parse(p.data);
        memberCount = Array.isArray(data?.members) ? data.members.length : 0;
        bossCount =
          data?.config?.numBosses ??
          (Array.isArray(data?.bosses) ? data.bosses.length : 0);
      } catch {
        // ignore parse errors
      }
      return {
        id: p.id,
        name: p.name,
        locked: p.locked,
        parentId: p.parentId,
        memberCount,
        bossCount,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      };
    });
    res.json(list);
  } catch (err) {
    console.error("[GET /api/plannings]", err);
    res.status(500).json({ error: "Failed to list plannings" });
  }
});

// POST /api/plannings — create new plan
router.post("/", async (req: Request, res: Response) => {
  const { name, data } = req.body;
  if (!data) {
    res.status(400).json({ error: "data is required" });
    return;
  }
  const planName = (name ?? "Untitled plan").toString().trim().slice(0, 200);
  try {
    const planning = await prisma.planning.create({
      data: {
        name: planName || "Untitled plan",
        data: typeof data === "string" ? data : JSON.stringify(data),
        locked: false,
      },
    });
    res.status(201).json(toRecord(planning));
  } catch (err) {
    console.error("[POST /api/plannings]", err);
    res.status(500).json({ error: "Failed to create planning" });
  }
});

// GET /api/plannings/:id — fetch one plan
router.get("/:id", async (req: Request, res: Response) => {
  const id = parseId(req.params['id']);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  try {
    const planning = await prisma.planning.findUnique({ where: { id } });
    if (!planning) {
      res.status(404).json({ error: "Planning not found" });
      return;
    }
    res.json(toRecord(planning));
  } catch (err) {
    console.error("[GET /api/plannings/:id]", err);
    res.status(500).json({ error: "Failed to fetch planning" });
  }
});

// PUT /api/plannings/:id — update plan (blocked if locked)
router.put("/:id", async (req: Request, res: Response) => {
  const id = parseId(req.params['id']);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  try {
    const existing = await prisma.planning.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: "Planning not found" });
      return;
    }
    if (existing.locked) {
      res.status(409).json({ error: "Planning is locked and cannot be edited" });
      return;
    }
    const { name, data, result } = req.body;
    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name.toString().trim().slice(0, 200) || "Untitled plan";
    if (data !== undefined)
      updateData.data = typeof data === "string" ? data : JSON.stringify(data);
    if (result !== undefined)
      updateData.result =
        result === null ? null : typeof result === "string" ? result : JSON.stringify(result);
    const planning = await prisma.planning.update({
      where: { id },
      data: updateData,
    });
    res.json(toRecord(planning));
  } catch (err) {
    console.error("[PUT /api/plannings/:id]", err);
    res.status(500).json({ error: "Failed to update planning" });
  }
});

// POST /api/plannings/:id/duplicate — duplicate plan
router.post("/:id/duplicate", async (req: Request, res: Response) => {
  const id = parseId(req.params['id']);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  try {
    const source = await prisma.planning.findUnique({ where: { id } });
    if (!source) {
      res.status(404).json({ error: "Planning not found" });
      return;
    }
    const { name } = req.body;
    const dupName = name ? name.toString().trim().slice(0, 200) || `Copy of ${source.name}` : `Copy of ${source.name}`;
    const planning = await prisma.planning.create({
      data: {
        name: dupName,
        locked: false,
        parentId: source.id,
        data: source.data,
        result: null,
      },
    });
    res.status(201).json(toRecord(planning));
  } catch (err) {
    console.error("[POST /api/plannings/:id/duplicate]", err);
    res.status(500).json({ error: "Failed to duplicate planning" });
  }
});

// PATCH /api/plannings/:id/lock — lock or unlock plan
router.patch("/:id/lock", async (req: Request, res: Response) => {
  const id = parseId(req.params['id']);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const { locked } = req.body;
  if (typeof locked !== "boolean") {
    res.status(400).json({ error: "locked (boolean) is required" });
    return;
  }
  try {
    const existing = await prisma.planning.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: "Planning not found" });
      return;
    }
    const planning = await prisma.planning.update({
      where: { id },
      data: { locked },
    });
    res.json(toRecord(planning));
  } catch (err) {
    console.error("[PATCH /api/plannings/:id/lock]", err);
    res.status(500).json({ error: "Failed to update lock status" });
  }
});

// DELETE /api/plannings/:id
router.delete("/:id", async (req: Request, res: Response) => {
  const id = parseId(req.params['id']);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  try {
    const existing = await prisma.planning.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ error: "Planning not found" });
      return;
    }
    await prisma.planning.delete({ where: { id } });
    res.status(204).send();
  } catch (err) {
    console.error("[DELETE /api/plannings/:id]", err);
    res.status(500).json({ error: "Failed to delete planning" });
  }
});

// Helper: serialize a Prisma Planning row to a JSON-friendly record
function toRecord(p: {
  id: number;
  name: string;
  locked: boolean;
  parentId: number | null;
  data: string;
  result: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: p.id,
    name: p.name,
    locked: p.locked,
    parentId: p.parentId,
    data: safeJson(p.data),
    result: p.result ? safeJson(p.result) : null,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

function safeJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}

export default router;

