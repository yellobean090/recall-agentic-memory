/**
 * Generates a 1536-dim embedding for text.
 *
 * NOTE: Anthropic doesn't serve an embeddings endpoint. Two options,
 * pick one before day 3:
 *   1) Amazon Bedrock's Titan Text Embeddings model (amazon.titan-embed-text-v2:0)
 *      — keeps everything in the AWS story, called from the Lambda in
 *      src/lambda/embed.ts on every new incident write.
 *   2) OpenAI text-embedding-3-small — faster to wire up if Bedrock
 *      model access approval is slow to come through.
 *
 * Stubbed here so the rest of the app (schema, tools, server) can be
 * built and tested against a fake deterministic vector before the
 * real embedding call is wired in.
 */
export async function embed(text: string): Promise<number[]> {
  if (process.env.EMBEDDING_PROVIDER === "bedrock") {
    return embedWithBedrock(text);
  }
  if (process.env.EMBEDDING_PROVIDER === "openai") {
    return embedWithOpenAI(text);
  }
  // Fake deterministic embedding for local dev before a real provider
  // is wired up — DO NOT use this for the actual demo/recorded video.
  console.warn("[embeddings] Using fake stub embedding — set EMBEDDING_PROVIDER before demo day");
  return fakeEmbedding(text);
}

async function embedWithBedrock(text: string): Promise<number[]> {
  const { BedrockRuntimeClient, InvokeModelCommand } = await import("@aws-sdk/client-bedrock-runtime");
  const client = new BedrockRuntimeClient({ region: process.env.AWS_REGION ?? "us-east-1" });
  const command = new InvokeModelCommand({
    modelId: "amazon.titan-embed-text-v2:0",
    contentType: "application/json",
    accept: "application/json",
    body: JSON.stringify({ inputText: text }),
  });
  const response = await client.send(command);
  const payload = JSON.parse(new TextDecoder().decode(response.body));
  return payload.embedding;
}

async function embedWithOpenAI(text: string): Promise<number[]> {
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({ model: "text-embedding-3-small", input: text }),
  });
  const data = await res.json();
  return data.data[0].embedding;
}

function fakeEmbedding(text: string): number[] {
  const vec = new Array(1536).fill(0);
  for (let i = 0; i < text.length; i++) {
    vec[i % 1536] += text.charCodeAt(i) / 1000;
  }
  return vec;
}
