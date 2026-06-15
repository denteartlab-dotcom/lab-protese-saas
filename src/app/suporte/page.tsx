import Link from "next/link";
import { redirect } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function SuportePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const whatsapp = process.env.SUPPORT_WHATSAPP?.trim().replace(/\D/g, "") || "";
  const linkWhatsapp = whatsapp
    ? `https://wa.me/55${whatsapp}?text=${encodeURIComponent(
        "Olá, preciso de ajuda com minha assinatura do Lab Prótese."
      )}`
    : null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-100 bg-white p-6 text-center shadow-sm">
        <h1 className="text-lg font-bold text-slate-900">Suporte</h1>
        <p className="mt-2 text-sm text-slate-600">
          Fale com nossa equipe para regularizar sua assinatura ou tirar dúvidas.
        </p>
        {linkWhatsapp ? (
          <a
            href={linkWhatsapp}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#25D366] text-sm font-semibold text-white hover:bg-[#1fb855]"
          >
            <MessageCircle className="h-4 w-4" />
            WhatsApp
          </a>
        ) : (
          <p className="mt-5 text-sm text-slate-500">
            Configure SUPPORT_WHATSAPP no servidor para exibir o contato.
          </p>
        )}
        <Link
          href="/assinatura-vencida"
          className="mt-3 inline-block text-sm font-medium text-[#0066FF] hover:underline"
        >
          Voltar para renovação
        </Link>
      </div>
    </div>
  );
}
