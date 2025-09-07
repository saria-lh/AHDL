from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.models.configs import Config
import os
import requests
import asyncio
import json
from app.services.simulate import *
router = APIRouter()


class HealthCheck(BaseModel):
    status: str

class JobResponse(BaseModel):
    job_id: str
    message: str

class JobRequest(BaseModel):
    config: Config


@router.post("/start_simulation", response_model=JobResponse)
async def start_simulation(job_request: JobRequest):
    """
    Receive simulation config from frontend and add to job queue
    """
    try:
        # Run simulation in background
        asyncio.create_task(run_simulation_background(job_request.config))
        
        # Return immediate response
        return JobResponse(
            job_id=job_request.config.job_id,
            message="Simulation started successfully"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500, 
            detail=f"Unexpected error: {str(e)}"
        )


async def run_simulation_background(config: Config):
    """
    Run simulation in background and update job status
    """
    try:
        # Run the simulation (now handles database updates internally)
        run_simulation(config)
    except Exception as e:
        print(f"Error in background simulation: {str(e)}")
        # Update job status to failed
        try:
            database_url = os.getenv("DATABASE_URL", "http://database:8000")
            update_data = {
                "status": "failed",
                "progress": 0
            }
            requests.put(
                f"{database_url}/jobs/{config.job_id}",
                json=update_data
            )
        except:
            pass
        raise e