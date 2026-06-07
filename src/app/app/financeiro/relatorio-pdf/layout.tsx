/** Visualização de PDF — sem menu do app (tela cheia). */
export default function RelatorioPdfLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="fixed inset-0 z-[9999] bg-[#525659]">{children}</div>;
}
