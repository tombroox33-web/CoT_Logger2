import sqlite3
import os
import json
import argparse
import time
import sys

# Try to import sentence_transformers, but don't fail yet if missing (unless embeddings enabled)
try:
    from sentence_transformers import SentenceTransformer
    HAS_SENTENCE_TRANSFORMERS = True
except ImportError:
    HAS_SENTENCE_TRANSFORMERS = False

def load_config(config_path):
    if os.path.exists(config_path):
        with open(config_path, 'r') as f:
            return json.load(f)
    return {}

def save_reasoning(args):
    config = load_config(args.config)
    db_path = config.get('dbPath', 'reasoning_logs.db')
    enable_embeddings = config.get('enableEmbeddings', False)
    embedder_model = config.get('embedderModel', 'all-MiniLM-L6-v2')
    
    # Resolve db_path relative to config file directory
    config_dir = os.path.dirname(os.path.abspath(args.config))
    if not os.path.isabs(db_path):
        db_path = os.path.join(config_dir, db_path)

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    embedding_blob = None
    
    if enable_embeddings:
        if not HAS_SENTENCE_TRANSFORMERS:
            print(json.dumps({"success": False, "error": "sentence-transformers not installed but embeddings enabled"}))
            return

        try:
            model = SentenceTransformer(embedder_model)
            embedding = model.encode(args.reasoning)
            embedding_blob = embedding.tobytes()
        except Exception as e:
            print(json.dumps({"success": False, "error": f"Embedding failed: {str(e)}"}))
            return

    try:
        cursor.execute('''
        INSERT INTO reasoning (file, diff, reasoning, timestamp, repair_ref, embedding, embedder_name)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (
            args.file,
            args.diff,
            args.reasoning,
            time.time(),
            args.repair_ref, # Already a JSON string
            embedding_blob,
            embedder_model if enable_embeddings else None
        ))
        
        entry_id = cursor.lastrowid
        conn.commit()
        print(json.dumps({"success": True, "id": entry_id}))
        
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))
    finally:
        conn.close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument('--file', required=True)
    parser.add_argument('--diff', required=True)
    parser.add_argument('--reasoning', required=True)
    parser.add_argument('--repair-ref', required=True, help="JSON array string")
    parser.add_argument('--config', default='reasoning-logger.json')
    
    args = parser.parse_args()
    save_reasoning(args)
