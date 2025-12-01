import sqlite3
import os
import json
import argparse

def load_config(config_path):
    if os.path.exists(config_path):
        with open(config_path, 'r') as f:
            return json.load(f)
    return {}

def init_db(config_path):
    config = load_config(config_path)
    db_path = config.get('dbPath', 'reasoning_logs.db')
    
    # Resolve db_path relative to config file directory
    config_dir = os.path.dirname(os.path.abspath(config_path))
    if not os.path.isabs(db_path):
        db_path = os.path.join(config_dir, db_path)
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Create reasoning table
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS reasoning (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        file TEXT,
        diff TEXT,
        reasoning TEXT,
        timestamp REAL,
        repair_ref TEXT,
        embedding BLOB,
        embedder_name TEXT
    )
    ''')
    
    # Create reasoning_raw table (optional fallback)
    cursor.execute('''
    CREATE TABLE IF NOT EXISTS reasoning_raw (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        raw_text TEXT,
        timestamp REAL
    )
    ''')
    
    conn.commit()
    conn.close()
    print(json.dumps({"success": True, "dbPath": db_path}))

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument('--config', default='reasoning-logger.json', help='Path to config file')
    args = parser.parse_args()
    
    try:
        init_db(args.config)
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))
        exit(1)
