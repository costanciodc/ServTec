import formidable from "formidable";
import fs from "fs";
import pdfParse from "pdf-parse";
import crypto from "crypto";

export const config = {
  api: {
    bodyParser: false,
  },
};

// valor fixo esperado
const VALOR_ESPERADO_TEXT = "400";
// número fixo esperado (teu expresse)
const NUMERO_EXPRESSE_ESPERADO = "943799795";

// controle de hashes para evitar reuso
const comprovativosUsados = new Set();

function getFileObject(files) {
  if (!files) return null;
  if (files.file) return Array.isArray(files.file) ? files.file[0] : files.file;
  if (files.comprovativo) return Array.isArray(files.comprovativo) ? files.comprovativo[0] : files.comprovativo;
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
      if (!fileObj || (!fileObj.filepath && !fileObj.path)) {
        return res.status(400).json({ sucesso: false, mensagem: "Nenhum arquivo PDF enviado" });
      }

      const pathOnDisk = fileObj.filepath || fileObj.path || fileObj.tempFilePath;
      if (!pathOnDisk) {
        console.error("Caminho do arquivo não encontrado:", fileObj);
        return res.status(500).json({ sucesso: false, mensagem: "Erro interno: arquivo não acessível" });
      }

      const dataBuffer = await fs.promises.readFile(pathOnDisk);

      // hash anti-reuso
      const hash = crypto.createHash("sha256").update(dataBuffer).digest("hex");
      if (comprovativosUsados.has(hash)) {
        return res.status(400).json({ sucesso: false, mensagem: "Comprovativo já utilizado" });
      }

      // extrair texto
      const pdfData = await pdfParse(dataBuffer);
      let texto = (pdfData && pdfData.text) ? String(pdfData.text) : "";
      texto = texto.replace(/\s+/g, " ").toLowerCase(); // normalizar espaços

      // validar valor
      const contemValor = texto.includes(VALOR_ESPERADO_TEXT);

      // validar número (aceita mesmo se vier com espaços quebrados)
      const numeroRegex = new RegExp(NUMERO_EXPRESSE_ESPERADO.split("").join("\\s*"), "i");
      const contemNumero = numeroRegex.test(texto);

      if (!contemValor) {
        return res.status(400).json({ sucesso: false, mensagem: `Valor ${VALOR_ESPERADO_TEXT} não encontrado no comprovativo` });
      }
      if (!contemNumero) {
        return res.status(400).json({ sucesso: false, mensagem: `Número Expresse ${NUMERO_EXPRESSE_ESPERADO} não encontrado no comprovativo` });
      }

      // marca como usado
      comprovativosUsados.add(hash);

      return res.status(200).json({ sucesso: true, mensagem: "Pagamento validado com sucesso" });
    } catch (e) {
      console.error("Erro ao validar comprovativo:", e);
      return res.status(500).json({ sucesso: false, mensagem: "Erro interno ao validar comprovativo" });
    }
  });
}
