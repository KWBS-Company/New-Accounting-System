import { OllamaEmbeddings } from "@langchain/ollama";
import { Document } from "@langchain/core/documents";
import { createHash } from "node:crypto";
import pg from "pg";
import { loadFile, loadFileFromPath, type LoadedChunk } from "./document_loader.js";

/**
 * A small Retrieval-Augmented Generation (RAG) pipeline built with LangChain
 * primitives whose embeddings are **persisted in Postgres**:
 *   - `OllamaEmbeddings` turns text into vectors.
 *   - `Document` is LangChain's standard document container.
 *   - A Postgres table (`rag_embeddings`) stores each chunk together with its
 *     embedding, so the embeddings survive server restarts and are only
 *     (re)computed when the knowledge base or embedding model changes.
 *   - Retrieval loads the rows into memory once and runs cosine similarity.
 *
 * The embedding is stored as JSONB (an array of floats) so the pipeline works
 * with any vanilla Postgres instance without requiring the `pgvector` extension.
 */

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
const EMBEDDING_MODEL = process.env.OLLAMA_EMBEDDING_MODEL ?? "nomic-embed-text";

// Postgres connection settings. These mirror the environment variables used by
// the Python backend so the same database can be reused.
const DB_HOST = process.env.DB_HOST ?? "localhost";
const DB_PORT = Number(process.env.DB_PORT ?? 5432);
const DB_USERNAME = process.env.DB_USERNAME ?? "admin";
const DB_PASSWORD = process.env.DB_PASSWORD ?? "admin";
const DB_DATABASE = process.env.DB_DATABASE ?? "accounting_db_new";

// Name of the table that stores the embeddings.
const EMBEDDINGS_TABLE = process.env.RAG_EMBEDDINGS_TABLE ?? "rag_embeddings";

// Accounting knowledge base. In a real deployment these would be loaded from
// files / a database, but keeping them inline makes the pipeline self-contained.
const KNOWLEDGE_BASE: string[] = [
  "Assets are resources owned by a business that have economic value, such as cash, accounts receivable, inventory, equipment and property. Assets increase with debits and decrease with credits.",
  "Liabilities are obligations a business owes to others, such as accounts payable, loans and accrued expenses. Liabilities increase with credits and decrease with debits.",
  "Equity represents the owner's residual interest in the business after liabilities are deducted from assets. Equity increases with credits and decreases with debits.",
  "Revenue is income earned from normal business operations, such as sales of goods or services. Revenue accounts increase with credits.",
  "Expenses are the costs incurred to generate revenue, such as rent, salaries and utilities. Expense accounts increase with debits.",
  "The accounting equation states that Assets = Liabilities + Equity. Every transaction keeps this equation balanced.",
  "Double-entry bookkeeping requires that every transaction has at least one debit and one credit, and the total debits must equal the total credits.",
  "A journal entry records a business transaction with a date, the accounts affected, and the debit and credit amounts. The total debits must equal the total credits.",
  "A ledger is a collection of accounts where journal entries are posted. The account balance is the difference between total debits and total credits for that account.",
  "A trial balance lists all account balances to verify that total debits equal total credits before preparing financial statements.",
  "The balance sheet reports a company's assets, liabilities and equity at a specific point in time.",
  "The income statement (profit and loss statement) reports revenue and expenses over a period of time to show net profit or loss.",
  "The debit and credit rules: debit means the left side of an account, credit means the right side. Asset and expense accounts have a normal debit balance; liability, equity and revenue accounts have a normal credit balance.",
  "Accounts receivable is money owed to a business by its customers, and is recorded as an asset.",
  "Accounts payable is money a business owes to its suppliers, and is recorded as a liability.",
];

