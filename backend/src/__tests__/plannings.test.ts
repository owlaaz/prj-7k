import request from "supertest";
import express from "express";
import cors from "cors";
import planningsRouter from "../routes/plannings";
import prisma from "../db";

const app = express();
app.use(cors());
app.use(express.json());
app.use("/api/plannings", planningsRouter);

const sampleData = {
  config: { numBosses: 4, bossHp: 100000000, maxRoundsPerMember: 10 },
  bosses: [
    { fullHp: 100000000, hpRemaining: 100000000 },
    { fullHp: 100000000, hpRemaining: 100000000 },
    { fullHp: 100000000, hpRemaining: 100000000 },
    { fullHp: 100000000, hpRemaining: 100000000 },
  ],
  members: [
    {
      id: "m1",
      name: "PlayerOne",
      roundsRemaining: 10,
      damageByBoss: [18000000, 12000000, 9000000, 15000000],
    },
  ],
};

afterAll(async () => {
  await prisma.$disconnect();
});

describe("POST /api/plannings", () => {
  it("creates a plan and returns an auto-increment id", async () => {
    const res1 = await request(app)
      .post("/api/plannings")
      .send({ name: "Test Plan A", data: sampleData });
    expect(res1.status).toBe(201);
    expect(typeof res1.body.id).toBe("number");

    const res2 = await request(app)
      .post("/api/plannings")
      .send({ name: "Test Plan B", data: sampleData });
    expect(res2.status).toBe(201);
    expect(res2.body.id).toBeGreaterThan(res1.body.id);
  });
});

describe("PUT /api/plannings/:id — locked plan", () => {
  it("returns 409 when the plan is locked", async () => {
    const createRes = await request(app)
      .post("/api/plannings")
      .send({ name: "Locked Plan", data: sampleData });
    const id = createRes.body.id;

    await request(app)
      .patch(`/api/plannings/${id}/lock`)
      .send({ locked: true });

    const putRes = await request(app)
      .put(`/api/plannings/${id}`)
      .send({ name: "Should fail", data: sampleData });
    expect(putRes.status).toBe(409);
  });
});

describe("POST /api/plannings/:id/duplicate", () => {
  it("duplicates a locked plan into a new unlocked plan with a new id", async () => {
    const createRes = await request(app)
      .post("/api/plannings")
      .send({ name: "Source Plan", data: sampleData });
    const sourceId = createRes.body.id;

    await request(app)
      .patch(`/api/plannings/${sourceId}/lock`)
      .send({ locked: true });

    const dupRes = await request(app)
      .post(`/api/plannings/${sourceId}/duplicate`)
      .send({});
    expect(dupRes.status).toBe(201);
    expect(dupRes.body.id).toBeGreaterThan(sourceId);
    expect(dupRes.body.locked).toBe(false);
    expect(dupRes.body.parentId).toBe(sourceId);
  });
});
