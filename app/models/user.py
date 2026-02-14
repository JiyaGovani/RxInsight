from datetime import date, datetime


class User:
    def __init__(self, user_id=None, username="", email="", password_hash=None,
                 contact_number=None, emergency_contact=None, date_of_birth=None,
                 weight=None, height=None, role=0, created_at=None):
        self.user_id = user_id
        self.username = username
        self.email = email
        self.password_hash = password_hash
        self.contact_number = contact_number
        self.emergency_contact = emergency_contact
        self.date_of_birth = date_of_birth
        self.weight = weight
        self.height = height
        self.role = role
        self.created_at = created_at
