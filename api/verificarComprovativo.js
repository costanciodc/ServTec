import formidable from "formidable";
import fs from "fs";
import pdfParse from "pdf-parse";
import crypto from "crypto";

// Armazena hashes dos comprovativos já validados (em memória, reinicia se o servidor reiniciar)
const comprovativosUsados = new Set();

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ sucesso: false, mensagem: "Método não permitido" });
  }

  const form = formidable({ multiples: false });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      return res.status(500).json({ sucesso: false, mensagem: "Erro ao processar upload" });
    }

    try {
      const file = files?.file;
      if (!file) {
        return res.status(400).json({ sucesso: false, mensagem: "Nenhum arquivo enviado" });
      }

      // Lê o PDF
      const dataBuffer = fs.readFileSync(file.filepath || file.path);

      // Gera hash do arquivo para identificar se já foi usado
      const hash = crypto.createHash("sha256").update(dataBuffer).digest("hex");
      if (comprovativosUsados.has(hash)) {
        return res.status(400).json({ sucesso: false, mensagem: "Comprovativo já utilizado" });
      }

      // Analisa o PDF
      const pdfData = await pdfParse(dataBuffer);
      const texto = pdfData.text;

      const numeroExpresseEsperado = "943799795"; // seu número
      const valorEsperado = "400"; // valor esperado (sem pontos)

      const contemNumero = texto.includes(numeroExpresseEsperado);
      const contemValor = texto.includes(valorEsperado);

      if (contemNumero && contemValor) {
        comprovativosUsados.add(hash); // marca como usado
        return res.status(200).json({ sucesso: true, mensagem: "Pagamento válido" });
      } else {
        return res.status(200).json({ sucesso: false, mensagem: "Comprovativo não confere" });
      }
    } catch (e) {
      console.error(e);
      return res.status(500).json({ sucesso: false, mensagem: "Erro ao processar comprovativo" });
    }
  });
}
