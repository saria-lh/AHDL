# ===== Stage 1: Builder =====
FROM python:3.12-slim AS builder

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_INSTALL_DIR=/usr/local/bin \
    PATH=/opt/venv/bin:/usr/local/bin:$PATH

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

ENV LD_LIBRARY_PATH=/usr/local/lib/python3.12/site-packages/sionna/rt/plugins:$LD_LIBRARY_PATH
ENV MI_DEFAULT_VARIANT=llvm_ad_mono_polarized
RUN python ./add_human_material.py

# ===== Stage 2: Runtime =====
FROM python:3.12-slim

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    CUDA_VISIBLE_DEVICES="" \
    LD_LIBRARY_PATH=/usr/local/lib/python3.12/site-packages/sionna/rt/plugins:$LD_LIBRARY_PATH \
    MI_DEFAULT_VARIANT=llvm_ad_mono_polarized

# Only runtime deps: LLVM (Mitsuba JIT) + assimp (3D model loading)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libassimp-dev \
    llvm \
 && rm -rf /var/lib/apt/lists/*

COPY --from=builder /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

WORKDIR /app
COPY --from=builder /app /app

RUN mkdir -p /3d_models /app/.drjit && chmod 777 /app/.drjit

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
