from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.logging import configure_logging
from app.routers import auth, health, teams, users


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


configure_logging()

app = FastAPI(title="api", lifespan=lifespan)
app.include_router(health.router)
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(teams.router)
