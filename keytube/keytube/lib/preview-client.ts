// Utilidades de medios que corren solo en el navegador del creador.
// KeyTube intenta generar vistas previas, pero nunca bloquea la publicación
// si el navegador móvil no soporta MediaRecorder/captureStream.

type Drawable = {
  source: CanvasImageSource;
  width: number;
  height: number;
  cleanup: () => void;
};

function canvasBlob(
  canvas: HTMLCanvasElement,
  type = "image/jpeg",
  quality = 0.82,
) {
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("No se pudo preparar la imagen.")),
      type,
      quality,
    ),
  );
}

async function loadDrawable(file: File): Promise<Drawable> {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(file);
    return {
      source: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      cleanup: () => bitmap.close(),
    };
  }

  const url = URL.createObjectURL(file);
  const image = new Image();
  image.decoding = "async";
  image.src = url;
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("El navegador no puede abrir esta imagen."));
  });
  return {
    source: image,
    width: image.naturalWidth,
    height: image.naturalHeight,
    cleanup: () => URL.revokeObjectURL(url),
  };
}

export async function optimizeImage(
  file: File,
  maxWidth = 1600,
  maxBytes = 3.2 * 1024 * 1024,
) {
  const drawable = await loadDrawable(file);
  try {
    const scale = Math.min(1, maxWidth / drawable.width);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(drawable.width * scale));
    canvas.height = Math.max(1, Math.round(drawable.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Tu navegador no pudo preparar la imagen.");
    ctx.fillStyle = "#0b1326";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(drawable.source, 0, 0, canvas.width, canvas.height);

    let quality = 0.86;
    let blob = await canvasBlob(canvas, "image/jpeg", quality);
    while (blob.size > maxBytes && quality > 0.5) {
      quality -= 0.08;
      blob = await canvasBlob(canvas, "image/jpeg", quality);
    }
    if (blob.size > maxBytes)
      throw new Error("La imagen es demasiado grande incluso después de optimizarla.");
    const base = (file.name || "imagen").replace(/\.[^.]+$/, "").slice(0, 90) || "imagen";
    return new File([blob], `${base}.jpg`, { type: "image/jpeg" });
  } finally {
    drawable.cleanup();
  }
}

export async function imagePreview(file: File) {
  const drawable = await loadDrawable(file);
  try {
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 720 / drawable.width);
    canvas.width = Math.max(1, Math.round(drawable.width * scale));
    canvas.height = Math.max(1, Math.round(drawable.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Tu navegador no pudo preparar la vista previa.");
    ctx.filter = "blur(5px)";
    ctx.drawImage(drawable.source, 0, 0, canvas.width, canvas.height);
    ctx.filter = "none";
    ctx.fillStyle = "#050916c9";
    ctx.fillRect(0, canvas.height - 44, canvas.width, 44);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 16px sans-serif";
    ctx.fillText("KEYTUBE · VISTA PREVIA", 16, canvas.height - 16);
    return new File([await canvasBlob(canvas)], "vista-previa.jpg", {
      type: "image/jpeg",
    });
  } finally {
    drawable.cleanup();
  }
}

async function waitForMedia(
  media: HTMLMediaElement,
  message: string,
  timeoutMs = 20000,
) {
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
    media.onloadedmetadata = () => {
      clearTimeout(timeout);
      resolve();
    };
    media.onerror = () => {
      clearTimeout(timeout);
      reject(new Error(message));
    };
    media.load();
  });
}

function pickRecorderMime(candidates: string[]) {
  if (typeof MediaRecorder === "undefined") return "";
  return candidates.find((mime) => MediaRecorder.isTypeSupported(mime)) || "";
}

