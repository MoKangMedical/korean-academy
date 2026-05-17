#!/usr/bin/env python3
"""
Korean Academy — shared audio quality normalizer

Use this on the backend server to make course MP3 files and pronunciation
reference/upload files consistent:

  python3 scripts/normalize_audio_quality.py /opt/korean-academy/backend/audio_cache
  python3 scripts/normalize_audio_quality.py /opt/korean-academy/backend/pronunciation_uploads --pattern '*'
  python3 scripts/normalize_audio_quality.py /path/to/file.mp3 --output /tmp/normalized.mp3

Standard output: MP3, 24000Hz, mono, 48kbps, loudnorm I=-16:TP=-1.5:LRA=9.
"""

import argparse
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path


SAMPLE_RATE = "24000"
CHANNELS = "1"
BITRATE = "48k"
LOUDNORM = "loudnorm=I=-16:TP=-1.5:LRA=9"
SUPPORTED_EXTENSIONS = {".mp3", ".wav", ".m4a", ".mp4", ".webm", ".ogg", ".opus"}


def run(cmd: list[str]) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, capture_output=True, text=True, timeout=120)


def probe(path: Path) -> dict:
    result = run([
        "ffprobe", "-v", "quiet",
        "-show_entries", "stream=codec_name,sample_rate,channels,bit_rate",
        "-of", "json",
        str(path),
    ])
    if result.returncode != 0:
        return {"error": result.stderr.strip() or "ffprobe failed"}
    streams = json.loads(result.stdout or "{}").get("streams") or []
    return streams[0] if streams else {"error": "no audio stream"}


def is_standard(path: Path) -> bool:
    meta = probe(path)
    if meta.get("error"):
        return False
    return (
        meta.get("codec_name") == "mp3"
        and str(meta.get("sample_rate")) == SAMPLE_RATE
        and str(meta.get("channels")) == CHANNELS
        and 45000 <= int(meta.get("bit_rate") or 0) <= 52000
    )


def normalize(input_path: Path, output_path: Path) -> bool:
    result = run([
        "ffmpeg", "-y",
        "-i", str(input_path),
        "-ar", SAMPLE_RATE,
        "-ac", CHANNELS,
        "-b:a", BITRATE,
        "-af", LOUDNORM,
        "-f", "mp3",
        str(output_path),
    ])
    return result.returncode == 0 and output_path.exists() and output_path.stat().st_size > 500


def iter_audio_files(path: Path, pattern: str) -> list[Path]:
    if path.is_file():
        return [path]
    return [
        p for p in sorted(path.glob(pattern))
        if p.is_file() and p.suffix.lower() in SUPPORTED_EXTENSIONS
    ]


def normalize_in_place(path: Path, force: bool) -> dict:
    before = probe(path)
    if not force and is_standard(path):
        return {"status": "skipped", "file": str(path), "before": before}

    tmp_fd, tmp_name = tempfile.mkstemp(prefix=f".{path.stem}.", suffix=".mp3", dir=str(path.parent))
    os.close(tmp_fd)
    tmp_path = Path(tmp_name)
    try:
        if not normalize(path, tmp_path):
            return {"status": "failed", "file": str(path), "before": before, "error": "ffmpeg failed"}
        target = path if path.suffix.lower() == ".mp3" else path.with_suffix(".mp3")
        os.replace(tmp_path, target)
        after = probe(target)
        return {
            "status": "success" if is_standard(target) else "failed",
            "file": str(target),
            "before": before,
            "after": after,
        }
    finally:
        if tmp_path.exists():
            tmp_path.unlink()


def main() -> int:
    parser = argparse.ArgumentParser(description="Normalize Korean Academy audio files")
    parser.add_argument("path", help="Audio file or directory")
    parser.add_argument("--pattern", default="lesson_*.mp3", help="Glob used when path is a directory")
    parser.add_argument("--output", help="Write one normalized file instead of in-place normalization")
    parser.add_argument("--force", action="store_true", help="Re-encode files even if already standard")
    parser.add_argument("--verify", action="store_true", help="Only verify, do not modify")
    args = parser.parse_args()

    path = Path(args.path)
    if not path.exists():
        print(f"missing: {path}", file=sys.stderr)
        return 2

    print(f"standard: mp3 {SAMPLE_RATE}Hz mono {BITRATE}, {LOUDNORM}")

    if args.output:
        output = Path(args.output)
        ok = normalize(path, output)
        print(json.dumps({"status": "success" if ok else "failed", "file": str(output), "meta": probe(output) if ok else None}, ensure_ascii=False))
        return 0 if ok and is_standard(output) else 1

    files = iter_audio_files(path, args.pattern)
    failed = 0
    for audio_file in files:
        if args.verify:
            standard = is_standard(audio_file)
            print(json.dumps({"status": "ok" if standard else "mismatch", "file": str(audio_file), "meta": probe(audio_file)}, ensure_ascii=False))
            failed += 0 if standard else 1
            continue
        result = normalize_in_place(audio_file, force=args.force)
        print(json.dumps(result, ensure_ascii=False))
        failed += 1 if result["status"] == "failed" else 0

    return 0 if failed == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
