#!/bin/bash
cd /Users/a777/Desktop/Cursor/CYRILHD/llm-viz-embed
echo "Current directory: $(pwd)"
echo "Files in directory:"
ls -la
echo ""
echo "Checking public folder:"
ls -la public/ 2>/dev/null || echo "public/ directory not found or empty"
echo ""
echo "Starting dev server..."
npm run dev
