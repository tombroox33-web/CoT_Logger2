import sqlite3
import os
import json
import argparse

def load_config(config_path):
    if os.path.exists(config_path):
        with open(config_path, 'r') as f:
            return json.load(f)
    return {}

def get_by_id(args):
    config = load_config(args.config)
    db_path = config.get('dbPath', 'reasoning_logs.db')
    
    # Resolve db_path relative to config file directory
    config_dir = os.path.dirname(os.path.abspath(args.config))
    if not os.path.isabs(db_path):
        db_path = os.path.join(config_dir, db_path)
    
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    try:
        cursor.execute('''
        SELECT id, file, reasoning, repair_ref, timestamp, diff
        FROM reasoning
        WHERE id = ?
        ''', (args.id,))
        
        row = cursor.fetchone()
        
        if row:
            result = {
                "id": row['id'],
                "file": row['file'],
                "reasoning": row['reasoning'],
                "repair_ref": json.loads(row['repair_ref']) if row['repair_ref'] else [],
                "timestamp": row['timestamp'],
                "diff": row['diff']
            }
            print(json.dumps({"success": True, "result": result}))
        else:
            print(json.dumps({"success": False, "error": "Entry not found"}))
        
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))
    finally:
        conn.close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument('--id', type=int, required=True)
    parser.add_argument('--config', default='reasoning-logger.json')
    
    args = parser.parse_args()
    get_by_id(args)
