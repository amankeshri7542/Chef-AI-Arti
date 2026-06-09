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
              image_url: { url: `data:image/jpeg;base64,${imageBase64}`, detail: 'low' },
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
      imageSize: imageBase64?.length,
    });
    return { valid: false, reason: 'openai_error' };
  }
}

/**
 * Validate that an uploaded photo is actually cooked food / a dish.
 * Used by community photo uploads to prevent non-food images (products, screenshots, etc).
 * Separate from validateImage() which checks for fridge/kitchen/ingredients.
 */
export async function validateFoodPhoto(
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
              image_url: { url: `data:image/jpeg;base64,${imageBase64}`, detail: 'low' },
            },
            {
              type: 'text',
              text: 'Is this a photo of a cooked food dish or meal? It should be actual home-cooked food, not a product package, screenshot, or non-food item. Reply ONLY with JSON: {"valid": boolean, "reason": string}',
            },
          ],
        },
      ],
      max_tokens: 100,
    });
    const content = res.choices[0].message.content ?? '';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    return jsonMatch
      ? (JSON.parse(jsonMatch[0]) as { valid: boolean; reason: string })
      : { valid: false, reason: 'parse_error' };
  } catch (err) {
    console.error('[openai] validateFoodPhoto error:', {
      model: VISION_MODEL,
      error: err instanceof Error ? err.message : String(err),
    });
    // On error, allow upload (don't block user for API hiccups)
    return { valid: true, reason: 'validation_skipped' };
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
              image_url: { url: `data:image/jpeg;base64,${imageBase64}`, detail: 'low' },
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
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    const arr = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
    return arr as Array<{ name: string; confidence: number }>;
  } catch (err) {
    console.error('[openai] extractIngredients error:', {
      model: VISION_MODEL,
      error: err instanceof Error ? err.message : String(err),
      hasApiKey: !!process.env.OPENAI_API_KEY,
    });
    return [];
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