interface IndexedDocument {
  document: Document;
  embedding: number[];
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) {
    return 0;
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// A stable hash of a chunk's text, used to detect whether a chunk (and its
// embedding for a given model) already exists in the database.
function hashContent(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

export class RagPipeline {
  private embeddings: OllamaEmbeddings;
  private index: IndexedDocument[] = [];
  private ready: Promise<void> | null = null;
  private pool: pg.Pool;

  constructor() {
    this.embeddings = new OllamaEmbeddings({
      model: EMBEDDING_MODEL,
      baseUrl: OLLAMA_BASE_URL,
    });

    this.pool = new pg.Pool({
      host: DB_HOST,
      port: DB_PORT,
      user: DB_USERNAME,
      password: DB_PASSWORD,
      database: DB_DATABASE,
    });
  }

  /**
   * Ensures the embeddings table exists, seeds it (embedding only the missing
   * chunks), and loads all rows into the in-memory index. Runs once and is
   * cached.
   */
  async init(): Promise<void> {
    if (!this.ready) {
      this.ready = this.build();
    }
    return this.ready;
  }

  private async ensureTable(): Promise<void> {
    await this.pool.query(
      `CREATE TABLE IF NOT EXISTS ${EMBEDDINGS_TABLE} (
        id           SERIAL PRIMARY KEY,
        content_hash TEXT NOT NULL,
        model        TEXT NOT NULL,
        content      TEXT NOT NULL,
        source       TEXT,
        embedding    JSONB NOT NULL,
        created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (content_hash, model)
      )`,
    );
  }

  private async build(): Promise<void> {
    await this.ensureTable();

    // Figure out which knowledge-base chunks are not yet embedded (for the
    // current embedding model) and only embed/insert those.
    const existing = await this.pool.query(
      `SELECT content_hash FROM ${EMBEDDINGS_TABLE} WHERE model = $1`,
      [EMBEDDING_MODEL],
    );
    const existingHashes = new Set<string>(
      existing.rows.map((r: { content_hash: string }) => r.content_hash),
    );

    const missing = KNOWLEDGE_BASE.filter(
      (text) => !existingHashes.has(hashContent(text)),
    );

    if (missing.length > 0) {
      const vectors = await this.embeddings.embedDocuments(missing);

      for (let i = 0; i < missing.length; i++) {
        const text = missing[i];
        await this.pool.query(
          `INSERT INTO ${EMBEDDINGS_TABLE}
             (content_hash, model, content, source, embedding)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (content_hash, model) DO NOTHING`,
          [
            hashContent(text),
            EMBEDDING_MODEL,
            text,
            "accounting-kb",
            JSON.stringify(vectors[i]),
          ],
        );
      }
    }

    // Load every stored embedding for this model into the in-memory index.
    const rows = await this.pool.query(
      `SELECT content, source, embedding FROM ${EMBEDDINGS_TABLE} WHERE model = $1`,
      [EMBEDDING_MODEL],
    );

    this.index = rows.rows.map(
      (row: { content: string; source: string | null; embedding: unknown }) => ({
        document: new Document({
          pageContent: row.content,
          metadata: { source: row.source ?? "accounting-kb" },
        }),
        embedding:
          typeof row.embedding === "string"
            ? JSON.parse(row.embedding)
            : (row.embedding as number[]),
      }),
    );
  }

  /**
   * Embeds and persists a set of chunks (only the ones not already stored for
   * the current model) and adds them to the in-memory index. Returns the number
   * of newly embedded chunks.
   */
  private async ingestChunks(chunks: LoadedChunk[]): Promise<number> {
    await this.init();
    await this.ensureTable();

    if (chunks.length === 0) {
      return 0;
    }

    // Deduplicate against what is already stored for this model.
    const existing = await this.pool.query(
      `SELECT content_hash FROM ${EMBEDDINGS_TABLE} WHERE model = $1`,
      [EMBEDDING_MODEL],
    );
    const existingHashes = new Set<string>(
      existing.rows.map((r: { content_hash: string }) => r.content_hash),
    );

    // Deduplicate within the incoming batch as well.
    const seen = new Set<string>();
    const missing = chunks.filter((c) => {
      const h = hashContent(c.content);
      if (existingHashes.has(h) || seen.has(h)) {
        return false;
      }
      seen.add(h);
      return true;
    });

    if (missing.length === 0) {
      return 0;
    }

    const vectors = await this.embeddings.embedDocuments(
      missing.map((c) => c.content),
    );

    for (let i = 0; i < missing.length; i++) {
      const chunk = missing[i];
      await this.pool.query(
        `INSERT INTO ${EMBEDDINGS_TABLE}
           (content_hash, model, content, source, embedding)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (content_hash, model) DO NOTHING`,
        [
          hashContent(chunk.content),
          EMBEDDING_MODEL,
          chunk.content,
          chunk.source,
          JSON.stringify(vectors[i]),
        ],
      );

      this.index.push({
        document: new Document({
          pageContent: chunk.content,
          metadata: { source: chunk.source },
        }),
        embedding: vectors[i],
      });
    }

    return missing.length;
  }

  /**
   * Ingests a file (PDF, DOCX, XLSX/XLS/CSV, or TXT/MD) provided as bytes,
   * extracting and embedding its text so it becomes retrievable.
   */
  async ingestFile(buffer: Buffer, fileName: string): Promise<number> {
    const chunks = await loadFile(buffer, fileName);
    return this.ingestChunks(chunks);
  }

  /**
   * Ingests a file from a filesystem path.
   */
  async ingestFileFromPath(path: string): Promise<number> {
    const chunks = await loadFileFromPath(path);
    return this.ingestChunks(chunks);
  }

  /**
   * Returns the `k` most relevant documents for the given query.
   */
  async retrieve(query: string, k = 3): Promise<Document[]> {
    await this.init();

    if (this.index.length === 0) {
      return [];
    }

    const queryEmbedding = await this.embeddings.embedQuery(query);

    return this.index
      .map((item) => ({
        document: item.document,
        score: cosineSimilarity(queryEmbedding, item.embedding),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, k)
      .map((item) => item.document);
  }

  /**
   * Retrieves relevant knowledge and formats it as a context string that can be
   * injected into the LLM's system prompt.
   */
  async getContext(query: string, k = 3): Promise<string> {
    try {
      const docs = await this.retrieve(query, k);
      if (docs.length === 0) {
        return "";
      }
      return docs.map((d, i) => `[${i + 1}] ${d.pageContent}`).join("\n");
    } catch (err) {
      // RAG is an enhancement; if embeddings or the database fail, fall back to
      // no context instead of breaking the chat.
      console.error("RAG retrieval failed:", err);
      return "";
    }
  }
}

// Shared singleton so the knowledge base is embedded only once.
export const ragPipeline = new RagPipeline();
