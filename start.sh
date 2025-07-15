#!/bin/bash

# Function to cleanup existing processes
cleanup_processes() {
  echo "Cleaning up existing processes..."
  
  # Kill all chromium processes
  pkill -f chromium 2>/dev/null || true
  pkill -f playwright 2>/dev/null || true
  
  # Kill any existing Node.js processes related to our project
  pkill -f "node dist/token_scraper.js" 2>/dev/null || true
  pkill -f "node dist/twitter_scraper.js" 2>/dev/null || true
  pkill -f "node dist/ai_analyzer.js" 2>/dev/null || true
  pkill -f "node dist/api-server.js" 2>/dev/null || true
  
  echo "Process cleanup completed."
}

# Cleanup before starting
cleanup_processes

# Check for tmux
if ! command -v tmux &> /dev/null; then
  echo "tmux is not installed. Please install tmux first."
  exit 1
fi

# Check for nvm
if [ -z "$NVM_DIR" ]; then
  export NVM_DIR="$HOME/.nvm"
fi
if [ ! -s "$NVM_DIR/nvm.sh" ]; then
  echo "nvm not found. Installing nvm..."
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
  export NVM_DIR="$HOME/.nvm"
  [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
else
  [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
  echo "nvm is already installed."
fi

# Check for npm
if ! command -v npm &> /dev/null; then
  echo "npm not found. Installing latest Node.js LTS via nvm..."
  nvm install --lts
else
  echo "npm is already installed."
fi

# Check for pnpm
if ! command -v pnpm &> /dev/null; then
  echo "pnpm not found. Installing pnpm..."
  npm install -g pnpm
else
  echo "pnpm is already installed."
fi

# Convert .env.example to .env if needed
if [ -f "$HOME/trendpup-aptos/.env.example" ] && [ ! -f "$HOME/trendpup-aptos/.env" ]; then
  mv "$HOME/trendpup-aptos/.env.example" "$HOME/trendpup-aptos/.env"
  echo "Moved .env.example to .env"
fi
if [ -f "$HOME/trendpup-aptos/eliza/trendpup/.env.example" ] && [ ! -f "$HOME/trendpup-aptos/eliza/trendpup/.env" ]; then
  mv "$HOME/trendpup-aptos/eliza/trendpup/.env.example" "$HOME/trendpup-aptos/eliza/trendpup/.env"
  echo "Moved eliza/trendpup .env.example to .env"
fi

# Start frontend session with auto-restart
if ! tmux has-session -t frontend 2>/dev/null; then
  tmux new-session -d -s frontend "bash -c 'while true; do cd $HOME/trendpup-aptos/frontend && pnpm install && pnpm build && pnpm start; echo \"frontend crashed. Restarting in 3s...\"; sleep 3; done'"
  echo "Started tmux session: frontend"
else
  echo "tmux session 'frontend' already exists."
fi

# Start backend session (API server, AI analyzer, Twitter scraper) with auto-restart
if ! tmux has-session -t backend 2>/dev/null; then
  tmux new-session -d -s backend "bash -c 'while true; do cd $HOME/trendpup-aptos/backend && pnpm install && pnpm exec playwright install && pnpm exec playwright install-deps && pnpm build && pnpm exec concurrently \"node dist/twitter_scraper.js\" \"node dist/ai_analyzer.js\" \"node dist/api-server.js\"; echo \"backend crashed. Restarting in 3s...\"; sleep 3; done'"
  echo "Started tmux session: backend"
else
  echo "tmux session 'backend' already exists."
fi

# Start token scraper session with 5min run / 5min stop cycle
if ! tmux has-session -t scraper 2>/dev/null; then
  tmux new-session -d -s scraper "bash -c 'while true; do echo \"Starting token scraper for 5 minutes...\"; cd $HOME/trendpup-aptos/backend && pnpm build && timeout 300 node dist/token_scraper.js; echo \"Token scraper completed/stopped. Waiting 5 minutes...\"; pkill -f \"node dist/token_scraper.js\" 2>/dev/null || true; sleep 300; done'"
  echo "Started tmux session: scraper"
else
  echo "tmux session 'scraper' already exists."
fi

if ! tmux has-session -t agent 2>/dev/null; then
  tmux new-session -d -s agent "bash -c 'while true; do cd $HOME/trendpup-aptos/agent && source /home/trendpup/.cache/pypoetry/virtualenvs/trendpup-i4fZTrp_-py3.12/bin/activate && adk run rag; echo \"backend crashed. Restarting in 3s...\"; sleep 3; done'"
  echo "Started tmux session: agent"
else
  echo "tmux session 'agent' already exists."
fi

# List sessions
sleep 1
tmux ls
