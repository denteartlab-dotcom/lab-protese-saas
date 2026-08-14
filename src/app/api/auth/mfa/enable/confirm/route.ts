import { mfaEnableConfirmPost } from "@/lib/mfa-settings";

export async function POST(request: Request) {
  return mfaEnableConfirmPost(request);
}
