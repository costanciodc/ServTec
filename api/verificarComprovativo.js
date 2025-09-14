import formidable from "formidable";
import fs from "fs";
import pdfParse from "pdf-parse";
import crypto from "crypto";

/**
 * Backend Vercel -> valida comprovativo apenas para 400 Kz.
 * Recebe multipart/form-data com:
 *  - file (o PDF)
 *  - numeroExpresse (opcional; o frontend pode enviar)
 *  - modelo / servico (opcional)
 *
 * Resposta JSON:
 *  { sucesso: true, mensagem: "..." }  -> caso válido
 *  { sucesso: false, mensagem: "..." } -> caso inválido
 */

export const config = {
  api: {
    bodyParser: false, // obrigatório para uploads com formidable no Vercel
  },
};

// Número Expresse que o sistema espera (altera se necessário)
const NUMERO_EXPRESSE_ESPERADO = "943799795";

// Valor esperado fixo (400 Kz)
const VALOR_ESPERADO_TEXT = "400";

// Controle em memória de comprovativos já usados (reinicia em cold start/redeploy)
const comprovativosUsados = new Set();

function getFileObject(files) {
  // tenta suportar formatos de resposta do formidable (array ou object)
  if (!files) return null;
  if (files.file) return Array.isArray(files.file) ? files.file[0] : files.file;
  if (files.comprovativo) return Array.isArray(files.comprovativo) ? files.comprovativo[0] : files.comprovativo;
  // pega a primeira propriedade encontrada
  const keys = Object.keys(files);
  if (keys.length === 0) return null;
  const f = files[keys[0]];
  return Array.isArray(f) ? f[0] : f;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ sucesso: false, mensagem: "Método não permitido" });
  }

  const form = formidable({ multiples: false });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error("Erro no parse do formulário:", err);
      return res.status(500).json({ sucesso: false, mensagem: "Erro ao processar upload" });
    }

    try {
      const fileObj = getFileObject(files);
      if (!fileObj || !fileObj.filepath && !fileObj.path) {
        return res.status(400).json({ sucesso: false, mensagem: "Nenhum arquivo PDF enviado" });
      }

      // lê o PDF (usa filepath ou path conforme a versão do formidable)
      const pathOnDisk = fileObj.filepath || fileObj.path || fileObj.tempFilePath;
      if (!pathOnDisk) {
        console.error("Caminho do arquivo não encontrado em fileObj:", fileObj);
        return res.status(500).json({ sucesso: false, mensagem: "Erro interno: arquivo não acessível" });
      }

      const dataBuffer = await fs.promises.readFile(pathOnDisk);

      // gera hash SHA-256 do conteúdo para impedir reutilização
      const hash = crypto.createHash("sha256").update(dataBuffer).digest("hex");
      if (comprovativosUsados.has(hash)) {
        return res.status(400).json({ sucesso: false, mensagem: "Comprovativo já utilizado" });
      }

      // extrai texto do PDF
      const pdfData = await pdfParse(dataBuffer);
      const texto = (pdfData && pdfData.text) ? String(pdfData.text) : "";

      // valida se contém o valor esperado (400)
      // cuidado: comparações simples — caso o comprovativo use "400,00" ou "400.00" etc,
      // a string "400" normalmente será encontrada. Ajuste se necessário.
      const contemValor = texto.includes(VALOR_ESPERADO_TEXT);

      // valida número expresse — tenta usar campo enviado, se não usar o número fixo esperado
      const numeroEnviado = (fields.numeroExpresse && fields.numeroExpresse.toString()) || NUMERO_EXPRESSE_ESPERADO;
      const contemNumero = texto.includes(numeroEnviado) || texto.includes(NUMERO_EXPRESSE_ESPERADO);

      if (!contemValor) {
        return res.status(400).json({ sucesso: false, mensagem: `Valor ${VALOR_ESPERADO_TEXT} não encontrado no comprovativo` });
      }
      if (!contemNumero) {
        return res.status(400).json({ sucesso: false, mensagem: `Número Expresse não encontrado no comprovativo` });
      }

      // tudo ok -> marca como usado e retorna sucesso
      comprovativosUsados.add(hash);

      return res.status(200).json({ sucesso: true, mensagem: "Pagamento validado com sucesso" });
    } catch (e) {
      console.error("Erro ao validar comprovativo:", e);
      return res.status(500).json({ sucesso: false, mensagem: "Erro interno ao validar comprovativo" });
    }
  });
}
