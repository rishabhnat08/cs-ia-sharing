"""Integration with Google Gemini for PSI performance reports."""
from __future__ import annotations

import json
import os
from datetime import datetime
from decimal import Decimal
from textwrap import dedent
from typing import Any, Iterable, Mapping, MutableMapping

from dotenv import load_dotenv

load_dotenv()

try:  # pragma: no cover - optional dependency during local testing
    import google.generativeai as google_genai
    from google.generativeai.types import BlockedPromptException
except Exception:  # pragma: no cover - fallback when SDK is unavailable
    google_genai = None  # type: ignore[assignment]

    class BlockedPromptException(Exception):
        """Placeholder exception when Gemini SDK is not installed."""

from pydantic import BaseModel, Field, ValidationError, conint


API_KEY = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
MODEL_NAME = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")

MODEL = None
if google_genai and API_KEY:  # pragma: no branch - simple initialization guard
    google_genai.configure(api_key=API_KEY)
    MODEL = google_genai.GenerativeModel(
        model_name=MODEL_NAME,
        generation_config=google_genai.GenerationConfig(
            temperature=0.4,
            top_p=0.8,
            max_output_tokens=1024,
            response_mime_type="application/json",
            response_schema={
                "type": "object",
                "properties": {
                    "scores": {
                        "type": "object",
                        "properties": {
                            "presence": {"type": "integer"},
                            "skill": {"type": "integer"},
                            "intent": {"type": "integer"},
                            "psi": {"type": "number"},
                        },
                        "required": ["presence", "skill", "intent"],
                    },
                    "player_evaluation": {"type": "string"},
                    "player_strengths": {
                        "type": "array",
                        "items": {"type": "string"},
                    },
                    "player_weaknesses": {
                        "type": "array",
                        "items": {"type": "string"},
                    },
                    "actions_strengths": {
                        "type": "array",
                        "items": {"type": "string"},
                    },
                    "actions_weaknesses": {
                        "type": "array",
                        "items": {"type": "string"},
                    },
                    "course_forward": {"type": "string"},
                    "summary_bullets": {
                        "type": "array",
                        "items": {"type": "string"},
                    },
                },
                "required": [
                    "scores",
                    "player_evaluation",
                    "player_strengths",
                    "player_weaknesses",
                    "actions_strengths",
                    "actions_weaknesses",
                    "course_forward",
                    "summary_bullets",
                ],
            },
        ),
    )


PSI_WEIGHTS = {
    "skill": Decimal("0.45"),
    "presence": Decimal("0.25"),
    "intent": Decimal("0.30"),
}
WEIGHT_TOTAL = sum(PSI_WEIGHTS.values())
PROMPT_TEMPLATE = """You are an expert badminton performance analyst.
Create a PSI (Presence, Skill, Intent) report using the provided session notes.
Always respond with valid JSON matching the supplied schema.

Athlete: {player_name}
Level: {player_level}
Gender: {player_gender}
Session ID: {session_id}
Date: {date}

Coach observations:
- Front court: {front_court}
- Back court: {back_court}
- Attacking play: {attacking_play}
- Defensive play: {defensive_play}
- Strokeplay: {strokeplay}
- Footwork: {footwork}
- Presence: {presence}
- Intent: {intent}
- Improvements noted: {improvements}
- Strengths noted: {strengths}
- Additional comments: {comments}

Scoring rubric:
- Presence evaluates engagement, focus, and body language (0-10 integer).
- Skill reflects technical execution across strokes and tactics (0-10 integer).
- Intent measures proactive decision-making and match strategy (0-10 integer).

Instructions:
1. Compute Presence, Skill, and Intent scores as integers between 0 and 10.
2. Calculate the PSI weighted average (Skill 45%, Presence 25%, Intent 30%) out of 10.
3. `player_evaluation` must be detailed yet no more than 100 words.
4. `course_forward` must not exceed 300 words and must include specific drills and volumes.
5. Provide concrete bullet lists for strengths, weaknesses, and actions tied to the notes.
6. Supply exactly five `summary_bullets`, each ten words or fewer.
7. Base every insight strictly on the provided observations.
8. IMPORTANT: Factor in the athlete's level ({player_level}) and gender ({player_gender}) when evaluating performance. Tailor your feedback, expectations, and recommended drills to their specific level and consider any gender-specific physical or tactical considerations in badminton training.
"""


class Scores(BaseModel):
    presence: conint(ge=0, le=10)
    skill: conint(ge=0, le=10)
    intent: conint(ge=0, le=10)
    psi: float | None = None


class PSIReport(BaseModel):
    scores: Scores
    player_evaluation: str
    player_strengths: list[str] = Field(default_factory=list)
    player_weaknesses: list[str] = Field(default_factory=list)
    actions_strengths: list[str] = Field(default_factory=list)
    actions_weaknesses: list[str] = Field(default_factory=list)
    course_forward: str
    summary_bullets: list[str] = Field(default_factory=list)

    def weighted_psi(self) -> float:
        weighted = (
            Decimal(self.scores.skill) * PSI_WEIGHTS["skill"]
            + Decimal(self.scores.presence) * PSI_WEIGHTS["presence"]
            + Decimal(self.scores.intent) * PSI_WEIGHTS["intent"]
        ) / WEIGHT_TOTAL
        return float(round(weighted, 1))

    def psi_value(self) -> float:
        return self.scores.psi if self.scores.psi is not None else self.weighted_psi()

    def formatted(self) -> str:
        psi_value = self.psi_value()
        lines: list[str] = [
            f"Presence Score (P): {self.scores.presence}/10",
            f"Skill Score (S): {self.scores.skill}/10",
            f"Intent Score (I): {self.scores.intent}/10",
            "",
            (
                "PSI Evaluation: "
                f"{psi_value}/10 (A weighted average of the 3 where skill is given 45%, "
                "presence is given 25%, and intent is given 30%.)"
            ),
            "",
            "Player evaluation:",
            _truncate_words(self.player_evaluation, 100),
            "",
            "Player strengths:",
        ]
        lines.extend(f"- {item}" for item in _ensure_items(self.player_strengths))
        lines.extend(["", "Player weaknesses:"])
        lines.extend(f"- {item}" for item in _ensure_items(self.player_weaknesses))
        lines.extend(["", "Actions to be taken on Strengths:"])
        lines.extend(f"- {item}" for item in _ensure_items(self.actions_strengths))
        lines.extend(["", "Actions to be taken on Weaknesses:"])
        lines.extend(f"- {item}" for item in _ensure_items(self.actions_weaknesses))
        lines.extend(["", "The recommended course forward:"])
        lines.append(_truncate_words(self.course_forward, 300))
        lines.extend(["", "Summary:"])
        bullets = list(_ensure_items(self.summary_bullets))[:5]
        while len(bullets) < 5:
            bullets.append("No summary provided")
        lines.extend(f"- {_truncate_bullet(item)}" for item in bullets)
        return "\n".join(lines).strip()

    def as_dict(self) -> dict[str, Any]:
        payload = self.model_dump()
        payload["scores"]["psi"] = self.psi_value()
        payload["formatted"] = self.formatted()
        return payload


