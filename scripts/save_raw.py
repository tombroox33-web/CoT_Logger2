import sqlite3
import os
import json
import argparse
import time

def load_config(config_path):
    if os.path.exists(config_path):
        with open(config_path, 'r') as f:
            return json.load(f)
    return {}

def save_raw(args):
    config = load_config(args.config)
    db_path = config.get('dbPath', 'reasoning_logs.db')
    
    # Resolve db_path relative to config file directory
    config_dir = os.path.dirname(os.path.abspath(args.config))
    if not os.path.isabs(db_path):
        db_path = os.path.join(config_dir, db_path)
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        cursor.execute('''
        INSERT INTO reasoning_raw (raw_text, timestamp)
        VALUES (?, ?)
        ''', (
            args.text,
            time.time()
        ))
        
        conn.commit()
        print(json.dumps({"success": True}))
        
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))
    finally:
        conn.close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument('--text', required=True)
    parser.add_argument('--config', default='reasoning-logger.json')
    
    args = parser.parse_args()
    save_raw(args)
