import crypto from "node:crypto";

export function validateTelegramMiniAppInitData(initData: string) {
  const botToken = process.env["TELEGRAM_BOT_TOKEN"];
  const allowedUserId = process.env["TELEGRAM_ALLOWED_USER_ID"];

  if (!botToken || !allowedUserId) {
    throw new Error("Telegram Mini App não está configurado no servidor.");
  }

  const params = new URLSearchParams(initData);
  const receivedHash = params.get("hash");
  if (!receivedHash) throw new Error("Dados do Telegram inválidos.");

  params.delete("hash");
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");

  const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const calculatedHash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  const received = Buffer.from(receivedHash, "hex");
  const calculated = Buffer.from(calculatedHash, "hex");
  if (received.length !== calculated.length || !crypto.timingSafeEqual(received, calculated)) {
    throw new Error("Assinatura do Telegram inválida.");
  }

  const authDate = Number(params.get("auth_date") || 0);
  const now = Math.floor(Date.now() / 1000);
  if (!authDate || authDate > now + 30 || now - authDate > 600) {
    throw new Error("Sessão do Telegram expirada. Feche e abra o Mini App novamente.");
  }

  const userRaw = params.get("user");
  if (!userRaw) throw new Error("Usuário do Telegram não informado.");

  let user: { id?: number; first_name?: string } = {};
  try {
    user = JSON.parse(userRaw);
  } catch {
    throw new Error("Usuário do Telegram inválido.");
  }

  if (!user.id || String(user.id) !== String(allowedUserId)) {
    throw new Error("Acesso do Telegram não autorizado.");
  }

  return { success: true, userId: String(user.id), firstName: user.first_name ?? null };
}