export async function audioPreview(file: File) {
  if (typeof MediaRecorder === "undefined")
    throw new Error("Este navegador móvil no puede generar el adelanto de audio.");
  const AudioContextClass =
    window.AudioContext ||
    (window as typeof window & { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioContextClass)
    throw new Error("Este navegador no puede preparar el adelanto de audio.");

  const audio = document.createElement("audio");
  const url = URL.createObjectURL(file);
  audio.src = url;
  audio.preload = "metadata";
  audio.style.display = "none";
  document.body.appendChild(audio);
  const ctx = new AudioContextClass();
  let recorder: MediaRecorder | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;

  try {
    await waitForMedia(audio, "El navegador no puede abrir este audio.");
    await ctx.resume();
    const source = ctx.createMediaElementSource(audio);
    const dest = ctx.createMediaStreamDestination();
    source.connect(dest);
    const mime = pickRecorderMime([
      "audio/mp4;codecs=mp4a.40.2",
      "audio/mp4",
      "audio/webm;codecs=opus",
      "audio/webm",
    ]);
    if (!mime)
      throw new Error("Este navegador no puede generar el adelanto de audio.");
    recorder = new MediaRecorder(dest.stream, {
      mimeType: mime,
      audioBitsPerSecond: 64000,
    });
    const chunks: Blob[] = [];
    const result = new Promise<Blob>((resolve, reject) => {
      recorder!.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      recorder!.onstop = () => resolve(new Blob(chunks, { type: mime }));
      recorder!.onerror = () =>
        reject(new Error("No se pudo preparar el adelanto del audio."));
    });
    recorder.start(250);
    await audio.play();
    const durationMs = Number.isFinite(audio.duration)
      ? Math.min(9800, Math.max(1000, audio.duration * 1000 - 200))
      : 9800;
    timer = setTimeout(() => {
      audio.pause();
      if (recorder?.state === "recording") recorder.stop();
    }, durationMs);
    audio.onended = () => {
      if (recorder?.state === "recording") recorder.stop();
    };
    const blob = await result;
    const isMp4 = mime.startsWith("audio/mp4");
    return new File([blob], isMp4 ? "adelanto-10s.m4a" : "adelanto-10s.webm", {
      type: isMp4 ? "audio/mp4" : "audio/webm",
    });
  } finally {
    if (timer) clearTimeout(timer);
    if (recorder?.state === "recording") recorder.stop();
    audio.pause();
    audio.remove();
    URL.revokeObjectURL(url);
    await ctx.close();
  }
}

export async function videoCover(file: File) {
  const video = document.createElement("video");
  const url = URL.createObjectURL(file);
  video.src = url;
  video.muted = true;
  video.playsInline = true;
  video.preload = "metadata";
  video.style.cssText = "position:fixed;left:-10000px;width:1px;height:1px;";
  document.body.appendChild(video);
  try {
    await waitForMedia(
      video,
      "El navegador no puede abrir este video. Prueba MP4 H.264 para máxima compatibilidad.",
    );
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 960 / Math.max(1, video.videoWidth));
    canvas.width = Math.max(2, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(2, Math.round(video.videoHeight * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No se pudo preparar la portada del video.");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return new File([await canvasBlob(canvas)], "portada.jpg", {
      type: "image/jpeg",
    });
  } finally {
    video.pause();
    video.remove();
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
  }
}

export async function videoPreview(
  file: File,
  onProgress: (seconds: number) => void,
) {
  if (typeof MediaRecorder === "undefined")
    throw new Error("Este navegador móvil no puede generar un video de adelanto.");

  const video = document.createElement("video") as HTMLVideoElement & {
    captureStream?: () => MediaStream;
  };
  const url = URL.createObjectURL(file);
  video.src = url;
  video.muted = true;
  video.playsInline = true;
  video.preload = "metadata";
  video.style.cssText = "position:fixed;left:-10000px;width:2px;height:2px;";
  document.body.appendChild(video);
  let sourceStream: MediaStream | undefined;
  let stream: MediaStream | undefined;
  let frame = 0;
  let timer: ReturnType<typeof setInterval> | undefined;
  let recorder: MediaRecorder | undefined;

  try {
    await waitForMedia(
      video,
      "El navegador no puede abrir este video. MP4 H.264 ofrece la mejor compatibilidad.",
    );
    const cap = Math.min(
      9.8,
      Number.isFinite(video.duration) ? Math.max(1, video.duration - 0.2) : 9.8,
    );
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 854 / Math.max(1, video.videoWidth));
    canvas.width = Math.max(2, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(2, Math.round(video.videoHeight * scale));
    const drawCtx = canvas.getContext("2d");
    if (!drawCtx || typeof canvas.captureStream !== "function")
      throw new Error("Este navegador no puede generar el adelanto automático.");
    drawCtx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const cover = new File([await canvasBlob(canvas)], "portada.jpg", {
      type: "image/jpeg",
    });
    const canvasStream = canvas.captureStream(24);
    await video.play();
    sourceStream = video.captureStream?.();
    stream = new MediaStream([
      ...canvasStream.getVideoTracks(),
      ...(sourceStream?.getAudioTracks() || []),
    ]);
    const mime = pickRecorderMime([
      "video/mp4;codecs=avc1.42E01E",
      "video/mp4",
      "video/webm;codecs=vp8,opus",
      "video/webm",
    ]);
    if (!mime)
      throw new Error("Este navegador no puede generar el adelanto automático.");
    recorder = new MediaRecorder(stream, {
      mimeType: mime,
      videoBitsPerSecond: 850000,
      audioBitsPerSecond: 64000,
    });
    const chunks: Blob[] = [];
    const result = new Promise<Blob>((resolve, reject) => {
      recorder!.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      recorder!.onstop = () => resolve(new Blob(chunks, { type: mime }));
      recorder!.onerror = () =>
        reject(new Error("No se pudo preparar el adelanto del video."));
    });
    const finish = () => {
      video.pause();
      if (recorder?.state === "recording") recorder.stop();
    };
    const draw = () => {
      drawCtx.drawImage(video, 0, 0, canvas.width, canvas.height);
      frame = requestAnimationFrame(draw);
    };
    recorder.start(250);
    draw();
    const started = performance.now();
    timer = setInterval(() => {
      onProgress(Math.min(10, video.currentTime));
      if (video.currentTime >= cap || video.ended || performance.now() - started > 10200)
        finish();
    }, 60);
    video.onended = finish;
    const blob = await result;
    const isMp4 = mime.startsWith("video/mp4");
    return {
      preview: new File([blob], isMp4 ? "adelanto-10s.mp4" : "adelanto-10s.webm", {
        type: isMp4 ? "video/mp4" : "video/webm",
      }),
      cover,
    };
  } finally {
    if (timer) clearInterval(timer);
    cancelAnimationFrame(frame);
    if (recorder?.state === "recording") recorder.stop();
    stream?.getTracks().forEach((track) => track.stop());
    sourceStream?.getTracks().forEach((track) => track.stop());
    video.pause();
    video.remove();
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
  }
}
