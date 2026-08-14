import { mfaDisablePost } from "@/lib/mfa-settings";

export async function POST(request: Request) {
  return mfaDisablePost(request);
}
