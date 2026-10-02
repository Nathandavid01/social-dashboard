#!/usr/bin/env python3
"""Summarize materialized client sources without retaining signed URLs."""
import datetime
import json
from pathlib import Path

root = Path(__file__).resolve().parents[1]
inventory_path = root / 'runs/yabuuchi-library-drive-inventory.json'
inventory = json.loads(inventory_path.read_text())
canonical_ids = set(inventory['canonical_source_ids'])
sources = sorted((f for f in inventory['files'] if f['id'] in canonical_ids and '20260909' in f['name']), key=lambda f: f['name'])
records = []
for source in sources:
    state_path = root / 'runs/yabuuchi-library-download-status' / (source['id'] + '.json')
    record = json.loads(state_path.read_text())
    local = root / 'media/yabuuchi/source' / source['name']
    size_matches = local.exists() and local.stat().st_size == source['size']
    video_present = bool(record.get('codec') and record.get('width') and record.get('height') and record.get('duration', 0) > 0)
    record.update({'drive_url': source['url'], 'folder_path': source['folder_path'], 'local_path': str(local), 'storage_path': str(local.resolve()), 'is_symlink': local.is_symlink(), 'size_verified_now': size_matches, 'video_stream_present': video_present, 'usable_video_metadata': size_matches and video_present, 'full_decode_verified': False})
    if not video_present:
        record['media_warning'] = 'Empty container: no video stream and zero duration. Exclude from usable B-roll.'
    state_path.write_text(json.dumps(record, ensure_ascii=False, indent=2) + '\n')
    records.append(record)
record_by_name = {r['name']: r for r in records}
for source in inventory['files']:
    if source['role'] != 'source_video':
        continue
    local = root / 'media/yabuuchi/source' / source['name']
    if local.exists() and local.stat().st_size == source['size']:
        source['local_status'] = 'present_size_verified'
        source['local_matches'] = [{'path': str(local), 'storage_path': str(local.resolve()), 'is_symlink': local.is_symlink(), 'size': local.stat().st_size, 'size_matches': True}]
        if source['name'] in record_by_name:
            record = record_by_name[source['name']]
            source['local_sha256'] = record['sha256']
            source['duration'] = record['duration']
            source['video_stream_present'] = record['video_stream_present']
            source['broll_identification_status'] = 'pending_visual_review' if record['video_stream_present'] else 'empty_container_excluded'
canonical = [f for f in inventory['files'] if f['id'] in canonical_ids]
missing = [f for f in canonical if f['local_status'] != 'present_size_verified']
inventory['missing_source_ids'] = [f['id'] for f in missing if not f['size_warning']]
inventory['summary'].update({'existing_source_name_size_pairs': len(canonical) - len(missing), 'missing_source_name_size_pairs': len(missing), 'missing_normal_size_source_files': sum(not f['size_warning'] for f in missing), 'missing_normal_size_source_bytes': sum(f['size'] for f in missing if not f['size_warning']), 'downloaded_september09_sources': len(records), 'september09_sources_with_video_stream': sum(r['video_stream_present'] for r in records), 'september09_empty_container_sources': sum(not r['video_stream_present'] for r in records)})
inventory['coverage']['no_remote_writes_or_downloads'] = False
inventory['coverage']['remote_writes_performed'] = False
inventory['coverage']['authenticated_original_downloads_materialized'] = len(records)
inventory['local_comparison']['refreshed_after_download'] = True
inventory['local_comparison']['external_storage_root'] = '/Volumes/Extreme SSD/Nate Media/video-pipeline/media/yabuuchi/source'
inventory_path.write_text(json.dumps(inventory, ensure_ascii=False, indent=2) + '\n')
summary = {'client': 'Yabuuchi Sushi', 'checked_at': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'status': 'materialized_size_verified_metadata_checked', 'remote_changes': False, 'signed_urls_retained': False, 'total_files': len(records), 'total_bytes': sum(r['size'] for r in records), 'size_verified_files': sum(r['size_verified_now'] for r in records), 'files_with_video_stream': sum(r['video_stream_present'] for r in records), 'empty_container_files': sum(not r['video_stream_present'] for r in records), 'all_source_files_present': len(missing) == 0, 'verification_limits': 'Sizes match Drive metadata. SHA256 values fingerprint local original bytes; Drive did not expose checksums. ffprobe inspected container/streams; this download audit does not certify full decoding or editorial quality.', 'storage_note': 'New September 9 originals are stored on Extreme SSD and accessed through stable links under media/yabuuchi/source; mounted SSD is required.', 'files': records}
output = root / 'runs/yabuuchi-library-downloads.json'
output.write_text(json.dumps(summary, ensure_ascii=False, indent=2) + '\n')
print(json.dumps({k: v for k, v in summary.items() if k != 'files'}, ensure_ascii=False, indent=2))
