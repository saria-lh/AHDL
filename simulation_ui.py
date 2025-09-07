import json
import numpy as np
import base64
import tkinter as tk
from tkinter import ttk, filedialog, messagebox
import matplotlib.pyplot as plt
from matplotlib.backends.backend_tkagg import FigureCanvasTkAgg
import requests
from typing import Tuple, Optional, List

def process_simulation_results_data(job_data: dict) -> Tuple[Optional[int], Optional[np.ndarray], Optional[np.ndarray], Optional[List]]:
    """
    Processes simulation results directly from job data,
    decodes CIR data, and extracts drone locations.

    Args:
        job_data (dict): The job data from the API.

    Returns:
        tuple: A tuple containing:
            - int: The number of simulation steps.
            - numpy.ndarray: A NumPy array of the CIR magnitudes.
            - numpy.ndarray: A NumPy array of the CIR phases.
            - list: A list of drone locations for each step.
    """
    try:
        result_dict = job_data.get('result', {})
        num_steps = len(result_dict)

        if num_steps == 0:
            print("No results found in job data")
            return None, None, None, None

        mag_list = []
        phase_list = []
        locations_list = []

        for step_key in sorted(result_dict.keys(), key=int):
            step_data = result_dict[step_key]
            step_results = step_data.get('step_results', {})
            
            # 1. Extract drone locations
            locations_list.append(step_data.get('drone_locations'))

            # Get the shape from the metadata
            shape = step_results.get('shape')
            if not shape:
                raise ValueError(f"Shape information not found in step {step_key}")
                
            # Calculate the expected number of elements based on the shape
            expected_elements = int(np.prod(shape))

            # 2. Process CIR Magnitude
            cir_mag_base64 = step_results.get('cir_mag', '')
            mag_bytes = base64.b64decode(cir_mag_base64)
            
            full_mag_array = np.frombuffer(mag_bytes, dtype=np.float16)
            mag_array = full_mag_array[:expected_elements].reshape(shape)
            mag_list.append(mag_array)

            # 3. Process CIR Phase
            cir_phase_base64 = step_results.get('cir_phase', '')
            phase_bytes = base64.b64decode(cir_phase_base64)
            
            full_phase_array = np.frombuffer(phase_bytes, dtype=np.float16)
            phase_array = full_phase_array[:expected_elements].reshape(shape)
            phase_list.append(phase_array)

        mag_ndarray = np.stack(mag_list, axis=0)
        phase_ndarray = np.stack(phase_list, axis=0)

        return num_steps, mag_ndarray, phase_ndarray, locations_list
    except Exception as e:
        print(f"Error processing simulation results: {e}")
        return None, None, None, None

def get_jobs_from_database() -> List[Tuple[str, str]]:
    """
    Retrieve jobs from the server.
    Returns a list of tuples (job_id, job_name).
    """
    try:
        response = requests.get("http://localhost:8001/jobs")
        if response.status_code == 200:
            jobs_data = response.json()
            jobs = []
            for job in jobs_data:
                job_id = job.get('id', 'Unknown')
                scene_name = job.get('config', {}).get('scene_name', 'Unknown Scene')
                job_name = f"Job {job_id} - {scene_name}"
                jobs.append((job_id, job_name))
            return jobs
        else:
            print(f"Failed to fetch jobs. Status code: {response.status_code}")
            return []
    except requests.RequestException as e:
        print(f"Error fetching jobs: {e}")
        return []
    except json.JSONDecodeError as e:
        print(f"Error decoding JSON response: {e}")
        return []

def fetch_job_results(job_id: str) -> Optional[dict]:
    """
    Fetch job results from the server.
    Returns the JSON response or None if failed.
    """
    try:
        response = requests.get(f"http://localhost:8001/jobs/{job_id}")
        if response.status_code == 200:
            return response.json()
        else:
            print(f"Failed to fetch job results. Status code: {response.status_code}")
            return None
    except requests.RequestException as e:
        print(f"Error fetching job results: {e}")
        return None

