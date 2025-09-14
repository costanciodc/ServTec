import formidable from "formidable";
import fs from "fs";
import pdfParse from "pdf-parse";
import crypto from "crypto";

export const config = {
  api: {
    bodyParser: false,
  },
};

// Número expresse fixo
const NUMERO_EXPRESSE_ESPERADO = "943799795";
// Conjunto de comprovativos já usados
const comprovativosUsados = new Set();

function getFileObject(files) {
  if (!files) return null;
  if (files.file) return Array.isArray(files.file) ? files.file[0] : files.file;
  const keys = Object.keys(files);
  if (keys.length === 0) return null;
  const f = files[keys[0]];
  return Array.isArray(f) ? f[0] : f;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res
      .status(405)
      .json({ sucesso: false, mensagem: "Método não permitido" });
  }

  const form = formidable({ multiples: false });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error("Erro no parse:", err);
      return res
        .status(500)
        .json({ sucesso: false, mensagem: "Erro ao processar upload" });
    }

    try {
      const fileObj = getFileObject(files);
      if (!fileObj || (!fileObj.filepath && !fileObj.path)) {
        return res
          .status(400)
          .json({ sucesso: false, mensagem: "Nenhum arquivo enviado" });
      }

      const pathOnDisk = fileObj.filepath || fileObj.path;
      const dataBuffer = await fs.promises.readFile(pathOnDisk);

      // Hash para evitar reaproveitamento
      const hash = crypto.createHash("sha256").update(dataBuffer).digest("hex");
      if (comprovativosUsados.has(hash)) {
        return res
          .status(400)
          .json({ sucesso: false, mensagem: "Comprovativo já utilizado" });
      }

      // Extrair texto do PDF
      const pdfData = await pdfParse(dataBuffer);
      const texto = (pdfData.text || "").replace(/\s+/g, " ");

      // 🔎 Validação do número expresse (ignora espaços)
      const numeroRegex = new RegExp(
        NUMERO_EXPRESSE_ESPERADO.split("").join("\\s*"),
        "i"
      );
      const contemNumero = numeroRegex.test(texto);

      // 🔎 Validação do valor "400,00 Kz" (aceita variações)
      const valorRegex = /\b400(?:[,.]00)?\s*Kz\b|\b400(?:[,.]00)?Kz\b/i;
      const contemValor = valorRegex.test(texto);

      if (!contemNumero) {
        return res.status(400).json({
          sucesso: false,
          mensagem: "Número Expresse não encontrado no comprovativo",
        });
      }
      if (!contemValor) {
        return res.status(400).json({
          sucesso: false,
          mensagem: "Valor 400,00 Kz não encontrado no comprovativo",
        });
      }

      comprovativosUsados.add(hash);

      return res
        .status(200)
        .json({ sucesso: true, mensagem: "Pagamento validado com sucesso" });
    } catch (e) {
      console.error("Erro ao validar:", e);
      return res
        .status(500)
        .json({ sucesso: false, mensagem: "Erro interno ao validar comprovativo" });
    }
  });
}
