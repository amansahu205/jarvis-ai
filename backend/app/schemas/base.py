from pydantic import BaseModel
from typing import Generic, TypeVar, List

T = TypeVar('T')

class SuccessResponse(BaseModel, Generic[T]):
    success: bool = True
    data: T

class PaginatedResponse(BaseModel, Generic[T]):
    success: bool = True
    data: List[T]
    meta: dict

class ErrorResponse(BaseModel):
    success: bool = False
    error: str
    code: str
