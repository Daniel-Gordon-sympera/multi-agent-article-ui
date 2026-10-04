"""Aggregate `overview`: the dashboard tiles and active runs (B4).

Routes: GET /app/overview, GET /app/overview/active-runs. The package also hosts the
small helpers the sibling B4 aggregates (`attention`, `system`) reuse: a TTL cache
(`cache.py`) and the bounded pipeline reads (`pipeline_reads.py`).
"""
