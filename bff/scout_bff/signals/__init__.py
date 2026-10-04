"""Aggregate `signals`: the cross-job read, its summary and the streamed CSV export.

Routes: `GET /app/signals`, `GET /app/signals/summary`, `GET /app/signals/export.csv`
(contract §4.3, §4.4). `query.py` parses the request, `rows.py` holds the pure row
functions, `fallback.py` the bounded 20-job merge with its 30 s cache, `global_read.py`
the path through `GET /v1/signals` (B1) and `csv_export.py` the CSV columns.
"""
