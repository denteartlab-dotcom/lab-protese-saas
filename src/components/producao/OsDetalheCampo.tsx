export function OsDetalheCampo({
  label,
  value,
  emptyValue = "",
}: {
  label: string;
  value: string;
  emptyValue?: string;
}) {
  return (
    <div>
      <p className="font-semibold text-slate-500">{label}:</p>
      <p className="whitespace-pre-wrap text-slate-700">{value || emptyValue}</p>
    </div>
  );
}
