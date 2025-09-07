# AHDL Drone Simulation System

This project is a web-based simulation system for analyzing radio wave propagation between drones in a 3D environment. It allows users to configure drone positions, define their motion paths, select a 3D scene, and run a simulation to compute the channel impulse response (CIR) between the drones.

## System Architecture

The system is composed of three main services, orchestrated using Docker Compose:

1.  **Frontend**: A Next.js and React-based web interface for configuring and visualizing drone simulations.
2.  **Database Service**: A FastAPI application that manages the job queue using Redis and serves 3D models.
3.  **Simulation Service**: A FastAPI application that runs the radio wave simulations using Sionna-RT.

## Project Structure

```
.
├── database/         # Manages the job queue and 3D models
├── frontend/         # The Next.js web application
├── simulation/       # The Sionna-RT simulation engine
├── docker-compose.yml # Docker Compose configuration
└── Makefile          # Main Makefile for managing the services
```

## Technologies Used

*   **Frontend**: Next.js, React, React Three Fiber, Three.js, Tailwind CSS
*   **Backend**: FastAPI, Python, Redis
*   **Simulation**: Sionna-RT, Mitsuba 3
*   **Containerization**: Docker, Docker Compose

## Workflow

1.  The user configures the drone positions, motion paths, and simulation parameters in the **Frontend**.
2.  The user selects a 3D environment model and submits the job.
3.  The **Frontend** sends the job configuration to the **Database Service**, which creates a new job in the Redis job queue with a "pending" status.
4.  The **Database Service** notifies the **Simulation Service** to start processing the new job.
5.  The **Simulation Service** (or its worker) picks up the pending job from the **Database Service**.
6.  The **Simulation Service** updates the job status to "processing" and runs the Sionna-RT simulation.
7.  During the simulation, the **Simulation Service** periodically updates the job progress.
8.  When the simulation is complete, the **Simulation Service** stores the results in the job record and updates the job status to "completed".
9.  The **Frontend** can track the job progress and view the results by polling the **Database Service**.

## Services

### Frontend (Port 3001)

The frontend is a Next.js application that provides a web-based interface for the simulation system.

*   **3D Visualization**: Built with React Three Fiber and Three.js to provide a 3D visualization of the drones and the environment.
*   **Configuration**: Allows users to configure drone parameters, motion paths, and simulation settings.
*   **Job Management**: Submits jobs to the database service and tracks their progress.

### Database Service (Port 8001)

The database service is a FastAPI application that manages the job queue and serves 3D models.

*   **Job Queue**: Uses Redis to manage a queue of simulation jobs.
*   **3D Models**: Serves 3D models to the frontend and the simulation service.
*   **API Endpoints**:
    *   `GET /`: Health check.
    *   `POST /jobs`: Create a new job.
    *   `GET /jobs`: List all jobs.
    *   `GET /jobs/{job_id}`: Get a specific job.
    *   `PUT /jobs/{job_id}`: Update job status.
    *   `DELETE /jobs/{job_id}`: Delete a job.
    *   `GET /models`: List available 3D models.

### Simulation Service (Port 8002)

The simulation service is a FastAPI application that runs the radio wave simulations using Sionna-RT.

*   **Simulation Engine**: Uses Sionna-RT and Mitsuba 3 to run the simulations.
*   **Job Processing**: Automatically processes jobs from the database service.
*   **API Endpoints**:
    *   `GET /`: Health check.
    *   `GET /api/health`: Health check.
    *   `POST /api/start_simulation`: Starts a simulation.

## Running the System

To run the system, you need to have Docker and Docker Compose installed.

1.  **Build and start all services:**

    ```bash
    make run
    ```

2.  **Access the services:**
    *   **Frontend**: http://localhost:3001
    *   **Database API**: http://localhost:8001
    *   **Simulation API**: http://localhost:8002

3.  **Stop and remove all containers:**
    ```bash
    make clean
    ```

## Development

Each service can be developed and run independently. Refer to the `Makefile` in each service's directory for more details.