class SimulationViewer:
    def __init__(self, root):
        self.root = root
        self.root.title("Simulation Results Viewer")
        self.root.geometry("1200x800")
        
        # Data variables
        self.jobs: List[Tuple[str, str]] = []
        self.current_job_id: Optional[str] = None
        self.steps = 0
        self.mag_nd = None
        self.phase_nd = None
        self.locations = None
        self.num_drones = 0
        
        # UI variables
        self.selected_step = tk.IntVar(value=0)
        self.selected_tx_id = tk.IntVar(value=0)
        self.selected_rx_id = tk.IntVar(value=0)
        
        # Create UI
        self.create_widgets()
        
        # Load jobs
        self.load_jobs()
    
    def create_widgets(self):
        # Main frame
        main_frame = ttk.Frame(self.root, padding="10")
        main_frame.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))
        
        # Job selection frame
        job_frame = ttk.LabelFrame(main_frame, text="Job Selection", padding="10")
        job_frame.grid(row=0, column=0, columnspan=2, sticky=(tk.W, tk.E), pady=(0, 10))
        
        ttk.Label(job_frame, text="Select Job:").grid(row=0, column=0, sticky=tk.W)
        self.job_combobox = ttk.Combobox(job_frame, state="readonly", width=50)
        self.job_combobox.grid(row=0, column=1, padx=(10, 0), sticky=(tk.W, tk.E))
        self.job_combobox.bind("<<ComboboxSelected>>", self.on_job_selected)
        
        # Refresh button
        refresh_button = ttk.Button(job_frame, text="Refresh", command=self.refresh_jobs)
        refresh_button.grid(row=0, column=2, padx=(10, 0))

        # Export to NumPy button
        export_button = ttk.Button(job_frame, text="Export to NumPy", command=self.export_data_as_numpy)
        export_button.grid(row=0, column=3, padx=(10, 0))
        
        # Parameters frame
        param_frame = ttk.LabelFrame(main_frame, text="Parameters", padding="10")
        param_frame.grid(row=1, column=0, columnspan=2, sticky=(tk.W, tk.E), pady=(0, 10))
        
        # Step selection
        ttk.Label(param_frame, text="Step #:").grid(row=0, column=0, sticky=tk.W)
        self.step_combobox = ttk.Combobox(param_frame, textvariable=self.selected_step, state="readonly")
        self.step_combobox.grid(row=0, column=1, padx=(10, 20), sticky=tk.W)
        self.step_combobox.bind("<<ComboboxSelected>>", self.on_param_changed)
        
        # TX ID selection
        ttk.Label(param_frame, text="TX ID:").grid(row=0, column=2, sticky=tk.W)
        self.tx_combobox = ttk.Combobox(param_frame, textvariable=self.selected_tx_id, state="readonly")
        self.tx_combobox.grid(row=0, column=3, padx=(10, 20), sticky=tk.W)
        self.tx_combobox.bind("<<ComboboxSelected>>", self.on_param_changed)
        
        # RX ID selection
        ttk.Label(param_frame, text="RX ID:").grid(row=0, column=4, sticky=tk.W)
        self.rx_combobox = ttk.Combobox(param_frame, textvariable=self.selected_rx_id, state="readonly")
        self.rx_combobox.grid(row=0, column=5, padx=(10, 0), sticky=tk.W)
        self.rx_combobox.bind("<<ComboboxSelected>>", self.on_param_changed)
        
        # Plots frame
        plots_frame = ttk.Frame(main_frame)
        plots_frame.grid(row=2, column=0, columnspan=2, sticky=(tk.W, tk.E, tk.N, tk.S))
        
        # Configure grid weights for resizing
        self.root.columnconfigure(0, weight=1)
        self.root.rowconfigure(0, weight=1)
        main_frame.columnconfigure(1, weight=1)
        main_frame.rowconfigure(2, weight=1)
        plots_frame.columnconfigure(0, weight=1)
        plots_frame.columnconfigure(1, weight=1)
        plots_frame.rowconfigure(0, weight=1)
        plots_frame.rowconfigure(1, weight=1)
        
        # Create matplotlib figures
        self.fig_locations, self.ax_locations = plt.subplots(figsize=(5, 4))
        self.fig_magnitude, self.ax_magnitude = plt.subplots(figsize=(5, 4))
        self.fig_phase, self.ax_phase = plt.subplots(figsize=(5, 4))
        
        # Create canvas widgets
        self.canvas_locations = FigureCanvasTkAgg(self.fig_locations, plots_frame)
        self.canvas_locations.get_tk_widget().grid(row=0, column=1, rowspan=2, sticky=(tk.W, tk.E, tk.N, tk.S), padx=(5, 0))
        
        self.canvas_magnitude = FigureCanvasTkAgg(self.fig_magnitude, plots_frame)
        self.canvas_magnitude.get_tk_widget().grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S), padx=(0, 5), pady=(0, 5))
        
        self.canvas_phase = FigureCanvasTkAgg(self.fig_phase, plots_frame)
        self.canvas_phase.get_tk_widget().grid(row=1, column=0, sticky=(tk.W, tk.E, tk.N, tk.S), padx=(0, 5), pady=(5, 0))

    def load_jobs(self):
        """Load jobs from database and populate the combobox."""
        self.jobs = get_jobs_from_database()
        job_names = [f"{job[1]} (ID: {job[0]})" for job in self.jobs]
        self.job_combobox['values'] = job_names
        if job_names:
            self.job_combobox.current(0)
            self.on_job_selected()
            
    def refresh_jobs(self):
        """Refresh the job list from the database."""
        current_job_id = self.current_job_id
        self.load_jobs()
        
        if current_job_id:
            for i, (job_id, _) in enumerate(self.jobs):
                if job_id == current_job_id:
                    self.job_combobox.current(i)
                    self.on_job_selected()
                    break
    
    def on_job_selected(self, event=None):
        """Handle job selection."""
        selected_index = self.job_combobox.current()
        if 0 <= selected_index < len(self.jobs):
            job_id = self.jobs[selected_index][0]
            self.current_job_id = job_id
            self.load_job_data(job_id)
    
    def load_job_data(self, job_id: str):
        """Load simulation data for the selected job."""
        job_data = fetch_job_results(job_id)
        if job_data is None:
            print(f"Failed to load data for job {job_id}")
            return
            
        try:
            steps, mag_nd, phase_nd, locations = process_simulation_results_data(job_data)
            if steps is not None:
                self.steps = steps
                self.mag_nd = mag_nd
                self.phase_nd = phase_nd
                self.locations = locations
                self.num_drones = len(locations[0]) if locations and locations[0] else 0
                
                self.update_parameter_comboboxes()
                self.plot_data()
        except Exception as e:
            print(f"Error loading job data: {e}")
    
    def update_parameter_comboboxes(self):
        """Update the parameter comboboxes with available options."""
        step_values = list(range(self.steps))
        self.step_combobox['values'] = step_values
        if step_values:
            self.selected_step.set(step_values[0])
        
        drone_ids = list(range(self.num_drones))
        self.tx_combobox['values'] = drone_ids
        self.rx_combobox['values'] = drone_ids
        if drone_ids:
            self.selected_tx_id.set(drone_ids[0])
            self.selected_rx_id.set(drone_ids[0])
    
    def on_param_changed(self, event=None):
        """Handle parameter changes."""
        self.plot_data()
    
    def plot_data(self):
        """Plot the data based on selected parameters."""
        step = self.selected_step.get()
        tx_id = self.selected_tx_id.get()
        rx_id = self.selected_rx_id.get()
        
        if (self.mag_nd is None or self.phase_nd is None or self.locations is None or
            not (0 <= step < self.steps and 0 <= tx_id < self.num_drones and 0 <= rx_id < self.num_drones)):
            return
        
        for ax in [self.ax_locations, self.ax_magnitude, self.ax_phase]:
            ax.clear()
        
        cir_mag = self.mag_nd[step, tx_id, 0, rx_id, 0, 0, :]
        cir_phase = self.phase_nd[step, tx_id, 0, rx_id, 0, 0, :]
        drone_locations = self.locations[step]
        
        # Plot 1: 2D map of drone locations
        if drone_locations:
            x_coords = [loc[0] for loc in drone_locations]
            y_coords = [loc[1] for loc in drone_locations]
            
            self.ax_locations.scatter(x_coords, y_coords, c='blue', label='Drones')
            self.ax_locations.scatter(x_coords[tx_id], y_coords[tx_id], c='red', s=100, label=f'TX ({tx_id})', zorder=5)
            self.ax_locations.scatter(x_coords[rx_id], y_coords[rx_id], c='green', s=100, label=f'RX ({rx_id})', zorder=5)
            
            self.ax_locations.set_title(f'Drone Locations - Step {step}')
            self.ax_locations.set_xlabel('X Coordinate')
            self.ax_locations.set_ylabel('Y Coordinate')
            self.ax_locations.legend()
            self.ax_locations.grid(True)
            self.ax_locations.set_aspect('equal', adjustable='box')
            
        # Plot 2: Magnitude of the channel
        self.ax_magnitude.plot(cir_mag)
        self.ax_magnitude.set_title(f'Channel Magnitude (TX:{tx_id}, RX:{rx_id})')
        self.ax_magnitude.set_xlabel('Sample Index')
        self.ax_magnitude.set_ylabel('Magnitude')
        self.ax_magnitude.grid(True)
        
        # Plot 3: Phase of the channel
        self.ax_phase.plot(cir_phase)
        self.ax_phase.set_title(f'Channel Phase (TX:{tx_id}, RX:{rx_id})')
        self.ax_phase.set_xlabel('Sample Index')
        self.ax_phase.set_ylabel('Phase (radians)')
        self.ax_phase.grid(True)
        
        for fig in [self.fig_locations, self.fig_magnitude, self.fig_phase]:
            fig.tight_layout()
        
        for canvas in [self.canvas_locations, self.canvas_magnitude, self.canvas_phase]:
            canvas.draw()

    def export_data_as_numpy(self):
        """
        Handles the export button click. Prompts the user for a file location
        and saves the CIR data to a .npy file with the shape:
        [2, num_steps, num_drones, num_drones, num_samples]
        """
        if self.mag_nd is None or self.phase_nd is None:
            messagebox.showwarning("Export Error", "No simulation data loaded to export.")
            return

        file_path = filedialog.asksaveasfilename(
            defaultextension=".npy",
            filetypes=[("NumPy files", "*.npy"), ("All files", "*.*")],
            title="Save Simulation Data as NumPy Array"
        )

        if not file_path:
            # User cancelled the dialog
            return

        try:
            # Reshape the data from 7D to 4D using slicing
            # Original shape: [num_steps, num_drones, ant1, num_drones, ant2, ant3, num_samples]
            # Target shape:   [num_steps, num_drones, num_drones, num_samples]
            mag_4d = self.mag_nd[:, :, 0, :, 0, 0, :]
            phase_4d = self.phase_nd[:, :, 0, :, 0, 0, :]
            
            # Stack magnitude and phase along a new first axis
            # Final shape: [2, num_steps, num_drones, num_drones, num_samples]
            export_array = np.stack([mag_4d, phase_4d], axis=0)
            
            # Save the array to the selected file
            np.save(file_path, export_array)
            
            # Display shape information as specified in feature.md
            shape_info = f"Shape: {export_array.shape}\nShape: [2, num_steps, num_drones, num_drones, num_samples]\n2 because 1 for CIR magnitude and 1 for CIR phase"
            messagebox.showinfo("Export Successful", f"Data successfully exported to:\n{file_path}\n\n{shape_info}")
        except Exception as e:
            messagebox.showerror("Export Failed", f"An error occurred while exporting data:\n{e}")

def main():
    root = tk.Tk()
    app = SimulationViewer(root)
    root.mainloop()

if __name__ == "__main__":
    main()