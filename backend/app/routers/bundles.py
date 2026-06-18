import hashlib

from fastapi import APIRouter, Depends
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_db
from app.models.category import Category
from app.models.question import Question, VerificationStatus
from app.schemas.bundle import BundleQuestion, BundleResponse
from app.schemas.category import CategoryResponse

# PUBLIC router — anonymous users download the question pool on first launch,
# before any Firebase identity exists. Questions are not user data.
router = APIRouter(prefix="/bundles", tags=["bundles"])

_ACTIVE = (
    Question.is_active.is_(True),
    Question.verification_status == VerificationStatus.verified,
    # Private/non-public rows never ship in the public bundle, even if mis-verified.
    Question.is_public.is_(True),
)


@router.get("/latest", response_model=BundleResponse)
async def get_latest_bundle(db: AsyncSession = Depends(get_db)) -> BundleResponse:
    questions_stmt = select(Question).where(*_ACTIVE).order_by(Question.id)
    categories_stmt = select(Category).order_by(Category.name)
    deleted_stmt = select(Question.id).where(
        or_(
            Question.is_active.is_(False),
            Question.verification_status == VerificationStatus.rejected,
        )
    )
    version_stmt = select(func.count(), func.max(Question.created_at)).where(*_ACTIVE)

    # NOTE: a single AsyncSession (one DB connection) is not safe for concurrent
    # use — asyncio.gather over db.execute raises "session is provisioning a new
    # connection". The queries serialize on the wire anyway, so await in sequence.
    questions_res = await db.execute(questions_stmt)
    categories_res = await db.execute(categories_stmt)
    deleted_res = await db.execute(deleted_stmt)
    version_res = await db.execute(version_stmt)

    questions = questions_res.scalars().all()
    cats = categories_res.scalars().all()
    count, max_created = version_res.one()
    # Monotonic-enough version for full-bundle MVP: changes whenever questions
    # are added (count/max_created) or removed (count). The category fingerprint
    # makes the version also move on any category add/remove/id-change, so the
    # client re-applies the bundle and reconciles its local categories table
    # (drops stale rows). Deltas come post-launch.
    cat_fp = hashlib.md5("".join(sorted(str(c.id) for c in cats)).encode()).hexdigest()[:8]
    version = f"{count}-{max_created.isoformat() if max_created else 'empty'}-{cat_fp}"

    return BundleResponse(
        version=version,
        question_count=count,
        questions=[BundleQuestion.model_validate(q) for q in questions],
        categories=[CategoryResponse.model_validate(c) for c in cats],
        deleted_ids=list(deleted_res.scalars().all()),
    )
