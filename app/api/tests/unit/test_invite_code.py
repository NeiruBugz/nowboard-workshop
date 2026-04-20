import re

from app.services.teams import generate_invite_code


def test_generate_invite_code_length_and_charset():
    code = generate_invite_code()
    assert len(code) == 16
    assert re.fullmatch(r"[A-Za-z0-9_\-]{16}", code)


def test_generate_invite_code_unique_over_many_calls():
    codes = {generate_invite_code() for _ in range(1000)}
    assert len(codes) == 1000
