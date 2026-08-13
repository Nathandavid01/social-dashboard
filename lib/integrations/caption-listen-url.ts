import { GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { r2Bucket, r2Client, r2PublicUrl } from '@/lib/integrations/r2'
import {
  ENTREGAS_PROVIDER,
  entregasR2Bucket,
  entregasR2Client,
  entregasR2PublicUrl,
} from '@/lib/integrations/entregas-r2'
import {
  publicUrlForCaptionVideo,
  type CaptionSourceVideo,
} from '@/lib/utils/video-caption-source'

const PRESIGN_SECONDS = 15 * 60

/**
 * URL Whisper can GET. Edited pipeline files use the public worker;
 * raw / b-roll get a short presigned link so they stay private.
 */
export async function listenUrlForCaptionVideo(
  video: CaptionSourceVideo | null,
): Promise<string | null> {
  const pub = publicUrlForCaptionVideo(video, { r2: r2PublicUrl, entregas: entregasR2PublicUrl })
  if (pub) return pub
  const key = video?.drive_file_id?.replace(/^\//, '') ?? null
  if (!key) return null
  try {
    if (video?.storage_provider === ENTREGAS_PROVIDER) {
      const client = entregasR2Client()
      if (!client) return null
      return await getSignedUrl(
        client,
        new GetObjectCommand({
          Bucket: entregasR2Bucket(),
          Key: key,
          ResponseContentDisposition: 'inline',
        }),
        { expiresIn: PRESIGN_SECONDS },
      )
    }
    const client = r2Client()
    if (!client) return null
    return await getSignedUrl(
      client,
      new GetObjectCommand({
        Bucket: r2Bucket(),
        Key: key,
        ResponseContentDisposition: 'inline',
      }),
      { expiresIn: PRESIGN_SECONDS },
    )
  } catch {
    return null
  }
}
