import asyncio
import re

from playwright.async_api import Browser, Playwright, Route, async_playwright

from pertly.common.config import logger, settings

# The proposal is served to the browser from this made-up origin, with a strict
# Content-Security-Policy *response header* (a meta tag could be dodged by markup
# placed before <head>). Together with disabled JavaScript and every other request
# aborted, the print page is inert: user-entered text is escaped by the frontend,
# and even if something slipped through it could neither run script nor load anything.
_RENDER_URL = "http://render.pertly.invalid/proposal"
_RENDER_HEADERS = {
    "Content-Type": "text/html; charset=utf-8",
    "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:",
}


class PdfRenderError(Exception):
    """The PDF could not be produced (browser unavailable, crashed or timed out)."""


def safe_pdf_filename(filename: str) -> str:
    """Restrict to a conservative character set so it is always a valid header value."""
    stem = re.sub(r"[^A-Za-z0-9._-]+", "-", filename).strip("-.") or "proposal"
    return stem if stem.lower().endswith(".pdf") else f"{stem}.pdf"


class PdfRenderer:
    """
    Prints proposal HTML to PDF with headless Chromium — the same engine (and the same
    A4 / no margin / background settings) the desktop app used via Electron's printToPDF.

    The browser is started lazily on first use and shared across requests; every render
    gets its own isolated, JavaScript-free, offline browser context. One instance is owned
    by the application lifespan (`app.state.pdf_renderer`), because the browser connection
    and the asyncio primitives are bound to the event loop that created them.
    """

    def __init__(self) -> None:
        self._playwright: Playwright | None = None
        self._browser: Browser | None = None
        self._launch_lock = asyncio.Lock()
        self._render_slots = asyncio.Semaphore(settings.pdf_max_concurrent_renders)

    async def render(self, html: str) -> bytes:
        """Render within the configured timeout, which also covers waiting for a free render slot."""
        try:
            return await asyncio.wait_for(self._render_in_slot(html), timeout=settings.pdf_render_timeout_seconds)
        except TimeoutError as error:
            logger.warning("PDF rendering timed out")
            raise PdfRenderError("Rendering timed out.") from error
        except PdfRenderError:
            raise
        except Exception as error:
            logger.exception("PDF rendering failed")
            raise PdfRenderError("Rendering failed.") from error

    async def shutdown(self) -> None:
        if self._browser is not None:
            await self._browser.close()
            self._browser = None
        if self._playwright is not None:
            await self._playwright.stop()
            self._playwright = None

    async def _render_in_slot(self, html: str) -> bytes:
        async with self._render_slots:
            return await self._render(html)

    async def _render(self, html: str) -> bytes:
        browser = await self._get_browser()
        context = await browser.new_context(java_script_enabled=False)
        try:

            async def serve_proposal_only(route: Route) -> None:
                if route.request.url == _RENDER_URL:
                    await route.fulfill(status=200, headers=_RENDER_HEADERS, body=html)
                else:
                    await route.abort()

            await context.route("**/*", serve_proposal_only)
            page = await context.new_page()
            await page.goto(_RENDER_URL, wait_until="load")
            return await page.pdf(
                format="A4",
                print_background=True,
                margin={"top": "0", "right": "0", "bottom": "0", "left": "0"},
            )
        finally:
            await context.close()

    async def _get_browser(self) -> Browser:
        async with self._launch_lock:
            if self._browser is not None and self._browser.is_connected():
                return self._browser
            if self._playwright is None:
                self._playwright = await async_playwright().start()
            try:
                self._browser = await self._playwright.chromium.launch(headless=True)
            except Exception as error:
                logger.exception("Could not launch Chromium (run `make install-browser` for local development)")
                raise PdfRenderError("PDF renderer is not available.") from error
            logger.info("Chromium started for PDF rendering")
            return self._browser
