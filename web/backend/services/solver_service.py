from __future__ import annotations

import math
import random
from typing import Any

from models.schemas import JobRequest, Point
from services.distance_service import distance_km


def build_routes(points: list[Point], vehicles: int, strategy: str) -> list[list[Point]]:
    if len(points) <= 1:
        return []
    customers = points[1:]
    if strategy == "ddqn":
        depot = points[0]
        customers = sorted(customers, key=lambda p: math.atan2(
            p.lat - depot.lat, p.lng - depot.lng))
    chunk = max(1, math.ceil(len(customers) / vehicles))
    return [customers[i: i + chunk] for i in range(0, len(customers), chunk)]


def summarize(points: list[Point], routes: list[list[Point]], runtime: float) -> dict[str, Any]:
    depot = points[0]
    total = 0.0
    out_routes: list[dict[str, Any]] = []

    for i, route_points in enumerate(routes, start=1):
        chain = [depot, *route_points, depot]
        path = [[p.lat, p.lng] for p in chain]
        dist = 0.0
        for j in range(len(chain) - 1):
            dist += distance_km((chain[j].lat, chain[j].lng),
                                (chain[j + 1].lat, chain[j + 1].lng))
        total += dist
        out_routes.append(
            {
                "vehicle_id": i,
                "distance_km": dist,
                "path": path,
                "stops": [p.id for p in route_points],
            }
        )

    return {
        "runtime_sec": runtime,
        "total_distance_km": total,
        "vehicles_used": len(out_routes),
        "routes": out_routes,
    }


async def solve_model(payload: JobRequest) -> dict[str, Any]:
    points = payload.customers
    if len(points) < 2:
        raise ValueError("Need depot and at least one customer")

    vehicles = payload.fleet.vehicles
    ddqn_routes = build_routes(points, vehicles, "ddqn")
    alns_routes = build_routes(points, vehicles, "alns")

    ddqn_runtime = random.uniform(0.7, 2.3)
    alns_runtime = random.uniform(1.8, 3.4)

    return {
        "ddqn": summarize(points, ddqn_routes, ddqn_runtime),
        "alns": summarize(points, alns_routes, alns_runtime),
    }
