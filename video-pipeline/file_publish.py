"""Publish a completed file without replacing existing user work."""
import errno
import os
from pathlib import Path
import shutil


def publish_file(source, destination):
    try:
        os.link(source, destination)
    except OSError as exc:
        if exc.errno not in (errno.ENOTSUP, errno.EOPNOTSUPP, errno.EXDEV):
            raise
        # exFAT external disks do not support hard links. Exclusive creation
        # preserves the no-overwrite guarantee; callers hold their render lock.
        with open(destination, 'xb') as target:
            try:
                with open(source, 'rb') as origin:
                    shutil.copyfileobj(origin, target, 1024 * 1024)
                target.flush()
                os.fsync(target.fileno())
            except BaseException:
                Path(destination).unlink()
                raise
