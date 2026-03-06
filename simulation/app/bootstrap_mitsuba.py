import os
os.environ.setdefault("MI_DEFAULT_VARIANT", "llvm_ad_mono_polarized")

import mitsuba as mi
mi.set_variant(os.environ["MI_DEFAULT_VARIANT"])

import sionna.rt

from loguru import logger

fr = mi.Thread.thread().file_resolver()

def _resolver_paths(fr):
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
    try:
        return [str(fr)]
    except Exception:
        return []

logger.info(f"Mitsuba variant: {mi.variant()}")
logger.info(f"Mitsuba file resolver paths: {_resolver_paths(fr)}")
logger.info(f"Mitsuba version: {mi.__version__}")
