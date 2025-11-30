import sqlite3
import os
import json
import argparse
import numpy as np

# Try to import sentence_transformers
try:
    from sentence_transformers import SentenceTransformer, util
    HAS_SENTENCE_TRANSFORMERS = True
except ImportError:
    HAS_SENTENCE_TRANSFORMERS = False

def load_config(config_path):
    if os.path.exists(config_path):
        with open(config_path, 'r') as f:
            return json.load(f)
    return {}

def query_semantic(args):
    config = load_config(args.config)
    
    if not config.get('enableEmbeddings', False):
        print(json.dumps({
            "success": False, 
            "error": "Embeddings not enabled. Use 'Configure Reasoning Logger' command to enable semantic search."
        }))
        return

    if not HAS_SENTENCE_TRANSFORMERS:
        print(json.dumps({"success": False, "error": "sentence-transformers not installed"}))
        return

    db_path = config.get('dbPath', 'reasoning_logs.db')
    embedder_model = config.get('embedderModel', 'all-MiniLM-L6-v2')
    
    try:
        model = SentenceTransformer(embedder_model)
        query_embedding = model.encode(args.query)
        
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        
        # Fetch all embeddings
        # In a real production system, use FAISS or a vector DB extension.
        # For <10k items, brute force is fine.
        cursor.execute('''
        SELECT id, file, reasoning, repair_ref, timestamp, diff, embedding
        FROM reasoning
        WHERE embedding IS NOT NULL
        ''')
        
        rows = cursor.fetchall()
        
        results = []
        corpus_embeddings = []
        row_map = []
        
        for row in rows:
            if row['embedding']:
                corpus_embeddings.append(np.frombuffer(row['embedding'], dtype=np.float32))
                row_map.append(row)
        
        if not corpus_embeddings:
            print(json.dumps({"success": True, "results": []}))
            return

        # Compute cosine similarity
        # util.cos_sim returns a tensor, convert to numpy
        scores = util.cos_sim(query_embedding, corpus_embeddings)[0].cpu().numpy()
        
        # Sort by score desc
        top_k = min(args.limit, len(scores))
        top_results_indices = np.argsort(scores)[::-1][:top_k]
        
        for idx in top_results_indices:
            row = row_map[idx]
            score = float(scores[idx])
            results.append({
                "id": row['id'],
                "file": row['file'],
                "reasoning": row['reasoning'],
                "repair_ref": json.loads(row['repair_ref']) if row['repair_ref'] else [],
                "timestamp": row['timestamp'],
                "diff": row['diff'],
                "score": score
            })
            
        print(json.dumps({"success": True, "results": results}))
        
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))
    finally:
        if 'conn' in locals():
            conn.close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument('--query', required=True)
    parser.add_argument('--limit', type=int, default=50)
    parser.add_argument('--config', default='reasoning-logger.json')
    
    args = parser.parse_args()
    query_semantic(args)
