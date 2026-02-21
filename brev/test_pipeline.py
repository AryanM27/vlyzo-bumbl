"""
Quick test script for the vision pipeline.

Usage:
  1. Start the server:  python vision_pipeline.py
  2. In another terminal: python test_pipeline.py <path_to_image>

Examples:
  python test_pipeline.py ~/photos/outfit.jpg
  python test_pipeline.py ~/photos/shirt.jpg --single
"""

import sys
import json
import base64
import argparse
import requests


def main():
    parser = argparse.ArgumentParser(description="Test the Vlyzo Vision Pipeline")
    parser.add_argument("image_path", help="Path to an image file")
    parser.add_argument(
        "--single",
        action="store_true",
        help="Use /process-single (single item) instead of /process-outfit",
    )
    parser.add_argument(
        "--url",
        default="http://localhost:8000",
        help="Server URL (default: http://localhost:8000)",
    )
    parser.add_argument(
        "--save-crops",
        action="store_true",
        help="Save cropped item images to disk",
    )
    args = parser.parse_args()

    # Read and encode the image
    with open(args.image_path, "rb") as f:
        image_base64 = base64.b64encode(f.read()).decode()

    # Check server health
    print(f"Checking server at {args.url}...")
    try:
        health = requests.get(f"{args.url}/health", timeout=5)
        health.raise_for_status()
        info = health.json()
        print(f"  Status: {info['status']}")
        print(f"  Device: {info['device']}")
        print(f"  GPU:    {info.get('gpu', 'N/A')}")
        print()
    except requests.ConnectionError:
        print(f"ERROR: Cannot connect to {args.url}")
        print("Make sure the server is running: python vision_pipeline.py")
        sys.exit(1)

    # Send the image
    endpoint = "/process-single" if args.single else "/process-outfit"
    print(f"Sending image to {endpoint}...")
    print(f"  File: {args.image_path}")
    print(f"  Size: {len(image_base64) // 1024} KB (base64)")
    print()

    resp = requests.post(
        f"{args.url}{endpoint}",
        json={"image_base64": image_base64},
        timeout=120,
    )
    resp.raise_for_status()
    result = resp.json()

    # Print results
    print(f"Items found: {result['items_found']}")
    print("=" * 60)

    for i, item in enumerate(result["items"]):
        print(f"\nItem {i + 1}: {item['segment_label']}")
        print(f"  Segment confidence: {item['segment_confidence']:.2f}")
        print(f"  Category:  {item['category']['label']} ({item['category']['confidence']:.2f})")
        print(f"  Style:     {item['style']['label']} ({item['style']['confidence']:.2f})")
        print(f"  Color:     {item['color']['label']} ({item['color']['confidence']:.2f})")
        print(f"  Pattern:   {item['pattern']['label']} ({item['pattern']['confidence']:.2f})")
        print(f"  Material:  {item['material']['label']} ({item['material']['confidence']:.2f})")
        print(f"  Season:    {item['season']['label']} ({item['season']['confidence']:.2f})")
        print(f"  Tags:      {item['tags']}")
        print(f"  Embedding: {len(item['embedding'])} dims")

        if item.get("top_categories"):
            print(f"  Top 3 categories:")
            for cat in item["top_categories"]:
                print(f"    - {cat['label']} ({cat['confidence']:.2f})")

        # Optionally save cropped images
        if args.save_crops and item.get("cropped_image_base64"):
            crop_path = f"crop_{i + 1}_{item['segment_label']}.png"
            with open(crop_path, "wb") as f:
                f.write(base64.b64decode(item["cropped_image_base64"]))
            print(f"  Saved crop: {crop_path}")

    print("\n" + "=" * 60)
    print("Done!")


if __name__ == "__main__":
    main()
