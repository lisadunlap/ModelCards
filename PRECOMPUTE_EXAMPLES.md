# Precomputing Example Embeddings

This script allows you to precompute embeddings for example search queries, so users can try semantic search without needing their own OpenAI API key.

## Setup

1. **Set your OpenAI API key** (you only need to do this once to generate the examples):
   ```bash
   export OPENAI_API_KEY="your-api-key-here"
   ```

2. **Run the precomputation script**:
   ```bash
   npm run precompute-examples
   ```

## What it does

The script will:
- ✅ Embed the following example queries using OpenAI's `text-embedding-3-small` model:
  - `"incorrect reasoning"` - Find properties related to logical errors or flawed reasoning
  - `"friendly tone"` - Find properties related to conversational style and friendliness  
  - `"refusal to answer"` - Find properties related to models declining to respond

- ✅ Normalize all embeddings to unit vectors (for consistent similarity calculations)
- ✅ Save the results to `src/data/precomputed-examples.json`

## Output

The script creates a JSON file with this structure:
```json
{
  "generated_at": "2024-01-15T10:30:00.000Z",
  "model_used": "text-embedding-3-small", 
  "total_examples": 3,
  "examples": [
    {
      "id": "incorrect-reasoning",
      "query": "incorrect reasoning",
      "description": "Find properties related to logical errors or flawed reasoning",
      "embedding": [0.123, -0.456, 0.789, ...],
      "metadata": {
        "model": "text-embedding-3-small",
        "dimensions": 1536,
        "computed_at": "2024-01-15T10:30:00.000Z"
      }
    }
    // ... more examples
  ]
}
```

## Adding More Examples

To add more example queries, edit the `EXAMPLE_QUERIES` array in `scripts/precompute-examples.js`:

```javascript
const EXAMPLE_QUERIES = [
  // ... existing examples
  {
    id: 'new-example',
    query: 'your search query here',
    description: 'Description of what this query finds'
  }
];
```

Then run the script again to regenerate the embeddings file.

## Usage in the App

Once generated, these precomputed examples will be automatically available in the semantic search interface, allowing users to try semantic search even without an OpenAI API key. 