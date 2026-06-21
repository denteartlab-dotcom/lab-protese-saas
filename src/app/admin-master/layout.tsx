import { montarTituloDocumento } from "@/lib/document-title";

export const metadata = {
  title: montarTituloDocumento(),
};

export default function AdminMasterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
