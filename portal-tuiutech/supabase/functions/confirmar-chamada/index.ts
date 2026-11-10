// A localização e o código são validados aqui, antes de registrar presença.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Ponto inicial aproximado do SENAI Cuiabá, Av. XV de Novembro, 303.
// Fonte das coordenadas: https://www.escolasnobrasil.com/centro-oeste/senai-cuiaba-cuiaba
// Ajuste ao laboratório se necessário. Os Secrets abaixo substituem estes padrões.
const LOCAL_PADRAO = { latitude: -15.60857, longitude: -56.10115, raio: 100, precisao: 50 };
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const responder = (corpo: unknown, status = 200) => new Response(JSON.stringify(corpo), {
  status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
});

function numeroConfigurado(nome: string, padrao: number): number {
  const valor = Deno.env.get(nome);
  return valor === undefined ? padrao : (valor.trim() === "" ? NaN : Number(valor));
}

function distanciaMetros(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const rad = (graus: number) => graus * Math.PI / 180;
  const a = Math.sin(rad(lat2 - lat1) / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lon2 - lon1) / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, a))));
}

function validarLocalizacao(localizacao: unknown): string | null {
  const latitude = numeroConfigurado("CHAMADA_LATITUDE", LOCAL_PADRAO.latitude);
  const longitude = numeroConfigurado("CHAMADA_LONGITUDE", LOCAL_PADRAO.longitude);
  const raio = numeroConfigurado("CHAMADA_RAIO_METROS", LOCAL_PADRAO.raio);
  const precisaoMaxima = numeroConfigurado("CHAMADA_PRECISAO_MAXIMA_METROS", LOCAL_PADRAO.precisao);
  if (![latitude, longitude, raio, precisaoMaxima].every(Number.isFinite) ||
      Math.abs(latitude) > 90 || Math.abs(longitude) > 180 || raio <= 0 || precisaoMaxima <= 0) {
    return "O local da chamada está configurado incorretamente. Avise o administrador.";
  }
  if (!localizacao || typeof localizacao !== "object" || Array.isArray(localizacao)) {
    return "Verifique sua localização antes de confirmar presença.";
  }
  const ponto = localizacao as Record<string, unknown>;
  const { latitude: lat, longitude: lon, precisao, timestamp } = ponto;
  if (typeof lat !== "number" || !Number.isFinite(lat) || Math.abs(lat) > 90 ||
      typeof lon !== "number" || !Number.isFinite(lon) || Math.abs(lon) > 180 ||
      typeof precisao !== "number" || !Number.isFinite(precisao) || precisao <= 0 ||
      typeof timestamp !== "number" || !Number.isFinite(timestamp)) {
    return "A localização recebida é inválida. Verifique novamente.";
  }
  const idade = Date.now() - timestamp;
  if (idade > 60000 || idade < -10000) {
    return "A localização expirou. Confira o relógio do aparelho e verifique novamente.";
  }
  if (precisao > precisaoMaxima) {
    return "Sua localização está imprecisa. Ative a localização precisa e tente em um lugar com melhor sinal.";
  }
  const distancia = distanciaMetros(latitude, longitude, lat, lon);
  if (distancia > raio) {
    return `Você precisa estar no local da equipe, dentro do raio de ${raio} metros, para fazer a chamada.`;
  }
  // A margem de erro também precisa caber no raio: não expandir a área permitida.
  if (distancia + precisao > raio) {
    return "Você está perto do limite da área permitida. Aproxime-se do local da equipe e verifique novamente.";
  }
  return null;
}

function hojeCuiaba(): string {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Cuiaba", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date());
  const valor = (tipo: string) => partes.find(p => p.type === tipo)!.value;
  return `${valor("year")}-${valor("month")}-${valor("day")}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return responder({ erro: "Método não permitido." }, 405);

  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!token) return responder({ erro: "Faça login novamente." }, 401);
    const { data: quem, error: erroAuth } = await admin.auth.getUser(token);
    if (erroAuth || !quem?.user) return responder({ erro: "Faça login novamente." }, 401);

    let corpo;
    try { corpo = await req.json(); } catch { return responder({ erro: "Requisição inválida." }, 400); }
    if (!corpo || typeof corpo !== "object" || Array.isArray(corpo)) {
      return responder({ erro: "Requisição inválida." }, 400);
    }
    const { acao = "confirmar", codigo, data, localizacao } = corpo;
    if (acao !== "confirmar" && acao !== "verificar-localizacao") {
      return responder({ erro: "Ação inválida." }, 400);
    }
    // Nunca aceitar uma liberação/raio enviados pelo cliente como prova de localização.
    const erroLocalizacao = validarLocalizacao(localizacao);
    if (erroLocalizacao) return responder({ ok: false, erro: erroLocalizacao }, 403);
    if (acao === "verificar-localizacao") return responder({ ok: true, localizacaoValidada: true });

    if (typeof codigo !== "string" || !/^[0-9]{3}$/.test(codigo)) {
      return responder({ erro: "Código inválido." }, 400);
    }
    if (data !== hojeCuiaba()) return responder({ erro: "Atualize a página para confirmar a chamada de hoje." }, 400);
    const { data: chamada, error: erroChamada } = await admin.from("chamadas")
      .select("codigo").eq("data", data).maybeSingle();
    if (erroChamada) return responder({ erro: "Não foi possível consultar a chamada. Tente novamente." }, 500);
    if (!chamada || chamada.codigo !== codigo) return responder({ ok: false, erro: "Código incorreto." });

    const { error } = await admin.from("presencas")
      .upsert({ user_id: quem.user.id, data }, { onConflict: "user_id,data", ignoreDuplicates: true });
    if (error) return responder({ erro: "Não foi possível registrar sua presença. Tente novamente." }, 500);
    return responder({ ok: true, localizacaoValidada: true });
  } catch {
    return responder({ erro: "Não foi possível confirmar agora. Tente novamente." }, 500);
  }
});
