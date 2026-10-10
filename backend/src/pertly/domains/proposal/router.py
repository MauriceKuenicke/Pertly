from fastapi import APIRouter, Depends, HTTPException, Response, status

from pertly.common.config import logger, settings
from pertly.domains import deps
from pertly.domains.user.model import User

from .model import ProposalPdfRequest
from .service import PdfRenderer, PdfRenderError, safe_pdf_filename

router = APIRouter()


@router.post(
    "/pdf",
    summary="Render a proposal to PDF.",
    status_code=200,
    deprecated=False,
    response_class=Response,
    responses={200: {"content": {"application/pdf": {}}, "description": "The rendered PDF file."}},
)
async def export_proposal_pdf(
    proposal: ProposalPdfRequest,
    user: User = Depends(deps.get_current_user),
    pdf_renderer: PdfRenderer = Depends(deps.get_pdf_renderer),
) -> Response:
    """
    Print the given proposal HTML to an A4 PDF and return it as a download.
    """
    if len(proposal.html.encode("utf-8")) > settings.max_pdf_html_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_CONTENT_TOO_LARGE,
            detail={
                "code": "DOCUMENT_TOO_LARGE",
                "message": "Proposal is too large to render.",
            },
        )
    try:
        pdf_bytes = await pdf_renderer.render(proposal.html)
    except PdfRenderError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "code": "PDF_UNAVAILABLE",
                "message": f"PDF export is currently unavailable. {error}",
            },
        ) from error

    filename = safe_pdf_filename(proposal.filename)
    logger.info(f"Proposal PDF rendered for user {user.id} ({len(pdf_bytes)} bytes)")
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