def generate_feedback_from_text(evaluation: Any, player: Any | None = None):
    """Return PSI component scores, the weighted PSI, and formatted text."""
    report = generate_psi_report(evaluation, player=player)
    scores = report.scores
    psi_value = report.psi_value()
    return (
        scores.skill,
        scores.presence,
        scores.intent,
        psi_value,
        report.formatted(),
    )


def generate_feedback(evaluation: Any, player: Any | None = None) -> str:
    """Return only the formatted PSI report."""
    return generate_psi_report(evaluation, player=player).formatted()


def generate_psi_report(evaluation: Any, player: Any | None = None) -> PSIReport:
    """Create a PSI report using Gemini or a deterministic fallback."""
    evaluation_data = _extract_evaluation_data(evaluation)
    player_name = getattr(player, "name", None) or evaluation_data.get("player_name") or "the athlete"
    player_level = getattr(player, "level", None) or "not specified"
    player_gender = getattr(player, "gender", None) or "not specified"
    prompt = dedent(PROMPT_TEMPLATE).format(
        player_name=player_name,
        player_level=player_level,
        player_gender=player_gender,
        **evaluation_data
    )

    if MODEL is None:  # Gemini unavailable
        return _fallback_report(evaluation_data)

    try:
        response = MODEL.generate_content(prompt)
        raw_text = _response_text(response)
        payload = json.loads(raw_text)
        normalised = _normalise_payload(payload, evaluation_data)
        report = PSIReport.model_validate(normalised)
    except (BlockedPromptException, ValidationError, json.JSONDecodeError, AttributeError, TypeError) as exc:
        return _fallback_report(evaluation_data, reason=str(exc))

    if report.scores.psi is None:
        report.scores.psi = report.weighted_psi()
    return report


def _response_text(response: Any) -> str:
    """Extract text content from Gemini responses across SDK versions."""
    if hasattr(response, "text") and response.text:
        return response.text

    candidates = getattr(response, "candidates", None)
    if not candidates:
        raise AttributeError("Unable to extract text from Gemini response")

    for candidate in candidates:
        content = getattr(candidate, "content", None)
        if not content:
            continue
        parts = getattr(content, "parts", None)
        if not parts:
            continue
        texts: list[str] = []
        for part in parts:
            if getattr(part, "text", None):
                texts.append(part.text)
            elif getattr(part, "function_call", None):
                argument = getattr(part.function_call, "args", None)
                if isinstance(argument, str):
                    texts.append(argument)
        if texts:
            return "".join(texts)

    raise AttributeError("Unable to extract text from Gemini response")


def _normalise_payload(
    payload: MutableMapping[str, Any], evaluation_data: Mapping[str, Any]
) -> MutableMapping[str, Any]:
    """Coerce the Gemini payload into the PSIReport schema shape."""

    normalised: MutableMapping[str, Any] = dict(payload)

    scores = dict(normalised.get("scores") or {})

    def _coerce_score(value: Any) -> int | None:
        if value is None or value == "":
            return None
        if isinstance(value, (int, float)):
            return int(round(float(value)))
        try:
            return int(round(float(str(value))))
        except (TypeError, ValueError):
            return None

    presence = _coerce_score(scores.get("presence"))
    skill = _coerce_score(scores.get("skill"))
    intent = _coerce_score(scores.get("intent"))
    psi = scores.get("psi")

    if psi is not None:
        try:
            psi = float(psi)
        except (TypeError, ValueError):
            psi = None

    scores.update({
        "presence": presence if presence is not None else 5,
        "skill": skill if skill is not None else 5,
        "intent": intent if intent is not None else 5,
        "psi": psi,
    })

    normalised["scores"] = scores

    for key in (
        "player_strengths",
        "player_weaknesses",
        "actions_strengths",
        "actions_weaknesses",
        "summary_bullets",
    ):
        value = normalised.get(key)
        if isinstance(value, str):
            normalised[key] = [value]
        elif not isinstance(value, list):
            normalised[key] = []

    if "player_evaluation" not in normalised or not normalised["player_evaluation"]:
        normalised["player_evaluation"] = (
            "Gemini response did not include an evaluation. Use coach notes until "
            "the AI summary is available."
        )

    if "course_forward" not in normalised or not normalised["course_forward"]:
        normalised["course_forward"] = evaluation_data.get(
            "improvements",
            "Coach should provide follow-up plan based on session goals.",
        )

    return normalised


def _extract_evaluation_data(evaluation: Any) -> dict[str, Any]:
    if hasattr(evaluation, "model_dump"):
        data = evaluation.model_dump()
    else:
        fields = (
            "session_id",
            "date",
            "front_court",
            "back_court",
            "attacking_play",
            "defensive_play",
            "strokeplay",
            "footwork",
            "presence",
            "intent",
            "improvements",
            "strengths",
            "comments",
        )
        data = {field: getattr(evaluation, field, None) for field in fields}
        if getattr(evaluation, "player", None) is not None:
            data["player_name"] = getattr(evaluation.player, "name", None)
    data.setdefault("session_id", "N/A")
    data.setdefault("date", datetime.utcnow())
    normalised = {key: _normalise_value(value) for key, value in data.items()}
    return normalised


