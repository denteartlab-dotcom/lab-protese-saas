import { mfaEnableStartPost } from "@/lib/mfa-settings";

export async function POST(request: Request) {
  return mfaEnableStartPost(request);
}
