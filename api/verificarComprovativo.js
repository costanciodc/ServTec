import formidable from "formidable";
import fs from "fs";
import pdfParse from "pdf-parse";

export const config = { api: { bodyParser: false } };

const comprovativosUsados = new Set();
const precos = { curriculo: 400, carta: 100, contrato: 100 };

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ erro: "Método não permitido" });
  }

  const form = formidable();
  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(500).json({ erro: "Erro ao processar formulário" });

    const { servico, modelo, numeroExpresso } = fields;
    const file = files.file?.[0];

    if (!file) return res.status(400).json({ erro: "Nenhum arquivo enviado" });

    try {
      const dataBuffer = await fs.promises.readFile(file.filepath);
      const pdf = await pdfParse(dataBuffer);
      const texto = pdf.text;

      // 🚫 Evitar reutilização
      if (comprovativosUsados.has(texto)) {
        return res.status(400).json({ sucesso: false, mensagem: "Comprovativo já usado!" });
      }

      // ✅ Verificar valor esperado
      const precoEsperado = precos[servico];
      if (!texto.includes(precoEsperado.toString())) {
        return res.status(400).json({ sucesso: false, mensagem: "Valor pago incorreto!" });
      }

      // ✅ Verificar número expresso
      if (!texto.includes(numeroExpresso)) {
        return res.status(400).json({ sucesso: false, mensagem: "Número Expresso não encontrado no comprovativo!" });
      }

      // Marca como usado
      comprovativosUsados.add(texto);

      return res.json({ sucesso: true, mensagem: "✅ Comprovativo válido! Acesso liberado.", servico, modelo });

    } catch (e) {
      return res.status(500).json({ erro: "Erro ao processar PDF" });
    }
  });
}
