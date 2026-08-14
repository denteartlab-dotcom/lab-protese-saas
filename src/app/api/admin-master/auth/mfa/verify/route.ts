import { POST_VERIFY } from "@/lib/mfa-handlers";

export async function POST(request: Request) {
  return POST_VERIFY(request);
}
