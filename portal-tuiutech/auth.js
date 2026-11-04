// Conexão com o Supabase e controle de sessão. Carregado em todas as páginas.
const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const emailDoId = (codigo) => `${codigo.trim().toLowerCase()}@tuiutech.app`;
const paginaLogin = document.body.classList.contains('pagina-login');

// Esconde a página até confirmar o login (evita piscar conteúdo restrito).
if (!paginaLogin) document.documentElement.style.visibility = 'hidden';

function iniciais(nome) {
    return nome.trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase();
}

async function iniciarSessao() {
    const { data: { session } } = await db.auth.getSession();

    if (!session) {
        if (!paginaLogin) location.replace('Login.html');
        return null;
    }
    if (paginaLogin) {
        location.replace('index.html');
        return null;
    }

    const { data: perfil } = await db.from('perfis')
        .select('user_id, codigo, nome, papel')
        .eq('user_id', session.user.id)
        .single();

    if (!perfil) {
        await db.auth.signOut();
        location.replace('Login.html');
        return null;
    }

    const avatar = document.querySelector('.grupo-perfil .perfil-btn');
    if (avatar) {
        avatar.textContent = iniciais(perfil.nome);
        avatar.title = `${perfil.nome} (ID ${perfil.codigo})`;
    }

    if (perfil.papel === 'admin') {
        const lista = document.querySelector('#Menu ul');
        if (lista) {
            const item = document.createElement('li');
            item.innerHTML = '<a href="Admin.html">Acessos</a>';
            lista.appendChild(item);
        }
    }

    const saudacao = document.getElementById('saudacao');
    if (saudacao) saudacao.textContent = `Olá, ${perfil.nome.split(' ')[0]}`;

    const paginaAtual = location.pathname.split('/').pop().toLowerCase();
    document.querySelectorAll('#Menu a').forEach(link => {
        if (link.getAttribute('href').toLowerCase() === paginaAtual) link.classList.add('active');
    });

    document.documentElement.style.visibility = '';
    return perfil;
}

// Outras partes do site podem esperar por isto: const perfil = await window.pronto;
window.pronto = iniciarSessao();

// Botão "Sair"
document.querySelectorAll('.btn-sair').forEach(botao => {
    botao.addEventListener('click', async (e) => {
        e.preventDefault();
        await db.auth.signOut();
        location.replace('Login.html');
    });
});

// Formulário de login (ID + senha)
const formLogin = document.getElementById('formLogin');
if (formLogin) {
    formLogin.addEventListener('submit', async (e) => {
        e.preventDefault();
        const erro = document.getElementById('erroLogin');
        erro.textContent = '';
        const { error } = await db.auth.signInWithPassword({
            email: emailDoId(document.getElementById('idMembro').value),
            password: document.getElementById('senha').value
        });
        if (error) {
            erro.textContent = 'ID ou senha incorretos.';
            return;
        }
        location.replace('index.html');
    });
}
