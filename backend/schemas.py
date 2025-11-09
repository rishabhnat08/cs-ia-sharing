from pydantic import BaseModel
from datetime import datetime
from typing import Optional, Literal

class PlayerCreate(BaseModel):
    name: str
    age: Optional[int] = None
    level: Literal['beginner', 'intermediate', 'advanced']
    gender: Literal['Male', 'Female']

class EvaluationTextCreate(BaseModel):
    player_id: int
    session_id: str
    date: datetime
    front_court: str
    back_court: str
    attacking_play: str
    defensive_play: str
    strokeplay: str
    footwork: str
    presence: str
    intent: str
    improvements: str
    strengths: str
    comments: str

    class Config:
        orm_mode = True

class EvaluationResponse(EvaluationTextCreate):
    id: int
    pressure_score: Optional[int]
    skill_score: Optional[int]
    intent_score: Optional[int]
    psi_score: Optional[float]
    ai_feedback: Optional[str]

    class Config:
        orm_mode = True
    
class ReportRequest(BaseModel):
    evaluation_id: int

class CoachCreate(BaseModel):
    username: str
    email: str
    phone: str
    dob: str
    password: str

class CoachLogin(BaseModel):
    username: str
    password: str

class SendVerificationCode(BaseModel):
    type: Literal['email']
    contact: str

class VerifyCode(BaseModel):
    type: Literal['email']
    contact: str
    code: str

class VideoAnalysisCreate(BaseModel):
    session_id: str
    game_format: Literal['singles', 'doubles']
    event_type: Literal['tournament', 'practice_match', 'drills', 'other']
    event_type_description: Optional[str] = None
    player_id: int
    player_appearance: str
    partner_id: Optional[int] = None
    partner_appearance: Optional[str] = None
    video_path: str

class VideoAnalysisResponse(BaseModel):
    id: int
    coach_id: int
    session_id: str
    date: datetime
    game_format: str
    event_type: str
    event_type_description: Optional[str]
    player_id: int
    player_appearance: str
    partner_id: Optional[int]
    partner_appearance: Optional[str]
    video_path: str
    ai_report_json: Optional[str]
    presence_score: Optional[int]
    skill_score: Optional[int]
    intent_score: Optional[int]
    psi_score: Optional[float]
    synergy_score: Optional[int]

    class Config:
        orm_mode = True
