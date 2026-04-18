from __future__ import annotations

from typing import Any

import httpx


async def geocode_address(q: str, limit: int) -> dict[str, Any]:
    url = "https://nominatim.openstreetmap.org/search"
    params = {"q": q, "format": "json", "limit": str(limit)}
    headers = {"User-Agent": "vrptw-dashboard/1.0"}

    async with httpx.AsyncClient(timeout=8.0) as client:
        response = await client.get(url, params=params, headers=headers)
        response.raise_for_status()
        data = response.json()

    items = [
        {
            "address": it.get("display_name", ""),
            "lat": float(it.get("lat", 0.0)),
            "lng": float(it.get("lon", 0.0)),
        }
        for it in data
    ]
    return {"items": items}
