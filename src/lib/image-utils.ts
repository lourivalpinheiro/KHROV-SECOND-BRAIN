/**
 * Redimensiona/recorta uma imagem (arquivo escolhido pelo usuário) para um
 * quadrado de `size`x`size` px e retorna um data URL JPEG — usado pro avatar
 * de perfil, evitando depender do R2 pra uma imagem pequena.
 */
export function fileToSquareDataUrl(file: File, size = 256, quality = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Erro ao ler o arquivo."));
    reader.onload = () => {
      const img = new window.Image();
      img.onerror = () => reject(new Error("Erro ao carregar a imagem."));
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas não suportado."));

        const minSide = Math.min(img.width, img.height);
        const sx = (img.width - minSide) / 2;
        const sy = (img.height - minSide) / 2;

        ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
