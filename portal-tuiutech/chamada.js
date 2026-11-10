// O servidor decide se a localização permite confirmar presença.
(async () => {
    const perfil = await window.pronto;
    if (!perfil) return;

    const bloco = document.getElementById('blocoChamada');
    const input = document.getElementById('inputCodigoChamada');
    const botao = document.getElementById('btn-confirmar-chamada');
    const verificar = document.getElementById('btn-verificar-localizacao');
    const msg = document.getElementById('msgChamada');
    const msgLocal = document.getElementById('msgLocalizacao');
    let liberadoAte = 0;
    let temporizador;
    let ocupado = false;
    let confirmado = false;
    let revisao = 0;

    function hojeISO() {
        const partes = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'America/Cuiaba', year: 'numeric', month: '2-digit', day: '2-digit'
        }).formatToParts(new Date());
        const valor = tipo => partes.find(p => p.type === tipo).value;
        return `${valor('year')}-${valor('month')}-${valor('day')}`;
    }

    const hoje = hojeISO();
    document.getElementById('dataChamada').textContent = new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Cuiaba', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    }).format(new Date());

    function atualizarControles() {
        const bloqueado = ocupado || confirmado || Date.now() >= liberadoAte;
        input.disabled = bloqueado;
        botao.disabled = bloqueado;
        verificar.disabled = ocupado || confirmado;
    }

    function bloquear(texto) {
        liberadoAte = 0;
        clearTimeout(temporizador);
        input.value = '';
        msgLocal.classList.remove('ok');
        msgLocal.textContent = texto;
        atualizarControles();
    }

    function liberar() {
        liberadoAte = Date.now() + 30000;
        msgLocal.classList.add('ok');
        msgLocal.textContent = 'Localização verificada. Digite os 3 números em até 30 segundos.';
        clearTimeout(temporizador);
        temporizador = setTimeout(() => bloquear('Verifique novamente sua localização para digitar o código.'), 30000);
        atualizarControles();
    }

    function mostrarConfirmado() {
        confirmado = true;
        clearTimeout(temporizador);
        bloco.innerHTML = '<p class="login-erro ok" style="margin:0;">✅ Presença confirmada hoje.</p>';
    }

    function obterLocalizacao() {
        return new Promise((resolve, reject) => {
            if (!window.isSecureContext) {
                reject(new Error('Abra o portal pelo endereço HTTPS para verificar sua localização.'));
                return;
            }
            if (!navigator.geolocation) {
                reject(new Error('Este navegador não oferece localização. Tente pelo navegador do celular.'));
                return;
            }
            navigator.geolocation.getCurrentPosition(
                posicao => resolve({
                    latitude: posicao.coords.latitude,
                    longitude: posicao.coords.longitude,
                    precisao: posicao.coords.accuracy,
                    timestamp: posicao.timestamp
                }),
                erro => reject(new Error({
                    1: 'Permita o acesso à localização nas configurações do navegador para fazer a chamada.',
                    2: 'Não foi possível localizar você. Ative a localização do aparelho e tente novamente.',
                    3: 'A localização demorou para responder. Tente novamente em um lugar com melhor sinal.'
                }[erro.code] || 'Não foi possível obter sua localização. Tente novamente.')),
                { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
            );
        });
    }

    async function enviar(corpo) {
        const { data: { session } } = await db.auth.getSession();
        if (!session) throw new Error('Faça login novamente.');
        const controle = new AbortController();
        const limite = setTimeout(() => controle.abort(), 15000);
        try {
            const resposta = await fetch(`${SUPABASE_URL}/functions/v1/confirmar-chamada`, {
                method: 'POST', signal: controle.signal,
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${session.access_token}`
                },
                body: JSON.stringify(corpo)
            });
            const resultado = await resposta.json();
            if (!resposta.ok || !resultado.ok) {
                throw new Error(resultado.erro || 'Não foi possível verificar a chamada. Tente novamente.');
            }
            // Uma versão antiga da função não pode liberar o campo por engano.
            if (resultado.localizacaoValidada !== true) {
                throw new Error('A chamada precisa ser atualizada pelo administrador.');
            }
            return resultado;
        } catch (erro) {
            if (erro.name === 'AbortError' || erro instanceof TypeError || erro instanceof SyntaxError) {
                throw new Error('Não foi possível conectar à chamada. Confira sua conexão e tente novamente.');
            }
            throw erro;
        } finally {
            clearTimeout(limite);
        }
    }

    async function executar(confirmar) {
        if (ocupado || confirmado) return;
        if (confirmar && Date.now() >= liberadoAte) {
            bloquear('Verifique sua localização antes de digitar o código.');
            return;
        }
        const codigo = input.value.trim();
        if (confirmar && !/^[0-9]{3}$/.test(codigo)) {
            msg.textContent = 'Digite os 3 números do código.';
            return;
        }
        ocupado = true;
        const tentativa = ++revisao;
        bloquear('Verificando sua localização…');
        msg.textContent = '';
        try {
            // Sempre pedir uma leitura nova, inclusive no momento da confirmação.
            const localizacao = await obterLocalizacao();
            if (tentativa !== revisao || document.hidden) return;
            if (confirmar && hojeISO() !== hoje) throw new Error('O dia mudou. Atualize a página para fazer a chamada de hoje.');
            const resultado = await enviar({
                acao: confirmar ? 'confirmar' : 'verificar-localizacao',
                localizacao,
                ...(confirmar ? { codigo, data: hoje } : {})
            });
            if (confirmar && resultado.ok) {
                mostrarConfirmado();
            } else if (tentativa === revisao && !document.hidden) {
                liberar();
            }
        } catch (erro) {
            if (tentativa === revisao) bloquear(erro.message || 'Não foi possível verificar sua localização. Tente novamente.');
        } finally {
            ocupado = false;
            atualizarControles();
            if (!input.disabled) input.focus();
        }
    }

    verificar.addEventListener('click', () => executar(false));
    botao.addEventListener('click', () => executar(true));
    input.addEventListener('input', () => { input.value = input.value.replace(/\D/g, '').slice(0, 3); });
    document.addEventListener('visibilitychange', () => {
        if (document.hidden && !confirmado) {
            revisao++;
            bloquear('Verifique novamente sua localização para digitar o código.');
        }
    });
    atualizarControles();

    try {
        const { data: existente, error } = await db.from('presencas').select('id')
            .eq('user_id', perfil.user_id).eq('data', hoje).maybeSingle();
        if (error) throw error;
        if (existente) mostrarConfirmado();
    } catch {
        msg.textContent = 'Não foi possível consultar sua presença. Você pode tentar confirmar novamente.';
    }
})();
