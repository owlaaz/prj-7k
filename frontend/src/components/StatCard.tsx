interface Props {
  label: string;
  value: string | number;
  sub?: string;
  highlight?: boolean;
  className?: string;
}

export default function StatCard({ label, value, sub, highlight, className = "" }: Props) {
  return (
    <div
      className={`rounded-xl border p-4 flex flex-col gap-1 ${
        highlight ? "border-green-400 bg-green-50" : "border-gray-200 bg-white"
      } ${className}`}
    >
      <div className="text-xs text-gray-500 uppercase tracking-wide font-medium">{label}</div>
      <div className={`text-2xl font-bold ${highlight ? "text-green-700" : "text-gray-900"}`}>
        {value}
      </div>
      {sub && <div className="text-xs text-gray-400">{sub}</div>}
    </div>
  );
}
