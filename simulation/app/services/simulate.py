import os
import sys
import json
from tqdm.auto import tqdm
import numpy as np
import sionna
from sionna.rt import load_scene, Transmitter, Receiver, PlanarArray, PathSolver, Paths
import pickle
import drjit as dr
import gc
from app.models.configs import Config, Drone
from typing import List, Dict, Any, Optional
import itertools
import math
from loguru import logger
import base64
import mitsuba as mi
import traceback
import requests

def polar_to_cartesian(radius: float, degree: float) -> tuple[float, float]:
    rad = math.radians(degree)
    x = radius * math.cos(rad)
    y = radius * math.sin(rad)
    return float(round(x, 2)), float(round(y, 2))

def _update_job_status(job_id: str, status: str, progress: int = 0, result: Dict[Any, Any] = None):
    try:
        database_url = os.getenv("DATABASE_URL", "http://database:8000")
        update_data = {
            "status": status,
            "progress": progress
        }
        if result is not None:
            update_data["result"] = result

        response = requests.put(
            f"{database_url}/jobs/{job_id}",
            json=update_data
        )
        if response.status_code != 200:
            logger.error(f"Failed to update job status: {response.text}")
    except Exception as e:
        logger.error(f"Error updating job status: {str(e)}")

def _calculate_trajectories(drones: List[Drone], steps: int) -> List[List[List[float]]]:
    trajectories = []
    for drone in drones:
        if drone.has_motion and drone.motion:
            if drone.motion.motion_type == 'line':
                start = np.array(drone.location)
                end = np.array(drone.motion.end_position)
                drone_path = [
                    (start + i * (end - start) / (steps - 1)).tolist() for i in range(steps)
                ]
                trajectories.append(drone_path)
            elif drone.motion.motion_type == 'circle':
                drone_path = []
                drone_x, drone_y, z = drone.location
                radius = drone.motion.radius

                center_x = drone_x + radius
                center_y = drone_y

                angle_step = 360 / steps

                for i in range(steps):
                    angle = 180 + (i * angle_step)
                    dx, dy = polar_to_cartesian(radius, angle)
                    drone_path.append([center_x + dx, center_y + dy, z])
                trajectories.append(drone_path)
        else:
            trajectories.append([drone.location] * steps)
    return trajectories

def _run_sionna_step(config: Config, current_drones: List[Drone], step: int):
    variant_to_set = 'llvm_ad_mono_polarized'
    logger.info(f"Attempting to set Mitsuba variant to: '{variant_to_set}'")
    mi.set_variant(variant_to_set)
    logger.info(f"Mitsuba variant after setting: {mi.variant()}")

    scene = None
    try:
        scene_path = f"/3d_models/{config.scene_name}/{config.scene_name}.xml"
        logger.info(f"Loading scene: {scene_path}")
        scene = load_scene(scene_path)
        logger.info(f"Scene loaded successfully!")

        radio_config = config.radio_configs
        antenna_config = config.antenna_configs
        logger.info(f"Radio config: {radio_config}")
        logger.info(f"Antenna config: {antenna_config}")
        logger.info(f"Frequency: {radio_config.frequency}")
        logger.info(f"Setting up scene...")
        scene.frequency = radio_config.frequency
        antenna_array = PlanarArray(
            num_rows=antenna_config.num_rows,
            num_cols=antenna_config.num_cols,
            vertical_spacing=antenna_config.vertical_spacing,
            horizontal_spacing=antenna_config.horizontal_spacing,
            pattern=antenna_config.pattern,
            polarization=antenna_config.polarization
        )
        scene.tx_array = antenna_array
        scene.rx_array = antenna_array

        for i, drone in enumerate(current_drones):
            tx = Transmitter(name=f'tx_{i}', position=drone.location)
            rx = Receiver(name=f'rx_{i}', position=drone.location)
            scene.add(tx)
            scene.add(rx)

        p_solver = PathSolver()
        logger.info(f"Path solver created successfully!.... running simulation..")
        paths = p_solver(scene=scene,
                        max_num_paths_per_src=int(1e7),
                        samples_per_src=int(1e7),
                        max_depth=50,
                        los=True,
                        specular_reflection=True,
                        diffuse_reflection=True,
                        refraction=True,
                        synthetic_array=False,
                        seed=32)
        cir = paths.taps(bandwidth=radio_config.bandwidth,
                  l_min=-3,
                  l_max=47,
                  sampling_frequency=None,
                  normalize=True,
                  normalize_delays=True,
                  num_time_steps=1,
                  out_type="numpy")

        logger.info(f"CIR shape: {cir.shape}, dtype: {cir.dtype}")

        cir_mag = np.abs(cir).astype(np.float16)
        cir_phase = np.angle(cir).astype(np.float16)

        logger.info(f"CIR magnitude shape: {cir_mag.shape}, dtype: {cir_mag.dtype}")
        logger.info(f"CIR phase shape: {cir_phase.shape}, dtype: {cir_phase.dtype}")

        cir_mag_base64 = base64.b64encode(cir_mag.tobytes(order='C')).decode('utf-8')
        cir_phase_base64 = base64.b64encode(cir_phase.tobytes(order='C')).decode('utf-8')

        results = {
            "cir_mag": cir_mag_base64,
            "cir_phase": cir_phase_base64,
            "dtype": str(cir_mag.dtype),
            "shape": cir_mag.shape,
            "num_drones": len(current_drones),
            "scene_name": config.scene_name,
        }

        return results

    except Exception as e:
        logger.error(f"Error in simulation: {e}")
        full_trace = ''.join(traceback.format_exc())
        logger.error(f"Full traceback:\n{full_trace}")
        raise e
    finally:
        if 'scene' in locals():
            del scene
        if 'p_solver' in locals():
            del p_solver
        if 'paths' in locals():
            del paths
        gc.collect()
        dr.flush_malloc_cache()


