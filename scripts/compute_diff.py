import difflib
import sys
import argparse
import os

def compute_diff(old_path, new_path, file_label):
    try:
        with open(old_path, 'r', encoding='utf-8') as f:
            old_lines = f.readlines()
    except FileNotFoundError:
        old_lines = []

    try:
        with open(new_path, 'r', encoding='utf-8') as f:
            new_lines = f.readlines()
    except FileNotFoundError:
        new_lines = []

    diff = difflib.unified_diff(
        old_lines, 
        new_lines, 
        fromfile=f"a/{file_label}", 
        tofile=f"b/{file_label}",
        lineterm=''
    )
    
    sys.stdout.writelines(diff)

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument('old_file', help="Path to old version")
    parser.add_argument('new_file', help="Path to new version")
    parser.add_argument('label', help="File label for diff header")
    parser.add_argument('--config', help="Ignored config path", required=False)
    
    args = parser.parse_args()
    compute_diff(args.old_file, args.new_file, args.label)
