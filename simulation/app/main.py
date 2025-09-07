from fastapi import FastAPI
import app.bootstrap_mitsuba
from app.api import health, simulation
from contextlib import asynccontextmanager
import mitsuba as mi
from loguru import logger
import sionna.rt
  # noqa: F401  (side-effect: sets variant & registers plugins)
app = FastAPI(title="Simulation Service")



# Include routers
app.include_router(health.router, prefix="/api")
app.include_router(simulation.router, prefix="/api")


@app.get("/")
async def root():
    return {"message": "Simulation Service"}