import { POST_SETUP_CONFIRM } from "@/lib/mfa-handlers";

export async function POST(request: Request) {
  return POST_SETUP_CONFIRM(request);
}
