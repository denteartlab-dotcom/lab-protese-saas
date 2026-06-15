import { Suspense } from "react";
import MasterLoginForm from "./MasterLoginForm";

export default function MasterLoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#f4f6f8]" />}>
      <MasterLoginForm />
    </Suspense>
  );
}
