import sqlite3
import os
import json
import argparse
import time
import sys

# Try to import sentence_transformers
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

def save_entry(args):
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

    try:
        embedding_blob = None
        
        # Compute embedding if reasoning is provided and enabled
        if args.reasoning and enable_embeddings:
            if not HAS_SENTENCE_TRANSFORMERS:
                print(json.dumps({"success": False, "error": "sentence-transformers not installed but embeddings enabled"}), file=sys.stderr)
            else:
                try:
                    model = SentenceTransformer(embedder_model)
                    embedding = model.encode(args.reasoning)
                    embedding_blob = embedding.tobytes()
                except Exception as e:
                    print(json.dumps({"success": False, "error": f"Embedding failed: {str(e)}"}), file=sys.stderr)

        if args.id:
            # UPDATE existing entry
            updates = []
            params = []
            
            if args.diff is not None:
                updates.append("diff = ?")
                params.append(args.diff)
            
            if args.reasoning is not None:
                updates.append("reasoning = ?")
                params.append(args.reasoning)
                
            if embedding_blob is not None:
                updates.append("embedding = ?")
                params.append(embedding_blob)
                updates.append("embedder_name = ?")
                params.append(embedder_model)

            # Always update timestamp on modification? Or keep original?
            # Let's update timestamp to reflect latest activity
            updates.append("timestamp = ?")
            params.append(time.time())

            if not updates:
                print(json.dumps({"success": True, "id": args.id, "message": "No changes provided"}))
                return

            params.append(args.id)
            sql = f"UPDATE reasoning SET {', '.join(updates)} WHERE id = ?"
            cursor.execute(sql, params)
            entry_id = args.id
            
        else:
            # INSERT new entry
            cursor.execute('''
            INSERT INTO reasoning (file, diff, reasoning, timestamp, repair_ref, embedding, embedder_name)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (
                args.file,
                args.diff or "",
                args.reasoning or "",
                time.time(),
                args.repair_ref or "[]",
                embedding_blob,
                embedder_model if enable_embeddings and embedding_blob else None
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
    parser.add_argument('--id', type=int, help="ID to update")
    parser.add_argument('--file', help="Filename")
    parser.add_argument('--diff', help="Diff content")
    parser.add_argument('--reasoning', help="Reasoning text")
    parser.add_argument('--repair-ref', help="JSON array string")
    parser.add_argument('--config', default='reasoning-logger.json')
    
    args = parser.parse_args()
    save_entry(args)
