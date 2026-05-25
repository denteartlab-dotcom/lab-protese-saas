"use client";

import { Button } from "@/components/ui";

export function PrintActions({ numeroOs }: { numeroOs: number }) {
  return (
    <div className="no-print fixed right-4 top-4 flex gap-2">
      <Button onClick={() => window.print()}>Imprimir</Button>
      <Button
        variant="secondary"
        onClick={() => {
          document.title = `OS-${numeroOs}`;
          window.print();
        }}
      >
        Baixar PDF
      </Button>
      <Button variant="outline" onClick={() => window.close()}>
        Fechar
      </Button>
    </div>
  );
}
