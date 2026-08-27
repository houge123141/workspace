# -*- coding: utf-8 -*-
"""AGNES 生图脚本
用法:
  python agnes_gen.py "提示词" 输出.jpg [--size 1170x498]
示例:
  python agnes_gen.py "warm flat illustration of open book and toy blocks" cover.jpg --size 1170x498
"""
import argparse
import base64
import sys
import time
from pathlib import Path

import urllib.request
import urllib.error

API_BASE = "https://api.agnes-ai.cn/v1"
MODEL = "agnes-image-2.1-flash"
KEY_FILE = Path(__file__).resolve().parent.parent / ".secrets" / "agnes_api_key.txt"


def get_key() -> str:
    if not KEY_FILE.exists():
        sys.exit(f"密钥文件不存在: {KEY_FILE}")
    return KEY_FILE.read_text(encoding="utf-8").strip()


def postprocess(raw_bytes: bytes, out_path: str, size: str):
    """居中裁剪到目标宽高比并缩放到目标尺寸；按扩展名转格式。"""
    from io import BytesIO
    from PIL import Image

    im = Image.open(BytesIO(raw_bytes))
    if im.mode in ("RGBA", "P", "LA"):
        bg = Image.new("RGB", im.size, (255, 255, 255))
        bg.paste(im.convert("RGBA"), mask=im.convert("RGBA").split()[-1])
        im = bg
    elif im.mode != "RGB":
        im = im.convert("RGB")

    try:
        tw, th = (int(x) for x in size.lower().split("x"))
    except ValueError:
        tw = th = None

    if tw and th:
        tr, sr = tw / th, im.width / im.height
        if sr > tr:  # 太宽，裁两侧
            nw = int(im.height * tr)
            x0 = (im.width - nw) // 2
            im = im.crop((x0, 0, x0 + nw, im.height))
        elif sr < tr:  # 太高，裁上下
            nh = int(im.width / tr)
            y0 = (im.height - nh) // 2
            im = im.crop((0, y0, im.width, y0 + nh))
        if (im.width, im.height) != (tw, th):
            im = im.resize((tw, th), Image.LANCZOS)

    p = Path(out_path)
    if p.suffix.lower() in (".jpg", ".jpeg"):
        im.save(p, "JPEG", quality=92)
    else:
        im.save(p)


def gen_image(prompt: str, out_path: str, size: str = "1024x640", retries: int = 3) -> str:
    key = get_key()
    body = {
        "model": MODEL,
        "prompt": prompt,
        "n": 1,
        "size": size,
    }
    data = __import__("json").dumps(body).encode("utf-8")
    req = urllib.request.Request(
        f"{API_BASE}/images/generations",
        data=data,
        headers={
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    last_err = None
    for attempt in range(1, retries + 1):
        try:
            with urllib.request.urlopen(req, timeout=180) as resp:
                result = __import__("json").loads(resp.read().decode("utf-8"))
            item = result["data"][0]
            if item.get("b64_json"):
                raw = base64.b64decode(item["b64_json"])
            elif item.get("url"):
                with urllib.request.urlopen(item["url"], timeout=120) as r:
                    raw = r.read()
            else:
                raise ValueError(f"响应中没有图片字段: {list(item.keys())}")
            postprocess(raw, out_path, size)
            return out_path
        except urllib.error.HTTPError as e:
            detail = e.read().decode("utf-8", errors="replace")[:300]
            last_err = f"HTTP {e.code}: {detail}"
            if e.code in (429, 500, 502, 503):
                wait = 10 * attempt
                print(f"[重试 {attempt}/{retries}] {last_err}，{wait}s 后再试", file=sys.stderr)
                time.sleep(wait)
                continue
            sys.exit(last_err)
        except Exception as e:
            last_err = str(e)
            print(f"[重试 {attempt}/{retries}] {last_err}", file=sys.stderr)
            time.sleep(5 * attempt)
    sys.exit(f"生成失败: {last_err}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="AGNES 免费生图")
    ap.add_argument("prompt", help="提示词（英文效果更好）")
    ap.add_argument("output", help="输出文件路径 .jpg/.png")
    ap.add_argument("--size", default="1024x640", help="宽x高，如 1170x498（公众号封面）")
    args = ap.parse_args()
    t0 = time.time()
    path = gen_image(args.prompt, args.output, args.size)
    kb = Path(path).stat().st_size // 1024
    print(f"OK {path} ({kb}KB, {time.time()-t0:.1f}s)")
