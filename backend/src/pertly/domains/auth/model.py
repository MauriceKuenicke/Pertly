from pydantic import BaseModel

from pertly.domains.user.model import User


class AuthConfig(BaseModel):
    """What the login screen needs to know before anyone is signed in."""

    registration_open: bool


class ActiveSession(BaseModel):
    """A valid session and its user. `extended` is set when this lookup pushed the expiry forward."""

    user: User
    extended: bool
