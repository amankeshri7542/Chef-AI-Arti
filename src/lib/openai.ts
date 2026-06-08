import OpenAI from 'openai';

export const VISION_MODEL    = process.env.OPENAI_VISION_MODEL    ?? 'gpt-4o-mini';
export const CHAT_MODEL      = process.env.OPENAI_CHAT_MODEL      ?? 'gpt-4o';
export const SUMMARY_MODEL   = process.env.OPENAI_SUMMARY_MODEL   ?? 'gpt-4o-mini';
export const EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL ?? 'text-embedding-3-small';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export type OAIMessage = OpenAI.Chat.ChatCompletionMessageParam;

export async function getEmbedding(text: string): Promise<number[]> {
  const res = await openai.embeddings.create({ model: EMBEDDING_MODEL, input: text });
  return res.data[0].embedding;
}

export async function validateImage(
  imageBase64: string,
): Promise<{ valid: boolean; reason: string }> {
  try {
    const res = await openai.chat.completions.create({
      model: VISION_MODEL,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: `data:image/jpeg;base64,${imageBase64}` },
            },
            {
              type: 'text',
              text: 'Is this a photo of a refrigerator, kitchen, or food ingredients? Reply ONLY with JSON: {"valid": boolean, "reason": string}',
            },
          ],
        },
      ],
      max_tokens: 100,
    });
    const content = res.choices[0].message.content ?? '';
    return JSON.parse(content.trim()) as { valid: boolean; reason: string };
  } catch (err) {
    console.error('[openai] validateImage error:', {
      model: VISION_MODEL,
      error: err instanceof Error ? err.message : String(err),
      hasApiKey: !!process.env.OPENAI_API_KEY,
    })
    return { valid: false, reason: 'parse_error' }
  }
}

export async function extractIngredients(
  imageBase64: string,
): Promise<Array<{ name: string; confidence: number }>> {
  try {
    const res = await openai.chat.completions.create({
      model: VISION_MODEL,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: `data:image/jpeg;base64,${imageBase64}` },
            },
            {
              type: 'text',
              text: 'List every food ingredient visible in this image. Reply ONLY with JSON array: [{"name": string, "confidence": 0.0-1.0}] Use common Indian ingredient names in Hinglish (e.g. "Aloo" not "Potato"). If image is unclear, return empty array [].',
            },
          ],
        },
      ],
      max_tokens: 500,
    });
    const content = res.choices[0].message.content ?? '[]';
    return JSON.parse(content.trim()) as Array<{ name: string; confidence: number }>;
  } catch (err) {
    console.error('[openai] extractIngredients error:', {
      model: VISION_MODEL,
      error: err instanceof Error ? err.message : String(err),
      hasApiKey: !!process.env.OPENAI_API_KEY,
    })
    return []
  }
}

export async function chatCompletion(
  messages: OpenAI.Chat.ChatCompletionMessageParam[],
  model?: string,
): Promise<string> {
  const res = await openai.chat.completions.create({
    model: model ?? CHAT_MODEL,
    messages,
  });
  const content = res.choices[0].message.content;
  if (content === null) throw new Error('OpenAI returned null content');
  return content;
}
