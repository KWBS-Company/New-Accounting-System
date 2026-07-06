import logging
import time
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

logger = logging.getLogger("ActivityLogger")
logging.basicConfig(level=logging.INFO)


class ActivityLogMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        method = request.method
        path = request.url.path
        xForwardedFor = request.headers.get("x-forwarded-for", "No Address")
        userAgent = request.headers.get("user-agent", "No Agent")
        ip = request.client.host if request.client else "unknown"
        userId = "Unauthenticated user"

        start = time.time()
        try:
            response: Response = await call_next(request)
            elapsed = round((time.time() - start) * 1000, 2)
            status = response.status_code
            if status >= 500:
                logger.error(
                    f"Server Error: {method} {path} - User ID: {userId} - Status: {status} - Real IP: {xForwardedFor} - User Agent: {userAgent} - Remote IP: {ip} - {elapsed}ms"
                )
            elif status >= 400:
                logger.warning(
                    f"Client Error: {method} {path} - User ID: {userId} - Status: {status} - Real IP: {xForwardedFor} - User Agent: {userAgent} - Remote IP: {ip} - {elapsed}ms"
                )
            else:
                logger.info(
                    f"Response: {method} {path} - User ID: {userId} - Status: {status} - Real IP: {xForwardedFor} - User Agent: {userAgent} - Remote IP: {ip} - {elapsed}ms"
                )
            return response
        except Exception as exc:
            logger.error(
                f"Exception: {method} {path} - User ID: {userId} - Real IP: {xForwardedFor} - User Agent: {userAgent} - Remote IP: {ip} - Error: {exc}"
            )
            raise
