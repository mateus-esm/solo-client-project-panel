"""
Regenera artifacts/api-server/src/lib/grupo-avatar.ts a partir da arte-fonte.

    python scripts/src/gerar-avatar-grupo.py

Fonte: planning/assets/grupo-avatar.jpg (a marca da Solo em fundo preto).
Saída: um módulo TS com o JPEG 512x512 em base64, pronto para o endpoint
       POST /v1/group/updateGroupPicture do whatsmiau.

Por que reduzir a marca: o WhatsApp recorta a foto do grupo em círculo. O símbolo
da Solo é largo, então sem folga as pontas laterais somem no recorte. 72% do
quadro mantém a marca inteira dentro do círculo.

Requer Pillow (pip install pillow). Roda fora do build — o .ts gerado é commitado.
"""

import base64
import io
from pathlib import Path

from PIL import Image

RAIZ = Path(__file__).resolve().parents[2]
FONTE = RAIZ / "planning" / "assets" / "grupo-avatar.jpg"
SAIDA = RAIZ / "artifacts" / "api-server" / "src" / "lib" / "grupo-avatar.ts"

LADO = 512
PROPORCAO_MARCA = 0.72
QUALIDADE = 88

CABECALHO = """/**
 * Foto dos grupos de WhatsApp da Solo — a marca sobre fundo preto.
 *
 * JPEG 512x512, gerado a partir de planning/assets/grupo-avatar.jpg com a marca
 * reduzida a 72% do quadro: o WhatsApp recorta a foto do grupo em círculo e o
 * símbolo é largo, então sem essa folga as pontas ficam cortadas.
 *
 * Embutido como base64 porque o build (esbuild) gera um único dist/index.mjs —
 * um arquivo solto ao lado não seria copiado. São ~12 KB, custo irrelevante.
 * Regenerar: python scripts/src/gerar-avatar-grupo.py
 */
export const GRUPO_AVATAR_JPEG_BASE64 =
"""


def main() -> None:
    marca_lado = int(LADO * PROPORCAO_MARCA)
    marca = Image.open(FONTE).convert("RGB").resize((marca_lado, marca_lado), Image.LANCZOS)

    quadro = Image.new("RGB", (LADO, LADO), (0, 0, 0))
    canto = (LADO - marca_lado) // 2
    quadro.paste(marca, (canto, canto))

    buffer = io.BytesIO()
    quadro.save(buffer, "JPEG", quality=QUALIDADE, optimize=True)
    b64 = base64.b64encode(buffer.getvalue()).decode()

    pedacos = [b64[i : i + 120] for i in range(0, len(b64), 120)]
    corpo = "\n".join(f'  "{p}" +' for p in pedacos[:-1]) + f'\n  "{pedacos[-1]}";\n'

    SAIDA.write_text(CABECALHO + corpo, encoding="utf-8", newline="\n")
    print(f"{SAIDA.relative_to(RAIZ)} — {len(buffer.getvalue())} bytes de JPEG, {len(b64)} de base64")


if __name__ == "__main__":
    main()
