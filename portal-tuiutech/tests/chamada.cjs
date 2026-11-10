// Execute: node tests/chamada.cjs (Node >= 22.13). Nenhum acesso à rede ou banco real.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { stripTypeScriptTypes } = require('node:module');
const root = path.resolve(__dirname, '..');
const source = stripTypeScriptTypes(fs.readFileSync(path.join(root, 'supabase/functions/confirmar-chamada/index.ts'), 'utf8').replace(/^import .*;\n/m, ''));
const frontend = fs.readFileSync(path.join(root, 'chamada.js'), 'utf8');

function servidor(env = {}, autenticado = true) {
    let handler;
    const registros = new Map();
    const contexto = vm.createContext({
        Response, Date, Intl, Math, Number,
        Deno: { env: { get: nome => env[nome] }, serve: fn => { handler = fn; } },
        createClient: () => ({
            auth: { getUser: async () => ({ data: { user: autenticado ? { id: 'membro' } : null } }) },
            from: tabela => ({
                select() { return this; }, eq() { return this; },
                maybeSingle: async () => ({ data: tabela === 'chamadas' ? { codigo: '123' } : null }),
                upsert: async registro => { registros.set(`${registro.user_id}/${registro.data}`, registro); return {}; }
            })
        })
    });
    vm.runInContext(source, contexto);
    return {
        registros,
        hoje: () => vm.runInContext('hojeCuiaba()', contexto),
        async enviar(corpo, opcoes = {}) {
            const resposta = await handler(new Request('https://example.test/chamada', {
                method: 'POST', headers: { Authorization: 'Bearer teste', 'Content-Type': 'application/json' },
                body: JSON.stringify(corpo), ...opcoes
            }));
            return { status: resposta.status, body: await resposta.json() };
        },
        validar: ponto => { contexto.pontoTeste = ponto; return vm.runInContext('validarLocalizacao(pontoTeste)', contexto); },
        distancia: () => vm.runInContext('distanciaMetros(0, 0, 0, 1)', contexto)
    };
}
const local = extra => ({ latitude: -15.60857, longitude: -56.10115, precisao: 10, timestamp: Date.now(), ...extra });

async function navegador(servidorTeste = servidor(), opcoes = {}) {
    const elementos = new Map();
    const eventos = {};
    const timers = new Map();
    let proximoTimer = 0;
    let leituras = 0;
    let chamadas = 0;
    const fila = [];
    function elemento(id) {
        if (!elementos.has(id)) elementos.set(id, {
            value: '', disabled: false, textContent: '', innerHTML: '', listeners: {},
            classList: { add() {}, remove() {} }, focus() {},
            addEventListener(nome, fn) { this.listeners[nome] = fn; }
        });
        return elementos.get(id);
    }
    const doc = { hidden: false, getElementById: elemento, addEventListener: (nome, fn) => { eventos[nome] = fn; } };
    const ctx = vm.createContext({
        window: { pronto: Promise.resolve({ user_id: 'membro' }), isSecureContext: opcoes.https !== false },
        document: doc, Date, Intl, AbortController, TypeError, SyntaxError,
        navigator: { geolocation: {
            getCurrentPosition(ok, erro, config) {
                leituras++;
                assert.equal(config.maximumAge, 0);
                const dado = fila.shift() || local();
                if (dado.erro) erro({ code: dado.erro });
                else ok({ coords: { latitude: dado.latitude, longitude: dado.longitude, accuracy: dado.precisao }, timestamp: dado.timestamp });
            }
        } },
        setTimeout: (fn, ms) => { const id = ++proximoTimer; timers.set(id, { fn, ms }); return id; },
        clearTimeout: id => timers.delete(id),
        SUPABASE_URL: 'https://example.test', SUPABASE_ANON_KEY: 'teste',
        db: {
            auth: { getSession: async () => ({ data: { session: { access_token: 'teste' } } }) },
            from: () => ({ select() { return this; }, eq() { return this; }, maybeSingle: async () => ({ data: opcoes.presente ? { id: 1 } : null }) })
        },
        fetch: async (url, req) => {
            chamadas++;
            if (opcoes.falhaRede) throw new TypeError('Network error');
            if (opcoes.antigo) return { ok: true, json: async () => ({ ok: true }) };
            const resposta = await servidorTeste.enviar(JSON.parse(req.body));
            return { ok: resposta.status < 400, json: async () => resposta.body };
        }
    });
    await vm.runInContext(frontend, ctx);
    return {
        elemento, fila, doc, eventos, timers, servidor: servidorTeste,
        leituras: () => leituras, chamadas: () => chamadas,
        verificar: () => elemento('btn-verificar-localizacao').listeners.click(),
        confirmar: () => { elemento('inputCodigoChamada').value = '123'; return elemento('btn-confirmar-chamada').listeners.click(); }
    };
}

