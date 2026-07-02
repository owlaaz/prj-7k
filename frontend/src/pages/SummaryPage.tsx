import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import type { PlanningRecord } from "../planner/types";
import { useGuildStore } from "../store/useGuildStore";
import { getPlan, duplicatePlan, lockPlan } from "../api/plannings";
import { computePlan } from "../planner/planner";
import { exportCsv } from "../lib/csv";
import StatCard from "../components/StatCard";
import BossCard from "../components/BossCard";
import MemberPlanTable from "../components/MemberPlanTable";
import MembersMatrixTable from "../components/MembersMatrixTable";
import LockBadge from "../components/LockBadge";
import { formatM, bossName } from "../lib/format";

export default function SummaryPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { record: storeRecord, input: storeInput, result: storeResult, setRecord, setResult } = useGuildStore();

  const [record, setLocalRecord] = useState<PlanningRecord | null>(storeRecord);
  const [toast, setToast] = useState<string | null>(null);
  const [recomputing, setRecomputing] = useState(false);
  const [parentName, setParentName] = useState<string | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  useEffect(() => {
    if (!id) return;

    // "preview" means an unsaved plan — use whatever is in the store
    if (id === "preview") {
      if (!storeResult) navigate("/plan/new");
      return;
    }

    const numId = Number(id);
    if (!Number.isInteger(numId) || numId <= 0) {
      navigate("/not-found");
      return;
    }
    // If store already has this plan + result, use it
    if (storeRecord?.id === numId && storeResult) {
      setLocalRecord(storeRecord);
      if (storeRecord.parentId) {
        getPlan(storeRecord.parentId)
          .then((p) => setParentName(p.name))
          .catch(() => setParentName(null));
      }
      return;
    }
    // Otherwise fetch from server
    getPlan(numId)
      .then((r) => {
        setLocalRecord(r);
        setRecord(r);
        if (r.parentId) {
          getPlan(r.parentId)
            .then((p) => setParentName(p.name))
            .catch(() => setParentName(null));
        }
      })
      .catch(() => navigate("/not-found"));
  }, [id]);

  const isPreview = id === "preview";
  const result = isPreview ? storeResult : (storeRecord?.id === record?.id ? storeResult : record?.result);
  const input = isPreview ? storeInput : (storeRecord?.id === record?.id ? storeInput : record?.data);
  const locked = record?.locked ?? false;

  async function handleRecompute() {
    if (!input) return;
    setRecomputing(true);
    try {
      const r = await computePlan(input);
      setResult(r);
      setLocalRecord((prev) => prev ? { ...prev, result: r } : prev);
    } finally {
      setRecomputing(false);
    }
  }

  async function handleDuplicate() {
    if (!record) return;
    const dup = await duplicatePlan(record.id);
    showToast(`Duplicated as #${dup.id}`);
    navigate(`/plan/${dup.id}/edit`);
  }

  async function handleLock() {
    if (!record) return;
    if (!confirm("Lock this plan? This cannot be undone — it will become read-only permanently.")) return;
    const r = await lockPlan(record.id, true);
    setLocalRecord(r);
    setRecord(r);
    showToast("Plan locked");
  }

  function copyShareLink() {
    const url = `${window.location.origin}/plan/${record?.id}`;
    navigator.clipboard.writeText(url).then(() => showToast("Share link copied!"));
  }

  function handleExport() {
    if (!input) return;
    exportCsv(input, record ? `${record.id}-${record.name}` : undefined);
  }

  const liveBosses = input?.bosses.filter((b) => b.hpRemaining > 0) ?? [];
  const clearedBosses = input?.bosses.filter((b) => b.hpRemaining <= 0) ?? [];

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      {toast && (
        <div className="fixed top-4 right-4 bg-gray-900 text-white text-sm px-4 py-2 rounded-lg shadow z-50">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap gap-3 items-center mb-6">
        {record?.parentId && (
          <Link to={`/plan/${record.parentId}`} className="text-sm text-blue-600 hover:underline mr-2">
            ← Parent #{record.parentId}{parentName ? `: ${parentName}` : ""}
          </Link>
        )}
        <h1 className="text-2xl font-bold text-gray-900 flex-1">
          {record?.name ?? "Plan Summary"}
        </h1>
        <LockBadge locked={locked} />
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button onClick={copyShareLink} className="px-3 py-1.5 text-sm bg-gray-100 rounded-lg hover:bg-gray-200">
          Copy Share Link
        </button>
        <button onClick={handleDuplicate} className="px-3 py-1.5 text-sm bg-gray-100 rounded-lg hover:bg-gray-200">
          Duplicate
        </button>
        {!locked && record && (
          <Link to={`/plan/${record.id}/edit`} className="px-3 py-1.5 text-sm bg-gray-100 rounded-lg hover:bg-gray-200">
            Edit
          </Link>
        )}
        {!locked && (
          <button onClick={handleLock} className="px-3 py-1.5 text-sm bg-gray-100 rounded-lg hover:bg-gray-200">
            Lock
          </button>
        )}
        <button onClick={handleExport} className="px-3 py-1.5 text-sm bg-gray-100 rounded-lg hover:bg-gray-200">
          Export CSV
        </button>
        <button
          onClick={handleRecompute}
          disabled={recomputing || !input}
          className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
        >
          {recomputing ? "Computing…" : "Recompute"}
        </button>
        <Link to="/" className="px-3 py-1.5 text-sm bg-gray-100 rounded-lg hover:bg-gray-200">
          ← All Plans
        </Link>
      </div>

      {!result && (
        <div className="text-center py-12 text-gray-400">
          <p className="mb-3">No result yet.</p>
          <button
            onClick={handleRecompute}
            disabled={recomputing || !input}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            {recomputing ? "Computing…" : "Compute Plan"}
          </button>
        </div>
      )}

      {result && (
        <>
          {/* Infeasible banner */}
          {!result.feasible && (
            <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <p className="font-semibold mb-1">⚠ Infeasible roster</p>
              {result.warnings.filter((w) => w.includes("infeasible") || w.includes("not killed")).map((w, i) => (
                <p key={i}>{w}</p>
              ))}
            </div>
          )}

          {/* Stat cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <StatCard
              label="Total Rounds Used"
              value={result.totalRoundsUsed}
            />
            <StatCard
              label="Lower Bound"
              value={result.lowerBoundRounds}
              sub={result.optimal ? "OPTIMAL ✓" : result.solverUsed === "ilp" ? "Proven optimal" : "Greedy estimate"}
              highlight={result.optimal}
            />
            <StatCard
              label="All Bosses Killed?"
              value={result.feasible ? "✅ Yes" : "❌ No"}
              highlight={result.feasible}
            />
            <StatCard
              label="Total Overkill"
              value={formatM(result.perBoss.reduce((s, b) => s + b.overkill, 0))}
            />
          </div>

          {/* Cleared bosses */}
          {clearedBosses.length > 0 && (
            <div className="mb-4 flex flex-wrap gap-2">
              {clearedBosses.map((_, b) => (
                <span key={b} className="px-3 py-1 rounded-full bg-green-100 text-green-700 text-sm font-medium">
                  {bossName(b)} — Cleared ✅
                </span>
              ))}
            </div>
          )}

          {/* Per-boss cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            {result.perBoss.map((pb) => (
              <BossCard key={pb.bossIndex} result={pb} />
            ))}
          </div>

          {/* Per-member table */}
          <h2 className="text-lg font-semibold text-gray-800 mb-3">Per-Member Assignments</h2>
          <MemberPlanTable members={result.perMember} />

          {/* Member damage config */}
          {input && (
            <details className="border rounded-lg mt-6">
              <summary className="px-4 py-2 cursor-pointer select-none font-medium text-gray-700 flex items-center gap-2">
                👥 Member Damage Table
                <span className="text-xs text-gray-400 font-normal">({input.members.length} members — click to expand)</span>
              </summary>
              <div className="px-4 py-3">
                <MembersMatrixTable input={input} disabled onChange={() => {}} />
              </div>
            </details>
          )}

          {/* Other warnings */}
          {result.warnings.filter((w) => !w.includes("infeasible") && !w.includes("not killed")).length > 0 && (
            <div className="mt-4 px-4 py-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-700">
              {result.warnings
                .filter((w) => !w.includes("infeasible") && !w.includes("not killed"))
                .map((w, i) => <p key={i}>{w}</p>)}
            </div>
          )}
        </>
      )}
    </div>
  );
}
