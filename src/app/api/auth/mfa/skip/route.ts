import { POST_SKIP } from "@/lib/mfa-handlers";

export async function POST(request: Request) {
  return POST_SKIP(request);
}
