import os
import json
import uuid
import requests
from datetime import datetime
from typing import List, Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import redis

# Connect to Redis (will be configured via environment variables)
redis_client = redis.Redis(
    host=os.getenv('REDIS_HOST', 'localhost'),
    port=int(os.getenv('REDIS_PORT', 6379)),
    db=0,
    decode_responses=True
)

app = FastAPI(title="Database Job Queue Service")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict this to specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve static files from 3d_models directory
app.mount("/3d_models", StaticFiles(directory="/app/3d_models"), name="3d_models")

# Models
class Job(BaseModel):
    id: str
    status: str = "pending"  # pending, processing, completed, failed
    progress: int = 0  # 0-100
    created_at: str
    updated_at: str
    config: dict
    result: Optional[dict] = None

class JobCreate(BaseModel):
    config: dict

class JobStatusUpdate(BaseModel):
    status: str
    progress: int = 0
    result: Optional[dict] = None

# Helper functions
def get_model_folders():
    """Get list of model folders in 3d_models directory"""
    models_path = "/app/3d_models"
    if not os.path.exists(models_path):
        return []
    
    folders = []
    for item in os.listdir(models_path):
        item_path = os.path.join(models_path, item)
        if os.path.isdir(item_path):
            # Check if there's a .glb file in the folder
            glb_files = [f for f in os.listdir(item_path) if f.endswith('.glb')]
            if glb_files:
                folders.append({
                    "name": item,
                    "folder": item,
                    "glb_file": glb_files[0],
                    "path": f"/3d_models/{item}/{glb_files[0]}"
                })
    return folders

# API Endpoints
@app.get("/")
async def root():
    return {"message": "Database Job Queue Service"}

@app.post("/jobs", response_model=Job)
async def create_job(job_data: JobCreate):
    """Create a new job"""
    # Use the job ID from the frontend if provided, otherwise generate one
    job_id = job_data.config.get('job_id', str(uuid.uuid4()))
    now = datetime.now().isoformat()
    
    job = Job(
        id=job_id,
        status="pending",
        progress=0,
        created_at=now,
        updated_at=now,
        config=job_data.config
    )
    
    # Save job to Redis (serialize complex data types)
    job_dict = job.dict()
    job_dict['config'] = json.dumps(job_dict['config'])
    # Ensure result field is handled properly
    if job_dict.get('result') is not None:
        job_dict['result'] = json.dumps(job_dict['result'])
    else:
        # Remove the result field if it's None to avoid Redis errors
        if 'result' in job_dict:
            del job_dict['result']
    
    redis_client.hset(f"job:{job_id}", mapping=job_dict)
    # Add to jobs list
    redis_client.lpush("jobs", job_id)
    
    # Notify simulation service to start processing the job immediately
    try:
        simulation_url = os.getenv("SIMULATION_URL", "http://simulation:8000")
        # Send request to simulation service to start the job
        requests.post(
            f"{simulation_url}/api/start_simulation",
            json={"config": job_data.config},
            timeout=5  # 5 second timeout
        )
    except Exception as e:
        # If the direct call fails, the worker will still pick up the job
        print(f"Failed to notify simulation service: {e}")
        pass
    
    return job

@app.get("/jobs", response_model=List[Job])
async def list_jobs():
    """List all jobs"""
    job_ids = redis_client.lrange("jobs", 0, -1)
    jobs = []
    
    for job_id in job_ids:
        job_data = redis_client.hgetall(f"job:{job_id}")
        if job_data:
            # Deserialize complex data types
            if 'config' in job_data:
                job_data['config'] = json.loads(job_data['config'])
            if 'result' in job_data and job_data['result'] is not None:
                job_data['result'] = json.loads(job_data['result'])
            # Convert progress to int
            if 'progress' in job_data:
                job_data['progress'] = int(job_data['progress'])
            jobs.append(Job(**job_data))
    
    return jobs

@app.get("/jobs/{job_id}", response_model=Job)
async def get_job(job_id: str):
    """Get a specific job"""
    job_data = redis_client.hgetall(f"job:{job_id}")
    if not job_data:
        raise HTTPException(status_code=404, detail="Job not found")
    
    # Deserialize complex data types
    if 'config' in job_data:
        job_data['config'] = json.loads(job_data['config'])
    if 'result' in job_data and job_data['result'] is not None:
        job_data['result'] = json.loads(job_data['result'])
    # Convert progress to int
    if 'progress' in job_data:
        job_data['progress'] = int(job_data['progress'])
    
    return Job(**job_data)

@app.put("/jobs/{job_id}")
async def update_job(job_id: str, update_data: JobStatusUpdate):
    """Update job status"""
    # Check if job exists
    if not redis_client.exists(f"job:{job_id}"):
        raise HTTPException(status_code=404, detail="Job not found")
    
    # Update job data
    update_dict = update_data.dict()
    update_dict['updated_at'] = datetime.now().isoformat()
    
    # Serialize complex data types
    if 'result' in update_dict and update_dict['result'] is not None:
        update_dict['result'] = json.dumps(update_dict['result'])
    elif 'result' in update_dict:
        # Remove the result field if it's None to avoid Redis errors
        del update_dict['result']
    
    redis_client.hset(f"job:{job_id}", mapping=update_dict)
    
    return {"message": "Job updated successfully"}

@app.delete("/jobs/{job_id}")
async def delete_job(job_id: str):
    """Delete a specific job"""
    # Check if job exists
    if not redis_client.exists(f"job:{job_id}"):
        raise HTTPException(status_code=404, detail="Job not found")
    
    # Remove job from jobs list
    redis_client.lrem("jobs", 0, job_id)
    
    # Delete job data
    redis_client.delete(f"job:{job_id}")
    
    return {"message": "Job deleted successfully"}

@app.get("/models")
async def list_models():
    """List available 3D models"""
    return get_model_folders()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)