// Edge Function: confere o código da chamada e registra a presença.
// O código certo do dia nunca é enviado ao navegador de quem está confirmando —
// só esta função (rodando no servidor) sabe o valor e compara.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const responder = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
  const { data: quem } = await admin.auth.getUser(token);
  if (!quem?.user) return responder({ erro: "Faça login novamente." }, 401);

  const { codigo, data } = await req.json();
  if (!/^[0-9]{3}$/.test(codigo ?? "")) return responder({ erro: "Código inválido." }, 400);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data ?? "")) return responder({ erro: "Data inválida." }, 400);

  const { data: chamada } = await admin.from("chamadas").select("codigo").eq("data", data).single();
  if (!chamada || chamada.codigo !== codigo) {
    return responder({ ok: false, erro: "Código incorreto." });
  }

  const { error } = await admin
    .from("presencas")
    .upsert({ user_id: quem.user.id, data }, { onConflict: "user_id,data", ignoreDuplicates: true });
  if (error) return responder({ erro: error.message }, 400);

  return responder({ ok: true });
});
