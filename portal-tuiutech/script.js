// Espera todo o HTML carregar antes de rodar o JS
document.addEventListener('DOMContentLoaded', () => {

    // Evita que texto digitado vire código HTML na página
    function escaparHtml(t) {
        return String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    // Ajuda a lidar com datas (YYYY-MM-DD) sem os erros de fuso horário do JS
    function hojeISO() {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }
    function diasAte(prazoISO) {
        const [ay, am, ad] = hojeISO().split('-').map(Number);
        const [py, pm, pd] = prazoISO.split('-').map(Number);
        return Math.round((Date.UTC(py, pm - 1, pd) - Date.UTC(ay, am - 1, ad)) / 86400000);
    }
    function formatarDataBR(iso) {
        const [y, m, d] = iso.split('-');
        return `${d}/${m}`;
    }

    /* ==============================================================
       1. FUNCIONALIDADES DO KANBAN (Página: Projetos.html)
       Os quadros e tarefas ficam salvos no banco (tabelas "quadros"
       e "tarefas"), então toda a equipe vê os mesmos dados.
    ============================================================== */
    const containerQuadros = document.getElementById('todos-os-quadros');

    if (containerQuadros) {
        const COLUNAS = ['A Fazer', 'Fazendo', 'Concluído'];
        const painelPrazos = document.getElementById('painelPrazos');

        // --- Janela (modal) de criar/editar tarefa ---
        document.body.insertAdjacentHTML('beforeend', `
            <div class="modal-overlay oculto" id="modalTarefa">
                <div class="modal-caixa">
                    <h2 id="modalTarefaTitulo">Nova Tarefa</h2>
                    <div class="grupo-input">
                        <label for="tituloTarefa">O que precisa ser feito?</label>
                        <input type="text" id="tituloTarefa" class="input-login" placeholder="Ex: Cortar perfis de alumínio">
                    </div>
                    <div class="grupo-input">
                        <label for="prazoTarefa">Prazo (opcional)</label>
                        <input type="date" id="prazoTarefa" class="input-login">
                    </div>
                    <p id="msgTarefa" class="login-erro" role="alert"></p>
                    <div class="modal-acoes">
                        <button type="button" class="btn-perigo" id="btn-excluir-tarefa" hidden>Excluir</button>
                        <button type="button" class="btn-secundario" id="btn-cancelar-tarefa">Cancelar</button>
                        <button type="button" class="btn-primario" id="btn-salvar-tarefa">Criar Tarefa</button>
                    </div>
                </div>
            </div>`);

        const modalTarefa = document.getElementById('modalTarefa');
        const tituloModalTarefa = document.getElementById('modalTarefaTitulo');
        const inputTituloTarefa = document.getElementById('tituloTarefa');
        const inputPrazoTarefa = document.getElementById('prazoTarefa');
        const msgTarefa = document.getElementById('msgTarefa');
        const btnSalvarTarefa = document.getElementById('btn-salvar-tarefa');
        const btnExcluirTarefa = document.getElementById('btn-excluir-tarefa');
        const btnCancelarTarefa = document.getElementById('btn-cancelar-tarefa');

        let contextoTarefa = null; // { modo: 'nova'|'editar', quadroId, coluna, tarefaId, cartaoEl }

        function fecharModalTarefa() {
            modalTarefa.classList.add('oculto');
            contextoTarefa = null;
        }

        function abrirModalNovaTarefa(quadroId, coluna) {
            contextoTarefa = { modo: 'nova', quadroId, coluna };
            tituloModalTarefa.textContent = 'Nova Tarefa';
            inputTituloTarefa.value = '';
            inputPrazoTarefa.value = '';
            msgTarefa.textContent = '';
            btnExcluirTarefa.hidden = true;
            btnSalvarTarefa.textContent = 'Criar Tarefa';
            modalTarefa.classList.remove('oculto');
            inputTituloTarefa.focus();
        }

        function abrirModalEditarTarefa(tarefa, cartaoEl) {
            contextoTarefa = { modo: 'editar', tarefaId: tarefa.id, cartaoEl };
            tituloModalTarefa.textContent = 'Editar Tarefa';
            inputTituloTarefa.value = tarefa.titulo;
            inputPrazoTarefa.value = tarefa.prazo || '';
            msgTarefa.textContent = '';
            btnExcluirTarefa.hidden = false;
            btnSalvarTarefa.textContent = 'Salvar';
            modalTarefa.classList.remove('oculto');
            inputTituloTarefa.focus();
        }

        btnCancelarTarefa.addEventListener('click', fecharModalTarefa);
        modalTarefa.addEventListener('click', (e) => { if (e.target === modalTarefa) fecharModalTarefa(); });
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modalTarefa.classList.contains('oculto')) fecharModalTarefa(); });

        function badgePrazoHtml(prazo) {
            if (!prazo) return '';
            const dias = diasAte(prazo);
            let classe = 'prazo-ok';
            if (dias < 0) classe = 'prazo-atrasado';
            else if (dias <= 2) classe = 'prazo-proximo';
            const texto = dias < 0 ? `Atrasado (${formatarDataBR(prazo)})`
                : dias === 0 ? 'Hoje'
                : dias === 1 ? 'Amanhã'
                : `Até ${formatarDataBR(prazo)}`;
            return `<span class="cartao-prazo ${classe}">${texto}</span>`;
        }

        function montarCartao(tarefa) {
            const cartao = document.createElement('div');
            cartao.className = 'kanban-cartao';
            cartao.dataset.id = tarefa.id;

            const titulo = document.createElement('p');
            titulo.className = 'cartao-titulo';
            titulo.textContent = tarefa.titulo;

            const rodape = document.createElement('div');
            rodape.className = 'cartao-rodape';
            rodape.innerHTML = badgePrazoHtml(tarefa.prazo) || `<span class="cartao-data">${tarefa.coluna === 'Concluído' ? 'Finalizado' : 'Novo'}</span>`;

            if (tarefa.responsavel) {
                const avatar = document.createElement('div');
                avatar.className = 'perfil-btn miniatura';
                avatar.textContent = tarefa.responsavel;
                rodape.appendChild(avatar);
            }

            cartao.append(titulo, rodape);
            configurarCartaoArrastavel(cartao);

            cartao.addEventListener('click', () => abrirModalEditarTarefa(tarefa, cartao));
            return cartao;
        }

        function configurarCartaoArrastavel(cartao) {
            cartao.setAttribute('draggable', 'true');
            cartao.addEventListener('dragstart', () => {
                cartao.classList.add('dragging');
                cartao.style.opacity = '0.5';
            });
            cartao.addEventListener('dragend', () => {
                cartao.classList.remove('dragging');
                cartao.style.opacity = '1';
            });
        }

        function montarQuadro(quadro, tarefasDoQuadro) {
            const wrapper = document.createElement('div');
            wrapper.className = 'quadro-wrapper';
            wrapper.dataset.id = quadro.id;

            wrapper.innerHTML = `
                <div class="kanban-cabecalho">
                    <div style="display: flex; align-items: center; gap: 15px;">
                        <h2 class="titulo-quadro">${escaparHtml(quadro.nome)}</h2>
                        <button class="btn-apagar-quadro" title="Apagar Quadro">🗑️</button>
                    </div>
                    <button class="btn-primario btn-nova-tarefa">+ Nova Tarefa</button>
                </div>
                <div class="kanban-board">
                    ${COLUNAS.map(nomeColuna => `
                        <div class="kanban-coluna" data-coluna="${nomeColuna}">
                            <div class="coluna-cabecalho"><h3>${nomeColuna}</h3><span class="contador-tarefas">0</span></div>
                            <div class="kanban-cartoes"></div>
                            <button class="btn-add-cartao">+ Adicionar um cartão</button>
                        </div>
                    `).join('')}
                </div>`;

            COLUNAS.forEach(nomeColuna => {
                const colunaEl = wrapper.querySelector(`.kanban-coluna[data-coluna="${nomeColuna}"] .kanban-cartoes`);
                tarefasDoQuadro.filter(t => t.coluna === nomeColuna).forEach(t => colunaEl.appendChild(montarCartao(t)));
            });

            inicializarEventosQuadro(wrapper, quadro.id);
            atualizarContadores(wrapper);
            return wrapper;
        }

        function atualizarContadores(quadroEl) {
            quadroEl.querySelectorAll('.kanban-coluna').forEach(col => {
                col.querySelector('.contador-tarefas').textContent = col.querySelectorAll('.kanban-cartao').length;
            });
        }

        function inicializarEventosQuadro(quadroEl, quadroId) {
            quadroEl.querySelectorAll('.kanban-cartoes').forEach(coluna => {
                coluna.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    const arrastando = document.querySelector('.dragging');
                    if (arrastando) coluna.appendChild(arrastando);
                });

                coluna.addEventListener('drop', async () => {
                    const cartao = document.querySelector('.dragging');
                    if (!cartao) return;
                    const novaColuna = coluna.closest('.kanban-coluna').dataset.coluna;
                    const tarefaId = Number(cartao.dataset.id);

                    if (novaColuna === 'Fazendo' && !cartao.querySelector('.perfil-btn')) {
                        let resp = prompt("Quem está assumindo esta tarefa? (Ex: Juliano)");
                        if (resp && resp.trim() !== "") {
                            resp = resp.trim().substring(0, 2).toUpperCase();
                            const avatar = document.createElement('div');
                            avatar.className = 'perfil-btn miniatura';
                            avatar.textContent = resp;
                            cartao.querySelector('.cartao-rodape').appendChild(avatar);
                            await db.from('tarefas').update({ coluna: novaColuna, responsavel: resp }).eq('id', tarefaId);
                        } else {
                            await db.from('tarefas').update({ coluna: novaColuna }).eq('id', tarefaId);
                        }
                    } else {
                        await db.from('tarefas').update({ coluna: novaColuna }).eq('id', tarefaId);
                    }

                    document.querySelectorAll('.quadro-wrapper').forEach(atualizarContadores);
                });
            });

            quadroEl.querySelectorAll('.btn-add-cartao, .btn-nova-tarefa').forEach(botao => {
                botao.addEventListener('click', () => {
                    const coluna = botao.classList.contains('btn-nova-tarefa')
                        ? 'A Fazer'
                        : botao.closest('.kanban-coluna').dataset.coluna;
                    abrirModalNovaTarefa(quadroId, coluna);
                });
            });

            const btnApagar = quadroEl.querySelector('.btn-apagar-quadro');
            btnApagar.addEventListener('click', async () => {
                const senha = prompt("Digite a senha para excluir o quadro:");
                if (senha === null) return;
                if (senha !== '1234') { alert("Senha incorreta! O quadro não foi excluído."); return; }
                if (!confirm("Excluir este quadro? Esta ação não pode ser desfeita.")) return;

                const { error } = await db.from('quadros').delete().eq('id', quadroId);
                if (error) { alert('Não foi possível excluir: ' + error.message); return; }
                quadroEl.remove();
                montarPainelPrazos(await buscarTodasTarefasComQuadro());
            });
        }

        async function buscarTodasTarefasComQuadro() {
            const { data } = await db.from('tarefas').select('*, quadros(nome)').not('prazo', 'is', null).order('prazo');
            return data || [];
        }

        function montarPainelPrazos(tarefasComPrazo) {
            if (!painelPrazos) return;
            const relevantes = tarefasComPrazo.filter(t => t.coluna !== 'Concluído');

            if (relevantes.length === 0) {
                painelPrazos.innerHTML = '';
                return;
            }

            const LIMITE = 3;
            const itens = relevantes.slice(0, LIMITE).map(t => {
                const nomeQuadro = t.quadros?.nome || '';
                return `
                    <li>
                        <div class="tarefa-info">
                            <span class="tarefa-titulo">${escaparHtml(t.titulo)}</span>
                            <span class="tarefa-quadro">${escaparHtml(nomeQuadro)}${t.responsavel ? ' · ' + escaparHtml(t.responsavel) : ''}</span>
                        </div>
                        ${badgePrazoHtml(t.prazo)}
                    </li>`;
            }).join('');

            const sobrando = relevantes.length - LIMITE;
            const maisTexto = sobrando > 0 ? `<p class="prazos-mais">+ ${sobrando} outro${sobrando > 1 ? 's' : ''} prazo${sobrando > 1 ? 's' : ''}</p>` : '';

            painelPrazos.innerHTML = `
                <div class="painel-prazos">
                    <h2>🕒 Prazos</h2>
                    <ul class="lista-prazos">${itens}</ul>
                    ${maisTexto}
                </div>`;
        }

        btnSalvarTarefa.addEventListener('click', async () => {
            const titulo = inputTituloTarefa.value.trim();
            const prazo = inputPrazoTarefa.value || null;
            if (titulo === '') { msgTarefa.textContent = 'Digite o nome da tarefa.'; return; }

            btnSalvarTarefa.disabled = true;
            try {
                if (contextoTarefa.modo === 'nova') {
                    const { data, error } = await db.from('tarefas')
                        .insert({ quadro_id: contextoTarefa.quadroId, coluna: contextoTarefa.coluna, titulo, prazo })
                        .select().single();
                    if (error) throw error;

                    const quadroEl = document.querySelector(`.quadro-wrapper[data-id="${contextoTarefa.quadroId}"]`);
                    const colunaEl = quadroEl.querySelector(`.kanban-coluna[data-coluna="${contextoTarefa.coluna}"] .kanban-cartoes`);
                    colunaEl.appendChild(montarCartao(data));
                    atualizarContadores(quadroEl);
                } else {
                    const { error } = await db.from('tarefas').update({ titulo, prazo }).eq('id', contextoTarefa.tarefaId);
                    if (error) throw error;

                    const cartaoAntigo = contextoTarefa.cartaoEl;
                    const cartaoNovo = montarCartao({ id: contextoTarefa.tarefaId, titulo, prazo, coluna: cartaoAntigo.closest('.kanban-coluna').dataset.coluna, responsavel: cartaoAntigo.querySelector('.perfil-btn')?.textContent || null });
                    cartaoAntigo.replaceWith(cartaoNovo);
                }
                fecharModalTarefa();
                montarPainelPrazos(await buscarTodasTarefasComQuadro());
            } catch (erro) {
                msgTarefa.textContent = 'Não foi possível salvar: ' + erro.message;
            } finally {
                btnSalvarTarefa.disabled = false;
            }
        });

        btnExcluirTarefa.addEventListener('click', async () => {
            if (!confirm('Excluir esta tarefa?')) return;
            const { error } = await db.from('tarefas').delete().eq('id', contextoTarefa.tarefaId);
            if (error) { msgTarefa.textContent = 'Não foi possível excluir: ' + error.message; return; }

            const quadroEl = contextoTarefa.cartaoEl.closest('.quadro-wrapper');
            contextoTarefa.cartaoEl.remove();
            atualizarContadores(quadroEl);
            fecharModalTarefa();
            montarPainelPrazos(await buscarTodasTarefasComQuadro());
        });

        async function carregarQuadros() {
            containerQuadros.innerHTML = '<p style="color: var(--texto-fraco);">Carregando quadros...</p>';
            const [{ data: quadros, error: erroQuadros }, { data: tarefas, error: erroTarefas }] = await Promise.all([
                db.from('quadros').select('*').order('ordem').order('id'),
                db.from('tarefas').select('*').order('ordem').order('id')
            ]);

            containerQuadros.innerHTML = '';
            if (erroQuadros || erroTarefas) {
                containerQuadros.innerHTML = '<p style="color: var(--texto-fraco);">Não foi possível carregar os quadros. Recarregue a página.</p>';
                return;
            }
            if (!quadros.length) {
                containerQuadros.innerHTML = '<p style="color: var(--texto-fraco);">Nenhum quadro ainda. Clique em "+ Criar Novo Quadro" para começar.</p>';
            } else {
                quadros.forEach((quadro, i) => {
                    if (i > 0) containerQuadros.insertAdjacentHTML('beforeend', '<hr class="linha-separadora">');
                    const tarefasDoQuadro = tarefas.filter(t => t.quadro_id === quadro.id);
                    containerQuadros.appendChild(montarQuadro(quadro, tarefasDoQuadro));
                });
            }

            montarPainelPrazos(await buscarTodasTarefasComQuadro());
        }

        const btnNovoQuadro = document.getElementById('btn-novo-quadro');
        if (btnNovoQuadro) {
            btnNovoQuadro.addEventListener('click', async () => {
                const nomeQuadro = prompt("Qual será o nome do seu Novo Quadro?");
                if (!nomeQuadro || nomeQuadro.trim() === '') return;

                const { error } = await db.from('quadros').insert({ nome: nomeQuadro.trim() });
                if (error) { alert('Não foi possível criar o quadro: ' + error.message); return; }
                await carregarQuadros();
                containerQuadros.lastElementChild?.scrollIntoView({ behavior: 'smooth' });
            });
        }

        window.pronto.then(perfil => { if (perfil) carregarQuadros(); });
        window.addEventListener('focus', () => { if (document.getElementById('todos-os-quadros')) carregarQuadros(); });
    }


    /* ==============================================================
       2. FUNCIONALIDADES DE DOCUMENTOS (Página: Documentos.html)
       Cada "documento" aqui é um Documento do Google de verdade, criado
       dentro da pasta do Drive da equipe. O portal só guarda o título, o
       autor e o link — o conteúdo em si é editado no próprio Google Docs,
       em tempo real, por quem tiver o link. Criar um documento novo
       acontece numa janela (modal); abrir/editar acontece numa aba nova,
       porque o Google não deixa o editor dele ficar dentro de outro site.
    ============================================================== */
    const barraPesquisa = document.querySelector('.barra-pesquisa input');

    if (barraPesquisa) {
        const corpoTabela = document.querySelector('.tabela-docs tbody');
        const btnNovoDoc = document.getElementById('btn-novo-doc');
        const categoriaLinks = document.querySelectorAll('.sidebar-docs a');
        const tituloListaDocs = document.getElementById('tituloListaDocs');
        let documentos = [];
        let categoriaAtual = ''; // '' = Todos

        // --- Janela (modal) de criar documento ---
        document.body.insertAdjacentHTML('beforeend', `
            <div class="modal-overlay oculto" id="modalDocumento">
                <div class="modal-caixa">
                    <h2>Novo Documento</h2>
                    <div class="grupo-input">
                        <label for="tituloDocumento">Título</label>
                        <input type="text" id="tituloDocumento" class="input-login" placeholder="Dê um título ao documento">
                    </div>
                    <p class="texto-anexo">Isso cria um Documento do Google de verdade, dentro do Drive da equipe.
                        Assim que criar, ele já abre numa aba nova pra você começar a escrever — e qualquer um da
                        equipe que tiver o link pode abrir e editar junto, em tempo real.</p>
                    <p id="categoriaDocumento" class="texto-anexo"></p>
                    <p id="msgDocumento" class="login-erro" role="alert"></p>
                    <div class="modal-acoes">
                        <button type="button" class="btn-secundario" id="btn-cancelar-documento">Cancelar</button>
                        <button type="button" class="btn-primario" id="btn-criar-documento">Criar Documento</button>
                    </div>
                </div>
            </div>`);

        const modalDocumento = document.getElementById('modalDocumento');
        const inputTitulo = document.getElementById('tituloDocumento');
        const msgDocumento = document.getElementById('msgDocumento');
        const categoriaDocumento = document.getElementById('categoriaDocumento');
        const btnCriar = document.getElementById('btn-criar-documento');
        const btnCancelar = document.getElementById('btn-cancelar-documento');

        function fecharModalDocumento() {
            modalDocumento.classList.add('oculto');
        }

        function abrirModalNovoDocumento() {
            inputTitulo.value = '';
            msgDocumento.textContent = '';
            categoriaDocumento.textContent = categoriaAtual ? `Vai ser salvo na categoria "${categoriaAtual}".` : 'Sem categoria selecionada (vai ficar em "Todos").';
            btnCriar.disabled = false;
            btnCriar.textContent = 'Criar Documento';
            modalDocumento.classList.remove('oculto');
            inputTitulo.focus();
        }

        btnCancelar.addEventListener('click', fecharModalDocumento);
        modalDocumento.addEventListener('click', (e) => { if (e.target === modalDocumento) fecharModalDocumento(); });
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modalDocumento.classList.contains('oculto')) fecharModalDocumento(); });

        function scriptConfigurado() {
            return typeof GOOGLE_SCRIPT_URL !== 'undefined' && GOOGLE_SCRIPT_URL && !GOOGLE_SCRIPT_URL.includes('COLE_AQUI');
        }

        function arquivoParaBase64(arquivo) {
            return new Promise((resolve, reject) => {
                const leitor = new FileReader();
                leitor.onload = () => resolve(String(leitor.result).split(',')[1]);
                leitor.onerror = () => reject(leitor.error);
                leitor.readAsDataURL(arquivo);
            });
        }

        function renderizarTabela(filtrarTexto = '') {
            const termo = filtrarTexto.toLowerCase();
            const visiveis = documentos.filter(d => {
                const bateTexto = termo === '' ||
                    d.titulo.toLowerCase().includes(termo) ||
                    d.autor.toLowerCase().includes(termo);
                const bateCategoria = categoriaAtual === '' || d.categoria === categoriaAtual;
                return bateTexto && bateCategoria;
            });

            if (visiveis.length === 0) {
                let mensagem = 'Nenhum documento encontrado.';
                if (documentos.length === 0) mensagem = 'Nenhum documento ainda. Clique em "+ Novo Documento" para criar o primeiro.';
                else if (categoriaAtual !== '' && termo === '') mensagem = 'Nenhum documento nessa categoria ainda.';
                corpoTabela.innerHTML = `<tr class="linha-vazia"><td colspan="4">${mensagem}</td></tr>`;
                return;
            }

            corpoTabela.innerHTML = visiveis.map(documento => {
                const dataFormatada = new Date(documento.atualizado_em).toLocaleDateString('pt-BR');
                const ehArquivo = !!documento.anexo_nome;
                const icone = ehArquivo ? '📎 ' : '';
                const nomeDoc = documento.doc_url
                    ? `<a href="${escaparHtml(documento.doc_url)}" target="_blank" rel="noopener">${icone}${escaparHtml(documento.titulo)}</a>`
                    : `${icone}${escaparHtml(documento.titulo)} <span class="texto-anexo">(sem link)</span>`;
                return `
                    <tr data-id="${documento.id}">
                        <td>${nomeDoc}</td>
                        <td>${escaparHtml(documento.autor)}</td>
                        <td>${dataFormatada}</td>
                        <td class="coluna-acoes"><button type="button" class="btn-excluir-doc" title="Excluir">✕</button></td>
                    </tr>`;
            }).join('');
        }

        async function carregarDocumentos() {
            const { data, error } = await db.from('documentos').select('*').order('atualizado_em', { ascending: false });
            if (error) { console.warn('Erro ao carregar documentos:', error.message); return; }
            documentos = data;
            renderizarTabela(barraPesquisa.value);
        }

        carregarDocumentos();
        window.addEventListener('focus', carregarDocumentos);

        barraPesquisa.addEventListener('input', (e) => renderizarTabela(e.target.value));

        categoriaLinks.forEach(link => {
            link.addEventListener('click', (evento) => {
                evento.preventDefault();
                categoriaAtual = link.dataset.categoria || '';
                categoriaLinks.forEach(l => l.classList.toggle('ativa', l === link));
                if (tituloListaDocs) tituloListaDocs.textContent = categoriaAtual || 'Documentos Recentes';
                renderizarTabela(barraPesquisa.value);
            });
        });

        if (btnNovoDoc) btnNovoDoc.addEventListener('click', abrirModalNovoDocumento);

        const inputEnviarArquivo = document.getElementById('inputEnviarArquivo');
        const labelEnviarArquivo = document.querySelector('label[for="inputEnviarArquivo"]');

        if (inputEnviarArquivo) {
            inputEnviarArquivo.addEventListener('change', async () => {
                const arquivo = inputEnviarArquivo.files[0];
                if (!arquivo) return;

                if (!scriptConfigurado()) {
                    alert('O envio de arquivos ainda não foi configurado (GOOGLE_SCRIPT_URL no config.js).');
                    inputEnviarArquivo.value = '';
                    return;
                }
                if (arquivo.size > 8 * 1024 * 1024) {
                    alert('Esse arquivo é maior que 8 MB — escolha um arquivo menor.');
                    inputEnviarArquivo.value = '';
                    return;
                }

                const perfil = await window.pronto;
                const autor = perfil ? iniciais(perfil.nome) : '??';
                const textoOriginal = labelEnviarArquivo.textContent;
                labelEnviarArquivo.textContent = 'Enviando...';

                try {
                    const conteudoBase64 = await arquivoParaBase64(arquivo);
                    const resposta = await fetch(GOOGLE_SCRIPT_URL, {
                        method: 'POST',
                        body: JSON.stringify({ nomeArquivo: arquivo.name, tipo: arquivo.type, conteudoBase64 })
                    });
                    const resultado = await resposta.json();
                    if (!resultado.ok) throw new Error(resultado.erro || 'falha ao enviar o arquivo.');

                    const { error } = await db.from('documentos').insert({
                        titulo: arquivo.name,
                        autor,
                        autor_user_id: perfil?.user_id ?? null,
                        doc_url: resultado.url,
                        doc_id: resultado.id ?? null,
                        anexo_nome: resultado.nome || arquivo.name,
                        categoria: categoriaAtual || null,
                        atualizado_em: new Date().toISOString()
                    });
                    if (error) throw error;

                    await carregarDocumentos();
                } catch (erro) {
                    alert('Não foi possível enviar: ' + erro.message);
                } finally {
                    labelEnviarArquivo.textContent = textoOriginal;
                    inputEnviarArquivo.value = '';
                }
            });
        }

        btnCriar.addEventListener('click', async () => {
            const perfil = await window.pronto;
            const autor = perfil ? iniciais(perfil.nome) : '??';
            const tituloDigitado = inputTitulo.value.trim();
            if (tituloDigitado === '') {
                msgDocumento.textContent = 'Dê um título ao documento.';
                inputTitulo.focus();
                return;
            }
            if (!scriptConfigurado()) {
                msgDocumento.textContent = 'A criação de Documentos do Google ainda não foi configurada (GOOGLE_SCRIPT_URL no config.js).';
                return;
            }

            btnCriar.disabled = true;
            btnCriar.textContent = 'Criando no Google Docs...';
            msgDocumento.textContent = '';
            try {
                const resposta = await fetch(GOOGLE_SCRIPT_URL, {
                    method: 'POST',
                    body: JSON.stringify({ acao: 'criarDocumento', titulo: tituloDigitado })
                });
                const resultado = await resposta.json();
                if (!resultado.ok) throw new Error(resultado.erro || 'falha ao criar o documento.');

                const { error } = await db.from('documentos').insert({
                    titulo: tituloDigitado,
                    autor,
                    autor_user_id: perfil?.user_id ?? null,
                    doc_url: resultado.url,
                    doc_id: resultado.id,
                    categoria: categoriaAtual || null,
                    atualizado_em: new Date().toISOString()
                });
                if (error) throw error;

                fecharModalDocumento();
                await carregarDocumentos();
                window.open(resultado.url, '_blank');
            } catch (erro) {
                msgDocumento.textContent = 'Não foi possível criar: ' + erro.message;
                btnCriar.disabled = false;
                btnCriar.textContent = 'Criar Documento';
            }
        });

        corpoTabela.addEventListener('click', async (e) => {
            const botaoExcluir = e.target.closest('.btn-excluir-doc');
            if (!botaoExcluir) return;
            const linha = botaoExcluir.closest('tr');
            const documento = documentos.find(d => d.id === Number(linha.dataset.id));
            if (!documento) return;
            if (!confirm(`Excluir "${documento.titulo}"? Ele também vai pra lixeira do Drive.`)) return;

            botaoExcluir.disabled = true;
            try {
                if (documento.doc_id && scriptConfigurado()) {
                    await fetch(GOOGLE_SCRIPT_URL, {
                        method: 'POST',
                        body: JSON.stringify({ acao: 'excluirDocumento', id: documento.doc_id })
                    }).catch(() => {}); // não impede excluir da lista se isso falhar
                }
                const { error } = await db.from('documentos').delete().eq('id', documento.id);
                if (error) throw error;
                await carregarDocumentos();
            } catch (erro) {
                alert('Não foi possível excluir: ' + erro.message);
                botaoExcluir.disabled = false;
            }
        });
    }

});
