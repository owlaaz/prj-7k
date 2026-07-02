import { useState } from "react";
import type { ImportMode } from "../lib/csv";

interface Props {
  onImport: (file: File, mode: ImportMode) => void;
  onClose: () => void;
}

export default function CsvImportDialog({ onImport, onClose }: Props) {
  const [mode, setMode] = useState<ImportMode>("replace");
  const [file, setFile] = useState<File | null>(null);

  function handleImport() {
    if (!file) return;
    onImport(file, mode);
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
        <h2 className="text-lg font-semibold mb-4">Import CSV</h2>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            CSV File
          </label>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
        </div>

        <div className="mb-5">
          <p className="text-sm font-medium text-gray-700 mb-2">Import Mode</p>
          <label className="flex items-center gap-2 text-sm cursor-pointer mb-1.5">
            <input
              type="radio"
              checked={mode === "replace"}
              onChange={() => setMode("replace")}
            />
            <div>
              <span className="font-medium">Replace</span>
              <span className="text-gray-500 ml-1">— clear roster and load all rows from file</span>
            </div>
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="radio"
              checked={mode === "merge"}
              onChange={() => setMode("merge")}
            />
            <div>
              <span className="font-medium">Merge by name</span>
              <span className="text-gray-500 ml-1">— update matching members, append new ones</span>
            </div>
          </label>
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            disabled={!file}
            onClick={handleImport}
            className="px-4 py-2 rounded-lg text-sm bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Import
          </button>
        </div>
      </div>
    </div>
  );
}
