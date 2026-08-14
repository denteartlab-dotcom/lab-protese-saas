import { mfaStatusGet } from "@/lib/mfa-settings";

export async function GET() {
  return mfaStatusGet();
}
