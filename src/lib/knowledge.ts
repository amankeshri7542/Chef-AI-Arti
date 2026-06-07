/*
=== RUN THIS IN SUPABASE SQL EDITOR (match_knowledge_docs) ===

CREATE OR REPLACE FUNCTION match_knowledge_docs(
  query_embedding   vector(1536),
  applies_to_filter text[] DEFAULT '{}',
  match_count       int    DEFAULT 5
)
RETURNS TABLE (
  id                  text,
  type                text,
  intent              text,
  problem             text,
  applies_to          text[],
  ingredient_required text,
  topic               text,
  tags                text[],
  content             text,
  preference_order    int,
  similarity          float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    k.id,
    k.type,
    k.intent,
    k.problem,
    k.applies_to,
    k.ingredient_required,
    k.topic,
    k.tags,
    k.content,
    k.preference_order,
    1 - (k.embedding <=> query_embedding) AS similarity
  FROM knowledge_docs k
  WHERE
    (
      array_length(applies_to_filter, 1) IS NULL
      OR k.applies_to && applies_to_filter
      OR k.applies_to @> ARRAY['general']
    )
  ORDER BY
    k.preference_order ASC,
    k.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
*/

import { createServerClient } from '@/lib/supabase';
import { getEmbedding } from '@/lib/openai';
import type { KnowledgeDoc, KnowledgeDocType } from '@/types/index';

type RpcKnowledgeRow = {
  id: string;
  type: KnowledgeDocType;
  intent: string;
  problem: string | null;
  applies_to: string[];
  ingredient_required: string | null;
  topic: string;
  tags: string[];
  content: string;
  preference_order: number;
  similarity: number;
};

function rowToKnowledgeDoc(row: RpcKnowledgeRow): KnowledgeDoc {
  return {
    id: row.id,
    type: row.type,
    intent: row.intent,
    problem: row.problem,
    applies_to: row.applies_to,
    ingredient_required: row.ingredient_required,
    topic: row.topic,
    tags: row.tags,
    content: row.content,
    preference_order: row.preference_order,
    embedding_text: null,  // not fetched from RPC
    embedding: null,
    created_at: '',        // not fetched from RPC — not needed in chat context
  };
}

/**
 * Kitchen knowledge retrieval pipeline.
 * Separate domain from recipes — results are NEVER merged with recipe results.
 * Returns at most 3 atomic chunks, sorted by preference_order then similarity.
 */
export async function searchKnowledge(
  query: string,
  context: {
    currentRecipe?: string;
    appliesTo?: string[];
  } = {},
): Promise<KnowledgeDoc[]> {
  // STEP 1 — guard
  if (query.trim().length === 0) return [];

  const supabase = createServerClient();

  // STEP 2 — embed
  const vector = await getEmbedding(query);

  // STEP 3 — RPC: SQL pre-filter (applies_to) + vector search
  const { data: rpcRows, error } = await supabase.rpc('match_knowledge_docs', {
    query_embedding: vector,
    applies_to_filter: context.appliesTo ?? [],
    match_count: 5,
  });

  if (error) throw new Error(`match_knowledge_docs RPC failed: ${error.message}`);

  const rows = (rpcRows ?? []) as RpcKnowledgeRow[];

  // STEP 4 — preference_order (primary) then similarity (secondary) — SQL already sorted
  // Trim to top 3 — never return more than 3 knowledge chunks
  return rows.slice(0, 3).map(rowToKnowledgeDoc);
}

/**
 * Returns true if any retrieved doc has a 'safety' tag.
 * The calling API route uses this to append a safety disclaimer to the chatbot response.
 * Note: based on tags (not a DB column) — add tag 'safety' to any chunk that warrants it.
 */
export function hasSafetyFlag(docs: KnowledgeDoc[]): boolean {
  return docs.some((d) => d.tags.includes('safety'));
}