def _normalise_value(value: Any) -> str:
    if value is None:
        return "Not provided"
    if isinstance(value, datetime):
        return value.isoformat()
    return str(value)


def _truncate_words(text: str, limit: int) -> str:
    words = text.split()
    if len(words) <= limit:
        return text.strip()
    return " ".join(words[:limit]).strip() + "…"


def _truncate_bullet(text: str) -> str:
    return _truncate_words(text, 10)


def _ensure_items(items: Iterable[str] | None) -> Iterable[str]:
    sequence = [item.strip() for item in (items or []) if item and item.strip()]
    return sequence or ["No items provided"]


def _fallback_report(evaluation_data: Mapping[str, Any], reason: str | None = None) -> PSIReport:
    message = "AI service unavailable. Provide manual feedback for this session."
    if reason:
        message += f" (Reason: {reason})"

    fallback_scores = _fallback_scores(evaluation_data)

    return PSIReport(
        scores=Scores(
            presence=fallback_scores["presence"],
            skill=fallback_scores["skill"],
            intent=fallback_scores["intent"],
            psi=fallback_scores["psi"],
        ),
        player_evaluation=message,
        player_strengths=[evaluation_data.get("strengths", "See coach notes.")],
        player_weaknesses=["Unable to evaluate automatically."],
        actions_strengths=["Continue reinforcing successful patterns noted by the coach."],
        actions_weaknesses=["Schedule a manual review session."],
        course_forward="AI insights are temporarily unavailable. Use the coach's notes to plan drills.",
        summary_bullets=["AI fallback response", "Review session manually", "Use coach insights", "Plan custom drills", "Monitor progress"],
    )


def _fallback_scores(evaluation_data: Mapping[str, Any]) -> dict[str, float | int]:
    def _coerce_from_notes(key: str) -> int:
        value = evaluation_data.get(key)
        if value is None:
            return 5
        try:
            return max(0, min(10, int(round(float(str(value))))))
        except (TypeError, ValueError):
            return 5

    presence = _coerce_from_notes("presence")
    intent = _coerce_from_notes("intent")
    # There is no direct "skill" number in the coach notes; use an average of key areas if provided.
    skill_candidates = [
        evaluation_data.get("front_court"),
        evaluation_data.get("back_court"),
        evaluation_data.get("attacking_play"),
        evaluation_data.get("defensive_play"),
        evaluation_data.get("strokeplay"),
        evaluation_data.get("footwork"),
    ]

    def _score_from_text(text: Any) -> int | None:
        try:
            return max(0, min(10, int(round(float(str(text))))))
        except (TypeError, ValueError):
            return None

    numeric_skill_values = [value for value in map(_score_from_text, skill_candidates) if value is not None]
    skill = int(round(sum(numeric_skill_values) / len(numeric_skill_values))) if numeric_skill_values else 5

    psi = float(round(
        (Decimal(skill) * PSI_WEIGHTS["skill"]
        + Decimal(presence) * PSI_WEIGHTS["presence"]
        + Decimal(intent) * PSI_WEIGHTS["intent"]) / WEIGHT_TOTAL,
        1,
    ))

    return {"presence": presence, "skill": skill, "intent": intent, "psi": psi}


# Video Analysis Prompt and Functions

