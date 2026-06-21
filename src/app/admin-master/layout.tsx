import { NOME_LAB_PADRAO } from "@/lib/document-title";

export const metadata = {
  title: NOME_LAB_PADRAO,
};

export default function AdminMasterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
