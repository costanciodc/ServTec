import formidable from "formidable";
import fs from "fs";
import pdfParse from "pdf-parse";
import crypto from "crypto";

// Desativa body parser do Next/Vercel
export const config = {
  api: {
    bodyParser: false,
  },
};

// Número Expresse fixo esperado
const NUMERO_EXPRESSE = "943799795";

// Valor esperado fixo
const VALOR_ESPERADO =300;

// Set para evitar comprovativos repetidos (reinicia em cold start)
const comprovativosUsados = new Set();
const tokensValidos = new Map(); // token -> timestamp



function gerarToken() {
  return crypto.randomBytes(16).toString("hex");
}

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
      const dataBuffer = await fs.promises.readFile(pathOnDisk);

      // Checar comprovativo repetido
      const hash = crypto.createHash("sha256").update(dataBuffer).digest("hex");
      if (comprovativosUsados.has(hash)) {
        return res.status(400).json({ sucesso: false, mensagem: "Comprovativo já utilizado" });
      }

      // Extrair texto do PDF
      const pdfData = await pdfParse(dataBuffer);
      const texto = (pdfData && pdfData.text) ? pdfData.text.replace(/\s+/g, " ").toLowerCase() : "";

      // Valida número Expresse
      const numeroRegex = new RegExp(NUMERO_EXPRESSE.split("").join("\\s*"));
      if (!numeroRegex.test(texto)) {
        return res.status(400).json({ sucesso: false, mensagem: "Número Expresse não encontrado no comprovativo." });
      }

      // Valida valor 400,00
      // Suporta "400,00", "400.00", "400" etc
      const valorRegex = /(\d{1,3}(?:\.\d{3})*|\d+)[,\.](\d{2})?/;
      const encontrado = texto.match(valorRegex);
      if (!encontrado) {
        return res.status(400).json({ sucesso: false, mensagem: "Valor não encontrado no comprovativo." });
      }

      let valorExtraido = encontrado[1].replace(/\./g, "");
      valorExtraido = parseFloat(valorExtraido);
      if (valorExtraido !== VALOR_ESPERADO) {
        return res.status(400).json({ sucesso: false, mensagem: `Valor inválido (${valorExtraido} Kz).` });
      }

      // Tudo certo: marca como usado
      comprovativosUsados.add(hash);

     // 🔑 Gerar token válido por 30 minutos
      const token = gerarToken();
      tokensValidos.set(token, Date.now() + 30 * 60 * 1000);

      return res.status(200).json({ 
        sucesso: true, 
        mensagem: "Pagamento validado com sucesso", 
        token 
      });
    } catch (e) {
      console.error("Erro interno ao validar comprovativo:", e);
      return res.status(500).json({ sucesso: false, mensagem: "Erro interno ao validar comprovativo" });
    }
  });
}

// Função auxiliar para validar token em outras rotas
export function validarToken(token) {
  if (!tokensValidos.has(token)) return false;
  const expira = tokensValidos.get(token);
  if (Date.now() > expira) {
    tokensValidos.delete(token);
    return false;
  }
  return true;
}
  

