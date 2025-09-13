// gerador.js

document.addEventListener("DOMContentLoaded", () => {
  const textoInput = document.getElementById("textoLogo");
  const corTextoInput = document.getElementById("corTexto");
  const corBgInput = document.getElementById("corBg");
  const fonteSelect = document.getElementById("fonte");
  const iconeSelect = document.getElementById("icone");
  const logoPreview = document.getElementById("logoPreview");
  const btnDownload = document.getElementById("btnDownload");

  function atualizarPreview() {
    const texto = textoInput.value || "Minha Marca";
    const corTexto = corTextoInput.value;
    const corBg = corBgInput.value;
    const fonte = fonteSelect.value;
    const icone = iconeSelect.value;

    // Criando o conteúdo do logo
    logoPreview.innerHTML = `
      <div id="logoFinal" style="
        background:${corBg};
        color:${corTexto};
        font-family:${fonte}, sans-serif;
        display:flex;
        align-items:center;
        justify-content:center;
        gap:12px;
        width:300px;
        height:300px;
        font-size:2rem;
        border-radius:20px;
        padding:20px;
        box-sizing:border-box;
        text-align:center;
      ">
        <span style="font-size:3rem;">${icone}</span>
        <span>${texto}</span>
      </div>
    `;
  }

  // Atualiza em tempo real
  [textoInput, corTextoInput, corBgInput, fonteSelect, iconeSelect].forEach(el => {
    el.addEventListener("input", atualizarPreview);
  });

  // Botão de download
  btnDownload.addEventListener("click", () => {
    const logoFinal = document.getElementById("logoFinal");
    if (!logoFinal) return;

    html2canvas(logoFinal, { backgroundColor: null }).then(canvas => {
      const link = document.createElement("a");
      link.download = "logo.png";
      link.href = canvas.toDataURL("image/png");
      link.click();
    });
  });

  // Inicializa com preview
  atualizarPreview();
});
