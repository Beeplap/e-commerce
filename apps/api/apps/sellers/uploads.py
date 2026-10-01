import hashlib
import warnings
from dataclasses import dataclass
from io import BytesIO
from pathlib import PurePath
from typing import Any

from django.core.files.uploadedfile import UploadedFile
from PIL import Image, UnidentifiedImageError
from rest_framework.exceptions import ValidationError

MAX_DOCUMENT_BYTES = 5 * 1024 * 1024
MAX_DOCUMENT_PIXELS = 12_000_000


@dataclass(frozen=True)
class ValidatedDocument:
    content: bytes
    content_type: str
    extension: str
    sha256: str


def validate_document(upload: UploadedFile[Any]) -> ValidatedDocument:
    allowed = {
        "image/png": ({".png"}, "PNG", "png"),
        "image/jpeg": ({".jpg", ".jpeg"}, "JPEG", "jpg"),
    }
    rule = allowed.get(upload.content_type or "")
    if (
        rule is None
        or PurePath(upload.name or "").suffix.lower() not in rule[0]
        or not upload.size
        or upload.size > MAX_DOCUMENT_BYTES
    ):
        raise ValidationError({"file": "Upload a JPEG or PNG scan up to 5 MiB."})
    source = upload.read(MAX_DOCUMENT_BYTES + 1)
    if len(source) > MAX_DOCUMENT_BYTES:
        raise ValidationError({"file": "The file exceeds 5 MiB."})
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(BytesIO(source)) as probe:
                if (
                    probe.format != rule[1]
                    or probe.width * probe.height > MAX_DOCUMENT_PIXELS
                    or getattr(probe, "n_frames", 1) != 1
                ):
                    raise ValueError("Unsupported image.")
                probe.verify()
            with Image.open(BytesIO(source)) as decoded:
                decoded.load()
                # A fresh pixel-only image removes metadata and appended payloads.
                clean = Image.new("RGB", decoded.size)
                clean.paste(decoded.convert("RGB"))
                output = BytesIO()
                clean.save(output, format=rule[1])
                content = output.getvalue()
    except (
        UnidentifiedImageError,
        OSError,
        ValueError,
        Image.DecompressionBombError,
        Image.DecompressionBombWarning,
    ) as error:
        raise ValidationError(
            {"file": "Upload a valid, single-page JPEG or PNG up to 12 megapixels."}
        ) from error
    if len(content) > MAX_DOCUMENT_BYTES:
        raise ValidationError({"file": "The decoded document exceeds 5 MiB."})
    return ValidatedDocument(
        content, upload.content_type or "", rule[2], hashlib.sha256(content).hexdigest()
    )
