from fastapi import APIRouter
from app.api.v1.auth import router as auth_router
from app.api.v1.module1_intelligence import router as m1_router
from app.api.v1.module2_decision import router as m2_router
from app.api.v1.module3_monitoring import router as m3_router

api_router = APIRouter(prefix="/v1")
api_router.include_router(auth_router)
api_router.include_router(m1_router)
api_router.include_router(m2_router)
api_router.include_router(m3_router)
