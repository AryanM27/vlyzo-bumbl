#!/bin/bash
# start.sh — Launch vLLM + Vision Pipeline in tmux
# Usage: ./start.sh

set -e
cd "$(dirname "$0")"

SESSION="vlyzo"

# Kill existing session if any
tmux kill-session -t $SESSION 2>/dev/null || true

# Create new tmux session with vLLM in pane 0
tmux new-session -d -s $SESSION -n main

# Pane 0: vLLM (Nemotron)
tmux send-keys -t $SESSION:main.0 "cd ~/vlyzo-bumbl/brev && source venv/bin/activate && echo '🚀 Starting vLLM (Nemotron)...' && vllm serve nvidia/NVIDIA-Nemotron-Nano-9B-v2 --port 8001 --trust-remote-code --dtype bfloat16" Enter

# Wait for vLLM to load (~90 seconds)
echo "⏳ Waiting 90s for vLLM to load Nemotron..."
sleep 90

# Split horizontally and start Vision Pipeline in pane 1
tmux split-window -h -t $SESSION:main
tmux send-keys -t $SESSION:main.1 "cd ~/vlyzo-bumbl/brev && source venv/bin/activate && echo '🚀 Starting Vision Pipeline...' && python vision_pipeline.py" Enter

echo ""
echo "✅ Both servers starting in tmux session '$SESSION'"
echo ""
echo "   Pane 0 (left):  vLLM on port 8001"
echo "   Pane 1 (right): Vision Pipeline on port 8000"
echo ""
echo "To view:    tmux attach -t $SESSION"
echo "To detach:  Ctrl+B, then D"
echo "To stop:    tmux kill-session -t $SESSION"
