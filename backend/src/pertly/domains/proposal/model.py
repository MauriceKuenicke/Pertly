from pydantic import BaseModel, Field


class ProposalPdfRequest(BaseModel):
    """A fully rendered, self-contained proposal page (built by the frontend's `proposalHtml.ts`)."""

    html: str = Field(min_length=1)
    filename: str = Field(min_length=1, max_length=200)
