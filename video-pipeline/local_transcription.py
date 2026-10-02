"""Reusable local Whisper inference. No hosted inference or automatic model upgrades."""
import hashlib
import errno
import json
import os
from pathlib import Path
import tempfile
from importlib.metadata import version

from audiokit import digest

ROOT = Path(__file__).resolve().parent
CACHE = ROOT / 'runs' / '.transcription-cache'
_MODELS = {}


def _publish(path, data):
    """Publish complete JSON without replacing a file another process created."""
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(dir=path.parent, suffix='.tmp')
    try:
        with os.fdopen(fd, 'w') as handle:
            json.dump(data, handle, ensure_ascii=False, indent=2, allow_nan=False)
        try:
            os.link(temporary, path)
        except OSError as exc:
            if exc.errno not in (errno.ENOTSUP, errno.EOPNOTSUPP, errno.EXDEV):
                raise
            # External exFAT volumes do not support hard links. Exclusive create
            # still preserves existing transcripts; remove only our partial file.
            with path.open('x') as target:
                try:
                    target.write(Path(temporary).read_text())
                    target.flush()
                    os.fsync(target.fileno())
                except BaseException:
                    path.unlink()
                    raise
    finally:
        os.unlink(temporary)


def transcribe(source, output, model_name, initial_prompt=None):
    source, output = Path(source).resolve(), Path(output).resolve()
    request = {'schema': 1, 'source_sha256': digest(source), 'model': model_name,
               'engine': 'openai-whisper', 'engine_version': version('openai-whisper'),
               'language': 'es', 'word_timestamps': True, 'fp16': False,
               'initial_prompt': initial_prompt, 'device': 'cpu'}
    if output.exists():
        existing = json.loads(output.read_text())
        if existing.get('_local_transcription') == request:
            print(f'Transcripción existente conservada: {output}')
            return existing
        raise ValueError('Ya existe una transcripción sin procedencia coincidente; '
                         'conservarla y usar otro nombre si hace falta una nueva.')
    key = hashlib.sha256(json.dumps(request, sort_keys=True).encode()).hexdigest()
    CACHE.mkdir(parents=True, exist_ok=True)
    # OS lock is released even if the process exits unexpectedly. All calls through
    # this helper share one inference slot; a second job fails before loading a model.
    import fcntl
    with (CACHE / '.inference.lock').open('a') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise RuntimeError('Hay otra transcripción local en curso; repetir al terminar.')
        cached = CACHE / (key + '.json')
        if cached.exists():
            result = json.loads(cached.read_text())
            if (result.get('_local_transcription') != request or
                    not isinstance(result.get('segments'), list) or
                    not isinstance(result.get('text'), str)):
                raise ValueError(f'Caché inválida; revisar {cached}')
            print('Reutilizando transcripción local; sin nueva inferencia.')
        else:
            import torch
            import whisper
            torch.set_num_threads(4)
            if model_name not in _MODELS:
                # Keep only the active model resident when a batch changes models.
                _MODELS.clear()
                _MODELS[model_name] = whisper.load_model(model_name, device='cpu')
            result = _MODELS[model_name].transcribe(
                str(source), language='es', word_timestamps=True, fp16=False,
                initial_prompt=initial_prompt)
            if digest(source) != request['source_sha256']:
                raise ValueError('El original cambió durante la transcripción; resultado descartado.')
            result = {**result, '_local_transcription': request}
            _publish(cached, result)
        _publish(output, result)
    print(result['text'])
    return result
