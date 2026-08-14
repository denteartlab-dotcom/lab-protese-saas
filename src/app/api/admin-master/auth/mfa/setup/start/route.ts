import { POST_SETUP_START } from "@/lib/mfa-handlers";

export async function POST(request: Request) {
  return POST_SETUP_START(request);
}