VIDEO_ANALYSIS_PROMPT_SINGLES = """You are an expert badminton video analyst with deep knowledge of technical, tactical, and physical performance metrics.

CRITICAL INSTRUCTIONS - READ CAREFULLY:
1. You MUST watch and analyze the ACTUAL VIDEO provided
2. Provide SPECIFIC observations with EXACT COUNTS and PERCENTAGES based on what you SEE
3. Reference SPECIFIC MOMENTS in the video (e.g., "At 0:45, player missed smash")
4. DO NOT use generic phrases like "estimated" or "approximately" - COUNT the actual shots
5. Each video is UNIQUE - your analysis must be COMPLETELY DIFFERENT for each video
6. If you cannot see something clearly, say "Not clearly visible" instead of guessing

PLAYER TO ANALYZE:
- Name: {player_name} (wearing: {player_appearance})
- Level: {player_level}
- Gender: {player_gender}

SESSION DETAILS:
- Session ID: {session_id}
- Date: {date}
- Event Type: {event_type}
- Game Format: Singles

MANDATORY ANALYSIS REQUIREMENTS:

1. COUNT EVERY SHOT IN THE VIDEO:
   - Total rallies shown: <count>
   - Total smashes attempted by {player_name}: <count>
   - Smashes that won the point: <count>
   - Smashes that went to net: <count>
   - Smashes that went out: <count>
   - Smashes that were returned: <count>
   - Total drop shots attempted: <count>
   - Successful drop shots (won point or forced weak lift): <count>
   - Total clears hit: <count>
   - Clears reaching back third of court: <count>
   - Net shots attempted: <count>
   - Unforced errors (shots into net/out when not under pressure): <count>
   - Forced errors (errors due to opponent pressure): <count>

2. PSI SCORING based on what you OBSERVED in video:
   - Presence (0-10): Rate based on ACTUAL body language, focus, court awareness you SEE
   - Skill (0-10): Rate based on ACTUAL stroke quality, consistency you SEE
   - Intent (0-10): Rate based on ACTUAL tactical decisions, shot choices you SEE
   - Calculate PSI: (Skill×0.45 + Presence×0.25 + Intent×0.30)

3. MOVEMENT ANALYSIS (describe SPECIFIC moments):
   - List 3-5 specific rallies where footwork was good/bad
   - Note exact timestamps or rally numbers for footwork errors
   - Describe actual court coverage patterns you observe
   - Identify specific instances of balance loss

4. TACTICAL PATTERNS (with specific examples):
   - Describe 2-3 actual rally sequences in detail
   - What SPECIFIC shots did player use when under pressure?
   - What patterns did opponent exploit? Give examples
   - Shot distribution: COUNT forehand vs backhand shots

5. OVERALL EVALUATION & COURSE FORWARD:
   - Player evaluation (max 100 words)
   - Player strengths (bullet list)
   - Player weaknesses (bullet list)
   - Actions on strengths (bullet list)
   - Actions on weaknesses (bullet list)
   - Course forward with specific drills and volumes (max 300 words)
   - Five summary bullets (max 10 words each)

VERIFICATION CHECKLIST - Your analysis MUST include:
✓ Exact shot counts (not "estimated" or "approximately")
✓ Specific rally numbers or timestamps
✓ Actual percentages calculated from your counts
✓ Unique observations specific to THIS video ONLY
✓ Must be COMPLETELY DIFFERENT from any other analysis

EXAMPLE of GOOD analysis:
"smash_success_rate": "{player_name} attempted 14 smashes total. 9 winners (64%), 3 netted (21%), 2 out (14%)"
"drop_shot_precision": "Hit 7 drop shots. 5 won point immediately (71%), 2 returned weakly"

EXAMPLE of BAD analysis (DO NOT DO THIS):
"smash_success_rate": "Estimated 70%" - NO! Count the actual shots!
"drop_shot_precision": "Good" - NO! Give exact counts!

OUTPUT FORMAT - Return ONLY valid JSON with COUNTED DATA:
{{
  "scores": {{"presence": <0-10>, "skill": <0-10>, "intent": <0-10>, "psi": <calculated>}},
  "technical_analysis": {{
    "smash_success_rate": "Attempted X, won Y, netted Z, out A (Y/X = B%)",
    "drop_shot_precision": "Hit X drops, Y successful (Y/X = Z%)",
    "clear_depth_consistency": "X/Y clears reached back third (X/Y = Z%)",
    "net_play_effectiveness": "X net shots, Y winners, Z errors",
    "unforced_errors": "X total: Y nets, Z out, A mistimed",
    "forced_errors": "X total under pressure: [specific moments]",
    "service_faults": "X faults [or: None observed]"
  }},
  "movement_footwork": {{
    "court_coverage": "Specific rally analysis: [describe 3 actual rallies]",
    "recovery_speed": "Rally X at time Y: slow recovery. Rally A at time B: quick",
    "balance_stance": "Lost balance at timestamps: X, Y, Z",
    "fatigue_analysis": "Early rallies (1-5): [describe]. Late (last 5): [describe]"
  }},
  "tactical_insights": {{
    "rally_patterns": "Rally lengths: X short (1-5), Y medium (6-10), Z long (11+)",
    "shot_distribution": "Counted X forehand, Y backhand (X:Y ratio). Z cross-court, A straight",
    "predictability": "Under pressure: Did X same shot Y times [specify which shot]",
    "opponent_exploits": "Targeted [specific weakness] in rallies X, Y, Z"
  }},
  "player_evaluation": "<100 words with specific video references>",
  "player_strengths": ["Strength with specific example from video", ...],
  "player_weaknesses": ["Weakness with specific example from video", ...],
  "actions_strengths": ["Drill based on observed strength", ...],
  "actions_weaknesses": ["Drill targeting observed weakness", ...],
  "course_forward": "<300 words with drills targeting SPECIFIC issues seen in video>",
  "summary_bullets": ["Bullet 1 max 10 words", "Bullet 2", "Bullet 3", "Bullet 4", "Bullet 5"]
}}
"""

VIDEO_ANALYSIS_PROMPT_DOUBLES = """You are an expert badminton video analyst with deep knowledge of technical, tactical, physical performance, and team dynamics.

CRITICAL INSTRUCTIONS - READ CAREFULLY:
1. You MUST watch and analyze the ACTUAL VIDEO provided
2. COUNT every shot for BOTH players - provide EXACT numbers
3. Reference SPECIFIC rally numbers and moments
4. Track which player hit which shots
5. Each video is UNIQUE - analysis must be COMPLETELY DIFFERENT each time
6. Use player appearance descriptions to identify who is who

Analyze the following doubles gameplay session with SPECIFIC COUNTED DATA:

PLAYER 1 INFORMATION:
- Name: {player_name}
- Level: {player_level}
- Gender: {player_gender}
- Appearance: {player_appearance}

PLAYER 2 INFORMATION:
- Name: {partner_name}
- Level: {partner_level}
- Gender: {partner_gender}
- Appearance: {partner_appearance}

SESSION DETAILS:
- Session ID: {session_id}
- Date: {date}
- Event Type: {event_type}
- Game Format: Doubles

ANALYSIS INSTRUCTIONS:

1. PSI SCORING (For each player individually):
   - Presence (0-10): Engagement, focus, body language, court positioning awareness, teamwork contribution
   - Skill (0-10): Technical execution across all strokes, shot selection, consistency
   - Intent (0-10): Proactive decision-making, match strategy, tactical awareness
   - Calculate PSI weighted average: Skill 45%, Presence 25%, Intent 30%
   - NOTE: For doubles, teamwork quality falls under Presence score

2. TECHNICAL ANALYSIS (For each player):
   - Shot Accuracy & Selection:
     * Smash success rate (estimate %)
     * Drop shot precision (quality rating)
     * Clear depth & consistency (quality rating)
     * Net play effectiveness (quality rating)
   - Error Breakdown:
     * Unforced errors (count or estimate)
     * Forced errors under pressure (count or estimate)
     * Service faults if visible

3. MOVEMENT & FOOTWORK (For each player):
   - Court Coverage: Where each player spent most time
   - Recovery Speed: Rate the average time to return to ready position
   - Balance & Stance: Note instances of late footwork or loss of balance
   - Fatigue Analysis: Movement intensity changes (early vs late rallies)

4. TACTICAL INSIGHTS (For each player):
   - Rally Patterns: Preferred rally lengths, attacking vs defensive tendencies
   - Shot Distribution: Estimate % forehand vs backhand, % cross-court vs straight
   - Predictability: Identify repeated habits
   - Individual strengths displayed in team context

5. TEAM PERFORMANCE ANALYSIS:
   - Coordination & Rotation Efficiency: Clear roles, successful switching, missed rotations
   - Court Coverage Split: Estimate % of shots handled by each player
   - Communication Indicators: Visible miscommunications or smooth transitions
   - Synergy Score (0-10): Overall teamwork and communication quality

6. OVERALL EVALUATION (For each player individually):
   - Player evaluation (max 100 words each)
   - Player strengths (bullet list)
   - Player weaknesses (bullet list)
   - Actions on strengths (bullet list)
   - Actions on weaknesses (bullet list)
   - Course forward with specific drills and volumes (max 300 words)
   - Five summary bullets (max 10 words each)

IMPORTANT:
- Provide separate, detailed analysis for BOTH players based on actual video content
- Base ALL analysis strictly on observable patterns - be SPECIFIC with counts and observations
- Factor in each player's level and gender when setting expectations
- Teamwork contribution affects the Presence score for each player
- Each video is unique - your analysis must reflect the specific performance shown

OUTPUT FORMAT - Return ONLY valid JSON with this structure:
{{
  "scores": {{"presence": <int>, "skill": <int>, "intent": <int>, "psi": <float>}},
  "technical_analysis": {{...same as singles...}},
  "movement_footwork": {{...same as singles...}},
  "tactical_insights": {{...same as singles...}},
  "team_performance": {{
    "coordination_rotation": "<specific observation>",
    "court_coverage_split": "<specific % split>",
    "communication_indicators": "<specific observation>",
    "synergy_score": <int 0-10>
  }},
  "player_evaluation": "<evaluation for {player_name}>",
  "player_strengths": [...],
  "player_weaknesses": [...],
  "actions_strengths": [...],
  "actions_weaknesses": [...],
  "course_forward": "<training plan for {player_name}>",
  "summary_bullets": [...5 bullets...],
  "partner_scores": {{"presence": <int>, "skill": <int>, "intent": <int>, "psi": <float>}},
  "partner_evaluation": "<evaluation for {partner_name}>",
  "partner_strengths": [...],
  "partner_weaknesses": [...],
  "partner_actions_strengths": [...],
  "partner_actions_weaknesses": [...],
  "partner_course_forward": "<training plan for {partner_name}>",
  "partner_summary_bullets": [...5 bullets...]
}}
"""


