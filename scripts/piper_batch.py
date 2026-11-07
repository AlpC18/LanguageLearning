"""Synthesizes a batch of texts with one Piper voice into MP3 files.

Usage: piper_batch.py <voice.onnx> <jobs.json>   where jobs.json = [{"text": ..., "out": ".../key.mp3"}, ...]
Called by scripts/build-audio.mjs; loads the voice once, so thousands of clips stay fast.
"""
import io
import json
import subprocess
import sys
import wave

from piper import PiperVoice, SynthesisConfig


def main() -> None:
    voice_path, jobs_path = sys.argv[1], sys.argv[2]
    voice = PiperVoice.load(voice_path)
    config = SynthesisConfig(length_scale=1.05)  # a touch slower than default: clearer for learners
    with open(jobs_path, encoding="utf-8") as f:
        jobs = json.load(f)
    failed = 0
    for i, job in enumerate(jobs, 1):
        buf = io.BytesIO()
        try:
            with wave.open(buf, "wb") as wav:
                voice.synthesize_wav(job["text"], wav, syn_config=config)
            subprocess.run(
                ["ffmpeg", "-loglevel", "error", "-y", "-i", "pipe:0", "-ac", "1", "-codec:a", "libmp3lame", "-b:a", "40k", job["out"]],
                input=buf.getvalue(), check=True,
            )
        except Exception as err:  # keep going; the app falls back to the device voice for missing clips
            failed += 1
            print(f"failed: {job['text'][:60]!r}: {err}", file=sys.stderr)
        if i % 250 == 0:
            print(f"  {i}/{len(jobs)}", flush=True)
    if failed:
        print(f"{failed} clips failed", file=sys.stderr)


if __name__ == "__main__":
    main()
