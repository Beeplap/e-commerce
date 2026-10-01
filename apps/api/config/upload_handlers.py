from typing import Any

from django.core.files.uploadhandler import FileUploadHandler, StopUpload


class BoundedUploadHandler(FileUploadHandler):
    """Reject bytes before Django can spool an unbounded file to temporary disk."""

    chunk_size = 64 * 1024

    def receive_data_chunk(self, raw_data: bytes, start: int) -> bytes:
        if start + len(raw_data) > 5 * 1024 * 1024:
            raise StopUpload(connection_reset=False)
        return raw_data

    def file_complete(self, file_size: int) -> Any:
        return None
