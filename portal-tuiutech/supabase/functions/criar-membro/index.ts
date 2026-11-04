// Edge Function: só o administrador cria acessos e redefine senhas.
// A chave service_role fica aqui no servidor (o Supabase já fornece), nunca no site.
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

  // 1. Quem está chamando? Precisa estar logado e ser admin.
  const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
  const { data: quem } = await admin.auth.getUser(token);
  if (!quem?.user) return responder({ erro: "Faça login novamente." }, 401);

  const { data: eu } = await admin.from("perfis").select("papel").eq("user_id", quem.user.id).single();
  if (eu?.papel !== "admin") return responder({ erro: "Só o administrador pode fazer isso." }, 403);

  // 2. Validar os dados
  const { acao, codigo, nome, senha } = await req.json();
  if (!/^[0-9A-Za-z]{2,10}$/.test(codigo ?? "")) {
    return responder({ erro: "O ID deve ter de 2 a 10 letras ou números." }, 400);
  }
  if (typeof senha !== "string" || senha.length < 4) {
    return responder({ erro: "A senha precisa ter pelo menos 4 caracteres." }, 400);
  }
  const id = codigo.toLowerCase();

  // 3a. Redefinir senha de quem já existe
  if (acao === "redefinir") {
    const { data: perfil } = await admin.from("perfis").select("user_id").eq("codigo", id).single();
    if (!perfil) return responder({ erro: "ID não encontrado." }, 404);
    const { error } = await admin.auth.admin.updateUserById(perfil.user_id, { password: senha });
    if (error) return responder({ erro: error.message }, 400);
    return responder({ ok: true });
  }

  // 3b. Criar acesso novo
  if (!nome || String(nome).trim().length < 2) return responder({ erro: "Informe o nome." }, 400);

  const { data: novo, error: erroCriar } = await admin.auth.admin.createUser({
    email: `${id}@tuiutech.app`,
    password: senha,
    email_confirm: true,
  });
  if (erroCriar) {
    const jaExiste = /already|registered/i.test(erroCriar.message);
    return responder({ erro: jaExiste ? "Esse ID já existe." : erroCriar.message }, 400);
  }

  const { error: erroPerfil } = await admin.from("perfis").insert({
    user_id: novo.user.id,
    codigo: id,
    nome: String(nome).trim(),
    papel: "membro",
  });
  if (erroPerfil) {
    await admin.auth.admin.deleteUser(novo.user.id);
    return responder({ erro: erroPerfil.message }, 400);
  }
  return responder({ ok: true });
});
