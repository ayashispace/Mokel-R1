"""Read a single attachment from stdin; return extracted text or a sanitized image.
No uploaded files are written to disk.
"""
import sys, json, base64, io, zipfile
from pathlib import Path
def process(item):
    raw = base64.b64decode(item["data"], validate=True)
    if len(raw) > 12 * 1024 * 1024:
        raise ValueError("Files must be 12 MB or smaller.")
    name = item.get("name", "file")
    ext = Path(name).suffix.lower()
    result = {"name": name, "size": len(raw), "mimeType": item.get("mimeType", "application/octet-stream"), "mode": "stored-only"}
    if ext in {".png", ".jpg", ".jpeg", ".webp"}:
        from PIL import Image, ImageOps
        Image.MAX_IMAGE_PIXELS = 40000000
        image = ImageOps.exif_transpose(Image.open(io.BytesIO(raw)))
        image.thumbnail((1600, 1600))
        image = image.convert("RGB")
        out = io.BytesIO()
        image.save(out, "JPEG", quality=88)
        result.update(mode="vision", mimeType="image/jpeg", image=base64.b64encode(out.getvalue()).decode())
    elif ext == ".pdf":
        from pypdf import PdfReader
        reader = PdfReader(io.BytesIO(raw))
        if reader.is_encrypted:
            raise ValueError("This PDF is password protected. Unlock it before attaching.")
        text = ""
        for page in reader.pages[:50]:
            text += (page.extract_text() or "") + "\n"
            if len(text) >= 40000:
                break
        result.update(mode="text", text=text[:40000])
    elif ext == ".docx":
        from docx import Document
        with zipfile.ZipFile(io.BytesIO(raw)) as z:
            if sum(x.file_size for x in z.infolist()) > 40*1024*1024:
                raise ValueError("This document expands beyond the processing limit.")
        document = Document(io.BytesIO(raw))
        text = "\n".join(p.text for p in document.paragraphs)
        text += "\n" + "\n".join("\t".join(c.text for c in row.cells) for table in document.tables for row in table.rows)
        result.update(mode="text", text=text[:40000])
    elif ext in {".txt",".md",".csv",".json",".js",".ts",".tsx",".jsx",".html",".css",".py",".yaml",".yml",".xml",".log",".sql",".sh",".ps1",".c",".cpp",".h",".java",".rs",".go"} or result["mimeType"].startswith("text/"):
        result.update(mode="text", text=raw.decode("utf-8", errors="replace")[:40000])
    return result
try:
    print(json.dumps(process(json.load(sys.stdin))))
except Exception as error:
    print(json.dumps({"error": str(error) if isinstance(error, ValueError) else "This file could not be processed. Try a plain text file."}))
    sys.exit(1)

