#!/bin/bash
set -e

echo "=================================================="
echo "    Vlyzo Vision Pipeline — Brev Deployment"
echo "=================================================="

# 1. Create and Activate Virtual Environment
echo "📦 Setting up Python virtual environment..."
python3 -m venv venv
source venv/bin/activate

# 2. Install Dependencies
echo "⏳ Installing dependencies (this may take a minute)..."
pip install -r requirements.txt

# 3. Pre-download Model Weights
# (Avoids slow cold-starts or timeouts on the first API request)
echo "🧠 Pre-downloading model weights (SegFormer, FashionCLIP, U2Net)..."
python -c "
import os
import torch
from transformers import SegformerImageProcessor, AutoModelForSemanticSegmentation, CLIPProcessor, CLIPModel
from rembg import new_session

print('  • Loading SegFormer...')
SegformerImageProcessor.from_pretrained('mattmdjaga/segformer_b2_clothes')
AutoModelForSemanticSegmentation.from_pretrained('mattmdjaga/segformer_b2_clothes')

print('  • Loading FashionCLIP...')
CLIPProcessor.from_pretrained('patrickjohncyh/fashion-clip')
CLIPModel.from_pretrained('patrickjohncyh/fashion-clip')

print('  • Loading rembg (U2-Net)...')
# Set standard cache path for U2-Net
os.environ['U2NET_HOME'] = os.path.expanduser('~/.u2net')
new_session('u2net')

print('  • Models cached successfully.')
"

echo "✅ Setup complete! You are ready to start the server."
echo ""
echo "To run the server in the foreground:"
echo "$ source venv/bin/activate && uvicorn vision_pipeline:app --host 0.0.0.0 --port 8000"
echo ""
echo "To run it in the background using PM2 (recommended for production):"
echo "$ pm2 start \"source venv/bin/activate && uvicorn vision_pipeline:app --host 0.0.0.0 --port 8000\" --name vlyzo-vision"
