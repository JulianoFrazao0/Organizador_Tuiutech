/**
 * Portal Tuiutech — recebe pedidos do site e mexe no Drive da equipe:
 *   - "upload"           → salva um arquivo enviado do site na pasta de anexos.
 *   - "criarDocumento"   → cria um Documento do Google (docs.google.com) de
 *                          verdade dentro da pasta de Documentos, libera edição
 *                          para "qualquer pessoa com o link" e devolve o link.
 *   - "excluirDocumento" → manda um Documento pra lixeira do Drive.
 *
 * Os anexos (arquivos soltos, enviados por upload) e os Documentos do Google
 * ficam em pastas separadas do Drive.
 */

const ID_DA_PASTA_UPLOADS = "blablabla"; // pasta dos anexos/arquivos
const ID_DA_PASTA_DOCS = "blablabla";    // pasta só dos Documentos

function doPost(e) {
  try {
    const dados = JSON.parse(e.postData.contents);

    if (dados.acao === 'criarDocumento') {
      const pasta = DriveApp.getFolderById(ID_DA_PASTA_DOCS);
      const doc = DocumentApp.create(dados.titulo || 'Documento sem título');
      const arquivo = DriveApp.getFileById(doc.getId());
      pasta.addFile(arquivo);
      DriveApp.getRootFolder().removeFile(arquivo); // tira da raiz do Drive, deixa só na pasta de Documentos
      arquivo.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.EDIT);

      return responder({ ok: true, url: doc.getUrl(), id: doc.getId(), nome: arquivo.getName() });
    }

    if (dados.acao === 'excluirDocumento') {
      const arquivo = DriveApp.getFileById(dados.id);
      arquivo.setTrashed(true);
      return responder({ ok: true });
    }

    // upload de arquivo (comportamento original, quando não vem "acao")
    const pasta = DriveApp.getFolderById(ID_DA_PASTA_UPLOADS);
    const bytes = Utilities.base64Decode(dados.conteudoBase64);
    const blob = Utilities.newBlob(bytes, dados.tipo || "application/octet-stream", dados.nomeArquivo || "arquivo");
    const arquivo = pasta.createFile(blob);
    arquivo.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    return responder({ ok: true, url: arquivo.getUrl(), id: arquivo.getId(), nome: arquivo.getName() });
  } catch (erro) {
    return responder({ ok: false, erro: String(erro) });
  }
}

function responder(objeto) {
  return ContentService.createTextOutput(JSON.stringify(objeto))
    .setMimeType(ContentService.MimeType.JSON);
}
