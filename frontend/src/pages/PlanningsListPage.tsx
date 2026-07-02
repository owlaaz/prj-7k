import { useEffect, useState, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import type { PlanningListItem } from "../planner/types";
import { listPlannings, deletePlan, lockPlan, duplicatePlan } from "../api/plannings";
import LockBadge from "../components/LockBadge";

export default function PlanningsListPage() {
  const [plans, setPlans] = useState<PlanningListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navigate = useNavigate();

  async function load() {
    setLoading(true);
    try {
      setPlans(await listPlannings());
    } catch (e) {
      showToast("Failed to load plans");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function showToast(msg: string) {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }

  async function handleDelete(id: number) {
    if (!confirm(`Delete plan #${id}?`)) return;
    await deletePlan(id);
    showToast(`Plan #${id} deleted`);
    load();
  }

  async function handleLock(id: number) {
    if (!confirm(`Lock plan #${id}? This cannot be undone — the plan will become read-only permanently.`)) return;
    await lockPlan(id, true);
    showToast(`Plan #${id} locked`);
    load();
  }

  async function handleDuplicate(id: number) {
    const dup = await duplicatePlan(id);
    showToast(`Duplicated as #${dup.id}`);
    navigate(`/plan/${dup.id}/edit`);
  }

  function copyShareLink(id: number) {
    const url = `${window.location.origin}/plan/${id}`;
    navigator.clipboard.writeText(url).then(() => showToast("Share link copied!"));
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {toast && (
        <div className="fixed top-4 right-4 bg-gray-900 text-white text-sm px-4 py-2 rounded-lg shadow-lg z-50 animate-fade-in">
          {toast}
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Guild Boss Fight Plans</h1>
        <Link
          to="/plan/new"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          + New Planning
        </Link>
      </div>

      {loading && <p className="text-gray-400">Loading…</p>}

      {!loading && plans.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <p className="text-lg mb-2">No plans yet.</p>
          <p className="text-sm">
            <Link to="/plan/new" className="text-blue-600 hover:underline">
              Create your first plan
            </Link>{" "}
            to get started.
          </p>
        </div>
      )}

      {!loading && plans.length > 0 && (
        <div className="rounded-xl border overflow-hidden">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-gray-500">ID</th>
                <th className="px-4 py-3 text-left text-gray-500">Name</th>
                <th className="px-4 py-3 text-center text-gray-500">Status</th>
                <th className="px-4 py-3 text-center text-gray-500">Members</th>
                <th className="px-4 py-3 text-center text-gray-500">Bosses</th>
                <th className="px-4 py-3 text-left text-gray-500">Updated</th>
                <th className="px-4 py-3 text-left text-gray-500">Source</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {plans.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-gray-500">#{p.id}</td>
                  <td className="px-4 py-3">
                    <Link
                      to={`/plan/${p.id}`}
                      className="font-medium text-gray-900 hover:text-blue-600"
                    >
                      {p.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {p.locked ? <LockBadge locked /> : <span className="text-xs text-green-600">Editable</span>}
                  </td>
                  <td className="px-4 py-3 text-center text-gray-600">{p.memberCount}</td>
                  <td className="px-4 py-3 text-center text-gray-600">{p.bossCount}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                    {new Date(p.updatedAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {p.parentId &&
                      plans.find((x) => x.id === p.parentId) && (
                        <Link
                          to={`/plan/${p.parentId}`}
                          className="text-blue-500 hover:underline"
                        >
                          from #{p.parentId}
                        </Link>
                      )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1 items-center justify-end flex-wrap">
                      <Link
                        to={`/plan/${p.id}`}
                        className="px-2 py-1 text-xs rounded bg-gray-100 hover:bg-gray-200"
                      >
                        Open
                      </Link>
                      <Link
                        to={`/plan/${p.id}/edit`}
                        className="px-2 py-1 text-xs rounded bg-gray-100 hover:bg-gray-200"
                      >
                        Edit
                      </Link>
                      <button
                        onClick={() => handleDuplicate(p.id)}
                        className="px-2 py-1 text-xs rounded bg-gray-100 hover:bg-gray-200"
                      >
                        Duplicate
                      </button>
                      {!p.locked && (
                        <button
                          onClick={() => handleLock(p.id)}
                          className="px-2 py-1 text-xs rounded bg-gray-100 hover:bg-gray-200"
                        >
                          Lock
                        </button>
                      )}
                      <button
                        onClick={() => copyShareLink(p.id)}
                        className="px-2 py-1 text-xs rounded bg-gray-100 hover:bg-gray-200"
                      >
                        Share
                      </button>
                      <button
                        onClick={() => handleDelete(p.id)}
                        className="px-2 py-1 text-xs rounded text-red-600 border border-red-200 hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
