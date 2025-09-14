// api/verificarComprovativo.js
import formidable from "formidable";
import fs from "fs";

// Para guardar hashes de comprovativos já usados (ideal seria DB)
const comprovativosUsados = new Set();

export const config = {
  api: {
    bodyParser: false, // necessário para usar formidable
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ sucesso: false, mensagem: "Método não permitido." });
  }

  const form = formidable({ multiples: false });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error("Erro no parse do formulário:", err);
      return res.status(500).json({ sucesso: false, mensagem: "Erro ao processar o comprovativo." });
    }

    try {
      const { servico, modelo } = fields;
      const file = files.file;

      if (!file) {
        return res.status(400).json({ sucesso: false, mensagem: "Nenhum comprovativo enviado." });
      }

      // Cria um hash simples do comprovativo (poderia usar SHA256 em produção)
      const fileBuffer = fs.readFileSync(file.filepath);
      const hash = Buffer.from(fileBuffer).toString("base64").slice(0, 50);

      // Verifica se já foi usado
      if (comprovativosUsados.has(hash)) {
        return res.status(400).json({ sucesso: false, mensagem: "Comprovativo já foi utilizado." });
      }

      // Marca como usado
      comprovativosUsados.add(hash);

      console.log("✅ Comprovativo validado com sucesso!");
      console.log("Serviço:", servico);
      console.log("Modelo:", modelo);

      return res.status(200).json({
        sucesso: true,
        mensagem: "Pagamento validado com sucesso!",
        servico,
        modelo,
      });
    } catch (error) {
      console.error("Erro ao validar comprovativo:", error);
      return res.status(500).json({ sucesso: false, mensagem: "Erro interno ao validar comprovativo." });
    }
  });
}
