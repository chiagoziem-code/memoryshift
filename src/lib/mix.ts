/**
 * Mix spoken lyric lines over the learner's own music, entirely on the device.
 * The track plays as an intro, dips under each spoken line, and fades out.
 * The result is a WAV file they can play and download. Nothing is uploaded.
 */

const SAMPLE_RATE = 44100;

async function decode(blob: Blob): Promise<AudioBuffer> {
  const ctx = new AudioContext();
  try {
    return await ctx.decodeAudioData(await blob.arrayBuffer());
  } finally {
    void ctx.close();
  }
}

function encodeWav(buffer: AudioBuffer): Blob {
  const channels = buffer.numberOfChannels;
  const length = buffer.length * channels * 2;
  const out = new ArrayBuffer(44 + length);
  const view = new DataView(out);
  const write = (o: number, t: string) => [...t].forEach((c, i) => view.setUint8(o + i, c.charCodeAt(0)));
  write(0, "RIFF");
  view.setUint32(4, 36 + length, true);
  write(8, "WAVEfmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * channels * 2, true);
  view.setUint16(32, channels * 2, true);
  view.setUint16(34, 16, true);
  write(36, "data");
  view.setUint32(40, length, true);
  const data = Array.from({ length: channels }, (_, c) => buffer.getChannelData(c));
  let offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let c = 0; c < channels; c++) {
      const s = Math.max(-1, Math.min(1, data[c]![i]!));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      offset += 2;
    }
  }
  return new Blob([out], { type: "audio/wav" });
}

export async function mixOverTrack(track: File | Blob, voiceClips: Blob[]): Promise<Blob> {
  const music = await decode(track);
  const voices = await Promise.all(voiceClips.map(decode));

  const intro = 2.5;
  const gap = 0.6;
  const outro = 3;
  let cursor = intro;
  const starts = voices.map((v) => {
    const at = cursor;
    cursor += v.duration + gap;
    return at;
  });
  const total = Math.min(cursor - gap + outro, 180);

  const ctx = new OfflineAudioContext(2, Math.ceil(total * SAMPLE_RATE), SAMPLE_RATE);

  // Music: loops if shorter than the song, dips under the voice, fades out at the end.
  const musicSource = ctx.createBufferSource();
  musicSource.buffer = music;
  musicSource.loop = music.duration < total;
  const musicGain = ctx.createGain();
  const full = 0.8;
  const under = 0.22;
  musicGain.gain.setValueAtTime(full, 0);
  voices.forEach((v, i) => {
    const start = starts[i]!;
    musicGain.gain.setTargetAtTime(under, Math.max(0, start - 0.3), 0.08);
    const next = starts[i + 1];
    if (next === undefined || next - (start + v.duration) > 0.4) {
      musicGain.gain.setTargetAtTime(full, start + v.duration + 0.1, 0.15);
    }
  });
  musicGain.gain.setValueAtTime(full, Math.max(0, total - outro));
  musicGain.gain.linearRampToValueAtTime(0, total);
  musicSource.connect(musicGain).connect(ctx.destination);
  musicSource.start(0);

  voices.forEach((v, i) => {
    const source = ctx.createBufferSource();
    source.buffer = v;
    const gain = ctx.createGain();
    gain.gain.value = 1.1;
    source.connect(gain).connect(ctx.destination);
    source.start(starts[i]!);
  });

  return encodeWav(await ctx.startRendering());
}
