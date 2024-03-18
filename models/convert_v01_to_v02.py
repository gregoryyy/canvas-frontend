import json
import sys

def convert_format(input_filename, output_filename):
    with open(input_filename, 'r', encoding='utf-8') as f:
        data = json.load(f)
        
    data['meta']['version'] = '0.2'

    converted_data = {
        "meta": data["meta"],
        "canvas": [
            {
                "id": item["id"],
                "cards": [{"content": content} for content in item.get("content", [])],
                **({"score": item["score"]} if "score" in item else {}),
                **({"comment": item["comment"]} if "comment" in item else {})
            } for item in data.get("canvas", [])
        ],
        "analysis": data["analysis"]
    }

    with open(output_filename, 'w', encoding='utf-8') as f:
        json.dump(converted_data, f, indent=4)

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python convert_format.py <input_filename> <output_filename>")
        sys.exit(1)
    
    input_filename = sys.argv[1]
    output_filename = sys.argv[2]

    convert_format(input_filename, output_filename)