async function run() {
    let total = 0;
    async function teste(nome, fn) { await fn(); total++; }
    const s = servidor();
    await teste('distância em metros', () => assert.ok(Math.abs(s.distancia() - 111195) < 1));
    await teste('centro permitido', () => assert.equal(s.validar(local()), null));
    for (const [nome, ponto] of [
        ['sem localização', undefined], ['fora', local({ latitude: -15.61857 })],
        ['imprecisa', local({ precisao: 100 })], ['antiga', local({ timestamp: Date.now() - 61000 })],
        ['futura', local({ timestamp: Date.now() + 20000 })], ['latitude inválida', local({ latitude: 91 })],
        ['longitude inválida', local({ longitude: 181 })], ['precisão negativa', local({ precisao: -1 })],
        ['precisão nula', local({ precisao: 0 })], ['string', local({ latitude: '-15.60857' })],
        ['NaN', local({ latitude: NaN })], ['borda com erro', local({ latitude: -15.60776, precisao: 20 })]
    ]) await teste(nome, () => assert.equal(typeof s.validar(ponto), 'string'));
    await teste('configuração inválida bloqueia', () => assert.match(servidor({ CHAMADA_LATITUDE: '' }).validar(local()), /configurado/));
    await teste('centro definido no servidor', () => assert.ok(servidor({ CHAMADA_LATITUDE: '0', CHAMADA_LONGITUDE: '0' }).validar(local())));
    await teste('verificação não registra presença', async () => {
        assert.equal((await s.enviar({ acao: 'verificar-localizacao', localizacao: local() })).body.localizacaoValidada, true);
        assert.equal(s.registros.size, 0);
    });
    for (const corpo of [
        { codigo: '123', data: s.hoje() },
        { codigo: '123', data: s.hoje(), localizacao: local({ latitude: 0 }), localizacaoValidada: true, raio: 99999999 },
        { codigo: '999', data: s.hoje(), localizacao: local() },
        { codigo: '123', data: '2020-01-01', localizacao: local() }
    ]) await teste('rejeição não grava presença', async () => {
        assert.notEqual((await s.enviar(corpo)).body.ok, true);
        assert.equal(s.registros.size, 0);
    });
    await teste('sem autenticação', async () => assert.equal((await servidor({}, false).enviar({ localizacao: local() })).status, 401));
    await teste('JSON inválido', async () => assert.equal((await s.enviar({}, { body: '{' })).status, 400));
    await teste('confirmação idempotente', async () => {
        const corpo = { codigo: '123', data: s.hoje(), localizacao: local() };
        assert.equal((await s.enviar(corpo)).body.ok, true);
        assert.equal((await s.enviar(corpo)).body.ok, true);
        assert.equal(s.registros.size, 1);
        assert.deepEqual(Object.keys([...s.registros.values()][0]).sort(), ['data', 'user_id']);
    });
    await teste('fluxo completo da tela', async () => {
        const n = await navegador();
        assert.equal(n.elemento('inputCodigoChamada').disabled, true);
        await n.verificar();
        assert.equal(n.elemento('inputCodigoChamada').disabled, false);
        assert.equal(n.servidor.registros.size, 0);
        await n.confirmar();
        assert.equal(n.leituras(), 2);
        assert.equal(n.servidor.registros.size, 1);
        assert.match(n.elemento('blocoChamada').innerHTML, /Presença confirmada/);
    });
    await teste('sair do raio depois de liberar', async () => {
        const n = await navegador(); await n.verificar();
        n.fila.push(local({ latitude: 0 })); await n.confirmar();
        assert.equal(n.elemento('inputCodigoChamada').disabled, true);
        assert.equal(n.servidor.registros.size, 0);
    });
    for (const erro of [1, 2, 3]) await teste('falha do GPS bloqueia', async () => {
        const n = await navegador(); n.fila.push({ erro }); await n.verificar();
        assert.equal(n.elemento('inputCodigoChamada').disabled, true);
        assert.equal(n.chamadas(), 0);
    });
    for (const opcoes of [{ https: false }, { falhaRede: true }, { antigo: true }]) {
        await teste('falha de conexão ou servidor antigo bloqueia', async () => {
            const n = await navegador(servidor(), opcoes); await n.verificar();
            assert.equal(n.elemento('inputCodigoChamada').disabled, true);
            assert.equal(n.servidor.registros.size, 0);
        });
    }
    await teste('expiração bloqueia e limpa código', async () => {
        const n = await navegador(); await n.verificar(); n.elemento('inputCodigoChamada').value = '123';
        [...n.timers.values()].find(t => t.ms === 30000).fn();
        assert.equal(n.elemento('inputCodigoChamada').disabled, true);
        assert.equal(n.elemento('inputCodigoChamada').value, '');
        await n.confirmar(); assert.equal(n.servidor.registros.size, 0);
    });
    await teste('sair da aba bloqueia', async () => {
        const n = await navegador(); await n.verificar(); n.doc.hidden = true; n.eventos.visibilitychange();
        assert.equal(n.elemento('inputCodigoChamada').disabled, true);
    });
    await teste('presença existente preservada', async () => {
        const n = await navegador(servidor(), { presente: true });
        assert.match(n.elemento('blocoChamada').innerHTML, /Presença confirmada/);
        assert.equal(n.leituras(), 0);
    });
    return `${total} testes passaram.`;
}
module.exports = run;
if (require.main === module) run().then(console.log).catch(erro => { console.error(erro); process.exitCode = 1; });