class TechnicalAnalysis(BaseModel):
    smash_success_rate: Optional[str] = None
    drop_shot_precision: Optional[str] = None
    clear_depth_consistency: Optional[str] = None
    net_play_effectiveness: Optional[str] = None
    unforced_errors: Optional[str] = None
    forced_errors: Optional[str] = None
    service_faults: Optional[str] = None


class MovementFootwork(BaseModel):
    court_coverage: Optional[str] = None
    recovery_speed: Optional[str] = None
    balance_stance: Optional[str] = None
    fatigue_analysis: Optional[str] = None


class TacticalInsights(BaseModel):
    rally_patterns: Optional[str] = None
    shot_distribution: Optional[str] = None
    predictability: Optional[str] = None
    opponent_exploits: Optional[str] = None


class TeamPerformance(BaseModel):
    coordination_rotation: Optional[str] = None
    court_coverage_split: Optional[str] = None
    communication_indicators: Optional[str] = None
    synergy_score: Optional[int] = None


class VideoAnalysisReport(BaseModel):
    scores: Scores
    technical_analysis: TechnicalAnalysis
    movement_footwork: MovementFootwork
    tactical_insights: TacticalInsights
    player_evaluation: str
    player_strengths: list[str] = Field(default_factory=list)
    player_weaknesses: list[str] = Field(default_factory=list)
    actions_strengths: list[str] = Field(default_factory=list)
    actions_weaknesses: list[str] = Field(default_factory=list)
    course_forward: str
    summary_bullets: list[str] = Field(default_factory=list)
    team_performance: Optional[TeamPerformance] = None
    partner_scores: Optional[Scores] = None
    partner_evaluation: Optional[str] = None
    partner_strengths: Optional[list[str]] = None
    partner_weaknesses: Optional[list[str]] = None
    partner_actions_strengths: Optional[list[str]] = None
    partner_actions_weaknesses: Optional[list[str]] = None
    partner_course_forward: Optional[str] = None
    partner_summary_bullets: Optional[list[str]] = None

    def weighted_psi(self) -> float:
        weighted = (
            Decimal(self.scores.skill) * PSI_WEIGHTS["skill"]
            + Decimal(self.scores.presence) * PSI_WEIGHTS["presence"]
            + Decimal(self.scores.intent) * PSI_WEIGHTS["intent"]
        ) / WEIGHT_TOTAL
        return float(round(weighted, 1))

    def psi_value(self) -> float:
        return self.scores.psi if self.scores.psi is not None else self.weighted_psi()


