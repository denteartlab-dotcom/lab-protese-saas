"use client";

import { srcIframePdfViewer } from "@/lib/pdf-viewer-iframe";

type Props = {
  id?: string;
  title: string;
  pdfUrl: string;
  onLoad?: () => void;
};

export function PdfViewerIframe({ id, title, pdfUrl, onLoad }: Props) {
  return (
    <div className="relative min-h-0 flex-1 overflow-hidden bg-[#525659]">
      <iframe
        id={id}
        title={title}
        src={srcIframePdfViewer(pdfUrl)}
        onLoad={onLoad}
        className="absolute inset-0 h-full w-full border-0 bg-[#525659]"
      />
    </div>
  );
}
