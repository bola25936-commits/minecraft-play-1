// Procedural Square Voxel Texture Generator
export function generateBlockTextures() {
  const textures: Record<string, HTMLCanvasElement> = {};
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 16;
  const ctx = canvas.getContext('2d');

  if (!ctx) return textures;

  // Helper to draw blocky pixel noise/patterns
  const createPixelPattern = (baseColor: string, detailColor: string, density: number = 0.3) => {
    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, 16, 16);
    ctx.fillStyle = detailColor;

    for (let x = 0; x < 16; x++) {
      for (let y = 0; y < 16; y++) {
        if (Math.random() < density) {
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }

    const tex = document.createElement('canvas');
    tex.width = 16;
    tex.height = 16;
    const tCtx = tex.getContext('2d');
    tCtx?.drawImage(canvas, 0, 0);
    return tex;
  };

  // Generate specific square textures
  textures['grass'] = createPixelPattern('#55aa55', '#338833', 0.4);
  textures['dirt'] = createPixelPattern('#8b5a2b', '#654321', 0.5);
  textures['stone'] = createPixelPattern('#888888', '#555555', 0.6);
  textures['cobblestone'] = createPixelPattern('#666666', '#333333', 0.7);
  textures['oak_log'] = createPixelPattern('#704214', '#4a2c10', 0.4);
  textures['sand'] = createPixelPattern('#dbd19b', '#c2b57b', 0.3);

  return textures;
}
