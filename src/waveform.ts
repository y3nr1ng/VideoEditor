export function audioPeaks(channels: Float32Array[], bins = 180) {
  const length = Math.max(0, ...channels.map((c) => c.length));
  if (!length) return [];
  return Array.from({ length: Math.min(bins, length) }, (_, i) => {
    const count = Math.min(bins, length),
      start = Math.floor((i * length) / count),
      end = Math.floor(((i + 1) * length) / count);
    let max = 0;
    for (const channel of channels)
      for (
        let j = start;
        j < end;
        j += Math.max(1, Math.floor((end - start) / 300))
      )
        max = Math.max(max, Math.abs(channel[j] ?? 0));
    return Math.min(1, max);
  });
}
export async function nativeAudioWaveform(file: File) {
  let context: AudioContext | undefined;
  try {
    context = new AudioContext();
    const audio = await context.decodeAudioData(await file.arrayBuffer());
    return audioPeaks(
      Array.from({ length: audio.numberOfChannels }, (_, i) =>
        audio.getChannelData(i),
      ),
    );
  } catch {
    return [];
  } finally {
    await context?.close().catch(() => {});
  }
}
