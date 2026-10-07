import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const validateTelegramMiniApp = createServerFn({ method: "POST" })
  .inputValidator(z.object({ initData: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { validateTelegramMiniAppInitData } = await import("@/integrations/supabase/telegram-miniapp.server");
    return validateTelegramMiniAppInitData(data.initData);
  });

export const createTelegramMiniAppLogin = createServerFn({ method: "POST" })
  .inputValidator(z.object({ initData: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { createTelegramMiniAppLogin } = await import("@/integrations/supabase/telegram-miniapp.server");
    return createTelegramMiniAppLogin(data.initData);
  });
