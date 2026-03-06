import sys
import os

os.environ['QT_QPA_PLATFORM'] = 'xcb'

import numpy as np
import trimesh

from PySide6 import QtWidgets, QtCore
from vispy import scene
from vispy.scene import visuals

T_GLTF_TO_BLEND = np.array([[1.0, 0.0, 0.0],
                            [ 0.0, 0.0,-1.0],
                            [ 0.0, 1.0, 0.0]], dtype=float)

class App(QtWidgets.QWidget):
    def __init__(self):
        super().__init__()
        self.setWindowTitle("Surface plotter")
        self.resize(1200, 800)

        self.canvas = scene.SceneCanvas(keys='interactive', bgcolor='white', size=(800, 800), show=False)
        self.view = self.canvas.central_widget.add_view()
        self.view.camera = scene.cameras.TurntableCamera(up='z', fov=45)

        self.mesh_visual = None
        self.sphere_visual = visuals.Markers()
        self.view.add(self.sphere_visual)

        self.MESH = None
        self.BOUNDS = None
        self.EXTENTS = None
        self.SPHERE_POINTS = []
        self.shape_mode = "hemisphere"
        self.points_mode = "generate"
        self.uploaded_points = None
        self.uploaded_labels = None

        self.timer = QtCore.QTimer(self)
        self.timer.setSingleShot(True)
        self.timer.setInterval(30)
        self.timer.timeout.connect(self._update_high_quality)

        self._build_ui()

    def _build_ui(self):
        layout = QtWidgets.QHBoxLayout(self)
        layout.addWidget(self.canvas.native, 1)

        controls = QtWidgets.QVBoxLayout()

        self.btn_browse = QtWidgets.QPushButton("Browse .glb")
        self.btn_browse.clicked.connect(self._browse_glb)
        self.btn_export = QtWidgets.QPushButton("Export Points")
        self.btn_export.clicked.connect(self._export_points)
        self.btn_upload_points = QtWidgets.QPushButton("Upload Points")
        self.btn_upload_points.clicked.connect(self._upload_points)
        self.btn_upload_labels = QtWidgets.QPushButton("Upload Labels")
        self.btn_upload_labels.clicked.connect(self._upload_labels)

        self.s_density = self._make_slider(3, 15, 10, "Density")
        self.s_radius  = self._make_dslider(0.01, 1.0, 0.50, 1000, "Radius")
        self.s_width   = self._make_dslider(0.01, 10.0, 1.0, 1000, "Width")
        self.s_height  = self._make_dslider(0.01, 10.0, 1.0, 1000, "Height")
        self.s_depth   = self._make_dslider(0.01, 10.0, 1.0, 1000, "Depth")
        self.s_cx      = self._make_dslider(-1.0, 1.0, 0.0, 1000, "Center X")
        self.s_cy      = self._make_dslider(-1.0, 1.0, 0.0, 1000, "Center Y")
        self.s_cz      = self._make_dslider(-1.0, 1.0, 0.0, 1000, "Center Z")

        self.radio_hemisphere = QtWidgets.QRadioButton("Hemisphere")
        self.radio_hemisphere.setChecked(True)
        self.radio_hemisphere.toggled.connect(self._on_shape_changed)
        self.radio_hemicube = QtWidgets.QRadioButton("Cube")
        self.radio_hemicube.toggled.connect(self._on_shape_changed)
        self.radio_upload = QtWidgets.QRadioButton("Upload")
        self.radio_upload.toggled.connect(self._on_shape_changed)

        shape_row = QtWidgets.QHBoxLayout()
        shape_row.addWidget(QtWidgets.QLabel("Points:"), 0)
        shape_row.addWidget(self.radio_hemisphere, 1)
        shape_row.addWidget(self.radio_hemicube, 1)
        shape_row.addWidget(self.radio_upload, 1)
        controls.addLayout(shape_row)

        self.label_density = QtWidgets.QLabel("Density")
        self.label_radius = QtWidgets.QLabel("Radius")
        self.label_width = QtWidgets.QLabel("Width")
        self.label_height = QtWidgets.QLabel("Height")
        self.label_depth = QtWidgets.QLabel("Depth")
        self.label_cx = QtWidgets.QLabel("Center X")
        self.label_cy = QtWidgets.QLabel("Center Y")
        self.label_cz = QtWidgets.QLabel("Center Z")

        self.total_points_label = QtWidgets.QLabel("Total points: 0")
        controls.addWidget(self.total_points_label)

        self.row_density = QtWidgets.QHBoxLayout()
        self.row_density.addWidget(self.label_density, 0)
        self.row_density.addWidget(self.s_density, 1)
        self.density_value_label = QtWidgets.QLabel(str(self.s_density.value()))
        self.density_value_label.setMinimumWidth(40)
        self.row_density.addWidget(self.density_value_label, 0)
        controls.addLayout(self.row_density)

        self.row_radius = QtWidgets.QHBoxLayout()
        self.row_radius.addWidget(self.label_radius, 0)
        self.row_radius.addWidget(self.s_radius, 1)
        self.radius_value_label = QtWidgets.QLabel(f"{self.s_radius.valueFromRange():.2f}")
        self.radius_value_label.setMinimumWidth(50)
        self.row_radius.addWidget(self.radius_value_label, 0)
        controls.addLayout(self.row_radius)

        self.row_width = QtWidgets.QHBoxLayout()
        self.row_width.addWidget(self.label_width, 0)
        self.row_width.addWidget(self.s_width, 1)
        self.width_value_label = QtWidgets.QLabel(f"{self.s_width.valueFromRange():.2f}")
        self.width_value_label.setMinimumWidth(50)
        self.row_width.addWidget(self.width_value_label, 0)
        controls.addLayout(self.row_width)
        
        self.row_height = QtWidgets.QHBoxLayout()
        self.row_height.addWidget(self.label_height, 0)
        self.row_height.addWidget(self.s_height, 1)
        self.height_value_label = QtWidgets.QLabel(f"{self.s_height.valueFromRange():.2f}")
        self.height_value_label.setMinimumWidth(50)
        self.row_height.addWidget(self.height_value_label, 0)
        controls.addLayout(self.row_height)

        self.row_depth = QtWidgets.QHBoxLayout()
        self.row_depth.addWidget(self.label_depth, 0)
        self.row_depth.addWidget(self.s_depth, 1)
        self.depth_value_label = QtWidgets.QLabel(f"{self.s_depth.valueFromRange():.2f}")
        self.depth_value_label.setMinimumWidth(50)
        self.row_depth.addWidget(self.depth_value_label, 0)
        controls.addLayout(self.row_depth)

        self.row_cx = QtWidgets.QHBoxLayout()
        self.row_cx.addWidget(self.label_cx, 0)
        self.row_cx.addWidget(self.s_cx, 1)
        self.cx_value_label = QtWidgets.QLabel(f"{self.s_cx.valueFromRange():.2f}")
        self.cx_value_label.setMinimumWidth(50)
        self.row_cx.addWidget(self.cx_value_label, 0)
        controls.addLayout(self.row_cx)

        self.row_cy = QtWidgets.QHBoxLayout()
        self.row_cy.addWidget(self.label_cy, 0)
        self.row_cy.addWidget(self.s_cy, 1)
        self.cy_value_label = QtWidgets.QLabel(f"{self.s_cy.valueFromRange():.2f}")
        self.cy_value_label.setMinimumWidth(50)
        self.row_cy.addWidget(self.cy_value_label, 0)
        controls.addLayout(self.row_cy)

        self.row_cz = QtWidgets.QHBoxLayout()
        self.row_cz.addWidget(self.label_cz, 0)
        self.row_cz.addWidget(self.s_cz, 1)
        self.cz_value_label = QtWidgets.QLabel(f"{self.s_cz.valueFromRange():.2f}")
        self.cz_value_label.setMinimumWidth(50)
        self.row_cz.addWidget(self.cz_value_label, 0)
        controls.addLayout(self.row_cz)

        self.row_width.itemAt(0).widget().hide()
        self.row_width.itemAt(1).widget().hide()
        self.row_width.itemAt(2).widget().hide()
        self.row_height.itemAt(0).widget().hide()
        self.row_height.itemAt(1).widget().hide()
        self.row_height.itemAt(2).widget().hide()
        self.row_depth.itemAt(0).widget().hide()
        self.row_depth.itemAt(1).widget().hide()
        self.row_depth.itemAt(2).widget().hide()

        self.row_upload = QtWidgets.QHBoxLayout()
        self.upload_info_label = QtWidgets.QLabel("No points loaded")
        self.row_upload.addWidget(self.upload_info_label, 0)
        self.row_upload.addWidget(self.btn_upload_points, 1)
        controls.addLayout(self.row_upload)
        self.upload_info_label.hide()
        self.btn_upload_points.hide()

        self.row_labels = QtWidgets.QHBoxLayout()
        self.labels_info_label = QtWidgets.QLabel("No labels loaded")
        self.row_labels.addWidget(self.labels_info_label, 0)
        self.row_labels.addWidget(self.btn_upload_labels, 1)
        controls.addLayout(self.row_labels)
        self.labels_info_label.hide()
        self.btn_upload_labels.hide()

        row_btns = QtWidgets.QHBoxLayout()
        row_btns.addWidget(self.btn_browse)
        row_btns.addWidget(self.btn_export)
        controls.addLayout(row_btns)
        controls.addStretch(1)
        layout.addLayout(controls, 0)

        for sl in [self.s_density, self.s_radius, self.s_width, self.s_height, self.s_depth, self.s_cx, self.s_cy, self.s_cz]:
            sl.sliderPressed.connect(self._on_drag_start)
            sl.sliderReleased.connect(self._on_drag_end)
            sl.valueChanged.connect(self._on_drag_update)

        self.s_density.valueChanged.connect(self._update_density_label)
        self.s_radius.valueChanged.connect(self._update_slider_labels)
        self.s_width.valueChanged.connect(self._update_slider_labels)
        self.s_height.valueChanged.connect(self._update_slider_labels)
        self.s_depth.valueChanged.connect(self._update_slider_labels)
        self.s_cx.valueChanged.connect(self._update_slider_labels)
        self.s_cy.valueChanged.connect(self._update_slider_labels)
        self.s_cz.valueChanged.connect(self._update_slider_labels)
    
    def _update_density_label(self, value):
        self.density_value_label.setText(str(value))
    
    def _update_slider_labels(self):
        self.radius_value_label.setText(f"{self.s_radius.valueFromRange():.2f}")
        self.width_value_label.setText(f"{self.s_width.valueFromRange():.2f}")
        self.height_value_label.setText(f"{self.s_height.valueFromRange():.2f}")
        self.depth_value_label.setText(f"{self.s_depth.valueFromRange():.2f}")
        self.cx_value_label.setText(f"{self.s_cx.valueFromRange():.2f}")
        self.cy_value_label.setText(f"{self.s_cy.valueFromRange():.2f}")
        self.cz_value_label.setText(f"{self.s_cz.valueFromRange():.2f}")

    def _make_slider(self, mn, mx, val, tooltip):
        s = QtWidgets.QSlider(QtCore.Qt.Horizontal)
        s.setMinimum(mn); s.setMaximum(mx); s.setValue(val)
        s.setToolTip(tooltip)
        return s

    def _make_dslider(self, mn, mx, val, steps, tooltip):
        s = QtWidgets.QSlider(QtCore.Qt.Horizontal)
        s.setMinimum(0); s.setMaximum(steps)
        s.setValue(int((val - mn) / (mx - mn) * steps))
        s._mn = mn; s._mx = mx; s._steps = steps
        s.valueFromRange = lambda: s._mn + (s.value()/s._steps)*(s._mx - s._mn)
        s.setToolTip(tooltip)
        return s

    def _browse_glb(self):
        path, _ = QtWidgets.QFileDialog.getOpenFileName(self, "Open GLB", "", "glTF Binary (*.glb)")
        if not path: return
        self._load_glb(path)
        self._reset_sliders_to_bounds()
        self._update_low_quality()
        self._update_high_quality()

    def _export_points(self):
        if not self.SPHERE_POINTS:
            QtWidgets.QMessageBox.information(self, "Export", "No points to export.")
            return
        path, _ = QtWidgets.QFileDialog.getSaveFileName(self, "Save NPY", "hemisphere_points.npy", "NumPy (*.npy)")
        if not path: return
        points_array = np.array(self.SPHERE_POINTS)
        np.save(path, points_array)

    def _upload_points(self):
        path, _ = QtWidgets.QFileDialog.getOpenFileName(
            self, "Open Points File", "", 
            "NumPy Files (*.npy);;JSON Files (*.json);;All Files (*)"
        )
        if not path:
            return
        
        try:
            if path.endswith('.npy'):
                points = np.load(path)
            elif path.endswith('.json'):
                import json
                with open(path, 'r') as f:
                    data = json.load(f)
                points = np.array(data)
            else:
                try:
                    points = np.load(path)
                except Exception:
                    import json
                    with open(path, 'r') as f:
                        data = json.load(f)
                    points = np.array(data)

            if points.ndim != 2 or points.shape[1] != 3:
                QtWidgets.QMessageBox.critical(
                    self, "Error", 
                    f"Invalid points shape: {points.shape}. Expected (N, 3)."
                )
                return
            
            self.uploaded_points = points.astype(np.float32)
            self.upload_info_label.setText(f"{len(points)} points loaded")
            self.uploaded_labels = None
            self.labels_info_label.setText("No labels loaded")
            self._display_uploaded_points()
            
        except Exception as e:
            QtWidgets.QMessageBox.critical(self, "Error", f"Failed to load points: {str(e)}")

    def _upload_labels(self):
        if self.uploaded_points is None:
            QtWidgets.QMessageBox.warning(self, "Warning", "Please upload points first.")
            return
        
        path, _ = QtWidgets.QFileDialog.getOpenFileName(
            self, "Open Labels File", "", 
            "NumPy Files (*.npy);;JSON Files (*.json);;All Files (*)"
        )
        if not path:
            return
        
        try:
            if path.endswith('.npy'):
                labels = np.load(path)
            elif path.endswith('.json'):
                import json
                with open(path, 'r') as f:
                    data = json.load(f)
                labels = np.array(data)
            else:
                try:
                    labels = np.load(path)
                except Exception:
                    import json
                    with open(path, 'r') as f:
                        data = json.load(f)
                    labels = np.array(data)
            
            labels = labels.flatten().astype(int)
            
            if len(labels) != len(self.uploaded_points):
                QtWidgets.QMessageBox.critical(
                    self, "Error", 
                    f"Labels length ({len(labels)}) must match points length ({len(self.uploaded_points)})."
                )
                return
            
            if not np.all((labels == 0) | (labels == 1)):
                QtWidgets.QMessageBox.warning(
                    self, "Warning", 
                    "Labels should be 0 or 1. Non-zero values will be treated as 1."
                )
                labels = (labels != 0).astype(int)
            
            self.uploaded_labels = labels
            num_red = np.sum(labels == 1)
            self.labels_info_label.setText(f"{num_red}/{len(labels)} labeled as red")
            self._display_uploaded_points()
            
        except Exception as e:
            QtWidgets.QMessageBox.critical(self, "Error", f"Failed to load labels: {str(e)}")

    def _display_uploaded_points(self):
        if self.uploaded_points is None or self.MESH is None:
            return
        
        P = self.uploaded_points
        self.SPHERE_POINTS = P.astype(float).tolist()
        self.total_points_label.setText(f"Total points: {len(self.SPHERE_POINTS)}")
        
        if self.sphere_visual.parent is None:
            self.view.add(self.sphere_visual)
        
        if self.uploaded_labels is not None:
            colors = np.zeros((len(P), 4), dtype=np.float32)
            colors[:, 3] = 1.0
            colors[self.uploaded_labels == 0] = [0.0, 0.0, 0.0, 1.0]
            colors[self.uploaded_labels == 1] = [1.0, 0.0, 0.0, 1.0]
            self.sphere_visual.set_data(P, face_color=colors, size=3.0, edge_width=0.0, symbol='disc')
        else:
            self.sphere_visual.set_data(P, face_color='black', size=3.0, edge_width=0.0, symbol='disc')
        
        p_min = P.min(axis=0)
        p_max = P.max(axis=0)
        p_center = (p_min + p_max) / 2
        p_extent = (p_max - p_min).max() / 2
        
        mins = np.minimum(self.BOUNDS[0], p_min)
        maxs = np.maximum(self.BOUNDS[1], p_max)
        c = (mins + maxs) / 2.0
        half = float(np.max(maxs - mins) / 2.0)
        xr = (c[0]-half, c[0]+half)
        yr = (c[1]-half, c[1]+half)
        zr = (c[2]-half, c[2]+half)
        
        self._apply_camera_equal(xr, yr, zr)
        self.canvas.update()

    def _load_glb(self, path):
        obj = trimesh.load(path, force='scene')
        if isinstance(obj, trimesh.Scene):
            meshes = []
            for name, geom in obj.geometry.items():
                meshes.append(geom)
            if meshes:
                mesh = trimesh.util.concatenate(meshes)
            else:
                mesh = None
        elif isinstance(obj, trimesh.Trimesh):
            mesh = obj
        elif isinstance(obj, (list, tuple)):
            mesh = trimesh.util.concatenate(obj)
        else:
            mesh = None
        if mesh is None:
            QtWidgets.QMessageBox.critical(self, "Error", "Invalid GLB")
            return
        m = mesh.copy()
        m.vertices = (m.vertices @ T_GLTF_TO_BLEND.T)
        self.MESH = m
        self.BOUNDS = self.MESH.bounds
        self.EXTENTS = self.MESH.extents

        if self.mesh_visual is not None:
            self.mesh_visual.parent = None
            self.mesh_visual = None
        
        vertex_colors = None
        face_colors = None
        color = (0.85, 0.85, 0.85, 1.0)
        shading = 'smooth'
        
        visual = self.MESH.visual
        
        if hasattr(visual, 'kind') and visual.kind == 'texture':
            try:
                vertex_colors = visual.to_color().vertex_colors
                if vertex_colors is not None:
                    if vertex_colors.max() > 1.0:
                        vertex_colors = vertex_colors.astype(np.float32) / 255.0
            except Exception:
                pass
        
        if vertex_colors is None and hasattr(visual, 'vertex_colors') and visual.vertex_colors is not None:
            vertex_colors = visual.vertex_colors
            if vertex_colors.max() > 1.0:
                vertex_colors = vertex_colors.astype(np.float32) / 255.0
        
        if vertex_colors is None and hasattr(visual, 'face_colors') and visual.face_colors is not None:
            face_colors = visual.face_colors
            if face_colors.max() > 1.0:
                face_colors = face_colors.astype(np.float32) / 255.0
        
        if vertex_colors is None and face_colors is None:
            if hasattr(visual, 'material'):
                material = visual.material
                if hasattr(material, 'baseColorFactor') and material.baseColorFactor is not None:
                    bc = material.baseColorFactor
                    if len(bc) == 3:
                        color = (*bc, 1.0)
                    else:
                        color = tuple(bc)
                elif hasattr(material, 'main_color') and material.main_color is not None:
                    mc = material.main_color
                    if np.max(mc) > 1.0:
                        mc = np.array(mc, dtype=np.float32) / 255.0
                    color = tuple(mc)
                elif hasattr(material, 'diffuse') and material.diffuse is not None:
                    dc = material.diffuse
                    if np.max(dc) > 1.0:
                        dc = np.array(dc, dtype=np.float32) / 255.0
                    if len(dc) == 3:
                        color = (*dc, 1.0)
                    else:
                        color = tuple(dc)
        
        if vertex_colors is not None:
            self.mesh_visual = visuals.Mesh(
                vertices=self.MESH.vertices,
                faces=self.MESH.faces,
                vertex_colors=vertex_colors,
                shading=shading
            )
        elif face_colors is not None:
            self.mesh_visual = visuals.Mesh(
                vertices=self.MESH.vertices,
                faces=self.MESH.faces,
                face_colors=face_colors,
                shading=shading
            )
        else:
            self.mesh_visual = visuals.Mesh(
                vertices=self.MESH.vertices,
                faces=self.MESH.faces,
                color=color,
                shading=shading
            )
        self.view.add(self.mesh_visual)

    def _reset_sliders_to_bounds(self):
        if self.BOUNDS is None: return
        center = (self.BOUNDS[0] + self.BOUNDS[1]) / 2.0
        extent = float(np.max(self.EXTENTS))
        span = extent * 2.0 + 1.0
        for s, c in [(self.s_cx, center[0]), (self.s_cy, center[1]), (self.s_cz, center[2])]:
            s._mn = float(c - span/2); s._mx = float(c + span/2)
            s.setValue(int((c - s._mn)/(s._mx - s._mn) * s._steps))
        
        if self.shape_mode == "hemisphere":
            r = extent * 0.6
            self.s_radius._mn = 0.01; self.s_radius._mx = max(0.02, extent * 3.0)
            self.s_radius.setValue(int((r - self.s_radius._mn)/(self.s_radius._mx - self.s_radius._mn) * self.s_radius._steps))
        else:
            dim = min(extent * 2.4, 10.0)
            for s in [self.s_width, self.s_height, self.s_depth]:
                s._mn = 0.01; s._mx = 10.0
                s.setValue(int((dim - s._mn)/(s._mx - s._mn) * s._steps))
        
        self._update_slider_labels()

    def _sphere_grid(self, cx, cy, cz, r, d):
        u = np.linspace(0, 2*np.pi, int(d), dtype=np.float32)
        v = np.linspace(0, np.pi/2, max(2, int(d)//2), dtype=np.float32)
        cu, su = np.cos(u), np.sin(u)
        sv, cv = np.sin(v), np.cos(v)
        X = cx + r * np.outer(cu, sv)
        Y = cy + r * np.outer(su, sv)
        Z = cz + r * np.outer(np.ones_like(u), cv)
        return X, Y, Z
        
    def _hemisphere_cube_grid(self, cx, cy, cz, width, height, depth, d):
        points = []
        
        n = max(2, int(d))
        
        half_width = width / 2
        half_height = height / 2
        half_depth = depth / 2
        
        for i in range(n):
            for j in range(n):
                x = cx - half_width + width*i/(n-1)
                y = cy - half_height + height*j/(n-1)
                z = cz + half_depth
                points.append([x, y, z])
        
        for i in range(n):
            for j in range(n):
                x = cx - half_width + width*i/(n-1)
                y = cy + half_height
                z = cz + half_depth*j/(n-1)
                points.append([x, y, z])
        
        for i in range(n):
            for j in range(n):
                x = cx - half_width + width*i/(n-1)
                y = cy - half_height
                z = cz + half_depth*j/(n-1)
                points.append([x, y, z])
        
        for i in range(n):
            for j in range(n):
                x = cx + half_width
                y = cy - half_height + height*i/(n-1)
                z = cz + half_depth*j/(n-1)
                points.append([x, y, z])
        
        for i in range(n):
            for j in range(n):
                x = cx - half_width
                y = cy - half_height + height*i/(n-1)
                z = cz + half_depth*j/(n-1)
                points.append([x, y, z])
        
        return np.array(points, dtype=np.float32)
    
    def _hide_all_sliders(self):
        self.row_density.itemAt(0).widget().hide()
        self.row_density.itemAt(1).widget().hide()
        self.row_density.itemAt(2).widget().hide()
        self.row_radius.itemAt(0).widget().hide()
        self.row_radius.itemAt(1).widget().hide()
        self.row_radius.itemAt(2).widget().hide()
        self.row_width.itemAt(0).widget().hide()
        self.row_width.itemAt(1).widget().hide()
        self.row_width.itemAt(2).widget().hide()
        self.row_height.itemAt(0).widget().hide()
        self.row_height.itemAt(1).widget().hide()
        self.row_height.itemAt(2).widget().hide()
        self.row_depth.itemAt(0).widget().hide()
        self.row_depth.itemAt(1).widget().hide()
        self.row_depth.itemAt(2).widget().hide()
        self.row_cx.itemAt(0).widget().hide()
        self.row_cx.itemAt(1).widget().hide()
        self.row_cx.itemAt(2).widget().hide()
        self.row_cy.itemAt(0).widget().hide()
        self.row_cy.itemAt(1).widget().hide()
        self.row_cy.itemAt(2).widget().hide()
        self.row_cz.itemAt(0).widget().hide()
        self.row_cz.itemAt(1).widget().hide()
        self.row_cz.itemAt(2).widget().hide()
    
    def _show_common_sliders(self):
        self.row_density.itemAt(0).widget().show()
        self.row_density.itemAt(1).widget().show()
        self.row_density.itemAt(2).widget().show()
        self.row_cx.itemAt(0).widget().show()
        self.row_cx.itemAt(1).widget().show()
        self.row_cx.itemAt(2).widget().show()
        self.row_cy.itemAt(0).widget().show()
        self.row_cy.itemAt(1).widget().show()
        self.row_cy.itemAt(2).widget().show()
        self.row_cz.itemAt(0).widget().show()
        self.row_cz.itemAt(1).widget().show()
        self.row_cz.itemAt(2).widget().show()
        
    def _on_shape_changed(self):
        self.upload_info_label.hide()
        self.btn_upload_points.hide()
        self.labels_info_label.hide()
        self.btn_upload_labels.hide()
        
        if self.radio_upload.isChecked():
            self.points_mode = "upload"
            self.shape_mode = "upload"
            self._hide_all_sliders()
            self.upload_info_label.show()
            self.btn_upload_points.show()
            self.labels_info_label.show()
            self.btn_upload_labels.show()
            if self.uploaded_points is not None:
                self._display_uploaded_points()
            return
        
        self.points_mode = "generate"
        self._show_common_sliders()
        
        if self.radio_hemisphere.isChecked():
            self.shape_mode = "hemisphere"
            self.row_radius.itemAt(0).widget().show()
            self.row_radius.itemAt(1).widget().show()
            self.row_radius.itemAt(2).widget().show()
            self.row_width.itemAt(0).widget().hide()
            self.row_width.itemAt(1).widget().hide()
            self.row_width.itemAt(2).widget().hide()
            self.row_height.itemAt(0).widget().hide()
            self.row_height.itemAt(1).widget().hide()
            self.row_height.itemAt(2).widget().hide()
            self.row_depth.itemAt(0).widget().hide()
            self.row_depth.itemAt(1).widget().hide()
            self.row_depth.itemAt(2).widget().hide()
        elif self.radio_hemicube.isChecked():
            self.shape_mode = "hemisphere_cube"
            self.row_radius.itemAt(0).widget().hide()
            self.row_radius.itemAt(1).widget().hide()
            self.row_radius.itemAt(2).widget().hide()
            self.row_width.itemAt(0).widget().show()
            self.row_width.itemAt(1).widget().show()
            self.row_width.itemAt(2).widget().show()
            self.row_height.itemAt(0).widget().show()
            self.row_height.itemAt(1).widget().show()
            self.row_height.itemAt(2).widget().show()
            self.row_depth.itemAt(0).widget().show()
            self.row_depth.itemAt(1).widget().show()
            self.row_depth.itemAt(2).widget().show()
            if self.EXTENTS is not None:
                extent = float(np.max(self.EXTENTS))
                dim = min(extent * 2.4, 10.0)
                for s in [self.s_width, self.s_height, self.s_depth]:
                    s._mn = 0.01
                    s._mx = 10.0
                    s.setValue(int((dim - s._mn) / (s._mx - s._mn) * s._steps))
        
        self._update_slider_labels()
        self._update_low_quality()
        self._update_high_quality()

    def _bounds_union(self, cx, cy, cz, r):
        b0 = np.array([cx - r, cy - r, cz - r], dtype=np.float32)
        b1 = np.array([cx + r, cy + r, cz + r], dtype=np.float32)
        mins = np.minimum(self.BOUNDS[0], b0)
        maxs = np.maximum(self.BOUNDS[1], b1)
        c = (mins + maxs) / 2.0
        half = float(np.max(maxs - mins) / 2.0)
        return (c[0]-half, c[0]+half), (c[1]-half, c[1]+half), (c[2]-half, c[2]+half)

    def _apply_camera_equal(self, xr, yr, zr):
        self.view.camera.set_range(x=xr, y=yr, z=zr)

    def _update_low_quality(self):
        if self.MESH is None: return
        if self.points_mode == "upload":
            return
        
        d = max(8, int(self.s_density.value()) // 4)
        cx = self.s_cx.valueFromRange()
        cy = self.s_cy.valueFromRange()
        cz = self.s_cz.valueFromRange()
        
        if self.shape_mode == "hemisphere":
            r = self.s_radius.valueFromRange()
            X, Y, Z = self._sphere_grid(cx, cy, cz, r, d)
            points = []
            for i in range(X.shape[1]):
                for j in range(X.shape[0]):
                    points.append([X[j, i], Y[j, i], Z[j, i]])
            P = np.array(points, dtype=np.float32)
            bound_r = r
        else:
            width = self.s_width.valueFromRange()
            height = self.s_height.valueFromRange()
            depth = self.s_depth.valueFromRange()
            P = self._hemisphere_cube_grid(cx, cy, cz, width, height, depth, d)
            bound_r = max(width, height, depth) / 2
        
        if self.sphere_visual.parent is None:
            self.view.add(self.sphere_visual)
        self.sphere_visual.set_data(P, face_color='black', size=3.0, edge_width=0.0, symbol='disc')
        xr, yr, zr = self._bounds_union(cx, cy, cz, bound_r)
        self._apply_camera_equal(xr, yr, zr)
        self.canvas.update()

    def _update_high_quality(self):
        if self.MESH is None: return
        if self.points_mode == "upload":
            return
        
        d = int(self.s_density.value())
        cx = self.s_cx.valueFromRange()
        cy = self.s_cy.valueFromRange()
        cz = self.s_cz.valueFromRange()
        
        if self.shape_mode == "hemisphere":
            r = self.s_radius.valueFromRange()
            X, Y, Z = self._sphere_grid(cx, cy, cz, r, d)
            points = []
            for i in range(X.shape[1]):
                for j in range(X.shape[0]):
                    points.append([X[j, i], Y[j, i], Z[j, i]])
            P = np.array(points, dtype=np.float32)
            bound_r = r
        else:
            width = self.s_width.valueFromRange()
            height = self.s_height.valueFromRange()
            depth = self.s_depth.valueFromRange()
            P = self._hemisphere_cube_grid(cx, cy, cz, width, height, depth, d)
            bound_r = max(width, height, depth) / 2
        
        self.sphere_visual.set_data(P, face_color='black', size=3.0, edge_width=0.0, symbol='disc')
        self.SPHERE_POINTS = P.astype(float).tolist()
        self.total_points_label.setText(f"Total points: {len(self.SPHERE_POINTS)}")
        xr, yr, zr = self._bounds_union(cx, cy, cz, bound_r)
        self._apply_camera_equal(xr, yr, zr)
        self.canvas.update()

    def _on_drag_start(self):
        self.timer.stop()
        self._update_low_quality()

    def _on_drag_update(self, _):
        if self.timer.isActive(): return
        self._update_low_quality()

    def _on_drag_end(self):
        self.timer.stop()
        self._update_high_quality()

if __name__ == "__main__":
    app = QtWidgets.QApplication(sys.argv)
    w = App()
    w.show()
    sys.exit(app.exec())
