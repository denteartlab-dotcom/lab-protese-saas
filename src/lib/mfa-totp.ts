/**
 * MFA TOTP (Google Authenticator / Authy) para proprietário e master.
 * Secrets criptografados em AES-256-GCM com MFA_ENCRYPTION_KEY ou JWT_SECRET.
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import * as OTPAuth from "otpauth";
import { SignJWT, jwtVerify } from "jose";
import { usuarioEhProprietario } from "@/lib/usuarios-sistema";

const MFA_PENDING_TTL = "10m";
const ALG = "aes-256-gcm";

export type MfaPendingKind = "lab" | "master";
export type MfaPendingPurpose = "setup" | "verify";

export type MfaPendingPayload = {
  kind: MfaPendingKind;
  purpose: MfaPendingPurpose;
  userId: string;
  email: string;
  remember?: boolean;
  /** Secret em claro só no token de setup (ainda não persistido). */
  secret?: string;
};

function chaveCriptografia(): Buffer {
  const raw =
    process.env.MFA_ENCRYPTION_KEY?.trim() ||
    process.env.JWT_SECRET?.trim() ||
    "";
  if (!raw) throw new Error("JWT_SECRET não configurado para MFA");
  return createHash("sha256").update(raw).digest();
}

function jwtSecretMfa(): Uint8Array {
  const raw = process.env.JWT_SECRET?.trim();
  if (!raw) throw new Error("JWT_SECRET não configurado");
  return new TextEncoder().encode(`mfa-pending:${raw}`);
}

export function criptografarSegredoMfa(secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALG, chaveCriptografia(), iv);
  const enc = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64url")}:${tag.toString("base64url")}:${enc.toString("base64url")}`;
}

export function descriptografarSegredoMfa(payload: string): string {
  const partes = payload.split(":");
  if (partes.length !== 4 || partes[0] !== "v1") {
    throw new Error("Segredo MFA inválido");
  }
  const iv = Buffer.from(partes[1], "base64url");
  const tag = Buffer.from(partes[2], "base64url");
  const data = Buffer.from(partes[3], "base64url");
  const decipher = createDecipheriv(ALG, chaveCriptografia(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

export function gerarSegredoTotp(): string {
  const totp = new OTPAuth.TOTP({
    issuer: "Lab Protese",
    label: "conta",
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: new OTPAuth.Secret({ size: 20 }),
  });
  return totp.secret.base32;
}

export function uriOtpauth(opts: {
  secret: string;
  email: string;
  issuer?: string;
}): string {
  const totp = new OTPAuth.TOTP({
    issuer: opts.issuer || "Lab Protese",
    label: opts.email,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(opts.secret),
  });
  return totp.toString();
}

export function validarCodigoTotp(secret: string, codigo: string): boolean {
  const limpo = codigo.replace(/\s+/g, "");
  if (!/^\d{6}$/.test(limpo)) return false;
  const totp = new OTPAuth.TOTP({
    issuer: "Lab Protese",
    label: "conta",
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  });
  const delta = totp.validate({ token: limpo, window: 1 });
  return delta !== null;
}

export async function criarTokenMfaPending(payload: MfaPendingPayload): Promise<string> {
  return new SignJWT({
    kind: payload.kind,
    purpose: payload.purpose,
    userId: payload.userId,
    email: payload.email,
    remember: payload.remember === true,
    secret: payload.secret,
    mfaPending: true,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(MFA_PENDING_TTL)
    .sign(jwtSecretMfa());
}

export async function lerTokenMfaPending(
  token: string
): Promise<MfaPendingPayload | null> {
  try {
    const { payload } = await jwtVerify(token, jwtSecretMfa());
    if (payload.mfaPending !== true) return null;
    if (payload.kind !== "lab" && payload.kind !== "master") return null;
    if (payload.purpose !== "setup" && payload.purpose !== "verify") return null;
    if (typeof payload.userId !== "string" || typeof payload.email !== "string") {
      return null;
    }
    return {
      kind: payload.kind,
      purpose: payload.purpose,
      userId: payload.userId,
      email: payload.email,
      remember: payload.remember === true,
      secret: typeof payload.secret === "string" ? payload.secret : undefined,
    };
  } catch {
    return null;
  }
}

/** MFA obrigatório para proprietário (e aliases) e master. */
export function roleExigeMfa(role: string, kind: MfaPendingKind = "lab"): boolean {
  if (kind === "master") return role === "MASTER_ADMIN";
  return usuarioEhProprietario(role);
}

/**
 * Antes de MFA_ENFORCE_AFTER (ISO), setup pode ser pulado uma vez.
 * Se a env não existir, usa agora+7d a partir do boot (cache de processo).
 */
let enforceAfterCache: number | null = null;

export function mfaEnforceAfterMs(): number {
  const raw = process.env.MFA_ENFORCE_AFTER?.trim();
  if (raw) {
    const t = Date.parse(raw);
    if (!Number.isNaN(t)) return t;
  }
  if (enforceAfterCache == null) {
    enforceAfterCache = Date.now() + 7 * 24 * 60 * 60 * 1000;
  }
  return enforceAfterCache;
}

export function mfaAindaEmGraca(): boolean {
  return Date.now() < mfaEnforceAfterMs();
}

export function mfaPodePularSetup(): boolean {
  return mfaAindaEmGraca();
}
