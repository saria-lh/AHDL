from typing import List, Dict, Optional
from pydantic import BaseModel


class RadioConfig(BaseModel):
    frequency: float = 6e9
    bandwidth: float = 500e6

class AntennaConfig(BaseModel):
    num_rows: int = 1
    num_cols: int = 1
    vertical_spacing: float = 0
    horizontal_spacing: float = 0
    pattern: str = "iso"
    polarization: str = "H"

class Motion(BaseModel):
    motion_type: str
    radius: float = 0.0
    end_position: Optional[List[float]] = None  # 3D

class Drone(BaseModel):
    location: List[float]
    has_motion: bool = False
    motion: Optional[Motion] = None

class Config(BaseModel):
    job_id: str
    scene_name: str
    simulation_steps: int = 5
    move_together: bool = True
    antenna_configs: AntennaConfig
    radio_configs: RadioConfig
    drones: List[Drone]


class Response(BaseModel):
    job_id: str
    results: Dict
    