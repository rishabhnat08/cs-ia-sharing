from sqlalchemy import Column, Integer, String, ForeignKey, Text, DateTime, Float
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base


class Player(Base):
    __tablename__ = "players"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    age = Column(Integer)
    level = Column(String, nullable=False)
    gender = Column(String, nullable=False)
    coach_id = Column(Integer, ForeignKey("coaches.id"), nullable=False)

    evaluations = relationship("Evaluation", back_populates="player")
    coach = relationship("Coach", back_populates="players")
    video_analyses = relationship("VideoAnalysis", foreign_keys="[VideoAnalysis.player_id]", back_populates="player")
    video_analyses_partner = relationship("VideoAnalysis", foreign_keys="[VideoAnalysis.partner_id]", back_populates="partner")

class Evaluation(Base):
    __tablename__ = "evaluations"
    id = Column(Integer, primary_key=True, index=True)
    player_id = Column(Integer, ForeignKey("players.id"))
    session_id = Column(String, nullable=False)
    date = Column(DateTime, default=datetime.utcnow)

    front_court = Column(Text)
    back_court = Column(Text)
    attacking_play = Column(Text)
    defensive_play = Column(Text)
    strokeplay = Column(Text)
    footwork = Column(Text)
    presence = Column(Text)
    intent = Column(Text)
    improvements = Column(Text)
    strengths = Column(Text)
    comments = Column(Text)

    pressure_score = Column(Integer)
    skill_score = Column(Integer)
    intent_score = Column(Integer)
    psi_score = Column(Float)
    ai_feedback = Column(Text, nullable=True)
    ai_report_json = Column(Text, nullable=True)

    player = relationship("Player", back_populates="evaluations")

class Coach(Base):
    __tablename__ = "coaches"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    email = Column(String, unique=True)
    phone = Column(String)
    dob = Column(String)
    password = Column(String)
    ai_instructions = Column(Text, nullable=True)
    profile_picture = Column(Text, nullable=True)

    players = relationship("Player", back_populates="coach")
    video_analyses = relationship("VideoAnalysis", back_populates="coach")

class VideoAnalysis(Base):
    __tablename__ = "video_analyses"

    id = Column(Integer, primary_key=True, index=True)
    coach_id = Column(Integer, ForeignKey("coaches.id"), nullable=False)
    session_id = Column(String, nullable=False)
    date = Column(DateTime, default=datetime.utcnow)

    # Game format
    game_format = Column(String, nullable=False)  # 'singles' or 'doubles'
    event_type = Column(String, nullable=False)  # 'tournament', 'practice_match', 'drills', 'other'
    event_type_description = Column(Text, nullable=True)  # Only if event_type is 'other'

    # Player information
    player_id = Column(Integer, ForeignKey("players.id"), nullable=False)
    player_appearance = Column(Text, nullable=False)  # One sentence description

    # Partner information (for doubles only)
    partner_id = Column(Integer, ForeignKey("players.id"), nullable=True)
    partner_appearance = Column(Text, nullable=True)  # One sentence description

    # Video file path or URL
    video_path = Column(Text, nullable=False)

    # AI Analysis Results
    ai_report_json = Column(Text, nullable=True)  # Full JSON report

    # PSI Scores (same as evaluation)
    presence_score = Column(Integer, nullable=True)
    skill_score = Column(Integer, nullable=True)
    intent_score = Column(Integer, nullable=True)
    psi_score = Column(Float, nullable=True)

    # Doubles-specific score
    synergy_score = Column(Integer, nullable=True)  # Only for doubles, out of 10

    # Relationships
    coach = relationship("Coach", back_populates="video_analyses")
    player = relationship("Player", foreign_keys=[player_id], back_populates="video_analyses")
    partner = relationship("Player", foreign_keys=[partner_id], back_populates="video_analyses_partner")
