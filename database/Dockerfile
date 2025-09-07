FROM python:3.9-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install -r requirements.txt

# Create directories
RUN mkdir -p /app/jobs /app/3d_models

# Copy job queue implementation
COPY job_queue.py .

# Expose port for API
EXPOSE 8000

# Start the job queue service
CMD ["uvicorn", "job_queue:app", "--host", "0.0.0.0", "--port", "8000"]
