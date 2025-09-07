
import os
import time
import requests
from loguru import logger

from app.services.simulate import run_simulation
from app.models.configs import Config

DATABASE_URL = os.getenv("DATABASE_URL", "http://database:8000")

def get_pending_jobs():
    """Get pending jobs from the database service."""
    try:
        response = requests.get(f"{DATABASE_URL}/jobs")
        if response.status_code == 200:
            jobs = response.json()
            return [job for job in jobs if job['status'] == 'pending']
        else:
            logger.error(f"Failed to get jobs: {response.text}")
            return []
    except Exception as e:
        logger.error(f"Error getting jobs: {e}")
        return []

def process_job(job):
    """Process a single job."""
    job_id = job['id']
    logger.info(f"Found pending job: {job_id}")
    try:
        config = Config(**job['config'])
        logger.info(f"Starting simulation for job: {job_id}")
        run_simulation(config)
        logger.info(f"Finished simulation for job: {job_id}")
    except Exception as e:
        logger.error(f"Error processing job {job_id}: {e}")
        # Update job status to failed
        try:
            update_data = {"status": "failed", "progress": 0}
            requests.put(f"{DATABASE_URL}/jobs/{job_id}", json=update_data)
        except Exception as update_e:
            logger.error(f"Failed to update job status to failed for job {job_id}: {update_e}")


def main():
    """Main worker loop."""
    logger.info("Starting simulation worker...")
    while True:
        pending_jobs = get_pending_jobs()
        if pending_jobs:
            for job in pending_jobs:
                process_job(job)
        else:
            logger.info("No pending jobs found. Waiting...")
        
        time.sleep(10) # Poll every 10 seconds

if __name__ == "__main__":
    main()
