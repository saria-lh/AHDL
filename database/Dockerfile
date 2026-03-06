FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

RUN mkdir -p /app/jobs /app/3d_models

COPY job_queue.py .

EXPOSE 8000
CMD ["uvicorn", "job_queue:app", "--host", "0.0.0.0", "--port", "8000"]
