import sqlite3
import os
import json
import argparse

def load_config(config_path):
    if os.path.exists(config_path):
        with open(config_path, 'r') as f:
            return json.load(f)
    return {}

def diagnose(config_path):
    config = load_config(config_path)
    db_path = config.get('dbPath', 'reasoning_logs.db')
    
    # Get absolute path of where the DB would be created
    abs_db_path = os.path.abspath(db_path)
    
    # Get config directory
    config_dir = os.path.dirname(os.path.abspath(config_path))
    
    # Get current working directory
    cwd = os.getcwd()
    
    print(json.dumps({
        "cwd": cwd,
        "config_path": os.path.abspath(config_path),
        "config_dir": config_dir,
        "db_path_from_config": db_path,
        "db_absolute_path": abs_db_path,
        "db_exists": os.path.exists(abs_db_path)
    }, indent=2))

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument('--config', default='reasoning-logger.json')
    args = parser.parse_args()
    diagnose(args.config)
