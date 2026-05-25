export type ServicoComPrazo = {
  prazo?: string | null;
  prazoDentista?: string | null;
};

export function parseDiasPrazo(value?: string | null) {
  const dias = Number(String(value ?? "").replace(/[^\d]/g, ""));
  return Number.isFinite(dias) && dias > 0 ? Math.floor(dias) : 0;
}

export function calcularDatasPrazoServico(
  servico: ServicoComPrazo,
  dataBase: Date = new Date()
) {
  const diasLab = parseDiasPrazo(servico.prazo);
  const diasAntesDentista = parseDiasPrazo(servico.prazoDentista);
  const base = new Date(dataBase.getFullYear(), dataBase.getMonth(), dataBase.getDate());

  let dataLaboratorio = "";
  let dataDentista = "";

  if (diasLab > 0) {
    const laboratorio = new Date(base);
    laboratorio.setDate(laboratorio.getDate() + diasLab);
    dataLaboratorio = laboratorio.toLocaleDateString("pt-BR");

    if (diasAntesDentista > 0) {
      const dentista = new Date(laboratorio);
      dentista.setDate(dentista.getDate() - diasAntesDentista);
      dataDentista = dentista.toLocaleDateString("pt-BR");
    }
  }

  return { dataLaboratorio, dataDentista };
}