def run_simulation(config: Config, progress_callback=None):
    _update_job_status(config.job_id, "processing", 0)

    trajectories = _calculate_trajectories(config.drones, config.simulation_steps)
    job_id = config.job_id
    all_results = {}

    if config.move_together:
        logger.info("Running simulation with drones moving together.")
        total_steps = config.simulation_steps
        for step_idx in tqdm(range(total_steps), desc="Simulation Steps"):
            current_drones = []
            for drone_idx, drone_config in enumerate(config.drones):
                new_location = trajectories[drone_idx][step_idx]
                current_drones.append(Drone(location=new_location))

            intermediate_drone_locations = [drone.location for drone in current_drones]
            step_results = _run_sionna_step(config, current_drones, step_idx)
            inner_dict_results = {
                "drone_locations": intermediate_drone_locations,
                "step_results": step_results
            }
            all_results[str(step_idx)] = inner_dict_results

            progress = int((step_idx + 1) / total_steps * 100)
            _update_job_status(job_id, "processing", progress)
    else:
        logger.info("Running simulation with drones moving independently.")
        moving_drone_indices = [i for i, d in enumerate(config.drones) if d.has_motion]
        stationary_drone_indices = [i for i, d in enumerate(config.drones) if not d.has_motion]

        moving_trajectories = [trajectories[i] for i in moving_drone_indices]

        position_combinations = itertools.product(*moving_trajectories)

        total_combinations = np.prod([len(t) for t in moving_trajectories])
        combination_count = 0

        for i, combination in enumerate(tqdm(position_combinations, total=total_combinations, desc="Position Combinations")):
            current_drones = [None] * len(config.drones)
            step_id_parts = []

            for idx, drone_pos in enumerate(combination):
                drone_idx = moving_drone_indices[idx]
                current_drones[drone_idx] = Drone(location=drone_pos)
                step_idx = trajectories[drone_idx].index(drone_pos)
                step_id_parts.append(f"d{drone_idx}s{step_idx}")


            for drone_idx in stationary_drone_indices:
                current_drones[drone_idx] = Drone(location=config.drones[drone_idx].location)

            step_id = "_".join(step_id_parts)
            intermediate_drone_locations = [drone.location for drone in current_drones]
            step_results = _run_sionna_step(config, current_drones, step_id)
            inner_dict_results = {
                "drone_locations": intermediate_drone_locations,
                "step_results": step_results
            }
            all_results[str(i)] = inner_dict_results

            combination_count += 1
            progress = int(combination_count / total_combinations * 100)
            _update_job_status(job_id, "processing", progress)

    _update_job_status(job_id, "completed", 100, all_results)

    return all_results
