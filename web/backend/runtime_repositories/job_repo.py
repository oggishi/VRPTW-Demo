from __future__ import annotations

import asyncio

from models.schemas import JobState


class JobRepository:
    def __init__(self) -> None:
        self.jobs: dict[str, JobState] = {}
        self.queue: asyncio.Queue[str] = asyncio.Queue()

    def save(self, job_id: str, state: JobState) -> None:
        self.jobs[job_id] = state

    def get(self, job_id: str) -> JobState | None:
        return self.jobs.get(job_id)


job_repo = JobRepository()
