# app/bootstrap_mitsuba.py
import os
os.environ.setdefault("MI_DEFAULT_VARIANT", "llvm_ad_mono_polarized")

import mitsuba as mi
mi.set_variant(os.environ["MI_DEFAULT_VARIANT"])

# Force Sionna RT to register its Mitsuba plugins under the active variant
import sionna.rt  # noqa: F401

from loguru import logger

fr = mi.Thread.thread().file_resolver()

def _resolver_paths(fr):
    # Mitsuba 3 exposes len()/indexing; Mitsuba 2 had .paths()
    try:
        return [str(fr[i]) for i in range(len(fr))]
    except Exception:
        pass
    if hasattr(fr, "paths"):
        val = getattr(fr, "paths")
        try:
            val = val() if callable(val) else val
            return [str(p) for p in val]
        except Exception:
            pass
    # Fallback: best-effort string
    try:
        return [str(fr)]
    except Exception:
        return []

logger.info(f"Mitsuba variant: {mi.variant()}")
logger.info(f"Mitsuba file resolver paths: {_resolver_paths(fr)}")
