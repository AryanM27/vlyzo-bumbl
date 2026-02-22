#!/bin/bash
set -e

echo "=================================================="
echo "    Vlyzo Vision + LLM Pipeline — Brev Deployment"
echo "=================================================="

# 1. Create and Activate Virtual Environment
echo "📦 Setting up Python virtual environment..."
python3 -m venv venv
source venv/bin/activate

# 2. Install Dependencies
echo "⏳ Installing dependencies..."
pip install -r requirements.txt

# 3. Pre-download Vision Model Weights
echo "🧠 Pre-downloading vision model weights..."
python -c "
import os
import torch
from transformers import (
    SegformerImageProcessor, AutoModelForSemanticSegmentation,
    CLIPProcessor, CLIPModel,
)
from rembg import new_session

print('  • Loading SegFormer B2...')
SegformerImageProcessor.from_pretrained('mattmdjaga/segformer_b2_clothes')
AutoModelForSemanticSegmentation.from_pretrained('mattmdjaga/segformer_b2_clothes')

print('  • Loading FashionCLIP...')
CLIPProcessor.from_pretrained('patrickjohncyh/fashion-clip')
CLIPModel.from_pretrained('patrickjohncyh/fashion-clip')

print('  • Loading rembg (U2-Net)...')
os.environ['U2NET_HOME'] = os.path.expanduser('~/.u2net')
new_session('u2net')

print('  ✅ Vision models cached.')
"

echo ""
echo "✅ Setup complete!"
echo ""
echo "=== HOW TO RUN ==="
echo ""
echo "You need TWO processes (use tmux with two panes):"
echo ""
echo "  Pane 1 — vLLM (Nemotron LLM server on port 8001):"
echo "    source venv/bin/activate"
echo "    vllm serve nvidia/NVIDIA-Nemotron-Nano-9B-v2 --port 8001 --trust-remote-code --dtype bfloat16"
echo ""
echo "  Pane 2 — Vision Pipeline (FastAPI on port 8000):"
echo "    source venv/bin/activate"
echo "    python vision_pipeline.py"
echo ""
echo "=== QUICK START (copy-paste) ==="
echo ""
echo "  tmux new -s vlyzo"
echo "  source venv/bin/activate && vllm serve nvidia/NVIDIA-Nemotron-Nano-9B-v2 --port 8001 --trust-remote-code --dtype bfloat16"
echo "  # (Ctrl+B, %) to split pane, then:"
echo "  source venv/bin/activate && python vision_pipeline.py"
