from app.services.passwords import hash_password, verify_password


def test_hash_password_returns_argon2_encoded():
    encoded = hash_password("correct horse battery staple")
    assert encoded.startswith("$argon2")
    assert encoded != "correct horse battery staple"


def test_verify_password_correct():
    encoded = hash_password("hunter2hunter2")
    assert verify_password("hunter2hunter2", encoded) is True


def test_verify_password_wrong():
    encoded = hash_password("hunter2hunter2")
    assert verify_password("wrong-password", encoded) is False


def test_verify_password_malformed_hash():
    assert verify_password("anything", "not-a-real-argon2-hash") is False
