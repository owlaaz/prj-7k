import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import type { PlanInput } from "../planner/types";
import { useGuildStore, defaultInput } from "../store/useGuildStore";
import { getPlan, createPlan, updatePlan, duplicatePlan } from "../api/plannings";
import { computePlan } from "../planner/planner";
import { exportCsv, importCsv } from "../lib/csv";
import type { ImportMode } from "../lib/csv";
import ConfigPanel from "../components/ConfigPanel";
import BossPanel from "../components/BossPanel";
import MembersMatrixTable from "../components/MembersMatrixTable";
import FeasibilityBar from "../components/FeasibilityBar";
import CsvImportDialog from "../components/CsvImportDialog";
import LockBadge from "../components/LockBadge";

export default function InputPage() {
  const { id } = useParams<{ id?: string }>();
  const isNew = !id || id === "new";
  const navigate = useNavigate();

  const { record, input, dirty, setRecord, setInput, setResult, clearDraft } = useGuildStore();

  const [planName, setPlanName] = useState("Untitled plan");
  const [saving, setSaving] = useState(false);
  const [computing, setComputing] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [parentName, setParentName] = useState<string | null>(null);

  // Load plan on mount (if id given)
  useEffect(() => {
    if (isNew) {
      if (!input || !dirty) {
        setInput(defaultInput());
      }
      setPlanName("Untitled plan");
      return;
    }
    getPlan(Number(id))
      .then((r) => {
        setRecord(r);
        setPlanName(r.name);
        // Try to resolve parent name
        if (r.parentId) {
          getPlan(r.parentId)
            .then((p) => setParentName(p.name))
            .catch(() => setParentName(null));
        }
      })
      .catch(() => navigate("/not-found"));
  }, [id]);

  function showToast(msg: string, duration = 3000) {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), duration);
  }

  const locked = record?.locked ?? false;
  const currentInput = input ?? defaultInput();

  async function handleSave() {
    setSaving(true);
    try {
      if (isNew || !record) {
        const r = await createPlan(currentInput, planName);
        setRecord(r);
        navigate(`/plan/${r.id}/edit`, { replace: true });
        showToast(`Plan saved as #${r.id}`);
      } else {
        const r = await updatePlan(record.id, { name: planName, data: currentInput });
        setRecord(r);
        showToast("Plan saved");
      }
    } catch (e: unknown) {
      const err = e as Error & { status?: number };
      if (err.status === 409) {
        showToast("Plan is locked — cannot save");
      } else {
        showToast("Save failed");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleCompute() {
    setComputing(true);
    try {
      const result = await computePlan(currentInput);
      setResult(result);
      // Cache result on server if plan is saved and not locked
      if (record && !locked) {
        await updatePlan(record.id, { result }).catch(() => {});
      }
      navigate(record ? `/plan/${record.id}` : "/plan/preview");
    } catch (e) {
      showToast("Compute failed");
    } finally {
      setComputing(false);
    }
  }

  async function handleDuplicate() {
    if (!record) return;
    const dup = await duplicatePlan(record.id);
    showToast(`Duplicated as #${dup.id}`);
    navigate(`/plan/${dup.id}/edit`);
  }

  function handleExport() {
    exportCsv(currentInput, record ? `${record.id}-${planName}` : planName);
  }

  async function handleImportFile(file: File, mode: ImportMode) {
    const text = await file.text();
    const { members, warnings, badCells } = importCsv(
      text,
      currentInput.config.numBosses,
      30,
      currentInput.members,
      mode
    );
    setInput({ ...currentInput, members });
    let msg = `Imported ${members.length} member(s)`;
    if (badCells > 0) msg += ` (${badCells} cell(s) need attention)`;
    if (warnings.length > 0) msg += " — " + warnings[0];
    showToast(msg, 5000);
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {toast && (
        <div className="fixed top-4 right-4 bg-gray-900 text-white text-sm px-4 py-2 rounded-lg shadow z-50">
          {toast}
        </div>
      )}
      {showImport && (
        <CsvImportDialog
          onImport={handleImportFile}
          onClose={() => setShowImport(false)}
        />
      )}

      {/* Header */}
      <div className="flex flex-wrap gap-3 items-center mb-4">
        {/* Back to parent */}
        {record?.parentId && parentName !== undefined && (
          <Link
            to={`/plan/${record.parentId}`}
            className="text-sm text-blue-600 hover:underline mr-2"
          >
            ← Parent #{record.parentId}{parentName ? `: ${parentName}` : ""}
          </Link>
        )}

        <input
          value={planName}
          onChange={(e) => setPlanName(e.target.value)}
          disabled={locked}
          className="border rounded-lg px-3 py-2 text-lg font-semibold flex-1 min-w-48 disabled:opacity-60 disabled:cursor-not-allowed"
          placeholder="Plan name"
        />

        {record && <LockBadge locked={locked} />}

        <button
          onClick={handleSave}
          disabled={saving || locked}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
        >
          {saving ? "Saving…" : "Save"}
        </button>

        {record && (
          <button
            onClick={handleDuplicate}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm"
          >
            Duplicate
          </button>
        )}
      </div>

      {/* Locked banner */}
      {locked && (
        <div className="mb-4 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
          🔒 This plan is locked (read-only). Duplicate it to make changes.
        </div>
      )}

      {/* Config */}
      <ConfigPanel input={currentInput} disabled={locked} onChange={setInput} />

      {/* Boss panel */}
      <BossPanel input={currentInput} disabled={locked} onChange={setInput} />

      {/* Feasibility bar */}
      <FeasibilityBar input={currentInput} />

      {/* CSV buttons */}
      <div className="flex gap-2 mb-4">
        <button
          disabled={locked}
          onClick={() => setShowImport(true)}
          className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50"
        >
          Import CSV
        </button>
        <button
          onClick={handleExport}
          className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
        >
          Export CSV
        </button>
      </div>

      {/* Members matrix */}
      {locked ? (
        <details className="border rounded-lg mb-4">
          <summary className="px-4 py-2 cursor-pointer select-none font-medium text-gray-700 flex items-center gap-2">
            👥 Member Damage Table
            <span className="text-xs text-gray-400 font-normal">({currentInput.members.length} members — click to expand)</span>
          </summary>
          <div className="px-4 py-3">
            <MembersMatrixTable
              input={currentInput}
              disabled={locked}
              onChange={setInput}
            />
          </div>
        </details>
      ) : (
        <MembersMatrixTable
          input={currentInput}
          disabled={locked}
          onChange={setInput}
        />
      )}

      {/* Compute */}
      <div className="mt-6 flex gap-3">
        <button
          onClick={handleCompute}
          disabled={computing || currentInput.members.length === 0}
          className="px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium"
        >
          {computing ? "Computing…" : "Compute Plan"}
        </button>
        {record && (
          <Link
            to={`/plan/${record.id}`}
            className="px-6 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium text-center"
          >
            View Summary
          </Link>
        )}
      </div>
    </div>
  );
}
