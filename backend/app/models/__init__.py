# Import all models here so Alembic can discover them for autogenerate.
from app.models.user import User
from app.models.category import Category
from app.models.question import Question, QuestionSource, QuestionType, VerificationStatus
from app.models.progress import UserQuestionProgress
from app.models.answer import StudyAnswer

__all__ = [
    "User",
    "Category",
    "Question",
    "QuestionSource",
    "QuestionType",
    "VerificationStatus",
    "UserQuestionProgress",
    "StudyAnswer",
]