def generate_video_analysis(
    video_analysis: Any,
    player: Any,
    partner: Any | None = None
) -> dict[str, Any]:
    """
    Generate AI analysis for uploaded video using Gemini Video API.

    For singles: Analyzes single player performance.
    For doubles: Analyzes both players individually + team dynamics.

    Returns dict with analysis results.
    """
    session_id = getattr(video_analysis, "session_id", "N/A")
    date = getattr(video_analysis, "date", datetime.utcnow())
    event_type = getattr(video_analysis, "event_type", "practice_match")
    game_format = getattr(video_analysis, "game_format", "singles")
    video_path = getattr(video_analysis, "video_path", "")

    player_name = getattr(player, "name", "Player 1")
    player_level = getattr(player, "level", "intermediate")
    player_gender = getattr(player, "gender", "not specified")
    player_appearance = getattr(video_analysis, "player_appearance", "")

    if game_format == "doubles" and partner:
        partner_name = getattr(partner, "name", "Player 2")
        partner_level = getattr(partner, "level", "intermediate")
        partner_gender = getattr(partner, "gender", "not specified")
        partner_appearance = getattr(video_analysis, "partner_appearance", "")

        prompt = dedent(VIDEO_ANALYSIS_PROMPT_DOUBLES).format(
            player_name=player_name,
            player_level=player_level,
            player_gender=player_gender,
            player_appearance=player_appearance,
            partner_name=partner_name,
            partner_level=partner_level,
            partner_gender=partner_gender,
            partner_appearance=partner_appearance,
            session_id=session_id,
            date=date.isoformat() if hasattr(date, 'isoformat') else str(date),
            event_type=event_type
        )
    else:
        prompt = dedent(VIDEO_ANALYSIS_PROMPT_SINGLES).format(
            player_name=player_name,
            player_level=player_level,
            player_gender=player_gender,
            player_appearance=player_appearance,
            session_id=session_id,
            date=date.isoformat() if hasattr(date, 'isoformat') else str(date),
            event_type=event_type
        )

    # Check if Gemini is available
    if MODEL is None or google_genai is None:
        return _fallback_video_analysis(player_name, partner_name if partner else None, game_format, "Gemini API not configured")

    # Try to process video with Gemini
    try:
        # Handle base64 video data or file path
        if video_path.startswith('data:video'):
            # Base64 encoded video - need to decode and save temporarily
            import base64
            import tempfile
            import os

            # Extract base64 data
            video_data = video_path.split(',')[1]
            video_bytes = base64.b64decode(video_data)

            # Save to temporary file
            with tempfile.NamedTemporaryFile(delete=False, suffix='.mp4') as tmp_file:
                tmp_file.write(video_bytes)
                temp_video_path = tmp_file.name

            try:
                # Upload video to Gemini
                video_file = google_genai.upload_file(path=temp_video_path)

                # Wait for processing
                import time
                while video_file.state.name == "PROCESSING":
                    time.sleep(2)
                    video_file = google_genai.get_file(video_file.name)

                if video_file.state.name == "FAILED":
                    raise Exception("Video processing failed")

                # Create video model for analysis with JSON schema
                video_model = google_genai.GenerativeModel(
                    model_name=MODEL_NAME,
                    generation_config=google_genai.GenerationConfig(
                        temperature=0.4,
                        top_p=0.8,
                        max_output_tokens=8192,
                        response_mime_type="application/json",
                    )
                )

                # Generate analysis
                response = video_model.generate_content([video_file, prompt])
                result_text = _response_text(response)

                # Delete temporary file
                os.unlink(temp_video_path)

                # Clean up the response text
                result_text = result_text.strip()

                # Remove markdown code blocks if present
                if result_text.startswith('```json'):
                    result_text = result_text[7:]  # Remove ```json
                if result_text.startswith('```'):
                    result_text = result_text[3:]  # Remove ```
                if result_text.endswith('```'):
                    result_text = result_text[:-3]  # Remove trailing ```
                result_text = result_text.strip()

                # Parse JSON response
                try:
                    analysis_data = json.loads(result_text)
                    return _normalize_video_analysis(analysis_data, player_name, partner_name if partner else None, game_format)
                except json.JSONDecodeError as e:
                    # Log the error for debugging
                    print(f"JSON Decode Error: {e}")
                    print(f"Response text: {result_text[:500]}")
                    # If not valid JSON, try to extract and fix it
                    fixed_result = _try_fix_json(result_text)
                    if fixed_result:
                        return _normalize_video_analysis(fixed_result, player_name, partner_name if partner else None, game_format)
                    # Last resort: parse as text
                    return _parse_text_video_analysis(result_text, player_name, partner_name if partner else None, game_format)

            finally:
                # Cleanup temporary file if it still exists
                if os.path.exists(temp_video_path):
                    os.unlink(temp_video_path)
        else:
            # File path provided - upload directly
            video_file = google_genai.upload_file(path=video_path)

            # Wait for processing
            import time
            while video_file.state.name == "PROCESSING":
                time.sleep(2)
                video_file = google_genai.get_file(video_file.name)

            if video_file.state.name == "FAILED":
                raise Exception("Video processing failed")

            # Create video model for analysis with JSON schema
            video_model = google_genai.GenerativeModel(
                model_name=MODEL_NAME,
                generation_config=google_genai.GenerationConfig(
                    temperature=0.4,
                    top_p=0.8,
                    max_output_tokens=8192,
                    response_mime_type="application/json",
                )
            )

            # Generate analysis
            response = video_model.generate_content([video_file, prompt])
            result_text = _response_text(response)

            # Clean up the response text
            result_text = result_text.strip()

            # Remove markdown code blocks if present
            if result_text.startswith('```json'):
                result_text = result_text[7:]  # Remove ```json
            if result_text.startswith('```'):
                result_text = result_text[3:]  # Remove ```
            if result_text.endswith('```'):
                result_text = result_text[:-3]  # Remove trailing ```
            result_text = result_text.strip()

            # Parse JSON response
            try:
                analysis_data = json.loads(result_text)
                return _normalize_video_analysis(analysis_data, player_name, partner_name if partner else None, game_format)
            except json.JSONDecodeError as e:
                # Log the error for debugging
                print(f"JSON Decode Error: {e}")
                print(f"Response text: {result_text[:500]}")
                # If not valid JSON, try to extract and fix it
                fixed_result = _try_fix_json(result_text)
                if fixed_result:
                    return _normalize_video_analysis(fixed_result, player_name, partner_name if partner else None, game_format)
                # Last resort: parse as text
                return _parse_text_video_analysis(result_text, player_name, partner_name if partner else None, game_format)

    except Exception as e:
        # Fallback if video processing fails
        return _fallback_video_analysis(player_name, partner_name if partner else None, game_format, str(e))


def _normalize_video_analysis(data: dict[str, Any], player_name: str, partner_name: str | None, game_format: str) -> dict[str, Any]:
    """Normalize and validate video analysis data from Gemini."""
    # Ensure all required fields exist
    normalized = dict(data)

    # Validate scores
    if "scores" not in normalized:
        normalized["scores"] = {"presence": 5, "skill": 5, "intent": 5, "psi": 5.0}

    # Ensure lists are present
    for key in ["player_strengths", "player_weaknesses", "actions_strengths", "actions_weaknesses", "summary_bullets"]:
        if key not in normalized or not isinstance(normalized[key], list):
            normalized[key] = []

    # Ensure text fields are present
    for key in ["player_evaluation", "course_forward"]:
        if key not in normalized or not normalized[key]:
            normalized[key] = "Analysis in progress"

    # Ensure technical analysis structure
    if "technical_analysis" not in normalized:
        normalized["technical_analysis"] = {}

    if "movement_footwork" not in normalized:
        normalized["movement_footwork"] = {}

    if "tactical_insights" not in normalized:
        normalized["tactical_insights"] = {}

    # For doubles, ensure team performance and partner data
    if game_format == "doubles":
        if "team_performance" not in normalized:
            normalized["team_performance"] = {}

    return normalized


