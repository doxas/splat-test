
export const createWorker = (self) => {
  // 6*4 + 4 + 4 = 8*4
  // XYZ - Position (Float32)
  // XYZ - Scale (Float32)
  // RGBA - colors (uint8)
  // IJKL - quaternion/rot (uint8)
  const ROW_LENGTH = 3 * 4 + 3 * 4 + 4 + 4;
  
  const floatToHalf = (float: number): number => {
    const floatView = new Float32Array(1);
    const int32View = new Int32Array(floatView.buffer);
    floatView[0] = float;
    const int32 = int32View[0];
    const sign = (int32 >> 31) & 0x0001;
    const exp = (int32 >> 23) & 0x00ff;
    let frac = int32 & 0x007fffff;
    let newExp;
    if (exp == 0) {
      newExp = 0;
    } else if (exp < 113) {
      newExp = 0;
      frac |= 0x00800000;
      frac = frac >> (113 - exp);
      if (frac & 0x01000000) {
        newExp = 1;
        frac = 0;
      }
    } else if (exp < 142) {
      newExp = exp - 112;
    } else {
      newExp = 31;
      frac = 0;
    }
    return (sign << 15) | (newExp << 10) | (frac >> 13);
  };
  const packHalf2x16 = (x: number, y: number): number => {
    return (floatToHalf(x) | (floatToHalf(y) << 16)) >>> 0;
  };

  let currentBuffer: ArrayBufferLike = null;
  let vertexCount = 0;
  let currentViewProjectionMatrix;
  let lastViewProjectionMatrix = [];
  let currentVertexCount = 0;
  let depthIndex = new Uint32Array();

  const generateTexture = (): void => {
    if (currentBuffer == null) {return;}
    const currentBufferFloatView = new Float32Array(currentBuffer);
    const currentBufferUintView = new Uint8Array(currentBuffer);

    const textureWidth = 1024 * 2; // Set to your desired width
    const textureHeight = Math.ceil((vertexCount * 2) / textureWidth); // Set to your desired height
    const textureData = new Uint32Array(textureWidth * textureHeight * 4); // 4 components per pixel (RGBA)
    const textureDataFloatView = new Float32Array(textureData.buffer);
    const textureDataUintView = new Uint8Array(textureData.buffer);

    // Here we convert from a .splat file buffer into a texture
    // With a little bit more foresight perhaps this texture file
    // should have been the native format as it'd be very easy to
    // load it into webgl.
    for (let i = 0; i < vertexCount; i++) {
      // x, y, z
      const fIndex = 8 * i;
      textureDataFloatView[fIndex + 0] = currentBufferFloatView[fIndex + 0];
      textureDataFloatView[fIndex + 1] = currentBufferFloatView[fIndex + 1];
      textureDataFloatView[fIndex + 2] = currentBufferFloatView[fIndex + 2];

      // r, g, b, a
      const uiIndex = 4 * (fIndex + 7);
      const bIndex = 32 * i + 24;
      textureDataUintView[uiIndex + 0] = currentBufferUintView[bIndex + 0];
      textureDataUintView[uiIndex + 1] = currentBufferUintView[bIndex + 1];
      textureDataUintView[uiIndex + 2] = currentBufferUintView[bIndex + 2];
      textureDataUintView[uiIndex + 3] = currentBufferUintView[bIndex + 3];

      // quaternions
      const sIndex = 8 * i + 3;
      const s = [
        currentBufferFloatView[sIndex + 0],
        currentBufferFloatView[sIndex + 1],
        currentBufferFloatView[sIndex + 2],
      ];
      const rIndex = 32 * i + 28;
      const r = [
        (currentBufferUintView[rIndex + 0] - 128) / 128,
        (currentBufferUintView[rIndex + 1] - 128) / 128,
        (currentBufferUintView[rIndex + 2] - 128) / 128,
        (currentBufferUintView[rIndex + 3] - 128) / 128,
      ];

      // Compute the matrix product of S and R (M = S * R)
      const M = [
        1.0 - 2.0 * (r[2] * r[2] + r[3] * r[3]),
        2.0 * (r[1] * r[2] + r[0] * r[3]),
        2.0 * (r[1] * r[3] - r[0] * r[2]),

        2.0 * (r[1] * r[2] - r[0] * r[3]),
        1.0 - 2.0 * (r[1] * r[1] + r[3] * r[3]),
        2.0 * (r[2] * r[3] + r[0] * r[1]),

        2.0 * (r[1] * r[3] + r[0] * r[2]),
        2.0 * (r[2] * r[3] - r[0] * r[1]),
        1.0 - 2.0 * (r[1] * r[1] + r[2] * r[2]),
      ].map((k, i) => k * s[Math.floor(i / 3)]);

      const sigma = [
        M[0] * M[0] + M[3] * M[3] + M[6] * M[6],
        M[0] * M[1] + M[3] * M[4] + M[6] * M[7],
        M[0] * M[2] + M[3] * M[5] + M[6] * M[8],
        M[1] * M[1] + M[4] * M[4] + M[7] * M[7],
        M[1] * M[2] + M[4] * M[5] + M[7] * M[8],
        M[2] * M[2] + M[5] * M[5] + M[8] * M[8],
      ];

      textureData[fIndex + 4] = packHalf2x16(4 * sigma[0], 4 * sigma[1]);
      textureData[fIndex + 5] = packHalf2x16(4 * sigma[2], 4 * sigma[3]);
      textureData[fIndex + 6] = packHalf2x16(4 * sigma[4], 4 * sigma[5]);
    }

    self.postMessage({textureData, textureWidth, textureHeight}, [textureData.buffer]);
  };

  const runSort = (viewProjectionMatrix) => {
    if (!currentBuffer) {return;}
    const currentBufferFloatView = new Float32Array(currentBuffer);
    if (currentVertexCount == vertexCount) {
      let dot =
        lastViewProjectionMatrix[2] * viewProjectionMatrix[2] +
        lastViewProjectionMatrix[6] * viewProjectionMatrix[6] +
        lastViewProjectionMatrix[10] * viewProjectionMatrix[10];
      if (Math.abs(dot - 1) < 0.01) {
        return;
      }
    } else {
      generateTexture();
      currentVertexCount = vertexCount;
    }

    console.time('sort');

    let maxDepth = -Infinity;
    let minDepth = Infinity;
    let sizeList = new Int32Array(vertexCount);
    for (let i = 0; i < vertexCount; i++) {
      const depth = (
        (
          viewProjectionMatrix[2] * currentBufferFloatView[8 * i + 0] +
          viewProjectionMatrix[6] * currentBufferFloatView[8 * i + 1] +
          viewProjectionMatrix[10] * currentBufferFloatView[8 * i + 2]
        ) * 4096) | 0;
      sizeList[i] = depth;
      if (depth > maxDepth) {maxDepth = depth;}
      if (depth < minDepth) {minDepth = depth;}
    }

    // This is a 16 bit single-pass counting sort
    const bitLength = 256 * 256; // 16 bit
    const depthInv = bitLength / (maxDepth - minDepth);
    const counts0 = new Uint32Array(bitLength);
    const starts0 = new Uint32Array(bitLength);
    depthIndex = new Uint32Array(vertexCount);
    for (let i = 0; i < vertexCount; i++) {
      sizeList[i] = ((sizeList[i] - minDepth) * depthInv) | 0;
      counts0[sizeList[i]]++;
    }
    for (let i = 1; i < bitLength; i++) {
      starts0[i] = starts0[i - 1] + counts0[i - 1];
    }
    for (let i = 0; i < vertexCount; i++) {
      depthIndex[starts0[sizeList[i]]++] = i;
    }

    // depthIndex.reverse();

    console.timeEnd('sort');

    lastViewProjectionMatrix = viewProjectionMatrix;
    self.postMessage({ depthIndex, viewProjectionMatrix, vertexCount }, [
      depthIndex.buffer,
    ]);
  };

  const throttledSort = () => {
    if (sortRunning !== true) {
      sortRunning = true;
      let lastView = currentViewProjectionMatrix;
      runSort(lastView);
      setTimeout(() => {
        sortRunning = false;
        if (lastView !== currentViewProjectionMatrix) {
          throttledSort();
        }
      }, 0);
    }
  };

  let sortRunning: boolean = false;
  self.onmessage = (e) => {
    if (e.data.buffer) {
      currentBuffer = e.data.buffer;
      vertexCount = e.data.vertexCount;
      throttledSort();
    } else if (e.data.vertexCount) {
      vertexCount = e.data.vertexCount;
    } else if (e.data.view) {
      currentViewProjectionMatrix = e.data.view;
      throttledSort();
    }
  };
};
