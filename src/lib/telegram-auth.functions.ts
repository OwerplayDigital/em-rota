import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const ALLOWED_EMAIL = "owertech82@gmail.com";
const MAX_AUTH_AGE_SECONDS = 15 * 60;

function bytesToHex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function hexToBytes(hex: string) {
  if (!/^[0-9a-f]{64}$/i.test(hex)) return null;
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

async function validateTelegramInitData(initData: string, botToken: string, allowedUserId: string) {
  const params = new URLSearchParams(initData);
  const receivedHash = params.get("hash");
  const authDateRaw = params.get("auth_date");
  const userRaw = params.get("user");

  if (!receivedHash || !authDateRaw || !userRaw) {
    throw new Error("Dados do Telegram incompletos.");
  }

  const authDate = Number(authDateRaw);
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(authDate) || authDate > now + 60 || now - authDate > MAX_AUTH_AGE_SECONDS) {
    throw new Error("Sessão do Telegram expirada. Feche e abra o Mini App novamente.");
  }

  const dataCheckString = Array.from(params.entries())
    .filter(([key]) => key !== "hash" && key !== "signature")
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const encoder = new TextEncoder();

  const webAppDataKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode("WebAppData"),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const secretKey = await crypto.subtle.sign(
    "HMAC",
    webAppDataKey,
    encoder.encode(botToken)
  );

  const validationKey = await crypto.subtle.importKey(
    "raw",
    secretKey,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );

  const signature = hexToBytes(receivedHash);
  if (!signature) {
    throw new Error("Assinatura do Telegram inválida.");
  }

  const valid = await crypto.subtle.verify(
    "HMAC",
    validationKey,
    signature,
    encoder.encode(dataCheckString)
  );

  if (!valid) {
    throw new Error("Não foi possível validar a identidade do Telegram.");
  }

  let user: { id?: string | number };
  try {
    user = JSON.parse(userRaw);
  } catch {
    throw new Error("Usuário do Telegram inválido.");
  }

  if (String(user.id ?? "") !== allowedUserId) {
    throw new Error("Este usuário do Telegram não está autorizado.");
  }

  return true;
}

export const createTelegramWebAppSession = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z.object({
      initData: z.string().min(1).max(20000),
    }).parse(data)
  )
  .handler(async ({ data }) => {
    const botToken = process.env["TELEGRAM_BOT_TOKEN"];
    const allowedUserId = process.env["TELEGRAM_ALLOWED_USER_ID"];

    if (!botToken || !allowedUserId) {
      throw new Error("Configuração do Telegram indisponível.");
    }

    await validateTelegramInitData(data.initData, botToken, allowedUserId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: linkData, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: ALLOWED_EMAIL,
    });

    if (error || !linkData.properties?.hashed_token) {
      console.error("Failed to generate Telegram Mini App auth link:", error);
      throw new Error("Não foi possível criar a sessão do Mini App.");
    }

    return {
      email: ALLOWED_EMAIL,
      tokenHash: linkData.properties.hashed_token,
    };
  });