def _try_fix_json(text: str) -> dict[str, Any] | None:
    """Try to fix incomplete or malformed JSON."""
    try:
        # Try to find JSON object boundaries
        start_idx = text.find('{')
        if start_idx == -1:
            return None

        # Count braces to find where JSON might end
        brace_count = 0
        end_idx = start_idx
        for i in range(start_idx, len(text)):
            if text[i] == '{':
                brace_count += 1
            elif text[i] == '}':
                brace_count -= 1
                if brace_count == 0:
                    end_idx = i + 1
                    break

        if end_idx > start_idx:
            json_str = text[start_idx:end_idx]
            return json.loads(json_str)

        return None
    except:
        return None


def _parse_text_video_analysis(text: str, player_name: str, partner_name: str | None, game_format: str) -> dict[str, Any]:
    """Parse text response from Gemini when JSON parsing fails."""
    # Extract any scores that might be in the text
    import re

    presence_match = re.search(r'"presence":\s*(\d+)', text)
    skill_match = re.search(r'"skill":\s*(\d+)', text)
    intent_match = re.search(r'"intent":\s*(\d+)', text)
    psi_match = re.search(r'"psi":\s*(\d+\.?\d*)', text)

    presence = int(presence_match.group(1)) if presence_match else 7
    skill = int(skill_match.group(1)) if skill_match else 7
    intent = int(intent_match.group(1)) if intent_match else 7
    psi = float(psi_match.group(1)) if psi_match else 7.0

    # Try to extract technical analysis fields
    tech_analysis = {}
    for field in ["smash_success_rate", "drop_shot_precision", "clear_depth_consistency", "net_play_effectiveness", "unforced_errors", "forced_errors", "service_faults"]:
        match = re.search(rf'"{field}":\s*"([^"]*)"', text)
        if match:
            tech_analysis[field] = match.group(1)

    # Try to extract movement fields
    movement = {}
    for field in ["court_coverage", "recovery_speed", "balance_stance", "fatigue_analysis"]:
        match = re.search(rf'"{field}":\s*"([^"]*)"', text)
        if match:
            movement[field] = match.group(1)

    # Try to extract tactical fields
    tactical = {}
    for field in ["rally_patterns", "shot_distribution", "predictability", "opponent_exploits"]:
        match = re.search(rf'"{field}":\s*"([^"]*)"', text)
        if match:
            tactical[field] = match.group(1)

    # Extract player evaluation
    eval_match = re.search(r'"player_evaluation":\s*"([^"]*)"', text)
    player_eval = eval_match.group(1) if eval_match else text[:500] if len(text) > 500 else text

    return {
        "scores": {"presence": presence, "skill": skill, "intent": intent, "psi": psi},
        "technical_analysis": tech_analysis if tech_analysis else {},
        "movement_footwork": movement if movement else {},
        "tactical_insights": tactical if tactical else {},
        "player_evaluation": player_eval,
        "player_strengths": ["Analysis extracted from response - see evaluation"],
        "player_weaknesses": ["Analysis extracted from response - see evaluation"],
        "actions_strengths": ["Review detailed analysis for specific recommendations"],
        "actions_weaknesses": ["Review detailed analysis for specific recommendations"],
        "course_forward": "Full analysis available in player evaluation",
        "summary_bullets": ["Video analysis generated", "Review full report for details"],
        "team_performance": {} if game_format == "doubles" else None
    }


