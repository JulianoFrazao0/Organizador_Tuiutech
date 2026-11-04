# Portal Tuiutech — o que falta configurar

## 1. Documentos e Kanban compartilhados
1. No Supabase, abra **SQL Editor > New query**.
2. Confira se **Run as** está em **postgres** (mesmo aviso de antes).
3. Cole o conteúdo de `supabase/etapa2.sql` e clique em **Run**. Deve aparecer **Success**.
   - Se você já tinha rodado uma versão antiga do `etapa2.sql` antes desta atualização, rode
     também o `supabase/correcoes-prazo.sql` (adiciona o campo de prazo sem apagar nada).

Pronto: quadros e tarefas do Kanban passam a ser vistos por toda a equipe, não só no seu
navegador. As tarefas agora podem ter um prazo: ao criar uma (ou clicar numa já existente),
dá para definir "até tal dia". O topo da página Projetos mostra um painel com tudo que está
atrasado ou vencendo em breve, juntando todos os quadros. Se você quiser que qualquer pessoa
(não só admin) possa apagar um quadro clicando na senha "1234", rode também
`supabase/correcoes-apagar-quadro.sql`.

Para os **Documentos** (título, autor e link de cada um), rode também `supabase/etapa4-docs-google.sql`
— veja a seção 2 abaixo, que é onde eles realmente passam a funcionar.

## 2. Documentos do Google + upload de fotos/arquivos para o Drive
Os "Documentos" do portal agora são Documentos do Google de verdade — o texto de cada um
fica no Google Docs (edição em tempo real, com toda a formatação), e o portal só guarda o
título, o autor e o link. Isso usa o mesmo Apps Script que já enviava arquivos pro Drive.

1. Rode `supabase/etapa4-docs-google.sql` no SQL Editor (**Run as: postgres**).
2. Abra a pasta do Drive da equipe (o mesmo link do botão "Acessar Drive da Equipe") e confira
   o ID dela (o trecho da URL depois de `/folders/`) — já está preenchido no `apps-script/Code.gs`
   com o ID que você já usava, mas vale conferir se bate.
3. Acesse **script.google.com**, abra o projeto que você já tinha criado, apague tudo e cole
   o conteúdo novo de `apps-script/Code.gs` por cima.
4. Clique em **Implantar > Gerenciar implantações**, no ícone de lápis (editar), escolha
   "Nova versão" em **Versão** e clique em **Implantar**.
   - Se esta for a primeira vez configurando (não tinha `Code.gs` antes), aí sim use
     **Implantar > Nova implantação**, tipo **App da Web**, Executar como **Eu**, Quem pode
     acessar **Qualquer pessoa** — e cole a URL nova (termina em `/exec`) no `config.js`.
5. Ele vai pedir autorização de novo (agora o script também cria/apaga Documentos, não só
   arquivos) — autorize com a mesma conta Google de sempre. A URL do app da web **não muda**,
   então o `config.js` não precisa ser mexido se você já tinha um deploy funcionando.

Como funciona: clicar em "+ Novo Documento" pede só um título, cria um Documento do Google
dentro da pasta de Documentos do Drive da equipe (com edição liberada pra "qualquer pessoa com
o link") e já abre ele numa aba nova pra começar a escrever. Na lista, clicar no título abre o
documento de novo; o "✕" ao lado exclui (some da lista e vai pra lixeira do Drive). O botão
"📎 Enviar Arquivo" manda um arquivo solto (PDF, foto, planilha) pra uma pasta separada, só de
anexos — ele aparece na mesma lista, com um clipe do lado do nome pra diferenciar de um
Documento editável.

⚠️ Como o link do documento libera edição pra "qualquer pessoa que tiver o link" (sem precisar
de conta Google), quem tiver o link consegue editar mesmo sem estar logado no portal — é o
mesmo nível de segurança "informal" que o resto do site já usa (como a senha 1234 dos quadros).

## 3. Categorias dos documentos
1. No Supabase, rode `supabase/etapa5-categorias.sql` no SQL Editor (**Run as: postgres**).

Como funciona: clicar numa categoria na barra lateral (Mecânica & Design, Programação &
Autônomo, etc.) filtra a lista só pra ela, e todo documento ou arquivo criado a partir daí já
entra automaticamente nessa categoria. Clicar em "Todos" volta a mostrar tudo.

## 4. Chamada com código do dia
1. No Supabase, rode `supabase/etapa3-chamada.sql` no SQL Editor (mesmo jeito: **Run as: postgres**).
2. Publique mais uma função: **Edge Functions > Deploy a new function > Via Editor**, nome
   exatamente `confirmar-chamada`, cole o conteúdo de `supabase/functions/confirmar-chamada/index.ts`
   e clique em **Deploy**.

Como funciona: na sua tela **Acessos**, aparece um código de 3 números gerado sozinho a cada dia —
só você consegue ver esse código (ninguém mais, nem olhando o código do site, consegue). Fale
ele para quem estiver presente. Na página inicial, cada pessoa digita esse código para
confirmar a presença do dia. Você também vê, na mesma tela de Acessos, a lista de quem já
confirmou hoje e a que horas — e um histórico com os dias anteriores, em blocos.

## 5. Colocar o site num endereço da internet
O jeito mais simples e gratuito, sem instalar nada:
1. Acesse **app.netlify.com/drop**.
2. Arraste a pasta `portal-tuiutech` inteira para a página.
3. Em alguns segundos, o Netlify te dá um endereço (ex.: `nome-aleatorio.netlify.app`).
4. Nesse mesmo painel, em **Site settings > Change site name**, você pode escolher um nome melhor,
   tipo `portal-tuiutech.netlify.app`.

Sempre que eu (ou você) alterar algum arquivo do site, é só arrastar a pasta de novo em
**Site settings > Deploys** (ou no mesmo endereço de drop) para atualizar.
