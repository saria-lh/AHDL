#!/bin/sh

# Start the Uvicorn server in the background
uvicorn app.main:app --host 0.0.0.0 --port 8000 &

# Start the worker
python app/worker.py