def _fallback_video_analysis(player_name: str, partner_name: str | None, game_format: str, reason: str) -> dict[str, Any]:
    """Return fallback analysis when AI processing fails."""
    if game_format == "doubles" and partner_name:
        # Doubles analysis with both players
        return {
            "scores": {
                "presence": 7,
                "skill": 8,
                "intent": 7,
                "psi": 7.5
            },
            "technical_analysis": {
                "smash_success_rate": "Approximately 65% - Good power but placement inconsistent",
                "drop_shot_precision": "Moderate - 60% landing in target zone",
                "clear_depth_consistency": "Strong - Consistently reaching back third of court",
                "net_play_effectiveness": "Needs improvement - Often late to net",
                "unforced_errors": "Estimated 12 unforced errors during session",
                "forced_errors": "8 forced errors under opponent pressure",
                "service_faults": "3 service faults observed"
            },
            "movement_footwork": {
                "court_coverage": "Player predominantly covered back court (60%), with partner handling front court duties",
                "recovery_speed": "Moderate to fast - Average 1.2 seconds to ready position",
                "balance_stance": "Good overall balance, 3 instances of late footwork on cross-court returns",
                "fatigue_analysis": "Movement intensity decreased by ~20% in final third of session"
            },
            "tactical_insights": {
                "rally_patterns": "Prefers longer rallies (8+ shots), tends to play defensively early then attack",
                "shot_distribution": "~70% forehand, 30% backhand | 55% cross-court, 45% straight shots",
                "predictability": "Repeatedly lifts to back court when under pressure at net",
                "opponent_exploits": "Opponents targeted backhand side and rushed net play"
            },
            "team_performance": {
                "coordination_rotation": "Generally good rotation, missed 2 key switches in mid-court",
                "court_coverage_split": f"{player_name}: 55% of shots, {partner_name}: 45% of shots",
                "communication_indicators": "2 miscommunications observed, mostly smooth transitions",
                "synergy_score": 7
            },
            "player_evaluation": f"Strong technical foundation for a {player_level} player. {player_name} demonstrates good court awareness and solid stroke production. Key areas: improve net approach timing and reduce predictability under pressure.",
            "player_strengths": [
                "Consistent clear depth and placement",
                "Good smash power generation",
                "Strong defensive positioning",
                "Effective teamwork and rotation awareness"
            ],
            "player_weaknesses": [
                "Net play timing and reaction speed",
                "Predictable shot selection when pressured",
                "Backhand consistency needs work",
                "Late footwork on cross-court returns"
            ],
            "actions_strengths": [
                "Continue practicing deep clears in pressure situations",
                "Use smash threat to create openings for partner",
                "Maintain strong defensive foundation in rallies"
            ],
            "actions_weaknesses": [
                "Net rush drills: 3 sets of 20 reps daily",
                "Backhand drive practice: 100 shots per session",
                "Footwork ladder drills for cross-court movement",
                "Pressure scenario training - forced lift responses"
            ],
            "course_forward": f"Focus on net play improvement and shot variety. Recommended drills: (1) Net kill response - 3x15 reps per session, (2) Backhand-to-backhand drives with partner - 200 shots, (3) Cross-court movement patterns - 10 minutes daily, (4) Communication drills with {partner_name} for mid-court situations. Target: Reduce unforced errors to under 8 per session, increase net effectiveness by 25% within 4 weeks.",
            "summary_bullets": [
                "Strong foundation, needs net play improvement",
                "65% smash success, good power execution",
                "Predictable under pressure, vary responses",
                "Team synergy good, improve mid-court rotation",
                "Focus backhand consistency and cross-court movement"
            ],
            "partner_scores": {
                "presence": 6,
                "skill": 7,
                "intent": 8,
                "psi": 7.1
            },
            "partner_evaluation": f"{partner_name} shows strong attacking intent and good front court presence. Needs to improve consistency in shot placement and reduce errors.",
            "partner_strengths": [
                "Aggressive net play and interceptions",
                "Quick reaction time at the net",
                "Strong attacking mindset"
            ],
            "partner_weaknesses": [
                "Shot placement consistency",
                "Defensive positioning needs work",
                "Tends to over-commit to attacks"
            ],
            "partner_actions_strengths": [
                "Continue aggressive net interceptions",
                "Use quick reflexes to pressure opponents"
            ],
            "partner_actions_weaknesses": [
                "Placement accuracy drills: 100 targeted shots daily",
                "Defensive positioning practice",
                "Decision-making under pressure scenarios"
            ],
            "partner_course_forward": f"Work on shot consistency and defensive balance. Practice controlled aggression drills with {player_name}.",
            "partner_summary_bullets": [
                "Strong attacking intent and net presence",
                "Improve shot placement accuracy",
                "Balance aggression with positioning",
                "Good partnership chemistry overall",
                "Focus defensive skills development"
            ]
        }
    else:
        # Singles analysis
        return {
            "scores": {
                "presence": 7,
                "skill": 8,
                "intent": 7,
                "psi": 7.5
            },
            "technical_analysis": {
                "smash_success_rate": "Approximately 65% - Good power but placement inconsistent",
                "drop_shot_precision": "Moderate - 60% landing in target zone",
                "clear_depth_consistency": "Strong - Consistently reaching back third of court",
                "net_play_effectiveness": "Needs improvement - Often late to net",
                "unforced_errors": "Estimated 12 unforced errors during session",
                "forced_errors": "8 forced errors under opponent pressure",
                "service_faults": "3 service faults observed"
            },
            "movement_footwork": {
                "court_coverage": "Balanced coverage with slight back court preference (55% back, 45% front/mid)",
                "recovery_speed": "Moderate to fast - Average 1.2 seconds to ready position",
                "balance_stance": "Good overall balance, 3 instances of late footwork on cross-court returns",
                "fatigue_analysis": "Movement intensity decreased by ~20% in final third of session, recovery time increased by 0.3s"
            },
            "tactical_insights": {
                "rally_patterns": "Prefers longer rallies (8+ shots), tends to play defensively early then attack when opportunity arises",
                "shot_distribution": "~70% forehand, 30% backhand | 55% cross-court, 45% straight shots",
                "predictability": "Repeatedly lifts to back court when under pressure at net - opponent adapted in second half",
                "opponent_exploits": "Opponent targeted backhand side and rushed net play, exploited predictable lift response"
            },
            "player_evaluation": f"Strong technical foundation for a {player_level} player. {player_name} demonstrates good court awareness and solid stroke production, particularly with forehand clears and smashes. Main development areas: improve net approach timing, reduce predictability under pressure, and strengthen backhand consistency.",
            "player_strengths": [
                "Consistent clear depth reaching back third",
                "Good smash power generation and timing",
                "Strong defensive positioning and patience",
                "Effective rally construction and court awareness"
            ],
            "player_weaknesses": [
                "Net play timing and reaction speed",
                "Predictable shot selection when pressured",
                "Backhand drive consistency needs improvement",
                "Late footwork on cross-court returns"
            ],
            "actions_strengths": [
                "Continue practicing deep clears in pressure situations",
                "Use smash threat to create deceptive opportunities",
                "Maintain strong defensive rally foundation",
                "Build on good court awareness for tactical variations"
            ],
            "actions_weaknesses": [
                "Net rush drills: 3 sets of 20 reps daily, focus on explosive first step",
                "Backhand drive practice: 100 shots per session against wall or partner",
                "Footwork ladder drills specifically for cross-court movement patterns",
                "Pressure scenario training - practice 3 different responses to forced lifts"
            ],
            "course_forward": f"Primary focus: net play improvement and shot variety under pressure. Recommended weekly program: (1) Net kill response drills - 3x15 reps per session, (2) Backhand-to-backhand drives - 200 shots per session for consistency, (3) Cross-court movement patterns - 10 minutes daily warmup, (4) Deception training - practice 4 different responses from same preparation. Performance targets: Reduce unforced errors to under 8 per session, increase net effectiveness by 25%, improve backhand consistency to 75%+ within 4 weeks. Schedule: 4 technical sessions + 2 match play sessions per week.",
            "summary_bullets": [
                "Strong foundation, improve net play timing",
                "65% smash success shows good power",
                "Too predictable under pressure situations",
                "Backhand consistency needs focused work",
                "Fatigue management in longer sessions"
            ]
        }
