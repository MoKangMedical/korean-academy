import asyncio
import os
from typing import Iterable

import httpx
from fastapi import FastAPI, Request, Response


UPSTREAM_BASE = os.environ.get(
    "KOREAN_ACADEMY_UPSTREAM",
    "https://eterna-niannian.cloud/korean-api",
).rstrip("/")

app = FastAPI(title="Korean Academy API Proxy", version="0.1.0")

HOP_BY_HOP_HEADERS = {
    "connection",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailers",
    "transfer-encoding",
    "upgrade",
}


def filtered_headers(items: Iterable[tuple[str, str]]) -> dict[str, str]:
    headers: dict[str, str] = {}
    for key, value in items:
        lower = key.lower()
        if lower in HOP_BY_HOP_HEADERS or lower in {"host", "content-length"}:
            continue
        headers[key] = value
    return headers


async def normalize_mp3(payload: bytes) -> bytes:
    proc = await asyncio.create_subprocess_exec(
        "ffmpeg",
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        "pipe:0",
        "-vn",
        "-ac",
        "1",
        "-ar",
        "24000",
        "-b:a",
        "48k",
        "-filter:a",
        "loudnorm=I=-16:TP=-1.5:LRA=9",
        "-f",
        "mp3",
        "pipe:1",
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await proc.communicate(payload)
    if proc.returncode != 0 or not stdout:
        raise RuntimeError(stderr.decode("utf-8", "ignore") or "ffmpeg failed")
    return stdout


def is_tts_path(path: str) -> bool:
    return path == "tts" or path.startswith("tts/")


@app.get("/health")
async def health() -> dict[str, str]:
    return {
        "status": "ok",
        "app": "Korean Academy API Proxy",
        "upstream": UPSTREAM_BASE,
        "audio": "mp3,24000Hz,mono,48kbps,loudnorm",
    }


@app.api_route("/{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"])
async def proxy(path: str, request: Request) -> Response:
    if request.method == "OPTIONS":
        return Response(
            status_code=204,
            headers={
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "*",
                "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
            },
        )

    upstream_url = f"{UPSTREAM_BASE}/{path}"
    body = await request.body()
    async with httpx.AsyncClient(timeout=120.0, follow_redirects=True) as client:
        upstream = await client.request(
            request.method,
            upstream_url,
            params=request.query_params,
            content=body,
            headers=filtered_headers(request.headers.items()),
        )

    content = upstream.content
    content_type = upstream.headers.get("content-type", "")
    response_headers = filtered_headers(upstream.headers.items())

    if request.method == "GET" and is_tts_path(path) and upstream.status_code < 400:
        if "audio" in content_type or "mpeg" in content_type or content.startswith(b"ID3"):
            content = await normalize_mp3(content)
            content_type = "audio/mpeg"
            response_headers.pop("content-length", None)
            response_headers["Cache-Control"] = "public, max-age=86400"
            response_headers["X-Audio-Quality"] = "mp3; rate=24000; channels=1; bitrate=48000"

    response_headers["Access-Control-Allow-Origin"] = "*"
    response_headers["Access-Control-Allow-Headers"] = "*"
    response_headers["Access-Control-Allow-Methods"] = "GET,POST,PUT,PATCH,DELETE,OPTIONS"

    return Response(
        content=content,
        status_code=upstream.status_code,
        media_type=content_type.split(";")[0] if content_type else None,
        headers=response_headers,
    )
