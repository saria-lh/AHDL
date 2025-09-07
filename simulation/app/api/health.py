from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.models.configs import Config
import os
import requests

router = APIRouter()

class HealthCheck(BaseModel):
    status: str

class JobResponse(BaseModel):
    job_id: str
    message: str

@router.get("/health", response_model=HealthCheck)
async def health_check():
    """
    Health check endpoint
    """
    return HealthCheck(status="healthy")
