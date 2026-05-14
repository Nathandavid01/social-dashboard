import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export async function POST(req: NextRequest) {
  try {
    const {
      videoTitle,
      platform,
      clientName,
      existingCaptions,
      brandVoice,
      captionLanguage,
      defaultCta,
      defaultHashtags,
      captionNotes,
    } = await req.json()

    if (!videoTitle) {
      return NextResponse.json({ error: 'Video title is required' }, { status: 400 })
    }

    const examplesBlock =
      existingCaptions && existingCaptions.length > 0
        ? `Here are real captions previously written for this client. Study the tone, structure, language, hashtag style, and format:\n\n${existingCaptions
            .slice(0, 8)
            .map((c: { text: string; provider: string }, i: number) => `Example ${i + 1} (${c.provider}):\n${c.text}`)
            .join('\n\n---\n\n')}`
        : 'No previous captions available. Write in a professional, engaging social media tone.'

    const clientProfile = [
      brandVoice && `Brand voice: ${brandVoice}`,
      captionLanguage && `Language: ${captionLanguage}`,
      defaultCta && `Default CTA to use: ${defaultCta}`,
      defaultHashtags && `Default hashtags to include: ${defaultHashtags}`,
      captionNotes && `Special rules: ${captionNotes}`,
    ]
      .filter(Boolean)
      .join('\n')

    const prompt = `You are a social media copywriter for a Puerto Rican agency. Your job is to write a caption for a social media post.

${clientProfile ? `CLIENT PROFILE:\n${clientProfile}\n\n---\n\n` : ''}${examplesBlock}

---

Now write a NEW caption for the following:
- Client: ${clientName || 'the client'}
- Platform: ${platform || 'Instagram'}
- Video/Post topic: ${videoTitle}

Requirements:
- Follow the client profile rules above exactly
- Match the tone and structure from the examples
- Include a hook, body, call to action, and relevant hashtags
- Format it exactly like the examples (line breaks, spacing, emoji usage)
- Do NOT add any explanation, just output the caption text itself`

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    })

    const caption = message.content[0].type === 'text' ? message.content[0].text : ''

    return NextResponse.json({ caption })
  } catch (error) {
    console.error('Caption generation error:', error)
    return NextResponse.json({ error: 'Failed to generate caption' }, { status: 500 })
  }
}
