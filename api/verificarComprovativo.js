import formidable from "formidable";
import fs from "fs";
import pdfParse from "pdf-parse";

// 🚨 Importante para Vercel: desativar o bodyParser padrão
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ erro: "Método não permitido" });
  }

  const form = formidable({ multiples: false });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      return res.status(500).json({ erro: "Erro ao processar upload" });
    }

    try {
      const file = files.file;
      if (!file) {
        return res.status(400).json({ erro: "Nenhum arquivo enviado" });
      }

      // Ler o PDF
      const dataBuffer = fs.readFileSync(file.filepath);
      const pdfData = await pdfParse(dataBuffer);
      const texto = pdfData.text;

      // Exemplo de validação:
      const numeroExpresseEsperado = "943799795"; // ← troque para o seu número
      const valorEsperado = "400"; // ← troque para o valor correto (sem pontos)

      const contemNumero = texto.includes(numeroExpresseEsperado);
      const contemValor = texto.includes(valorEsperado);

      if (contemNumero && contemValor) {
        return res.status(200).json({ sucesso: true, mensagem: "Pagamento válido" });
      } else {
        return res.status(200).json({ sucesso: false, mensagem: "Comprovativo não confere" });
      }
    } catch (e) {
      console.error(e);
      return res.status(500).json({ erro: "Erro ao processar comprovativo" });
    }
  });
}
