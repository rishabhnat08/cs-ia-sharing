import json
from typing import Any

from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI, HTTPException, Depends
from sqlalchemy import func, inspect
from sqlalchemy.orm import Session
from sqlalchemy.exc import NoSuchTableError
from database import engine, SessionLocal, Base
import models, schemas, ai, verification

Base.metadata.create_all(bind=engine)


def _ensure_coach_columns() -> None:
    """Add new optional coach fields when older SQLite files are in use."""
    inspector = inspect(engine)
    try:
        columns = {col["name"] for col in inspector.get_columns("coaches")}
    except NoSuchTableError:
        return

    required = {
        "ai_instructions": "TEXT",
        "profile_picture": "TEXT",
    }

    missing = {name: dtype for name, dtype in required.items() if name not in columns}
    if not missing:
        return

    with engine.begin() as connection:
        for column_name, column_type in missing.items():
            connection.exec_driver_sql(
                f"ALTER TABLE coaches ADD COLUMN {column_name} {column_type}"
            )


_ensure_coach_columns()
app = FastAPI()

VALID_LEVELS = {"beginner", "intermediate", "advanced"}

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.post("/create-player")
def create_player(player_data: dict, db: Session = Depends(get_db)):
    name = player_data.get("name", "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Student name is required")

    level = (player_data.get("level") or '').strip().lower()
    if level not in VALID_LEVELS:
        raise HTTPException(status_code=400, detail="Select a valid level")

    gender = player_data.get("gender", "").strip()
    if gender not in ["Male", "Female"]:
        raise HTTPException(status_code=400, detail="Select a valid gender")

    coach_username = player_data.get("coach_username")
    if not coach_username:
        raise HTTPException(status_code=400, detail="Coach username required")

    # Get coach ID
    coach = db.query(models.Coach).filter(models.Coach.username == coach_username).first()
    if not coach:
        raise HTTPException(status_code=404, detail="Coach not found")

    # Check if player already exists for this coach
    existing = (
        db.query(models.Player)
        .filter(
            func.lower(models.Player.name) == name.lower(),
            models.Player.coach_id == coach.id
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="Student already exists")

    new_player = models.Player(
        name=name,
        age=player_data.get("age"),
        level=level,
        gender=gender,
        coach_id=coach.id
    )
    db.add(new_player)
    db.commit()
    db.refresh(new_player)
    return {"status": "Player created", "player_id": new_player.id}

@app.get("/players")
def list_players(coach_username: str = None, db: Session = Depends(get_db)):
    if not coach_username:
        raise HTTPException(status_code=400, detail="Coach username required")

    coach = db.query(models.Coach).filter(models.Coach.username == coach_username).first()
    if not coach:
        raise HTTPException(status_code=404, detail="Coach not found")

    return db.query(models.Player).filter(models.Player.coach_id == coach.id).all()

@app.post("/submit-evaluation")
def submit_evaluation(evaluation: schemas.EvaluationTextCreate, db: Session = Depends(get_db)):
    player = db.query(models.Player).filter(models.Player.id == evaluation.player_id).first()
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")

    report = ai.generate_psi_report(evaluation, player=player)
    report_payload = report.as_dict()
    scores = report_payload["scores"]
    feedback = report_payload["formatted"]

    eval_model = models.Evaluation(
        player_id=evaluation.player_id,
        session_id=evaluation.session_id,
        date=evaluation.date,
        front_court=evaluation.front_court,
        back_court=evaluation.back_court,
        attacking_play=evaluation.attacking_play,
        defensive_play=evaluation.defensive_play,
        strokeplay=evaluation.strokeplay,
        footwork=evaluation.footwork,
        presence=evaluation.presence,
        intent=evaluation.intent,
        improvements=evaluation.improvements,
        strengths=evaluation.strengths,
        comments=evaluation.comments,
        pressure_score=scores["presence"],
        skill_score=scores["skill"],
        intent_score=scores["intent"],
        psi_score=scores["psi"],
        ai_feedback=feedback,
        ai_report_json=json.dumps(report_payload)
    )

    db.add(eval_model)
    db.commit()
    db.refresh(eval_model)

    response = {
        "status": "Evaluation submitted",
        "evaluation_id": eval_model.id,
        "report": feedback,
        "psi_report": report_payload,
    }

    return response

@app.post("/generate-report")
def generate_report(request: schemas.ReportRequest, db: Session = Depends(get_db)):
    evaluation = db.query(models.Evaluation).filter(models.Evaluation.id == request.evaluation_id).first()
    if not evaluation:
        raise HTTPException(status_code=404, detail="Evaluation not found")

    player = evaluation.player if hasattr(evaluation, "player") else None
    report = ai.generate_psi_report(evaluation, player=player)
    report_payload = report.as_dict()
    feedback = report_payload["formatted"]

    evaluation.pressure_score = report_payload["scores"]["presence"]
    evaluation.skill_score = report_payload["scores"]["skill"]
    evaluation.intent_score = report_payload["scores"]["intent"]
    evaluation.psi_score = report_payload["scores"]["psi"]
    evaluation.ai_feedback = feedback
    evaluation.ai_report_json = json.dumps(report_payload)
    db.commit()
    return {"report": feedback, "psi_report": report_payload}

@app.get("/player/{player_id}/history")
def player_history(player_id: int, db: Session = Depends(get_db)):
    evaluations = (
        db.query(models.Evaluation)
        .filter(models.Evaluation.player_id == player_id)
        .order_by(models.Evaluation.date.desc())
        .all()
    )

    history: list[dict[str, Any]] = []
    for item in evaluations:
        report_payload = None
        if item.ai_report_json:
            try:
                report_payload = json.loads(item.ai_report_json)
            except json.JSONDecodeError:
                report_payload = None

        history.append(
            {
                "id": item.id,
                "session_id": item.session_id,
                "date": item.date.isoformat() if item.date else None,
                "pressure_score": item.pressure_score,
                "skill_score": item.skill_score,
                "intent_score": item.intent_score,
                "psi_score": item.psi_score,
                "ai_feedback": item.ai_feedback,
                "psi_report": report_payload,
                "player": item.player.name if item.player else None,
            }
        )

    return history

@app.post("/check-email")
def check_email(data: dict, db: Session = Depends(get_db)):
    """Check if email already exists."""
    email = data.get("email")
    existing = db.query(models.Coach).filter(models.Coach.email == email).first()
    return {"exists": existing is not None}

@app.post("/signup")
def signup(coach: schemas.CoachCreate, db: Session = Depends(get_db)):
    existing_username = db.query(models.Coach).filter(models.Coach.username == coach.username).first()
    if existing_username:
        raise HTTPException(status_code=400, detail="Username already exists")

    existing_email = db.query(models.Coach).filter(models.Coach.email == coach.email).first()
    if existing_email:
        raise HTTPException(status_code=400, detail="Email already registered")

    new_coach = models.Coach(**coach.dict())
    db.add(new_coach)
    db.commit()
    db.refresh(new_coach)
    return {"message": "Coach account created", "id": new_coach.id}

@app.post("/login")
def login(login: schemas.CoachLogin, db: Session = Depends(get_db)):
    coach = db.query(models.Coach).filter(
        models.Coach.username == login.username,
        models.Coach.password == login.password
    ).first()
    if not coach:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return {"message": "Login successful"}

@app.post("/send-verification")
def send_verification(request: schemas.SendVerificationCode):
    """Send verification code to email."""
    code = verification.generate_verification_code()
    verification.store_verification_code(request.contact, code, request.type)

    success = verification.send_email_verification(request.contact, code)

    if not success:
        raise HTTPException(status_code=500, detail="Failed to send verification code")

    return {"message": "Verification code sent", "code": code}  # Remove code in production

@app.post("/verify-code")
def verify_code_endpoint(request: schemas.VerifyCode):
    """Verify the submitted code."""
    is_valid = verification.verify_code(request.contact, request.code)

    if not is_valid:
        raise HTTPException(status_code=400, detail="Invalid or expired verification code")

    return {"message": "Verification successful"}

@app.get("/coach/{username}")
def get_coach(username: str, db: Session = Depends(get_db)):
    """Get coach profile data."""
    coach = db.query(models.Coach).filter(models.Coach.username == username).first()
    if not coach:
        raise HTTPException(status_code=404, detail="Coach not found")

    return {
        "username": coach.username,
        "email": coach.email,
        "phone": coach.phone,
        "dob": coach.dob,
        "ai_instructions": coach.ai_instructions,
        "profile_picture": coach.profile_picture
    }

@app.put("/coach/{username}/update")
def update_coach(username: str, update_data: dict, db: Session = Depends(get_db)):
    """Update coach profile details."""
    coach = db.query(models.Coach).filter(models.Coach.username == username).first()
    if not coach:
        raise HTTPException(status_code=404, detail="Coach not found")

    if "username" in update_data:
        coach.username = update_data["username"]
    if "email" in update_data:
        coach.email = update_data["email"]
    if "phone" in update_data:
        coach.phone = update_data["phone"]
    if "dob" in update_data:
        coach.dob = update_data["dob"]
    if "profile_picture" in update_data:
        coach.profile_picture = update_data["profile_picture"]

    db.commit()
    return {"message": "Profile updated successfully"}

@app.post("/coach/{username}/change-password")
def change_password(username: str, passwords: dict, db: Session = Depends(get_db)):
    """Change coach password."""
    coach = db.query(models.Coach).filter(models.Coach.username == username).first()
    if not coach:
        raise HTTPException(status_code=404, detail="Coach not found")

    if coach.password != passwords["current_password"]:
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    coach.password = passwords["new_password"]
    db.commit()
    return {"message": "Password changed successfully"}

@app.post("/coach/{username}/change-email")
def change_email(username: str, email_data: dict, db: Session = Depends(get_db)):
    """Change coach email (after verification)."""
    coach = db.query(models.Coach).filter(models.Coach.username == username).first()
    if not coach:
        raise HTTPException(status_code=404, detail="Coach not found")

    new_email = email_data["new_email"]

    # Check if email is already in use by another coach
    existing_email = db.query(models.Coach).filter(
        models.Coach.email == new_email,
        models.Coach.id != coach.id
    ).first()
    if existing_email:
        raise HTTPException(status_code=400, detail="Email already registered")

    coach.email = new_email
    db.commit()
    return {"message": "Email changed successfully"}

@app.post("/coach/{username}/ai-instructions")
def save_ai_instructions(username: str, instructions: dict, db: Session = Depends(get_db)):
    """Save AI tuning instructions."""
    coach = db.query(models.Coach).filter(models.Coach.username == username).first()
    if not coach:
        raise HTTPException(status_code=404, detail="Coach not found")

    coach.ai_instructions = instructions["instructions"]
    db.commit()
    return {"message": "AI instructions saved"}


# Video Analysis Endpoints

@app.post("/video-analysis")
def create_video_analysis(data: dict, db: Session = Depends(get_db)):
    """Create a new video analysis entry."""
    coach_username = data.get("coach_username")
    if not coach_username:
        raise HTTPException(status_code=400, detail="Coach username required")

    # Get coach
    coach = db.query(models.Coach).filter(models.Coach.username == coach_username).first()
    if not coach:
        raise HTTPException(status_code=404, detail="Coach not found")

    # Validate required fields
    session_id = data.get("session_id", "").strip()
    if not session_id:
        raise HTTPException(status_code=400, detail="Session ID is required")

    game_format = data.get("game_format", "").strip().lower()
    if game_format not in ["singles", "doubles"]:
        raise HTTPException(status_code=400, detail="Game format must be 'singles' or 'doubles'")

    event_type = data.get("event_type", "").strip().lower()
    if event_type not in ["tournament", "practice_match", "drills", "other"]:
        raise HTTPException(status_code=400, detail="Invalid event type")

    player_id = data.get("player_id")
    if not player_id:
        raise HTTPException(status_code=400, detail="Player ID is required")

    player = db.query(models.Player).filter(models.Player.id == player_id).first()
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")

    # Validate player belongs to this coach
    if player.coach_id != coach.id:
        raise HTTPException(status_code=403, detail="Player does not belong to this coach")

    player_appearance = data.get("player_appearance", "").strip()
    if not player_appearance:
        raise HTTPException(status_code=400, detail="Player appearance description is required")

    video_path = data.get("video_path", "").strip()
    if not video_path:
        raise HTTPException(status_code=400, detail="Video path is required")

    # For doubles, validate partner
    partner_id = None
    partner_appearance = None
    if game_format == "doubles":
        partner_id = data.get("partner_id")
        if not partner_id:
            raise HTTPException(status_code=400, detail="Partner ID is required for doubles")

        partner = db.query(models.Player).filter(models.Player.id == partner_id).first()
        if not partner:
            raise HTTPException(status_code=404, detail="Partner not found")

        if partner.coach_id != coach.id:
            raise HTTPException(status_code=403, detail="Partner does not belong to this coach")

        partner_appearance = data.get("partner_appearance", "").strip()
        if not partner_appearance:
            raise HTTPException(status_code=400, detail="Partner appearance description is required")

    # Create video analysis entry
    video_analysis = models.VideoAnalysis(
        coach_id=coach.id,
        session_id=session_id,
        game_format=game_format,
        event_type=event_type,
        event_type_description=data.get("event_type_description"),
        player_id=player_id,
        player_appearance=player_appearance,
        partner_id=partner_id,
        partner_appearance=partner_appearance,
        video_path=video_path
    )

    db.add(video_analysis)
    db.commit()
    db.refresh(video_analysis)

    # Generate AI analysis
    try:
        partner_obj = db.query(models.Player).filter(models.Player.id == partner_id).first() if partner_id else None
        analysis_result = ai.generate_video_analysis(video_analysis, player, partner_obj)

        # Store the analysis result
        video_analysis.ai_report_json = json.dumps(analysis_result)

        # Extract and store scores
        if isinstance(analysis_result, dict) and "scores" in analysis_result:
            scores = analysis_result["scores"]
            video_analysis.presence_score = scores.get("presence")
            video_analysis.skill_score = scores.get("skill")
            video_analysis.intent_score = scores.get("intent")
            video_analysis.psi_score = scores.get("psi")

        # Store synergy score for doubles
        if game_format == "doubles" and "team_performance" in analysis_result:
            team_perf = analysis_result["team_performance"]
            if isinstance(team_perf, dict):
                video_analysis.synergy_score = team_perf.get("synergy_score")

        db.commit()

        return {
            "status": "Video analysis created",
            "video_analysis_id": video_analysis.id,
            "analysis": analysis_result
        }
    except Exception as e:
        return {
            "status": "Video analysis created but AI processing pending",
            "video_analysis_id": video_analysis.id,
            "error": str(e)
        }


@app.get("/video-analysis")
def list_video_analyses(coach_username: str = None, db: Session = Depends(get_db)):
    """List all video analyses for a coach."""
    if not coach_username:
        raise HTTPException(status_code=400, detail="Coach username required")

    coach = db.query(models.Coach).filter(models.Coach.username == coach_username).first()
    if not coach:
        raise HTTPException(status_code=404, detail="Coach not found")

    analyses = db.query(models.VideoAnalysis).filter(models.VideoAnalysis.coach_id == coach.id).all()
    return analyses


@app.get("/video-analysis/{video_analysis_id}")
def get_video_analysis(video_analysis_id: int, db: Session = Depends(get_db)):
    """Get a specific video analysis."""
    analysis = db.query(models.VideoAnalysis).filter(models.VideoAnalysis.id == video_analysis_id).first()
    if not analysis:
        raise HTTPException(status_code=404, detail="Video analysis not found")

    return analysis


@app.get("/player/{player_id}/video-analyses")
def get_player_video_analyses(player_id: int, db: Session = Depends(get_db)):
    """Get all video analyses for a specific player (singles only)."""
    analyses = db.query(models.VideoAnalysis).filter(
        models.VideoAnalysis.player_id == player_id,
        models.VideoAnalysis.game_format == "singles"
    ).all()
    return analyses


@app.get("/team-performances")
def get_team_performances(coach_username: str = None, db: Session = Depends(get_db)):
    """Get all doubles video analyses (team performances) for a coach."""
    if not coach_username:
        raise HTTPException(status_code=400, detail="Coach username required")

    coach = db.query(models.Coach).filter(models.Coach.username == coach_username).first()
    if not coach:
        raise HTTPException(status_code=404, detail="Coach not found")

    team_analyses = db.query(models.VideoAnalysis).filter(
        models.VideoAnalysis.coach_id == coach.id,
        models.VideoAnalysis.game_format == "doubles"
    ).all()

    return team_analyses


@app.delete("/video-analysis/{video_analysis_id}")
def delete_video_analysis(video_analysis_id: int, db: Session = Depends(get_db)):
    """Delete a video analysis."""
    analysis = db.query(models.VideoAnalysis).filter(models.VideoAnalysis.id == video_analysis_id).first()
    if not analysis:
        raise HTTPException(status_code=404, detail="Video analysis not found")

    db.delete(analysis)
    db.commit()
    return {"message": "Video analysis deleted"}
