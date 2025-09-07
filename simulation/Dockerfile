# Use the official python base (you can switch to dekstop/debian if you prefer)
FROM python:3.12-slim

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_INSTALL_DIR=/usr/local/bin \
    PATH=/opt/venv/bin:/usr/local/bin:$PATH \
    CUDA_VISIBLE_DEVICES=""


ENV LD_LIBRARY_PATH=/usr/local/lib/python3.12/site-packages/sionna/rt/plugins:$LD_LIBRARY_PATH
ENV MI_DEFAULT_VARIANT=llvm_ad_mono_polarized


RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl ca-certificates wget gnupg lsb-release \
    libassimp-dev assimp-utils \
    llvm \
 && rm -rf /var/lib/apt/lists/*

RUN curl -LsSf https://astral.sh/uv/install.sh \
  | env UV_INSTALL_DIR="/usr/local/bin" UV_UNMANAGED_INSTALL=1 sh

WORKDIR /app
COPY requirements.txt /app/

RUN uv pip install --system --no-cache-dir -r /app/requirements.txt

COPY . .
# Run any project-specific Python prep step
COPY add_human_material.py ./add_human_material.py
RUN python ./add_human_material.py

# Create directory for 3D models and expose
RUN mkdir -p /3d_models

EXPOSE 8000
# Use the venv python/uvicorn on PATH (PATH was set above to include /opt/venv/bin)
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
