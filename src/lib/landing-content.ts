import {
  BarChart3,
  ClipboardList,
  Factory,
  LayoutDashboard,
  MessageCircle,
  Monitor,
  Plug,
  Settings2,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export const WHATSAPP_LANDING_URL =
  "https://wa.me/5533988466838?text=" +
  encodeURIComponent(
    "Olá! Gostaria de saber mais sobre o Lab Prótese para meu laboratório."
  );

export const LANDING_NAV = [
  { id: "inicio", label: "Início" },
  { id: "sobre", label: "Sobre" },
  { id: "funcionalidades", label: "Funcionalidades" },
  { id: "planos", label: "Planos" },
  { id: "contato", label: "Contato" },
] as const;

export type BeneficioLanding = {
  titulo: string;
  descricao: string;
  Icon: LucideIcon;
};

export const BENEFICIOS_LANDING: BeneficioLanding[] = [
  {
    titulo: "Sistema Personalizado",
    descricao:
      "Configure etapas, setores, tabelas de preço e layout de documentos conforme a rotina do seu laboratório.",
    Icon: Settings2,
  },
  {
    titulo: "Controle de Produção",
    descricao:
      "Acompanhe cada trabalho por etapa, prazo e responsável — do recebimento à entrega.",
    Icon: Factory,
  },
  {
    titulo: "Controle Financeiro",
    descricao:
      "Faturamento, contas a receber, extratos e relatórios financeiros integrados aos trabalhos.",
    Icon: Wallet,
  },
  {
    titulo: "Portal do Cliente",
    descricao:
      "Dentistas acompanham status, orçamentos e entregas com transparência e agilidade.",
    Icon: Users,
  },
  {
    titulo: "Relatórios Gerenciais",
    descricao:
      "Dashboards e relatórios para decisões sobre produção, margem, clientes e fluxo de caixa.",
    Icon: BarChart3,
  },
  {
    titulo: "Integração com WhatsApp",
    descricao:
      "Comunicação rápida com clientes e equipe, mantendo o atendimento próximo do dia a dia.",
    Icon: MessageCircle,
  },
];

export type FuncionalidadeLanding = {
  titulo: string;
  Icon: LucideIcon;
};

export const FUNCIONALIDADES_LANDING: FuncionalidadeLanding[] = [
  { titulo: "Controle de trabalhos", Icon: ClipboardList },
  { titulo: "Financeiro", Icon: Wallet },
  { titulo: "Módulo TV", Icon: Monitor },
  { titulo: "Portal do cliente", Icon: Users },
  { titulo: "Relatórios", Icon: BarChart3 },
  { titulo: "APIs e integrações", Icon: Plug },
];

export const MOCKUP_TELAS = [
  { id: "dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { id: "trabalhos", label: "Trabalhos", Icon: ClipboardList },
  { id: "producao", label: "Produção", Icon: Factory },
  { id: "financeiro", label: "Financeiro", Icon: Wallet },
  { id: "relatorios", label: "Relatórios", Icon: BarChart3 },
] as const;

export type MockupTelaId = (typeof MOCKUP_TELAS)[number]["id"];
